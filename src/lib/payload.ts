import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload } from 'payload'
import { cache } from 'react'
import { draftMode } from 'next/headers'

let usersSchemaSynced = false

export const getCMS = async () => {
  const payload = await getPayload({ config })
  if (!usersSchemaSynced) {
    usersSchemaSynced = true
    try {
      await payload.db.drizzle.execute(
        sql`
          ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" TIMESTAMP(3) WITH TIME ZONE;
          ALTER TABLE public."media" ADD COLUMN IF NOT EXISTS "_objectkey" VARCHAR;
          ALTER TABLE public."media" ADD COLUMN IF NOT EXISTS "prefix" VARCHAR;

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
            ADD COLUMN IF NOT EXISTS "avatar_display_mode" public."enum_doctors_avatar_display_mode" DEFAULT 'inherit',
            ADD COLUMN IF NOT EXISTS "avatar_scale" numeric,
            ADD COLUMN IF NOT EXISTS "avatar_offset_y" numeric;
          ALTER TABLE public."_doctors_v"
            ADD COLUMN IF NOT EXISTS "version_avatar_display_mode" public."enum__doctors_v_version_avatar_display_mode" DEFAULT 'inherit',
            ADD COLUMN IF NOT EXISTS "version_avatar_scale" numeric,
            ADD COLUMN IF NOT EXISTS "version_avatar_offset_y" numeric;
          ALTER TABLE public."our_experts"
            ADD COLUMN IF NOT EXISTS "image_scale" numeric,
            ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;
          ALTER TABLE public."expert_items"
            ADD COLUMN IF NOT EXISTS "image_scale" numeric,
            ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;
          ALTER TABLE public."_expert_items_v"
            ADD COLUMN IF NOT EXISTS "image_scale" numeric,
            ADD COLUMN IF NOT EXISTS "image_offset_y" numeric;
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
        `
      )
    } catch {
      // Bỏ qua nếu kết nối DB ở chế độ read-only hoặc các bảng chưa khởi tạo
    }
  }
  return payload
}

export const getGlobal = cache(async (slug: 'site-settings' | 'navigation' | 'homepage' | 'organization-chart' | 'hospital-history' | 'about-page' | 'upload-settings' | 'footer' | 'contact-settings' | 'social-settings' | 'medpro-settings' | 'theme-settings' | 'default-media-settings' | 'seo-settings' | 'chatbot-settings' | 'system-settings' | 'schedule-settings' | 'quick-links-settings' | 'working-hours-settings' | 'patient-portal-settings' | 'appointment-settings' | 'display-settings' | 'examination-flow-settings' | 'inpatient-guide-settings' | 'checkup-packages-settings' | 'hospital-map-settings' | 'hospital-quality-settings' | 'survey-page-settings' | 'faq-page-settings' | 'forms-page-settings' | 'feedback-page-settings' | (string & {})) => {
  const payload = await getCMS()
  // Lấy đầy đủ thông tin Media (url, filename, kích thước) cho logo và banner.
  return payload.findGlobal({ slug: slug as any, depth: 2 })
})

export async function findPublished(collection: any, options: Record<string, any> = {}) {
  const payload = await getCMS()
  return payload.find({
    collection,
    where: { _status: { equals: 'published' }, ...(options.where || {}) },
    sort: options.sort || '-publishedAt',
    limit: options.limit || 20,
    depth: options.depth ?? 1,
    page: options.page || 1
  })
}

export async function getHomepage() {
  const payload = await getCMS()
  const draft = await draftMode()
  return payload.findGlobal({ slug: 'homepage', depth: 2, draft: draft.isEnabled })
}
