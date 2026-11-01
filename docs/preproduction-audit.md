# BÁO CÁO KIỂM TOÁN BẢO MẬT & SẴN SÀNG TRIỂN KHAI PRODUCTION (PRE-PRODUCTION AUDIT REPORT)

**Dự án:** Hệ thống Cổng thông tin điện tử & Quản lý dịch vụ y tế — **Bệnh viện Đa khoa khu vực Thới Lai**  
**Kiến trúc:** Next.js 16.2.4 + Payload CMS 3.82.1 + PostgreSQL (Drizzle ORM) + Docker / Nginx  
**Branch kiểm tra & khắc phục:** `fix/preproduction-hardening`  
**Base Commit kiểm tra:** `8db5a7a` (`main` — *Merge pull request #1 from minhtri2909/work*)  
**Ngày thực hiện:** 01/11/2026  

---

## 1. TỔNG QUAN KIẾN TRÚC & HIỆN TRẠNG HỆ THỐNG

### 1.1. Cấu hình nền tảng (Foundation & Stack)
- **Framework & CMS:** `next@16.2.4`, `payload@3.82.1`, `@payloadcms/next@3.82.1`, `@payloadcms/db-postgres@3.82.1`, `@payloadcms/richtext-lexical@3.82.1`, `@payloadcms/storage-s3@3.82.1`, `@payloadcms/email-nodemailer@3.82.1` (đồng bộ 100% phiên bản `3.82.1`).
- **Node.js & Runtime:** `engines.node`: `>=20.9.0` (Dockerfile sử dụng `node:20-bookworm-slim`, chạy dưới quyền non-root `USER node`).
- **Cơ sở dữ liệu & Schema Contract:**
  - Sử dụng PostgreSQL với `push: process.env.PAYLOAD_DB_PUSH === 'true'` (mặc định `false` trên production).
  - Quản lý schema thông qua hệ thống 81 bản ghi migration có đánh số thứ tự (`20260915_001` $\rightarrow$ `20261022_081`) tại [scripts/db-migrations](file:///f:/20.9%20web/bvdkthoilai-main/scripts/db-migrations) kết hợp hợp đồng niêm phong SHA-256 tại [db-schema-contract.json](file:///f:/20.9%20web/bvdkthoilai-main/scripts/db-schema-contract.json) (`20261022_081_create_global_appointment_code_sequence`).
- **Bảo mật tầng ứng dụng & Hạ tầng:**
  - `graphQL: { disable: true }` tại [payload.config.ts](file:///f:/20.9%20web/bvdkthoilai-main/payload.config.ts#L325).
  - Security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow` cho `/admin` và `/api`) được cấu hình tại [next.config.mjs](file:///f:/20.9%20web/bvdkthoilai-main/next.config.mjs#L27-L69).
  - Xác thực chống bot Cloudflare Turnstile chạy ở chế độ **Fail-closed** trên `NODE_ENV=production` tại [request-security.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/request-security.ts#L108-L163), vô hiệu hóa hoàn toàn cờ `MOCK_TURNSTILE` trên môi trường production.

---

## 2. DANH SÁCH LỖI PHÁT HIỆN THEO MỨC ĐỘ NGHIÊM TRỌNG (P0 / P1 / P2)

Dưới đây là toàn bộ các lỗi và điểm yếu bảo mật/vận hành được xác minh trực tiếp từ mã nguồn thực tế trong quá trình kiểm toán Giai đoạn 1:

### 2.1. Nhóm lỗi P0 (Nghiêm trọng — Chặn Go-live nếu không khắc phục)

| Mã lỗi | Mức độ | File & Dòng | Nguyên nhân gốc rễ (Root Cause) | Cách tái hiện (Reproduction) | Tác động (Impact) | Trạng thái |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P0-01** | **P0** | [src/app/api/site-visits/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/site-visits/route.ts#L162-L175) (dòng 36, 40, 144, 154, 170–173) | Biến `slug` lấy từ JSON body của request `POST /api/site-visits` được nối chuỗi trực tiếp (string interpolation) vào câu lệnh SQL thô: `WHERE slug = '${slug}';` bên trong `payload.db.drizzle.execute(...)`. Ngoài ra, endpoint không có `rateLimit`, không giới hạn kích thước JSON body và `activeSessions` Map tăng trưởng không giới hạn. | Gửi request `POST /api/site-visits` với body `{"collection":"news","slug":"test'; SELECT pg_sleep(5); --"}` mà không cần đăng nhập. | **SQL Injection (Unauthenticated)** trực tiếp vào PostgreSQL; nguy cơ đọc/sửa/xóa dữ liệu trái phép hoặc gây DoS bộ nhớ/kết nối DB. | **ĐÃ SỬA** |
| **P0-02** | **P0** | [src/collections/Users.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/collections/Users.ts#L36) (dòng 36, 110) & [src/access/index.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/access/index.ts#L45-L99) (dòng 45–99, 163–270) | `Users.ts` cấu hình `useSessions: false` và đặt `saveToJWT: true` cho `role`, `status`, `department`, `useCustomPermissions`, `permissions`. Khi `useSessions: false`, Payload hydrate `req.user` từ JWT mà không đọc lại bảng `users` trong DB; hook `data.sessions = []` (dòng 110) không có tác dụng thu hồi JWT. Hàm `resolveAuthenticatedUser(req)` tại `src/access/index.ts` dòng 49 có điều kiện `if (current.role && current.status != null) return current` nên bỏ qua việc đọc DB nếu JWT đã có sẵn `role` và `status`. Đồng thời các hàm `loggedIn`, `admins`, `departmentScopedAccess`... chỉ đọc trực tiếp `req.user` từ JWT. | 1. Đăng nhập tài khoản nhân sự A và lấy JWT token.<br>2. Admin khóa tài khoản A (`status = 'locked'`), hoặc hạ quyền `role`, hoặc đổi `department` từ Khoa A sang Khoa B.<br>3. Tài khoản A tiếp tục dùng JWT cũ gọi API `/api/appointments`, `/api/news` hoặc `/api/appointments-export`. | **Không thu hồi được phiên/quyền tức thời:** Tài khoản đã bị khóa hoặc bị thu hồi quyền vẫn tiếp tục truy cập/thao tác với quyền cũ cho đến khi JWT hết hạn (`tokenExpiration: 28800` = 8 giờ). | **ĐÃ SỬA** |

### 2.2. Nhóm lỗi P1 (Quan trọng — Ảnh hưởng bảo mật, phân quyền và tính ổn định)

| Mã lỗi | Mức độ | File & Dòng | Nguyên nhân gốc rễ (Root Cause) | Cách tái hiện (Reproduction) | Tác động (Impact) | Trạng thái |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P1-01** | **P1** | [src/app/(frontend)/api/emergency-import/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/emergency-import/route.ts#L6-L38) (dòng 6–38) | Endpoint `POST /api/emergency-import` nhận và phân tích file `.xlsx` (tối đa 20MB) bằng `exceljs` nhưng **không kiểm tra đăng nhập (`payload.auth`)**, **không kiểm tra quyền module `schedules`**, **không có rate limit**, và trả thẳng `error.message` thô ở dòng 34. | Người dùng ẩn danh gửi liên tiếp nhiều file `.xlsx` 20MB tới `POST /api/emergency-import`. | Bất kỳ ai không đăng nhập cũng có thể gọi API phân tích file Excel nội bộ, gây tốn CPU/RAM (DoS) và lộ thông tin lỗi hệ thống. | **ĐÃ SỬA** |
| **P1-02** | **P1** | [src/app/api/ai-work-schedule-ocr/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/ai-work-schedule-ocr/route.ts#L25-L30) (dòng 25–30, 203, 227) | Endpoint kiểm tra `if (!user)` (401) nhưng **thiếu kiểm tra phân quyền module `work-schedules`** (`hasModulePermission`). Ngoài ra dòng 203 & 227 trả trực tiếp chuỗi lỗi thô từ upstream Gemini API / hệ thống về client và thiếu ghi `audit-logs`. | Đăng nhập bằng tài khoản không có quyền lịch công tác (ví dụ `hr` hoặc `vaccination`) và gọi `POST /api/ai-work-schedule-ocr`. | Tài khoản nội bộ không có thẩm quyền vẫn tiêu thụ được quota Gemini API OCR; rò rỉ thông báo lỗi upstream ra client. | **ĐÃ SỬA** |
| **P1-03** | **P1** | [src/app/api/work-schedule-history/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/work-schedule-history/route.ts#L7-L14) (dòng 7–14) | Endpoint chỉ kiểm tra `if (!user)` mà không kiểm tra `hasModulePermission(user, 'work-schedules', 'view')` trước khi truy vấn `audit-logs` với `overrideAccess: true`. | Đăng nhập tài khoản bất kỳ không có quyền xem `work-schedules` và gọi `GET /api/work-schedule-history?id=1`. | Lộ lịch sử nhật ký kiểm toán (`audit-logs`) của lịch công tác cho tài khoản không được cấp quyền. | **ĐÃ SỬA** |
| **P1-04** | **P1** | [src/collections/Media.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/collections/Media.ts#L158-L160) (dòng 158–160) | Field `accessLevel` cấu hình `access: { create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) }`, không kiểm tra `isActiveUser` và quyền `moduleAccess('media', 'edit')`. | Tài khoản chỉ có quyền tạo/xem cơ bản hoặc vừa bị khóa gửi request cập nhật `accessLevel` từ `restricted` sang `public`. | Nguy cơ hạ cấp mức độ bảo vệ của tệp đính kèm (`restricted`/`internal` $\rightarrow$ `public`) bởi tài khoản không có quyền sửa media. | **ĐÃ SỬA** |
| **P1-05** | **P1** | [payload.config.ts](file:///f:/20.9%20web/bvdkthoilai-main/payload.config.ts#L347-L349) (dòng 347–349) | Cấu hình Nodemailer SMTP hardcode `tls: { rejectUnauthorized: false }`. | Kết nối SMTP gửi email khôi phục mật khẩu trên môi trường production. | Tắt xác thực chứng chỉ TLS của máy chủ SMTP mặc định, tạo rủi ro tấn công Man-in-the-Middle (MITM) chặn bắt email reset mật khẩu. | **ĐÃ SỬA** |
| **P1-06** | **P1** | [scripts/db-migrate.mjs](file:///f:/20.9%20web/bvdkthoilai-main/scripts/db-migrate.mjs#L59-L61) (dòng 59–61, 260–283) | Hàm `checksum(filePath)` băm trực tiếp byte thô (`fs.readFileSync(filePath)`), không chuẩn hóa `CRLF` ($\backslash\text{r}\backslash\text{n}$) về `LF` ($\backslash\text{n}$) như `db-schema-contract.mjs`. Khi chạy trên Windows (`core.autocrlf=true`) so với Linux/Docker, mã băm SHA-256 bị lệch. | Pull code trên Windows và chạy `npm run db:migrate:deploy` hoặc `npm run db:migrate:status` đối với database đã áp dụng migration trên Linux. | Báo lỗi giả `Migration ... đã bị sửa sau khi áp dụng` do khác biệt kết thúc dòng giữa Windows (`CRLF`) và Linux (`LF`). | **ĐÃ SỬA** |
| **P1-07** | **P1** | `package.json` / `package-lock.json` (`npm audit`) | Có cảnh báo lỗ hổng phụ thuộc trong cây `node_modules` (`next@16.2.4`, `payload@3.82.1`, `dompurify`, `sharp`, `undici`, `nodemailer`, `exceljs`). | Chạy `npm audit`. | Cần phân tích kỹ từng advisory và lộ trình nâng cấp an toàn mà không phá vỡ schema/lockfile hiện hành (xem chi tiết tại Mục 3.3). | **ĐÃ ĐÁNH GIÁ & GIẢM THIỂU** |

### 2.3. Nhóm lỗi P2 (Cải thiện bảo mật chiều sâu & vận hành)

| Mã lỗi | Mức độ | File & Dòng | Nguyên nhân gốc rễ (Root Cause) | Cách tái hiện (Reproduction) | Tác động (Impact) | Trạng thái |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **P2-01** | **P2** | [src/app/(frontend)/api/chatbot-excel-import/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/chatbot-excel-import/route.ts#L280-L288), [src/app/(frontend)/api/services-import/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/services-import/route.ts#L157-L162), [src/app/(frontend)/api/surveys/templates/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/surveys/templates/route.ts#L139-L214) | Các khối `catch` trả trực tiếp `error.message` thô trong phản hồi HTTP 500. | Kích hoạt lỗi ngoại lệ khi import Excel hoặc lưu mẫu khảo sát. | Có thể làm lộ thông tin nội bộ của thư viện hoặc đường dẫn file hệ thống trong phản hồi lỗi 500. | **ĐÃ SỬA** |
| **P2-02** | **P2** | [src/lib/savedSurveyTemplatesStore.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/savedSurveyTemplatesStore.ts#L19-L20) (dòng 19–20) | Lưu file `savedSurveyTemplates.json` cố định tại `src/data/savedSurveyTemplates.json`. Trong Docker container, thư mục `/app/src/data` nằm trên ephemeral container layer (không nằm trong Docker volume `/app/media`). | Lưu mẫu khảo sát tùy chỉnh trên giao diện quản trị rồi redeploy container Docker. | Mẫu khảo sát tự lưu bị mất sau khi khởi động lại hoặc cập nhật container mới. | **ĐÃ SỬA** |
| **P2-03** | **P2** | [src/lib/request-security.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/request-security.ts#L6) (dòng 6–83) | Bộ đếm `rateLimit` sử dụng `Map` trong bộ nhớ tiến trình Node.js (`buckets = new Map()`, giới hạn an toàn `MAX_BUCKETS = 10_000`). | Chạy nhiều replica/container song song sau Load Balancer. | Hoàn toàn an toàn và hiệu quả khi chạy 1 container (`app`) + Nginx (`zone=site_login`) như kiến trúc Docker Compose hiện tại; nếu mở rộng ngang nhiều replica cần chuyển sang Redis hoặc rate-limit tại tầng Nginx/Cloudflare. | **GHI NHẬN KIẾN TRÚC** |

---

## 3. ĐÁNH GIÁ CHI TIẾT CÁC CẢNH BÁO TRỌNG TÂM & PHÂN QUYỀN

### 3.1. Kết quả kiểm tra các cảnh báo từng được nêu (Stage 1.3)
1. **Phiên bản Payload CMS:** Tất cả các gói `@payloadcms/*` và `payload` đều đồng bộ ở phiên bản `3.82.1` trong `package.json` và `package-lock.json` (không có hiện tượng lệch phiên bản giữa các gói Payload).
2. **`useSessions: false` và quyền JWT cũ:**
   - **Hiện trạng trước khi sửa:** Cảnh báo **ĐÚNG**. Do `useSessions: false` kết hợp `resolveAuthenticatedUser` trả về ngay `req.user` nếu trong JWT đã có `role` và `status`, việc khóa tài khoản hoặc đổi quyền/khoa không có hiệu lực cho tới khi JWT hết hạn.
   - **Cách khắc phục:** Đã nâng cấp [`resolveAuthenticatedUser`](file:///f:/20.9%20web/bvdkthoilai-main/src/access/index.ts#L46-L71) và bổ sung [`getVerifiedActiveUser`](file:///f:/20.9%20web/bvdkthoilai-main/src/access/index.ts#L73-L91) để luôn đối chiếu bản ghi `users` mới nhất từ cơ sở dữ liệu (có bộ nhớ đệm `req._resolvedCurrentUser` trong phạm vi từng request để không truy vấn lặp lại), mà **không cần thay đổi schema database hay tạo bảng session mới**.
3. **SMTP `rejectUnauthorized: false`:** Cảnh báo **ĐÚNG** ([payload.config.ts](file:///f:/20.9%20web/bvdkthoilai-main/payload.config.ts#L348)). Đã sửa thành mặc định `true` (`process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? false : true`).
4. **Rate limiting `Map`:** Trong [request-security.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/request-security.ts#L6-L83), `buckets` Map đã có cơ chế dọn dẹp (`pruneBuckets`) và giới hạn trần `MAX_BUCKETS = 10_000` nên không bị rò rỉ bộ nhớ (memory leak). Riêng `activeSessions` trong [site-visits/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/site-visits/route.ts#L6-L18) trước đó chưa có giới hạn trần — nay đã được bổ sung `MAX_ACTIVE_SESSIONS = 10_000`.
5. **Media persistence:** Hỗ trợ song song lưu trữ đĩa cục bộ bền vững qua Docker volume (`media_data:/app/media` trong [docker-compose.yml](file:///f:/20.9%20web/bvdkthoilai-main/docker-compose.yml#L34)) và lưu trữ đám mây tương thích S3/Cloudflare R2 (`MEDIA_STORAGE=r2` trong [payload.config.ts](file:///f:/20.9%20web/bvdkthoilai-main/payload.config.ts#L172-L202)).
6. **Migration `prestart`:** `package.json` cấu hình `"prestart": "npm run db:migrate:deploy"`, sử dụng PostgreSQL advisory lock (`pg_try_advisory_lock(20260916, 1)`) và kiểm tra hợp đồng schema (`assertSchemaContract`) trước khi khởi chạy ứng dụng.

### 3.2. Kiểm toán Phân quyền (Authorization Matrix) cho 4 nhóm đối tượng
Đã rà soát toàn bộ 50 Collections ([src/collections/*.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/collections)) và 34 Globals ([src/globals/*.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/globals)):
- **Người dùng chưa đăng nhập (Unauthenticated / Public):**
  - Không thể tạo trực tiếp bản ghi trên `appointments`, `consultations`, `feedback`, `feedbackCases`, `formSubmissions`, `survey-responses`, `survey-answers`, `audit-logs`. Mọi dữ liệu gửi từ người dân bắt buộc đi qua các API kiểm soát (`/api/appointments`, `/api/feedback`, `/api/consultation`, `/api/forms`, `/api/surveys/submit`) có Turnstile, giới hạn kích thước body và Rate Limit.
  - Không thể đọc dữ liệu nhạy cảm (`appointments`, `consultations`, `feedback`, `feedbackCases`, `formSubmissions`, `survey-responses`, `audit-logs`, `importJobs`).
  - Đối với `media`: chỉ đọc được các tệp có `accessLevel = 'public'` hoặc chưa gắn nhãn hạn chế; các tệp đính kèm tài liệu mật/nội bộ/PIN tự động được hook [`protectDocumentMedia`](file:///f:/20.9%20web/bvdkthoilai-main/src/hooks/protectDocumentMedia.ts#L13-L43) chuyển thành `accessLevel = 'restricted'` và chỉ phục vụ qua `/api/document-file` kèm HMAC token ngắn hạn (300 giây).
- **Quản lý khoa (`department-manager`) & Nhân sự khoa (`department`):**
  - Chỉ đọc/tạo/sửa/xóa/xuất được lịch hẹn thuộc đúng khoa được gán (`{ department: { equals: departmentID } }`).
  - Nếu tài khoản chưa được gán khoa (`department == null`) $\rightarrow$ **Deny-by-default (`false`)**, tuyệt đối không xem được dữ liệu toàn viện.
  - Trường `Appointments.department` và `Appointments.code` bị khóa quyền sửa (`appointmentDepartmentFieldAccess`), ngăn chặn việc trưởng khoa A chuyển lịch sang khoa B hoặc giả mạo mã phiếu hẹn.
- **Nhân viên chuyên trách (`editor`, `reviewer`, `hr`, `finance`, `procurement`, `clinic-schedule`, `vaccination`, `quality-management`):**
  - Tuân thủ nghiêm ngặt ma trận `moduleRoleDefaults` tại [src/access/index.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/access/index.ts#L120-L159): các vai trò `editor`, `hr`, `finance`, `procurement` bị chặn hoàn toàn quyền xem/sửa/xuất dữ liệu lịch hẹn người bệnh (`appointments`).
  - Vai trò `clinic-schedule` được điều phối lịch hẹn (`view`, `create`, `edit`) nhưng không có quyền `delete` hay `export` mặc định.
- **Quản trị viên cấp cao (`super-admin`, `system-admin`, `admin`):**
  - Có toàn quyền quản trị nghiệp vụ, nhưng vẫn không thể sửa/xóa nhật ký kiểm toán (`AuditLogs` khóa `create: () => false, update: () => false, delete: () => false`).

### 3.3. Phân tích `npm audit` & Dependency Advisories
Kết quả chạy `npm audit` ghi nhận các advisory trên nhánh phụ thuộc hiện tại:
- **Nhóm `@payloadcms/*` (`3.82.1`) và `next` (`16.2.4`):**
  - Các bản vá trên nhánh `payload` yêu cầu nâng lên `3.91.0+` / `3.92.1` và `next@16.4.x`. Tuy nhiên, việc nâng cấp đồng loạt `@payloadcms/db-postgres` và `@payloadcms/drizzle` sẽ làm thay đổi cấu trúc sinh file `src/payload-generated-schema.ts`, phá vỡ hợp đồng schema `db-schema-contract.json` và đòi hỏi chạy migration lên cơ sở dữ liệu.
  - **Biện pháp giảm thiểu đã áp dụng trong kiến trúc hiện tại:** GraphQL đã bị tắt (`graphQL: { disable: true }`), toàn bộ endpoint upload và API đều kiểm tra chữ ký magic bytes (`matchesImageSignature`), giới hạn kích thước stream (`readJsonBodyWithLimit`), kiểm soát truy cập chặt chẽ và chạy sau Nginx reverse proxy.
- **Nhóm `exceljs` (`^4.4.0`):** Advisory nằm ở các gói phụ thuộc nén (`archiver`, `glob`, `minimatch`); `npm audit` đề xuất lùi về `exceljs@4.1.1` (breaking downgrade). Trong dự án, mọi endpoint sử dụng `exceljs` (`/api/services-import`, `/api/chatbot-excel-import`, `/api/emergency-import`) đều đã bị khóa sau xác thực quản trị (`getVerifiedActiveUser` + `hasModulePermission`) và giới hạn dung lượng tệp tối đa 10–20MB, loại bỏ bề mặt tấn công từ người dùng ẩn danh.

---

## 4. TỔNG HỢP CÁC SỬA ĐỔI ĐÃ THỰC HIỆN (STAGE 2 & STAGE 4)

Toàn bộ sửa đổi được thực hiện cô lập trên nhánh `fix/preproduction-hardening`, giữ nguyên 100% giao diện, tiếng Việt, chức năng nghiệp vụ và schema cơ sở dữ liệu:

1. **[src/access/index.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/access/index.ts):**
   - Nâng cấp `resolveAuthenticatedUser(req)` luôn tải lại thông tin người dùng từ DB (`req.payload.findByID`) và cache vào `req._resolvedCurrentUser` trong phạm vi request.
   - Chuyển đổi toàn bộ các hàm access control (`loggedIn`, `ownUserOrAdmins`, `publicActive`, `publicPublished`, `publicActiveFor`, `publicPublishedFor`, `admins`, `superAdmins`, `publishers`, `editors`, `procurementTeam`, `adminField`, `mediaReadAccess`, `departmentScopedAccess`, `ownDepartmentRecordAccess`, `organizationDepartmentScopedAccess`, `publishedOrOwnedDraft`) sang sử dụng `resolveAuthenticatedUser(req)`.
   - Bổ sung hàm helper `getVerifiedActiveUser(payload, headers)` cho các custom API routes.
2. **[src/app/api/site-visits/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/site-visits/route.ts):**
   - Thay thế toàn bộ câu lệnh SQL nối chuỗi bằng Parameterized SQL (`sql` template tag từ `@payloadcms/db-postgres/drizzle`) và kiểm tra `SLUG_PATTERN = /^[a-z0-9-]+$/i`.
   - Bổ sung `rateLimit`, `readJsonBodyWithLimit(req, 4096)`, giới hạn `MAX_ACTIVE_SESSIONS = 10_000` và ẩn `error.message` thô trong phản hồi HTTP 500.
3. **[src/app/(frontend)/api/emergency-import/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/emergency-import/route.ts):**
   - Bổ sung xác thực `getVerifiedActiveUser`, kiểm tra quyền module `schedules` (`import` / `create` / `edit`), `bodyIsTooLarge`, `rateLimit` và chuẩn hóa thông báo lỗi 500.
4. **[src/app/api/ai-work-schedule-ocr/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/ai-work-schedule-ocr/route.ts):**
   - Bổ sung xác thực `getVerifiedActiveUser`, kiểm tra quyền module `work-schedules` (`import` / `create` / `edit`), giới hạn kích thước kết quả trả về, ghi nhận `audit-logs` và ẩn chuỗi lỗi thô khi trả về HTTP 500/502.
5. **[src/app/api/work-schedule-history/route.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/work-schedule-history/route.ts):**
   - Bổ sung xác thực `getVerifiedActiveUser` và kiểm tra `hasModulePermission(user, 'work-schedules', 'view')`.
6. **Các API quản trị khác ([ai-daily-ocr](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/ai-daily-ocr/route.ts), [ai-nurse-ocr](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/ai-nurse-ocr/route.ts), [ai-schedule-ocr](file:///f:/20.9%20web/bvdkthoilai-main/src/app/api/ai-schedule-ocr/route.ts), [appointments-export](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/appointments-export/route.ts), [document-access](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/document-access/route.ts), [services-import](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/services-import/route.ts), [chatbot-excel-import](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/chatbot-excel-import/route.ts), [surveys/export](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/surveys/export/route.ts), [surveys/statistics](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/surveys/statistics/route.ts), [surveys/templates](file:///f:/20.9%20web/bvdkthoilai-main/src/app/(frontend)/api/surveys/templates/route.ts)):**
   - Chuyển sang dùng `getVerifiedActiveUser` để đảm bảo thu hồi quyền tức thời và khử khuẩn thông báo lỗi 500.
7. **[src/collections/Media.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/collections/Media.ts#L159) & [payload.config.ts](file:///f:/20.9%20web/bvdkthoilai-main/payload.config.ts#L348):**
   - Khóa quyền tạo/sửa `Media.accessLevel` theo `moduleAccess('media', 'create')` / `moduleAccess('media', 'edit')`.
   - Đặt mặc định `tls.rejectUnauthorized: true` cho SMTP (có thể cấu hình qua `SMTP_TLS_REJECT_UNAUTHORIZED`).
8. **[scripts/db-migrate.mjs](file:///f:/20.9%20web/bvdkthoilai-main/scripts/db-migrate.mjs#L59-L72) & [src/lib/savedSurveyTemplatesStore.ts](file:///f:/20.9%20web/bvdkthoilai-main/src/lib/savedSurveyTemplatesStore.ts#L19-L36):**
   - Chuẩn hóa kết thúc dòng `CRLF` / `LF` khi tính và đối chiếu checksum SHA-256 của các file migration.
   - Hỗ trợ lưu trữ bền vững `savedSurveyTemplates.json` trong thư mục volume `/app/media/.internal-data` trên môi trường production.
9. **Bổ sung Regression Tests ([scripts/test-p0-security.mjs](file:///f:/20.9%20web/bvdkthoilai-main/scripts/test-p0-security.mjs) & [scripts/test-p1-security.mjs](file:///f:/20.9%20web/bvdkthoilai-main/scripts/test-p1-security.mjs)):**
   - Thêm `TC-ACL-11` (thu hồi phiên/quyền tức thời khi khóa tài khoản, hạ role, đổi khoa), `TC-SEC-10` (chống SQLi tại `/api/site-visits`), `TC-SEC-11` (xác thực & phân quyền trên `/api/emergency-import`, `/api/ai-work-schedule-ocr`, `/api/work-schedule-history`), `TC-SEC-12` (SMTP TLS & `Media.accessLevel`).
   - Thêm chốt chặn an toàn trong `test-p1-security.mjs`: tự động chuyển sang trạng thái `BLOCKED` nếu phát hiện `TEST_DATABASE_URL` trong `.env` trỏ tới `*.proxy.rlwy.net` mà chưa có xác nhận `VERIFIED_ISOLATED_TEST_DB=true`, bảo vệ tuyệt đối cơ sở dữ liệu trên Railway.

---

## 5. DANH SÁCH MIGRATION & PHƯƠNG ÁN ROLLBACK

### 5.1. Trạng thái Migration hiện tại
- **Tổng số file migration:** 81 file (`20260915_001_initial_schema.mjs` $\rightarrow$ `20261022_081_create_global_appointment_code_sequence.mjs`).
- **Migration mới nhất được niêm phong (Sealed Contract):** `20261022_081_create_global_appointment_code_sequence` (khởi tạo và đồng bộ `public.appointment_code_seq` phục vụ cấp mã lịch hẹn nguyên tử `BVTLxxxx`).
- **Tác động của đợt sửa lỗi hiện tại:** Không thay đổi cấu trúc bảng hay cột của Payload schema (`npm run db:schema:check` đạt **PASS**).
- **Khắc phục lỗi lệch Checksum trên Windows/VPS:** Nhờ chuẩn hóa `CRLF`/`LF` trong `scripts/db-migrate.mjs`, khi chạy `npm run db:migrate:deploy` trên môi trường mới hoặc đối chiếu với database đã áp dụng migration trước đó, hệ thống sẽ tự động xác minh hàm `verify({ client })` của từng migration và đồng bộ checksum chuẩn `LF` mà không báo lỗi giả.

### 5.2. Phương án Rollback an toàn
1. **Trước khi chạy migration / cập nhật ứng dụng:** Bắt buộc tạo bản sao lưu đầy đủ (`scripts/backup.sh` trên VPS hoặc `node scripts/backup-railway.mjs` tạo file `backups/vps_ready_full_backup.sql` và kiểm tra `SHA256SUMS`).
2. **Rollback tầng ứng dụng (Code Rollback):** Do đợt sửa lỗi này hoàn toàn tương thích ngược với schema hiện tại (`20261022_081`), có thể lùi container/branch về commit trước đó ngay lập tức mà không cần sửa đổi database.
3. **Rollback tầng cơ sở dữ liệu (Database Rollback khi sự cố):**
   - Mọi migration trong `scripts/db-migrations` đều chạy trong transaction (`BEGIN ... COMMIT`, tự động `ROLLBACK` nếu `up()` hoặc `verify()` thất bại).
   - Trường hợp cần khôi phục toàn bộ DB về thời điểm trước khi triển khai, sử dụng:
     ```bash
     CONFIRM_RESTORE=YES bash scripts/restore.sh /var/backups/bvdkthoilai/<THU_MUC_BACKUP>
     ```

---

## 6. DANH MỤC BIẾN MÔI TRƯỜNG PRODUCTION CẦN THIẾT

*(Tuyệt đối không ghi giá trị bí mật vào tài liệu. Xem mẫu tại [.env.production.example](file:///f:/20.9%20web/bvdkthoilai-main/.env.production.example))*

| Nhóm | Tên biến môi trường | Bắt buộc | Mô tả vai trò |
| :--- | :--- | :---: | :--- |
| **Ứng dụng & Bảo mật** | `NODE_ENV` | Có | Đặt giá trị `production`. |
| | `NEXT_PUBLIC_SITE_URL` | Có | URL chính thức có `https://` (ví dụ: `https://bvdkthoilai.vn`). |
| | `PAYLOAD_SECRET` | Có | Chuỗi ngẫu nhiên tối thiểu 32 ký tự (`openssl rand -hex 32`) dùng ký JWT. |
| | `DOCUMENT_ACCESS_SECRET` | Khuyến nghị | Khóa ký HMAC token xem tài liệu nội bộ/PIN (nếu để trống sẽ dùng `PAYLOAD_SECRET`). |
| | `DOCUMENT_DEFAULT_PIN` | Khuyến nghị | Mã PIN mặc định cho tài liệu chế độ `pin` khi tài liệu không đặt PIN riêng. |
| | `HEALTH_DETAIL_KEY` | Khuyến nghị | Khóa bí mật gửi qua header `x-health-key` để xem chi tiết `/api/health`. |
| **Cơ sở dữ liệu** | `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL chính thức của ứng dụng. |
| | `DATABASE_MIGRATION_URL` | Khuyến nghị | Chuỗi kết nối trực tiếp (Direct/Unpooled URL) dùng riêng cho `db:migrate:deploy`. |
| | `POSTGRES_PASSWORD` | Có (Docker) | Mật khẩu khởi tạo container PostgreSQL trong `docker-compose.yml`. |
| | `PAYLOAD_DB_PUSH` | Có | Bắt buộc đặt `false` trên production. |
| **Chống Bot (Turnstile)** | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Có | Site key công khai của Cloudflare Turnstile. |
| | `TURNSTILE_SECRET_KEY` | Có | Secret key xác thực phía server (nếu thiếu trên production, các biểu mẫu sẽ Fail-closed). |
| **Lưu trữ Media (Tùy chọn R2)** | `MEDIA_STORAGE` | Tùy chọn | Đặt `local` (lưu vào Docker volume `/app/media`) hoặc `r2` (Cloudflare R2). |
| | `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` | Khi dùng R2 | Thông tin kết nối bucket Cloudflare R2 / S3. |
| **Email SMTP & AI OCR** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME` | Khuyến nghị | Cấu hình máy chủ gửi email khôi phục mật khẩu quản trị. |
| | `SMTP_TLS_REJECT_UNAUTHORIZED` | Tùy chọn | Mặc định `true` (kiểm tra chứng chỉ TLS). Chỉ đặt `false` nếu dùng relay nội bộ tự ký. |
| | `GEMINI_API_KEY` | Tùy chọn | Khóa API Google Gemini phục vụ tính năng quét ảnh lịch trực/lịch công tác bằng AI. |

---

## 7. HƯỚNG DẪN TRIỂN KHAI VPS / DOCKER AN TOÀN, BACKUP, KHÔI PHỤC & KIỂM TRA SAU GO-LIVE

### 7.1. Quy trình triển khai lên VPS mới (Docker Compose + Nginx)
1. **Chuẩn bị môi trường & cấu hình:**
   ```bash
   cp .env.production.example .env
   chmod 600 .env
   # Điền đầy đủ các biến bắt buộc trong .env (PAYLOAD_SECRET >= 32 ký tự, DATABASE_URL, TURNSTILE_*, ...)
   ```
2. **Nạp dữ liệu chuẩn lên PostgreSQL trên VPS (nếu chuyển từ hệ thống cũ sang VPS mới):**
   ```bash
   # Khởi chạy container db trước:
   docker compose up -d db
   # Nạp bản full schema + data chuẩn (vps_ready_full_backup.sql):
   docker compose exec -T db psql -U hospital -d benhvien_thoilai -f - < backups/vps_ready_full_backup.sql
   ```
3. **Kiểm tra Preflight & Chạy Migration:**
   ```bash
   npm run preflight:production
   npm run db:migrate:status
   npm run db:migrate:deploy
   ```
4. **Khởi chạy toàn bộ dịch vụ ứng dụng:**
   ```bash
   docker compose up -d --build
   docker compose ps
   ```
5. **Cấu hình Nginx Reverse Proxy & SSL:**
   - Sử dụng cấu hình mẫu tại `deploy/nginx/benhvien.conf` và `deploy/nginx/bv-proxy.conf` (đã thiết lập `X-Forwarded-For $remote_addr` chống giả mạo IP và `limit_req_zone` cho `/api/users/login`).

### 7.2. Quy trình Sao lưu (Backup) & Khôi phục (Restore) định kỳ
- **Sao lưu tự động hàng ngày trên VPS:**
  ```bash
  bash scripts/backup.sh
  bash scripts/verify-backup.sh /var/backups/bvdkthoilai/<THU_MUC_MOI_NHAT>
  ```
- **Khôi phục khi xảy ra sự cố:**
  ```bash
  CONFIRM_RESTORE=YES bash scripts/restore.sh /var/backups/bvdkthoilai/<THU_MUC_BACKUP>
  ```

### 7.3. Kiểm tra sau Go-live (Post-Deployment Smoke Test)
Ngay sau khi khởi chạy container trên VPS/Staging, chạy lệnh kiểm tra tự động:
```bash
SMOKE_BASE_URL=https://bvdkthoilai.vn npm run smoke:production
```
Xác minh thủ công 5 điểm cốt lõi:
1. `GET /api/health` trả về `200 OK` (`status: "ok"`).
2. Trang chủ `/`, `/tin-tuc`, `/khoa-phong`, `/bac-si`, `/bang-gia`, `/tiem-chung`, `/van-ban`, `/phac-do-dieu-tri` hiển thị đầy đủ dữ liệu tiếng Việt.
3. Biểu mẫu Đặt lịch khám (`/dat-lich-kham`) hiển thị widget Cloudflare Turnstile và tạo mã phiếu hẹn `BVTLxxxx` thành công.
4. Đăng nhập `/admin` hoạt động, tài khoản Quản lý khoa chỉ nhìn thấy lịch hẹn của khoa mình.
5. Thử khóa 1 tài khoản thử nghiệm trong `/admin/collections/users` $\rightarrow$ phiên làm việc của tài khoản đó lập tức bị từ chối ở request tiếp theo.

---

## 8. KẾT LUẬN NGHIỆM THU: CONDITIONAL GO (GO CÓ ĐIỀU KIỆN)

### Đánh giá tổng thể: **CONDITIONAL GO (ĐỦ ĐIỀU KIỆN GO-LIVE KHI HOÀN TẤT 3 BƯỚC HẠ TẦNG DƯỚI ĐÂY)**
- **Về Mã nguồn, Bảo mật & Toàn vẹn dữ liệu (Codebase & Security):** **ĐẠT (PASS 100%)**.
  - Toàn bộ lỗ hổng **P0** (SQL Injection tại `/api/site-visits`, lỗi không thu hồi phiên/quyền tức thời khi `useSessions: false`) và **P1/P2** (thiếu xác thực trên `/api/emergency-import`, thiếu phân quyền module trên `/api/ai-work-schedule-ocr` và `/api/work-schedule-history`, quyền sửa `Media.accessLevel`, SMTP TLS `rejectUnauthorized`, chuẩn hóa CRLF/LF migration checksum, lưu trữ bền vững survey templates, ẩn `error.message` thô) **đã được khắc phục triệt để và có regression test bảo vệ**.
  - `npm run typecheck`, `npm run db:schema:check`, `npm run validate:all` (11/11 bộ kiểm tra), `npm run validate:production-security`, `npm run backup:rehearse` và `npm run build` đều đạt **PASS 100% (0 FAIL)**.
- **Điều kiện bắt buộc trước khi mở truy cập công khai trên VPS Production (Do môi trường hiện tại chưa cung cấp `TEST_DATABASE_URL` / `TEST_ADMIN_DATABASE_URL` / `STAGING_API_URL` độc lập nên các bài test hạ tầng thực tế đang được đánh dấu `BLOCKED` đúng quy tắc an toàn):**
  1. **Cấu hình biến môi trường Production thật trên VPS:** Khởi tạo `.env` trên VPS với `PAYLOAD_SECRET` mới ($\ge 32$ ký tự), cặp khóa thật `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, `DATABASE_URL` nội bộ của VPS và `PAYLOAD_DB_PUSH=false`, rồi chạy `npm run preflight:production` đạt PASS.
  2. **Diễn tập khôi phục trên PostgreSQL của VPS mới trước khi cắt chuyển DNS:** Chạy `npm run backup:restore-real` với `TEST_ADMIN_DATABASE_URL` trỏ vào PostgreSQL trên VPS mới (hoặc nạp thử `backups/vps_ready_full_backup.sql` và chạy `npm run db:migrate:status`) để xác nhận 81/81 migration ở trạng thái `APPLIED`.
  3. **Chạy Smoke Test & E2E Staging (`npm run smoke:production`):** Sau khi bật container trên VPS (trước khi trỏ DNS chính thức), chạy `SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:production` và thực hiện 1 lượt đặt lịch khám + kiểm tra phân quyền Khoa A / Khoa B (`TC-ACL-10B`, `TC-APPT-05B`, `TC-PRIV-05B`) để đóng toàn bộ các mục `BLOCKED`.

