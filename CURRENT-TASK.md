# CURRENT TASK — Đổi thiết kế Điểm tin Bệnh viện theo phong cách Sở Y tế Cần Thơ

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu chuyển đổi thiết kế chuyên mục "Điểm tin Bệnh viện Đa khoa khu vực Thới Lai" trên trang chủ sang phong cách Cổng thông tin Sở Y tế Cần Thơ (`https://soyte.cantho.gov.vn/`).
- Bố cục theo chuẩn Sở Y tế:
  - Cột trái (~62%): Tiêu đề tin chính to rõ nằm trên cùng → Ảnh khổ lớn chất lượng cao (sắc nét, không bị dẹt/nén nhỏ) → Danh sách các tin phụ bên dưới có bullet vuông nhỏ.
  - Cột phải (~38%): Tiêu đề khối "TIN NỔI BẬT" có đường kẻ gạch chân đặc trưng → Danh sách các tin nổi bật có bullet vuông màu xanh dương và đường kẻ phân cách giữa các bài.
  - Tích hợp nút kính lúp "🔍 Phóng to" ngay trên ảnh chính để mở xem ảnh gốc chất lượng cao toàn màn hình (Lightbox) nếu người xem cần đọc chi tiết chữ nhỏ/mã QR/poster.

## 2. Các file đã tạo và cập nhật
1. `src/components/SoyTeNewsSection.tsx`:
   - Component React chuẩn client hỗ trợ hiển thị 2 cột, quản lý ảnh tiêu điểm, danh sách tin bài và modal Lightbox xem ảnh nét gốc.
2. `src/components/SoyTeNewsSection.module.css`:
   - Định dạng CSS 2 cột responsive (tự động chuyển thành 1 cột trên điện thoại / tablet), bullet vuông theo đúng phong cách Sở Y tế.
3. `src/app/(frontend)/page.tsx`:
   - Thay thế carousel cũ bằng `SoyTeNewsSection` trong section `featured-news`.
   - Lọc và truyền danh sách bài nổi bật (`soyteFeaturedSidebar`) cho cột bên phải.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100% không có lỗi.
- Kiểm tra render HTTP `localhost:3000`: STATUS 200 OK, hiển thị đầy đủ cấu trúc `soyteContainer` và `TIN NỔI BẬT`.
