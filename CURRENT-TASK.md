# CURRENT TASK — Xử Lý Lỗi Khôi Phục Admin & Sửa Lỗi Thiếu Primary Key Trên Railway

## Trạng thái: HOÀN THÀNH

## Nội dung đã xử lý
1. **Mở khóa tài khoản Admin**:
   - Tài khoản `leean170792@gmail.com` bị khóa tự động sau 5 lần thử sai (`lockTime: 15 phút`).
   - Đã reset `login_attempts = 0` và `lock_until = NULL` trên CSDL Railway.

2. **Khắc phục lỗi 500 khi đăng nhập trên Railway**:
   - Phát hiện nguyên nhân qua logs: `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification`.
   - Do khi import/restore CSDL bị lỗi giữa chừng, các bảng `users` và `site_visits_summary` bị thiếu ràng buộc Khóa chính (`PRIMARY KEY`).
   - Đã tạo lại khóa chính trên CSDL Railway:
     ```sql
     ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
     ALTER TABLE site_visits_summary ADD CONSTRAINT site_visits_summary_pkey PRIMARY KEY (id);
     ```

3. **Ghi chép tài liệu phòng tránh vào dự án**:
   - Đã cập nhật vào [docs/ai/database.md](file:///f:/20.9%20web/bvdkthoilai-main/docs/ai/database.md#L36-L45) quy tắc an toàn khi backup/restore CSDL.
   - Đã bổ sung mục 10 vào [docs/RAILWAY-DEPLOYMENT.md](file:///f:/20.9%20web/bvdkthoilai-main/docs/RAILWAY-DEPLOYMENT.md#L192-L203) hướng dẫn xử lý lỗi thiếu constraint và phương pháp dump/restore chuẩn.



