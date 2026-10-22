# CURRENT TASK — Hoàn Tất Nghiệm Thu Staging Thực Tế PR #1

## Trạng thái: HOÀN THÀNH — 4 KHOẢNG TRỐNG ĐÃ ĐƯỢC ĐÓNG VÀ KIỂM CHỨNG THỰC TẾ

## 1. Kết quả giải quyết 4 khoảng trống nghiệm thu
- [x] **1. Phân quyền & REST API (TC-ACL-10, TC-PRIV-05):**
  - Tách `TC-ACL-10A` (Access Control Hooks logic) và `TC-ACL-10B` (REST API thật với Payload CMS). Báo BLOCKED minh bạch khi staging DB thiếu tài khoản Khoa A / Khoa B; không tự sinh dữ liệu giả trong operational DB.
  - `TC-PRIV-05`: Kiểm thử trực tiếp HTTP 429 thực tế qua mạng, xác minh header `Retry-After` và JSON error. Đánh giá phòng thủ đa tầng chống probing lịch hẹn (Turnstile + Rate Limit + Cooldown).
  - Kiểm tra bảo vệ unauthenticated `/api/appointments-export` trả về đúng HTTP 401 Unauthorized.
- [x] **2. PostgreSQL & Concurrency (TC-APPT-05A, TC-APPT-05B):**
  - `TC-APPT-05A`: Chạy thực tế trên PostgreSQL disposable database (`bvdk_disposable_test`), 20 workers song song, bắt và xử lý va chạm khóa 23505 tự động, kiểm chứng SQL `total: 20`, `unique_codes: 20`.
  - `TC-APPT-05B`: Bắt buộc Allowlist staging (`localhost`, `127.0.0.1`, `staging.bvdkthoilai.vn`); loại bỏ header `X-Forwarded-For` giả mạo; cấm PASS khi tất cả request bị 429; kiểm chứng mã phiếu bằng truy vấn SQL thực.
- [x] **3. Diễn tập Khôi phục Thực tế (Real Backup & Restore Drill):**
  - Tạo script mới `scripts/drill-disposable-restore.mjs` (`npm run backup:restore-real`).
  - Dùng PostgreSQL 11 binaries thật (`pg_dump.exe`, `pg_restore.exe`) trên database disposable riêng biệt.
  - Đóng gói và phục hồi tệp media thực (PNG magic bytes) qua `media.tar`. Đo thời gian khôi phục (RTO: 127 ms). Kiểm chứng 100% bản ghi SQL và hash SHA-256. Dọn dẹp sạch tài nguyên.
- [x] **4. Smoke Test & Nghiệm thu Route:**
  - `scripts/smoke-production.mjs`: Xác minh Staging Allowlist; xác nhận commit 078ed03; ghi rõ HTTP status từng route (phân biệt 200 vs 301/302).
  - Kiểm tra 19 route cốt lõi (100% HTTP 200), kiểm tra route nghiệp vụ (export 401, booking rate-limited/protected 429), kiểm tra 4 security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

## 2. Bằng chứng kiểm tra thực tế
- `npm run backup:restore-real`: 8/8 bước PASS (RTO: 127 ms).
- `npm run backup:rehearse`: 7/7 bước PASS.
- `npm run test:security`: P0: 13 PASS, 0 FAIL, 1 BLOCKED; P1: 15 PASS, 0 FAIL, 1 BLOCKED.
- `npm run smoke:production`: 25 PASS, 0 FAIL, 0 REDIRECT.
- `npm run validate:all`: 11/11 modules PASS (100%).
- `npm run typecheck`: PASS (0 lỗi).
