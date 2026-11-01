export const id = '20261101_083_add_expert_image_scale_controls'
export const description = 'Bổ sung chế độ kiểu hiển thị ảnh (display mode), độ thu phóng (scale), chiều cao khung thẻ và vị trí canh dọc cho mục Chuyên gia của chúng tôi (homepage, doctors, our_experts)'
export const transactional = false

export async function up({ client }) {
  // 0. Tạo các kiểu ENUM cho chế độ hiển thị ảnh chuyên gia
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE public."enum_doctors_avatar_display_mode" AS ENUM (
        'inherit', 'zoom-out-2-3', 'zoom-out-wide', 'zoom-out-medium',
        'cover-top', 'cover-body', 'cover-center', 'zoom-in-close', 'fill'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."enum__doctors_v_version_avatar_display_mode" AS ENUM (
        'inherit', 'zoom-out-2-3', 'zoom-out-wide', 'zoom-out-medium',
        'cover-top', 'cover-body', 'cover-center', 'zoom-in-close', 'fill'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."enum_homepage_sections_expert_image_display_mode" AS ENUM (
        'zoom-out-2-3', 'zoom-out-wide', 'zoom-out-medium',
        'cover-top', 'cover-body', 'cover-center', 'zoom-in-close', 'fill'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE public."enum__homepage_v_version_sections_expert_image_display_mode" AS ENUM (
        'zoom-out-2-3', 'zoom-out-wide', 'zoom-out-medium',
        'cover-top', 'cover-body', 'cover-center', 'zoom-in-close', 'fill'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  // 1. Bổ sung cột cho bảng doctors và _doctors_v
  await client.query(`
    ALTER TABLE public."doctors"
      ADD COLUMN IF NOT EXISTS "avatar_display_mode" public."enum_doctors_avatar_display_mode" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "avatar_scale" numeric,
      ADD COLUMN IF NOT EXISTS "avatar_offset_y" numeric;

    ALTER TABLE public."_doctors_v"
      ADD COLUMN IF NOT EXISTS "version_avatar_display_mode" public."enum__doctors_v_version_avatar_display_mode" DEFAULT 'inherit',
      ADD COLUMN IF NOT EXISTS "version_avatar_scale" numeric,
      ADD COLUMN IF NOT EXISTS "version_avatar_offset_y" numeric;
  `)

  // 2. Bổ sung cột cho bảng our_experts
  await client.query(`
    ALTER TABLE public."our_experts"
      ADD COLUMN IF NOT EXISTS "image_scale" numeric,
      ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;
  `)

  // 3. Bổ sung cột cho bảng expert_items và _expert_items_v (trong Homepage)
  await client.query(`
    ALTER TABLE public."expert_items"
      ADD COLUMN IF NOT EXISTS "image_scale" numeric,
      ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;

    ALTER TABLE public."_expert_items_v"
      ADD COLUMN IF NOT EXISTS "image_scale" numeric,
      ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;
  `)

  // 4. Bổ sung cột cấu hình chung cho homepage_sections và _homepage_v_version_sections
  await client.query(`
    ALTER TABLE public."homepage_sections"
      ADD COLUMN IF NOT EXISTS "expert_image_display_mode" public."enum_homepage_sections_expert_image_display_mode" DEFAULT 'zoom-out-2-3',
      ADD COLUMN IF NOT EXISTS "expert_image_scale" numeric DEFAULT 86,
      ADD COLUMN IF NOT EXISTS "expert_card_height" numeric DEFAULT 240,
      ADD COLUMN IF NOT EXISTS "expert_image_offset_y" numeric DEFAULT 12;

    ALTER TABLE public."_homepage_v_version_sections"
      ADD COLUMN IF NOT EXISTS "expert_image_display_mode" public."enum__homepage_v_version_sections_expert_image_display_mode" DEFAULT 'zoom-out-2-3',
      ADD COLUMN IF NOT EXISTS "expert_image_scale" numeric DEFAULT 86,
      ADD COLUMN IF NOT EXISTS "expert_card_height" numeric DEFAULT 240,
      ADD COLUMN IF NOT EXISTS "expert_image_offset_y" numeric DEFAULT 12;
  `)
}

export async function verify({ client }) {
  const { rows } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'doctors' AND column_name IN ('avatar_display_mode', 'avatar_scale'))
        OR (table_name = 'our_experts' AND column_name = 'image_scale')
        OR (table_name = 'expert_items' AND column_name = 'image_scale')
        OR (table_name = 'homepage_sections' AND column_name IN ('expert_image_display_mode', 'expert_image_scale'))
      );
  `)
  if (!rows || rows.length < 6) {
    throw new Error('Chưa tạo đủ các cột chế độ hiển thị và thu phóng ảnh Chuyên gia của chúng tôi.')
  }
}
