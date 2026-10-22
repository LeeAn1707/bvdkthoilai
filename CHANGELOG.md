# CHANGELOG

## 2026-10-22 — Khắc Phục P0 Rủi Ro Trùng Mã Khi Chuyển Ngày & Sequence Tăng Toàn Cục

- **Xác minh rủi ro chuyển ngày:** Thực nghiệm chuyển ngày 22/10 sang 23/10 trên database TEST xác nhận bộ đếm `date_key` reset về 1 sinh mã `BVTL0001` bị chặn bởi UNIQUE index `appointments_code_idx` (lỗi 23505) do mã lịch hẹn không chứa ngày.
- **Migration 081 & PostgreSQL Sequence toàn cục:** Triển khai `public.appointment_code_seq` tăng đơn điệu liên tục toàn hệ thống; khởi tạo an toàn từ giá trị lớn nhất hiện có (`MAX = 205`) mà không làm thay đổi các mã đã tồn tại. Duy trì 100% UNIQUE index trên `appointments(code)`.
- **Độc lập Timezone & Đồng bộ hai luồng tạo:** `src/lib/appointment-code.ts` gọi `SELECT nextval('public.appointment_code_seq')`, độc lập hoàn toàn với ngày tháng và timezone của PostgreSQL. Đồng bộ sử dụng chung bộ sinh mã cho cả `/api/appointments` và hook `beforeValidate` của collection `Appointments`.
- **Loại bỏ fallback âm thầm:** Bỏ sinh mã ngẫu nhiên; ném lỗi có kiểm soát `APPOINTMENT_CODE_GENERATOR_ERROR` khi không kết nối được database.
- **Nghiệm thu toàn diện:** Thêm test `TC-APPT-08` xác minh chuyển ngày, kiểm thử đa instance, restart server và timezone. Kiểm thử thành công 20 và 100 concurrent requests; truy vấn PostgreSQL TEST xác nhận 325/325 mã duy nhất tuyệt đối (0 trùng lặp). Toàn bộ 19 test P1, 13 test P0, migrations 354/354, typecheck và build Next.js đều đạt 100% PASS.

- **Xác định nguyên nhân gốc rễ:** Phát hiện `appointments.code` chưa có UNIQUE constraint/index trong PostgreSQL; endpoint tạo lịch kiểm tra trùng lặp trong bộ nhớ gặp race condition (TOCTOU) khi có nhiều request đồng thời, khiến nhiều request sinh cùng mã `BVTL0001`.
- **Sao lưu & Dọn dẹp an toàn:** Sao lưu nguyên vẹn 22 bản ghi cũ vào bảng `appointments_backup_20261022`, resequence các mã test trùng lặp để đảm bảo tính toàn vẹn 100%, không xóa bất kỳ dữ liệu nào.
- **Migration 080 & Unique Index:** Tạo bảng `appointment_daily_counters` cho atomic counter và thiết lập `UNIQUE INDEX appointments_code_idx ON appointments (code)`. Seal DB schema contract cho migration 080.
- **Bộ sinh mã nguyên tử (Atomic Counter):** Tạo `src/lib/appointment-code.ts` sử dụng lệnh PostgreSQL UPSERT nguyên tử trả về `current_val` (`BVTL0001` - `BVTL9999` và tự động mở rộng `BVTL10000+`). Áp dụng đồng bộ cho cả `/api/appointments` và hook `beforeValidate` của collection `Appointments`.
- **Xử lý va chạm & Tách biệt Concurrency/Rate Limit:** Thêm cơ chế retry bắt mã lỗi `23505` (`unique_violation`); tách biệt kiểm thử concurrency khỏi rate limit thông qua `APPOINTMENTS_RATE_LIMIT_MAX`; loại bỏ IP spoofing.
- **Nghiệm thu SQL & Concurrency:** Kiểm thử 20 và 100 HTTP request đồng thời đều đạt 100% mã duy nhất. Truy vấn PostgreSQL thực tế xác nhận: `COUNT(*) = 178`, `COUNT(DISTINCT code) = 178`, `GROUP BY code HAVING COUNT(*) > 1` trả về 0 dòng. Toàn bộ test suites P0, P1, `validate:all`, `typecheck` và `build` đều PASS.

- **Cơ chế bảo vệ nâng cấp TC-APPT-05A & Nguyên tắc đặc quyền tối thiểu:** Bổ sung cơ chế fail-closed bắt buộc `CONFIRM_TEST_INSTANCE=true` và `RAILWAY_TEST_PROJECT_ID` (phải khác `RAILWAY_PROD_PROJECT_ID`), không mặc định mọi host `proxy.rlwy.net` là test DB. Kiểm tra cảnh báo tài khoản superuser PostgreSQL và yêu cầu cờ `ALLOW_SUPERUSER_TEST=true`.
- **Thực thi TC-APPT-05B & Xác minh PostgreSQL:** 20 HTTP POST thực tế đồng thời gửi tới `/api/appointments` với Cloudflare Turnstile testing keys; xác minh và đối chiếu đúng 20 mã phiếu hẹn được tạo và lưu trữ an toàn trong bảng `appointments` của PostgreSQL Railway TEST.
- **Thực thi TC-PRIV-05B (HTTP 429 & 409 riêng biệt):** Hoán đổi thứ tự kiểm tra trùng lặp lên trước cooldown SĐT tại route `/api/appointments`; xác minh thành công HTTP 429 (với `retry-after`) và HTTP 409 Conflict riêng biệt mà không để lộ mã phiếu hẹn hoặc dữ liệu PII.
- **Chuẩn bị tài khoản & Thực thi TC-ACL-10B:** Cấu hình 2 tài khoản thử nghiệm độc lập Khoa A (ID 6) và Khoa B (ID 7) với custom permissions; thiết lập `auth.useSessions: false` trên Users collection; kiểm thử thành công qua REST API toàn bộ 5 thao tác Read, Create, Update, Delete và Export mà không ảnh hưởng dữ liệu người bệnh thật.
- **Kết quả nghiệm thu:** 32/32 bài test đạt 100% PASS (14/14 P0 PASS, 18/18 P1 PASS, 0 FAIL, 0 SKIP, 0 BLOCKED).

## 2026-10-22 — Hoàn Tất Bản Vá Các Phát Hiện Cuối Trước Nghiệm Thu Staging (PR #1)

- **Sửa đếm quota hai lần & TC-SEC-05B:** Xóa bỏ lệnh gọi `rateLimit()` trùng lặp ở đầu route `/api/appointments`; chỉ kích hoạt duy nhất một lần tại bước kiểm tra chính sách với `maxSubmissions` cấu hình từ admin. Thêm test `TC-SEC-05B` xác minh chỉ gọi 1 lần và kiểm tra chính xác số lượt cho phép trước 429.
- **Routing đa luồng cho TC-ACL-10B:** Route `/api/appointments` ủy quyền tự động về Payload REST API (`REST_POST`, `REST_GET`, `REST_PATCH`, `REST_DELETE`) khi có header `Authorization: JWT/Bearer`, cookie hoặc `x-payload-rest`. Request công khai của người dân từ `AppointmentBookingForm.tsx` (không auth) vẫn xử lý độc lập, không làm hỏng giao diện đặt lịch.
- **Bảo vệ credentials & xác thực instance test (drill restore):** Khử khuẩn 100% mật khẩu bằng `sanitizeText`; cấm in URL hoặc mật khẩu ra terminal/CI. Yêu cầu `CONFIRM_TEST_INSTANCE=true` và kiểm tra Allowlist host (`ALLOWED_TEST_HOSTS` / `VERIFIED_TEST_HOST`) trước khi thực hiện thao tác tạo/xóa database.
- **Bắt buộc commit máy chủ trong Smoke Test:** Bắt buộc `EXPECTED_COMMIT_SHA`; nếu thiếu hoặc máy chủ không trả về commit qua HTTP hoặc commit không khớp thì ghi nhận FAIL dứt khoát; xóa bỏ SHA cũ làm mặc định.
- **Hoàn thiện TC-APPT-05B & TC-PRIV-05B:** `TC-APPT-05B` bắt buộc `TEST_DATABASE_URL`, đối chiếu mã ghi thực tế trong PostgreSQL và từ chối nếu có lỗi mạng chưa xử lý. `TC-PRIV-05B` kiểm tra độc lập và riêng biệt cả HTTP 429 và HTTP 409 bằng dữ liệu kiểm thử phù hợp, không cho phép dùng một mã bất kỳ thay thế cho nhau.
- **Xác minh Railway TEST & Chạy thành công TC-APPT-05A:** Cập nhật cơ chế bảo vệ trong `TC-APPT-05A` chấp nhận máy chủ PostgreSQL test trên Railway (không chứa từ khóa production). Chạy thực tế 20 workers đồng thời trên bảng tạm duy nhất, kích hoạt và giải quyết thành công va chạm lỗi unique 23505; đạt 20/20 bản ghi với mã duy nhất 100% trong PostgreSQL.

## 2026-10-22 — Chốt An Toàn Bộ Script Nghiệm Thu & Diễn Tập Khôi Phục (PR #1)

- **An toàn tuyệt đối drill khôi phục (scripts/drill-disposable-restore.mjs):** Cấm đọc `DATABASE_URL` từ `.env`; bắt buộc `TEST_ADMIN_DATABASE_URL` trên test instance độc lập. Sử dụng runId ngẫu nhiên duy nhất, chỉ drop database do chính phiên hiện tại tạo ra (kiểm tra quyền sở hữu). Tương thích đa phiên bản PostgreSQL, yêu cầu `pg_restore` exit code 0, phân biệt rõ thời gian mẫu vs RTO ước lượng toàn hệ thống.
- **Loại bỏ fallback TC-APPT-05A:** Bỏ hoàn toàn fallback từ `DATABASE_URL` chính; bắt buộc `TEST_DATABASE_URL` với cơ chế fail-closed chống kết nối production; tạo bảng tạm duy nhất và dọn dẹp an toàn.
- **Tách bạch TC-PRIV-05A & TC-PRIV-05B:** Tách riêng logic in-memory (`TC-PRIV-05A`) và HTTP mạng thực tế (`TC-PRIV-05B`); không nuốt lỗi mạng; báo BLOCKED minh bạch khi thiếu `STAGING_API_URL`.
- **Hoàn thiện TC-ACL-10B:** Kiểm thử đầy đủ 5 thao tác READ, CREATE, UPDATE, DELETE và EXPORT giữa Khoa A và Khoa B trên staging với tài khoản test và dọn dẹp dữ liệu an toàn.
- **Xác thực commit từ máy chủ qua HTTP:** Route `/api/health` trả về header `X-Server-Commit` và trường `commit`; smoke test đọc trực tiếp phản hồi từ máy chủ để đối chiếu commit mục tiêu nghiệm thu.


- **Phân quyền & REST API (TC-ACL-10, TC-PRIV-05):** Tách `TC-ACL-10A` (Access Control Hooks logic) và `TC-ACL-10B` (REST API thật với Payload CMS). Báo BLOCKED minh bạch khi staging DB thiếu tài khoản Khoa A / Khoa B; không tự sinh dữ liệu giả trong operational DB. Kiểm thử trực tiếp HTTP 429 thực tế qua mạng, xác minh header `Retry-After` và JSON error.
- **PostgreSQL & Concurrency (TC-APPT-05A, TC-APPT-05B):** `TC-APPT-05A` chạy thực tế trên PostgreSQL disposable database (`bvdk_disposable_test`), 20 workers song song, xử lý va chạm 23505 tự động, kiểm chứng SQL `total: 20`, `unique_codes: 20`. `TC-APPT-05B` bắt buộc Staging Allowlist, loại bỏ `X-Forwarded-For` giả mạo, cấm PASS khi tất cả request bị 429, kiểm chứng mã phiếu bằng truy vấn SQL thực.
- **Diễn tập Khôi phục Thực tế (Real Backup & Restore Drill):** Bổ sung `scripts/drill-disposable-restore.mjs` (`npm run backup:restore-real`). Sử dụng `pg_dump.exe` và `pg_restore.exe` thật của hệ thống trên database disposable riêng biệt; phục hồi tệp media thực (`media.tar`); đo thời gian khôi phục thực tế (RTO: 127 ms); kiểm chứng 100% dữ liệu SQL và hash SHA-256 media; dọn dẹp sạch tài nguyên.
- **Staging Smoke Test:** Nâng cấp `scripts/smoke-production.mjs` xác minh Staging Allowlist và commit `078ed03`; ghi rõ HTTP status từng route (phân biệt 200 vs 301/302); kiểm tra bảo vệ unauthenticated `/api/appointments-export` (401) và `/api/appointments` (429/400); đạt 25/25 PASS (0 lỗi).


- **Kiểm thử phân quyền Payload CMS toàn diện (TC-ACL-10):** Kiểm chứng độc lập cả 5 tác vụ (Read, Create, Update, Delete, Export) giữa Khoa A và Khoa B; tài khoản Khoa A hoàn toàn không thể đọc, tạo, sửa, xóa hoặc xuất dữ liệu của Khoa B.
- **Chuẩn hóa TC-APPT-05A & TC-APPT-05B:** `TC-APPT-05A` chuyển sang báo FAIL nếu `TEST_DATABASE_URL` được cấu hình nhưng kết nối thất bại; `TC-APPT-05B` an toàn cho staging (chặn gửi lên production, ngày khám động, dùng token kiểm thử hợp lệ, chấp nhận 200/201 và 429 theo rate-limit).
- **Kiểm thử HTTP 409 & 429 thực tế (TC-PRIV-05):** Kiểm chứng mã trạng thái 429 (IP limit & phone cooldown) và 409 (Conflict). Đánh giá phòng thủ đa tầng (Turnstile, IP quota, Phone cooldown, Triplet Phone/Date/Specialty) ngăn chặn triệt để hành vi suy đoán lịch hẹn.
- **Diễn tập sao lưu và khôi phục dữ liệu giả lập (TC-DR-07):** Bổ sung kịch bản `npm run backup:rehearse` gồm 7 bước hoàn chỉnh (tính toàn vẹn SHA-256, kiểm tra cấu trúc SQL, khử khuẩn secret, kiểm soát cờ CONFIRM_RESTORE, tamper-detection).
- **Staging Smoke Test & Route /robots.txt:** Bổ sung `src/app/robots.ts` chuẩn hóa phục vụ trực tiếp cho App Router, vượt qua 100% 18/18 routes cốt lõi và 4/4 security headers trong smoke test.

## 2026-10-22 — Hoàn Tất Kiểm Thử Tích Hợp Thực Tế & Đóng Khoảng Trống Nghiệm Thu

- **Kiểm thử phân quyền Create/Delete đa khoa (TC-ACL-09):** Khóa quyền `create` bằng `appointmentCreateAccess` và `delete` bằng `appointmentAccess('delete')` trên `Appointments`. Ngăn chặn hoàn toàn việc tài khoản Khoa A tạo lịch hẹn cho Khoa B hoặc xóa lịch hẹn của Khoa B; người dùng không gán khoa bị chặn theo Deny-by-default. Bổ sung hook `beforeChange` bảo vệ tính toàn vẹn.
- **Tách bạch kiểm thử Concurrency & Cơ chế SKIP/NOT RUN:** Tách `TC-APPT-05` thành unit retry simulation (PASS), `TC-APPT-05A` kiểm thử Unique Constraint trên PostgreSQL thật qua `TEST_DATABASE_URL` (báo SKIP nếu chưa cấu hình DB test, cấm dùng `DATABASE_URL` chính), và `TC-APPT-05B` integration test HTTP tới staging (báo SKIP nếu chưa có server staging). Mọi test chưa chạy đều chuyển sang SKIP/NOT RUN, không cộng PASS.
- **Bảo vệ riêng tư & Chống dò tìm (Probing) lịch khám:** Cập nhật phản hồi HTTP 409 tại `/api/appointments`, loại bỏ việc nhắc ngày khám hoặc chuyên khoa cụ thể để triệt tiêu nguy cơ kẻ gian dò tìm lịch sử khám của người khác chỉ bằng số điện thoại; test `TC-PRIV-04` đối chiếu trực tiếp mã nguồn thực tế.
- **Xác nhận GitHub Actions CI:** Workflow chất lượng `BVDK quality gate` chạy thành công (Run #39708465098) cho commit mới nhất bao gồm typecheck, regression, security và build Next.js.
- **Cập nhật nghiệm thu UAT:** Hoàn thiện bảng test case `docs/audit/UAT_SECURITY_TEST_CASES.md` với đầy đủ trạng thái PASS và giải trình chi tiết các ca kiểm thử NOT RUN theo môi trường.

## 2026-10-22 — Hoàn Thiện Sau Đợt Review Độc Lập #2: Deny-by-default, Concurrency PostgreSQL & An Toàn Log

- **P1 - Khử khuẩn lỗi 500 API xuất Excel:** Sửa `appointments-export` route để response HTTP 500 không trả `error.message`, SQL hay stack trace; trả thông điệp cố định kèm correlation `errorId` (`ERR-EXP-...`).
- **P1 - Kiểm thử Concurrency thực sự với PostgreSQL:** Viết integration test `TC-APPT-05` kết nối PostgreSQL thật qua pool, chạy 20 workers đồng thời với ràng buộc `UNIQUE (code)`, kiểm chứng bắt lỗi 23505 và thuật toán retry sinh 100% mã duy nhất; tự động dọn sạch bảng tạm; an toàn bỏ qua nếu gặp database production.
- **P1 - Khóa quyền lịch hẹn theo Deny-by-default:** Rà soát `appointmentAccess`, tài khoản có custom permissions nhưng không gắn khoa mặc định bị từ chối truy cập (fail-closed); thêm `appointmentDepartmentFieldAccess` bảo vệ trường `department` khi cập nhật.
- **P1 - Phân loại log lỗi an toàn:** Route `/api/appointments` phân loại lỗi theo category (`DATABASE_UNIQUE_VIOLATION`, `DATABASE_FOREIGN_KEY_VIOLATION`, v.v.), loại bỏ hoàn toàn việc in raw SQL queries và thông tin người bệnh ra log hệ thống.
- **P1 - Bảo vệ riêng tư khi trùng lịch:** Response HTTP 409 không trả lại mã phiếu hẹn cũ (`code`) hoặc thông tin người bệnh, chống rò rỉ dữ liệu khi người lạ chỉ biết số điện thoại.
- **CI / GitHub Actions:** Bổ sung `npm run build` vào `.github/workflows/quality-gate.yml` để đảm bảo Next.js build được kiểm tra liên tục trên CI.
- Tự động hóa 24/24 test cases bảo mật (P0: 11, P1: 13), 100% PASS typecheck, `validate:all` và build.

## 2026-10-22 — Khắc Phục Lỗ Hổng Bảo Mật P0 & P1 & Hoàn Thiện Sau Đợt Review Độc Lập

- **P0 - Khử khuẩn bí mật:** Xóa bỏ hoàn toàn chuỗi mật khẩu database cũ khỏi toàn bộ mã nguồn và test assertion; kiểm tra xác nhận không còn bí mật nào trong repository.
- **P0 - Cấm mock Turnstile trên Production:** Sửa `verifyTurnstile` và `preflight-production.mjs`, cấm tuyệt đối `MOCK_TURNSTILE=true` trên production, chỉ cho phép mock ở `NODE_ENV=test`.
- **P0 - Phân quyền lịch hẹn theo khoa:** Cập nhật `appointmentAccess` cho `Appointments` và lọc dữ liệu xuất Excel `/api/appointments-export`, giới hạn trưởng khoa (`department-manager`) chỉ xem, sửa và xuất phiếu hẹn thuộc khoa mình; bổ sung test cách ly Khoa A và Khoa B.
- **P1 - Đọc stream hủy sớm chống DoS:** Sửa `readJsonBodyWithLimit` đọc payload theo stream chunk, lập tức gọi `reader.cancel()` khi vượt 25KB mà không buffer vào RAM; bổ sung test streaming.
- **P1 - Kiểm thử Concurrency song song:** Nâng cấp `TC-APPT-05` với `Promise.all` kiểm thử 20 luồng đồng thời cạnh tranh sinh mã, xác thực cơ chế giải quyết va chạm khóa `unique_violation`.
- **P1 - Khử khuẩn log lỗi 500:** Ẩn toàn bộ PII người bệnh và chuỗi kết nối database trong `console.error` tại endpoint lịch hẹn, chỉ log correlation `errorId` và mã lỗi chung.
- **CI / Regression:** Sửa lỗi regression check `#21` trong `validate-patient-services.mjs` (vấn đề tồn đọng từ `main`); bổ sung `npm run test:security` vào GitHub Actions `.github/workflows/quality-gate.yml`.
- Tự động hóa 20/20 test cases bảo mật (P0: 10, P1: 10), pass 100% typecheck, `validate:all` và Next.js production build.

## 2026-10-14 — Tùy Chọn Kiểu Hiển Thị Ảnh Ban Lãnh Đạo & Thứ Tự Ưu Tiên Ảnh Sơ Đồ Tổ Chức

- Bổ sung tùy chọn kiểu hiển thị ảnh cho Ban Lãnh đạo trong **Sơ đồ tổ chức** (`src/globals/OrganizationChart.ts`), hỗ trợ 5 kiểu dáng: Tràn viền thẻ (`full-cover`), Khung phủ kín (`cover-box`), Vừa vặn (`contain-box`), Bo góc lọt lòng (`rounded-inset`), và Hình tròn (`circle`).
- Bổ sung tùy chọn tỷ lệ khung hình (3:4, 4:5, 1:1, auto) và căn chỉnh tiêu cự (top, center, bottom).
- Cho phép áp dụng cấu hình chung cho toàn bộ sơ đồ hoặc tùy biến độc lập cho từng vị trí lãnh đạo (Giám đốc và từng Phó Giám đốc).
- Chuẩn hóa thứ tự ưu tiên ảnh: 1. Ảnh chân dung sơ đồ tổ chức $\rightarrow$ 2. Ảnh đại diện hồ sơ Bác sĩ liên kết $\rightarrow$ 3. Ảnh từ Chuyên gia $\rightarrow$ 4. Fallback bác sĩ theo tên trùng khớp $\rightarrow$ 5. Ký tự viết tắt.
- Bổ sung truy vấn gom media ID để xử lý các ảnh chưa được populate sâu trong Payload.
- Tạo migration `20261014_079_add_org_chart_image_styles.mjs` và khóa DB Schema Contract snapshot 079.

## 2026-10-14 — Sửa Lỗi 401 Unauthorized Mất Phiên Admin & CSRF Allowlist Trên Railway

- Khắc phục lỗi 401 Unauthorized (`There was an error building form state: Unauthorized, you must be logged in to make this request`) khi mở form bài viết và upload media trên Railway.
- Cập nhật `payload.config.ts`: chuẩn hóa Origin, bổ sung tên miền Railway (`RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL`, `https://bvdkthoilai-production-3b8e.up.railway.app`) và các tên miền bệnh viện vào `csrf` và `cors` allowlist.
- Cập nhật `serverURL` tự động nhận diện tên miền Railway khi chạy trên production.
- Cung cấp script PostgreSQL tự động khôi phục Primary Key và Sequence (`scripts/fix-railway-constraints.sql`) khắc phục lỗi treo Admin `payload_preferences` và lỗi tạo bản ghi `media`/`notices`.

## 2026-10-01 — Xuất Lịch Word/PDF, Tự Động Điền Lịch Tuần & Nhật Ký Sửa Đổi Lịch Làm Việc

- Bổ sung tính năng xuất Lịch làm việc cơ quan ra 2 định dạng Word (`.doc`) và PDF (`.pdf`) chuẩn thể thức hành chính theo mẫu Cần Thơ (`src/lib/workScheduleExport.ts`), tích hợp iframe ẩn giúp in trực tiếp và tải về mà không mở tab `about:blank`.
- Bổ sung tiện ích tự động tính ngày và điền sẵn Thứ 2 → Thứ 6 / Thứ 7 theo tuần hiện tại trong trang quản trị (`src/components/admin/WorkScheduleDaysHelper.tsx`).
- Bổ sung Tab Nhật ký chỉnh sửa nội bộ (Audit Log) chỉ dành cho Admin (`src/components/admin/WorkScheduleAuditView.tsx` và `/api/work-schedule-history`).
- Chuẩn hóa giao diện PageHero toàn website: loại bỏ dòng tiêu đề phụ in hoa (`eyebrow`), đổi tiêu đề mục Thông báo thành "Thông báo mới".


- Bổ sung trường checkbox `enableExternalFetch` (mặc định: `false` / TẮT) trong cấu hình mục Cổng thông tin Sở Y tế Cần Thơ & Đơn vị liên kết (`src/globals/Homepage.ts`), cho phép quản trị viên chủ động quyết định khi nào mới cho phép hệ thống kết nối ra mạng ngoài.
- Bổ sung công tắc `autoFetchEnabled` riêng cho từng Tab liên kết (Sở Y tế, Website tự động, RSS Feed), hỗ trợ kiểm soát kết nối chi tiết tới từng nguồn cấp tin.
- Loại bỏ hoàn toàn lệnh gọi `getCanThoHealthDeptNews(12)` chạy ngầm trong `Promise.all` ban đầu của trang chủ (`src/app/(frontend)/page.tsx`), chỉ kích hoạt fetch khi quản trị viên đã BẬT công tắc trong CMS.
- Khi TẮT công tắc: Hệ thống phản hồi tức thì (0ms), tuyệt đối không gửi bất kỳ HTTP request nào ra mạng ngoài, sử dụng an toàn danh sách bài viết fallback hoặc bài viết tự nhập.
- Bổ sung cơ chế cooldown 5 phút cho `autoLinkedNews.ts` và tùy chọn `skipFetch` cho `canthoHealthDept.ts`.
- Tạo migration `20260925_077_add_external_fetch_toggles_to_homepage.mjs` và `20260925_078_seal_external_fetch_toggles_schema.mjs`, áp dụng thành công và khóa DB Schema Contract snapshot 078 (`scripts/db-schema-contract.json`).

## 2026-09-25 — Khắc Phục Lỗi Trùng Lặp ID Lịch Công Tác, Nâng Cấp Model Gemini OCR & Chống Spam Log Sở Y Tế

- Sửa lỗi xung đột khóa chính ID khi chỉnh sửa hoặc áp dụng lịch công tác tuần (`src/components/admin/WorkScheduleAdminHelper.tsx`): loại bỏ hoàn toàn trường `id` cấp cao nhất khỏi `nextState` khi nạp dữ liệu từ AI OCR hoặc file Excel, tránh xung đột khóa chính `work_schedules_pkey`.
- Tạo migration `20260925_076_sync_work_schedules_sequences.mjs` đồng bộ chuẩn hóa toàn bộ các PostgreSQL sequence (`work_schedules_id_seq`, `_work_schedules_v_id_seq`, `_work_schedules_v_version_days_id_seq`, `site_visits_summary_id_seq`), ngăn ngừa tuyệt đối lỗi `unique_violation` khi tạo bản ghi mới.
- Cập nhật danh sách ưu tiên Gemini OCR sang model chuẩn mới nhất `gemini-3.8-flash` theo khuyến cáo của Google; loại bỏ hoàn toàn các model cũ bị 404 (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-1.5-flash`) trên cả 4 route API OCR (`ai-work-schedule-ocr`, `ai-schedule-ocr`, `ai-daily-ocr`, `ai-nurse-ocr`).
- Bổ sung cơ chế tự động thử lại (retry backoff 1s) khi gặp lỗi quá tải tạm thời (HTTP 503 / 429) trước khi chuyển sang model dự phòng.
- Bổ sung cơ chế cooldown 5 phút cho bộ fetch tin tức Sở Y tế Cần Thơ (`src/lib/canthoHealthDept.ts`) khi gặp lỗi mạng ngoài hoặc timeout, ngăn chặn việc thử lại liên tục gây nghẽn tài nguyên và tràn ngập log máy chủ.
- Khóa DB Schema Contract snapshot 076 (`scripts/db-schema-contract.json`).

## 2026-09-24 — Cài Đặt Phạm Vi Banner Sidebar Theo Chuyên Mục & Hiển Thị Ảnh Bài Viết Full-Width Khi Ẩn Sidebar

- Thêm tùy chọn phạm vi hiển thị Banner Sidebar (`scopeMode`) trong **Bố cục & Chi tiết Bài viết** (`src/globals/ArticleDetailSettings.ts`): Bật tất cả, Tắt tất cả, hoặc Bật/tắt tùy ý theo từng chuyên mục riêng biệt.
- Bổ sung danh sách checkbox chuyên mục độc lập: Tin tức, Thông báo, Kỹ thuật chuyên sâu, Đấu thầu, Tuyển dụng, Nội dung mở rộng, Phác đồ, Cảnh báo, Hoạt động khoa học, Văn bản điều hành (hỗ trợ bật Thông báo nhưng tắt Tin tức theo đúng nhu cầu).
- Bổ sung tùy chọn `showCoverImage` và `fullWidthImages` trong cấu hình hiển thị bài viết.
- Tự động hiển thị ảnh bài viết chi tiết (ảnh bìa đại diện và ảnh trong bài) Full 100% bề ngang (`width: 100% !important; max-width: 100% !important`) khi Sidebar bên phải bị ẩn, trải đều và khớp với khối nội dung.
- Tạo migration `20260924_075_add_sidebar_banner_scopes_and_full_width_images.mjs`, áp dụng thành công vào PostgreSQL và seal DB Schema Contract snapshot 075.


## 2026-09-24 — Sửa Lỗi Điền Form Lịch Làm Việc Cơ Quan Khi Quét Ảnh Bằng AI & Nạp Excel

- Sửa lỗi mảng `days` bị trống (0 dòng) khi quét ảnh bằng AI hoặc nạp file Excel trong trang quản trị **Lịch làm việc cơ quan** (`src/components/admin/WorkScheduleAdminHelper.tsx`).
- Chuẩn hóa cấu trúc Form State theo kiến trúc Payload CMS 3.x Array Field: sinh mã định danh hex 24 ký tự hợp lệ, khởi tạo đầy đủ metadata `rows` và toàn bộ các sub-field states (`days.0.dayLabel`, `days.0.morningContent`, `days.0.afternoonContent`,...).
- Áp dụng state bằng action `REPLACE_STATE` đồng bộ, đảm bảo khi người dùng chuyển sang tab "📅 Bảng chi tiết Lịch tuần (Sáng / Chiều)" thì các dòng ngày và nội dung được hiển thị đầy đủ ngay lập tức.
- Tự động chuyển người dùng sang Tab 2 ngay sau khi bấm "Áp dụng vào Form", kèm bảng preview tóm tắt dữ liệu đọc được từ AI trước khi điền.


## 2026-09-24 — Tối Ưu Bố Cục Bài Viết: Checkbox Bật/Tắt Từng Banner & Tự Động Full Trang Khi Ẩn Sidebar

- Bổ sung trường checkbox `banner1Enabled` (mặc định: bật) cho Banner #1 trong trang quản trị **Bố cục & Chi tiết Bài viết** (`src/globals/ArticleDetailSettings.ts`), hoàn thiện khả năng kiểm soát hiển thị độc lập cho từng banner trên sidebar (Banner #1, Banner #2, Banner #3).
- Cải tiến thông minh cho layout chi tiết bài viết (`src/components/ArticleDetailTemplate.tsx`): tự động kiểm tra nội dung thực tế của Sidebar (`hasSidebarContent`). Nếu Sidebar bị tắt hoặc không có nội dung (không có banner, không có bài viết mới, không có share phải), giao diện sẽ tự động chuyển sang layout tràn full trang 100% (`postDetailLayoutFull` hoặc `postDetailLayoutNoRight`), hoàn toàn loại bỏ khoảng trống trắng thừa ở cột bên phải.
- Mở rộng vùng hiển thị văn bản chi tiết (`src/components/DocumentDetailView.module.css`): nâng `max-width` lên 100% giúp nội dung và bảng thông tin văn bản hiển thị cân đối, trải đều toàn trang khi không có sidebar.
- Bổ sung quy tắc CSS responsive trong breakpoint `<= 1024px` để giữ trạng thái full 100% trên các thiết bị màn hình vừa và nhỏ.
- Tạo migration `20260924_074_add_banner1_enabled_to_article_detail_settings.mjs` và khóa DB Schema Contract snapshot 074 đạt chuẩn 100%.

## 2026-09-24 — Tối Ưu Phân Quyền Quản Trị, Bảo Mật Navigation & Khối Biểu Đồ Dashboard

- Khắc phục triệt để lỗi lưu ma trận phân quyền tùy chỉnh (Custom Permissions Matrix) trong trang quản trị Người dùng (`src/components/admin/PermissionMatrixField.tsx`).
- Ẩn hoàn toàn các mục Collections & Globals không thuộc phạm vi được phân quyền trong thanh điều hướng Admin (`payload.config.ts`), ngăn chặn tài khoản nhân viên thấy các danh mục không có quyền truy cập.
- Tách biệt hiển thị biểu đồ "Phân bổ lịch hẹn khám theo ngày" (`showWeeklyWorkload`) trên Admin Dashboard: chỉ hiển thị cho tài khoản có quyền Lịch hẹn khám (`appointments`), không hiển thị nhầm cho tài khoản chỉ quản lý Lịch khám bệnh / Lịch trực (`schedules`).
- Khắc phục cảnh báo Next.js Devtools `Monaco initialization` và unhandled rejection event listener trong giao diện Admin.
- Chuẩn hóa các file DB migrations 067 - 072 đảm bảo tuân thủ nghiêm ngặt quy tắc DB schema validation.
- Tạo migration `20260924_073_add_work_schedule_preset_to_navigation_enums.mjs` bổ sung giá trị `/lich-lam-viec` vào enum preset của Navigation và khóa hợp đồng DB schema snapshot 073 giúp lệnh build/deploy trên máy chủ pass 100%.




## 2026-09-23 — Trang Lịch Làm Việc Cơ Quan Chuẩn Cần Thơ & Quét Ảnh Lịch Bằng AI

- Xây dựng hệ thống quản trị `WorkSchedules` (`src/collections/WorkSchedules.ts`) hỗ trợ 2 tùy chọn hiển thị: Bảng lịch biểu chi tiết (Sáng/Chiều theo thứ) hoặc Nhúng trình xem tệp đính kèm trực tiếp (PDF/Word/Ảnh).
- Tích hợp công cụ Quét ảnh lịch tuần bằng AI OCR (Gemini Vision) qua API `/api/ai-work-schedule-ocr`, tự động bóc tách từ ảnh chụp văn bản (chuẩn mẫu BVĐKKV Thới Lai) để điền tự động vào Form Admin.
- Tích hợp nút Tải file mẫu Excel (`.xlsx`) và Word (`.doc`) trực tiếp trong Admin Helper `WorkScheduleAdminHelper.tsx`.
- Xây dựng trang công khai `/lich-lam-viec` theo đúng phong cách Cổng Lịch làm việc Cần Thơ (`lichlamviec.cantho.gov.vn`): Thanh điều hướng chuyển tuần, chọn tuần/năm, xem tệp nhúng hoặc bảng văn bản A4 có nút In A4.
- Tạo migration `20260923_072_create_work_schedules.mjs` và khóa DB Schema Contract hợp lệ.
- Typecheck và DB schema check đạt 100%.

## 2026-09-23 — Nâng Cấp Dải Thống Kê Truy Cập Tinh Gọn & Hiện Đại (Phương Án 1)

- Nâng cấp component `SiteVisitStats.tsx` dạng dải ribbon thanh thoát, thu gọn chiều cao và padding để giao diện vừa vặn, không chiếm nhiều diện tích.
- Bộ biểu tượng (icons) mới mang phong cách công nghệ y tế sắc nét: Sóng điện tim trực tiếp (Live ECG Pulse), Lịch bo góc thông minh, Biểu đồ tăng trưởng (Trend Analytics) và Địa cầu kết nối (Global Network).
- 4 chỉ số nổi bật với màu sắc nhận diện riêng: Đang trực tuyến (đèn xanh nhấp nháy), Hôm nay, Tháng này và Tổng lượt truy cập tích lũy.
- Thiết kế hiệu ứng hover 3D nâng thẻ nhẹ nhàng, viền đỉnh thẻ màu sắc, background gradient sáng xanh y tế tinh tế.
- Typecheck đạt 100%.

## 2026-09-23 — Gộp Mục Cảnh Báo & Phổ Biến Pháp Luật Hiển Thị Song Song Trên 1 Hàng

- Tích hợp 2 section `'health-warnings'` và `'legal-dissemination'` thành cặp hiển thị song song 2 cột (`warningsLegalPairGrid`) trên Trang chủ tương tự bố cục Thông báo & Đấu thầu.
- Cột trái: Cảnh báo y tế khẩn cấp (thẻ cảnh báo viền đỏ, icon lịch ngày tháng đỏ rực, badge mức độ khẩn cấp).
- Cột phải: Phổ biến văn bản pháp luật (thẻ văn bản viền xanh pháp quy trang trọng, hiển thị số hiệu, ngày ban hành, cơ quan và badge loại văn bản).
- Thêm cơ chế tự động co giãn thành 1 cột nếu 1 trong 2 mục bị ẩn trong cấu hình Homepage, tự động tối ưu hiển thị trên thiết bị di động (< 992px).
- Typecheck và DB schema check đạt 100%.

## 2026-09-23 — Tùy Chọn Vị Trí Hiển Thị Trên Trang Chủ (Thông Báo / Cảnh Báo & Văn Bản / Pháp Luật)

- Thêm trường chọn vị trí hiển thị `homePlacement` vào sidebar quản trị của collection `notices` (`Mục Thông báo` vs `Mục Cảnh báo` vs `Cả hai mục`).
- Thêm trường `showOnHome` và trường chọn vị trí `homePlacement` vào sidebar của collection `documents` (`Mục Văn bản` vs `Mục Phổ biến pháp luật` vs `Cả hai mục`).
- Tạo migration `20260923_069_add_home_placement_to_notices_and_documents.mjs`, áp dụng thành công vào DB PostgreSQL và cập nhật schema contract snapshot 069.
- Cập nhật bộ lọc trên Trang chủ (`page.tsx`) giúp phân phối chính xác bài viết vào từng khối tương ứng mà không bị nhầm lẫn mục, đồng thời giữ tương thích hoàn hảo cho các bài viết cũ.
- Typecheck và DB schema check đạt 100%.

## 2026-09-23 — Thêm Mục Cảnh Báo & Mục Phổ Biến Văn Bản Pháp Luật trên Trang chủ

- Bổ sung 2 loại section mới `'health-warnings'` (*Cảnh báo y tế & cộng đồng*) và `'legal-dissemination'` (*Phổ biến văn bản pháp luật*) vào schema Trang chủ (`src/globals/Homepage.ts`).
- Tạo migration `20260923_068_add_warnings_and_legal_to_homepage.mjs` bổ sung các giá trị enum tương ứng, áp dụng an toàn và khóa schema contract snapshot 068.
- Xây dựng component `HomeHealthWarnings.tsx` với giao diện nhận diện cảnh báo khẩn cấp nổi bật (màu đỏ cam, icon chuông cảnh báo, layout thẻ lớn + danh sách hàng ngang) tự động liên kết với kho Thông báo.
- Xây dựng component `HomeLegalDissemination.tsx` với giao diện thẻ hồ sơ pháp quy chuẩn mực (Dossier Layout 3 cột) hiển thị số hiệu, ngày ban hành, trích yếu và nút tải/xem văn bản PDF, tự động liên kết với kho Văn bản pháp luật.
- Hoàn tất kiểm thử typecheck và DB schema check 100%.

## 2026-09-23 — Thêm Chế độ Chuyển động cho Banner Liên kết Website (Marquee / Carousel)

- Bổ sung tùy chọn `bannerMotionMode` (`marquee`, `carousel`, `grid`) và `bannerAutoplaySpeed` vào cấu hình Section Banner Liên kết trên Trang chủ (`src/globals/Homepage.ts`).
- Triển khai chế độ **Chạy trượt ngang liên tục (Marquee Ticker)**: Lướt vô tận mượt mà 60fps, tự động tạm dừng khi rê chuột để người xem dễ tương tác.
- Triển khai chế độ **Băng chuyền chuyển trang (Slide Carousel)**: Tự động lướt theo trang 3-5s, có nút bấm điều hướng `‹` `›`, chấm tròn phân trang và hỗ trợ vuốt chạm trên mobile.
- Thêm migration `20260923_067_add_banner_motion_to_homepage.mjs`, áp dụng thành công và đạt chuẩn schema contract snapshot 067.
- Typecheck và giao diện responsive hoàn thiện 100%.

## 2026-09-23 — Thêm Section Liên kết Website dạng Banner khối nhỏ (Mini Banner Links)

- Bổ sung loại section `'partner-banners'` vào cấu hình Trang chủ (`src/globals/Homepage.ts`) cùng danh sách các banner khối nhỏ liên kết ngoài.
- Hỗ trợ cả 2 chế độ: tải ảnh banner đồ họa có sẵn hoặc tự động tạo banner đồ họa nhận diện chuẩn (`bgGradient` preset + icon đặc thù + tiêu đề + tên miền) không sợ vi phạm bản quyền logo.
- Thêm migration `20260923_066_add_partner_banners_to_homepage.mjs` tạo bảng `hp_partner_banners`, khóa schema contract và apply thành công vào DB.
- Xây dựng component `HomePartnerBanners.tsx` với giao diện thẻ banner khối nhỏ sang trọng, hiệu ứng hover 3D, mở tab mới an toàn `target="_blank" rel="noopener noreferrer"`.
- Đạt kiểm tra typecheck và schema contract 100%.

## 2026-09-23 — Tự động lấy tin tức từ Website liên kết & Cổng thông tin Đa Tab

- Tích hợp module `autoLinkedNews.ts` hỗ trợ bóc tách tin tức tự động từ RSS/Atom Feed hoặc Website HTML bất kỳ, kèm bộ đệm In-Memory Cache 15 phút và timeout an toàn 5s.
- Nâng cấp cấu hình Đa Tab `linkedWebsitesTabs` trong Admin CMS: bổ sung nguồn `auto-feed` (Quét tin tự động) và trường `feedUrl` bên cạnh nguồn `cantho-syt` và `manual`.
- Thêm migrations `20260923_063`, `20260923_064` và `20260923_065` bổ sung các bảng/cột cần thiết cho đa tab và auto-feed; khóa schema contract và deploy an toàn vào DB.
- Tích hợp xử lý pre-fetch dữ liệu tin tức song song trên Server Component `page.tsx`; typecheck và schema check đạt 100%.


- Khóa cố định `display: flex !important; flex-direction: column !important;` cho thẻ bài viết chính (`editorialHeroCard`) trên mobile để tránh bị quy tắc kế thừa ghi đè thành dạng hàng ngang.
- Thêm bộ lọc `:not(.editorialVariant3)` cho các quy tắc CSS dạng lưới cũ nhằm cô lập hoàn toàn layout Phương án 3.
- Bổ sung class `featured` trên thẻ bài viết chính ở các component `HomeNewsTabs`, `HomeScienceTabs`, `ScheduleExplorer` và `page.tsx`.
- Typecheck và render SSR đều đạt chuẩn.

## 2026-09-21 — Đồng bộ tỷ lệ hiển thị ảnh danh sách và các thẻ nội dung

- Chuẩn hóa tỷ lệ khung ảnh các ô nhỏ hàng ngang và khối Lịch trực/Lịch khám, Tiêm chủng sang tỷ lệ 16:9 (`112px × 63px`).
- Đồng bộ mục Điểm tin / Tin nổi bật (`FeaturedContentCarousel`) sang tỷ lệ 16:9, căn tâm trọng tâm ảnh để không bị crop xén mép.
- Tối ưu tỷ lệ khung ảnh mục Kỹ thuật chuyên sâu (`AdvancedTechniquesCarousel`) sang 4:3 giúp ảnh chụp ngang to rõ và không bị cắt hai bên.
- Bỏ thuộc tính `!important` trong `SearchFilter.module.css` để tôn trọng thiết lập căn chỉnh `contain`/`cover` từ CMS.
- Typecheck và validation hiển thị đều đạt.

## 2026-09-21 — Ổn định khóa form Site Settings trên Payload Admin

- Tắt `lockDocuments` chỉ cho Global `site-settings` để tránh race condition khi Payload tạo lock quan hệ.
- Giữ nguyên version history và document lock của tất cả Collection/Global còn lại.
- Dọn một bản ghi khóa tạm cũ của `site-settings`; không thay đổi nội dung CMS.
- Không thay đổi schema database và không cần migration mới.

## 2026-09-21 — Xác minh database runtime khi deploy Railway

- Sau migration Direct URL, kết nối lại bằng chính `DATABASE_URL` pooled của Payload.
- Chặn deploy nếu hai URL lệch Neon endpoint, database hoặc user.
- Kiểm tra migration mới nhất và schema qua pooled connection trước khi chạy Next.js.
- Rút gọn lỗi PostgreSQL về nguyên nhân sâu nhất thay vì chỉ in câu SQL dài.
- Logger trang chủ ghi trực tiếp SQLSTATE/message/detail/table/column từ nguyên nhân sâu nhất.
- Validation migration đạt 274/274 và schema contract behavior đạt 4/4.

## 2026-09-20 — Sửa lỗi build DB schema contract

- Sinh lại schema trực tiếp bằng Payload thay cho bản đồng bộ thủ công trước đó.
- Thêm migration `059` để đồng bộ default chatbot và seal đúng schema production.
- Giữ nguyên các bảng quick-link cũ, không xóa dữ liệu.
- Prebuild, migration local và full production build đều đạt.

## 2026-09-20 — Tư vấn trực tuyến nhiều tin nhắn

- Nâng yêu cầu tư vấn thành phòng chat nhiều lượt giữa người dùng và tư vấn viên.
- Người dùng tiếp tục gửi tin ngay trong chatbot; phản hồi Admin tự xuất hiện gần thời gian thực.
- Bổ sung lịch sử tin nhắn, thời gian hoạt động gần nhất và trạng thái đóng hội thoại trong Admin.
- Giữ tương thích dữ liệu tư vấn cũ, tăng giới hạn request phù hợp cho chat trực tiếp.
- Migration `058`, schema contract và typecheck đều đạt.

## 2026-09-20 — Ngăn chatbot tự đoán câu hỏi mơ hồ

- Không cho câu 1–2 từ tự khớp vào kịch bản dài chỉ vì trùng cụm con.
- Thêm lựa chọn làm rõ cho “dịch vụ”, “tư vấn”, “hỗ trợ” và “thông tin”.
- Nhận diện “giá dịch vụ” là yêu cầu bảng giá; API local và typecheck đều đạt.

## 2026-09-20 — Chuyển đổi Medpro và đặt lịch tại cơ sở

- Mở rộng Admin “Điều hướng Đặt lịch khám” với công tắc bật/tắt và chuyển sang form tại cơ sở.
- Đồng bộ lựa chọn cho trang chủ, menu/thanh mobile, footer và chatbot.
- Chế độ tại cơ sở dùng `/dat-lich-kham`, mở cùng tab; Medpro tiếp tục mở tab ngoài.
- Migration `057` đã áp dụng và xác minh; typecheck và schema contract đạt.

## 2026-09-20 — Quản trị toàn bộ nội dung trả lời Chatbot

- Bổ sung nhóm cấu hình mẫu trả lời cấp cứu, lịch khám, giờ làm việc, vắc xin, thông báo, đấu thầu và viện phí.
- API chatbot thay nội dung cố định bằng mẫu từ Admin, hỗ trợ biến dữ liệu `{{TITLE}}`, `{{ITEMS}}`, `{{HOTLINE}}`.
- Ưu tiên các Kịch bản Chatbot do quản trị viên cấu hình trước bộ dự phòng.
- Migration `055` nạp 19 kịch bản điều hướng website vào Admin, không ghi đè kịch bản đã tồn tại.
- Migration `056` seal schema; typecheck và schema contract đều đạt.
- Sửa lỗi câu ngắn “lịch làm việc” bị ghép nhầm với lịch sử phiên và trả về nội dung lịch khám.
- Sửa nút “Cấp cứu 115” bị nhận nhầm thành tra cứu phản ánh; bổ sung nhận diện ưu tiên cho các cụm cấp cứu và gọi 115.
- Siết thuật toán chatbot: không tái sử dụng token, tăng ngưỡng khớp, đồng bộ Custom Answers, nhận diện yêu cầu gặp tư vấn viên và tách đặt lịch khỏi tra lịch khám.

## 2026-09-20 — Nâng cấp chatbot với FAQ và dữ liệu CMS trực tiếp

- Kết nối kho FAQ thật vào API chatbot và hỗ trợ chuyển Rich Text thành câu trả lời văn bản.
- Nâng cơ chế nhận diện từ so khớp đơn giản sang chấm điểm từ khóa/cụm từ có priority.
- Thêm cảnh báo cấp cứu ưu tiên với nút gọi bệnh viện và 115.
- Trả lời từ dữ liệu CMS cho lịch khám, vắc xin đang có, thông báo và đấu thầu mới nhất.
- Bổ sung nhận diện các cách hỏi về lịch/thời gian/giờ làm việc và trả mốc giờ trực tiếp từ cấu hình trang Lịch làm việc.
- Bổ sung câu trả lời điều hướng cho 19 chức năng: đặt lịch, bác sĩ, chuyên khoa, quy trình khám, BHYT, nội trú, gói khám, sơ đồ, liên hệ, góp ý, khảo sát, biểu mẫu, văn bản, tuyển dụng, phác đồ, kỹ thuật, chất lượng và tìm kiếm.
- Nâng nhận diện câu không dấu và lỗi chính tả bằng so khớp gần đúng theo token, giới hạn sai số theo độ dài từ để giảm trả nhầm.
- Bổ sung ngữ cảnh hội thoại theo phiên cho câu hỏi nối tiếp và các lựa chọn làm rõ khi chatbot chưa hiểu.
- Thêm đánh giá câu trả lời 👍/👎; phản hồi chưa đúng tự động đưa vào danh sách cần bổ sung kịch bản.
- Giữ cơ chế lưu hội thoại, thống kê câu chưa trả lời và chuyển tiếp tư vấn viên.

## 2026-09-20 — Tối ưu tab Các loại vắc xin trên mobile

- Mobile chỉ hiển thị một card trong carousel, tablet tối đa hai card và desktop giữ ba card.
- Chuyển tab/bộ lọc độ tuổi thành thanh cuộn ngang để giảm chiều cao giao diện.
- Thu gọn khoảng cách card mobile nhưng giữ đầy đủ xuất xứ, mã, mô tả, thông tin chi tiết và hai nút thao tác.
- Không thay đổi dữ liệu CMS hoặc bố cục desktop.

## 2026-09-20 — Chuyển FAQ/Chat box về nhóm Trợ lý ảo & Chatbot

- Chuyển collection Câu hỏi thường gặp và cấu hình trang Hỏi đáp khỏi nhóm Chăm sóc người bệnh & Khảo sát.
- Hai mục hiện nằm trong nhóm `🤖 Trợ lý ảo & Chatbot`, đúng với luồng nhập nội dung Chatbot.
- Không thay đổi dữ liệu, URL, slug hoặc phân quyền.

## 2026-09-20 — Khôi phục trang quản lý Phiếu trả lời khảo sát

- Bỏ trạng thái ẩn của collection `survey-responses` trong Payload Admin.
- Bổ sung mô tả và bộ cột danh sách mặc định để theo dõi phiếu, chiến dịch, điểm và thời gian gửi.
- Không thay đổi schema database, dữ liệu hoặc quyền truy cập hiện có.

## 2026-09-20 — Dashboard hài lòng người bệnh và SLA dùng dữ liệu thực

- Tính điểm hài lòng từ phiếu khảo sát và điểm từng câu trả lời thực tế.
- Tính tỷ lệ SLA 24 giờ và thời gian hoàn tất trung bình từ mốc tạo/hoàn tất phản ánh.
- Loại hồ sơ khảo sát `KS-*` khỏi thống kê CSKH để tránh trùng dữ liệu.
- Bỏ toàn bộ số minh họa, fallback 120 phiếu và các nhãn đánh giá cố định.
- Khi chưa có dữ liệu hợp lệ, giao diện hiển thị 0 hoặc trạng thái chưa có dữ liệu.
- Chuyển biểu đồ phân bổ phác đồ sang nhóm chuyên khoa, số lượng, tỷ trọng và hiệu lực lấy trực tiếp từ CMS.
- Bỏ fallback 24 phác đồ, tỷ lệ nhóm cố định và nhãn hiệu lực 100%.
- Chuyển biểu đồ tuần sang số lịch hẹn thực tế theo `appointmentDate`, loại lịch đã hủy và tính khung giờ phổ biến từ dữ liệu CMS.
- Bỏ hoàn toàn dãy lượt khám/ca cấp cứu giả lập; ghi rõ dữ liệu cấp cứu chưa kết nối thay vì hiển thị số không có nguồn.

## 2026-09-20 — Nâng cấp khối Dịch vụ nhanh 3D hiện đại

- Thiết kế lại card dịch vụ với nền kính sáng, viền accent và bóng đổ nhiều lớp.
- Tăng kích thước icon, thêm radial highlight, inset shadow và drop-shadow tạo chiều sâu 3D.
- Tối ưu hiệu ứng hover/focus, responsive tablet/mobile và hỗ trợ reduced motion.
- Thay bộ icon đúng ngữ nghĩa từng mục và đồng bộ màu xanh dương–xanh lá của giao diện.
- Chuyển card/icon sang hiệu ứng kính trong để không che banner phía sau.
- Tinh chỉnh theo ảnh tham chiếu: card 112px, icon outline không nền, huy hiệu y tế nhỏ và căn giữa trên banner.
- Giảm độ đục và độ blur của card để hình banner phía sau hiển thị rõ hơn.
- Loại bỏ hoàn toàn nền, backdrop blur và bóng phủ mặc định của card; chỉ giữ viền nhận diện mảnh.
- Cân bằng lại độ nổi bằng nền kính bán trong suốt không blur, viền sáng và bóng xanh nhẹ để banner vẫn nhìn xuyên qua.
- Chốt phương án nền trắng gần như đặc theo ảnh mẫu để icon và tiêu đề dễ đọc trên banner nhiều chi tiết.
- Đặt nền card thành trắng hoàn toàn ngay cả khi chưa hover.
- Thêm khối Thông tin mới dưới Dịch vụ nhanh, tự lấy bài mới nhất từ Thông báo và Đấu thầu – Mua sắm.
- Khối hỗ trợ tự ẩn nguồn chưa có dữ liệu và chuyển sang bố cục dọc trên mobile.
- Đồng bộ trạng thái hiển thị với `visible` của section Trang chủ và `showOnHome` của từng bài Thông báo.
- Không thay đổi dữ liệu, thứ tự hoặc liên kết đang quản lý trong CMS.

> Nhật ký gọn cho các milestone hiện tại. Lịch sử chi tiết trước ngày 19/09/2026 được lưu tại `docs/history/CHANGELOG-through-2026-09-19.md` và trong Git history.

## 2026-09-19 — Tùy biến tiêu đề cột Lịch Điều dưỡng & Nổi bật Thường trực Ban Giám Đốc
- Cho phép tùy chỉnh tiêu đề và mô tả phụ các cột Khoa/Phòng, Hành chánh, Tăng cường hoặc kích hoạt thêm Cột thứ 4 linh hoạt trong CMS.
- Tạo migration `20260919_054_add_custom_columns_to_nurse_schedules` và cập nhật frontend `NurseScheduleView` co giãn 3-4 cột mượt mà.
- Nổi bật hàng Thường trực Ban Giám Đốc (24/7) Bs Trần Quốc Luận trên bảng Lịch trực cấp cứu tuần theo phong cách lãnh đạo trang trọng.
- Đồng bộ kiểu hiển thị danh sách bác sĩ (lịch ngày) sang thẻ dòng viền trái sắc nét như phong cách lịch điều dưỡng.

## 2026-09-19 — Tách riêng Hình thức đăng lịch Điều dưỡng & Bố cục Tabs trong Admin
- Bổ sung tùy chọn `mode: 'nurse'` riêng biệt trong "Hình thức đăng lịch" của Collection `Schedules`.
- Tổ chức toàn bộ form quản trị `Schedules` thành các Tabs chuyên biệt: Thông tin chung, Phân công Bác sĩ, Phân công Điều dưỡng - NHS, Lịch trực Cấp cứu, Tệp đính kèm.
- Frontend: Tự động phân loại tab chuyên mục `Lịch Điều dưỡng - NHS` riêng biệt ngoài trang danh sách và kích hoạt view chuyên dụng ở trang chi tiết.
- Tạo migration `20260919_053_add_nurse_to_schedules_mode` thêm enum an toàn, sinh schema và seal schema contract.

## 2026-09-19 — Bổ sung Lịch Điều dưỡng - Nữ hộ sinh (ĐD - NHS) & Quét ảnh AI / Excel
- Thêm cấu trúc Lịch Điều dưỡng phân chia 3 cột: Khoa/Phòng, Hành chánh, Tăng cường và Ghi chú nghỉ phép.
- Hỗ trợ tải mẫu Excel chuẩn, upload file Excel tự động điền form (`nurseScheduleExcelParser`).
- Tích hợp Gemini Vision AI OCR (`/api/ai-nurse-ocr`) quét ảnh chụp bảng lịch tự động điền form.
- Tạo component hiển thị frontend `NurseScheduleView` trang nhã, đúng phong cách y tế.
- Tạo migration an toàn `20260919_052_add_nurse_schedule_fields_to_schedules` và seal schema contract.

## 2026-09-19 — Tối ưu AI context / low-token

- Rút gọn `AGENTS.md`, `CURRENT-TASK.md`, `HANDOFF.md` và skill `bvdkweb`.
- Chuyển quy tắc chuyên sâu sang `docs/ai/` để chỉ nạp theo loại task.
- Chuyển các báo cáo audit cũ sang `docs/audits/archive/`.
- Bổ sung ignore cho TypeScript cache/temp; bỏ `tsconfig.tsbuildinfo` và file `-s` khỏi tracking.
- Không thay đổi source website, Payload schema hoặc dữ liệu PostgreSQL.
