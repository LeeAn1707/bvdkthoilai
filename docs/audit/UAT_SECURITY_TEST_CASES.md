# BỘ TEST CASE BẢO MẬT – VẬN HÀNH – NGHIỆM THU WEBSITE BỆNH VIỆN

**Repository:** https://github.com/LeeAn1707/bvdkthoilai  
**Ngày lập:** 22/10/2026  
**Môi trường được phép:** local/staging đã tách biệt production. Chỉ dùng tài khoản thử và dữ liệu bệnh nhân giả.

## 1. Hướng dẫn sử dụng

Các dòng dưới đây là **kịch bản đề xuất**, không phải kết quả test đã chạy. Cột kết quả để trống khi chưa thi hành. Người test ghi SHA, URL staging, build number, người chạy, ngày giờ, log/ảnh (ẩn danh), response HTTP, DB effects và ticket lỗi.

**Trạng thái:** `NOT RUN` / `PASS` / `FAIL` / `BLOCKED` / `N/A` (kèm lý do).  
**Nguyên tắc:** Dùng tối thiểu 1 người dùng giả cho mỗi role, 2 khoa/phòng giả có dữ liệu giả, 1 admin; kiểm tra API trực tiếp và UI riêng biệt. Không tự động gửi traffic tải cao tới website public.

## 2. Nhóm phân quyền và riêng tư

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-ACL-01 | P0 | Gửi `POST /api/appointments` (Payload collection endpoint), chưa đăng nhập, body hợp lệ nhưng có `status=completed`. Chỉ trên staging. | HTTP 401/403; database không có record mới. | NOT RUN |
| TC-ACL-02 | P0 | Chưa đăng nhập, gửi các field `staffNote`, `confirmedAt`, `code`, `source` qua đường public hợp lệ. | Các field nội bộ bị từ chối/ghi đè phía server; không có mass assignment. | NOT RUN |
| TC-ACL-03 | P0 | User role editor tin tức gọi GET collection appointments. | Từ chối; không lộ họ tên/SĐT/triệu chứng. | NOT RUN |
| TC-ACL-04 | P0 | Role procurement/HR/finance truy cập trực tiếp ID lịch khám của người khác. | 401/403/404 phù hợp; không lộ bản ghi nhạy cảm. | NOT RUN |
| TC-ACL-05 | P0 | Role không có quyền gửi PATCH/DELETE lịch khám bằng API. | Từ chối; dữ liệu trước/sau không đổi. | NOT RUN |
| TC-ACL-06 | P0 | Role không có quyền xuất gọi URL/export API hoặc server action trực tiếp. | 403; không có file Excel, không lộ dòng dữ liệu. | NOT RUN |
| TC-ACL-07 | P0 | Khi nghiệp vụ có chia khoa: user khoa A truy vấn, pagination, filter và export bản ghi khoa B. | Không nhận được dữ liệu khoa B từ bất cứ đường nào. | NOT RUN |
| TC-ACL-08 | P1 | Thử thay ID, query filter, `depth`, `limit` và endpoint export để lấy thêm dữ liệu. | Không vượt row-level authorization. | NOT RUN |
| TC-PRIV-01 | P0 | Export hợp lệ bằng role được phê duyệt; xem field trong Excel. | Chỉ các cột/record được phép, có audit trail. | NOT RUN |
| TC-PRIV-02 | P1 | Gây lỗi DB giả lập ở staging, đọc response và log. | Response không lộ SQL, secret, stack trace/PII; log được che/giới hạn truy cập. | NOT RUN |
| TC-PRIV-03 | P1 | Kiểm tra dữ liệu riêng tư trong URL, browser cache, search indexing và file media. | Không rò dữ liệu cá nhân ra URL công khai/crawler/cache public. | NOT RUN |

## 3. Nhóm API đặt lịch / chống lạm dụng

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-APPT-01 | P0 | Người dân đặt lịch hợp lệ qua `/api/appointments`. | Tạo đúng 1 phiếu; trả mã; backend lưu `status=new`. | NOT RUN |
| TC-APPT-02 | P0 | Thử gửi trực tiếp `status=completed`, `staffNote` qua form route. | Không tin input của client; các field nội bộ không bị ghi đè. | NOT RUN |
| TC-APPT-03 | P1 | SĐT/email/ngày giờ sai định dạng, field dài bất thường. | 400/422 dễ hiểu; không ghi dữ liệu sai. | NOT RUN |
| TC-APPT-04 | P1 | Gửi trùng cùng SĐT/ngày/chuyên khoa; nhấp nút liên tiếp. | Chặn hoặc xử lý idempotent theo nghiệp vụ; không sinh phiếu trùng ngoài ý muốn. | NOT RUN |
| TC-APPT-05 | P1 | Trên staging, dùng công cụ tải có giới hạn gửi 100–500 requests đồng thời với dữ liệu giả. | Không có mã phiếu trùng; database ghi nhất quán, tỷ lệ lỗi được giải thích. | NOT RUN |
| TC-APPT-06 | P1 | Sinh mã vào thời điểm chuyển ngày theo Asia/Ho_Chi_Minh. | Không trùng mã lịch sử; đúng quy cách và múi giờ. | NOT RUN |
| TC-APPT-07 | P1 | Giả lập đã cấp 9999 mã của một ngày bằng fixture. | Không quay vòng gây trùng; phản hồi hoặc cấp số mở rộng có kiểm soát. | NOT RUN |
| TC-APPT-08 | P1 | Sau nâng cấp schema sinh mã mới, truy cập mã lịch cũ. | Mã cũ còn tra cứu được, không bị đổi không báo trước. | NOT RUN |

## 4. Nhóm kiểm soát request và môi trường

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-SEC-01 | P0 | Staging giả lập `NODE_ENV=production` và không cấu hình Turnstile secret. | Preflight FAIL hoặc yêu cầu công khai bị chặn (fail-closed). | NOT RUN |
| TC-SEC-02 | P0 | Form gửi token Turnstile rỗng/sai/hết hạn. | 4xx; không ghi database. | NOT RUN |
| TC-SEC-03 | P0 | Form gửi token hợp lệ trong staging được cấp phép. | Request hoạt động khi input hợp lệ. | NOT RUN |
| TC-SEC-04 | P0 | Bỏ Turnstile và gửi thẳng REST collection endpoint. | Không tạo bản ghi nhờ khóa collection create. | NOT RUN |
| TC-SEC-05 | P1 | Sau số lần quá hạn trong một cửa sổ, request ở các instance khác nhau. | Giới hạn đồng bộ, trả 429 + Retry-After. | NOT RUN |
| TC-SEC-06 | P1 | Gửi `X-Forwarded-For`/`X-Real-IP` giả từ client vào proxy staging. | Không thay đổi danh tính IP tin cậy, không bypass rate limit. | NOT RUN |
| TC-SEC-07 | P1 | Gửi body vượt maxBytes nhưng không có Content-Length (chunked) đến staging. | 413/4xx; không quá tải bộ nhớ. | NOT RUN |
| TC-SEC-08 | P1 | Gửi JSON sâu, rất nhiều field, loại Content-Type không hỗ trợ. | Chặn đúng giới hạn; không treo/stack overflow. | NOT RUN |
| TC-SEC-09 | P1 | Gây lỗi 500 có thông điệp nội bộ ở staging. | Không hiển thị `error.message` cho client. | NOT RUN |
| TC-SEC-10 | P1 | Xác minh CORS/CSRF/origin khi API dùng cookie session; thử request khác nguồn. | Không thực hiện thao tác state-changing trái quyền. | NOT RUN |
| TC-SEC-11 | P1 | Upload thử file giả có phần mở rộng không khớp magic bytes, SVG script, quá kích thước. | Chặn theo chính sách, không chạy nội dung nguy hiểm, không ghi file public nhạy cảm. | NOT RUN |

## 5. Nhóm database, khả dụng, CI và phục hồi

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-DB-01 | P1 | Chạy `db:migrate:dry-run` trên DB staging đã ẩn danh. | Không thay đổi dữ liệu; báo rõ bước migration. | NOT RUN |
| TC-DB-02 | P1 | Apply migration có backup và chạy lại trên staging. | Idempotent/không xung đột; schema/data toàn vẹn. | NOT RUN |
| TC-DB-03 | P1 | Khởi động 2 instance staging cùng thời điểm migration. | Không DDL race; chỉ một job kiểm soát schema. | NOT RUN |
| TC-DB-04 | P1 | Giả lập deployment thất bại và thực hiện kế hoạch rollback. | App cũ hoặc forward-fix hoạt động; không mất record. | NOT RUN |
| TC-OPS-01 | P1 | Thay credential R2 sai trên staging rồi gọi readiness endpoint. | Báo degraded/unready; không trả “OK” chỉ vì env tồn tại. | NOT RUN |
| TC-OPS-02 | P1 | Tắt PostgreSQL staging có kiểm soát. | Readiness fail, liveness có thể vẫn healthy; alert hoạt động. | NOT RUN |
| TC-OPS-03 | P1 | Tắt một instance rồi tăng instance trên staging. | Rate-limit/phiên đăng nhập/DB connection ổn định theo thiết kế. | NOT RUN |
| TC-DR-01 | P1 | Chạy backup DB staging theo lịch trong ít nhất 2 chu kỳ. | 2 bản backup đầy đủ; checksum/metadata/alert thành công. | NOT RUN |
| TC-DR-02 | P1 | Restore dump vào PostgreSQL rỗng riêng biệt. | Restore thành công; số bảng/record/khóa liên quan đúng. | NOT RUN |
| TC-DR-03 | P1 | Restore media local hoặc object R2 từ bản sao độc lập. | Tệp đính kèm đọc được, metadata khớp. | NOT RUN |
| TC-DR-04 | P1 | Mô phỏng mất một file backup hoặc checksum sai. | Verify fail; cảnh báo và không tự coi backup hợp lệ. | NOT RUN |
| TC-DR-05 | P1 | Diễn tập khôi phục đo RTO/RPO. | Đạt ngưỡng do bệnh viện phê duyệt; có biên bản. | NOT RUN |
| TC-DR-06 | P1 | Gọi lệnh/script backup được khai báo ở `package.json` theo nền tảng đang dùng. | Mọi lệnh được công bố đều tồn tại và hoạt động. | NOT RUN |
| TC-CI-01 | P1 | Trên branch test, cố tình bật lại public collection create. | Security test FAIL chặn merge. | NOT RUN |
| TC-CI-02 | P1 | Trên branch test, mở quyền export cho editor. | RBAC test FAIL chặn merge. | NOT RUN |
| TC-CI-03 | P1 | Chạy `npm ci`, typecheck, audit, build, validator. | Các job thành công trên SHA dự kiến triển khai. | NOT RUN |
| TC-CI-04 | P1 | Kiểm tra branch protection / secrets của CI. | PR cần review, bảo mật dependency/secret scan; secrets không in log. | NOT RUN |

## 6. Mẫu ghi kết quả mỗi test

```text
Test case: TC-________
SHA: ______________________
Môi trường / URL (không ghi token): ______________________
Người thực hiện: ______________________
Ngày giờ: ______________________
Điều kiện dữ liệu giả: ______________________
Bước chạy: ______________________
Kết quả kỳ vọng: ______________________
Kết quả thực tế / HTTP / DB: ______________________
PASS / FAIL / BLOCKED / N/A: ______________________
Bằng chứng (path nội bộ / ảnh đã ẩn danh): ______________________
Issue/PR liên quan: ______________________
Người xác nhận: ______________________
```

## 7. Mẫu biên bản GO/NO-GO

```text
Đợt phát hành: ______________________
Commit SHA / image digest: ______________________
Ngày nghiệm thu: ______________________
P0 còn mở: ____    P1 chưa xử lý/chấp thuận: ____
Số test PASS / FAIL / BLOCKED: ____ / ____ / ____
Bản backup gần nhất và thời điểm restore drill: ______________________
Kế hoạch rollback & người trực: ______________________
Kết luận: GO / NO-GO
Ý kiến phụ trách CNTT: ______________________
Ý kiến phụ trách nghiệp vụ/tiếp đón: ______________________
Ý kiến người có thẩm quyền phê duyệt: ______________________
```

**CẢNH BÁO:** Không chạy thử tấn công, stress test hay can thiệp database trên website đang phục vụ người bệnh khi chưa có phạm vi/giấy phép và lịch bảo trì phù hợp.
