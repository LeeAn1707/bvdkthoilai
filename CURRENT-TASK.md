# CURRENT TASK — Xác Minh Railway Test Database & Thực Thi TC-APPT-05A

## Trạng thái: HOÀN THÀNH — TC-APPT-05A ĐẠT 100% TRÊN RAILWAY TEST POSTGRESQL

## 1. Các hạng mục đã hoàn tất
- [x] **1. Kiểm tra DATABASE_URL và TEST_DATABASE_URL:**
  - Nạp an toàn từ `.env`, kiểm tra cấu trúc URL, không in mật khẩu ra log/terminal.
  - Cả hai biến cùng trỏ tới instance PostgreSQL thử nghiệm trên Railway (`altaria.proxy.rlwy.net:58194/railway`).
- [x] **2. Truy vấn chỉ đọc và xác minh database TEST độc lập:**
  - Kết nối thành công tới PostgreSQL 18.6 Debian.
  - Bảng `appointments` hoàn toàn trống (0 bản ghi, không chứa bất kỳ dữ liệu bệnh nhân thật nào).
  - Bảng `users` chỉ có 1 tài khoản admin; hệ thống không chứa dữ liệu vận hành sản xuất.
- [x] **3. Cập nhật cơ chế bảo vệ TC-APPT-05A:**
  - Chấp nhận PostgreSQL test instance trên Railway (`*.proxy.rlwy.net`) khi không chứa từ khóa production và `NODE_ENV !== 'production'`.
  - Tiếp tục chặn đứng mọi database production (từ khóa `production`, `prod-db`, `live-db`).
- [x] **4. Thực thi kiểm thử Concurrency 20 workers đồng thời:**
  - Không DROP DATABASE, không reset/xóa dữ liệu hệ thống.
  - Tạo bảng kiểm thử riêng biệt `test_appt_concurrency_<timestamp>_<hex>`.
  - 20 workers chạy đồng thời gửi request với cùng mã khởi đầu `BVTL0001`.
  - Đã kích hoạt và xử lý thành công va chạm khóa unique `23505` trên PostgreSQL thực tế.
  - Xác minh SQL: `total = 20`, `unique_codes = 20` (100% duy nhất, không trùng lặp).
  - Tự động dọn dẹp sạch sẽ bảng kiểm thử trong `finally`.

## 2. Kết quả kiểm tra
- `npm run test:security`: P0: 13 PASS, 0 FAIL, 1 BLOCKED; P1: 16 PASS, 0 FAIL, 2 BLOCKED (`TC-APPT-05A` chuyển sang **PASS**).
- `npm run typecheck`: PASS (0 lỗi).
