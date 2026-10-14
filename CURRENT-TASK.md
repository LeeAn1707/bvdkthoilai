# CURRENT TASK — Bổ sung tùy chọn kiểu hiển thị ảnh và thứ tự ưu tiên ảnh Sơ đồ tổ chức

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ MIGRATION DATABASE THÀNH CÔNG

## 1. Yêu cầu nghiệp vụ
- Bổ sung tùy chọn hiển thị ảnh full ô nội dung (tràn viền cover sát mép) hoặc nhiều kiểu dáng hiển thị khác cho Ban Lãnh đạo trong trang Sơ đồ tổ chức.
- Quy tắc ưu tiên ảnh:
  1. Ưu tiên 1: Ảnh chân dung tải trực tiếp tại cấu hình Sơ đồ tổ chức (`person.photo`).
  2. Ưu tiên 2: Ảnh đại diện từ hồ sơ Bác sĩ liên kết (`doctor.avatar`).
  3. Ưu tiên 3: Ảnh từ Chuyên gia (`our-experts.image`).
  4. Ưu tiên 4: Fallback bác sĩ theo tên trùng khớp.
  5. Fallback cuối: Chữ cái viết tắt tên.
- Cung cấp nhiều kiểu hiển thị ảnh:
  - `full-cover`: Tràn viền sát mép thẻ, lấp đầy toàn bộ ô.
  - `cover-box`: Khung đệm lọt lòng nhưng ảnh phủ kín không hở 2 bên.
  - `contain-box`: Vừa vặn nguyên vẹn không bị cắt mép.
  - `rounded-inset`: Bo góc 14px lọt lòng sang trọng.
  - `circle`: Khung tròn trang nhã.
- Hỗ trợ tỷ lệ khung hình (3:4, 4:5, 1:1, auto) và căn chỉnh tiêu cự (top, center, bottom).
- Cho phép cài đặt chung cho toàn trang và tùy biến độc lập cho từng vị trí lãnh đạo.

## 2. Các file đã cập nhật
1. `src/globals/OrganizationChart.ts`:
   - Thêm group `imageSettings` (kiểu ảnh, tỷ lệ, object-fit, căn tiêu cự) ở cấp toàn trang.
   - Thêm `imageStyle`, `imageFit` vào `leaderFields()` (Giám đốc và các Phó Giám đốc), hỗ trợ giá trị `inherit` (theo cài đặt chung) hoặc ghi đè riêng.
   - Gắn `enumName` ngắn gọn để tuân thủ giới hạn 63 ký tự của PostgreSQL identifier.
2. `src/app/(frontend)/so-do-to-chuc/page.tsx`:
   - Bổ sung `effectiveStyle`, `effectiveFit`, `effectiveAspectRatio`, `effectivePosition` cho `LeaderCard`.
   - Bổ sung populate media ID nếu trả về ID số; tự động nạp avatar bác sĩ và ảnh chuyên gia theo đúng thứ tự ưu tiên.
3. `src/app/(frontend)/so-do-to-chuc/org-chart.css`:
   - Định dạng CSS cho 5 kiểu dáng `.bmLeaderPhotoBox--*` (`full-cover`, `cover-box`, `contain-box`, `rounded-inset`, `circle`).
4. Migration & Schema Contract:
   - Migration `scripts/db-migrations/20261014_079_add_org_chart_image_styles.mjs`.
   - Đã seal `scripts/db-schema-contract.json` (hash 79511c524f8255353461eead7282ad7f69b957b6c89689a52e469e200373fce9).
   - Đã deploy migration local thành công.

## 3. Kết quả kiểm tra
- `npm run typecheck`: PASS 100%.
- `npm run db:schema:check`: PASS.
- `npm run validate:organization`: PASS 18/18.
- `npm run validate:migrations`: PASS 346/346.
