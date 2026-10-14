# CURRENT TASK — Tối ưu Điểm tin: Cột trái 1 bài viết duy nhất & Cột phải tin nổi bật xoay vòng

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu:
  1. Cột bên trái: CHỈ hiển thị 1 bài viết duy nhất (bỏ danh sách các tin con bên dưới ảnh).
  2. Cột bên phải: Danh sách TIN NỔI BẬT chuyển động theo thứ tự xoay vòng (rotating infinite ticker).

## 2. Giải pháp thực hiện
1. `src/components/SoyTeNewsSection.tsx`:
   - Cột trái: Loại bỏ hoàn toàn `leadSubList` bên dưới ảnh. Chỉ giữ lại đúng 1 bài viết tiêu điểm: Tiêu đề to rõ + Thẻ nhãn & ngày tháng + Ảnh lớn sắc nét có nút phóng to 🔍 + Đoạn tóm tắt (excerpt) + Nút "Xem chi tiết bài viết →".
   - Cột phải: Xây dựng cơ chế cuộn xoay vòng vô tận mượt mà (Seamless Infinite Vertical Ticker):
     - Hiển thị 5 bài trong khung nhìn cao 390px (mỗi bài cố định chuẩn 78px).
     - Tự động trượt lên từng bài sau mỗi chu kỳ thời gian (mặc định 3.5s).
     - Nhân bản mảng cuối (`[...sidebarList, ...sidebarList.slice(0, 5)]`) và snap vị trí không giật khi hết vòng xoay.
     - Tạm dừng khi rê chuột vào (`pause on hover`).
     - Có nút điều khiển thủ công Lên / Xuống (`▲` và `▼`) ở tiêu đề cột.
2. `src/components/SoyTeNewsSection.module.css`:
   - Định dạng khung nhìn `.tickerViewport` và đường ray `.tickerTrack`.
   - Cân đối chiều cao hoàn hảo giữa cột trái và cột phải (~390px - 440px).
3. `src/app/(frontend)/page.tsx`:
   - Tăng danh sách bài tham gia xoay vòng ở cột TIN NỔI BẬT lên tối đa 20 bài.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra render HTTP `localhost:3000`: STATUS 200 OK, `hasLeadSubList = false`, `hasTickerViewport = true`.
