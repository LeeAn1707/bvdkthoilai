# CURRENT TASK — Thực hiện Kế hoạch Khắc phục Bảo mật P0/P1

## Trạng thái: ĐANG THỰC HIỆN — GIAI ĐOẠN 1 (P0)

## 1. Mục tiêu & Phạm vi
- Khắc phục các lỗi bảo mật P0 & P1 theo tài liệu `docs/audit/P0_P1_REMEDIATION_PLAN.md` và `docs/audit/FULL_PROJECT_AUDIT.md`.
- Triển khai trên nhánh Git riêng biệt `fix/security-audit`.
- Không làm ảnh hưởng đến dữ liệu người bệnh thật, không chạy DDL/migration nguy hiểm trên production.
- Viết test kiểm chứng và đối chiếu 47 test cases trong `docs/audit/UAT_SECURITY_TEST_CASES.md`.

## 2. Các hạng mục nhóm P0 đang xử lý
- [ ] **BVDK-P0-01:** Khóa quyền `create` trực tiếp trên collection `Appointments` (`moduleAccess('appointments', 'create')`), chỉ cho phép staff có quyền hoặc API công khai qua route kiểm soát.
- [ ] **BVDK-P0-02:** Thu hẹp ma trận quyền `moduleRoleDefaults.appointments` theo nguyên tắc Least Privilege (loại bỏ editor, hr, finance, procurement; chỉ cho phép board, clinic-schedule, department-manager; chỉ elevated admin mới được delete).
- [ ] **BVDK-P0-03:** Cấu hình Turnstile fail-closed ở môi trường production/staging; bổ sung cờ an toàn cho môi trường test tự động.

## 3. Các hạng mục nhóm P1 tiếp theo
- [ ] **BVDK-P1-01 & P1-02:** Sanitization IP, chống spoofing headers, bảo vệ body size khi parse JSON stream.
- [ ] **BVDK-P1-03:** Nâng cấp thuật toán sinh mã phiếu hẹn an toàn (collision-free, transaction/unique constraint, retry an toàn).
- [ ] **BVDK-P1-04:** Ẩn `error.message` và stack trace ở response 500, sinh correlation ID, sanitize log.
- [ ] **BVDK-P1-07 & Secret Leak:** Probe storage thực tế, loại bỏ fallback connection string hardcoded trong `scripts/backup-railway.mjs`.
