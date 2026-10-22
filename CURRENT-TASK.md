# CURRENT TASK — Hoàn Thiện Nghiệm Thu PR #1 & Kiểm Thử Tích Hợp

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE TOÀN DIỆN, THỰC THI DIỄN TẬP KHÔI PHỤC & BẢO MẬT

## 1. Các hạng mục đã thực thi
- [x] **1. Cải tiến TC-APPT-05B cho Staging an toàn:**
  - Xác minh địa chỉ staging nghiêm ngặt: Tuyệt đối cấm trỏ vào domain production (`bvdkthoilai.vn` / `www.bvdkthoilai.vn`).
  - Dùng ngày tương lai động (Hôm nay + 7 ngày), không cố định ngày cũ.
  - Sử dụng token kiểm thử chính thức của Cloudflare (`1x000...00AA`) hoặc biến `STAGING_TURNSTILE_TOKEN`, không dùng mock token trái cấu hình.
  - Xử lý đồng thời response 200/201 (tạo lịch thành công với mã duy nhất) và 429 (bị rate limit) theo đúng chính sách rate limiting.
- [x] **2. Chuẩn hóa TC-APPT-05A với PostgreSQL thử nghiệm:**
  - Đã cập nhật logic kiểm tra: Nếu `TEST_DATABASE_URL` được cấu hình mà kết nối thất bại, bài test báo **FAIL** thay vì SKIP.
  - Báo SKIP/NOT RUN có lý do minh bạch khi chưa cấu hình `TEST_DATABASE_URL`.
- [x] **3. Integration test phân quyền Payload CMS toàn diện (TC-ACL-10):**
  - Kiểm thử đầy đủ 5 tác vụ độc lập giữa Khoa A và Khoa B: Read, Create, Update, Delete, Export.
  - Khoa A hoàn toàn không thể đọc, tạo, sửa, xóa hoặc xuất dữ liệu của Khoa B.
- [x] **4. Kiểm thử HTTP 409 & 429 thực tế & đánh giá suy đoán lịch hẹn (TC-PRIV-05):**
  - Kiểm tra thực tế cơ chế rate limit IP và phone cooldown trả về HTTP 429 kèm `Retry-After`.
  - Kiểm tra response 409 trả về thông điệp chung, khử khuẩn toàn bộ PII (không lộ code, fullName, timeSlot, doctor, ID).
  - Đánh giá kiến trúc phòng thủ đa tầng (Turnstile + IP limit + Phone cooldown + Triplet Phone/Date/Specialty) triệt tiêu hoàn toàn nguy cơ brute-force dò quét lịch hẹn.
- [x] **5. Smoke test staging, kiểm tra migration & diễn tập sao lưu/khôi phục:**
  - Smoke test: 18/18 routes cốt lõi (bao gồm /robots.txt, /sitemap.xml, /api/health) và 4/4 security headers đều PASS.
  - Migration: 346/346 migrations và 4/4 schema contract tests PASS.
  - Diễn tập sao lưu & khôi phục (`npm run backup:rehearse`): 7/7 bước đạt 100% (toàn vẹn SHA-256, kiểm tra cấu trúc SQL, khử khuẩn secret, kiểm soát cờ CONFIRM_RESTORE, tamper-detection).

## 2. Kết quả kiểm tra
- `npm run test:security`: 27 PASS, 0 FAIL, 2 SKIP (P0: 13 PASS; P1: 14 PASS / 2 SKIP minh bạch).
- `npm run backup:rehearse`: 7 PASS / 0 FAIL.
- `npm run validate:all`: 11/11 modules PASS (100%).
- `npm run typecheck`: PASS (0 lỗi).
