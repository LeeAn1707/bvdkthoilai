# CURRENT TASK — Khắc phục Bảo mật P0/P1 & Kiểm thử Nghiệm thu

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE TOÀN DIỆN TRÊN NHÁNH fix/security-audit

## 1. Kết quả khắc phục Nhóm P0
- [x] **BVDK-P0-01 (TC-ACL-01, TC-SEC-04):** Khóa quyền tạo trực tiếp trên collection `Appointments` (`access.create: moduleAccess('appointments', 'create')`), ngăn chặn triệt để việc bypass qua REST/GraphQL. Người dân đặt lịch qua route kiểm soát `/api/appointments`.
- [x] **BVDK-P0-02 (TC-ACL-03..06):** Thu hồi toàn bộ quyền xem/tạo/sửa/xóa/xuất lịch khám của các role ngoài chuyên môn (`editor`, `hr`, `finance`, `procurement`). Chỉ cho phép `board`, `clinic-schedule`, `department-manager`. Quyền `delete` chỉ dành riêng cho elevated admin.
- [x] **BVDK-P0-03 (TC-SEC-01..03):** Cấu hình `verifyTurnstile` Fail-Closed trên production khi thiếu `TURNSTILE_SECRET_KEY`. Bổ sung preflight check bắt buộc có Turnstile keys và hỗ trợ test-mode an toàn.

## 2. Kết quả khắc phục Nhóm P1
- [x] **BVDK-P1-01 & P1-02 (TC-SEC-05..08):** Nâng cấp `clientAddress()` với regex IP an toàn, ưu tiên `cf-connecting-ip`. Thêm hàm `readJsonBodyWithLimit()` đếm byte thực tế của payload stream chống DoS và bypass `Content-Length`.
- [x] **BVDK-P1-03 (TC-APPT-05, TC-APPT-07):** Nâng cấp bộ sinh mã phiếu hẹn, không quay vòng số cũ khi > 9999 (`BVTL10000`...). Bổ sung cơ chế retry bắt lỗi `unique_violation` khi có nhiều request đồng thời.
- [x] **BVDK-P1-04 (TC-SEC-09, TC-PRIV-02):** Ẩn `error.message` và stack trace ở response 500, sinh mã `errorId` (correlation tracking) và không log PII người bệnh thô.
- [x] **BVDK-P1-07 (TC-OPS-01):** Cập nhật `storageProbe` thực hiện `HeadBucketCommand` tới Cloudflare R2 với timeout 3s và bộ nhớ đệm 30s tránh spam.
- [x] **BVDK-P1-08 / Secret Leak (TC-DR-06):** Xóa bỏ hoàn toàn chuỗi kết nối hardcoded chứa mật khẩu trong `scripts/backup-railway.mjs` và cập nhật `.gitignore` để script được track an toàn.

## 3. Kết quả kiểm thử & Đối chiếu
- `npm run test:security`: 16/16 test case tự động (P0 & P1) PASS 100%.
- `npm run typecheck`: PASS 100% không có lỗi TypeScript.
- `npm run validate:system-hardening`: 31/31 checks PASS.
- Đã đối chiếu và cập nhật 47 test cases trong `docs/audit/UAT_SECURITY_TEST_CASES.md`.
