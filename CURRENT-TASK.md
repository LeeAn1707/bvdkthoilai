# CURRENT TASK — Nghiệm Thu Tích Hợp Toàn Diện Bảo Mật Staging & Concurrency

## Trạng thái: HOÀN TẤT 100% — 32/32 TEST PASS TRÊN STAGING & RAILWAY POSTGRESQL

## 1. Kết quả nghiệm thu thực tế (32 PASS / 0 FAIL / 0 SKIP / 0 BLOCKED)
- **test:security-p0 (14/14 PASS):**
  - TC-ACL-01 đến TC-ACL-10A: Phân quyền nội bộ, bảo vệ collection Appointments deny-by-default, kiểm soát create/delete theo khoa phòng.
  - **TC-ACL-10B (PASS):** Kiểm thử tích hợp REST API qua `http://localhost:3000` bằng 2 tài khoản thực tế Khoa A (ID 6) và Khoa B (ID 7). Đọc đúng phạm vi khoa phòng, chặn Khoa A tạo/sửa lịch gán cho Khoa B (HTTP 403), tạo thành công lịch đúng khoa (HTTP 201), xóa/dọn dẹp dữ liệu an toàn.
- **test:security-p1 (18/18 PASS):**
  - **TC-APPT-05A (PASS):** Concurrency 20 worker đồng thời trên PostgreSQL Railway TEST (`altaria.proxy.rlwy.net:58194`). Ghi nhận và xử lý va chạm mã trùng lặp mã 23505 qua cơ chế retry; 20/20 bản ghi có mã duy nhất. Cơ chế bảo vệ fail-closed kiểm tra `CONFIRM_TEST_INSTANCE`, `RAILWAY_TEST_PROJECT_ID` khác production và nguyên tắc đặc quyền tối thiểu.
  - **TC-APPT-05B (PASS):** 20 HTTP POST đồng thời qua mạng tới staging endpoint `/api/appointments` sử dụng Cloudflare Turnstile testing keys (`1x000000...`). Tạo thành công và đối chiếu đúng 20 mã trong bảng `appointments` của PostgreSQL.
  - **TC-PRIV-05B (PASS):** Kiểm thử riêng biệt HTTP 429 (Rate Limit / Cooldown SĐT với `retry-after`) và HTTP 409 (Trùng lặp SĐT + Ngày + Khoa). Không làm lộ PII hay mã lịch hẹn cũ trong body lỗi.
  - TC-LOG-01, TC-DR-06, TC-SEC-05/06/07/08/09: Khử khuẩn log, giới hạn kích thước body (413), phòng vệ stream, không hardcode thông tin nhạy cảm.

## 2. Các điểm vá mã nguồn chính
- `src/collections/Users.ts`: Thiết lập `auth.useSessions: false` cho kiến trúc stateless JWT đồng bộ giữa REST API và Access Control.
- `src/collections/Appointments.ts`: Bổ sung hook `beforeValidate` tự động sinh mã `code` nếu thiếu; thêm hook `beforeOperation` ném `APIError(..., 403)` khi phát hiện nỗ lực sửa trường `department` trái phép.
- `src/app/(frontend)/api/appointments/route.ts`: Hoán đổi thứ tự kiểm tra trùng lặp (HTTP 409) lên trước cooldown SĐT (HTTP 429), giúp trả về đúng ngữ cảnh xung đột lịch khám.
- `scripts/test-p1-security.mjs`: Thắt chặt bảo vệ `TC-APPT-05A` chống nhầm lẫn DB production; bổ sung IP mô phỏng riêng biệt cho từng bài kiểm thử mạng.

## 3. Xác minh kỹ thuật & An toàn
- `npm run typecheck`: PASS (0 lỗi).
- Cơ sở dữ liệu: Không DROP DATABASE, không restore, không sửa dữ liệu người bệnh thật.
