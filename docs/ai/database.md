# Database Rules

Load this file only for database/schema/migration work.

## Local default
- Keep `PAYLOAD_DB_PUSH=false` for normal local work.
- Do not rely on automatic Drizzle push for routine schema synchronization.

## Safety
- No reset/drop/truncate by default.
- No destructive seed on valuable data.
- Do not modify production data unless explicitly requested and the operation is safe.
- Back up before major schema restructuring or production migration.
- Never commit credentials, dumps or secrets.

## Schema changes
When a Payload field/enum/Collection/Global changes the DB shape:
1. Generate the Payload DB schema when required.
2. Create a migration under `scripts/db-migrations/`.
3. Migration must be idempotent/safe where practical and include verification.
4. Seal the schema contract:
   - `npm run db:schema:seal -- <migration_id>`
5. Check:
   - `npm run db:schema:check`
6. Run targeted migration validation.
7. Deploy local migration only when the task requires it.

Do not create complex destructive migrations when a safe additive migration is sufficient.

## PostgreSQL specifics
- Payload select fields may map to PostgreSQL enums; adding enum values requires explicit migration handling.
- Keep identifiers below PostgreSQL limits.
- Keep main tables and version tables consistent when both exist.
- Verify generated ORM queries after schema changes that alter physical column names.

## Backup, Restore & Data Migration Precautions
- **Bắt buộc có Primary Key / Constraints:** Khi dump/restore dữ liệu giữa các môi trường (ví dụ chuyển lên Railway / Neon / VPS), luôn bảo đảm schema đầy đủ (Tables, PK, FK, Unique constraints, Enums).
- **Tránh lỗi `ON CONFLICT`:** Payload CMS (Drizzle ORM) chạy `INSERT INTO <table> ... ON CONFLICT ("id" / "date") DO UPDATE`. Nếu bảng (ví dụ `users`, `site_visits_summary`, `site_visits_daily`) bị mất `PRIMARY KEY`, server sẽ sập 500 khi login hoặc ghi log truy cập.
- **Thứ tự Restore:** Luôn tạo ENUM types và bảng cha trước bảng con; nếu import dữ liệu dạng raw SQL hoặc CSV, phải chạy verify/tạo lại `PRIMARY KEY` cho tất cả các bảng.
- **Lệnh tạo lại PK nhanh:** 
  ```sql
  ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  ALTER TABLE site_visits_summary ADD CONSTRAINT site_visits_summary_pkey PRIMARY KEY (id);
  ALTER TABLE site_visits_daily ADD CONSTRAINT site_visits_daily_pkey PRIMARY KEY (date);
  ```

## Production
- Production deployment/migration rules are in `docs/ai/production-safety.md`.
- Never infer that a local build proves production migration safety.

