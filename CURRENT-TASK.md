# CURRENT TASK — Điền Nội Dung Mẫu Chi Tiết Cho Bác Sĩ & Khoa Phòng Vào Admin

## Trạng thái: HOÀN THÀNH

## Nội dung đã điền
1. **Hồ sơ chi tiết Bác sĩ (Ban Giám đốc & Đội ngũ y tế)**:
   - Điền đầy đủ vào các trường Lexical RichText trong Admin:
     + 🎓 **Quá trình Đào tạo**: Bác sĩ Đa khoa, BSCKI, BSCKII, các chứng chỉ đào tạo y khoa liên tục.
     + 🏥 **Quá trình Công tác**: Các mốc thời gian, vị trí đảm nhiệm, chỉ đạo chuyên môn.
     + ⭐ **Thế mạnh & Lĩnh vực chuyên môn**: Kỹ thuật chuyên sâu, phẫu thuật, cấp cứu, quản lý chất lượng.
     + 🏆 **Thành tích & Nghiên cứu khoa học**: Danh hiệu Thầy thuốc, đề tài NCKH, bằng khen.
     + 📝 **Tiểu sử / Lời giới thiệu tổng quan**: Thông điệp y đức và sự tận tâm phục vụ bệnh nhân.

2. **Hồ sơ chi tiết các Khoa / Phòng**:
   - Cập nhật đầy đủ thông tin hành chính & nghiệp vụ:
     + Trưởng khoa / phòng, số điện thoại trực, vị trí phòng trong khuôn viên viện.
     + Giới thiệu ngắn (`summary`) và Bài viết giới thiệu chuyên môn (`content`).
     + Chức năng – Nhiệm vụ (`functions`).
     + Hoạt động chuyên môn (`activities`).
     + Thành tích & Điểm nổi bật (`achievements`).

3. **Kiểm tra an toàn**:
   - `npm run db:schema:check`: **PASS (Hợp lệ 100%)**.
   - Toàn bộ dữ liệu được lưu trực tiếp vào CSDL Payload CMS, hiển thị ngay lập tức trên cả Admin và trang người dùng (`/bac-si/[slug]`, `/khoa-phong/[slug]`).



