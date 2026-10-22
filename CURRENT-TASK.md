# CURRENT TASK — Khắc phục 9 Vấn đề Đợt Review Độc lập trên nhánh fix/security-audit

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE TOÀN DIỆN VÀ BUILD THÀNH CÔNG

## 1. Danh sách 9 vấn đề từ Review độc lập
- [x] **1. P0 (Secret Leak):** Xóa bỏ chuỗi mật khẩu database cũ khỏi `scripts/test-p1-security.mjs`, thay bằng regex kiểm tra pattern URL không chứa mật khẩu; kiểm tra sạch toàn repository; hướng dẫn xoay vòng secret và không in lại secret.
- [x] **2. P0 (Turnstile Mock):** Cấm `MOCK_TURNSTILE=true` ở `NODE_ENV=production`; chỉ cho phép mock ở `NODE_ENV=test`; bổ sung preflight check và test kiểm chứng (TC-SEC-01B).
- [x] **3. P0 (Department RBAC):** Giới hạn `department-manager` theo khoa cho `Appointments` (`appointmentAccess` cho `read` và `update`, lọc `department` khi xuất Excel); test cách ly độc lập Khoa A vs Khoa B (TC-ACL-07).
- [x] **4. P1 (Body Stream Limit):** Sửa `readJsonBodyWithLimit` đọc stream theo chunk, `reader.cancel()` ngay khi vượt 25KB trước khi buffer vào RAM; bổ sung test streaming (TC-SEC-07B).
- [x] **5. P1 (Concurrency Integration Test):** Chuyển `TC-APPT-05` sang test concurrency song song thực sự (`Promise.all`), kiểm chứng hành vi va chạm khóa PostgreSQL và cơ chế retry sinh mã duy nhất.
- [x] **6. P1 (Rate Limiting & Proxy):** Đánh giá rủi ro IP spoofing, biên soạn tài liệu kiến trúc `docs/audit/RATE_LIMIT_PROXY_ARCHITECTURE.md`, khuyến nghị Trusted Proxy và Redis/KV khi mở rộng đa instance.
- [x] **7. P1 (Sanitize Error Logging):** Khử khuẩn `console.error` ở route 500, loại bỏ hoàn toàn PII người bệnh và credentials DB trước khi log ra console (TC-SEC-09B).
- [x] **8. Regression CI #21:** Xác định nguyên nhân gốc lỗi `validate-patient-services.mjs` (đã có từ `main` sau khi cập nhật `Schedules.ts`), chuẩn hóa kiểm tra mà không làm thay đổi sealed DB schema contract.
- [x] **9. Quality Gate CI:** Bổ sung bước kiểm tra `npm run test:security` vào `.github/workflows/quality-gate.yml`.

## 2. Kết quả nghiệm thu thực tế
- `npm run test:security`: 20/20 test cases PASS (P0: 10/10, P1: 10/10).
- `npm run typecheck`: PASS (0 lỗi).
- `npm run validate:all`: PASS (11/11 bộ kiểm thử regression & system hardening).
- `npm run build`: PASS (Biên dịch Turbopack thành công, prerender 48 trang tĩnh & dynamic routes).
