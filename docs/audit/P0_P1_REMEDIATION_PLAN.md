# KẾ HOẠCH KHẮC PHỤC P0/P1 THEO TỆP – BVDKTHOILAI

**Ngày:** 22/10/2026 · **Nguồn:** https://github.com/LeeAn1707/bvdkthoilai · **Mục tiêu:** Hình thành các Pull Request có thể review, test và rollback.

> Chưa chỉnh sửa repository thật. Các thay đổi bên dưới là **đề xuất kỹ thuật** dựa trên mã nguồn đã đọc, cần xác nhận tương thích Payload CMS hiện hành, các tích hợp khác và test trước merge. Không áp dụng trên production trực tiếp.

## P0 – phải sửa trước mọi hoạt động tiếp nhận người bệnh

### BVDK-P0-01 – Public Payload collection create bypass

- **File chính:** `src/collections/Appointments.ts`.
- **Bằng chứng:** `access.create: anyone`; `src/app/(frontend)/api/appointments/route.ts` có các lớp captcha/rate limit nhưng không ràng buộc đường REST tạo bản ghi của Payload.
- **Phương án:** đổi `create` thành `moduleAccess('appointments','create')` hoặc hàm access cho phép đúng vai trò nhân viên; người bệnh gửi form qua `/api/appointments` đã kiểm chứng; server sử dụng Local API đặc quyền **chỉ trong handler tin cậy**. Không tin client-side hidden fields. Khóa field nội bộ như `status`, `source`, `staffNote`, `confirmedAt`, `code`, `ipAddress` theo access/hook server (hoặc xác định hoàn toàn server-side). Xem lại GraphQL endpoints nếu được bật.
- **Lưu ý:** giữ `overrideAccess: true` ở handler có kiểm chứng là có thể hợp lý, nhưng phải validate/allowlist mọi field. Rà soát cùng các collection phản ánh, góp ý, khảo sát nếu cho `create: anyone`.
- **Tiêu chí DONE:** request chưa đăng nhập trực tiếp đến Payload collection tạo lịch nhận 401/403; người bệnh đặt lịch qua API hợp lệ thành công; không thể tự chọn trạng thái `completed` hay ghi `staffNote`; admin có quyền hợp lệ vẫn tạo được.
- **Tests:** TC-ACL-01, TC-ACL-02, TC-APPT-01, TC-APPT-02.

### BVDK-P0-02 – Cấp quyền xem/xóa/xuất lịch quá rộng

- **File chính:** `src/access/index.ts`; liên đới `src/collections/Appointments.ts`, các server/API export Excel, các component dashboard lịch hẹn.
- **Bằng chứng:** `moduleRoleDefaults.appointments` cấp `view/create/edit/delete/export` cho `editor`, `hr`, `finance`, `procurement` và nhiều role khác.
- **Phương án:** xin lãnh đạo/phụ trách chuyên môn chốt ma trận: trực tiếp tiếp đón (view/create/edit), trưởng bộ phận (view/export được duyệt), admin được chỉ định (delete/restore), các role tin tức/mua sắm/nhân sự mặc định **không** có quyền lịch khám. Nếu có phân khoa, dùng access `Where` dựa vào khoa/phòng của người đăng nhập; không dùng lọc giao diện làm hàng rào an ninh. Với export, áp dụng backend check + audit log (ai, khi nào, bộ lọc, số dòng, không log PII thô). Xem xét soft delete để giữ lịch sử.
- **Tiêu chí DONE:** kiểm thử role–action ở backend, nhân viên khoa A không đọc được khoa B nếu nghiệp vụ có phân khoa, export trái phép trả 403, role ngoài nghiệp vụ không truy cập được dù biết URL/ID.
- **Tests:** TC-ACL-03 đến TC-ACL-08; TC-PRIV-01.

### BVDK-P0-03 – Turnstile fail-open khi thiếu secret

- **File:** `src/lib/request-security.ts`, `scripts/preflight-production.mjs`, `.env.production.example` và phần cấu hình môi trường triển khai.
- **Bằng chứng:** `if (!secret) return true`.
- **Phương án:** production `verifyTurnstile` phải fail-closed; preflight bắt buộc có `TURNSTILE_SECRET_KEY` và site key tương ứng. Trong local/staging chỉ cho phép bypass thông qua cấu hình test-only rõ ràng, không thể bật ở production. Khuyến nghị xác minh hostname/action/token server-side nếu tích hợp đáp ứng; đặt timeout và logging trạng thái nhưng không lưu token.
- **Tiêu chí DONE:** thiếu secret ở production -> preflight FAIL hoặc request bị từ chối; token sai/hết hạn bị từ chối; token hợp lệ thành công; không bypass bằng direct collection.
- **Tests:** TC-SEC-01 đến TC-SEC-04.

## P1 – ưu tiên cao sau P0

### BVDK-P1-01 – Rate limit phân tán và IP proxy

- **File:** `src/lib/request-security.ts`; liên đới `deploy/`, Nginx/Cloudflare configuration.
- **Bằng chứng:** `Map` trong tiến trình; IP lấy từ `x-real-ip` hoặc phần đầu `x-forwarded-for`.
- **Phương án:** giới hạn theo key ở Cloudflare/Nginx và/hoặc Redis/shared persistent store; khóa theo IP + định danh form hoặc điện thoại đã băm; `Retry-After`; chỉ tin headers do reverse proxy của mình tạo. Khóa truy cập trực tiếp tới origin. Thiết lập giới hạn riêng form lịch khám, phản ánh, đăng nhập, upload.
- **Tiêu chí DONE:** vượt quota từ một IP bị chặn ngay cả khi requests phân bố ở nhiều instance; không bypass bằng tự đặt `X-Forwarded-For` từ client.
- **Tests:** TC-SEC-05, TC-SEC-06, TC-OPS-03.

### BVDK-P1-02 – Giới hạn body dựa vào Content-Length

- **File:** `src/lib/request-security.ts`; các route dùng `bodyIsTooLarge`, edge reverse proxy.
- **Bằng chứng:** lấy độ dài từ `req.headers.get('content-length')`.
- **Phương án:** limit tại Nginx/edge; khi đọc body theo stream có đếm byte, dừng sớm vượt ngưỡng; parse JSON/form-data theo thư viện hỗ trợ giới hạn; whitelist schema, kích thước field, số trường, recursion depth; timeout. Không dùng duy nhất Content-Length làm chốt bảo mật.
- **Tiêu chí DONE:** body vượt hạn mức bị 413, không crash/treo; request không có hoặc giả Content-Length cũng bị áp dụng giới hạn.
- **Tests:** TC-SEC-07, TC-SEC-08.

### BVDK-P1-03 – Mã lịch khám có thể trùng khi đồng thời

- **File:** `src/app/(frontend)/api/appointments/route.ts`; schema/migration tương ứng `code` trong `Appointments.ts` và PostgreSQL.
- **Bằng chứng:** lấy các lịch trong ngày, tính max, tìm `code` chưa tồn tại, sau đó create; giới hạn 4 số và wrap từ 9999 về 1.
- **Phương án ưu tiên:** không sử dụng read-then-check làm cơ chế duy nhất; gán ID ngẫu nhiên mạnh/ULID hoặc cấp sequence **trong giao dịch database**, định danh có ngày nếu muốn reset hàng ngày (`BVTL-YYYYMMDD-XXXXXX`). Có unique constraint ở DB; xử lý `unique violation` bằng retry ngắn/có giới hạn. Phân biệt mã cũ, không làm thay đổi mã lịch hẹn đã cấp. Nếu giữ 4 số, thiết kế khi vượt 9999 theo yêu cầu nghiệp vụ – không quay vòng trùng.
- **Tiêu chí DONE:** 100–500 yêu cầu đồng thời ở staging tạo mã không trùng; không bỏ sót record thành công; reset ngày không gây trùng lịch sử; mã cũ còn truy xuất được.
- **Tests:** TC-APPT-05 đến TC-APPT-08.

### BVDK-P1-04 – Lộ thông báo lỗi máy chủ

- **File:** `src/app/(frontend)/api/appointments/route.ts`; rà soát các API tương tự.
- **Bằng chứng:** response 500 nối `error?.message`.
- **Phương án:** trả `Mã lỗi hệ thống, vui lòng thử lại` cùng request/correlation ID vô danh; log server-side có nguyên nhân nhưng che token, PII, SQL, URL DB, secret. Chặn lộ stack trace từ môi trường production.
- **Tiêu chí DONE:** lỗi DB giả lập không làm lộ chuỗi kết nối, bảng DB, stack trace, tên biến, số điện thoại trong JSON response.
- **Tests:** TC-SEC-09, TC-PRIV-02.

### BVDK-P1-05 – Validation không phải functional/security tests

- **File:** `scripts/validate-system-hardening.mjs`, `scripts/validate-uat-production.mjs`, `package.json`, `.github/workflows/*`.
- **Bằng chứng:** nhiều checks dùng `readFileSync` + `includes(...)`/regex; xác nhận source chứa đoạn text, không chứng minh runtime authorization.
- **Phương án:** giữ static contracts; tạo bộ integration test chạy với Postgres staging và role test fixtures. Mock/exercise Payload local & REST, assert status code + DB state; Playwright/e2e cho chức năng trọng yếu; SCA và secret scan; CI branch protection yêu cầu các job PASS. Không đưa credentials vào log CI.
- **Tiêu chí DONE:** test fail khi cố tình mở `create: anyone` hoặc quyền export trái phép; PR không merge nếu regression.
- **Tests:** TC-CI-01 đến TC-CI-04.

### BVDK-P1-06 – Backup/restore chưa đầy đủ khi dùng R2

- **File:** `scripts/backup.sh`, `scripts/verify-backup.sh`, `scripts/restore.sh`, tài liệu vận hành R2.
- **Bằng chứng:** dump PostgreSQL, tar `MEDIA_DIR` local; không có thao tác sao lưu R2 trong `backup.sh`.
- **Phương án:** chính sách RPO/RTO được bệnh viện duyệt; backup Postgres encrypted + offsite; với R2 bật object versioning/copy độc lập theo chính sách, backup metadata; secret rotation; xác minh file và restore cross-system trên staging; không coi `pg_restore --list` là chứng minh khôi phục dữ liệu thành công.
- **Tiêu chí DONE:** tự động backup trong lịch, kiểm tra checksum, phục hồi 1 đợt vào DB trống và khớp dataset + media, biên bản thời gian phục hồi có người xác nhận.
- **Tests:** TC-DR-01 đến TC-DR-05.

### BVDK-P1-07 – Health storage chưa xác minh hoạt động thật

- **File:** `src/app/(frontend)/api/health/route.ts`.
- **Bằng chứng:** nếu thấy đủ biến R2, `storageProbe()` trả `true`.
- **Phương án:** tách `/health/live` và `/health/ready`; check quyền read/head object thử nghiệm với timeout, cache trạng thái ngắn để tránh spam R2; không tạo data tùy ý tại mỗi health ping; chi tiết chỉ cho monitor có xác thực; status phù hợp với degraded/unready.
- **Tiêu chí DONE:** sai credential R2 cho ra degraded/unready, DB down được phản ánh; nội dung public không tiết lộ thông tin hạ tầng.
- **Tests:** TC-OPS-01, TC-OPS-02.

### BVDK-P1-08 – Script backup:railway không tồn tại trên main

- **File:** `package.json`, `scripts/backup-railway.mjs` nếu thực sự cần, lịch trình backup.
- **Bằng chứng:** script `backup:railway` tham chiếu `scripts/backup-railway.mjs`, nhưng URL trên `main` trả 404 khi kiểm tra.
- **Phương án:** xác định đang dùng Railway/Neon/VPS hay Docker; loại bỏ script hỏng hoặc đưa script an toàn đã review vào repo; có job định kỳ và alert failure; không lưu secret trong workflow.
- **Tiêu chí DONE:** `npm run backup:railway` chạy được ở môi trường đích hoặc bị loại khỏi package.json/tài liệu; job backup có chứng cứ.
- **Tests:** TC-DR-06.

### BVDK-P1-09 – Quy trình migration cần kiểm thử điều phối

- **File:** `package.json`, `scripts/db-migrate.mjs`, `Dockerfile`, `docker-compose.yml`, deployment workflows.
- **Bằng chứng:** `prestart` gọi migration; kiểm thử multi-instance chưa thực hiện.
- **Phương án:** migration job một lần trước thay đổi traffic; DB advisory lock/migration lock được xác thực; backup trước DDL; chiến lược backward-compatible; có kế hoạch rollback app và forward-fix schema. Không cố đảo migration không thuận nghịch một cách tự động.
- **Tiêu chí DONE:** khởi động 2 instance cùng lúc không chạy DDL xung đột; job lỗi không chuyển traffic; restore được khi phát hành thất bại.
- **Tests:** TC-DB-01 đến TC-DB-04.

### BVDK-P1-10 – Rà soát `overrideAccess` và export API

- **File:** mọi `route.ts`/server action sử dụng `overrideAccess: true`, component xuất Excel và dashboard appointments.
- **Hiện trạng:** chưa kiểm tra đủ các tuyến; **không kết luận hiện có lỗ hổng**, coi là finding cần xác minh.
- **Phương án:** inventory `grep -R "overrideAccess" src`; phân loại trusted backend vs user-controlled; kiểm tra identity, role, row-scope, allowed columns, audit trail, throttle và chống IDOR.
- **Tiêu chí DONE:** mọi đường export/read nhạy cảm có quyền backend và test truy cập trái phép (direct URL, ID khác khoa, pagination/export mass data).
- **Tests:** TC-ACL-06 đến TC-ACL-08; TC-PRIV-03.

## 2. P2 – cải thiện bảo mật trình duyệt

- **File:** `next.config.mjs`.
- **Vấn đề:** `script-src 'unsafe-inline'`, nhiều CDN và `connect-src https:` khá rộng.
- **Phương án:** đo CSP bằng `Content-Security-Policy-Report-Only` trước; cân nhắc nonce/hash + danh sách nguồn đúng nhu cầu. Đảm bảo Payload Admin và Turnstile không bị hỏng; siết CSP ở từng route khi phù hợp.
- **Tiêu chí DONE:** không còn lỗi CSP phá chức năng; chính sách giảm tối thiểu nguồn nguy hiểm theo kế hoạch đã phê duyệt.

## 3. Thứ tự chia Pull Request

| PR | Nhiệm vụ | Phụ thuộc | Điều kiện merge |
|---|---|---|---|
| PR-01 | Khoá collection create + field nội bộ | Ma trận nghiệp vụ | ACL + booking integration PASS |
| PR-02 | Quyền lịch hẹn + export | Chủ hệ thống phê duyệt role scope | Matrix/BOLA tests PASS |
| PR-03 | Turnstile fail-closed + preflight | Biến môi trường staging | Test missing/invalid/valid token PASS |
| PR-04 | Shared rate limit + body-size | Proxy/Redis hoặc WAF | Test spoof/no length/multi instance PASS |
| PR-05 | Generator code giao dịch | DB migration review | Concurrency + backward compatibility PASS |
| PR-06 | Error handling + logging | Logging convention | Không rò rỉ PII/stack trace |
| PR-07 | DR/health/migration | Ops/staging | Restore drill + health probe PASS |
| PR-08 | CI quality gates | Tất cả PR trước | Automated regression PASS |

> Không gộp migration dữ liệu và thay đổi lớn API vào một PR khó rollback nếu có thể tách. Mỗi PR cần reviewer khác người viết, test trước/sau và bằng chứng ẩn danh.

## 4. Gói lệnh xác minh (chỉ local/staging)

```bash
# Kiểm tra phiên bản, cấu hình
node -v
git rev-parse HEAD
npm ci
npm run audit:config
npm run typecheck
npm audit --omit=dev --audit-level=high
npm run validate:all
npm run build

# Kiểm tra các nơi dùng bypass (review bằng người có chuyên môn)
rg 'overrideAccess|create:\s*anyone|error\?\.message|x-forwarded-for' src

# Migration: chỉ chạy trên staging hoặc môi trường đã được phê duyệt
npm run db:migrate:status
npm run db:migrate:dry-run
npm run db:migrate:verify
```

**Không chạy tải/DAST trên production, không gửi dữ liệu thật vào các công cụ thử nghiệm.** Kiểm thử bảo mật chỉ trên máy chủ do bệnh viện sở hữu/cho phép bằng văn bản.

## 5. Hồ sơ đóng một issue

- Issue ID / người thực hiện / người kiểm tra / ngày sửa.
- Link file và diff; commit SHA + PR.
- Bước tái hiện trước khi sửa, kết quả test trước (FAIL đúng kỳ vọng).
- Kết quả sau sửa + regression, evidence có thời gian và môi trường.
- Hướng rollback và ảnh hưởng dữ liệu/schema.
- Trạng thái: OPEN / FIXED-PENDING-TEST / VERIFIED / ACCEPTED-RISK (có phê duyệt).

**Ghi chú:** Việc sửa bảo mật và chạy kiểm thử ở báo cáo này là kế hoạch; chưa có PR hay bản vá nào được đẩy lên repository.
