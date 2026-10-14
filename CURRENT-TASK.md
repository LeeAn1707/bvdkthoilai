# CURRENT TASK — Thiết kế chuyên mục Điểm tin thành các ô card bo tròn đồng bộ giao diện

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ RENDER THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Người dùng yêu cầu: Thiết kế chuyên mục Điểm tin thành các ô bo tròn (card) giống như các mục khác trên website để đồng bộ toàn bộ giao diện trang chủ.

## 2. Giải pháp thực hiện
1. `src/components/SoyTeNewsSection.module.css`:
   - Chuyển đổi khung chứa thành lưới 2 thẻ card bo tròn độc lập (`newsSectionGrid`):
     - **Ô bên trái (`leadCard`):** Card bài viết tiêu điểm độc lập với `border-radius: 16px; border: 1px solid #dce8f2; background: #ffffff; box-shadow: 0 4px 20px rgba(10, 42, 74, 0.05);`. Khung ảnh bên trong bo góc `12px`, nút xem chi tiết bo góc `8px`.
     - **Ô bên phải (`sidebarCard`):** Card TIN NỔI BẬT xoay vòng độc lập với `border-radius: 16px; border: 1px solid #dce8f2; background: #ffffff; box-shadow: 0 4px 20px rgba(10, 42, 74, 0.05);`. Các hàng tin xoay vòng bo góc `8px`.
   - Hiệu ứng hover nổi nhẹ 3D (`transform: translateY(-2px)`, đổ bóng sâu và viền xanh thương hiệu `#0878d1`) chuẩn nhận diện BVDK Thới Lai.
2. `src/components/SoyTeNewsSection.tsx`:
   - Cập nhật cấu trúc DOM tách bạch 2 ô card riêng biệt, chuẩn ngữ nghĩa và responsive.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- Kiểm tra render HTTP `localhost:3000`: STATUS 200 OK, `leadCard` và `sidebarCard` hoạt động hoàn hảo.
