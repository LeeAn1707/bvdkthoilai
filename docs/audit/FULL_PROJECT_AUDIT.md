# FULL PROJECT AUDIT – BVDK THOI LAI

**Đối tượng:** Website Bệnh viện Đa khoa khu vực Thới Lai  
**Repository:** https://github.com/LeeAn1707/bvdkthoilai  
**Nhánh kiểm tra:** `main` (nội dung hiển thị trên GitHub ngày 22/10/2026; chưa chốt được commit SHA)  
**Phiên bản báo cáo:** 1.0 – 22/10/2026  
**Loại đánh giá:** Rà soát mã nguồn tĩnh có chọn lọc; xây dựng phương án khắc phục và nghiệm thu trước production.

> **LƯU Ý PHẠM VI:** Đã truy cập và kiểm tra các tệp nguồn chọn lọc trực tiếp trên GitHub. Môi trường đánh giá không thể clone repository qua Git, cài dependency, chạy ứng dụng, build, kiểm thử HTTP thực tế hoặc kiểm tra PostgreSQL/VPS. Không kết luận những kiểm thử chưa chạy là PASS. Những rủi ro bên dưới là phát hiện từ code hoặc hạng mục phải xác minh, chưa phải bằng chứng hệ thống production đã bị khai thác. Trước khi phát hành, chốt SHA của commit được đánh giá và kiểm thử lại trên chính SHA đó.

## 1. Kết luận điều hành

**Chưa khuyến nghị go-live cho chức năng tiếp nhận dữ liệu cá nhân/người bệnh** ở trạng thái đánh giá này. Ưu tiên xử lý đường tạo lịch hẹn công khai của Payload, quyền nội bộ với dữ liệu lịch hẹn, cấu hình Turnstile và việc sinh mã lịch hẹn. Tiếp đến là rate limiting, giới hạn kích thước request, quản lý lỗi 500, backup/restore và kiểm thử thật tại staging.

**Lợi thế:** Dự án có Next.js, Payload CMS, PostgreSQL, Docker, scripts về migration, backup, validation và health endpoint; có nền tảng để hoàn thiện thay vì viết lại. Hệ thống kiểm thử tĩnh hiện có không thay thế được bài test API, quyền truy cập hay phục hồi dữ liệu.

### 1.1. Chú giải mức độ và trạng thái

- **P0 – Chặn phát hành:** Có nguy cơ đáng kể với bí mật/toàn vẹn dữ liệu người bệnh, hoặc tác động nghiêm trọng tới cốt lõi quy trình.
- **P1 – Ưu tiên cao:** Có thể làm gián đoạn dịch vụ, gây rò rỉ thông tin hoặc làm yếu phòng vệ; phải sửa hoặc có quyết định chấp thuận rủi ro bằng văn bản trước phát hành.
- **P2 – Cải tiến:** Có thể hoàn thiện sau khi kiểm soát P0/P1; phải theo dõi thời hạn.
- **Xác nhận qua code:** Dạng triển khai đọc trực tiếp trên GitHub; tác động thực tế vẫn phải thử.
- **Cần kiểm thử:** Chưa có đủ bằng chứng để kết luận trên hệ thống đang chạy.

### 1.2. Phạm vi đã xem

- `src/collections/Appointments.ts`, `src/access/index.ts`, `src/lib/request-security.ts`;
- `src/app/(frontend)/api/appointments/route.ts`, `src/app/(frontend)/api/health/route.ts`;
- `scripts/validate-system-hardening.mjs`, `scripts/backup.sh`;
- `package.json`, `next.config.mjs`, `.env.production.example`, `docker-compose.yml`, `.gitignore`;
- vị trí `scripts/backup-railway.mjs` được tham chiếu bởi `package.json` nhưng không mở được ở nhánh `main` (404).

**Ngoài phạm vi đã thực chứng:** Chưa rà soát toàn bộ collection/API/UI, chưa kiểm thử upload, xác thực MFA, dependency vulnerability scan, historical secrets, DB index, pentest, cấu hình VPS, tuân thủ pháp luật hoặc dữ liệu thực tế.

## 2. Danh mục phát hiện theo độ ưu tiên

| ID | Mức | Trạng thái | Phát hiện / căn cứ | Hướng xử lý tóm tắt |
|---|---|---|---|---|
| BVDK-P0-01 | P0 | Xác nhận qua code | `Appointments.ts` dùng `create: anyone` trong collection; API REST Payload là đường khác với route đặt lịch đã kiểm tra Turnstile. | Chặn `POST /api/appointments` không xác thực qua collection; tiếp nhận công khai chỉ qua route kiểm soát. |
| BVDK-P0-02 | P0 | Xác nhận qua code | `src/access/index.ts` cấp `appointments` view/create/edit/delete/export mặc định cho nhiều vai trò (cả editor/hr/finance/procurement). | Ma trận quyền tối thiểu; hạn chế xuất/xóa; giới hạn dữ liệu theo phạm vi khoa/phòng nếu có. |
| BVDK-P0-03 | P0 | Xác nhận qua code | `verifyTurnstile()` trong `request-security.ts` trả `true` khi không có `TURNSTILE_SECRET_KEY`. | Production phải fail-closed; preflight dừng khi thiếu key; test trường hợp cấu hình sai. |
| BVDK-P1-01 | P1 | Xác nhận qua code | `rateLimit()` giữ `Map` trong RAM, và `clientAddress()` nhận IP từ proxy headers. | Rate limiting ở trusted edge / shared store; xác minh chuỗi reverse proxy. |
| BVDK-P1-02 | P1 | Xác nhận qua code | `bodyIsTooLarge()` chỉ đọc `Content-Length`. | Chặn theo số byte thực, kiểm soát parser, timeout, type và cấu trúc body. |
| BVDK-P1-03 | P1 | Xác nhận qua code | `route.ts` sinh `BVTL` + 4 chữ số bằng read-check-create; reset mô tả không gắn ngày vào mã; có vòng lặp `>9999` quay lại 1. | Mã duy nhất DB, cấp số bằng transaction/sequence hoặc UUID/ULID; retry collision có giới hạn. |
| BVDK-P1-04 | P1 | Xác nhận qua code | `route.ts` trả `error.message` vào response 500. | Mã lỗi chung + correlation ID; log nội bộ có che thông tin cá nhân. |
| BVDK-P1-05 | P1 | Xác nhận qua code | `scripts/validate-system-hardening.mjs` chủ yếu kiểm tra chuỗi nội dung/regex. | Duy trì static checks nhưng thêm unit/integration/security tests chạy trên staging. |
| BVDK-P1-06 | P1 | Xác nhận qua code | `scripts/backup.sh` sao lưu PostgreSQL và media local, không sao lưu R2; backup chưa phải bằng chứng restore thành công. | Có chính sách R2, off-site, mã hóa, restore drill và kết quả RPO/RTO. |
| BVDK-P1-07 | P1 | Xác nhận qua code | `/api/health` coi R2 OK khi thấy các biến môi trường; không probe dịch vụ. | Health liveness/readiness riêng; kiểm tra storage theo quyền hạn tối thiểu. |
| BVDK-P1-08 | P1 | Xác nhận qua code | `package.json` có `backup:railway` nhưng tệp tương ứng báo 404 trên `main`. | Sửa script hoặc bỏ lệnh; xác minh job backup thật sự chạy. |
| BVDK-P2-01 | P2 | Xác nhận qua code | CSP có `'unsafe-inline'` cho scripts, whitelist nhiều CDN. | Thu hẹp theo từng tuyến, đánh giá nonce/hash; thử tương thích Payload Admin. |
| BVDK-P1-09 | P1 | Cần kiểm thử | Khởi động với `prestart` migration, cần chứng minh idempotency, locking, rollback và tránh race giữa instance. | Chạy migration một lần trong release job; test migration trên bản sao lưu DB. |
| BVDK-P1-10 | P1 | Cần kiểm thử | Quyền của các API xuất Excel/dashboard và giới hạn đối tượng chưa được xác minh đầy đủ. | Rà soát mỗi endpoint/Local API dùng `overrideAccess`; test BOLA/IDOR và export. |

> P0 là nhãn quyết định kỹ thuật cho go-live; không phải xếp hạng CVSS chính thức. Các phát hiện về code cần được xác minh thêm bằng kiểm thử trong môi trường được phép.

## 3. Bằng chứng và nguồn tham chiếu

- Collection lịch hẹn – `create: anyone`, các field nội bộ (`status`, `staffNote`): https://github.com/LeeAn1707/bvdkthoilai/blob/main/src/collections/Appointments.ts
- Chính sách quyền mặc định của module `appointments`: https://github.com/LeeAn1707/bvdkthoilai/blob/main/src/access/index.ts
- Turnstile bỏ qua khi thiếu secret; rate limit RAM; `Content-Length`: https://github.com/LeeAn1707/bvdkthoilai/blob/main/src/lib/request-security.ts
- Mã `BVTL`, kiểm tra trùng trước khi tạo; xử lý 500: https://github.com/LeeAn1707/bvdkthoilai/blob/main/src/app/%28frontend%29/api/appointments/route.ts
- Validator đối chiếu chuỗi và biểu thức chính quy: https://github.com/LeeAn1707/bvdkthoilai/blob/main/scripts/validate-system-hardening.mjs
- Sao lưu PostgreSQL và local media: https://github.com/LeeAn1707/bvdkthoilai/blob/main/scripts/backup.sh
- Health probe storage: https://github.com/LeeAn1707/bvdkthoilai/blob/main/src/app/%28frontend%29/api/health/route.ts
- CSP: https://github.com/LeeAn1707/bvdkthoilai/blob/main/next.config.mjs
- `npm` scripts, migration tự chạy ở `prestart` và `backup:railway`: https://github.com/LeeAn1707/bvdkthoilai/blob/main/package.json

## 4. Đề xuất kiến trúc triển khai production

```text
Internet (HTTPS)
   |
Cloudflare WAF / reverse proxy có trusted proxy + rate limit
   |
Nginx / TLS / giới hạn body, timeout, log redacted
   |
Next.js + Payload CMS (container không root; chỉ app port nội bộ)
   |                       |
PostgreSQL private         Media local hoặc R2 private
   |                       |
   +---------- Backup mã hóa, bản sao off-site ---------+
                       |
               Giám sát & cảnh báo
```

Bắt buộc: cổng DB không công khai; tách dev/staging/prod; tài khoản/service account quyền tối thiểu; TLS; sao lưu kiểm chứng; thay đổi có Git SHA, release artifact bất biến, kế hoạch rollback. Phân quyền hành chính website phải được lãnh đạo bệnh viện hoặc bộ phận phụ trách dữ liệu phê duyệt.

## 5. Quy trình debug / kiểm tra theo tầng

### 5.1. Kiểm tra source, dependency và build (máy dev/CI)

```bash
git clone https://github.com/LeeAn1707/bvdkthoilai.git
cd bvdkthoilai
git rev-parse HEAD    # ghi commit vào biên bản
node --version
npm ci
npm run audit:config
npm run typecheck
npm audit --omit=dev --audit-level=high
npm run validate:all
npm run build
```

**Lưu ý:** `npm ci`/`prebuild` có thể yêu cầu biến môi trường/DB theo thiết kế. Dùng môi trường staging với dữ liệu giả. Ghi stdout/stderr, kết quả và mã thoát cho từng lệnh; kiểm tra ngay cả khi script tự báo PASS. Không chạy script `repair`, `seed`, `restore`, `migrate:deploy` với production khi chưa có bản backup và change approval.

### 5.2. Kiểm tra cơ sở dữ liệu (staging độc lập)

```bash
npm run db:migrate:status
npm run db:migrate:dry-run
npm run db:migrate:verify
```

Kiểm thử migration lên bản DB staging đã khôi phục từ bản backup **đã ẩn danh**. Đo thời gian schema lock, xem có mất cột/record, xác minh khóa ngoại, index, ràng buộc UNIQUE, lưu lượng kết nối. Kiểm thử chạy lại migration và scenario app restart/multi-instance, **chưa dùng production**.

### 5.3. Kiểm tra Payload/Admin

- Login/logout/forgot password/khóa tài khoản; session vô hiệu hóa sau khi bị thu hồi.
- Role–module–action matrix; kiểm tra trực tiếp REST/GraphQL nếu được bật, không chỉ UI.
- Bộ lọc theo khoa/phòng: `read/update/delete/export` phải áp dụng ở backend; kiểm tra `overrideAccess: true` tại các handler.
- Upload: MIME allowlist, file signature, kích thước, SVG/HTML/script, đường dẫn, truy cập tệp private.
- Content workflow: draft/published, bản sửa đổi, SEO, link, media metadata, dữ liệu nội dung cũ.

### 5.4. Kiểm tra hệ thống public

- Trang chủ, giới thiệu, tin tức, khoa/phòng, chuyên khoa, bác sĩ, tìm kiếm, đặt lịch, phản ánh, khảo sát, liên hệ.
- Forms: CSRF/context origin nếu dùng cookie, spam, error handling, CAPTCHA, email/notification, duplicate suppression.
- Thiết bị desktop/mobile, accessibility, Lighthouse, robots/sitemap, HTTPS, redirect canonical.
- Không hiển thị PII (họ tên, SĐT, triệu chứng, BHYT) ngoài các màn hình được phép.

### 5.5. Kiểm tra tính sẵn sàng và phục hồi

- Liveness chỉ phản ánh process; readiness kiểm DB và các phụ thuộc quan trọng, timeout ngắn, không lộ secret/PII.
- Alert: HTTP 5xx, p95 latency, RAM, disk, DB pool, migration failure, backup age, lỗi email, lỗi form.
- Chính sách retention tối thiểu: log riêng, audit log các thao tác xem/xuất/sửa/xóa, bảo vệ log chống sửa.
- Chạy restore drill vào môi trường rỗng, kiểm chứng số lượng bản ghi + tính toàn vẹn ảnh/tệp + quyền truy cập.

## 6. Checklist cổng phát hành

| Cổng | Điều kiện PASS | Trạng thái hiện tại |
|---|---|---|
| G1 – Kiểm soát truy cập | Tất cả test phân quyền và API theo vai trò đạt; không còn đường bypass collection | CHƯA KIỂM THỬ |
| G2 – Spam / Input | Thiếu Turnstile ở prod thất bại có kiểm soát; rate limit/body thực đạt | CHƯA KIỂM THỬ |
| G3 – Toàn vẹn lịch khám | Không trùng code dưới concurrency; không mất record | CHƯA KIỂM THỬ |
| G4 – Build / SCA | `npm ci`, typecheck, audit, build, unit/integration đạt | CHƯA CHẠY |
| G5 – Database / Migration | Schema, migration/rollback thử nghiệm đạt | CHƯA CHẠY |
| G6 – DR | Backup định kỳ/off-site + restore được ký biên bản | CHƯA CHẠY |
| G7 – Vận hành | HTTPS, origin private, monitor/alert, owner trực | CHƯA XÁC MINH |
| G8 – Nghiệp vụ | Điều dưỡng/tiếp đón/xét duyệt nội dung dùng dữ liệu giả lập và ký UAT | CHƯA CHẠY |

**Quyết định go-live mặc định:** **NO-GO** nếu P0 chưa sửa, G1–G8 chưa có bằng chứng, hoặc vẫn có P1 không được quản trị rủi ro chấp thuận. Tài liệu này không phải biên bản nghiệm thu thực tế.

## 7. Lộ trình thực hiện

1. **Đợt A – Cố định baseline:** tạo branch `audit/security-hardening`, ghi SHA, thiết lập staging, tạo bộ dữ liệu giả. Chặn P0-01/02/03 trước.
2. **Đợt B – Sửa lỗi P1:** request security, mã hẹn, lỗi 500, backup/R2, health, validation và migration.
3. **Đợt C – Tự động kiểm thử:** unit/integration tests và kiểm tra DAST **chỉ trên staging** có phạm vi cho phép.
4. **Đợt D – Chạy UAT/DR:** kịch bản theo file `UAT_SECURITY_TEST_CASES.md`, báo cáo kết quả và bằng chứng.
5. **Đợt E – Phát hành:** đánh giá go/no-go, khóa commit, sao lưu trước thay đổi, deploy migration có kiểm soát, smoke test, theo dõi và rollback khi cần.

**Phân công đề xuất:** lập trình backend: API + quyền; lập trình frontend: form/UX; DevOps/DBA: deployment, DB, backup; nhân viên tiếp đón: UAT lịch; CNTT bệnh viện: phê duyệt phân quyền, nghiệm thu và theo dõi vận hành.

## 8. Hồ sơ bằng chứng cần thu

Mỗi issue phải có: (1) mã issue, commit SHA, (2) mô tả hiện trạng & tác động, (3) test tái hiện **trên staging**, (4) PR/diff, (5) kết quả CI, (6) test trước/sau, (7) log ảnh chụp đã ẩn danh, (8) người kiểm tra & thời điểm, (9) quyết định đóng issue. Không đưa dữ liệu người bệnh thật, secret, token hay connection string vào tài liệu/issue công khai.

## 9. Tệp đi kèm

- `P0_P1_REMEDIATION_PLAN.md` – từng issue, file cần sửa, cách sửa, tiêu chí DONE và chiến lược PR.
- `UAT_SECURITY_TEST_CASES.md` – bộ ca kiểm thử được nhóm theo quyền, API, bảo mật, database và vận hành.

**Trạng thái báo cáo:** KẾ HOẠCH KHẮC PHỤC & KIỂM THỬ, **không phải** kết luận kiểm thử hoàn tất.
