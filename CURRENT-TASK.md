# CURRENT TASK — Bổ sung cơ chế tự động lấp đầy tin cho cột TIN NỔI BẬT

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu & Vấn đề giải quyết
- Người dùng thắc mắc: Cột "TIN NỔI BẬT" bên phải của chuyên mục Điểm tin chỉ hiển thị 1 tin duy nhất ("LỊCH NGÀY 21.9.2026") và để lại khoảng trắng lớn, hỏi khi nào mới hiển thị tin ở bên này.
- Nguyên nhân:
  - Cột này trước đó chỉ lọc các bài viết có tích chọn `featured === true` ("Tin nổi bật") trong Admin CMS.
  - Do trong cơ sở dữ liệu hiện tại mới chỉ có đúng 1 bài viết được tích chọn "Tin nổi bật", dẫn đến cột bị thiếu bài.
- Giải pháp:
  - Nâng cấp cơ chế hiển thị thông minh (Smart Auto-Fill):
    1. Ưu tiên đưa các bài được quản trị viên tích chọn "Tin nổi bật" lên hàng đầu.
    2. Tự động lấy thêm các bài tin tức / thông báo mới nhất khác bù vào để cột bên phải luôn lấp đầy đủ 6 – 7 bài tin, đều đặn và cân đối với cột bên trái theo đúng giao diện Sở Y tế.
    3. Hướng dẫn quản trị viên cách tích chọn "Tin nổi bật" trong Admin khi muốn ghim một bài viết bất kỳ lên cột này.

## 2. Các file đã cập nhật
- `src/app/(frontend)/page.tsx`: Gộp các tin nổi bật và tin mới nhất cho `soyteFeaturedSidebar`.
- `src/components/SoyTeNewsSection.tsx`: Bổ sung cơ chế auto-fill từ `items` nếu `featuredItems` chưa đủ bài.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra render thực tế: Cột TIN NỔI BẬT đã hiển thị đầy đủ 6 – 7 bài tin, không còn bị khoảng trắng.
