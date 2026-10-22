# CURRENT TASK — Bỏ gạch dưới tiêu đề khi bấm vào bài viết

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE THÀNH CÔNG

## 1. Yêu cầu & Kết quả đạt được
- Đã loại bỏ hoàn toàn phần gạch dưới (`text-decoration: none`) khi hover, focus hoặc click (`:active`) vào tiêu đề bài viết chính ([.leadTitleLink](file:///f:/20.9%20web/bvdkthoilai-main/src/components/SoyTeNewsSection.module.css#L59)).
- Đảm bảo các liên kết bài viết trong cột Tin Nổi Bật ([.featuredLink](file:///f:/20.9%20web/bvdkthoilai-main/src/components/SoyTeNewsSection.module.css#L427)) cũng luôn giữ `text-decoration: none` trong mọi trạng thái hover/focus/active.
- Tiêu đề chuyển màu xanh thương hiệu `#005a9e` mượt mà, giữ giao diện sạch sẽ, thanh thoát và hiện đại.

## 2. Kết quả kiểm tra
- `npm run typecheck`: PASS 100% không có lỗi TypeScript.
- `git diff`: Chỉ sửa đổi đúng file CSS [SoyTeNewsSection.module.css](file:///f:/20.9%20web/bvdkthoilai-main/src/components/SoyTeNewsSection.module.css).
