# CURRENT TASK — Thiết Kế & Tối Ưu Kích Thước Banner Chuẩn Màn Hình Điện Thoại

## Trạng thái: HOÀN THÀNH

## Bối cảnh & Yêu cầu
- Thiết kế banner vừa vặn kích thước màn hình điện thoại cho Bệnh viện Đa khoa Khu vực Thới Lai.

## Đã triển khai
1. **Thiết kế ảnh Banner Mobile chuyên dụng**:
   - Tạo file [`public/banners/banner-bvdk-thoi-lai-mobile.png`](file:///f:/20.9%20web/bvdkthoilai-main/public/banners/banner-bvdk-thoi-lai-mobile.png) với kích thước **1080 × 540 px** (tỉ lệ 2:1 chuẩn màn hình smartphone hiện đại).
   - Nội dung thiết kế: Logo bệnh viện viền tròn nổi bật, tên đơn vị đầy đủ "SỞ Y TẾ THÀNH PHỐ CẦN THƠ / BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI", slogan "Điều trị bằng trái tim – Chăm sóc bằng tấm lòng", badge Cấp cứu 24/7 (0292 368 9115) và địa chỉ viện.
2. **Cấu hình tự động chuyển đổi ảnh Mobile ([`src/app/(frontend)/page.tsx`](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/page.tsx) & [`src/components/HeroBannerCarousel.tsx`](file:///f:/20.9%20web/bvdkthoilai-main/src/components/HeroBannerCarousel.tsx))**:
   - Khi truy cập trên điện thoại (màn hình <= 820px), thẻ `<picture>` tự động nạp ảnh banner mobile chuyên dụng thay cho banner ngang dài của máy tính.
3. **CSS Responsive mượt mà ([`src/app/globals.css`](file:///f:/20.9%20web/bvdkthoilai-main/src/app/globals.css))**:
   - Tự động co giãn theo tỉ lệ `aspect-ratio: 2 / 1`, phủ kín 100% bề ngang điện thoại mà không bị méo, không bị tràn viền hay mất chữ.

## Kiểm tra chất lượng (Verification)
- `npm run typecheck`: **PASS (0 lỗi)**.
- Ảnh hiển thị sắc nét, vừa vặn toàn màn hình điện thoại.




