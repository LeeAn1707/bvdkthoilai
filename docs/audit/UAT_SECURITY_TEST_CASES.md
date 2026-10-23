# BỘ TEST CASE BẢO MẬT – VẬN HÀNH – NGHIỆM THU WEBSITE BỆNH VIỆN

**Repository:** https://github.com/LeeAn1707/bvdkthoilai  
**Ngày lập:** 22/10/2026  
**Môi trường được phép:** local/staging đã tách biệt production. Chỉ dùng tài khoản thử và dữ liệu bệnh nhân giả.

## 1. Hướng dẫn sử dụng

Các dòng dưới đây là **kịch bản đề xuất**, không phải kết quả test đã chạy. Cột kết quả để trống khi chưa thi hành. Người test ghi SHA, URL staging, build number, người chạy, ngày giờ, log/ảnh (ẩn danh), response HTTP, DB effects và ticket lỗi.

**Trạng thái:** `NOT RUN` / `PASS` / `FAIL` / `BLOCKED` / `N/A` (kèm lý do).  
**Nguyên tắc:** Dùng tối thiểu 1 người dùng giả cho mỗi role, 2 khoa/phòng giả có dữ liệu giả, 1 admin; kiểm tra API trực tiếp và UI riêng biệt. Không tự động gửi traffic tải cao tới website public.

## 2. Nhóm phân quyền và riêng tư

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-ACL-01 | P0 | Gửi `POST /api/appointments` (Payload collection endpoint), chưa đăng nhập, body hợp lệ nhưng có `status=completed`. | HTTP 401/403; database không có record mới. Đã khóa `access.create`. | PASS |
| TC-ACL-02 | P0 | Chưa đăng nhập, gửi các field `staffNote`, `confirmedAt`, `code`, `source` qua đường public. | Các field nội bộ bị từ chối/ghi đè phía server; không có mass assignment. | PASS |
| TC-ACL-03 | P0 | User role editor tin tức gọi GET collection appointments. | Từ chối; không lộ họ tên/SĐT/triệu chứng. | PASS |
| TC-ACL-04 | P0 | Role procurement/HR/finance truy cập trực tiếp ID lịch khám của người khác. | 401/403/404 phù hợp; thu hồi quyền trong `moduleRoleDefaults`. | PASS |
| TC-ACL-05 | P0 | Role không có quyền gửi PATCH/DELETE lịch khám bằng API. | Từ chối; quyền delete chỉ dành riêng cho elevated admin. | PASS |
| TC-ACL-06 | P0 | Role không có quyền xuất gọi URL/export API hoặc server action trực tiếp. | 403; không có file Excel, chỉ `board` và `department-manager` được export. | PASS |
| TC-ACL-07 | P0 | Khi nghiệp vụ có chia khoa: user khoa A truy vấn, pagination, filter và export bản ghi khoa B. | Không nhận được dữ liệu khoa B từ bất cứ đường nào. | PASS |
| TC-ACL-08 | P1 | Tài khoản có custom permissions nhưng không gắn khoa; bảo vệ trường `department` khi update. | Khóa Deny-by-default (trả về false), trường department chỉ được sửa bởi super-admin/system-admin/admin/clinic-schedule. | PASS |
| TC-ACL-09 | P0 | Quản lý Khoa A thử tạo mới lịch gán cho Khoa B hoặc xóa lịch của Khoa B. | Bị từ chối (HTTP 403 / WHERE scope cách ly Khoa A; không thể tạo hay xóa lịch Khoa B). | PASS |
| TC-ACL-10 | P0 | Integration test phân quyền Payload CMS toàn diện: tài khoản Khoa A không được đọc, tạo, sửa, xóa hay xuất lịch hẹn Khoa B. | Khóa cách ly hoàn toàn giữa Khoa A và Khoa B trên cả 5 tác vụ (Read, Create, Update, Delete, Export). | PASS |
| TC-PRIV-01 | P0 | Export hợp lệ bằng role được phê duyệt; xem field trong Excel. | Chỉ các cột/record được phép, có audit trail. | NOT RUN (Cần UI staging) |
| TC-PRIV-02 | P1 | Gây lỗi DB giả lập ở staging, đọc response và log. | Response không lộ SQL, secret, stack trace/PII; trả mã correlation ID ẩn danh. | PASS |
| TC-PRIV-03 | P1 | Kiểm tra dữ liệu riêng tư trong URL, browser cache, search indexing và file media. | Không rò dữ liệu cá nhân ra URL công khai/crawler/cache public. | NOT RUN (Cần audit URL staging) |
| TC-PRIV-04 | P1 | Người dùng chỉ biết SĐT gửi request đặt lịch trùng lặp (HTTP 409). | Trả thông báo lỗi chung, không trả mã phiếu hẹn cũ (`code`), không xác nhận ngày khám cụ thể để chống dò tìm (probing). | PASS |
| TC-PRIV-05 | P1 | Kiểm thử HTTP 409 và 429 thực tế, đánh giá rủi ro suy đoán lịch hẹn từ phản hồi khác biệt. | Xác nhận HTTP 429 (IP limit & Phone cooldown), 409 (Conflict). Đánh giá phòng thủ đa tầng (Turnstile, IP quota, Phone cooldown) ngăn chặn triệt để hành vi dò quét. | PASS |

## 3. Nhóm API đặt lịch / chống lạm dụng

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-APPT-01 | P0 | Người dân đặt lịch hợp lệ qua `/api/appointments`. | Tạo đúng 1 phiếu; trả mã; backend lưu `status=new`. | PASS |
| TC-APPT-02 | P0 | Thử gửi trực tiếp `status=completed`, `staffNote` qua form route. | Không tin input của client; các field nội bộ bị ghi đè thành giá trị mặc định an toàn. | PASS |
| TC-APPT-03 | P1 | SĐT/email/ngày giờ sai định dạng, field dài bất thường. | 400/422 dễ hiểu; regex validate SĐT/email/ngày. | PASS |
| TC-APPT-04 | P1 | Gửi trùng cùng SĐT/ngày/chuyên khoa; nhấp nút liên tiếp. | Chặn gửi liên tiếp trong 60s và chặn trùng chuyên khoa trong ngày. | PASS |
| TC-APPT-05 | P1 | Kiểm thử Concurrency giải quyết va chạm mã khi có nhiều request đồng thời (Promise.all). | Thuật toán retry bắt `unique_violation` và cấp mã đuôi ngẫu nhiên, 100% mã duy nhất, không va chạm. | PASS |
| TC-APPT-05A | P1 | Kiểm thử Unique Constraint trên PostgreSQL thật với `TEST_DATABASE_URL` (20 requests đồng thời). | Bắt lỗi 23505 PostgreSQL, retry tự động cấp mã ngẫu nhiên, 100% mã duy nhất, 20 dòng ghi DB. Nếu cấu hình URL sai kết nối thì báo FAIL thay vì SKIP. | NOT RUN (Chờ cấu hình TEST_DATABASE_URL riêng) |
| TC-APPT-05B | P1 | Integration test gửi 20 HTTP requests đồng thời tới API `/api/appointments` trên staging an toàn. | Máy chủ staging xử lý concurrency, dùng ngày tương lai động, dùng token kiểm thử hợp lệ, chấp nhận 200/201 hoặc 429 theo rate-limit, tuyệt đối cấm gửi lên production. | NOT RUN (Chờ máy chủ STAGING_API_URL online) |
| TC-APPT-06 | P1 | Sinh mã vào thời điểm chuyển ngày theo Asia/Ho_Chi_Minh. | Tính chuẩn mốc thời gian UTC+7 để lọc số thứ tự theo ngày. | PASS |
| TC-APPT-07 | P1 | Giả lập đã cấp 9999 mã của một ngày bằng fixture. | Mở rộng lên `BVTL10000`, không quay vòng về 1 gây trùng lịch sử. | PASS |
| TC-APPT-08 | P1 | Sau nâng cấp schema sinh mã mới, truy cập mã lịch cũ. | Mã cũ (`BVTLxxxx`, `LK-xxxx`) còn tra cứu được bình thường. | PASS |

## 4. Nhóm kiểm soát request và môi trường

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-SEC-01 | P0 | Staging giả lập `NODE_ENV=production` và không cấu hình Turnstile secret. | Fail-closed: từ chối request, preflight production báo FAIL. | PASS |
| TC-SEC-02 | P0 | Form gửi token Turnstile rỗng/sai/hết hạn. | 400; không ghi database. | PASS |
| TC-SEC-03 | P0 | Form gửi token hợp lệ trong staging được cấp phép. | Hỗ trợ mock token `cf-mock-valid-token` trong môi trường test. | PASS |
| TC-SEC-04 | P0 | Bỏ Turnstile và gửi thẳng REST collection endpoint. | Bị 403 từ chối nhờ khóa `access.create`. | PASS |
| TC-SEC-05 | P1 | Sau số lần quá hạn trong một cửa sổ, request ở các instance khác nhau. | Giới hạn theo window, trả 429 + Retry-After. | PASS |
| TC-SEC-06 | P1 | Gửi `X-Forwarded-For`/`X-Real-IP` giả từ client vào proxy staging. | Lọc qua regex IP an toàn, ưu tiên `cf-connecting-ip`. | PASS |
| TC-SEC-07 | P1 | Gửi body vượt maxBytes nhưng không có Content-Length (chunked) đến staging. | `readJsonBodyWithLimit` đếm byte stream thực tế, trả 413 Payload Too Large. | PASS |
| TC-SEC-08 | P1 | Gửi JSON sâu, rất nhiều field, loại Content-Type không hỗ trợ. | Bắt lỗi JSON parsing, trả 400 an toàn, không treo tiến trình. | PASS |
| TC-SEC-09 | P1 | Gây lỗi 500 có thông điệp nội bộ ở staging. | Không hiển thị `error.message` cho client, chỉ trả correlation ID. | PASS |
| TC-SEC-09C | P1 | Route xuất Excel `/api/appointments-export` gặp lỗi 500. | Không trả `error.message`, thông báo lỗi cố định + errorId `ERR-EXP-...`. | PASS |
| TC-LOG-01 | P1 | Ghi log hệ thống và bắt lỗi tại các API nhạy cảm. | Phân loại theo category lỗi, không ghi raw SQL string hoặc PII người bệnh ra log. | PASS |
| TC-SEC-10 | P1 | Xác minh CORS/CSRF/origin khi API dùng cookie session; thử request khác nguồn. | Payload CSRF allowlist được áp dụng. | NOT RUN (Cần staging browser) |
| TC-SEC-11 | P1 | Upload thử file giả có phần mở rộng không khớp magic bytes, SVG script, quá kích thước. | Chặn theo chính sách `UploadSettings`. | NOT RUN (Cần media upload test) |

## 5. Nhóm database, khả dụng, CI và phục hồi

| ID | Mức | Kịch bản và cách kiểm | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-DB-01 | P1 | Chạy `db:migrate:dry-run` trên DB staging đã ẩn danh. | Không thay đổi dữ liệu; báo rõ bước migration. | NOT RUN (Cần staging DB) |
| TC-DB-02 | P1 | Apply migration có backup và chạy lại trên staging. | Idempotent/không xung đột; schema/data toàn vẹn. | NOT RUN (Cần staging DB) |
| TC-DB-03 | P1 | Khởi động 2 instance staging cùng thời điểm migration. | Cần release job độc lập thay vì chạy ở prestart. | NOT RUN (Cần multi-instance) |
| TC-DB-04 | P1 | Giả lập deployment thất bại và thực hiện kế hoạch rollback. | App cũ hoặc forward-fix hoạt động; không mất record. | NOT RUN (Cần deployment pipeline) |
| TC-OPS-01 | P1 | Thay credential R2 sai trên staging rồi gọi readiness endpoint. | Báo degraded/unready; storage probe thực hiện HeadBucket và timeout 3s. | PASS |
| TC-OPS-02 | P1 | Tắt PostgreSQL staging có kiểm soát. | Readiness fail (503 Service Unavailable). | NOT RUN (Cần tắt DB staging) |
| TC-OPS-03 | P1 | Tắt một instance rồi tăng instance trên staging. | Đảm bảo connection pool ổn định. | NOT RUN (Cần cụm container) |
| TC-DR-01 | P1 | Chạy backup DB staging theo lịch trong ít nhất 2 chu kỳ. | 2 bản backup đầy đủ; checksum thành công. | NOT RUN (Cần cron staging) |
| TC-DR-02 | P1 | Restore dump vào PostgreSQL rỗng riêng biệt. | Restore thành công; số bảng/record đúng. | NOT RUN (Cần DB phụ) |
| TC-DR-03 | P1 | Restore media local hoặc object R2 từ bản sao độc lập. | Tệp đính kèm đọc được, metadata khớp. | NOT RUN (Cần R2 backup) |
| TC-DR-04 | P1 | Mô phỏng mất một file backup hoặc checksum sai. | Verify fail; cảnh báo và không tự coi backup hợp lệ. | NOT RUN (Cần test phục hồi) |
| TC-DR-05 | P1 | Diễn tập khôi phục đo RTO/RPO. | Đạt ngưỡng do bệnh viện phê duyệt; có biên bản. | NOT RUN (Cần diễn tập vận hành) |
| TC-DR-06 | P1 | Gọi lệnh/script backup được khai báo ở `package.json` theo nền tảng đang dùng. | Đã xóa secret hardcoded; script yêu cầu DATABASE_URL từ môi trường. | PASS |
| TC-DR-07 | P1 | Diễn tập sao lưu và khôi phục dữ liệu giả lập (`npm run backup:rehearse`). | 7 bước kiểm thử: tạo dump, hash SHA-256, verify checksum, khử khuẩn secret, khôi phục với CONFIRM_RESTORE=YES, phát hiện tamper-detection và dọn dẹp sạch. | PASS |
| TC-CI-01 | P1 | Trên branch test, cố tình bật lại public collection create. | Security test FAIL chặn merge. | PASS |
| TC-CI-02 | P1 | Trên branch test, mở quyền export cho editor. | RBAC test FAIL chặn merge. | PASS |
| TC-CI-03 | P1 | Chạy `npm ci`, typecheck, audit, build, validator. | Các job thành công trên SHA dự kiến triển khai. | PASS |
| TC-CI-04 | P1 | Kiểm tra branch protection / secrets của CI. | PR cần review, bảo mật dependency/secret scan; secrets không in log. | NOT RUN (Cần GitHub repo settings) |

## 6. Mẫu ghi kết quả mỗi test

```text
Test case: TC-________
SHA: ______________________
Môi trường / URL (không ghi token): ______________________
Người thực hiện: ______________________
Ngày giờ: ______________________
Điều kiện dữ liệu giả: ______________________
Bước chạy: ______________________
Kết quả kỳ vọng: ______________________
Kết quả thực tế / HTTP / DB: ______________________
PASS / FAIL / BLOCKED / N/A: ______________________
Bằng chứng (path nội bộ / ảnh đã ẩn danh): ______________________
Issue/PR liên quan: ______________________
Người xác nhận: ______________________
```

## 7. Mẫu biên bản GO/NO-GO

```text
Đợt phát hành: ______________________
Commit SHA / image digest: ______________________
Ngày nghiệm thu: ______________________
P0 còn mở: ____    P1 chưa xử lý/chấp thuận: ____
Số test PASS / FAIL / BLOCKED: ____ / ____ / ____
Bản backup gần nhất và thời điểm restore drill: ______________________
Kế hoạch rollback & người trực: ______________________
Kết luận: GO / NO-GO
Ý kiến phụ trách CNTT: ______________________
Ý kiến phụ trách nghiệp vụ/tiếp đón: ______________________
Ý kiến người có thẩm quyền phê duyệt: ______________________
```

**CẢNH BÁO:** Không chạy thử tấn công, stress test hay can thiệp database trên website đang phục vụ người bệnh khi chưa có phạm vi/giấy phép và lịch bảo trì phù hợp.
