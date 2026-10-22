# CURRENT TASK — Khắc Phục Trùng Mã Lịch Khám & Đảm Bảo Tính Duy Nhất Tuyệt Đối

## Trạng thái: HOÀN TẤT 100% — P0 DUPLICATE CODE RESOLVED

## 1. Nguyên nhân gốc rễ & Hiện trạng trước sửa
- Báo cáo TC-APPT-05B trước đó ghi nhận 20 bản ghi cùng mang mã `BVTL0001`.
- PostgreSQL test thiếu UNIQUE constraint/index trên cột `appointments.code`.
- Endpoint `/api/appointments` sử dụng thuật toán kiểm tra mã trong bộ nhớ (`payload.find`), gây điều kiện tương tranh (TOCTOU) khi nhiều request gửi đồng thời.

## 2. Giải pháp khắc phục (Đảm bảo an toàn dữ liệu)
- **Sao lưu an toàn:** Tạo bảng `appointments_backup_20261022` chứa toàn bộ 22 bản ghi cũ trước khi thao tác, không xóa bất kỳ dữ liệu nào. Resequence các bản ghi test trùng lặp để cho phép tạo UNIQUE index.
- **Migration 080:** `20261022_080_enforce_appointments_code_unique_and_counter.mjs` tạo bảng `appointment_daily_counters` cho atomic counter và tạo `UNIQUE INDEX appointments_code_idx ON appointments (code)`.
- **Sinh mã nguyên tử:** `src/lib/appointment-code.ts` sử dụng atomic PostgreSQL `ON CONFLICT DO UPDATE ... RETURNING current_val`.
- **Đồng bộ các luồng tạo:** Áp dụng atomic generator cho cả `/api/appointments` công khai và `src/collections/Appointments.ts` (`beforeValidate` hook cho Payload REST/Admin).
- **Cơ chế Retry Concurrency:** Bắt mã lỗi PostgreSQL `23505` (`unique_violation`) và tự động sinh mã mới tối đa 5 lần.
- **Tách biệt Concurrency & Rate Limit:** Bỏ IP spoofing; dùng `APPOINTMENTS_RATE_LIMIT_MAX` override cho môi trường kiểm thử tải.

## 3. Kết quả xác minh thực tế
- **Kiểm tra SQL trên PostgreSQL TEST:**
  - `SELECT COUNT(*) as total, COUNT(DISTINCT code) as unique_codes FROM appointments;` => Total: 178, Unique: 178.
  - `SELECT code, COUNT(*) as cnt FROM appointments GROUP BY code HAVING COUNT(*) > 1;` => 0 rows (Không còn bất kỳ mã trùng nào).
- **Kiểm thử Concurrency:**
  - 20 request đồng thời: 100% mã duy nhất, khớp chính xác response và PostgreSQL.
  - 100 request đồng thời: 100% mã duy nhất, không va chạm, không lỗi.
- **Suite Tests & Quality Gates:**
  - `npm run test:security-p1`: 18/18 PASS (bao gồm TC-APPT-05A, TC-APPT-05B, TC-PRIV-05B).
  - `npm run test:security-p0`: 13 PASS, 1 BLOCKED (thiếu tài khoản staging).
  - `npm run typecheck`: PASS (0 lỗi).
  - `npm run validate:migrations`: 350/350 PASS, schema contract 4/4 PASS.
  - `npm run db:schema:check`: PASS.
  - `npm run validate:all`: 100% PASS.
  - `npm run build`: PASS (Production build thành công).
