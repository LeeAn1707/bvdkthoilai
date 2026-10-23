# ĐÁNH GIÁ KIẾN TRÚC: RATE LIMITING & TRUSTED REVERSE PROXY

**Dự án:** Bệnh viện Đa khoa Khu vực Thới Lai (bvdkthoilai)  
**Tài liệu kỹ thuật:** Đánh giá rủi ro bảo mật P1-01 & P1-02  
**Ngày lập:** 22/10/2026  

---

## 1. Phân tích rủi ro IP Spoofing qua HTTP Headers

### 1.1 Hiện trạng mã nguồn
Hàm `clientAddress(req)` trong `src/lib/request-security.ts` thực hiện trích xuất IP theo thứ tự ưu tiên:
1. `cf-connecting-ip` (Cloudflare Edge)
2. `x-real-ip` (Reverse Proxy / Nginx)
3. `x-forwarded-for` (Client chain)

### 1.2 Phân tích rủi ro (Threat Modeling)
- **Kịch bản Cloudflare chuẩn:** Khi toàn bộ traffic vào website đi qua Cloudflare CDN/WAF, Cloudflare sẽ ghi đè header `CF-Connecting-IP` bằng IP kết nối TCP thực tế của client. Client thông thường không thể tự giả mạo `CF-Connecting-IP` khi đi qua Cloudflare Edge.
- **Rủi ro Direct-to-Origin Bypass:** Nếu địa chỉ IP public của máy chủ gốc (Railway Container / VPS Origin) bị lộ hoặc mở cổng công khai trực tiếp ra Internet mà không qua Cloudflare:
  - Kẻ tấn công có thể gửi HTTP request thẳng tới IP origin kèm header tự tạo: `CF-Connecting-IP: 1.2.3.4`.
  - Hàm `clientAddress()` sẽ tin tưởng giá trị này, dẫn đến:
    - Vượt qua quota rate limit bằng cách xoay vòng IP giả mạo trong header.
    - Làm sai lệch IP trong audit log và thông tin lịch hẹn.

### 1.3 Khuyến nghị hạ tầng (Trusted Proxy Hardening)
1. **Thiết lập tường lửa chỉ chấp nhận traffic từ Cloudflare:**
   - Trên VPS / Nginx: Chỉ cho phép các dải IP CIDR chính thức của Cloudflare (https://www.cloudflare.com/ips/) kết nối tới port 80/443. Tất cả kết nối trực tiếp khác bị DROP.
   - Bật tính năng **Cloudflare Authenticated Origin Pulls (AOP)** với chứng chỉ client TLS để origin chỉ chấp nhận request đã được Cloudflare ký.
2. **Cấu hình Nginx reverse proxy an toàn:**
   ```nginx
   # Chỉ tin tưởng header từ các dải IP của Cloudflare
   set_real_ip_from 173.245.48.0/20;
   set_real_ip_from 103.21.244.0/22;
   # ... (các dải IP Cloudflare)
   real_ip_header CF-Connecting-IP;
   ```

---

## 2. Đánh giá In-Memory Rate Limiting (RAM Map) vs Shared Limiter

### 2.1 Hiện trạng In-Memory Rate Limiting
- Hệ thống đang dùng `buckets = new Map<string, { count: number; resetAt: number }>()` lưu trữ trực tiếp trong heap RAM của tiến trình Node.js.
- Có cơ chế dọn dẹp bộ nhớ tự động (`buckets.delete`) khi kích thước Map vượt quá 10.000 entries.

### 2.2 Đánh giá ưu điểm & hạn chế
| Tiêu chí | In-Memory Map (Hiện tại) | Shared Store (Redis / Upstash) |
|---|---|---|
| **Độ trễ (Latency)** | 0ms (In-process memory) | 1–5ms (Network roundtrip) |
| **Hạ tầng phụ thuộc** | Không phụ thuộc (Zero dependency) | Cần cụm Redis / KV store |
| **Chi phí vận hành** | Miễn phí | Tốn chi phí máy chủ Redis |
| **Single-Instance (1 container)** | **Rất tốt, an toàn, ổn định** | Không cần thiết |
| **Multi-Instance (>1 replicas)** | **Bị phân mảnh:** Mỗi container có RAM riêng, attacker có thể gửi $N \times \text{limit}$ requests | **Tập trung:** Quota được đồng bộ chính xác giữa tất cả containers |
| **Khả năng sống sót khi restart** | Bị xóa sạch khi container restart/deploy | Dữ liệu quota tồn tại xuyên suốt các đợt restart |

### 2.3 Kết luận & Lộ trình kiến trúc
1. **Giai đoạn hiện tại (Single-Container trên Railway / VPS):**
   - Giải pháp `Map` trong RAM hoàn toàn đáp ứng tốt nghiệp vụ đặt lịch khám bệnh viện (5 requests / 15 phút), chống click đúp và chống spam cơ bản.
   - Không phát sinh chi phí hoặc rủi ro mạng.
2. **Giai đoạn mở rộng (Khi triển khai Kubernetes / Multi-replica Pods):**
   - Khi cấu hình scaling > 1 instance, bắt buộc chuyển đổi cơ chế sang Shared Limiter (sử dụng `@upstash/ratelimit` hoặc `ioredis` với thuật toán sliding window log / token bucket).
   - Thiết kế adapter pattern trong `request-security.ts`: Nếu có biến môi trường `REDIS_URL`, kích hoạt Redis rate limiter; nếu không có, tự động fallback an toàn về In-Memory Map.
