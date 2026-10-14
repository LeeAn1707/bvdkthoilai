# CURRENT TASK — Đưa cấu hình tốc độ và số lượng tin nổi bật xoay vòng vào Admin CMS

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ SYNC CMS THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu: Đưa vào trang Quản trị (Admin CMS) để có thể tùy chỉnh:
  1. Tốc độ xoay vòng chuyển động (thời gian tính bằng giây).
  2. Số lượng bài viết tối đa tham gia xoay vòng ở cột TIN NỔI BẬT.

## 2. Giải pháp thực hiện
1. `src/globals/Homepage.ts`:
   - Tối ưu hóa cấu hình trường `carouselSeconds` (Tốc độ xoay vòng tin nổi bật, từ 2 đến 30 giây, mặc định 3.5s).
   - Tối ưu hóa cấu hình trường `featuredItemLimit` (Số lượng bài viết tham gia xoay vòng, từ 4 đến 50 bài, mặc định 16 bài).
   - Cập nhật nhãn (label) và phần hướng dẫn (description) chi tiết, rõ ràng trong Admin.
2. `src/app/(frontend)/page.tsx`:
   - Đồng bộ `featuredItemLimit` và `carouselSeconds` từ Admin vào `SoyTeNewsSection`.
   - Cột TIN NỔI BẬT tự động lấy đúng số lượng bài tối đa được chỉ định trong Admin (`slice(0, featuredItemLimit)`).

## 3. Vị trí quản trị trong Admin CMS
- `Admin → Globals → Trang chủ (Homepage) → Khối "Hoạt động nổi bật tại bệnh viện" (featured-news)`:
  - Trường: **Tốc độ xoay vòng tin nổi bật (giây)**.
  - Trường: **Số lượng bài viết tham gia xoay vòng**.

## 4. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- `npm run db:schema:check`: PASS (không ảnh hưởng schema contract, tương thích hoàn toàn dữ liệu CSDL).
