# CURRENT TASK — Khắc phục lỗi 401 Unauthorized và Treo Admin trên Railway

## Trạng thái: ĐÃ XỬ LÝ XONG CODE — CHỜ DEPLOY & CHẠY SCRIPT SQL

## 1. Nguyên nhân lỗi 401: Unauthorized, you must be logged in to make this request
- Trong Payload 3.x, cơ chế bảo vệ CSRF (`extractJWT.js`) sẽ bỏ qua Cookie đăng nhập nếu Header `Origin` của trình duyệt không nằm trong danh sách `csrf` / `cors`.
- Trên Railway, domain truy cập là `https://bvdkthoilai-production-3b8e.up.railway.app`. Trước đó, `payload.config.ts` chỉ cho phép `NEXT_PUBLIC_SITE_URL` (thường là domain chính thức hoặc localhost). Khi chạy Server Action `buildFormState`, Payload không nhận diện cookie phiên -> `req.user = null` -> ném lỗi 401 Unauthorized và treo form ở chữ "ĐANG TẢI".

## 2. Giải pháp đã thực hiện
1. **Đã sửa `payload.config.ts`**:
   - Tự động chuẩn hóa URL (xóa dấu `/` thừa, thêm `https://` nếu thiếu).
   - Thêm đầy đủ `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL`, `https://bvdkthoilai-production-3b8e.up.railway.app`, `https://benhvienthoilai.vn`, `https://www.benhvienthoilai.vn` vào `allowedOrigins` (`csrf` & `cors`).
   - Cập nhật `serverURL` tự động nhận diện domain Railway khi chạy trên production.
   - Đã kiểm tra `tsc --noEmit` đạt 100%.

2. **File SQL khôi phục CSDL PostgreSQL**:
   - File [scripts/fix-railway-constraints.sql](file:///f:/20.9%20web/bvdkthoilai-main/scripts/fix-railway-constraints.sql) dùng để khôi phục Primary Key và Sequence tự tăng ID cho `payload_preferences`, `media`, `notices`, `news`...

## 3. Các bước tiếp theo
1. Commit & Push code lên GitHub để Railway tự động redeploy bản sửa lỗi CSRF.
2. Mở Railway Dashboard -> Chọn Database PostgreSQL -> Tab **Data** -> **Query Editor** -> Dán script SQL [scripts/fix-railway-constraints.sql](file:///f:/20.9%20web/bvdkthoilai-main/scripts/fix-railway-constraints.sql) và bấm **Run Query**.
