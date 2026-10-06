# Triển khai GitHub → Railway → Neon an toàn

Quy trình này bảo đảm code mới chỉ khởi động khi cấu trúc PostgreSQL trên Neon đã khớp với Payload CMS. Dữ liệu đang có trên Neon được giữ nguyên; production không dùng schema push tự động.

## 1. Cơ chế bảo vệ đã có trong dự án

```text
GitHub push
   ↓
Railway build Docker image
   ↓
prebuild sinh lại payload-generated-schema.ts
   ↓
schema contract kiểm tra: schema mới có migration mới hay chưa?
   ├─ Thiếu migration → build thất bại, không phát hành
   └─ Hợp lệ
        ↓
Railway Pre-Deploy chạy db:migrate:deploy (khuyến nghị)
        ↓
Docker CMD chạy npm start
        ↓
npm prestart tự chạy lại db:migrate:deploy (lớp dự phòng bắt buộc)
        ↓
checksum + advisory lock + apply + verify
   ├─ Lỗi → process thoát khác 0, Next.js không mở cổng
   └─ Thành công → next start → /api/health → nhận traffic
```

`prestart` là lớp bảo vệ nằm trong mã nguồn nên vẫn hoạt động nếu Railway Dashboard chưa cấu hình Pre-Deploy. Nếu cả Pre-Deploy và prestart cùng chạy, migration vẫn an toàn vì runner có checksum, ledger và PostgreSQL advisory lock; lần thứ hai chỉ verify.

## 2. Cấu hình biến Railway cho Neon

Trong **Railway service → Variables**, khai báo:

```env
NODE_ENV=production

# Kết nối ứng dụng. Có thể dùng Neon pooled URL có hostname chứa -pooler.
DATABASE_URL=postgresql://...@ep-xxx-pooler....neon.tech/database?sslmode=require

# Kết nối dành cho migration. Lấy Direct connection string trong Neon,
# hostname không được chứa -pooler.
DATABASE_MIGRATION_URL=postgresql://...@ep-xxx....neon.tech/database?sslmode=require

PAYLOAD_DB_PUSH=false
PAYLOAD_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
PREVIEW_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
NEXT_PUBLIC_SITE_URL=https://ten-mien-that
```

Runner cũng nhận `DATABASE_URL_UNPOOLED` nếu nền tảng tự cung cấp biến này. Thứ tự ưu tiên là:

1. `DATABASE_MIGRATION_URL`
2. `DATABASE_URL_UNPOOLED`
3. `DATABASE_URL` nếu đây không phải Neon pooler

Production sẽ từ chối migration qua hostname Neon `-pooler`. Không commit URL, mật khẩu hoặc secret thật vào GitHub.

Sau khi migration qua Direct connection hoàn tất, runner kết nối lại bằng chính
`DATABASE_URL` của Payload, đối chiếu Neon endpoint/database/user, ledger migration
mới nhất và verify schema. Nếu URL runtime trỏ nhầm database hoặc pooled connection
không đọc được schema vừa migrate, deployment sẽ dừng trước khi `next start` thay vì
khởi động website rồi mới trả lỗi truy vấn dài.

## 3. Cấu hình Railway một lần

Trong **Settings → Deploy**:

| Thiết lập | Giá trị |
|---|---|
| Pre-Deploy Command | `npm run db:migrate:deploy` |
| Pre-Deploy Timeout | `300` giây |
| Healthcheck Path | `/api/health` |
| Healthcheck Timeout | `300` giây |
| Restart Policy | `ON_FAILURE`, tối đa 3 lần |

Dự án dùng `Dockerfile` và đã có `CMD ["npm", "start"]`. Hãy xóa Start Command tùy chỉnh trên Railway hoặc đặt đúng `npm start`; không dùng trực tiếp `next start` vì sẽ bỏ qua `npm prestart` và migration tự động.

Pre-Deploy là lớp khuyến nghị để migration hoàn tất trước giai đoạn deploy. Tuy nhiên, `npm prestart` vẫn tự chạy migration nên dự án không còn phụ thuộc hoàn toàn vào thiết lập Dashboard.

## 4. Quy trình bắt buộc khi thêm tính năng có thay đổi database

Nếu chỉ sửa giao diện/logic và Payload schema không đổi, không cần migration mới.

Nếu thêm field, enum, Collection, Global, array, relationship hoặc thay đổi cấu trúc lưu trữ:

1. Sửa Payload config và kiểm tra `dbName` ngắn hơn 63 byte.
2. Sinh schema mới:

   ```bash
   npm run generate:db-schema
   ```

3. Tạo migration mới trong `scripts/db-migrations/`:

   ```text
   YYYYMMDD_NNN_ten_migration.mjs
   ```

4. Migration phải có `up` và `verify`; ưu tiên câu lệnh additive/idempotent:

   ```sql
   ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...;
   ALTER TYPE ... ADD VALUE IF NOT EXISTS ...;
   CREATE TABLE IF NOT EXISTS ...;
   CREATE INDEX IF NOT EXISTS ...;
   ```

5. Global/Collection có versions phải đồng bộ cả bảng chính và bảng `_..._v` với cột `version_...`.
6. Nếu tính năng cần dữ liệu hệ thống mặc định, thêm `INSERT ... ON CONFLICT ...` hoặc backfill có thể chạy lại vào migration. Không dùng migration để sao chép đè toàn bộ nội dung production.
7. Seal schema bằng đúng ID migration mới nhất:

   ```bash
   npm run db:schema:seal -- YYYYMMDD_NNN_ten_migration
   npm run db:schema:check
   ```

8. Chạy migration trên database development/staging:

   ```bash
   npm run db:migrate:dry-run
   npm run db:migrate:deploy
   npm run db:migrate:verify
   ```

9. Kiểm tra trước khi push GitHub:

   ```bash
   npm run typecheck
   npm run validate:all
   npm run build
   ```

Không sửa migration đã được áp dụng. Checksum thay đổi sẽ làm deployment dừng; luôn tạo migration kế tiếp.

## 5. Schema contract ngăn quên migration

`scripts/db-schema-contract.json` gắn SHA-256 của `src/payload-generated-schema.ts` với migration mới nhất.

- Schema thay đổi nhưng không có migration mới: build và startup bị chặn.
- Cố seal schema mới bằng ID migration cũ: bị chặn.
- Có migration mới nhưng quên seal: bị chặn.
- Schema, contract và migration khớp: cho phép deploy.

Vì `prebuild` sinh lại DB schema trước khi kiểm tra, việc quên chạy generator ở máy local cũng không thể âm thầm lọt qua Railway.

## 6. Enum và database nhiều dữ liệu

Một số PostgreSQL không cho `ALTER TYPE ... ADD VALUE` trong transaction. Migration đó phải đặt:

```js
export const transactional = false
```

Với bảng lớn, dùng nhiều release:

1. **Expand:** thêm cột nullable hoặc default an toàn.
2. **Backfill:** cập nhật dữ liệu cũ theo batch nhỏ và idempotent.
3. **Contract:** release sau mới thêm `NOT NULL`, unique/FK nặng hoặc loại bỏ cấu trúc cũ.

Trước migration lớn, tạo backup/snapshot Neon và thử trên branch/staging. Không dùng `DROP`, `TRUNCATE`, reset hoặc seed phá dữ liệu trong deploy tự động.

## 7. Khi deployment thất bại

Tìm thông báo đầu tiên trong Railway logs:

- `DB SCHEMA CONTRACT FAILED`: code đổi schema nhưng migration/contract chưa khớp.
- `DATABASE MIGRATION FAILED`: migration lỗi, thiếu bảng/cột hoặc URL Neon không đúng.
- `Neon pooled URL (-pooler)`: thêm `DATABASE_MIGRATION_URL` bằng Direct connection string.
- `Còn ... migration chưa được áp dụng`: chạy `npm run db:migrate:deploy`, không bật schema push.

Không sửa trực tiếp migration đã ghi trong `bvdk_schema_migrations`. Không bật `PAYLOAD_DB_PUSH=true` để chữa cháy trên Neon production.

## 8. Database Neon đã có dữ liệu

Khi deploy phiên bản có migration lần đầu:

1. Backup Neon.
2. Đảm bảo GitHub chứa toàn bộ `scripts/db-migrations/`, contract và schema đã sinh.
3. Khai báo `DATABASE_URL` và `DATABASE_MIGRATION_URL` trên Railway.
4. Deploy; migration chỉ bổ sung/đổi cấu trúc đã định nghĩa và giữ dữ liệu cũ.
5. Kiểm tra `/api/health`, `/admin` và các trang dùng tính năng mới.

Database hoàn toàn trống vẫn cần bootstrap baseline theo `HUONG-DAN-TAO-DATABASE-MOI.md`, sau đó giữ `PAYLOAD_DB_PUSH=false` vĩnh viễn trên production.

## 9. Phân biệt code, schema và nội dung

- GitHub/Railway chuyển **code**.
- Migration chuyển **cấu trúc database** và dữ liệu hệ thống/backfill được viết rõ trong migration.
- Bài viết, hình ảnh, cấu hình do người dùng nhập ở local là **nội dung**; chúng không tự động sao chép sang Neon khi push GitHub.

## 10. Sự cố thường gặp: Mất Primary Key khi restore CSDL (Lỗi 500 khi Login)

Nếu gặp log `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification`:
- **Nguyên nhân:** File dump/restore bị ngắt giữa chừng do lỗi ENUM hoặc tool export chỉ lấy dữ liệu thô mà không áp dụng khóa chính (`PRIMARY KEY`). Payload CMS dùng `INSERT ... ON CONFLICT ("id") DO UPDATE` nên bắt buộc phải có `PRIMARY KEY (id)`.
- **Khắc phục ngay:** Kết nối vào Railway PostgreSQL và chạy:
  ```sql
  ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  ALTER TABLE site_visits_summary ADD CONSTRAINT site_visits_summary_pkey PRIMARY KEY (id);
  ALTER TABLE site_visits_daily ADD CONSTRAINT site_visits_daily_pkey PRIMARY KEY (date);
  ```
- **Quy tắc di chuyển an toàn:** Luôn dùng `pg_dump -Fc` và `pg_restore --clean --no-owner` hoặc chạy tạo schema hoàn chỉnh trước khi import dữ liệu.

Tham khảo: [Railway Pre-Deploy Command](https://docs.railway.com/deployments/pre-deploy-command), [Payload PostgreSQL migrations](https://payloadcms.com/docs/database/migrations), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Railway backup/restore](https://docs.railway.com/guides/postgres-backups-restores).
