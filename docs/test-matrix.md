# MA TRẬN KIỂM THỬ & XÁC MINH CHẤT LƯỢNG (PRE-PRODUCTION TEST MATRIX)

**Dự án:** Hệ thống Cổng thông tin điện tử & Quản lý dịch vụ y tế — **Bệnh viện Đa khoa khu vực Thới Lai**  
**Branch thực thi:** `fix/preproduction-hardening`  
**Base Commit:** `8db5a7a`  
**Ngày thực hiện:** 01/11/2026  

---

## 1. TỔNG HỢP KẾT QUẢ CHẠY CÁC LỆNH KIỂM THỬ (QUALITY GATES SUMMARY)

| STT | Lệnh thực thi | Phân loại | Kết quả | Chi tiết số lượng | Ghi chú / Nguyên nhân |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | `npm run db:schema:check` | Hợp đồng Schema DB | **PASS** | 1 / 1 PASS | Khớp mã băm SHA-256 của migration `20261022_081_create_global_appointment_code_sequence`. |
| 2 | `node scripts/test-db-schema-contract.mjs` | Kiểm thử cơ chế Seal Schema | **PASS** | 4 / 4 PASS | Chặn thay đổi schema không có migration và chặn dùng lại migration cũ. |
| 3 | `npm run typecheck` (`tsc --noEmit`) | Kiểm tra kiểu tĩnh TypeScript | **PASS** | 0 lỗi | Toàn bộ 50 Collections, 34 Globals, API routes và Frontend pages hợp lệ. |
| 4 | `npm run test:security-p0` | Kiểm thử bảo mật & Phân quyền P0 | **PASS** *(có mục BLOCKED hạ tầng)* | **15 PASS** / 0 FAIL / 0 SKIP / **1 BLOCKED** | Bao gồm regression test mới `TC-ACL-11` (thu hồi phiên/quyền tức thời) và `TC-SEC-10` (chống SQLi `/api/site-visits`). Mục `TC-ACL-10B` báo `BLOCKED` do chưa cấu hình `STAGING_API_URL`. |
| 5 | `npm run test:security-p1` | Kiểm thử bảo mật, Rate Limit & Concurrency P1 | **PASS** *(có mục BLOCKED hạ tầng)* | **17 PASS** / 0 FAIL / 0 SKIP / **5 BLOCKED** | Bao gồm regression test mới `TC-SEC-11` và `TC-SEC-12`. 5 bài test tích hợp DB/Staging (`TC-APPT-05A`, `TC-APPT-05B`, `TC-APPT-08`, `TC-MIG-081`, `TC-PRIV-05B`) báo `BLOCKED` an toàn khi không có `TEST_DATABASE_URL` độc lập và `STAGING_API_URL`. |
| 6 | `npm run validate:all` | Bộ kiểm định tĩnh toàn diện 11 phân hệ | **PASS** | **552 / 552 PASS** | Gồm `foundation` (26/26), `site-shell` (14/14), `public-content` (21/21), `patient-services` (17/17), `organization` (18/18), `homepage-seo-search` (20/20), `chatbot-forms-feedback` (22/22), `quality-surveys` (16/16), `migrations` (354/354 + 4/4), `system-hardening` (31/31), `uat-production` (29/29). |
| 7 | `npm run validate:production-security` | Kiểm định cấu hình bảo mật Production v4.3+ | **PASS** | 9 / 9 PASS | Brute-force lock, Turnstile server verify, ExcelJS, Docker localhost bind & non-root, Nginx rate limit & trusted IP. |
| 8 | `npm run backup:rehearse` | Diễn tập sao lưu & khôi phục dữ liệu giả lập | **PASS** | 7 / 7 PASS | Sinh gói backup giả lập, kiểm tra `SHA256SUMS`, chống rò rỉ secret, khôi phục 100% và phát hiện can thiệp byte (Tamper-detection). |
| 9 | `npm run backup:restore-real` | Diễn tập `pg_dump` / `pg_restore` thực tế | **BLOCKED** | 0 PASS / 0 FAIL / **1 BLOCKED** | Chưa cấu hình `TEST_ADMIN_DATABASE_URL` và `CONFIRM_TEST_INSTANCE=true` trên PostgreSQL test instance độc lập (tuân thủ quy tắc cấm dùng DB vận hành). |
| 10 | `npm run build` | Production Build (`prebuild` + `next build`) | **PASS** | 49 / 49 trang tĩnh & toàn bộ route động | Sinh importmap, Payload types, DB schema, kiểm tra schema contract và biên dịch thành công toàn bộ ứng dụng Next.js. |
| 11 | `npm run smoke:production` | Kiểm thử HTTP Smoke Test & E2E UI | **BLOCKED** | Chưa chạy | Yêu cầu máy chủ Staging/VPS đang chạy thực tế (`SMOKE_BASE_URL`). |

---

## 2. MA TRẬN CHI TIẾT TỪNG CA KIỂM THỬ BẢO MẬT & NGHIỆP VỤ (P0 & P1 TEST CASES)

### 2.1. Nhóm P0 — Phân quyền, Thu hồi phiên, Turnstile & Chống SQL Injection (`scripts/test-p0-security.mjs`)

| Mã Test Case | Mô tả kịch bản kiểm thử | Phân loại | Kết quả | Chi tiết xác minh |
| :--- | :--- | :--- | :---: | :--- |
| **TC-ACL-01 / TC-SEC-04** | Collection `Appointments` không cho phép public create (`create !== anyone`) | Unit / ACL | **PASS** | Người dùng chưa xác thực không thể tạo bản ghi trực tiếp qua REST API `/api/appointments` của Payload; bắt buộc đi qua custom route kiểm soát. |
| **TC-ACL-03** | Role `editor` tin tức bị từ chối xem/tạo/sửa/xóa/xuất lịch khám | Unit / ACL | **PASS** | `hasModulePermission(editor, 'appointments', action)` trả về `false` cho cả 5 thao tác. |
| **TC-ACL-04** | Role `hr`, `finance`, `procurement` bị từ chối truy cập dữ liệu lịch khám | Unit / ACL | **PASS** | Ngăn chặn truy cập chéo vào PII người bệnh từ các phòng ban hành chính/tài chính/vật tư. |
| **TC-ACL-05** | Role `clinic-schedule` chỉ có quyền `view`/`create`/`edit`, không có quyền `delete` | Unit / ACL | **PASS** | Nhân sự điều phối phòng khám không thể xóa lịch hẹn. |
| **TC-ACL-06** | Chặn xuất Excel lịch hẹn đối với role không có thẩm quyền | Unit / ACL | **PASS** | Chỉ `board`, `department-manager` (thuộc khoa) và nhóm `admin` được phép `export`. |
| **TC-SEC-01** | Production thiếu `TURNSTILE_SECRET_KEY` phải **FAIL-CLOSED** | Unit / Security | **PASS** | Khi `NODE_ENV=production` và thiếu secret key, `verifyTurnstile` lập tức trả về `false`. |
| **TC-SEC-01B** | `MOCK_TURNSTILE=true` bị vô hiệu hóa triệt để trên `NODE_ENV=production` | Unit / Security | **PASS** | Ngăn chặn tuyệt đối rủi ro để quên biến môi trường test trên production. |
| **TC-SEC-02** | Token Turnstile rỗng, `null` hoặc quá dài ($> 4096$ ký tự) bị từ chối | Unit / Security | **PASS** | Chặn payload rác trước khi gọi tới máy chủ Cloudflare. |
| **TC-SEC-03** | Chế độ test hợp lệ với mock token được cho phép trong `NODE_ENV=test` | Unit / Security | **PASS** | Hỗ trợ kiểm thử tự động trong môi trường phát triển/CI. |
| **TC-ACL-07** | `department-manager` bị giới hạn phạm vi dữ liệu theo khoa (Khoa A vs Khoa B) | Unit / ACL | **PASS** | Quản lý Khoa A chỉ nhận filter `{ department: { equals: 10 } }`; quản lý chưa gán khoa bị từ chối (`false`). |
| **TC-ACL-08** | Khóa quyền lịch hẹn theo Deny-by-default và bảo vệ trường `department` khi update | Unit / ACL | **PASS** | User có custom permission nhưng thiếu `department` bị từ chối; Trưởng khoa không được sửa trường `department`. |
| **TC-ACL-09** | Kiểm soát quyền `create` và `delete` của `Appointments` theo khoa | Unit / ACL | **PASS** | Khoa A không thể tạo hoặc xóa lịch hẹn gán cho Khoa B. |
| **TC-ACL-10A** | Logic Access Control nội bộ: Phân lập đa khoa (Khoa A vs Khoa B) cho `read`, `create`, `update`, `delete`, `export` | Unit / ACL | **PASS** | Xác minh đầy đủ 5 thao tác độc lập giữa Khoa 10 và Khoa 20. |
| **TC-ACL-10B** | Kiểm thử thực tế qua REST API Payload bằng tài khoản thật Khoa A và Khoa B trên Staging | Integration / HTTP | **BLOCKED** | Chưa cấu hình `STAGING_API_URL` và tài khoản test `STAGING_USER_DEPT_A_*` / `STAGING_USER_DEPT_B_*` trên môi trường staging độc lập. |
| **TC-ACL-11** *(Mới)* | **Thu hồi phiên/quyền tức thời:** Khi user bị khóa (`locked`/`inactive`) hoặc đổi `role`/`department` trong DB, JWT cũ bị chặn ngay ở request kế tiếp | Regression / ACL | **PASS** | Xác minh `resolveAuthenticatedUser` và `getVerifiedActiveUser` luôn đọc trạng thái mới nhất từ DB, vô hiệu hóa ngay lập tức JWT cũ của tài khoản vừa bị khóa hoặc hạ quyền. |
| **TC-SEC-10** *(Mới)* | **Chống SQL Injection tại `/api/site-visits`:** Sử dụng Parameterized SQL (`sql` template) và kiểm tra `SLUG_PATTERN` | Regression / SQLi | **PASS** | Xác minh toàn bộ truy vấn trong `/api/site-visits` đã tham số hóa, loại bỏ hoàn toàn nối chuỗi trực tiếp `WHERE slug = '${slug}'`. |

---

### 2.2. Nhóm P1 — Rate Limit, Body Streaming, Concurrency, Khử khuẩn lỗi & Hardening (`scripts/test-p1-security.mjs`)

| Mã Test Case | Mô tả kịch bản kiểm thử | Phân loại | Kết quả | Chi tiết xác minh |
| :--- | :--- | :--- | :---: | :--- |
| **TC-SEC-06** | `clientAddress` ưu tiên header tin cậy (`cf-connecting-ip`, `x-real-ip`) và lọc bỏ ký tự độc hại | Unit / Security | **PASS** | Lọc bỏ chuỗi `<script>alert(1)</script>` trong `x-forwarded-for`. |
| **TC-SEC-05** | `rateLimit` chặn request khi vượt quá quota trong cửa sổ thời gian | Unit / Security | **PASS** | Trả về `allowed: false` và `retryAfter > 0` khi vượt ngưỡng. |
| **TC-SEC-05B** | Mỗi request chỉ tiêu thụ quota đúng 1 lần trên `/api/appointments` | Unit / Security | **PASS** | Xác nhận không đếm trùng quota trên cùng 1 request. |
| **TC-SEC-07** | `readJsonBodyWithLimit` chặn body vượt quá số byte cho phép (`413 Payload Too Large`) | Unit / DoS | **PASS** | Chặn payload JSON vượt ngưỡng dung lượng. |
| **TC-SEC-07B** | `readJsonBodyWithLimit` hủy stream (`reader.cancel()`) ngay khi vượt 25KB | Unit / DoS | **PASS** | Chống tấn công làm tràn bộ nhớ bằng chunked transfer encoding. |
| **TC-SEC-08** | `readJsonBodyWithLimit` xử lý an toàn JSON lỗi cú pháp (`400 Bad Request`) | Unit / Validation | **PASS** | Không làm crash route khi nhận JSON hỏng. |
| **TC-APPT-07** | Khi số thứ tự vượt quá `9999`, tiếp tục sinh `BVTL10000` mà không quay vòng về `1` | Unit / Data Integrity | **PASS** | Đảm bảo mã phiếu hẹn đơn điệu tăng dần, không va chạm lịch sử. |
| **TC-APPT-05** | Kiểm thử thuật toán Concurrency giải quyết va chạm mã với 20 luồng đồng thời | Unit / Concurrency | **PASS** | 20/20 luồng thành công với 20 mã duy nhất. |
| **TC-APPT-05A** | Kiểm thử Unique Constraint trên PostgreSQL thật với `TEST_DATABASE_URL` độc lập (20 requests đồng thời) | Integration / DB | **BLOCKED** *(khi chạy độc lập)* | Chặn an toàn khi chưa cấu hình `TEST_DATABASE_URL` trỏ tới PostgreSQL thử nghiệm độc lập (`VERIFIED_ISOLATED_TEST_DB=true`). |
| **TC-APPT-05B** | Integration test gửi HTTP request đồng thời tới `/api/appointments` trên Staging và đối chiếu DB | Integration / HTTP+DB | **BLOCKED** | Chưa cấu hình `STAGING_API_URL` và `TEST_DATABASE_URL` độc lập. |
| **TC-APPT-08** | Kiểm thử chuyển ngày mới (Rollover), đa Instance, Restart Server và độc lập Timezone của `appointment_code_seq` | Integration / DB | **BLOCKED** *(khi chạy độc lập)* | Yêu cầu `TEST_DATABASE_URL` trên PostgreSQL thử nghiệm độc lập. |
| **TC-MIG-081** | Kiểm thử Migration 081: Chạy lần đầu, chạy lại (idempotent) và không làm lùi sequence | Integration / DB | **BLOCKED** *(khi chạy độc lập)* | Yêu cầu `TEST_DATABASE_URL` trên PostgreSQL thử nghiệm độc lập. |
| **TC-SEC-09 / TC-PRIV-02** | Phản hồi lỗi 500 không để lộ `error.message` thô, câu lệnh SQL hay chuỗi kết nối | Unit / Privacy | **PASS** | Chỉ trả về thông báo thân thiện tiếng Việt kèm mã `errorId`. |
| **TC-SEC-09B** | `console.error` khử khuẩn PII (họ tên, SĐT) và mật khẩu DB (`[REDACTED]`) | Unit / Privacy | **PASS** | Ngăn rò rỉ thông tin người bệnh vào hệ thống log. |
| **TC-SEC-09C** | API `/api/appointments-export` không làm lộ `error.message` thô khi gặp lỗi 500 | Unit / Privacy | **PASS** | Ẩn chi tiết hạ tầng nội bộ khi lỗi xuất file. |
| **TC-PRIV-04** | API `/api/appointments` không làm lộ mã phiếu hẹn cũ hoặc thông tin người bệnh khi báo trùng lịch (`409`) | Static / Privacy | **PASS** | Không trả về `matchedDup.code`, `fullName` hay `appointmentDate` trong khối 409. |
| **TC-PRIV-05A** | Kiểm thử logic Rate Limit, Cooldown SĐT & phòng chống dò quét lịch hẹn | Unit / Privacy | **PASS** | Bảo vệ 4 lớp: Turnstile + IP Rate Limit + Phone Cooldown 30s + bộ 3 SĐT/Ngày/Khoa. |
| **TC-PRIV-05B** | Kiểm thử HTTP 409 và 429 thực tế qua kết nối mạng tới API Staging | Integration / HTTP | **BLOCKED** | Chưa cấu hình `STAGING_API_URL`. |
| **TC-LOG-01** | Log lỗi tại `/api/appointments` phân loại theo `errorCategory` an toàn | Static / Security | **PASS** | Không gọi `console.error(error)` thô. |
| **TC-DR-06** | `scripts/backup-railway.mjs` không chứa mật khẩu hay URL hardcoded | Static / Security | **PASS** | Đọc hoàn toàn từ biến môi trường `process.env`. |
| **TC-SEC-11** *(Mới)* | Các custom API (`/api/emergency-import`, `/api/ai-work-schedule-ocr`, `/api/work-schedule-history`) bắt buộc xác thực & phân quyền module | Regression / ACL | **PASS** | Xác minh cả 3 route đã dùng `getVerifiedActiveUser` và `hasModulePermission`. |
| **TC-SEC-12** *(Mới)* | Cấu hình SMTP TLS bật `rejectUnauthorized: true` mặc định và `Media.accessLevel` khóa quyền sửa | Regression / Hardening | **PASS** | Xác minh `payload.config.ts` và `src/collections/Media.ts`. |

---

## 3. MA TRẬN KIỂM ĐỊNH CÁC PHÂN HỆ NGHIỆP VỤ & GIAO DIỆN (MODULE VALIDATION MATRIX)

| Phân hệ nghiệp vụ | Route / Thành phần chính | Kiểm định Tĩnh / Build / Schema | Kiểm thử Runtime HTTP / UI | Trạng thái |
| :--- | :--- | :---: | :---: | :---: |
| **1. Trang chủ & Nhận diện (Site Shell & Homepage)** | `/`, `SiteHeader.tsx`, `SiteFooter.tsx`, `SiteSettings.ts`, `Homepage.ts`, `Navigation.ts` | `validate:site-shell` (14/14 PASS)<br>`validate:homepage-seo-search` (20/20 PASS)<br>`next build` (PASS) | Chờ chạy `smoke:production` trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |
| **2. Tin tức, Thông báo, Đấu thầu, Tuyển dụng, Góc cảnh báo** | `/tin-tuc`, `/thong-bao`, `/dau-thau-mua-sam`, `/tuyen-dung`, `/goc-canh-bao` | `validate:public-content` (21/21 PASS)<br>`validate:content-consistency` (PASS)<br>`next build` (PASS) | Chờ chạy `smoke:production` trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |
| **3. Khoa/Phòng, Chuyên khoa & Đội ngũ Bác sĩ** | `/khoa-phong`, `/chuyen-khoa`, `/bac-si`, `Departments.ts`, `Specialties.ts`, `Doctors.ts` | `validate:organization` (18/18 PASS)<br>`next build` (PASS) | Chờ chạy `smoke:production` trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |
| **4. Đặt lịch khám & Điều phối Lịch hẹn** | `/dat-lich-kham`, `/api/appointments`, `/api/appointments-export`, `Appointments.ts` | `test:security-p0` (15/15 PASS)<br>`test:security-p1` (17/17 PASS)<br>`next build` (PASS) | `TC-ACL-10B`, `TC-APPT-05B`, `TC-PRIV-05B` đang `BLOCKED` chờ `STAGING_API_URL` | **PASS (Code/Unit)** / **BLOCKED (Staging HTTP)** |
| **5. Lịch khám tuần, Lịch trực & Lịch công tác** | `/lich-kham`, `/lich-truc`, `/lich-lam-viec`, `/api/emergency-import`, `/api/ai-*-ocr`, `/api/work-schedule-history` | `TC-SEC-11` (PASS)<br>`validate:system-hardening` (31/31 PASS)<br>`next build` (PASS) | Chờ kiểm thử upload thực tế trên Staging/VPS | **PASS (Code/Unit)** / **BLOCKED (Staging HTTP)** |
| **6. Văn bản, Tài liệu & Phác đồ điều trị** | `/van-ban`, `/phac-do-dieu-tri`, `/api/document-access`, `/api/document-file`, `protectDocumentMedia.ts` | `validate:public-content` (PASS)<br>`next build` (PASS) | Chờ kiểm thử mở PDF / mã PIN trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |
| **7. Bảng giá dịch vụ & Tiêm chủng** | `/bang-gia`, `/tiem-chung`, `/api/services-import`, `Services.ts`, `ServicePrices.ts`, `Vaccines.ts` | `validate:patient-services` (17/17 PASS)<br>`next build` (PASS) | Chờ chạy `smoke:production` trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |
| **8. Khảo sát hài lòng, Góp ý, Hỏi đáp & Chatbot** | `/khao-sat/*`, `/gop-y`, `/hoi-dap`, `/bieu-mau/[slug]`, `/api/chatbot`, `/api/feedback`, `/api/surveys/*` | `validate:chatbot-forms-feedback` (22/22 PASS)<br>`validate:quality-surveys` (16/16 PASS)<br>`next build` (PASS) | Chờ chạy `smoke:production` trên Staging/VPS | **PASS (Code/Build)** / **BLOCKED (HTTP)** |

---

## 4. HƯỚNG DẪN ĐÓNG CÁC MỤC `BLOCKED` TRÊN MÔI TRƯỜNG STAGING / VPS MỚI

Để chuyển 6 mục `BLOCKED` sang `PASS` trên máy chủ VPS mới (hoặc môi trường PostgreSQL thử nghiệm độc lập) trước khi cắt chuyển DNS chính thức:

1. **Chạy kiểm thử tích hợp Database (`TC-APPT-05A`, `TC-APPT-08`, `TC-MIG-081`) và diễn tập Restore thực tế (`backup:restore-real`):**
   ```bash
   export TEST_DATABASE_URL="postgresql://hospital:<MAT_KHAU>@127.0.0.1:5432/benhvien_test"
   export TEST_ADMIN_DATABASE_URL="postgresql://hospital:<MAT_KHAU>@127.0.0.1:5432/postgres"
   export CONFIRM_TEST_INSTANCE="true"
   npm run test:security-p1
   npm run backup:restore-real
   ```
2. **Chạy kiểm thử tích hợp HTTP Staging (`TC-ACL-10B`, `TC-APPT-05B`, `TC-PRIV-05B`) và Smoke Test (`smoke:production`):**
   ```bash
   export STAGING_API_URL="http://127.0.0.1:3000"
   export SMOKE_BASE_URL="http://127.0.0.1:3000"
   npm run smoke:production
   npm run test:security
   ```

