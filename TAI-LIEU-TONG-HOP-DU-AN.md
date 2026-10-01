# TỔNG HỢP TÀI LIỆU DỰ ÁN BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI

Tài liệu này hợp nhất 60 file Markdown rời của dự án đến phiên bản
v4.4.3. Nội dung từng tài liệu được giữ nguyên và phân cách theo tên
file nguồn.
----------
#câu lệnh kiểm tra audit

Đọc toàn bộ file AUDIT_PROJECT.md và bắt đầu kiểm tra toàn bộ dự án theo đúng quy trình trong file.

Hiện tại chỉ AUDIT READ-ONLY.
Không sửa code.
Không thay đổi database.
Không chạy migration.
Sau khi hoàn tất hãy tạo FULL_PROJECT_AUDIT.md.
#Khi audit vòng đầu xong, tôi khuyên dùng tiếp:
Đọc AUDIT_PROJECT.md và FULL_PROJECT_AUDIT.md.

Thực hiện audit vòng 2 độc lập.
Kiểm chứng lại toàn bộ P0/P1.
Tìm false positive.
Tìm lỗi vòng 1 bỏ sót.
Không sửa code.

Tạo SECOND_AUDIT.md.

------------------------------------------------------------------------

## 1. ADMIN-FIX-V3.1.1.md

> Nguồn: `ADMIN-FIX-V3.1.1.md`

# V3.1.1 --- Admin Fix trên đúng bản V3.1 đang chạy

Bản này được sửa trực tiếp từ ZIP
`thoi-lai-hospital-v3.1-professional-fixed.zip`.

## Không thay kiến trúc frontend đang chạy

-   Giữ nguyên route.
-   Giữ tương thích dữ liệu Menu cũ có field `url`.
-   Không reset database.
-   Không đổi tên collection.

## Admin đã nâng cấp

-   Giao diện Payload bật Tiếng Việt.
-   Trang chủ / Menu website / Cấu hình website: mọi user đã đăng nhập
    Admin đều mở và chỉnh được.
-   User mới mặc định role `admin`.
-   Slug tự sinh từ Tiêu đề; Bác sĩ và Khoa/Phòng tự sinh từ Tên.
-   Rich Text:
    -   đậm / nghiêng / gạch chân / gạch ngang
    -   heading
    -   căn trái / giữa / phải / căn đều (feature mặc định Payload)
    -   danh sách / checklist / thụt lề / link / upload
    -   toolbar cố định
    -   bảng
    -   cỡ chữ 12--36
    -   màu chữ / nền chữ
-   Tệp đính kèm cho Tin tức, Thông báo, Đấu thầu và Trang nội dung.
-   Media hỗ trợ ảnh, PDF, Word, Excel, PowerPoint, TXT, ZIP, RAR.
-   Menu website giữ URL cũ và bổ sung:
    -   Trang có sẵn
    -   Chọn trực tiếp bài viết/nội dung
    -   Liên kết tùy chỉnh
    -   Menu con
    -   Mở tab mới

## Cập nhật
## sao luu csdl raiway
Tôi đã tích hợp sẵn lệnh backup trực tiếp vào dự án. Mỗi khi muốn tạo một bản sao lưu mới từ Railway, bạn chỉ cần mở terminal tại thư mục dự án và gõ: npm run backup:railway

Copy `.env` hiện tại sang project rồi chạy:

``` powershell
npm install
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run dev
```
# chay lệnh này để cập nhật database
npm run db:migrate:deploy 

Không cần chạy seed nếu database hiện tại đã có dữ liệu. Không cần DROP
database.

------------------------------------------------------------------------

## 2. ADMIN-IMPORTMAP-FIX.md

> Nguồn: `ADMIN-IMPORTMAP-FIX.md`

# Admin import map fix

The previous package contained a placeholder `importMap.js`. Payload
Admin requires this file to be generated from the real Payload config. A
placeholder or stale map causes errors such as:

`PayloadComponent not found in importMap: @payloadcms/next/rsc#CollectionCards`

This package now: - explicitly configures `admin.importMap.baseDir` -
explicitly configures `admin.importMap.importMapFile` - removes the
placeholder import map - uses `payload build` for production builds,
which generates Payload types/import map before Next build - provides
`npm run clean:payload`

After copying your private `.env`:

``` powershell
npm install
npm run clean:payload
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run dev
```

Before opening `/admin`, verify that:
`src/app/(payload)/admin/importMap.js` exists and is not an empty `{}`
map.

------------------------------------------------------------------------

## 3. ADMIN-LOGIN-RECOVERY.md

> Nguồn: `ADMIN-LOGIN-RECOVERY.md`

# Admin login recovery v4.2.8

Bản này khôi phục luồng đăng nhập Payload về cơ chế mặc định ổn định:

-   Users dùng `auth: true`, không có `beforeLogin`/`afterLogin` custom
    hook.
-   Users không bị bọc audit collection hook.
-   Development không đặt `serverURL` tuyệt đối, Admin gọi API cùng
    origin bằng URL tương đối.
-   CORS/CSRF vẫn cho phép localhost và 127.0.0.1 ở development.
-   CSP development cho phép kết nối localhost/127.0.0.1 để tránh
    `Failed to fetch`.

Sau khi nâng cấp phải xóa `.next` và cookie/site data của localhost
trước khi đăng nhập lại.

------------------------------------------------------------------------

## 4. ADMIN-REDESIGN-V3.2.0.md

> Nguồn: `ADMIN-REDESIGN-V3.2.0.md`

# Bản nâng cấp Admin V3.2.3

## Nội dung đã thực hiện

-   Thiết kế lại thanh điều hướng Admin theo phong cách xanh đậm hiện
    đại, tương phản cao và dễ phân nhóm.
-   Sửa đúng bộ chọn CSS `collections__*` của Payload 3.88 để các thẻ Hệ
    thống, Nội dung, Đấu thầu, Tổ chức, Khám bệnh và CSKH thực sự đổi
    giao diện.
-   Thêm thẻ tài khoản ở thanh bên: họ tên, vai trò, trạng thái hoạt
    động và nút mở website.
-   Nâng cấp dashboard thành trung tâm điều hành với thống kê nội dung,
    phản hồi, đấu thầu, lịch khám, tư vấn và thao tác nhanh.
-   Thêm thanh trạng thái hệ thống, ngày hiện tại, tỷ lệ tin đã xuất bản
    và số dịch vụ đang quản lý.
-   Làm mới bảng dữ liệu, biểu mẫu, ô nhập liệu, nút thao tác, hộp thoại
    và vùng soạn thảo.
-   Sửa nút đăng xuất để dùng trực tiếp cơ chế xác thực của Payload CMS;
    có trạng thái đang xử lý và báo lỗi.
-   Sửa lỗi `Không xác định (unknown error)` khi xóa Tin tức hoặc nội
    dung đã có phiên bản/menu tham chiếu: tự gỡ liên kết menu và sửa đầy
    đủ ràng buộc quan hệ, bảng con, lịch sử phiên bản PostgreSQL.
-   Tương thích PostgreSQL 11: tắt riêng `schedulePublish` vốn gọi hàm
    `jsonb_path_exists` chỉ có từ PostgreSQL 12; vẫn giữ bản nháp, tự
    lưu, lịch sử phiên bản và xuất bản thủ công.
-   Đồng bộ lại `package-lock.json`, import map và kiểu dữ liệu Payload.
-   Sửa lỗi kiểu dữ liệu tại trang Sơ đồ tổ chức và cấu hình Media không
    còn tương thích Payload 3.88.

## Cách cập nhật trên Windows

1.  Sao lưu thư mục dự án và cơ sở dữ liệu PostgreSQL đang sử dụng.
2.  Giải nén bản V3.2.0 vào một thư mục mới.
3.  Sao chép tệp `.env` cũ sang thư mục mới; không ghi đè bằng
    `.env.example`.
4.  Mở PowerShell tại thư mục dự án và chạy:

``` powershell
npm install
npm run repair:delete
npm run dev
```

5.  Mở `http://localhost:3000/admin`, đăng nhập và kiểm tra nút **Đăng
    xuất tài khoản**.

Lệnh `npm run repair:delete` dùng để sửa các ràng buộc cơ sở dữ liệu cũ
từng làm thao tác xóa trong Admin bị lỗi. Bản này cũng tự chạy kiểm tra
khi dùng `npm run dev` hoặc `npm start`. Nếu website đang mở lúc cập
nhật, hãy dừng rồi chạy lại để bản sửa được áp dụng.

## Kết quả kiểm tra

-   `npm run typecheck`: đạt.
-   `npm run build`: đạt với Next.js 16.3.2.
-   Import map chứa đầy đủ các thành phần Admin mới.

------------------------------------------------------------------------

## 5. BVCANTHO-INSPIRED-UPDATE.md

> Nguồn: `BVCANTHO-INSPIRED-UPDATE.md`

# Cập nhật giao diện cổng thông tin bệnh viện

Trang chủ được tổ chức lại theo mô hình cổng thông tin bệnh viện, tham
khảo cách phân nhóm nội dung của Bệnh viện Đa khoa Thành phố Cần Thơ.

## Các khối nội dung trên trang chủ

-   Hoạt động nổi bật tại bệnh viện
-   Trang tin tức bệnh viện theo chuyên mục
-   Đơn vị trực thuộc và đội ngũ bác sĩ
-   Thông báo mới
-   Đấu thầu -- Mua sắm
-   Lịch khám bệnh
-   Hoạt động khoa học
-   Giới thiệu, số liệu nổi bật và văn bản mới

Tất cả nội dung tiếp tục lấy từ các mục quản trị hiện có. Bản cập nhật
không tạo collection hoặc cột database mới.

## Banner mặc định

Banner bệnh viện được lưu tại `public/banners/banner-benh-vien.png`. Nếu
ảnh tải từ Admin bị lỗi đường dẫn, trang chủ tự dùng ảnh này.

------------------------------------------------------------------------

## 6. FIX-V4.2.1-SLUGFIELD-RUNTIME.md

> Nguồn: `FIX-V4.2.1-SLUGFIELD-RUNTIME.md`

# v4.2.1 - Payload slugField runtime fix

Fix lỗi `MissingFieldType: Field "slugField"` khi Payload sanitize
config.

Nguyên nhân: `slugField` trong `src/fields/common.ts` là factory
function trả về một Payload Field, nhưng ba collection mới đã truyền
trực tiếp function vào `fields` thay vì gọi function.

Đã sửa: - `src/collections/Forms.ts`: `slugField` -\>
`slugField('title')` - `src/collections/SurveyTemplates.ts`: `slugField`
-\> `slugField('title')` - `src/collections/SurveyCampaigns.ts`:
`slugField` -\> `slugField('title')`

Không thay schema slug, không xóa dữ liệu, không cần migration chỉ vì
bản sửa này.

------------------------------------------------------------------------

## 7. FIX-V4.2.4-CONTENT-IMAGES.md

> Nguồn: `FIX-V4.2.4-CONTENT-IMAGES.md`

# v4.2.4 -- Sửa hiển thị ảnh danh sách và trang chi tiết

-   Danh sách Tin tức/Thông báo/Đấu thầu/Tuyển dụng dùng ảnh gốc thay
    cho derivative thumb để tránh ảnh cũ sinh sai kích thước.
-   Khung ảnh card cố định 16:9 và luôn crop cover, không kéo méo.
-   Trang chi tiết Tin tức và Tuyển dụng nay hiển thị ảnh đại diện
    (trước đây bị thiếu).
-   Trang chi tiết Thông báo và Đấu thầu dùng ảnh gốc, không phụ thuộc
    derivative article.
-   Ảnh chi tiết đặt trong khung responsive và dùng contain để nhìn đủ
    ảnh, không méo.
-   Ảnh mặc định cấu hình trong Admin cũng dùng file gốc để tương thích
    media cũ.

------------------------------------------------------------------------

## 8. FIX-V4.2.5-QUICKLINKS-ADMIN-MEDIA.md

> Nguồn: `FIX-V4.2.5-QUICKLINKS-ADMIN-MEDIA.md`

# v4.2.5 - Dịch vụ nhanh quản lý hoàn toàn từ Admin

-   Homepage \> Dịch vụ nhanh cho phép thêm/xóa/kéo-thả/ẩn-hiện từng
    mục.
-   Tăng tối đa từ 8 lên 12 mục.
-   Mỗi mục chọn icon có sẵn hoặc tải/chọn hình riêng từ Media.
-   Hình riêng hỗ trợ contain/cover.
-   Hỗ trợ mở tab mới.
-   Frontend tự bỏ các mục visible=false và dùng dữ liệu Admin; fallback
    chỉ dùng khi mảng chưa có dữ liệu.

------------------------------------------------------------------------

## 9. HUONG-DAN-BAN-CAP-NHAT.md

> Nguồn: `HUONG-DAN-BAN-CAP-NHAT.md`

# Hướng dẫn bản cập nhật

## Khởi động

1.  Giữ nguyên tệp `.env` đang kết nối được PostgreSQL.
2.  Chạy `npm install` nếu máy chưa có thư mục `node_modules`.
3.  Chạy `npm run clean:payload` để xóa cache giao diện Admin cũ.
4.  Chạy `npm run dev` và mở `http://localhost:3000`.

Nếu Payload hỏi về trường `bannerAutoplaySeconds`, chọn **create
column**. Đây là trường mới dùng để lưu số giây tự chuyển banner, không
xóa dữ liệu cũ.

## Banner trang chủ

Vào **Admin → Giao diện & bố cục trang chủ → Banner trang chủ**:

-   Bấm **Thêm Banner trang chủ** để thêm nhiều ảnh.
-   Kéo thả để đổi thứ tự.
-   Bật/tắt **Hiển thị** cho từng banner.
-   Đặt **Thời gian tự chuyển banner (giây)**, khuyên dùng 5--7 giây.
-   Ở trường ảnh, chọn **Tạo mới** hoặc **Chọn từ thư viện** để dùng lại
    ảnh đã tải.
-   Banner lớn dưới menu lấy đúng chiều rộng banner đầu trang trong
    **Cấu hình website** (mặc định 1300 px), được canh giữa và không kéo
    giãn theo màn hình.
-   Bỏ dấu chọn **Hiển thị banner lớn dưới menu** để ẩn toàn bộ khu vực
    banner mà không xóa các banner đã nhập.

## Chatbot và nút lên đầu trang

Vào **Admin → Cấu hình website → Chatbot và nút lên đầu trang** để:

-   Bật hoặc tắt chatbot.
-   Bật hoặc tắt nút **Lên đầu trang**.
-   Thay tên chatbot, lời chào và màu chính.

Chatbot hỗ trợ nhanh các nội dung: lịch khám, đặt khám Medpro, bảng giá,
tiêm ngừa, BHYT, thông báo, tin tức và hotline bệnh viện. Nút lên đầu
trang tự xuất hiện sau khi người dùng cuộn xuống và đưa trang lên đầu
bằng hiệu ứng mượt.

Trong cùng khu vực cấu hình chatbot, Admin còn có thể:

-   Chọn **Logo chatbot** từ thư viện hoặc để trống để dùng logo bệnh
    viện.
-   Sửa tên, trạng thái, lời chào, chữ gợi ý nhập liệu và ghi chú cuối
    cửa sổ.
-   Thêm, xóa và sắp xếp **Các nút hỏi nhanh**.
-   Thêm tối đa 100 mục trong **Kho câu hỏi và câu trả lời**; mỗi mục có
    từ khóa nhận biết, nội dung trả lời, tên nút và liên kết tùy chọn.

Khi câu hỏi không khớp kho nội dung, người dùng có thể bấm **Gửi tư vấn
viên**. Câu hỏi sẽ xuất hiện tại **Admin → CSKH → Tư vấn trực tuyến**.
Nhân viên nhập nội dung vào trường **Nội dung trả lời cho người dùng**
và bấm **Lưu**; chatbot đang mở sẽ tự nhận câu trả lời. Không sử dụng
chatbot thay cho cấp cứu hoặc chẩn đoán y khoa.

## Dashboard Admin mới

Trang `/admin` giữ đầy đủ cả hai phần:

-   Bảng điều khiển bệnh viện gồm số liệu, biểu đồ, **Tin tức vừa chỉnh
    sửa**, **Phản hồi đang chờ** và **Thao tác nhanh**.
-   Các nhóm quản trị **Hệ thống, Nội dung, Đấu thầu -- Mua sắm, Tổ
    chức, Khám bệnh, CSKH** ở phía dưới, đã được làm mới bằng thẻ màu,
    hiệu ứng xuất hiện và hiệu ứng rê chuột.

Nếu giao diện vẫn là bản cũ hoặc thiếu một trong hai phần, dừng máy chủ
rồi chạy `npm run clean:payload` và `npm run dev`. Sau đó nhấn
`Ctrl + F5` trên trang Admin.

## Ảnh và tệp dùng chung

Mọi trường logo, banner, ảnh bài viết, ảnh lịch khám, ảnh tiêm ngừa và
tệp đính kèm đều liên kết với **Thư viện Tệp & Hình ảnh**. Có thể tải
một lần và chọn lại ở nhiều mục mà không cần tạo bản sao.

## Bố cục danh sách

Các tab trên trang chủ hiển thị tối đa 5 nội dung: 1 nội dung chính và 4
nội dung tiếp theo. Nút **Xem tất cả** mở đúng nhóm nội dung; tại trang
danh sách có thể mở toàn bộ hoặc thu gọn.

------------------------------------------------------------------------

## 10. HUONG-DAN-TRIEN-KHAI-BAN-BAO-MAT.md

> Nguồn: `HUONG-DAN-TRIEN-KHAI-BAN-BAO-MAT.md`

# HƯỚNG DẪN TRIỂN KHAI BẢN ĐÃ GIA CỐ BẢO MẬT

## 1. Cập nhật `.env`

Sao chép `.env.example` thành `.env`, sau đó đặt giá trị thật cho:

-   `DATABASE_URL`
-   `POSTGRES_PASSWORD` (nếu chạy Docker)
-   `PAYLOAD_SECRET` tối thiểu 32 ký tự ngẫu nhiên
-   `NEXT_PUBLIC_SITE_URL` là domain HTTPS chính thức
-   `NEXT_PUBLIC_GA_ID` và `GOOGLE_SITE_VERIFICATION` nếu sử dụng

Không đưa `.env` lên Git hoặc gửi công khai.

## 2. Cài đặt và kiểm tra trên Windows

``` powershell
npm ci
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run build
```

## 3. Migration PostgreSQL

Trên máy phát triển đã kết nối đúng cơ sở dữ liệu:

``` powershell
npm run migrate:create
```

Kiểm tra và lưu thư mục migration được sinh ra cùng mã nguồn. Trên
Staging/Production chạy:

``` powershell
npm run migrate
```

Không bật `push` trên Production và luôn backup trước migration.

## 4. Docker

`docker-compose.yml` đã:

-   Không công khai cổng PostgreSQL ra ngoài.
-   Bắt buộc mật khẩu DB từ `.env`.
-   Gắn volume `media_data` để logo/banner/file không mất khi recreate
    app.
-   Có healthcheck `/api/health`.

Chạy:

``` powershell
docker compose up -d --build
docker compose ps
```

## 5. Backup và phục hồi

Máy chạy script cần có `pg_dump`, `pg_restore` và `tar`:

``` bash
npm run backup
CONFIRM_RESTORE=YES BACKUP_DIR=./backups/yyyymmdd-hhmmss npm run restore
```

Phải diễn tập restore trên Staging trước khi vận hành chính thức.

## 6. Cấu hình ngoài mã nguồn còn bắt buộc

-   SMTP/Resend để chức năng quên mật khẩu gửi được email.
-   Reverse proxy/CDN cấp SSL và chuyển HTTP sang HTTPS.
-   Rate limit tập trung bằng Cloudflare/Nginx/Redis nếu chạy nhiều app
    instance.
-   Object storage S3/R2/MinIO nếu triển khai trên nền tảng có
    filesystem tạm thời.
-   Công cụ giám sát lỗi/uptime và lịch backup ngoài máy chủ chính.

## 7. Test bắt buộc trước nghiệm thu

-   Editor không đổi được vai trò và không sửa được tài khoản khác.
-   Khách không đọc được lịch/dịch vụ/tiêm ngừa đã tắt.
-   REST API Payload không cho khách tạo feedback trực tiếp.
-   Upload ảnh/PDF/Word/Excel dưới 50 MB thành công; SVG/ZIP/RAR bị từ
    chối.
-   Recreate container nhưng ảnh và file vẫn còn.
-   Tuyển dụng, Gallery, tìm kiếm, 404 và file đính kèm hoạt động.
-   Chạy PageSpeed, cross-browser và kiểm tra thiết bị thật trên URL
    Staging.

------------------------------------------------------------------------

## 11. MENU-HOVER-FIX-V3.2.4.md

> Nguồn: `MENU-HOVER-FIX-V3.2.4.md`

# Sửa menu hover V3.2.4

-   Bỏ cơ chế `<details>/<summary>` ở menu desktop vì trình duyệt giữ
    thuộc tính `open` sau khi bấm, làm menu con không tự đóng.
-   Mục cha có menu con chuyển sang `div.navItem` + `a.navMainLink`.
-   Menu con mở bằng CSS `:hover` / `:focus-within`, không cần bấm
    chuột.
-   Khi con trỏ rời khỏi mục cha/menu con, dropdown tự đóng ngay.
-   Bấm vào tên mục cha sẽ đi đến trang của mục cha, không khóa dropdown
    ở trạng thái mở.
-   Giữ nguyên dữ liệu menu lấy từ Admin, liên kết mục con và kiểu hiển
    thị hiện tại.

------------------------------------------------------------------------

## 12. PRODUCTION-DEPLOYMENT.md

> Nguồn: `PRODUCTION-DEPLOYMENT.md`

# Hướng dẫn triển khai Production v4.2.0

## Trình tự khuyến nghị

1.  Tạo PostgreSQL và user riêng cho website; không dùng mật khẩu mẫu.
2.  Sao chép `.env.production.example` thành `.env`, điền biến thật và
    không commit `.env`.
3.  Trước khi chuyển production, chạy migration trên bản sao dữ liệu
    hoặc staging; Production dùng migration, không dùng schema push tự
    động.
4.  Chạy `npm install`, `npm run generate:types`,
    `npm run generate:importmap`, `npm run validate:all`,
    `npm run typecheck`, `npm run build`.
5.  Chạy `NODE_ENV=production npm run preflight:production`.
6.  Backup dữ liệu trước deploy và xác minh backup.
7.  Deploy app; reverse proxy HTTPS tới port 3000. Chỉ expose 80/443 ra
    Internet; PostgreSQL không public ra Internet.
8.  Kiểm tra `/api/health` rồi chạy
    `SMOKE_BASE_URL=https://... npm run smoke:production`.
9.  Thực hiện UAT theo `UAT-PRODUCTION-CHECKLIST.md` và lưu biên bản kết
    quả.

## Nguyên tắc dữ liệu

-   Không dùng `push` schema trên Production. `payload.config.ts` đã tự
    tắt push khi `NODE_ENV=production`.
-   Mọi thay đổi schema phải có migration và backup trước khi chạy.
-   Restore phải thử trên database clone/staging trước khi dùng cho sự
    cố thật.
-   Media phải được backup cùng database vì bài viết lưu quan hệ đến
    file.

## Reverse proxy

Proxy phải chuyển đầy đủ `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`
và hỗ trợ upload đến giới hạn đã cấu hình. TLS nên được kết thúc tại
Nginx/Caddy/Cloudflare hoặc load balancer có chứng chỉ hợp lệ.

## Sau deploy

Kiểm tra login Admin, quyền role/module/khoa-phòng, một quy trình
publish, upload ảnh/PDF, tìm kiếm, sitemap/robots, redirect 301, bảng
giá, lịch khám, tiêm chủng, góp ý/tra cứu, chatbot, khảo sát/QR,
backup/verify và health endpoint trước khi mở chính thức.

------------------------------------------------------------------------

## 13. R3-UPGRADE.md

> Nguồn: `R3-UPGRADE.md`

# R3 Professional UI

## Frontend

-   Trang chủ mới theo định hướng UX của các nền tảng y tế hiện đại:
    hero mạnh, tìm kiếm, tiện ích nhanh, ticker thông báo, editorial
    news, đấu thầu/thông báo, giới thiệu, số liệu, văn bản, CTA.
-   Header 2 tầng và footer chuyên nghiệp.
-   Responsive hoàn chỉnh và thanh hành động mobile.
-   Nội dung chính vẫn lấy từ Payload CMS.
-   Homepage Global được bổ sung Quick Links, Intro và Stats để Admin
    chỉnh nội dung.

## Admin

-   Dashboard KPI tùy biến được chèn trước Dashboard mặc định của
    Payload.
-   Thống kê Tin tức, Thông báo, Đấu thầu, Văn bản, Phản hồi, Bác sĩ,
    Khoa/Phòng, Lịch khám.
-   Danh sách tin cập nhật gần đây và phản hồi chưa xử lý.
-   Nút tạo nhanh.
-   Logo/Icon riêng cho bệnh viện.
-   Không thay thế CRUD chuẩn của Payload.

## Sau khi giải nén

Copy `.env` riêng của bạn vào project rồi chạy:

``` powershell
npm install
npm run clean:payload
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run dev
```

Do R3 có Custom Components trong Payload Admin, `generate:importmap` là
bắt buộc sau khi cập nhật source.

Sau khi development chạy ổn:

``` powershell
npm run build
```

------------------------------------------------------------------------

## 14. R3.1-FIX.md

> Nguồn: `R3.1-FIX.md`

# R3.1 --- Payload importMap fix

Root cause: - Admin route imports `../importMap.js`. - The R3 archive
intentionally did not ship a generated import map. - If
`payload generate:importmap` did not run, Next.js cannot compile
`/admin`. - Earlier package also lacked `"type": "module"`, which can
prevent Payload CLI from loading `payload.config.ts`.

Fixes: 1. Added `"type": "module"`. 2. `npm run dev` now automatically
runs: - `payload generate:importmap` - `payload generate:types` -
import-map verification 3. `npm run build` runs the same
generation/verification before `next build`. 4. `clean:payload` no
longer deletes the generated import map.

Use:

``` powershell
npm install
npm run clean:payload
npm run dev
```

You no longer need to remember `generate:importmap` manually before
`npm run dev`.

If you want to validate separately:

``` powershell
npm run generate:importmap
npm run verify:importmap
npm run typecheck
```

------------------------------------------------------------------------

## 15. README.md

> Nguồn: `README.md`

# Website Bệnh viện Đa khoa Khu vực Thới Lai --- V3.2.3

Bản source hoàn chỉnh theo phạm vi V1 đã chốt.

## Stack

-   Next.js 16 + React 19 + TypeScript
-   Payload CMS 3
-   PostgreSQL
-   Lexical Rich Text
-   CSS responsive riêng, xanh dương + trắng
-   Docker / Docker Compose

## Chức năng public

-   Trang chủ động từ CMS
-   Tin tức + trang chi tiết
-   Thông báo + file đính kèm
-   Đấu thầu -- Mua sắm + mã gói + trạng thái + deadline + lịch sử cập
    nhật + file
-   Sơ đồ tổ chức
-   Trang Khoa/Phòng
-   Hồ sơ bác sĩ
-   Lịch khám
-   Bảng giá
-   Văn bản -- Tài liệu
-   Tuyển dụng
-   Liên hệ + Góp ý
-   Đặt lịch liên kết Medpro
-   Sitemap + robots
-   Responsive desktop/mobile
-   Thanh hành động mobile

## Chức năng Admin

-   Payload Admin `/admin`
-   Rich Text Editor
-   Media Library
-   Tin tức / thông báo / đấu thầu / văn bản / trang
-   Khoa/phòng / bác sĩ / lịch khám / bảng giá
-   Tuyển dụng
-   Phản hồi người bệnh
-   Menu động
-   Cấu hình website
-   Cấu hình trang chủ
-   Drafts, autosave, version history, scheduled publish ở các
    collection nội dung
-   RBAC nền tảng: Super Admin / Admin / Editor / Reviewer / Procurement
    / Department Manager

## Chạy local

1.  Cài Node.js 22 và Docker.
2.  Copy `.env.example` thành `.env`.
3.  Đổi `PAYLOAD_SECRET`.
4.  Chạy database:

``` bash
docker compose up -d db
```

5.  Cài dependencies và chạy:

``` bash
npm install
npm run generate:types
npm run generate:importmap
npm run dev
```

6.  Mở:

-   Website: `http://localhost:3000`
-   Admin: `http://localhost:3000/admin`

Payload sẽ cho tạo user quản trị đầu tiên nếu database trống. Script
seed cũng có sẵn nhưng PHẢI đổi mật khẩu demo trước khi dùng thật.

## Production checklist bắt buộc

-   Thay hotline / địa chỉ / email / URL Medpro / Zalo bằng dữ liệu
    thật.
-   Tải logo và hình ảnh thật.
-   Đổi password seed hoặc không dùng seed user.
-   Dùng S3-compatible storage cho Media thay vì local disk nếu chạy
    nhiều instance.
-   Backup PostgreSQL hằng ngày.
-   Reverse proxy / Cloudflare / HTTPS.
-   Rate limit endpoint phản hồi ở reverse proxy/WAF.
-   SMTP nếu muốn gửi mail thông báo.
-   Kiểm thử quyền Admin trước khi go-live.
-   Kiểm thử accessibility, SEO, performance và mobile.
-   Kiểm tra quy định nội bộ/pháp lý trước khi đưa dữ liệu y tế cá nhân
    lên hệ thống.

## Phạm vi không chứa dữ liệu y tế nhạy cảm

Bệnh án điện tử, kết quả xét nghiệm, đơn thuốc, thanh toán viện phí và
HIS/LIS/PACS không nằm trong V2 này. Khi cần, tích hợp qua API ở giai
đoạn tiếp theo.

------------------------------------------------------------------------

## 16. REPAIR-NOTES.md

> Nguồn: `REPAIR-NOTES.md`

# Repair notes

This package replaces the previous routing/layout implementation.

Key corrections: - No `src/app/layout.tsx`. - Public application is
entirely under `src/app/(frontend)` and its root layout explicitly
renders `<html>` + `<body>`. - Payload Admin/API is entirely under
`src/app/(payload)`. - Payload layout follows the official Payload
template and uses `RootLayout`. - Payload generated import map remains
`admin/importMap.js`; do not rename it to TypeScript. - `allowJs` is
enabled so TypeScript accepts Payload's generated JS import map.

After replacing your old project with this package: 1. Keep your
existing `.env` (do not send it to anyone). 2. Delete `.next`. 3. Run
`npm install`. 4. Run `npm run generate:importmap`. 5. Run
`npm run generate:types`. 6. Run `npm run typecheck`. 7. Run
`npm run build`. 8. Run `npm run dev`.

------------------------------------------------------------------------

## 17. REPAIR-R2.md

> Nguồn: `REPAIR-R2.md`

# Repair R2

Corrections based on the actual compiler output from the installed
packages: - `publishedOrOwnedDraft` now uses explicit `Where` variables,
eliminating TypeScript's invalid optional-union inference. - Removed
`generatePayloadViewport` because the installed
`@payloadcms/next@3.88.0` type declarations on the user's machine do not
export it. - Kept Payload `RootLayout`, `handleServerFunctions`, route
groups, and generated import map structure.

Run: npm run generate:importmap npm run generate:types npm run typecheck
npm run build

------------------------------------------------------------------------

## 18. SECURITY-PRODUCTION-V4.3.0.md

> Nguồn: `SECURITY-PRODUCTION-V4.3.0.md`

# v4.3.0 Production Security Final

-   Payload login: tối đa 5 lần sai, khóa 15 phút bằng cơ chế auth tích
    hợp.
-   Node chỉ bind localhost qua Docker Compose; PostgreSQL không publish
    5432.
-   Nginx rate-limit theo nhóm login / form / chatbot / toàn site, giới
    hạn kết nối và request body.
-   Nginx ghi đè X-Real-IP và X-Forwarded-For để request Internet không
    tự giả IP khi origin chỉ nhận qua Nginx.
-   Form công khai có honeypot + application rate limit; hỗ trợ
    Cloudflare Turnstile. Turnstile chỉ bắt buộc khi
    TURNSTILE_SECRET_KEY được cấu hình.
-   Health endpoint public chỉ trả status; chi tiết chỉ khi có
    HEALTH_DETAIL_KEY.
-   Đã xóa /api/auth-check khỏi Production source.
-   Container chạy user `node`, không chạy root.
-   Remote image host được thu hẹp, không còn wildcard `**`.
-   Import bảng giá chuyển từ `xlsx@0.18.5` sang `exceljs`; chỉ nhận
    `.xlsx`, tối đa 20 MB/10.000 dòng.
-   Security headers/CSP/HSTS cũ tiếp tục được giữ; CSP bổ sung
    Cloudflare Turnstile.

## Trước khi mở Internet

1.  Đặt PAYLOAD_SECRET ngẫu nhiên \>= 32 ký tự, mật khẩu PostgreSQL mạnh
    và NEXT_PUBLIC_SITE_URL=https://domain thật.
2.  Cấu hình Nginx + SSL; chỉ mở 22/80/443 bằng firewall.
3.  Nếu dùng Turnstile, cấu hình đồng thời
    NEXT_PUBLIC_TURNSTILE_SITE_KEY và TURNSTILE_SECRET_KEY.
4.  Nếu dùng Cloudflare Proxy, bật WAF/Bot protection. Nếu muốn Nginx
    nhận IP người dùng thật qua Cloudflare, cấu hình `real_ip` chỉ với
    dải IP Cloudflare chính thức; không tin CF-Connecting-IP khi origin
    còn truy cập trực tiếp.
5.  Backup PostgreSQL và media ra vị trí ngoài VPS.

## Lưu ý

Rate limit trong ứng dụng vẫn là memory limiter, dùng như lớp thứ hai.
Nginx là lớp rate-limit chính cho một VPS. Nếu sau này chạy nhiều app
instance, chuyển limiter ứng dụng sang Redis.

------------------------------------------------------------------------

## 19. STABLE-FIX-NOTES.md

> Nguồn: `STABLE-FIX-NOTES.md`

# Stable repair notes

This repair was made from the ZIP uploaded from the machine that
reproduced the PostgreSQL error.

Confirmed root cause fixed: - `Procurement` used Payload drafts and also
a custom `status` select. - PostgreSQL/Drizzle generated a conflicting
enum name for the business status and Payload `_status`. - The business
field is now `procurementStatus`; frontend references were updated.

Additional stabilization: - Access-control `Where` values are explicitly
typed. - Payload packages are pinned to 3.88.0 and Next.js to 16.3.2 to
prevent an accidental npm upgrade changing APIs. - PostgreSQL `push` is
enabled only outside production. - `npm run audit:config` detects the
same drafts/custom-status collision before startup.

IMPORTANT: The current local database was partially created before the
schema error. For a development database with no valuable content,
recreate `thoi_lai_hospital` once before starting this repaired source.
Do not manually create Payload internal tables.

Recommended validation: 1. Copy your private `.env` into this project.
2. `npm install` 3. `npm run audit:config` 4.
`npm run generate:importmap` 5. `npm run generate:types` 6.
`npm run typecheck` 7. Start against a clean development DB with
`npm run dev` 8. Verify `/admin`, then `npm run build`

------------------------------------------------------------------------

## 20. UAT-PRODUCTION-CHECKLIST.md

> Nguồn: `UAT-PRODUCTION-CHECKLIST.md`

# UAT + Production Readiness --- BVĐK Khu vực Thới Lai v4.2.0

> Đây là checklist nghiệm thu cuối. Các mục Runtime chỉ được đánh PASS
> sau khi chạy trên máy có `node_modules`, PostgreSQL và dữ liệu
> test/production-like. Static validator không thay thế UAT thật.

## 1. Build / cấu hình

-   [ ] `npm install` hoàn tất không lỗi.
-   [ ] `npm run generate:types` PASS.
-   [ ] `npm run generate:importmap` PASS.
-   [ ] `npm run validate:all` PASS.
-   [ ] `npm run typecheck` PASS.
-   [ ] `npm run build` PASS.
-   [ ] `npm run preflight:production` PASS với `.env` thật.
-   [ ] `NEXT_PUBLIC_SITE_URL` là HTTPS đúng tên miền.
-   [ ] `PAYLOAD_SECRET` và `PREVIEW_SECRET` là chuỗi ngẫu nhiên \>=32
    ký tự.

## 2. Tài khoản / phân quyền / workflow

-   [ ] Super Admin truy cập toàn bộ module.
-   [ ] Editor không có quyền Publish nếu chưa được cấp.
-   [ ] Reviewer có thể duyệt nhưng không vượt quyền module.
-   [ ] Procurement chỉ thao tác module được phân công.
-   [ ] Department Manager chỉ thao tác dữ liệu thuộc khoa/phòng.
-   [ ] Tài khoản locked/inactive không đăng nhập được.
-   [ ] Draft → Submit → Approve → Publish → Hide đúng quyền.
-   [ ] Audit Log ghi Create/Update/Delete/Login và không sửa/xóa được
    qua Admin/API thông thường.

## 3. Nội dung / Homepage / Menu / SEO

-   [ ] Homepage thêm/xóa/ẩn/hiện/kéo-thả block từ Admin; block đã xóa
    không tự sinh lại.
-   [ ] Menu desktop xổ bằng hover; click không làm dropdown treo.
-   [ ] Menu mobile accordion hoạt động, không vỡ dòng.
-   [ ] Tin tức/Thông báo/Đấu thầu/Tuyển dụng/Văn bản mở được trang chi
    tiết.
-   [ ] Thumbnail fallback hiển thị khi không có ảnh.
-   [ ] Đổi slug bài đã publish tạo Redirect 301 từ URL cũ.
-   [ ] `/robots.txt` và `/sitemap.xml` phản ánh cấu hình Admin.
-   [ ] Search trả kết quả từ các module đã cấu hình và trang tìm kiếm
    `noindex`.
-   [ ] Draft Preview Homepage hoạt động và thoát preview được.

## 4. Dịch vụ người bệnh

-   [ ] Bảng giá lấy mức giá đang hiệu lực từ `servicePrices`.
-   [ ] Import Excel: tải mẫu → validate → preview → xác nhận import →
    lưu ImportJob.
-   [ ] Dữ liệu lỗi/duplicate không được ghi âm thầm.
-   [ ] Lịch khám ưu tiên ảnh lịch tuần và hỗ trợ lịch điều chỉnh.
-   [ ] Tiêm chủng dùng `vaccines`, `vaccinePrices`,
    `vaccinationSchedules` và giá theo hiệu lực.

## 5. Tổ chức / bác sĩ

-   [ ] Khoa/Phòng → Chuyên khoa → Bác sĩ liên kết đúng.
-   [ ] Department Manager không ghi bác sĩ/chuyên khoa sang đơn vị
    khác.
-   [ ] Các route `/khoa-phong`, `/chuyen-khoa`, `/bac-si` và trang chi
    tiết hoạt động.

## 6. Chatbot / Form / Phản ánh

-   [ ] Chatbot ưu tiên Intent; câu chưa biết được ghi vào Unanswered.
-   [ ] Fallback và luồng gửi tư vấn viên còn hoạt động.
-   [ ] Form động lưu FormSubmission đúng loại trường.
-   [ ] Góp ý sinh mã tiếp nhận; tra cứu bằng mã + SĐT.
-   [ ] Timeline chỉ công khai hành động được phép public.
-   [ ] Rate limit/honeypot chặn gửi spam cơ bản.

## 7. Khảo sát hài lòng / QLCL

-   [ ] Mẫu khảo sát có Version và version đã khóa không sửa trực tiếp.
-   [ ] Campaign gắn đúng snapshot Version.
-   [ ] Mã/QR khảo sát mở đúng chiến dịch.
-   [ ] Câu bắt buộc được validate server-side.
-   [ ] Response/Answer lưu snapshot nội dung câu hỏi.
-   [ ] Dashboard thống kê và Export hoạt động với quyền QLCL.

## 8. Media / Trash / Restore / bảo mật

-   [ ] Media public xem được khi chưa đăng nhập.
-   [ ] Media internal/restricted bị chặn khi không có quyền.
-   [ ] Upload vượt kích thước/MIME bị chặn.
-   [ ] SHA-256 và cảnh báo file trùng hoạt động.
-   [ ] Trash/Restore kiểm tra trên nội dung và Media.
-   [ ] CSP, nosniff, Referrer-Policy, Permissions-Policy hiện trong
    response.
-   [ ] Production HTTPS có HSTS.
-   [ ] Admin/API có `X-Robots-Tag: noindex`.

## 9. Backup / Restore / Health

-   [ ] `npm run backup` tạo dump + media archive + checksum.
-   [ ] `npm run backup:verify` PASS.
-   [ ] Thử restore trên database test/clone, không thử trực tiếp trên
    production đang hoạt động.
-   [ ] `/api/health` trả `status=ok`, database=ok, storage=ok.
-   [ ] Docker healthcheck Healthy.

## 10. Responsive / trình duyệt / accessibility

-   [ ] Desktop 1366×768, 1920×1080 không vỡ layout.
-   [ ] Mobile 360/390/414 px không tràn ngang.
-   [ ] Chrome/Edge/Firefox phiên bản hiện hành kiểm tra các luồng
    chính.
-   [ ] Có thể thao tác menu/form bằng bàn phím.
-   [ ] Ảnh có alt phù hợp; form có label; focus nhìn thấy rõ.
-   [ ] Không có lỗi nghiêm trọng trong Browser Console.

## 11. Smoke test sau deploy

Chạy:

``` bash
SMOKE_BASE_URL=https://ten-mien-that.vn npm run smoke:production
```

Chỉ nghiệm thu Production khi smoke test và toàn bộ mục bắt buộc phía
trên PASS.

------------------------------------------------------------------------

## 21. UPDATE-COMPACT-SCHEDULE-POSTS-DETAIL.md

> Nguồn: `UPDATE-COMPACT-SCHEDULE-POSTS-DETAIL.md`

# Lịch khám dạng bài đăng gọn

-   Cả ba tab Lịch đính kèm, Theo ngày và Theo tuần hiển thị dưới dạng
    thẻ bài viết gọn.
-   Mỗi thẻ gồm ảnh, tên lịch, mô tả ngắn, thời gian áp dụng và nút Xem
    chi tiết.
-   Bấm thẻ để mở trang chi tiết riêng.
-   Trang chi tiết hiển thị đầy đủ bác sĩ, khoa/phòng, giờ, bảng lịch
    tuần, ảnh và tệp tải xuống.
-   Admin Lịch khám có thêm Ảnh đại diện, Mô tả ngắn và Nội dung chi
    tiết cho mọi hình thức lịch.
-   Thứ tự và trạng thái hiển thị ba tab vẫn được chỉnh trong Giao diện
    & bố cục trang chủ.

------------------------------------------------------------------------

## 22. UPDATE-COMPACT-VACCINATION-POSTS-TAB-ORDER.md

> Nguồn: `UPDATE-COMPACT-VACCINATION-POSTS-TAB-ORDER.md`

# Tiêm ngừa dạng bài đăng gọn

-   Thông báo chung, đợt tiêm và vắc xin hiển thị dạng thẻ ngắn gồm ảnh,
    tiêu đề, mô tả và nút Xem chi tiết.
-   Bấm thẻ để mở trang chi tiết đầy đủ; hỗ trợ nội dung dài, bảng, ảnh
    và tệp đính kèm.
-   Có thể tạo nhiều bài Thông báo lịch tiêm ngừa chung.
-   Đã thêm ảnh riêng cho Đợt tiêm ngừa.
-   Ảnh thông báo và ảnh vắc xin tiếp tục được hỗ trợ.
-   Vào **Giao diện & bố cục trang chủ → mục Thông tin tiêm ngừa → Thứ
    tự các tab Tiêm ngừa** để kéo thả hoặc ẩn tab.

------------------------------------------------------------------------

## 23. UPDATE-CUSTOM-HOMEPAGE-SECTIONS-ATTACHMENT-NAMES.md

> Nguồn: `UPDATE-CUSTOM-HOMEPAGE-SECTIONS-ATTACHMENT-NAMES.md`

# Mục trang chủ mới và tên tệp tự động

## Thêm mục mới trên trang chủ

Vào **Giao diện & bố cục trang chủ → Bố cục & giao diện các mục trang
chủ → Thêm** và chọn **Mục nội dung tùy chỉnh (thêm mới)**.

Mục mới hỗ trợ tiêu đề, mô tả, nội dung soạn thảo, ảnh, vị trí ảnh, nút
liên kết, màu sắc, cỡ chữ, khoảng cách và độ rộng. Có thể tạo nhiều mục
tùy chỉnh và kéo thả để sắp xếp.

## Tệp đính kèm

-   Không còn yêu cầu nhập Tên hiển thị.
-   Website tự lấy tên gốc của tệp.
-   Tự nhận dạng và hiển thị định dạng PDF, DOC, DOCX, XLS, XLSX, ZIP...
-   Áp dụng cho Tin tức, Thông báo, Đấu thầu -- Mua sắm và Trang nội
    dung.

------------------------------------------------------------------------

## 24. UPDATE-DOCTOR-SCHEDULE-DAY-WEEK-FILES.md

> Nguồn: `UPDATE-DOCTOR-SCHEDULE-DAY-WEEK-FILES.md`

# Nâng cấp Lịch khám bác sĩ

Trong Admin → Lịch khám, trường **Hình thức đăng lịch** có ba lựa chọn:

1.  **Nhập từng lịch theo ngày**: chọn bác sĩ, khoa/phòng, ngày, giờ và
    phòng khám.
2.  **Lập lịch theo tuần**: chọn thời gian áp dụng rồi thêm nhiều buổi;
    mỗi buổi chọn Thứ, bác sĩ, khoa/phòng, giờ và ghi chú.
3.  **Đăng bằng ảnh hoặc tệp**: tải ảnh JPG/PNG hoặc tệp Excel, PDF,
    Word và nhập thời gian hiệu lực.

Trang Lịch khám có ba tab tương ứng: Theo ngày, Theo tuần và Lịch đính
kèm.

## Lần chạy đầu tiên

Payload có thể hỏi tạo các cột và bảng mới của lịch tuần. Chọn **create
column** và **create table**. Không chọn rename từ các cột cũ vì lịch cũ
vẫn được giữ nguyên.

------------------------------------------------------------------------

## 25. UPDATE-HEADER-BANNER-BACK-TO-LIST.md

> Nguồn: `UPDATE-HEADER-BANNER-BACK-TO-LIST.md`

# Banner đầu trang và nút trở lại danh sách

-   Banner bệnh viện mới được đặt phía trên thanh menu.
-   Khối logo và tên bệnh viện cũ trong thanh menu đã được xóa.
-   Banner mặc định: `public/branding/banner-header-bvdk-thoi-lai.png`.
-   Có thể thay banner trong **Cấu hình website → Banner đầu trang** và
    chỉnh chiều cao banner.
-   Các trang chi tiết Tin tức, Thông báo, Đấu thầu, Lịch khám và Tiêm
    ngừa có nút trở lại danh sách tương ứng.

Banner được tạo bằng công cụ tạo ảnh tích hợp, sử dụng logo chính thức
do người dùng cung cấp. Nội dung: tên Bệnh viện Đa khoa khu vực Thới
Lai, khẩu hiệu, địa chỉ Ấp Thới Phong và điện thoại 0292 368 9115.

------------------------------------------------------------------------

## 26. UPDATE-HOME-SCHEDULE-TABS-VACCINATION-GROUPS.md

> Nguồn: `UPDATE-HOME-SCHEDULE-TABS-VACCINATION-GROUPS.md`

# Tab lịch khám trên trang chủ và nhóm Tiêm ngừa

## Lịch khám trên trang chủ

Khối Lịch khám trên trang chủ có đủ ba tab. Thứ tự mặc định:

1.  Lịch đính kèm
2.  Theo ngày
3.  Theo tuần

Vào **Giao diện & bố cục trang chủ → mục Lịch khám → Thứ tự các tab Lịch
khám** để kéo thả hoặc tắt tab.

## Tiêm ngừa

Admin → Tiêm ngừa có trường **Nhóm thông tin** gồm:

-   Thông báo lịch tiêm ngừa chung: nội dung, ảnh và tệp thông báo.
-   Tiêm ngừa theo đợt: ngày bắt đầu/kết thúc, giờ, địa điểm và đối
    tượng.
-   Loại vắc xin tiêm ngừa: ảnh, nhà sản xuất, xuất xứ, bệnh phòng ngừa,
    độ tuổi, giá và tình trạng.

Trang chủ và trang Tiêm ngừa đều hiển thị ba tab tương ứng. Dữ liệu tiêm
chủng cũ được xem là dữ liệu theo đợt.

------------------------------------------------------------------------

## 27. UPDATE-HOMEPAGE-REFERENCE-2026.md

> Nguồn: `UPDATE-HOMEPAGE-REFERENCE-2026.md`

# Cập nhật giao diện trang chủ theo mẫu

Phiên bản: `3.2.3-homepage-reference.1`

## Nội dung đã cập nhật

-   Thiết kế lại đầu trang, đường dây nóng, menu xanh và menu con mở khi
    bấm.
-   Dùng biểu tượng Facebook, Zalo và YouTube có nền tương phản ở đầu và
    cuối trang.
-   Thiết kế banner, 8 tiện ích nhanh, giới thiệu, số liệu, chuyên khoa,
    đặt lịch, tin tức, thông báo, đấu thầu, lịch khám, tiêm chủng, văn
    bản và bảng giá theo bố cục mẫu.
-   Dữ liệu vẫn lấy trực tiếp từ Payload Admin; nội dung hiện có không
    bị thay bằng dữ liệu tĩnh.
-   Các tab có thể thêm, xóa, kéo thả, tự nhập tên và thêm nội dung thủ
    công.
-   Hàng tab, nhóm hoặc nội dung để trống được bỏ qua khi hiển thị và
    không còn chặn thao tác lưu.
-   Đặt tên bảng ngắn cho các mảng lồng nhau để tránh lỗi trùng tên chỉ
    mục trên PostgreSQL 11.

## Chạy bản cập nhật

1.  Giải nén vào thư mục mới.
2.  Sao chép tệp `.env` từ bản đang chạy sang thư mục mới.
3.  Chạy `npm install`.
4.  Chạy `npm run clean:payload`.
5.  Chạy `npm run dev`.
6.  Nếu Payload hỏi thay đổi cấu trúc dữ liệu, chọn dấu `+` để áp dụng
    các cột mới.

Nên sao lưu PostgreSQL trước khi áp dụng thay đổi cấu trúc trên VPS.

------------------------------------------------------------------------

## 28. UPDATE-HOMEPAGE-SECTIONS-ADMIN.md

> Nguồn: `UPDATE-HOMEPAGE-SECTIONS-ADMIN.md`

# Tùy chỉnh các mục trang chủ trong Admin

Vào **Admin → Trang chủ → Bố cục & giao diện các mục trang chủ**.

Mỗi mục hỗ trợ:

-   Kéo thả để đổi thứ tự hiển thị.
-   Bật hoặc tắt mục.
-   Đổi nhãn nhỏ, tiêu đề lớn và mô tả.
-   Đổi màu nhãn, màu tiêu đề, màu mô tả và màu nền bằng mã màu, ví dụ
    `#0878d1`.
-   Đổi cỡ chữ của nhãn, tiêu đề và mô tả theo pixel.

Các mục đã đưa vào quản trị gồm Hoạt động nổi bật, Cổng thông tin, Tổ
chức bệnh viện, Thông báo, Đấu thầu -- Mua sắm, Lịch khám, Hoạt động
khoa học, Giới thiệu và Văn bản mới.

Sau khi chỉnh, bấm **Lưu** và tải lại trang chủ bằng `Ctrl + F5`.

------------------------------------------------------------------------

## 29. UPDATE-HOMEPAGE-SPACING-WIDTH.md

> Nguồn: `UPDATE-HOMEPAGE-SPACING-WIDTH.md`

# Tùy chỉnh khoảng cách và độ rộng từng mục trang chủ

Vào **Giao diện & bố cục trang chủ → Bố cục & giao diện các mục trang
chủ**.

Trong mỗi mục có thêm:

-   Khoảng cách phía trên: mặc định 42px.
-   Khoảng cách phía dưới: mặc định 42px.
-   Độ rộng nội dung: mặc định 1180px.
-   Khoảng cách giữa cụm tiêu đề và phần nội dung: mặc định 18px.

Có thể nhập `0` cho khoảng cách trên/dưới nếu cần đặt hai mục sát nhau.
Giao diện điện thoại vẫn tự co theo chiều rộng màn hình.

------------------------------------------------------------------------

## 30. UPDATE-NOTICE-PROCUREMENT-ATTACHMENTS.md

> Nguồn: `UPDATE-NOTICE-PROCUREMENT-ATTACHMENTS.md`

# Cập nhật Thông báo, Đấu thầu và tệp đính kèm

-   Thêm trường **Ảnh đại diện** và **Mô tả ngắn** trong Admin cho Thông
    báo.
-   Thêm trường **Ảnh đại diện** và **Mô tả ngắn** trong Admin cho Đấu
    thầu -- Mua sắm.
-   Ảnh được dùng đồng bộ ở trang chủ, trang danh sách và trang chi
    tiết.
-   Nếu chưa chọn ảnh, website vẫn hiển thị nền mặc định để không vỡ bố
    cục.
-   Tệp đính kèm được tạo đường dẫn từ URL hoặc tên tệp, mở ở tab mới và
    có nút rõ ràng.
-   Đã áp dụng cách mở tệp mới cho Thông báo, Đấu thầu, Văn bản, Trang
    nội dung và danh sách văn bản trên trang chủ.

## Khi chạy lần đầu

Payload có thể hỏi tạo cột mới cho `cover` và `excerpt` trong bảng
`notices` và `procurement`. Chọn **create column**. Dữ liệu cũ không bị
xóa.

------------------------------------------------------------------------

## 31. UPDATE-V3.2.5-LIST-CATEGORIES-SLOGAN.md

> Nguồn: `UPDATE-V3.2.5-LIST-CATEGORIES-SLOGAN.md`

# v3.2.5 -- Danh sách theo chuyên mục + slogan

-   Chuẩn hóa font slogan đầu trang bằng Segoe UI/Arial, tăng độ rõ của
    dấu tiếng Việt.
-   Trang Tin tức tổng hiển thị chuyên mục rõ ràng bằng các nút có số
    lượng bài.
-   Danh sách chuyển sang dạng thẻ 3 cột, có ảnh, chuyên mục, ngày, mô
    tả và nút xem chi tiết.
-   Ô tìm kiếm lọc cả tiêu đề và mô tả ngắn.
-   Áp dụng cùng giao diện cho Thông báo và Đấu thầu -- Mua sắm qua
    component SearchFilter dùng chung.
-   Responsive: 3 cột desktop, 2 cột tablet, 1 cột mobile.

------------------------------------------------------------------------

## 32. UPDATE-V3.2.6-NEWS-IMAGE-EDITOR-KEY.md

> Nguồn: `UPDATE-V3.2.6-NEWS-IMAGE-EDITOR-KEY.md`

# v3.2.6

-   Sửa ảnh đại diện trang danh sách Tin tức/Thông báo/Đấu thầu bằng
    depth=2 và URL media chuẩn `/api/media/file/...`.
-   Card dùng thẻ `<img>` object-fit; nếu ảnh lỗi sẽ hiện placeholder
    thay vì vùng trắng.
-   Sửa lỗi Payload Admin
    `Encountered two children with the same key, green` bằng ID
    TextState duy nhất cho màu nền.
-   Giữ tương thích hiển thị nội dung cũ đã lưu với highlight
    yellow/blue/green/red.

------------------------------------------------------------------------

## 33. UPDATE-V3.3.0-FOUNDATION-BASELINE.md

> Nguồn: `UPDATE-V3.3.0-FOUNDATION-BASELINE.md`

# V3.3.0 - Foundation theo Baseline V1.1

## Đã thực hiện

-   Chuẩn hóa danh sách vai trò nền tảng theo nhóm nghiệp vụ của
    Baseline V1.1, vẫn giữ `admin` và `department-manager` để tương
    thích dữ liệu cũ.
-   Bổ sung `users.department`, `users.status`, `users.permissions`,
    `users.lastLoginAt`.
-   Bổ sung access helper kiểm tra quyền module/action và scope theo
    khoa/phòng để các module mới dùng server-side.
-   Chuẩn hóa Media metadata: tên file gốc, nhóm, access level, người
    upload, hash placeholder.
-   Bổ sung các derivative ảnh 16:9: thumb/small/card/medium/large và
    article để frontend không tải ảnh gốc cho card.
-   Siết quyền xóa Media từ editor về Admin trong giai đoạn chuyển đổi
    nhằm giảm nguy cơ xóa nhầm file dùng chung.
-   Bổ sung Global `upload-settings` với giới hạn mặc định đúng Baseline
    (15/20/50/20/20/50 MB, batch 100 MB/20 file, cảnh báo 80%, chặn
    95%).
-   Bổ sung script `npm run validate:foundation`.

## Chưa tuyên bố PASS hoàn toàn

Các mục sau mới tạo nền schema/config, chưa enforcement đầy đủ và sẽ
tiếp tục đúng lộ trình: - status locked/inactive chưa chặn login ở auth
hook; - `lastLoginAt` chưa tự ghi; - media internal/restricted chưa chặn
URL file ở middleware; - hash chưa tính SHA-256, chưa cảnh báo file
trùng; - chưa reverse-reference để ngăn xóa file đang được dùng, chưa
Trash; - UploadSettings chưa áp middleware theo từng MIME và ngưỡng
storage; - quyền module/department đã có helper nhưng collection cũ chưa
chuyển đồng loạt để tránh làm hỏng quyền/dữ liệu đang chạy.

## Tương thích

Không đổi slug collection cũ, không xóa field cũ, không sửa dữ liệu
frontend và không thay giao diện đã duyệt.

------------------------------------------------------------------------

## 34. UPDATE-V3.3.1-FOUNDATION-ENFORCEMENT.md

> Nguồn: `UPDATE-V3.3.1-FOUNDATION-ENFORCEMENT.md`

# v3.3.1 - Foundation Enforcement

Bản này tiếp tục Foundation của Baseline V1.1, ưu tiên thực thi quyền
server-side mà không đổi giao diện frontend và không đổi slug collection
hiện có.

## Đã thực hiện

-   Chặn đăng nhập Users có status `locked` hoặc `inactive` bằng
    `beforeLogin`.
-   Cập nhật `lastLoginAt` bằng `afterLogin`.
-   Mọi access helper nội bộ từ chối session của user không còn
    `active`.
-   Bổ sung ma trận quyền mặc định theo Role + Module; quyền bổ sung
    trên từng user vẫn có hiệu lực.
-   Chuyển quyền Create/Edit/Delete các module hiện hữu sang
    `moduleAccess()` server-side: News, Notices, Procurement,
    Recruitment, Documents, Pages, Doctors, Departments, Schedules,
    Services, Vaccinations, Feedback, Consultations và Media.
-   Giữ Super Admin/System Admin/Admin toàn quyền để tương thích quản
    trị hiện tại.
-   Không refactor schema nghiệp vụ lớn ở bản này để tránh ảnh hưởng dữ
    liệu 3.2.x/3.3.0.

## Chưa đánh dấu PASS

-   Scope khoa/phòng chưa áp đồng loạt vì một số collection cũ chưa có
    field department đúng Data Dictionary.
-   Media restricted URL, reverse-reference, Trash và SHA-256 thực tế để
    dành cho Data & File/System hardening.
-   Workflow Submit/Approve/Publish/Restore sẽ triển khai ở Public
    Content.

## Kiểm tra

Chạy `npm run validate:foundation`. Bản static validator v3.3.1 kiểm
thêm login lock, lastLoginAt, active session và module access.

------------------------------------------------------------------------

## 35. UPDATE-V3.4.0-SITE-SHELL-BASELINE.md

> Nguồn: `UPDATE-V3.4.0-SITE-SHELL-BASELINE.md`

# v3.4.0 - Site Shell Baseline

## Mục tiêu

Chuẩn hóa giai đoạn Site Shell theo Baseline V1.1 mà không thay đổi bố
cục frontend đã duyệt.

## Đã thực hiện

-   Thêm Globals: Header, Footer, Contact Settings, Social Settings,
    Medpro Settings, Theme Settings.
-   SiteHeader ưu tiên đọc cấu hình mới, fallback SiteSettings cũ để
    tương thích dữ liệu.
-   SiteFooter hỗ trợ cột liên kết động (tối đa 4 trong Admin; frontend
    hiện dùng 3 cột cạnh nhận diện), copyright {CURRENT_YEAR}, bật/tắt
    social/mobile bar.
-   Navigation bổ sung mục cha không link, icon và mô tả; giữ cơ chế
    hover dropdown hiện tại.
-   Theme hỗ trợ màu chính/phụ/nhấn và độ rộng nội dung; không thay CSS
    giao diện đã duyệt.
-   Contact/Social/Medpro được tách cấu hình riêng nhưng vẫn fallback dữ
    liệu cũ.
-   Thêm `npm run validate:site-shell`.

## Kiểm tra

-   Static Site Shell validator: 13/13 PASS.
-   Chưa chạy TypeScript/build trong gói nguồn vì ZIP không chứa
    node_modules. Cần chạy `npm install`, `npm run typecheck` và build
    tại máy triển khai trước khi đánh dấu nghiệm thu hoàn toàn.

## Tương thích

Không xóa field cũ trong SiteSettings. Các cấu hình cũ vẫn được frontend
dùng làm fallback, tránh mất dữ liệu khi nâng phiên bản.

------------------------------------------------------------------------

## 36. UPDATE-V3.5.0-PUBLIC-CONTENT-BASELINE.md

> Nguồn: `UPDATE-V3.5.0-PUBLIC-CONTENT-BASELINE.md`

# v3.5.0 --- Public Content Baseline

## Mục tiêu

Chuẩn hóa Tin tức, Thông báo, Đấu thầu -- Mua sắm, Tuyển dụng, Văn bản
và Trang nội dung theo Baseline V1.1 mà không làm mất dữ liệu cũ.

## Đã thực hiện

-   Thêm `categories` quản lý chuyên mục tập trung; giữ các field chuyên
    mục cũ để tương thích.
-   Thêm workflow Nháp → Gửi duyệt → Duyệt → Xuất bản/Ẩn và kiểm tra
    quyền phía server.
-   Bật Payload Trash cho News, Notices, Procurement, Recruitment,
    Documents, Pages.
-   Slug vẫn tự sinh tiếng Việt khi để trống nhưng nay cho phép chỉnh
    thủ công.
-   Thêm `redirects`; khi đổi slug của nội dung đã xuất bản hệ thống tạo
    mapping 301 tự động.
-   Thêm route fallback để thực thi redirect 301 động.
-   Thêm `default-media-settings` cho thumbnail mặc định từng module;
    danh sách Tin tức/Thông báo/Đấu thầu sử dụng fallback này.
-   Tuyển dụng chuyển sang nhiều tệp đính kèm nhưng giữ `attachment` cũ
    để không mất dữ liệu.
-   Mở rộng Văn bản: chuyên mục chuẩn, cơ quan ban hành, ngày hiệu lực,
    trích yếu, SEO và versions.

## Lưu ý nâng cấp dữ liệu

Payload có thể hỏi tạo bảng/cột mới cho categories, redirects,
trash/deletedAt, workflowState, categoryRef và default-media-settings.
Chỉ chọn CREATE/ADD. Không đồng ý DROP cột cũ.

## Kiểm tra

`npm run validate:public-content`

------------------------------------------------------------------------

## 37. UPDATE-V3.6.0-PATIENT-SERVICES-BASELINE.md

> Nguồn: `UPDATE-V3.6.0-PATIENT-SERVICES-BASELINE.md`

# v3.6.0 -- Patient Services Baseline

## Mục tiêu

Chuẩn hóa nhóm dịch vụ người bệnh theo Baseline V1.1, đồng thời giữ
tương thích dữ liệu v3.5.x trở về trước.

## Đã thực hiện

-   Tách `servicePrices` khỏi `services`, lưu lịch sử giá với ngày hiệu
    lực và số quyết định.
-   Tách `vaccines`, `vaccinePrices`, `vaccinationSchedules`; giữ
    `vaccinations` cũ làm lớp tương thích.
-   Lịch khám mặc định ưu tiên ảnh/tệp lịch tuần; bổ sung tính chất lịch
    chính thức/điều chỉnh và nhiều tệp bổ sung.
-   Import Excel dịch vụ chuyển sang 2 bước Kiểm tra (Preview) → Xác
    nhận nhập, bắt buộc ngày hiệu lực và lưu lịch sử giá.
-   Thêm `importJobs` để lưu lịch sử các lần nhập dữ liệu.
-   Frontend bảng giá lấy mức giá đang có hiệu lực; fallback sang giá cũ
    nếu chưa có lịch sử.
-   Frontend tiêm chủng lấy collection mới và fallback dữ liệu cũ khi
    chưa chuyển đổi.

## Lưu ý migration

Không xóa các field `insurancePrice`, `price` trong `services` và không
xóa collection `vaccinations` ở phiên bản này. Sau khi dữ liệu mới ổn
định mới thực hiện migration/cleanup có kiểm soát.

------------------------------------------------------------------------

## 38. UPDATE-V3.7.0-ORGANIZATION-BASELINE.md

> Nguồn: `UPDATE-V3.7.0-ORGANIZATION-BASELINE.md`

# v3.7.0 -- Organization Baseline

## Mục tiêu

Chuẩn hóa lớp Tổ chức theo Baseline V1.1 mà không phá dữ liệu Khoa/Phòng
và Bác sĩ hiện có.

## Thay đổi

-   Thêm collection `specialties` (Chuyên khoa), liên kết bắt buộc với
    Khoa/Phòng.
-   Bác sĩ có `specialtyRef` relationship; giữ `specialty` text cũ để
    tương thích dữ liệu.
-   Khoa/Phòng bổ sung phân loại chuẩn `unitType`, chức năng nhiệm vụ,
    hoạt động, thành tích, lãnh đạo, liên hệ, gallery, thứ tự và trạng
    thái.
-   Giữ `kind` cũ để không làm mất dữ liệu đang có.
-   Bác sĩ bổ sung học hàm/học vị, chức danh nghề nghiệp, giấy phép (tùy
    công khai), chuyên môn, thành tích, featured/order/active.
-   User khoa/phòng được scope server-side theo `department` khi sửa Bác
    sĩ/Chuyên khoa; hook ép department về đơn vị được gán để tránh ghi
    chéo khoa.
-   Thêm route chuẩn `/khoa-phong`, `/khoa-phong/[slug]`,
    `/chuyen-khoa`, `/chuyen-khoa/[slug]`.
-   Giữ route `/don-vi` cũ để tương thích link đã phát hành.
-   Navigation có preset/reference cho Khoa/Phòng và Chuyên khoa.
-   Sitemap bổ sung Chuyên khoa và route chuẩn Khoa/Phòng.

## Kiểm tra

Chạy `npm run validate:organization`. Trước typecheck/build cần chạy
`npm run generate:types` vì có collection mới.

------------------------------------------------------------------------

## 39. UPDATE-V3.8.0-HOMEPAGE-SEO-SEARCH.md

> Nguồn: `UPDATE-V3.8.0-HOMEPAGE-SEO-SEARCH.md`

# v3.8.0 -- Homepage Builder + SEO + Search Baseline

## Thay đổi chính

-   Loại bỏ cơ chế `afterRead` tự chèn lại section trang chủ đã bị Admin
    xóa.
-   Frontend render section theo đúng mảng `homepage.sections`: thứ tự
    kéo-thả trong Admin là thứ tự thật ngoài trang chủ.
-   Section bị xóa không tự xuất hiện lại; section `visible=false` không
    render.
-   Bổ sung `dynamic-modules` và loại section `dynamic-module` để tái sử
    dụng module nội dung.
-   Bổ sung Global `seo-settings`: title mặc định, description, ảnh OG,
    index/noindex toàn site, sitemap, robots, Google verification.
-   Bổ sung SEO per-document: canonical URL, noindex, loại khỏi sitemap.
-   robots.txt và sitemap.xml đọc cấu hình Admin.
-   Tìm kiếm mở rộng: Tin tức, Thông báo, Đấu thầu, Trang, Tuyển dụng,
    Bác sĩ, Khoa/Phòng, Chuyên khoa, Dịch vụ, Vắc xin.
-   Trang tìm kiếm được noindex.
-   Bổ sung Draft Preview cho Homepage qua `/api/preview` và
    `/api/exit-preview`, bảo vệ bằng `PREVIEW_SECRET`.
-   Giữ Redirect 301 đã có từ v3.5.0.

## Biến môi trường mới

`PREVIEW_SECRET=<chuỗi bí mật mạnh>`

## Kiểm tra

`npm run validate:homepage-seo-search`

------------------------------------------------------------------------

## 40. UPDATE-V3.9.0-CHATBOT-FORMS-FEEDBACK.md

> Nguồn: `UPDATE-V3.9.0-CHATBOT-FORMS-FEEDBACK.md`

# v3.9.0 --- Chatbot + Forms + Phản ánh/Góp ý

## Mục tiêu

Hoàn thiện giai đoạn Chatbot/Forms/Feedback theo Baseline V1.1 mà không
phá các chức năng CSKH cũ.

## Đã bổ sung

-   FAQs, Forms, FormSubmissions.
-   FeedbackCategories, FeedbackCases, FeedbackActions (timeline bất
    biến ở tầng CRUD thông thường).
-   ChatbotIntents, ChatbotConversations, ChatbotUnanswered.
-   Global chatbot-settings; frontend vẫn fallback cấu hình
    websiteAssistant cũ để tương thích.
-   `/gop-y`, `/gop-y/tra-cuu`, `/bieu-mau/[slug]`.
-   API phản ánh tạo mã tra cứu + xác thực bằng mã và số điện thoại.
-   API chatbot dò intent, ghi hội thoại và gom câu hỏi chưa trả lời.
-   API biểu mẫu động kiểm tra field bắt buộc trước khi lưu submission.
-   Rate limit và honeypot cho các luồng public.

## Tương thích

-   Collection `feedback` và `consultations` cũ vẫn được giữ nguyên để
    tránh mất dữ liệu.
-   Chatbot cũ trong SiteSettings vẫn là fallback nếu Global mới chưa
    cấu hình.

## Chưa phải UAT

Static validation chỉ xác nhận cấu trúc nguồn. Cần chạy `npm install`,
generate types/importmap, typecheck, dev và test DB thật trên máy triển
khai.

------------------------------------------------------------------------

## 41. UPDATE-V4.1.0-SYSTEM-HARDENING.md

> Nguồn: `UPDATE-V4.1.0-SYSTEM-HARDENING.md`

# v4.1.0 --- System Hardening Baseline

-   Audit Log bất biến cho thay đổi collection/global có người dùng xác
    thực; ghi thêm sự kiện đăng nhập thành công.
-   Media Access Control: khách chỉ đọc `public`; tài khoản có quyền
    `media/view` mới đọc `internal/restricted`.
-   Media bật Trash, tính SHA-256, đánh dấu file trùng và áp giới hạn
    upload theo `upload-settings`.
-   Chặn upload khi storage đạt ngưỡng cấu hình.
-   Health endpoint kiểm tra application + PostgreSQL + khả năng ghi/xóa
    thư mục media.
-   Thêm SystemSettings và ScheduleSettings còn thiếu trong danh sách
    Global baseline.
-   Security headers: CSP, HSTS production, no-sniff,
    frame/referrer/permissions policy; Admin/API noindex.
-   Tắt GraphQL vì website không sử dụng để giảm bề mặt API.
-   Backup có checksum + pg_restore list validation; restore bắt buộc
    verify trước khi ghi đè.

## Chưa tự động xác nhận

Full `npm run typecheck`, `npm run build`, restore drill trên PostgreSQL
thật, reverse proxy HTTPS và browser/UAT phải chạy tại môi trường triển
khai có dependencies + database.

------------------------------------------------------------------------

## 42. UPDATE-V4.2.0-UAT-PRODUCTION-READINESS.md

> Nguồn: `UPDATE-V4.2.0-UAT-PRODUCTION-READINESS.md`

# v4.2.0 --- UAT + Production Readiness

-   Thêm `.env.production.example` an toàn, không chứa secret thật.

-   Thêm production environment preflight.

-   Thêm smoke test HTTP cho các route công khai, health và security
    headers.

-   Thêm validator UAT/Production static readiness.

-   Thêm `validate:all` và `deploy:check`.

-   Thêm checklist UAT cuối và hướng dẫn triển khai Production.

-   Không thay đổi schema nghiệp vụ hay giao diện frontend ở phiên bản
    này.

-   Runtime UAT/build/typecheck chỉ được đánh PASS khi chạy trên môi
    trường có dependencies, PostgreSQL và dữ liệu test phù hợp.

-   Loại bỏ `package-lock.json` cũ vì không còn đồng bộ với dependency
    QR đã thêm ở v4.0.0; chạy `npm install` sẽ tạo lock mới đúng với
    package hiện tại. Dockerfile cũng dùng `npm install` để tránh
    `npm ci` thất bại với lock cũ.

------------------------------------------------------------------------

## 43. UPDATE-V4.2.3-HOME-CONTENT-HEADER-SEARCH.md

> Nguồn: `UPDATE-V4.2.3-HOME-CONTENT-HEADER-SEARCH.md`

# v4.2.3 -- Home Content + Header Search

-   Bỏ bảng giá dịch vụ khỏi block Văn bản trên trang chủ; trang
    `/bang-gia` và dữ liệu bảng giá vẫn được giữ nguyên.
-   Block Thông báo và Đấu thầu -- Mua sắm hiển thị 1 bài nổi bật + 4
    bài phụ, có ảnh đại diện và fallback ảnh mặc định.
-   Hiển thị `workingHours` từ Contact Settings trên thanh thông tin đầu
    trang.
-   Ô tìm kiếm đầu trang đổi thành form nhập trực tiếp, rộng hơn; Enter
    hoặc nút kính lúp gửi GET tới `/tim-kiem?q=...`.
-   Không thay đổi cấu trúc dữ liệu nghiệp vụ hoặc xóa các chức năng đã
    có.

------------------------------------------------------------------------

## 44. UPDATE-V4.2.6-LOGIN-RUNTIME-FIX.md

> Nguồn: `UPDATE-V4.2.6-LOGIN-RUNTIME-FIX.md`

# v4.2.6 - Admin login runtime fix

-   Loại bỏ nested `payload.update(users)` trong `afterLogin`.
-   Giữ kiểm tra tài khoản `active/locked/inactive` ở `beforeLogin`.
-   Giữ Audit Login nhưng lỗi audit không chặn quá trình đăng nhập.
-   Không thay đổi database schema.

Nếu tài khoản cũ chưa có `status`, logic hiện tại vẫn xem là active để
tương thích dữ liệu cũ.

------------------------------------------------------------------------

## 45. UPDATE-V4.2.7-ADMIN-AUTH-TRANSPORT-FIX.md

> Nguồn: `UPDATE-V4.2.7-ADMIN-AUTH-TRANSPORT-FIX.md`

# v4.2.7 -- Admin Auth Transport Fix

-   Loại bỏ hoàn toàn `afterLogin` custom hook khỏi Users để luồng login
    trở về Payload mặc định sau `beforeLogin`.
-   Không bọc collection `users` bằng audit `afterChange`, tránh nested
    DB write trong các thao tác auth nội bộ.
-   Giữ `beforeLogin` chỉ để chặn tài khoản `locked/inactive`.
-   Khai báo `serverURL` rõ ràng.
-   Development cho phép đồng thời `http://localhost:3000` và
    `http://127.0.0.1:3000` trong CORS/CSRF, Production chỉ dùng URL cấu
    hình.
-   Thêm `/api/auth-check` để kiểm tra đường truyền Next/Payload mà
    không lộ bí mật.
-   Không đổi schema database.

------------------------------------------------------------------------

## 46. UPDATE-V4.3.1-BUILD-TYPECHECK-FIX.md

> Nguồn: `UPDATE-V4.3.1-BUILD-TYPECHECK-FIX.md`

# v4.3.1 -- Build / Typecheck Fix

Sửa các lỗi TypeScript được phát hiện khi chạy `npm run build` trên
v4.3.0, giữ nguyên giao diện và lớp Production Security.

-   Chuyển script `scripts/import-services.ts` từ `xlsx` sang `exceljs`
    đồng bộ với API import.
-   Sửa type inference khi seed tài khoản quản trị Payload.
-   Sửa null-safety cho `req.user` trong access helpers.
-   Chuẩn hóa kiểu relationship ID và priority khi tạo phản ánh.
-   Sửa kiểu buffer khi ExcelJS đọc file upload trên Node 24.
-   Sửa type inference khi tạo lịch sử giá dịch vụ.
-   Sửa toàn bộ collection slug khảo sát sang slug thực tế dạng
    `survey-*`.
-   Chuẩn hóa campaign ID khảo sát sang number trước khi query.
-   Sửa biểu thức boolean trong màn hình Admin Import Excel.

Không thay đổi schema DB có chủ đích, không xóa dữ liệu và không thay
đổi giao diện trang chủ/Admin.

------------------------------------------------------------------------

## 47. UPDATE-V4.3.2-SCHEDULE-VACCINATION-UI-DETAIL.md

> Nguồn: `UPDATE-V4.3.2-SCHEDULE-VACCINATION-UI-DETAIL.md`

# v4.3.2

-   Trang chủ Lịch khám và Thông tin tiêm ngừa chỉ còn một nút Xem tất
    cả ở tiêu đề block.
-   Bỏ nút Xem tất cả lặp lại phía dưới khi component chạy compact trên
    trang chủ.
-   Trang danh sách vẫn giữ chức năng mở rộng khi có trên 5 nội dung.
-   Chi tiết Lịch khám và Tiêm ngừa dùng cùng article shell, lead, khung
    ảnh và nút Trở lại danh sách như Tin tức/Thông báo.
-   Không thay đổi schema/database hoặc lớp Production Security v4.3.1.

------------------------------------------------------------------------

## 48. UPDATE-V4.3.3-HOME-VIEWALL-LISTING-HEADER.md

> Nguồn: `UPDATE-V4.3.3-HOME-VIEWALL-LISTING-HEADER.md`

# v4.3.3 -- Header / Xem tất cả / Lịch khám & Tiêm chủng

-   Thanh tiện ích trên đầu chỉ còn hiển thị thứ hiện tại và giờ hiện
    tại ở phía trái; địa chỉ, giờ làm việc, điện thoại và email tiếp tục
    hiển thị ở Footer.
-   Giữ mạng xã hội và ô tìm kiếm phía phải.
-   Bỏ nút "Xem tất cả" thứ hai bên trong Cổng thông tin bệnh viện.
-   Bỏ nút "Xem tất cả văn bản" thứ hai trong khối Văn bản mới.
-   /lich-kham đổi sang giao diện danh sách giống Tin tức: tìm kiếm, tab
    loại nội dung, số lượng và card 3 cột.
-   /tiem-chung đổi sang giao diện danh sách giống Tin tức: tìm kiếm,
    tab loại nội dung, số lượng và card 3 cột.
-   Không thay đổi schema/database, auth hoặc Production Security.

------------------------------------------------------------------------

## 49. UPDATE-V4.3.4-HOME-ADMIN-SLUG-DATE.md

> Nguồn: `UPDATE-V4.3.4-HOME-ADMIN-SLUG-DATE.md`

# v4.3.4 -- Header time, Footer contact, Homepage section visibility, Specialty slug, Post date

-   Thanh utility chỉ hiển thị thời gian dạng
    `Thứ 6, 4/9/2026, 09:38:25 AM` và cập nhật mỗi giây.
-   Địa chỉ, điện thoại/cấp cứu, email và thời gian làm việc được gom về
    Footer.
-   Homepage Admin làm rõ công tắc Hiển thị/Ẩn cho từng section; section
    tắt không render ngoài frontend nhưng cấu hình vẫn được giữ.
-   Chuyên khoa: slug có thể để trống khi tạo mới và tự sinh từ tên. Nếu
    slug trùng, Admin báo chính slug bị trùng để người dùng chỉnh trực
    tiếp.
-   Các block bài đăng hoạt động khoa học hiển thị thêm ngày đăng; cột
    Ngày đăng cũng được bổ sung trong danh sách Admin Thông báo và Đấu
    thầu.
-   Không thay đổi database schema theo hướng destructive; không thay
    đổi auth/security của v4.3.x.

------------------------------------------------------------------------

## 50. UPDATE-V4.3.5-CONTENT-CONSISTENCY-SYNC.md

> Nguồn: `UPDATE-V4.3.5-CONTENT-CONSISTENCY-SYNC.md`

# v4.3.5 -- Đồng bộ nội dung toàn hệ thống

-   Chuẩn hóa slug tự sinh và cảnh báo slug trùng cho các collection có
    slug.
-   Chuyên khoa dùng cùng cơ chế slug chuẩn với Tin tức/Thông báo/Đấu
    thầu/Trang/Tài liệu/...
-   Chuẩn hóa ngày đăng trên danh sách và trang chi tiết Tin tức, Thông
    báo, Đấu thầu -- Mua sắm, Tuyển dụng.
-   Thông báo ưu tiên Ngày đăng; Ngày bắt đầu/Ngày hết hiệu lực vẫn giữ
    đúng nghiệp vụ riêng.
-   Tuyển dụng hiển thị riêng Ngày đăng và Hạn nộp, không dùng Hạn nộp
    thay Ngày đăng.
-   Đấu thầu hiển thị riêng Ngày đăng và Hạn tiếp nhận.
-   Mọi section thuộc Bố cục trang chủ tiếp tục có công tắc Ẩn/Hiện và
    giữ nguyên cấu hình khi ẩn.
-   Giữ địa chỉ, điện thoại, email và thời gian làm việc tại Footer;
    utility bar chỉ hiển thị thời gian hiện tại + mạng xã hội + tìm
    kiếm.
-   Không thay đổi schema dữ liệu nghiệp vụ, quyền truy cập hay lớp
    Production Security.

------------------------------------------------------------------------

## 51. UPDATE-V4.3.6-CONTENT-IMAGE-FIT.md

> Nguồn: `UPDATE-V4.3.6-CONTENT-IMAGE-FIT.md`

# v4.3.6 -- Content image fit

-   Ảnh card Tin tức/Thông báo/Đấu thầu/Tuyển dụng/Văn bản dùng
    `contain` thay vì `cover`.
-   Giữ khung 16:9 nhưng không cắt mất chữ/nội dung trong ảnh banner mặc
    định.
-   Ảnh trang chủ dạng news/editorial cũng dùng
    `background-size: contain`.
-   Nền sáng trung tính được thêm vào phần dư khi tỷ lệ ảnh không trùng
    khung.
-   Không thay đổi database, admin, auth hay production security.

------------------------------------------------------------------------

## 52. UPDATE-V4.3.7-DEFAULT-COVER-LIST-ONLY.md

> Nguồn: `UPDATE-V4.3.7-DEFAULT-COVER-LIST-ONLY.md`

# v4.3.7 -- Ảnh mặc định ngoài danh sách, không hiện đầu bài chi tiết

-   Nếu Tin tức / Thông báo / Đấu thầu -- Mua sắm / Tuyển dụng không
    chọn ảnh đại diện, frontend dùng ảnh mặc định đã cấu hình trong
    **Ảnh mặc định nội dung**.
-   Trang chủ Tin tức cũng dùng ảnh mặc định (trước đây chỉ danh sách
    riêng có fallback).
-   Trang chi tiết Tin tức / Thông báo / Đấu thầu -- Mua sắm / Tuyển
    dụng không còn render ảnh đại diện ở đầu bài.
-   Ảnh SEO vẫn có thể dùng cho Open Graph khi chia sẻ, nhưng không hiển
    thị trực tiếp trong nội dung bài.
-   Ảnh được chèn bên trong Rich Text vẫn giữ nguyên.
-   Văn bản -- Tài liệu tiếp tục dùng ảnh mặc định cấu hình cho các giao
    diện có card/thumbnail; trang /van-ban hiện là danh sách tệp nên
    không ép thêm ảnh vào từng dòng.

------------------------------------------------------------------------

## 53. UPDATE-V4.3.8-COVER-ORIGINAL-FIT.md

> Nguồn: `UPDATE-V4.3.8-COVER-ORIGINAL-FIT.md`

# v4.3.8 -- Ảnh đại diện hiển thị nguyên vẹn

-   Sửa trang chủ Tin tức, Thông báo và Đấu thầu không dùng biến thể
    `card` của Payload nữa.
-   Biến thể `card` có thể đã bị crop ngay khi Payload tạo image size,
    nên CSS `object-fit: contain` vẫn không khôi phục được phần ảnh đã
    bị cắt.
-   Từ bản này card frontend dùng URL ảnh gốc (`media.url`) rồi hiển thị
    bằng `contain`.
-   Ảnh mặc định và ảnh đại diện tự upload đều hiển thị nguyên vẹn trong
    khung.
-   Không thay đổi ảnh trong nội dung bài viết, database, auth hoặc
    Production Security.

------------------------------------------------------------------------

## 54. UPDATE-V4.3.9-ADMIN-GROUPING-UI-POLISH.md

> Nguồn: `UPDATE-V4.3.9-ADMIN-GROUPING-UI-POLISH.md`

# v4.3.9 --- Admin grouping & UI polish

-   Gộp `Giao diện & bố cục trang chủ` và `Menu website` vào đúng nhóm
    **Trang chủ & Giao diện**.
-   Chuyển **Ảnh mặc định nội dung** sang **Trang chủ & Giao diện** vì
    đây là cấu hình hiển thị/fallback hình ảnh.
-   Chuyển **Chatbot** khỏi nhóm riêng `Cấu hình website` sang **CSKH**,
    cùng các mục hội thoại/ý định/câu hỏi chưa trả lời.
-   Giữ **Cấu hình website**, **Giới hạn Upload**, **SEO & Công cụ tìm
    kiếm**, **Cấu hình hệ thống**, người dùng, audit, redirect, lịch sử
    import trong **Hệ thống**.
-   Làm mới giao diện nhóm card Admin: mỗi nhóm thành một panel rõ ràng,
    màu nhấn đồng nhất theo nhóm, card gọn hơn, hover nhẹ, responsive
    tốt hơn.
-   Không thay đổi dữ liệu, slug collection/global, phân quyền hay
    Production Security.

------------------------------------------------------------------------

## 55. UPDATE-V4.4.0-SMART-LINK-PAGE-AUTOCREATE.md

> Nguồn: `UPDATE-V4.4.0-SMART-LINK-PAGE-AUTOCREATE.md`

# v4.4.0 -- Smart Link & Page Auto-create

## Mục tiêu

Đồng bộ cách tạo liên kết trong Admin để người quản trị không phải tự
nhớ URL.

## Menu website

-   Giữ các lựa chọn mục có sẵn và bài/nội dung có sẵn.
-   Thêm **Tự tạo trang liên kết mới**.
-   Hệ thống tự sinh slug từ tên menu.
-   Nếu slug đã có trong `Trang nội dung`, hệ thống dùng lại trang đó
    thay vì tạo trùng.
-   Nếu chưa có, hệ thống tạo một `Trang nội dung` đã xuất bản và gắn
    menu vào đúng trang.
-   Áp dụng cả menu chính và menu con.

## Dịch vụ nhanh

Mỗi mục có 4 cách liên kết: 1. Tự tạo trang mới / dùng trang cùng slug
đã có. 2. Chọn Trang nội dung đã có. 3. Nhập đường dẫn nội bộ. 4. Liên
kết website bên ngoài.

Khi dùng chế độ 1 hoặc 2, URL được hệ thống tự lưu.

## Section và mục con section

Áp dụng Smart Link cho nội dung thủ công trong: - Cổng thông tin / Hoạt
động khoa học. - Đơn vị trực thuộc. - Lịch khám. - Tiêm ngừa. - Section
tùy chỉnh (nút Xem chi tiết).

Trang tự sinh xuất hiện tại **Admin → Nội dung → Trang nội dung** để
tiếp tục soạn nội dung.

## Tương thích

-   URL cũ vẫn giữ nguyên và tiếp tục hoạt động.
-   Không xóa hoặc đổi dữ liệu menu/quick link/section cũ.
-   Không thay đổi lớp Production Security.

------------------------------------------------------------------------

## 56. UPDATE-V4.4.1-SEARCH-FOOTER-ADMIN.md

> Nguồn: `UPDATE-V4.4.1-SEARCH-FOOTER-ADMIN.md`

# v4.4.1 -- Search UI & Footer Admin

-   Làm lại trang Tìm kiếm: khung tra cứu hiện đại, lọc nhanh dạng chip,
    danh sách kết quả dạng card, trạng thái không có kết quả.
-   Footer được quản trị đầy đủ: bật/tắt toàn Footer, từng thông tin
    bệnh viện, mạng xã hội, từng cột, từng liên kết, thanh bản quyền và
    thanh tiện ích mobile.
-   Xóa hết cột trong Admin thì frontend không tự chèn lại 3 cột
    hard-code.
-   Liên kết Footer hỗ trợ Smart Link: tự tạo trang / chọn trang đã có /
    nội bộ / bên ngoài.
-   Footer tự điều chỉnh số cột theo cấu hình Admin và responsive.

------------------------------------------------------------------------

## 57. UPDATE-V4.4.2-FEATURED-SPECIALTY-MEDPRO.md

> Nguồn: `UPDATE-V4.4.2-FEATURED-SPECIALTY-MEDPRO.md`

# v4.4.2 -- Featured carousel, Chuyên khoa & Medpro Admin

-   Điểm tin nổi bật tự động trộn Tin tức, Thông báo, Đấu thầu -- Mua
    sắm và Lịch khám mới; tự chuyển và có nút trước/sau.
-   Khối Chuyên khoa bỏ tab Khối lâm sàng/Cận lâm sàng, chỉ hiển thị
    danh sách chuyên khoa.
-   Section Chuyên khoa trong Homepage Admin có trường thay ảnh giữa.
-   Khối Medpro phía phải được đưa vào Admin để chỉnh tiêu đề, 3 dòng
    lợi ích, thương hiệu, nút, link hướng dẫn, màu nền hoặc ẩn hoàn
    toàn.
-   Không thay đổi database nghiệp vụ, auth hay Production Security.

------------------------------------------------------------------------

## 58. UPDATE-V4.4.3-FEATURED-CAROUSEL-ADMIN-LIMIT.md

> Nguồn: `UPDATE-V4.4.3-FEATURED-CAROUSEL-ADMIN-LIMIT.md`

# v4.4.3 -- Featured Carousel Admin Limit

-   Thêm trường **Tổng số nội dung tham gia chuyển động** cho section
    Điểm tin nổi bật.
-   Admin có thể chọn từ 4 đến 40 nội dung. Mặc định 16.
-   Desktop vẫn luôn hiển thị tối đa 4 card cùng lúc; các nội dung còn
    lại lần lượt chạy qua carousel.
-   Không thay đổi database nghiệp vụ, quyền truy cập hay Production
    Security.

------------------------------------------------------------------------

## 59. V3.1.2-NAVIGATION-TYPES-FIX.md

> Nguồn: `V3.1.2-NAVIGATION-TYPES-FIX.md`

# V3.1.2 --- Fix TypeScript Navigation

Nguyên nhân: `menuLinkFields` trước đây không được khai báo kiểu
`Field[]`, nên TypeScript làm rộng `relationTo: ['pages', ...]` thành
`string[]`. Payload 3.88 yêu cầu các giá trị này là `CollectionSlug`, vì
vậy `tsc` báo `string[] is not assignable to CollectionSlug`.

Đã sửa: - `import type { Field, GlobalConfig } from 'payload'` -
`menuLinkFields` đổi thành factory `(): Field[]` - Mỗi lần dùng tạo một
danh sách Field được contextual typing đúng bởi Payload. - Không đổi
schema database, không đổi tên field, không cần reset dữ liệu.

Chạy:

``` powershell
npm install
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run dev
```

------------------------------------------------------------------------

## 60. V4.0.0-QUALITY-SURVEY-NOTES.md

> Nguồn: `V4.0.0-QUALITY-SURVEY-NOTES.md`

# v4.0.0 -- Khảo sát hài lòng & Quản lý chất lượng

Bổ sung kiến trúc khảo sát theo Baseline V1.1: mẫu, phiên bản khóa, câu
hỏi, chiến dịch, mã khảo sát, phản hồi, câu trả lời và thống kê. Có
trang khảo sát công khai `/khao-sat/[slug]`, API gửi phản hồi, API QR
SVG, thống kê và CSV export có kiểm tra quyền quản trị/QLCL.

## Nguyên tắc dữ liệu

-   Phiên bản đã `locked` không được sửa; phải tạo phiên bản mới.
-   Response/Answer không cho update qua collection access, giữ snapshot
    câu hỏi khi trả lời.
-   Campaign tham chiếu phiên bản mẫu cụ thể.
-   API public có rate limit + honeypot; API thống kê/export yêu cầu
    user có role quản trị hoặc quality-management.

## Sau khi giải nén

`npm install` → `npm run generate:types` → `npm run generate:importmap`
→ `npm run validate:quality-surveys` → `npm run typecheck` →
`npm run dev`.


---

## CẬP NHẬT V4.4.5 – ẢNH MẶC ĐỊNH MỞ RỘNG & VĂN BẢN DẠNG CARD

- Bổ sung ảnh mặc định cho Lịch khám và Lịch tiêm chủng/Tiêm ngừa.
- Bổ sung danh sách Ảnh mặc định bổ sung để Admin có thể tạo thêm khóa + tên mục + ảnh cho các module phát sinh sau này.
- Văn bản – Tài liệu trên trang chủ chuyển sang bố cục card 1 chính + 4 phụ, đồng bộ Thông báo/Đấu thầu.
- Trang /van-ban chuyển sang giao diện tìm kiếm/lọc/card như các nhóm nội dung khác.
- Văn bản có thể chọn ảnh đại diện riêng; nếu bỏ trống dùng ảnh mặc định Văn bản – Tài liệu.
- Lịch khám và Tiêm chủng khi không có ảnh riêng sẽ tự dùng ảnh mặc định tương ứng.
- Ảnh card tiếp tục dùng contain, không cắt ảnh.


---

## Cập nhật v4.4.6 – Menu tự tạo mục nội dung

- Bổ sung kiểu liên kết Menu: **Tự tạo MỤC NỘI DUNG mới**.
- Ví dụ tạo menu **Chuyển đổi số** sẽ tự sinh mục nội dung `chuyen-doi-so` và URL `/noi-dung/chuyen-doi-so`.
- Nếu mục có cùng slug đã tồn tại thì dùng lại, không tạo trùng.
- Bổ sung collection **Mục nội dung mở rộng** để quản lý tên mục, mô tả và ảnh mặc định.
- Bổ sung collection **Bài viết mở rộng** để đăng nhiều bài cho từng mục, với ảnh đại diện, mô tả, rich text, file đính kèm, ngày đăng và SEO tương tự Thông báo/Đấu thầu.
- Bổ sung trang danh sách `/noi-dung/[sectionSlug]` và trang chi tiết `/noi-dung/[sectionSlug]/[slug]`.
- Menu cũng có thể chọn lại một mục nội dung mở rộng đã có để lấy đúng liên kết.


---

## Cập nhật v4.4.7 – Menu tự sinh mục Nội dung & tái sử dụng Khoa/Phòng cho Chuyên khoa

- Menu kiểu **Tự tạo MỤC NỘI DUNG mới** tiếp tục tạo bản ghi `content-sections`, nhưng URL public được chuẩn hóa trực tiếp dạng `/{slug}` và `/{slug}/{slug-bai}` (ví dụ `/chuyen-doi-so`) giống `/thong-bao`.
- Dashboard Admin bổ sung khối **Nội dung tự sinh từ Menu**, tự đọc các mục đã tạo và hiển thị card theo đúng tên như **Chuyển đổi số**, kèm số bài và thao tác xem/thêm bài.
- Chuyên khoa có lựa chọn **Dùng tên Khoa / Phòng đã có làm Chuyên khoa**. Khi bật, quản trị viên chỉ cần chọn Khoa/Phòng đã nhập; hệ thống tự lấy tên và slug, tránh gõ lại dữ liệu.
- Giữ nguyên dữ liệu Khoa/Phòng cũ, không copy/xóa các bản ghi hiện có.


---

## Cập nhật v4.4.8 - Section liên kết mục nội dung động

- Bổ sung loại section `Mục nội dung từ Menu`.
- Chọn trực tiếp `content-sections` như Chuyển đổi số.
- Trang chủ tự lấy bài thuộc mục, 1 bài lớn + các bài nhỏ theo số lượng cấu hình.
- Nút Xem tất cả tự sinh URL `/{slug-muc}` và card tự sinh `/{slug-muc}/{slug-bai}`.
- Không cần nhập URL thủ công.

---

## UPDATE V4.4.9 — SPECIALTY / DEPARTMENT REUSE FIX

- Sửa form Tạo mới Chuyên khoa không tải được danh sách Khoa/Phòng cũ.
- Thêm API Admin bảo vệ bằng phiên đăng nhập, đọc trực tiếp collection `departments` với `overrideAccess` và `draft: true`, nên lấy được cả dữ liệu đã lưu và bản nháp trong PostgreSQL.
- Thêm bộ chọn Khoa/Phòng riêng trong form Chuyên khoa; khi chọn sẽ tự điền tên và slug.
- Nếu Khoa/Phòng đã có Chuyên khoa (đối chiếu theo quan hệ, slug hoặc tên), form hiển thị trạng thái **ĐÃ CÓ CHUYÊN KHOA** và liên kết mở bản ghi cũ để tránh tạo trùng.
- Field quan hệ `department` vẫn được lưu đúng trong PostgreSQL nhưng ẩn khỏi UI mặc định để tránh dropdown Payload không tải được dữ liệu như trước.


---

## UPDATE V4.4.10 - SPECIALTY POSTGRES DIRECT FIX

- Sửa bộ chọn Khoa/Phòng trong Chuyên khoa: đọc trực tiếp bảng `departments` qua `DATABASE_URL` bằng `pg`, thay vì Payload Local API.
- Giữ xác thực Admin trước khi cho phép đọc danh sách.
- Hiển thị nguồn và số lượng Khoa/Phòng đọc được để dễ chẩn đoán.
- Nếu pgAdmin có dữ liệu nhưng website vẫn trả 0, cần kiểm tra `.env` có trỏ đúng database `thoi_lai_hospital`.


---

## Cập nhật v4.4.11 — Dashboard & tài khoản đăng nhập

- Hiển thị rõ Họ tên, email, vai trò/quyền và trạng thái của tài khoản đang đăng nhập ngay trên Dashboard.
- Mở rộng nhãn vai trò cho toàn bộ role hiện có trong Users.
- Dashboard bổ sung thống kê Tuyển dụng, Nội dung tự sinh từ Menu, Lịch tiêm chủng, Chuyên khoa, Bác sĩ, Media và tài khoản người dùng.
- Bổ sung khối Tổng quan vận hành, thao tác nhanh Lịch tiêm và cải thiện responsive.
- Không thay đổi schema PostgreSQL, auth, quyền truy cập hoặc lớp Production Security.


## v4.4.19-stable-baseline (05/09/2026)
- Baseline hiệu năng/giao diện quay về v4.4.11-admin-dashboard-account theo kiểm chứng thực tế.
- Tắt hoàn toàn DB schema push khi startup (`push: false`); predev/prestart không chạy repair/migration.
- Giữ script audit/migrate legacy và repair Payload version visibility ở chế độ chạy thủ công.
- Khoa/Phòng là nguồn tổ chức chính cho Bác sĩ; Chuyên khoa không còn tự sao chép tên Khoa/Phòng.
- Collection `vaccinations` cũ được giữ ẩn/read-only; frontend tiêm chủng đọc nguồn chuẩn `vaccines`, `vaccinePrices`, `vaccinationSchedules`.
- Không đưa các thay đổi tối ưu Dashboard/Homepage của v4.4.17-v4.4.18 vào baseline này.

## v4.4.20 - Header tùy biến
- Phát triển trực tiếp từ v4.4.19 Stable Baseline.
- Thanh trên không hiển thị địa chỉ; chỉ giữ thời gian, mạng xã hội và tìm kiếm.
- Làm nổi bật ngày/giờ; cho phép Admin đổi nền, màu, cỡ và độ đậm chữ thời gian.
- Chuẩn hóa icon Facebook, Zalo và YouTube bằng SVG nội tuyến, không phụ thuộc thư viện ngoài.
- Khối liên hệ nhanh được quản trị bằng mảng `contactCards`: ẩn/hiện, tiêu đề, nội dung/SĐT, dòng bổ sung, liên kết, icon có sẵn hoặc ảnh icon tự tải lên, màu nền/viền/chữ/icon và cỡ chữ.
- Nếu Admin chưa tạo `contactCards`, giao diện tự giữ 2 ô Cấp cứu 24/7 và Tổng đài hỗ trợ như trước để tương thích dữ liệu cũ.
- Không migration, không DB push, không thay đổi luồng tải trang chủ của baseline ổn định.


## v4.4.21 - Header icon/font fix
- Bỏ hoàn toàn khung, nền, bo góc và shadow quanh thứ/ngày/tháng/giờ trên utility bar.
- Chuẩn hóa font tiếng Việt cho ngày giờ và các ô liên hệ nhanh bằng Arial/Segoe UI, dùng weight chuẩn 700/800.
- Làm lại icon Zalo và YouTube bằng SVG nhận diện rõ hơn.
- Dùng chung một component icon Facebook/Zalo/YouTube cho Header và Footer để đồng bộ tuyệt đối.
- Không thay đổi database, migration hay logic tải trang.


## v4.4.22 — Nhập Excel FAQ & Kịch bản Chatbot
- Giữ nguyên baseline ổn định v4.4.21; không migration và không bật DB push.
- Thêm khung nhập Excel ngay trên danh sách **Câu hỏi thường gặp** và **Kịch bản Chatbot** trong Admin.
- Một file mẫu gồm 3 sheet: Hướng dẫn, Câu hỏi thường gặp, Kịch bản Chatbot.
- Quy trình an toàn: Tải mẫu → Chọn file → Kiểm tra dữ liệu → Xác nhận nhập.
- FAQ: cập nhật theo Câu hỏi; nhập câu trả lời, nhóm, từ khóa, hiển thị, thứ tự.
- Kịch bản: cập nhật theo Tên kịch bản; hỗ trợ nhiều câu hỏi/từ khóa tương đương, câu trả lời, link, mở tab mới, độ ưu tiên, trạng thái.
- Dòng trùng trong cùng file bị chặn; bản ghi trùng với dữ liệu hiện có được cập nhật thay vì tạo bản sao.
- Không thay đổi schema PostgreSQL.


## v4.4.25 - Chatbot OOXML namespace fix
- Sửa bộ đọc XLSX fallback nhận các thẻ XML có namespace như x:row, x:c, x:v, x:t.
- Khắc phục trường hợp kiểm tra Excel trả Tổng 0 / Hợp lệ 0 / Lỗi 0 dù sheet có dữ liệu.
- Không migration, không thay đổi schema database.

## v4.4.26 - Sửa Header & Nhận diện trong Admin
- Bỏ phụ thuộc Global `header` mới vốn không có bảng trong database cũ khi `DB push` bị tắt; đây là nguyên nhân `/admin/globals/header` báo Không tìm thấy.
- Chuyển toàn bộ phần Header & Nhận diện vào Global `site-settings` đang tồn tại trong database, route quản trị: `/admin/globals/site-settings`.
- Cho phép chỉnh tên bệnh viện, slogan, bật/tắt slogan, logo, màu nền, ảnh nền, lớp phủ, kích thước/position ảnh nền, chiều cao khối nhận diện.
- Cho phép thêm/xóa/ẩn/hiện/sắp xếp các ô liên hệ nhanh và thay icon tùy chỉnh.
- Cho phép thêm/xóa/ẩn/hiện/sắp xếp mạng xã hội; Header và Footer dùng chung một nguồn icon. Hỗ trợ Facebook, Zalo, YouTube, TikTok và icon ảnh tùy chỉnh.
- Giữ tương thích các URL mạng xã hội cũ trong `social-settings`/`site-settings` nếu chưa tạo danh sách mới.
- Có script an toàn `npm run audit:header-settings` và `npm run upgrade:header-settings -- --apply`. Không tự động sửa database khi khởi động.

## v4.4.27 - Chuẩn hóa Header & Nhận diện
- Đưa Logo bệnh viện lên đầu mục Header & Nhận diện để dễ thay đổi.
- Chuẩn hóa nơi quản lý Cấp cứu/Tổng đài/icon liên hệ nhanh.
- Chuẩn hóa Facebook/Zalo/YouTube/TikTok dùng chung Header + Footer và hỗ trợ icon tùy chỉnh.
- Ẩn mục Mạng xã hội cũ và các URL mạng xã hội tương thích cũ khỏi giao diện Admin để tránh nhập lặp.
- Footer chỉ bật/tắt hiển thị mạng xã hội, không quản lý link/icon riêng.
- Không migration, không DB push, không xóa dữ liệu cũ.


## v4.4.28 - Single Logo Source
- Sửa lỗi Header/Footer hiển thị đồng thời logo tải lên và logo mặc định.
- Khi đã chọn logo trong Admin, website chỉ hiển thị đúng logo đó.
- Logo mặc định `/branding/logo-bvdk-thoi-lai.png` chỉ được dùng khi trường Logo bệnh viện để trống.
- Không thay đổi schema/database, không migration, không DB push.


## v4.4.29 - Logo sharpness fix
- Header/Footer hiển thị logo bằng thẻ img trực tiếp từ URL file gốc thay cho CSS background-image.
- Không dùng thumbnail/size phát sinh cho logo.
- object-fit: contain, không padding, không crop, giữ đúng tỷ lệ ảnh.
- Tăng giới hạn kích thước logo trong Admin lên 140 px.
- Không thay đổi database schema, không migration, không DB push.
