# CURRENT TASK — Thêm hiệu ứng chuyển bài viết qua lại cho Điểm tin trang chủ

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu thêm hiệu ứng chuyển các bài viết qua lại với nhau trong chuyên mục Điểm tin Bệnh viện Đa khoa khu vực Thới Lai (thiết kế theo phong cách Sở Y tế Cần Thơ).

## 2. Giải pháp thực hiện
1. `src/components/SoyTeNewsSection.tsx`:
   - Bổ sung cơ chế Slideshow chuyển bài tự động (Autoplay) sau mỗi chu kỳ thời gian (mặc định theo cấu hình `carouselSeconds` hoặc 5 giây).
   - Thanh tiến trình thời gian thực (Progress bar) màu xanh y tế chạy mượt mà dưới đáy khung ảnh.
   - Nút điều hướng chuyển bài trước / sau (`‹` và `›`) cùng bộ đếm số bài (`1/4`, `2/4`...) đặt ở góc dưới ảnh.
   - Tự động tạm dừng (Pause on hover) khi rê chuột vào đọc tin hoặc xem ảnh.
   - Trạng thái liên kết tương tác với danh sách tin phụ bên dưới:
     - Dòng bài đang hiển thị ở ảnh chính được đánh dấu sáng (`leadSubItemActive`), đổi màu bullet vuông sang xanh dương (`subBulletActive`) và gắn nhãn `● Đang xem`.
     - Cho phép người xem bấm vào bất kỳ bài nào trong danh sách để bài đó lập tức chuyển lên làm bài chính có ảnh to.
   - Giữ nguyên nút kính lúp `🔍 Phóng to` xem ảnh nét toàn màn hình (Lightbox).
2. `src/components/SoyTeNewsSection.module.css`:
   - Hiệu ứng chuyển cảnh mượt mà: `imageFadeZoom` và `titleFadeIn` khi chuyển giữa các bài viết.
   - Hiệu ứng hover cho cột "TIN NỔI BẬT" (trượt nhẹ và mở rộng bullet).
3. `src/app/(frontend)/page.tsx`:
   - Kết nối `autoplaySeconds` từ cấu hình Homepage CMS vào `SoyTeNewsSection`.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra render HTTP `localhost:3000`: STATUS 200 OK, render đầy đủ `sliderControls` và `progressBarTrack`.
