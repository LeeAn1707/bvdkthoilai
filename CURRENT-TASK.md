# CURRENT TASK — Bỏ ảnh nhỏ trong ô tin nổi bật và hiển thị mặc định 6 tin cố định rồi xoay vòng

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE THÀNH CÔNG

## 1. Yêu cầu & Kết quả đạt được
- Đã loại bỏ hoàn toàn phần thumbnail ảnh nhỏ trong từng ô bài viết ở cột TIN NỔI BẬT:
  + Ô bài viết trở nên thanh thoát, gọn gàng và tinh tế với layout:
    * Hàng 1 (Meta): Badge chuyên mục nền xanh nhạt `#eaf3fc`, chữ xanh đậm `#005a9e` + Ngày đăng bài `14/9/2026`.
    * Hàng 2 (Tiêu đề): Tiêu đề bài viết in đậm 2 dòng (`line-clamp: 2`), màu xanh đen navy `#0f3d64`.
    * Bên phải: Nút tròn mũi tên chevron phải `>` màu xanh dịu (`28px × 28px`).
- Khung nhìn hiển thị mặc định **6 tin nổi bật cố định** cùng lúc lúc ban đầu:
  + Chiều cao khung nhìn chuẩn xác `484px` (6 bài * 74px + 5 khoảng cách * 8px), cân bằng hoàn hảo với chiều cao của thẻ lớn bên trái.
  + Trong chu kỳ thời gian ban đầu (3.5s - 4.5s), 6 tin nổi bật đầu tiên đứng yên cố định và bài viết đầu tiên được hiển thị ở cột lớn bên trái.
  + Sau đó, danh sách tự động xoay vòng cuộn lên từng bài để các bài viết khác (bài 7, 8, ...) lần lượt xuất hiện và hiển thị sang cột trái, sau khi hết toàn bộ bài viết sẽ lặp lại vô tận.
  + Người dùng có thể bấm vào ô bất kỳ để chủ động chọn bài chiếu sang cột lớn bên trái.

## 2. Kết quả kiểm tra
- `npm run typecheck`: PASS 100% không có lỗi TypeScript.
- Kiểm tra tính toán bước nhảy `ITEM_STEP = 82px` tịnh tiến chính xác tuyệt đối.
