# CURRENT TASK — Sửa Các Phát Hiện Cuối Trước Khi Nghiệm Thu Staging PR #1

## Trạng thái: HOÀN THÀNH — TẤT CẢ PHÁT HIỆN CUỐI ĐÃ ĐƯỢC XỬ LÝ TRIỆT ĐỂ

## 1. Các hạng mục đã hoàn tất
- [x] **1. Khắc phục lỗi đếm quota hai lần tại `/api/appointments`:**
  - Xóa bỏ lệnh gọi `rateLimit()` trùng lặp ở đầu route; chỉ kích hoạt duy nhất một lần tại bước kiểm tra chính sách với `maxSubmissions` cấu hình từ admin.
  - Bổ sung test `TC-SEC-05B` xác minh mã nguồn chỉ gọi đúng 1 lần và kiểm chứng chính xác số lượt hợp lệ trước khi trả về HTTP 429.
- [x] **2. Chuẩn hóa Routing API cho TC-ACL-10B:**
  - Route `/api/appointments` hỗ trợ cả 2 luồng: nếu có header `Authorization: JWT/Bearer` hoặc cookie `payload-token` hoặc `x-payload-rest`, hệ thống tự động ủy quyền về Payload REST API (`REST_POST`, `REST_GET`, `REST_PATCH`, `REST_DELETE`).
  - Request đặt lịch công khai của người dân từ `AppointmentBookingForm.tsx` (không auth) vẫn tiếp tục xử lý qua luồng công khai bình thường với Turnstile và LK-code.
- [x] **3. Bảo vệ credentials và siết chặt kiểm tra instance test trong restore drill:**
  - Khử khuẩn 100% mật khẩu và connection string thông qua `sanitizeText`; tuyệt đối không in mật khẩu hoặc URL thô ra terminal/CI.
  - Bắt buộc quản trị viên xác nhận thông qua `CONFIRM_TEST_INSTANCE=true` mới cho phép chạy thao tác tạo/xóa database.
  - Kiểm tra hostname bắt buộc nằm trong Allowlist máy chủ test an toàn hoặc được chỉ định qua `VERIFIED_TEST_HOST`.
- [x] **4. Hoàn thiện xác thực commit máy chủ trong Smoke Test:**
  - Bắt buộc biến môi trường `EXPECTED_COMMIT_SHA`; nếu thiếu hoặc máy chủ không trả về commit qua HTTP hoặc commit không khớp thì ghi nhận FAIL dứt khoát; xóa bỏ hoàn toàn SHA cũ làm mặc định.
- [x] **5. Hoàn thiện hai bài integration test:**
  - `TC-APPT-05B`: Yêu cầu bắt buộc `TEST_DATABASE_URL`, đối chiếu thực tế các mã phiếu ghi nhận trong PostgreSQL, từ chối mọi kết quả có lỗi mạng chưa xử lý.
  - `TC-PRIV-05B`: Kiểm tra độc lập cả HTTP 429 (vượt ngưỡng tần suất/cooldown) và HTTP 409 (xung đột thông tin trùng lặp), không cho phép dùng một mã bất kỳ thay thế cho nhau.

## 2. Kết quả kiểm tra
- `npm run test:security`: P0: 13 PASS, 0 FAIL, 1 BLOCKED; P1: 15 PASS, 0 FAIL, 3 BLOCKED (an toàn fail-closed khi thiếu biến môi trường staging/test bên ngoài).
- `npm run typecheck`: PASS (0 lỗi).
- `npm run validate:all`: 11/11 modules PASS (100%).
- `npm run build`: Thành công 100% với Next.js và Turbopack.
