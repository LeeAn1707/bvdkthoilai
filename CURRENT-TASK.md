# CURRENT TASK — Hoàn Tất Kiểm Thử Tích Hợp Thực Tế & Đóng Khoảng Trống Nghiệm Thu (Commit c9af8c3)

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE TOÀN DIỆN, BUILD PASS & PUSH LÊN GITHUB

## 1. Nội dung đã thực hiện theo yêu cầu
- [x] **1. Sửa hệ thống đếm kết quả `test:security`:** Thêm `skipCount` và `skipTest`. Mọi bài test không chạy (thiếu môi trường cấu hình) đều được báo `SKIP / NOT RUN`, tuyệt đối không cộng vào `PASS`. Nghiêm cấm tự động dùng `DATABASE_URL` chính cho các bài test ghi/xóa dữ liệu, chỉ dùng `TEST_DATABASE_URL` riêng biệt.
- [x] **2. Tách TC-APPT-05 thành các phần độc lập:**
  - `TC-APPT-05`: Unit simulation thuật toán retry sinh mã duy nhất trong 20 luồng đồng thời `Promise.all` (PASS).
  - `TC-APPT-05A`: Kiểm thử Unique Constraint trên PostgreSQL thật với `TEST_DATABASE_URL` (20 requests đồng thời, bắt lỗi 23505, ghi nhận đúng 20 dòng và 100% mã duy nhất). Báo SKIP/NOT RUN nếu chưa cấu hình `TEST_DATABASE_URL` riêng.
  - `TC-APPT-05B`: Integration test gửi 20 HTTP requests tới API `/api/appointments` trên staging. Báo SKIP/NOT RUN nếu chưa cấu hình `STAGING_API_URL`.
- [x] **3. Rà soát quyền `create` và `delete` của collection Appointments:**
  - Tạo `appointmentCreateAccess`: Ngăn tài khoản Khoa A tạo lịch hẹn gán cho Khoa B; người dùng không gán khoa bị chặn theo Deny-by-default.
  - Cập nhật `access.delete` dùng `appointmentAccess('delete')`: Giới hạn phạm vi xóa chỉ trong khoa của người dùng qua WHERE clause; người dùng không gán khoa bị từ chối xóa hoàn toàn.
  - Thêm hook `beforeChange` trên `Appointments` tự động gán và kiểm tra tính toàn vẹn khoa tiếp nhận.
  - Bổ sung test tự động `TC-ACL-09` trong `scripts/test-p0-security.mjs` (PASS).
- [x] **4. Kiểm thử response HTTP 409 thực tế & chống dò tìm lịch khám:**
  - Sửa `src/app/(frontend)/api/appointments/route.ts` phản hồi thông điệp lỗi chung, không tiết lộ mã phiếu hẹn cũ (`code`) và không trả lại ngày hẹn cụ thể để triệt tiêu nguy cơ dò tìm (probing) lịch khám người khác.
  - Cập nhật test `TC-PRIV-04` trong `scripts/test-p1-security.mjs` đối chiếu trực tiếp mã nguồn route thực tế.
- [x] **5. Kiểm tra GitHub Actions CI:**
  - Xác nhận Run ID `39708465098` cho commit `c9af8c3` đã tự động chạy và đạt trạng thái `SUCCESS` trên toàn bộ các bước: TypeScript check, Security checks, Regression checks, và Next.js build.
- [x] **6. Báo cáo & Nghiệm thu:**
  - Cập nhật [docs/audit/UAT_SECURITY_TEST_CASES.md](file:///f:/20.9%20web/bvdkthoilai-main/docs/audit/UAT_SECURITY_TEST_CASES.md) với chi tiết trạng thái PASS, FAIL, SKIP/NOT RUN và căn cứ thực tế.
  - Cập nhật [CHANGELOG.md](file:///f:/20.9%20web/bvdkthoilai-main/CHANGELOG.md).

## 2. Kết quả kiểm tra nghiệm thu
- `npm run test:security`: 25 PASS, 0 FAIL, 2 SKIP (P0: 12 PASS / 0 FAIL / 0 SKIP; P1: 13 PASS / 0 FAIL / 2 SKIP).
- `npm run typecheck`: PASS (0 lỗi).
- `npm run validate:all`: PASS (11/11 modules).
- `npm run build`: PASS (Biên dịch Turbopack thành công, prerender 48 routes).
