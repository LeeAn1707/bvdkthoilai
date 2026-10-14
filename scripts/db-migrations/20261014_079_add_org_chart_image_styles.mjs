export const id = '20261014_079_add_org_chart_image_styles'
export const description = 'Bổ sung các trường và enum tùy chọn kiểu hiển thị ảnh Ban Lãnh đạo trong Sơ đồ tổ chức'
export const transactional = false

export async function up({ client }) {
  // 1. Tạo các kiểu ENUM nếu chưa có
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE public."org_leader_img_style" AS ENUM ('inherit', 'full-cover', 'cover-box', 'contain-box', 'rounded-inset', 'circle');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."org_leader_img_fit" AS ENUM ('inherit', 'cover', 'contain');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."org_global_img_style" AS ENUM ('full-cover', 'cover-box', 'contain-box', 'rounded-inset', 'circle');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."org_global_img_ratio" AS ENUM ('3/4', '4/5', '1/1', 'auto');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."org_global_img_fit" AS ENUM ('cover', 'contain');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."org_global_img_pos" AS ENUM ('top', 'center', 'bottom');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  // 2. Thêm cột vào bảng organization_chart
  await client.query(`
    ALTER TABLE public."organization_chart"
      ADD COLUMN IF NOT EXISTS "director_image_style" public."org_leader_img_style" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "director_image_fit" public."org_leader_img_fit" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "image_settings_image_style" public."org_global_img_style" DEFAULT 'full-cover',
      ADD COLUMN IF NOT EXISTS "image_settings_image_aspect_ratio" public."org_global_img_ratio" DEFAULT '3/4',
      ADD COLUMN IF NOT EXISTS "image_settings_image_fit" public."org_global_img_fit" DEFAULT 'cover',
      ADD COLUMN IF NOT EXISTS "image_settings_image_position" public."org_global_img_pos" DEFAULT 'top';
  `)

  // 3. Thêm cột vào bảng organization_chart_deputy_directors
  await client.query(`
    ALTER TABLE public."organization_chart_deputy_directors"
      ADD COLUMN IF NOT EXISTS "image_style" public."org_leader_img_style" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "image_fit" public."org_leader_img_fit" DEFAULT 'inherit';
  `)

  // 4. Thêm cột vào bảng version _organization_chart_v
  await client.query(`
    ALTER TABLE public."_organization_chart_v"
      ADD COLUMN IF NOT EXISTS "version_director_image_style" public."org_leader_img_style" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "version_director_image_fit" public."org_leader_img_fit" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "version_image_settings_image_style" public."org_global_img_style" DEFAULT 'full-cover',
      ADD COLUMN IF NOT EXISTS "version_image_settings_image_aspect_ratio" public."org_global_img_ratio" DEFAULT '3/4',
      ADD COLUMN IF NOT EXISTS "version_image_settings_image_fit" public."org_global_img_fit" DEFAULT 'cover',
      ADD COLUMN IF NOT EXISTS "version_image_settings_image_position" public."org_global_img_pos" DEFAULT 'top';
  `)

  // 5. Thêm cột vào bảng version _organization_chart_v_version_deputy_directors
  await client.query(`
    ALTER TABLE public."_organization_chart_v_version_deputy_directors"
      ADD COLUMN IF NOT EXISTS "image_style" public."org_leader_img_style" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "image_fit" public."org_leader_img_fit" DEFAULT 'inherit';
  `)
}

export async function verify({ client }) {
  const check = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'organization_chart' AND column_name IN ('director_image_style', 'image_settings_image_style'))
        OR (table_name = 'organization_chart_deputy_directors' AND column_name IN ('image_style'))
      )
  `)

  if (!check.rows || check.rows.length < 3) {
    throw new Error('Chưa tìm thấy đầy đủ các cột tùy chọn hiển thị ảnh mới trong bảng organization_chart.')
  }
}
