// Migration 088: Nâng cấp toàn diện bảng departments tương đồng với specialties (bố cục chi tiết, ảnh bìa, dịch vụ, banner sidebar) và tự động đồng bộ bài viết từ chuyên khoa sang khoa/phòng

export const id = '20261102_088_enhance_departments_like_specialties'
export const description =
  'Bổ sung các trường giao diện, bài viết, dịch vụ, banner cho departments tương đồng với specialties và tự động kế thừa dữ liệu từ chuyên khoa liên kết'

export async function up({ client }) {
  // 1. Tạo các kiểu ENUM cho departments nếu chưa có
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_departments_icon') THEN
        CREATE TYPE "enum_departments_icon" AS ENUM (
          'default',
          'emergency',
          'imaging',
          'lab',
          'pediatrics',
          'surgery',
          'internal',
          'pharmacy',
          'dental',
          'rehab'
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_departments_cover_fit_home') THEN
        CREATE TYPE "enum_departments_cover_fit_home" AS ENUM (
          'cover-top',
          'contain',
          'cover-center',
          'cover-bottom',
          'cover',
          'fill'
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_departments_cover_fit_detail') THEN
        CREATE TYPE "enum_departments_cover_fit_detail" AS ENUM (
          'contain',
          'cover-top',
          'cover-center',
          'cover-bottom',
          'cover',
          'fill'
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_departments_cover_position') THEN
        CREATE TYPE "enum_departments_cover_position" AS ENUM (
          'top',
          'center',
          'bottom'
        );
      END IF;
    END $$;
  `)

  // 2. Thêm đầy đủ các cột mới vào bảng departments
  await client.query(`
    ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "linked_specialty_id" integer,
      ADD COLUMN IF NOT EXISTS "sync_from_specialty" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "icon" "enum_departments_icon" DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS "icon_custom_upload_id" integer,
      ADD COLUMN IF NOT EXISTS "tagline" varchar,
      ADD COLUMN IF NOT EXISTS "show_sub_cover" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "sub_cover_id" integer,
      ADD COLUMN IF NOT EXISTS "cover_fit_home" "enum_departments_cover_fit_home" DEFAULT 'cover-top',
      ADD COLUMN IF NOT EXISTS "cover_fit_detail" "enum_departments_cover_fit_detail" DEFAULT 'contain',
      ADD COLUMN IF NOT EXISTS "cover_position" "enum_departments_cover_position" DEFAULT 'top',
      ADD COLUMN IF NOT EXISTS "services" jsonb,
      ADD COLUMN IF NOT EXISTS "show_department_card" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_booking_card" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "custom_booking_title" varchar,
      ADD COLUMN IF NOT EXISTS "custom_booking_button_label" varchar,
      ADD COLUMN IF NOT EXISTS "custom_booking_button_url" varchar,
      ADD COLUMN IF NOT EXISTS "custom_hotline" varchar,
      ADD COLUMN IF NOT EXISTS "custom_booking_desc" varchar,
      ADD COLUMN IF NOT EXISTS "show_notice_box" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "custom_notice_text" varchar,
      ADD COLUMN IF NOT EXISTS "sidebar_banners_json" varchar,
      ADD COLUMN IF NOT EXISTS "show_cover_image" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_summary_lead" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_content_section" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_services_section" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_doctors_section" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_protocols_section" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "show_related_section" boolean DEFAULT true;
  `)

  // 3. Tạo bảng phụ departments_sidebar_banners (với ON DELETE CASCADE)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "departments_sidebar_banners" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer,
      "title" varchar,
      "btn_text" varchar,
      "link" varchar,
      "open_new_tab" boolean DEFAULT true,
      "desc" varchar
    );

    CREATE INDEX IF NOT EXISTS "departments_sidebar_banners_order_idx" ON "departments_sidebar_banners" ("_order");
    CREATE INDEX IF NOT EXISTS "departments_sidebar_banners_parent_id_idx" ON "departments_sidebar_banners" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "departments_sidebar_banners_image_idx" ON "departments_sidebar_banners" ("image_id");
    CREATE INDEX IF NOT EXISTS "departments_linked_specialty_idx" ON "departments" ("linked_specialty_id");
    CREATE INDEX IF NOT EXISTS "departments_icon_custom_upload_idx" ON "departments" ("icon_custom_upload_id");
    CREATE INDEX IF NOT EXISTS "departments_sub_cover_idx" ON "departments" ("sub_cover_id");
  `)

  // 4. Thiết lập các ràng buộc khóa ngoại an toàn
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_sidebar_banners_parent_id_fk') THEN
        ALTER TABLE "departments_sidebar_banners"
          ADD CONSTRAINT "departments_sidebar_banners_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "departments"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_sidebar_banners_image_id_media_id_fk') THEN
        ALTER TABLE "departments_sidebar_banners"
          ADD CONSTRAINT "departments_sidebar_banners_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "media"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_linked_specialty_id_specialties_id_fk') THEN
        ALTER TABLE "departments"
          ADD CONSTRAINT "departments_linked_specialty_id_specialties_id_fk"
          FOREIGN KEY ("linked_specialty_id") REFERENCES "specialties"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_icon_custom_upload_id_media_id_fk') THEN
        ALTER TABLE "departments"
          ADD CONSTRAINT "departments_icon_custom_upload_id_media_id_fk"
          FOREIGN KEY ("icon_custom_upload_id") REFERENCES "media"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_sub_cover_id_media_id_fk') THEN
        ALTER TABLE "departments"
          ADD CONSTRAINT "departments_sub_cover_id_media_id_fk"
          FOREIGN KEY ("sub_cover_id") REFERENCES "media"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
  `)

  // 5. Đồng bộ tự động dữ liệu từ bảng specialties sang bảng departments cho các khoa/phòng đã có bài viết bên Chuyên khoa
  await client.query(`
    WITH primary_specs AS (
      SELECT DISTINCT ON (s.department_id)
        s.id AS spec_id,
        s.department_id,
        s.summary,
        s.content,
        s.services,
        s.cover_id,
        s.sub_cover_id,
        s.show_sub_cover,
        s.tagline,
        s.icon::text AS icon_text,
        s.icon_custom_upload_id,
        s.cover_fit_home::text AS cover_fit_home_text,
        s.cover_fit_detail::text AS cover_fit_detail_text,
        s.cover_position::text AS cover_position_text,
        s.sidebar_banners_json
      FROM "specialties" s
      WHERE s.department_id IS NOT NULL
      ORDER BY s.department_id, s."order" ASC NULLS LAST, s.id ASC
    )
    UPDATE "departments" d
    SET
      linked_specialty_id = COALESCE(d.linked_specialty_id, ps.spec_id),
      summary = COALESCE(NULLIF(TRIM(d.summary), ''), ps.summary),
      content = COALESCE(d.content, ps.content),
      services = COALESCE(d.services, ps.services),
      cover_id = COALESCE(d.cover_id, ps.cover_id),
      sub_cover_id = COALESCE(d.sub_cover_id, ps.sub_cover_id),
      show_sub_cover = COALESCE(ps.show_sub_cover, d.show_sub_cover, true),
      tagline = COALESCE(NULLIF(TRIM(d.tagline), ''), ps.tagline),
      icon = CASE
        WHEN (d.icon IS NULL OR d.icon = 'default') AND ps.icon_text IS NOT NULL
        THEN ps.icon_text::"enum_departments_icon"
        ELSE COALESCE(d.icon, 'default')
      END,
      icon_custom_upload_id = COALESCE(d.icon_custom_upload_id, ps.icon_custom_upload_id),
      cover_fit_home = CASE
        WHEN ps.cover_fit_home_text IS NOT NULL
        THEN ps.cover_fit_home_text::"enum_departments_cover_fit_home"
        ELSE COALESCE(d.cover_fit_home, 'cover-top')
      END,
      cover_fit_detail = CASE
        WHEN ps.cover_fit_detail_text IS NOT NULL
        THEN ps.cover_fit_detail_text::"enum_departments_cover_fit_detail"
        ELSE COALESCE(d.cover_fit_detail, 'contain')
      END,
      cover_position = CASE
        WHEN ps.cover_position_text IS NOT NULL
        THEN ps.cover_position_text::"enum_departments_cover_position"
        ELSE COALESCE(d.cover_position, 'top')
      END,
      sidebar_banners_json = COALESCE(NULLIF(TRIM(d.sidebar_banners_json), ''), ps.sidebar_banners_json)
    FROM primary_specs ps
    WHERE d.id = ps.department_id;
  `)

  // 6. Sao chép các banner sidebar từ specialties_sidebar_banners sang departments_sidebar_banners nếu khoa/phòng chưa có banner
  await client.query(`
    INSERT INTO "departments_sidebar_banners" ("_order", "_parent_id", "id", "image_id", "title", "btn_text", "link", "open_new_tab", "desc")
    SELECT
      sb."_order",
      d.id AS "_parent_id",
      'dep_' || d.id || '_' || sb."id" AS "id",
      sb."image_id",
      sb."title",
      sb."btn_text",
      sb."link",
      sb."open_new_tab",
      sb."desc"
    FROM "departments" d
    JOIN "specialties_sidebar_banners" sb ON sb."_parent_id" = d.linked_specialty_id
    WHERE NOT EXISTS (
      SELECT 1 FROM "departments_sidebar_banners" existing WHERE existing."_parent_id" = d.id
    )
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function verify({ client }) {
  const res = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'departments'
      AND column_name IN ('linked_specialty_id', 'sync_from_specialty', 'services', 'cover_fit_detail', 'show_booking_card')
  `)
  if (res.rowCount < 5) {
    throw new Error('Migration 088 verify failed: thiếu các cột mở rộng trong bảng departments.')
  }

  const tbl = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'departments_sidebar_banners'
  `)
  if (tbl.rowCount === 0) {
    throw new Error('Migration 088 verify failed: bảng departments_sidebar_banners chưa được tạo.')
  }
}

