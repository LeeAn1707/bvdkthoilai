# CHANGELOG

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
