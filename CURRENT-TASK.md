# CURRENT TASK — Rà Soát Cuối Commit 8f98809 & Hoàn Tất Nghiệm Thu Staging

## Trạng thái: HOÀN TẤT 100% — ALL QUALITY GATES & STAGING TESTS PASSED

## 1. Nội dung đã thực hiện
- **Migration 081 & Concurrency Safety:**
  - Khóa bảng `LOCK TABLE public.appointments IN EXCLUSIVE MODE;` loại bỏ xung đột khi ghi lịch hẹn đồng thời lúc khởi tạo sequence.
  - Cơ chế khởi tạo idempotent: tính `target_val := GREATEST(max_val, curr_seq_val)`, sequence không bị lùi về sau nếu migration được chạy lại hoặc sequence đã tiến xa hơn mã lưu.
- **Nâng cấp verify() trong Migration 081:**
  - Xác minh sâu PostgreSQL catalog: `indisunique = true`, `indisvalid = true`, thuộc bảng `appointments` và đúng cột `code`.
  - Xác minh dữ liệu thực tế không có mã trùng (`COUNT(*) > 1` = 0) và sequence `last_value >= max_val`.
- **Kiểm soát quyền trường `code` (Appointments):**
  - Hook `beforeValidate` và `beforeOperation`: cấm tài khoản thường tự chỉ định hoặc sửa đổi `code` (HTTP 403 / tự động sinh mã nguyên tử hợp lệ), chỉ super-admin/system-admin/admin mới có quyền quản trị.
  - Sửa `route.ts` trả về `code: created?.code || finalCode` để đảm bảo mã API phản hồi đồng bộ tuyệt đối với mã lưu trong DB.
- **Kiểm thử tự động Migration 081 (`TC-MIG-081`):**
  - Kiểm thử khởi tạo lần đầu từ mã lớn nhất.
  - Kiểm thử chạy lại migration không làm lùi sequence (idempotent).
  - Kiểm thử trường hợp sequence lớn hơn mã lưu trong DB.
  - Thực thi xác minh thực tế qua `migration081.verify()`.
- **Hoàn tất `TC-ACL-10B` bằng 2 tài khoản Staging:**
  - Xác minh phân quyền thực tế qua REST API cho Khoa A (`test.khoaa@bvdkthoilai.vn`) và Khoa B (`test.khoab@bvdkthoilai.vn`): Đọc, Tạo, Sửa, Xóa, Xuất file Excel hoàn toàn cách ly theo khoa.

## 2. Kết quả kiểm tra thực tế
- `test:security-p0`: 14/14 PASS (bao gồm TC-ACL-10B qua REST API).
- `test:security-p1`: 20/20 PASS (bao gồm TC-APPT-05B, TC-APPT-08, TC-MIG-081, TC-PRIV-05B).
- `npm run typecheck`: PASS (0 errors).
- `npm run validate:migrations`: 354/354 PASS; DB schema contract 4/4 PASS.
- `npm run db:schema:check`: PASS.
- `npm run validate:all`: 100% PASS.
- `npm run build`: PASS (Next.js production build thành công 49/49 routes).
