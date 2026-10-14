# CURRENT TASK — Đồng bộ hai chiều: Cột phải xoay vòng bài nào thì cột trái hiển thị bài đó

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu: Khi cột bên phải (TIN NỔI BẬT) xoay vòng đến bài viết nào thì cột bên trái phải hiển thị bài viết đó (Tiêu đề + Ảnh to sắc nét + Tóm tắt + Nhãn chuyên mục).

## 2. Giải pháp thực hiện
1. `src/app/(frontend)/page.tsx`:
   - Hàm `mapNewsToItem` nạp đầy đủ thông tin: ảnh đại diện độ nét cao (`image`), tỷ lệ hiển thị (`imageFit`, `imagePosition`), trích dẫn tóm tắt (`excerpt`), nhãn chuyên mục (`kind`), ngày đăng (`date`).
2. `src/components/SoyTeNewsSection.tsx`:
   - Liên kết biến `currentLead` ở cột trái đồng bộ 100% với `activeIndex` (vị trí bài đang xoay vòng ở cột phải).
   - Khi cột phải tự động cuộn đến bài tiếp theo, cột trái tự động chuyển cảnh (fade in + zoom êm mắt) hiển thị bài đó.
   - Khi người xem click vào bất kỳ bài nào trong danh sách cột phải, cột trái lập tức chuyển sang bài đó.
   - Bài viết đang được chiếu ở cột trái được đánh dấu nổi bật rõ ràng ở cột phải (`tickerItemActive`, bullet vuông sáng, nhãn `● Đang xem`).
3. `src/components/SoyTeNewsSection.module.css`:
   - Thêm các định dạng active item, animation chuyển đổi tiêu đề và ảnh mềm mại, sang trọng.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra render HTTP `localhost:3000`: STATUS 200 OK, `hasTickerItemActive = true`.
