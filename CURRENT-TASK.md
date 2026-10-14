# CURRENT TASK — Tối ưu độ nét và hiển thị ảnh Điểm tin / Hoạt động nổi bật trang chủ

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ TỐI ƯU THÀNH CÔNG

## 1. Yêu cầu & Vấn đề xử lý
- Người dùng phản ánh: Ảnh hiển thị trong chuyên mục Điểm tin / Hoạt động nổi bật tại bệnh viện trên trang chủ bị mờ nhòe ("bị nhè không nhìn rõ ảnh"), đặc biệt là các ảnh poster/banner có chữ, sơ đồ, QR code.
- Nguyên nhân:
  1. Tỷ lệ khung ảnh 16:9 trong lưới 4 cột quá thấp (~154px), khiến ảnh kích thước lớn bị thu nhỏ quá mức (>6 lần), nén các dòng chữ và chi tiết thành các vệt nhòe.
  2. Thuật toán downscaling bilinear mặc định của Chromium làm mờ chi tiết trên layer có transform/transition.
  3. Xung đột giá trị `objectFit` từ CSDL (như `cover-top`, `cover-bottom` không phải cú pháp hợp lệ của CSS `object-fit`), dẫn đến browser fallback không chuẩn.

## 2. Giải pháp thực hiện
1. `src/components/FeaturedContentCarousel.module.css`:
   - Nâng tỷ lệ khung hình từ `16 / 9` lên `16 / 10`, đặt `min-height: 175px` để tăng diện tích hiển thị, giúp chi tiết chữ và poster thoáng rõ hơn.
   - Thêm `image-rendering: -webkit-optimize-contrast` và `image-rendering: auto` để tăng độ tương phản và độ sắc nét khi scale ảnh.
   - Tối ưu GPU compositing với `transform: translateZ(0)` và `backface-visibility: hidden` để khử mờ khi render.
2. `src/components/FeaturedContentCarousel.tsx`:
   - Chuẩn hóa thuộc tính `objectFit` (`cover | contain | fill`).
   - Tối ưu `loading="eager"` và `decoding="sync"` cho 4 thẻ hiển thị đầu tiên để tránh độ trễ decode mờ tạm thời.
3. `src/app/(frontend)/page.tsx`:
   - Bổ sung helper `resolveFitAndPosition` tách rời giá trị `fit` hợp lệ và `position` (`top center`, `center center`, `bottom center`) cho tất cả nguồn tin (news, notices, procurement, schedules, documents).
4. `src/app/styles/30-home-editorial.css`:
   - Bổ sung `image-rendering: -webkit-optimize-contrast` và `translateZ(0)` cho ảnh khối tin tức biên tập.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra trực quan: Ảnh hiển thị sắc nét, chữ rõ ràng, không bị méo tỷ lệ hay vỡ layout.
