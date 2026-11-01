export const id = '20261101_084_add_expert_image_display_modes'
export const description = 'Bổ sung các chế độ hiển thị ảnh chuyên gia (zoom xa / thu gần + full khung thông minh) vào homepage_sections và doctors'
export const transactional = false

export async function up({ client }) {
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

    ALTER TABLE public."doctors"
      ADD COLUMN IF NOT EXISTS "avatar_display_mode" public."enum_doctors_avatar_display_mode" DEFAULT 'inherit';

    ALTER TABLE public."_doctors_v"
      ADD COLUMN IF NOT EXISTS "version_avatar_display_mode" public."enum__doctors_v_version_avatar_display_mode" DEFAULT 'inherit';

    ALTER TABLE public."homepage_sections"
      ADD COLUMN IF NOT EXISTS "expert_image_display_mode" public."enum_homepage_sections_expert_image_display_mode" DEFAULT 'zoom-out-2-3';

    ALTER TABLE public."_homepage_v_version_sections"
      ADD COLUMN IF NOT EXISTS "expert_image_display_mode" public."enum__homepage_v_version_sections_expert_image_display_mode" DEFAULT 'zoom-out-2-3';
  `)
}

export async function verify({ client }) {
  const { rows } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'doctors' AND column_name = 'avatar_display_mode')
        OR (table_name = 'homepage_sections' AND column_name = 'expert_image_display_mode')
      );
  `)
  if (!rows || rows.length < 2) {
    throw new Error('Chưa tạo đủ cột avatar_display_mode và expert_image_display_mode.')
  }
}

