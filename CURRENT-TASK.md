# CURRENT TASK — Khắc Phục 6 Vấn Đề Review Độc Lập #2 (Commit ee9755b)

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE TOÀN DIỆN, BUILD PASS & ĐẨY LÊN GITHUB

## 1. Nội dung đã thực hiện theo yêu cầu
- [x] **1. P1 (Rò rỉ lỗi xuất Excel):** Sửa `src/app/(frontend)/api/appointments-export/route.ts` response 500 không trả `error.message`. Trả thông báo cố định kèm correlation `errorId` (`ERR-EXP-...`).
- [x] **2. P1 (Kiểm thử Concurrency PostgreSQL thực sự):** Nâng cấp `TC-APPT-05` trong `scripts/test-p1-security.mjs` sử dụng connection pool kết nối PostgreSQL staging/local, tạo bảng tạm có ràng buộc `UNIQUE (code)`, chạy 20 workers song song qua `Promise.all`. Bắt mã lỗi 23505, kích hoạt retry và xác minh 100% mã duy nhất, HTTP 200, 20 dòng ghi DB. Tự động drop bảng; an toàn bỏ qua nếu gặp DB production.
- [x] **3. P1 (Deny-by-default & Bảo vệ Department):** Rà soát `appointmentAccess` trong `src/access/index.ts`, tài khoản có custom permissions nhưng không gán khoa mặc định trả về `false` (fail-closed). Thêm `appointmentDepartmentFieldAccess` trong `src/collections/Appointments.ts` bảo vệ trường `department` khi cập nhật, kiểm thử bằng `TC-ACL-08`.
- [x] **4. P1 (An toàn log production):** Chuyển đổi log lỗi tại `src/app/(frontend)/api/appointments/route.ts` thành category có cấu trúc (`DATABASE_UNIQUE_VIOLATION`, `DATABASE_FOREIGN_KEY_VIOLATION`, v.v.). Loại bỏ hoàn toàn raw SQL queries và PII người bệnh ra console (TC-LOG-01).
- [x] **5. P1 (Bảo vệ riêng tư API đặt lịch):** Sửa response HTTP 409 trùng lịch, loại bỏ hoàn toàn mã lịch khám cũ (`code`), họ tên và ngày hẹn. Người chỉ biết SĐT không thể tra cứu thông tin phiếu hẹn cũ của người khác (TC-PRIV-04).
- [x] **6. Hoàn thiện CI & Nghiệm thu:**
  - Bổ sung `npm run build` vào `.github/workflows/quality-gate.yml`.
  - Cập nhật bộ UAT test cases `docs/audit/UAT_SECURITY_TEST_CASES.md` (chuyển TC-ACL-08, TC-APPT-05 sang PASS, bổ sung TC-SEC-09C, TC-PRIV-04, TC-LOG-01; giải trình chi tiết các ca NOT RUN).
  - Cập nhật `CHANGELOG.md`.

## 2. Kết quả kiểm tra nghiệm thu
- `npm run test:security`: 24/24 PASS (P0: 11/11, P1: 13/13).
- `npm run typecheck`: PASS (0 lỗi).
- `npm run validate:all`: PASS (11/11 modules).
- `npm run build`: PASS (Biên dịch thành công 48 routes).
