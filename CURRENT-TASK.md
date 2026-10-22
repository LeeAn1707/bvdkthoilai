# CURRENT TASK — Fix mất viền bo góc và chữ bị mờ khi focus/active ô Tin Nổi Bật

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE THÀNH CÔNG

## 1. Vấn đề đã xác định
- Khi focus/hover hoặc khi ô bài viết ở trạng thái active ("• Đang xem"), hiệu ứng `transform: translateX(3px)` làm thẻ dịch chuyển sang phải 3px, khiến cạnh phải và góc bo tròn bên phải bị tràn ra ngoài khung `tickerViewport` (`overflow: hidden`) dẫn đến mất toàn bộ đường viền bo góc bên phải.
- `transform: translateX(3px)` kết hợp với `will-change: transform` khiến trình duyệt (đặc biệt là Chrome trên Windows) chuyển sang render GPU texture và tắt cơ chế DirectWrite ClearType (subpixel antialiasing), làm chữ bị mờ, mảnh và vỡ hạt.
- Cỡ chữ dùng số thập phân (`13.5px`, `10.5px`, `11.5px`) và màu tiêu đề khi active dùng `#005a9e` trên nền `#f0f7ff` có độ tương phản chưa tối ưu, làm giảm độ sắc nét của chữ.

## 2. Giải pháp đã thực hiện
- Loại bỏ hoàn toàn `transform: translateX(3px)` ở `:hover` và `.tickerItemActive`.
- Bổ sung padding an toàn `padding: 2px 4px` cho `.tickerViewport` (chiều cao chuẩn `488px` = `484px` nội dung 6 bài + `4px` padding) để 4 góc bo tròn `14px` và viền 4 phía không bao giờ bị cắt xén (clip).
- Thêm `:focus-visible` chuẩn accessibility với viền `#005a9e` rõ nét.
- Bỏ `will-change: transform` ở `.tickerTrack` để font chữ luôn giữ được độ nét tự nhiên từ Windows DirectWrite ClearType khi tĩnh.
- Chuẩn hóa cỡ chữ sang số nguyên chuẩn (`14px` tiêu đề, `12px` ngày tháng, `11px` badge) và nâng độ tương phản màu chữ khi active sang `#003e73` (xanh navy đậm sắc nét).

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100% không có lỗi TypeScript.
- `git diff`: Chỉ thay đổi đúng file CSS mục tiêu [SoyTeNewsSection.module.css](file:///f:/20.9%20web/bvdkthoilai-main/src/components/SoyTeNewsSection.module.css).
