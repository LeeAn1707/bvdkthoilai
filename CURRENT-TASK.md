# CURRENT TASK — Chốt An Toàn Script Nghiệm Thu Trước Khi Merge PR #1

## Trạng thái: HOÀN THÀNH — TOÀN BỘ RỦI RO SCRIPT ĐÃ ĐƯỢC KHÓA AN TOÀN

## 1. Các hạng mục an toàn đã hoàn tất
- [x] **1. Khóa an toàn tuyệt đối scripts/drill-disposable-restore.mjs:**
  - Cấm đọc DATABASE_URL từ `.env`; bắt buộc dùng `TEST_ADMIN_DATABASE_URL` trên test instance riêng biệt.
  - Sử dụng runId ngẫu nhiên duy nhất (`bvdk_drill_${Date.now()}_${randHex}`); kiểm tra không trùng tên; chỉ drop database do chính phiên hiện tại tạo ra (xác thực quyền sở hữu).
  - Tự động phát hiện công cụ PostgreSQL (hỗ trợ PG_BIN_DIR, PATH, Windows v11-v17); yêu cầu pg_restore hoàn tất thành công với exit code 0; phân biệt rõ thời gian mẫu vs RTO ước lượng toàn hệ thống.
- [x] **2. Chuẩn hóa TC-APPT-05A:**
  - Loại bỏ hoàn toàn fallback từ `DATABASE_URL` chính; không tự tạo/xóa database cố định.
  - Yêu cầu `TEST_DATABASE_URL` độc lập với cơ chế fail-closed chống kết nối production; dùng bảng tạm duy nhất `test_appt_concurrency_${Date.now()}_${randHex}`.
- [x] **3. Tách bạch và chống nuốt lỗi TC-PRIV-05:**
  - Tách thành `TC-PRIV-05A` (Unit/Logic: Rate limit, Cooldown, cấu trúc 409, phân tích probing) và `TC-PRIV-05B` (Live Network HTTP).
  - `TC-PRIV-05B` tuyệt đối không nuốt lỗi mạng; bắt buộc nhận phản hồi bảo vệ chuẩn (429/400/409); báo BLOCKED nếu chưa cấu hình `STAGING_API_URL`.
- [x] **4. Hoàn thiện TC-ACL-10B đầy đủ 5 thao tác CRUD + Export:**
  - Kiểm tra thực tế READ (lọc theo khoa), CREATE (chặn khoa khác, cho phép đúng khoa), UPDATE (chặn đổi department, chặn khoa khác sửa), DELETE (chặn khoa khác xóa, cho phép đúng khoa xóa), EXPORT (chỉ xuất dữ liệu khoa mình).
  - Tự động dọn dẹp an toàn các bản ghi test (tiền tố `TEST-STAGING-APPT-A`).
- [x] **5. Nâng cấp Smoke Test xác thực commit máy chủ:**
  - `/api/health` phát tín hiệu commit qua header `X-Server-Commit` và trường JSON `commit`.
  - Smoke test đọc commit phản hồi thực tế từ máy chủ qua HTTP để đối chiếu commit mục tiêu nghiệm thu (`078ed03`).

## 2. Kết quả kiểm tra
- `npm run test:security`: P0: 13 PASS, 0 FAIL, 1 BLOCKED; P1: 14 PASS, 0 FAIL, 3 BLOCKED (an toàn fail-closed khi thiếu biến môi trường test ngoài).
- `npm run smoke:production`: 25 PASS, 0 FAIL, 0 REDIRECT.
- `npm run validate:all`: 11/11 modules PASS (100%).
- `npm run typecheck`: PASS (0 lỗi).
