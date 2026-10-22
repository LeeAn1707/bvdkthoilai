# CURRENT TASK — Khắc Phục Rủi Ro Trùng Mã Khi Chuyển Ngày Mới (PostgreSQL Sequence)

## Trạng thái: HOÀN TẤT 100% — P0 DATE ROLLOVER RESOLVED

## 1. Xác minh rủi ro & Nguyên nhân gốc
- Bộ đếm theo `date_key` trước đó bị reset về 1 khi bước sang ngày mới (ví dụ 22/10 -> 23/10).
- Do định dạng mã bệnh viện là `BVTL0001` (không chứa thành phần ngày), việc reset về 1 khiến ngày mới va chạm trực tiếp với mã lịch sử và vi phạm UNIQUE index `appointments_code_idx` (lỗi 23505).
- Đã xác minh thực nghiệm trên PostgreSQL TEST: giả lập ngày 2026-10-23 sinh mã `BVTL0001` đã tồn tại trong database gây lỗi 23505 chính xác như review đã chỉ ra.

## 2. Giải pháp khắc phục (Global Monotonic Sequence)
- **Migration 081:** `20261022_081_create_global_appointment_code_sequence.mjs` tạo sequence PostgreSQL toàn cục `public.appointment_code_seq`, khởi tạo an toàn từ giá trị lớn nhất hiện có trong `appointments` (`COALESCE(MAX(SUBSTRING(code FROM 5)), 0)`).
- **Bộ sinh mã nguyên tử độc lập ngày & timezone:** `src/lib/appointment-code.ts` gọi trực tiếp `SELECT nextval('public.appointment_code_seq')`, tăng liên tục đơn điệu (1, 2, ... 205, 206...), không bao giờ reset về 1 và hoàn toàn độc lập với timezone PostgreSQL.
- **Loại bỏ fallback âm thầm:** Bỏ hoàn toàn việc tạo mã ngẫu nhiên dạng hex; ném lỗi có kiểm soát `APPOINTMENT_CODE_GENERATOR_ERROR` khi cơ sở dữ liệu gặp sự cố.
- **Duy trì toàn vẹn dữ liệu:** Giữ nguyên toàn bộ mã đã có và UNIQUE index `appointments_code_idx`. Không sửa hoặc đánh lại mã lịch hẹn cũ.

## 3. Kết quả xác minh thực tế & Quality Gates
- **Xác minh SQL trên PostgreSQL TEST:**
  - `SELECT COUNT(*) as total, COUNT(DISTINCT code) as unique_codes FROM appointments;` => Total: 325, Unique: 325.
  - `SELECT code, COUNT(*) as cnt FROM appointments GROUP BY code HAVING COUNT(*) > 1;` => 0 rows (Không còn bất kỳ mã trùng nào).
  - Khởi tạo sequence chính xác tại mã lớn nhất hiện có: `last_value = 205`, `is_called = true`.
- **Kiểm thử Concurrency & Rollover (TC-APPT-08, TC-APPT-05B):**
  - Chuyển ngày mới: Tiếp tục cấp số kế tiếp đơn điệu, không reset, không va chạm.
  - Timezone: Độc lập 100% trên cả 3 timezone (UTC, Asia/Ho_Chi_Minh, America/New_York).
  - Multi-instance & Restart Server: 2 instance đồng thời và restart pool sequence vẫn hoạt động chính xác.
  - 20 và 100 request đồng thời: 100% mã duy nhất, không va chạm.
- **Suite Tests & Quality Gates:**
  - `npm run test:security-p1`: 19/19 PASS (bao gồm TC-APPT-05A, TC-APPT-05B, TC-APPT-08, TC-PRIV-05B).
  - `npm run test:security-p0`: 13 PASS, 1 BLOCKED (thiếu tài khoản staging).
  - `npm run typecheck`: PASS (0 lỗi).
  - `npm run validate:migrations`: 354/354 PASS, schema contract 4/4 PASS.
  - `npm run db:schema:check`: PASS.
  - `npm run validate:all`: 100% PASS.
  - `npm run build`: PASS (Production build thành công).
