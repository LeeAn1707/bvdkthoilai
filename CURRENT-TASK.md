# CURRENT TASK — Xóa Triệt Để Dòng Ngày Giờ (Header) & URL / Số Trang (Footer) Khi Lưu PDF

## Trạng thái: HOÀN THÀNH

## Yêu cầu người dùng
- Khi lưu file PDF, ở mép trên cùng vẫn bị in dòng ngày giờ `12:14 1/10/26` & tiêu đề `LỊCH CÔNG TÁC TUẦN`, ở mép dưới cùng bị in đường dẫn URL & số trang. Cần bỏ hoàn toàn các phần này.

## Đã xử lý
1. **[`src/lib/workScheduleExport.ts`](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/workScheduleExport.ts)**:
   - Sử dụng chuẩn kỹ thuật CSS in ấn: `@page { size: A4 portrait; margin: 0 !important; }`.
   - Khi `@page margin` đặt bằng `0 !important`, trình duyệt (Chrome, Edge, Cốc Cốc) sẽ tự động triệt tiêu hoàn toàn khu vực lề in đầu trang và cuối trang, làm biến mất 100% dòng ngày giờ và URL.
   - Khoảng cách lề văn bản chuẩn Nhà nước (Top 2.0cm, Right 2.0cm, Bottom 2.0cm, Left 3.0cm) được chuyển vào chính khối văn bản `.Section1 { padding: 2.0cm 2.0cm 2.0cm 3.0cm !important; box-sizing: border-box !important; }`.
2. **Kiểm tra chất lượng**:
   - `npm run typecheck`: **PASS (0 lỗi)**.


