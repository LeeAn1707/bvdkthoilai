# CURRENT TASK — Tối Ưu Khung Ảnh Đại Diện Bài Viết Chuyên Khoa & Khoa Phòng & Trang Chủ Sang Tỷ Lệ 3:2

## Trạng thái: HOÀN TẤT 100%

## 1. Nội dung đã thực hiện
- **Đồng bộ tỷ lệ khung ảnh sang chuẩn 3:2:**
  - File [specialty-detail.css](file:///h:/bvdkthoilai-main/src/app/(frontend)/chuyen-khoa/[slug]/specialty-detail.css): Đổi `aspect-ratio` từ `16 / 9` sang `3 / 2` và bỏ giới hạn cứng `max-height: 440px`.
  - File [department-detail.css](file:///h:/bvdkthoilai-main/src/app/(frontend)/khoa-phong/[slug]/department-detail.css): Đổi `aspect-ratio` từ `16 / 9` sang `3 / 2` và bỏ giới hạn cứng `max-height: 440px`.
  - File [SpecialtiesCarousel.module.css](file:///h:/bvdkthoilai-main/src/components/SpecialtiesCarousel.module.css): Đổi `mainPhotoCard` sang `width: 100%`, `aspect-ratio: 3 / 2` (thay vì cố định chiều cao 340px/390px và chiều rộng 86%). Tối ưu lớp phủ gradient và thông tin khoa để không che mất chân nhân sự.
- **Hiệu quả:**
  - Tất cả ảnh tập thể khoa/phòng nguyên bản từ máy ảnh (`1024 x 682 px` hoặc chuẩn `3:2`) hiển thị tràn kín viền 100% ở cả **Trang chủ** và **Trang chi tiết**, không bị thừa viền và không bị xén mất chữ tên khoa hoặc bàn chân.
