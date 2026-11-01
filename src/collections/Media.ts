import type { CollectionConfig } from 'payload'
import { mediaReadAccess, moduleAccess } from '@/access'
import path from 'path'
import { createHash } from 'crypto'
import { statfs } from 'fs/promises'

const MB = 1024 * 1024

const limitForMime = (mime: string, group: string | undefined, settings: any) => {
  if (mime.startsWith('image/')) {
    return Number(group === 'clinic-schedule' || group === 'vaccination' ? settings?.scheduleImageMaxMB : settings?.imageMaxMB) || (group === 'clinic-schedule' || group === 'vaccination' ? 20 : 15)
  }
  if (mime === 'application/pdf') return Number(settings?.pdfMaxMB) || 50
  if (mime.includes('word') || mime === 'application/msword') return Number(settings?.wordMaxMB) || 20
  if (mime.includes('sheet') || mime.includes('excel')) return Number(settings?.excelMaxMB) || 20
  if (mime.includes('presentation') || mime.includes('powerpoint')) return Number(settings?.powerPointMaxMB) || 50
  return 20
}

async function getStoragePercent(dir: string) {
  try {
    const info = await statfs(dir)
    const blocks = Number(info.blocks || 0)
    const available = Number(info.bavail || info.bfree || 0)
    if (!blocks) return undefined
    return ((blocks - available) / blocks) * 100
  } catch {
    try {
      const info = await statfs(process.cwd())
      const blocks = Number(info.blocks || 0)
      const available = Number(info.bavail || info.bfree || 0)
      if (!blocks) return undefined
      return ((blocks - available) / blocks) * 100
    } catch {
      return undefined
    }
  }
}

const isProduction = process.env.NODE_ENV === 'production'
const mediaStorage = String(process.env.MEDIA_STORAGE || '').trim().toLowerCase()
const r2Enabled = Boolean(
  process.env.R2_BUCKET &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  (isProduction || mediaStorage === 'r2'),
)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Tệp & Hình ảnh', plural: 'Thư viện Tệp & Hình ảnh' },
  admin: {
    group: '⚙️ Hệ thống & Dữ liệu',
    useAsTitle: 'originalFilename',
    defaultColumns: ['originalFilename', 'group', 'accessLevel', 'mimeType', 'filesize', 'hash', 'updatedAt'],
    description: 'Kho media dùng chung. Online Production lưu R2; local/offline mặc định lưu thư mục media. Ảnh và tệp đính kèm chỉ lưu một file gốc.',
  },
  access: {
    read: mediaReadAccess,
    create: moduleAccess('media', 'create'),
    update: moduleAccess('media', 'edit'),
    delete: moduleAccess('media', 'delete'),
  },
  trash: true,
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        const file = (req as any)?.file
        if (!file || (operation === 'update' && !file?.data)) return data

        const settings = await req.payload.findGlobal({ slug: 'upload-settings' as any, overrideAccess: true }).catch(() => ({} as any)) as any
        const mime = String(file.mimetype || file.mimeType || '')
        const size = Number(file.size || file.data?.length || 0)
        const group = String((data as any)?.group || 'other')
        const limitMB = limitForMime(mime, group, settings)
        if (size > limitMB * MB) {
          throw new Error(`Tệp vượt giới hạn ${limitMB} MB cho loại dữ liệu này.`)
        }

        // Local disk capacity is only relevant for local storage. When R2 is
        // active, Railway's ephemeral filesystem must not decide whether an
        // object can be uploaded to persistent object storage.
        if (!r2Enabled) {
          const mediaDir = path.resolve(process.cwd(), 'media')
          const usedPercent = await getStoragePercent(mediaDir)
          const blockPercent = Number(settings?.blockPercent) || 95
          if (usedPercent != null && usedPercent >= blockPercent) {
            throw new Error(`Dung lượng lưu trữ đã sử dụng ${usedPercent.toFixed(1)}%, vượt ngưỡng chặn ${blockPercent}%.`)
          }
        }

        const bytes = file.data
        if (bytes) {
          const hash = createHash('sha256').update(bytes).digest('hex')
          ;(data as any).hash = hash
          ;(data as any).originalFilename = (data as any).originalFilename || file.name
          const duplicate = await req.payload.find({
            collection: 'media',
            overrideAccess: true,
            where: { hash: { equals: hash } },
            limit: 1,
            depth: 0,
          }).catch(() => ({ docs: [] as any[] }))
          const existing = (duplicate as any)?.docs?.[0]
          if (existing?.id && String(existing.id) !== String((data as any)?.id || '')) {
            ;(data as any).duplicateOf = existing.id
          }
        }
        return data
      },
    ],
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media'),
    mimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    // Không khai báo imageSizes để Payload/R2 chỉ lưu đúng một file gốc.
    // Ảnh dùng cho card/banner cần được chuẩn hóa trước khi tải lên, khuyến nghị 16:9.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox")
      return headers
    },
  },
  fields: [
    {
      name: 'originalFilename', label: 'Tên tệp gốc', type: 'text', index: true,
      admin: { readOnly: true, description: 'Giữ tên tệp người dùng tải lên để dễ tìm và đối chiếu.' },
      hooks: { beforeChange: [({ value, siblingData, req }) => value || (req as any)?.file?.name || (siblingData as any)?.filename || undefined] },
    },
    { name: 'alt', label: 'Mô tả ảnh (ALT)', type: 'text', maxLength: 180 },
    { name: 'caption', label: 'Chú thích', type: 'text', maxLength: 250 },
    {
      name: 'group', label: 'Nhóm media', type: 'select', index: true, defaultValue: 'other',
      options: [
        { label: 'Tin tức', value: 'news' },
        { label: 'Thông báo', value: 'notice' },
        { label: 'Đấu thầu - Mua sắm', value: 'procurement' },
        { label: 'Banner', value: 'banner' },
        { label: 'Lịch khám', value: 'clinic-schedule' },
        { label: 'Tiêm chủng', value: 'vaccination' },
        { label: 'Bác sĩ', value: 'doctor' },
        { label: 'Khoa / Phòng', value: 'department' },
        { label: 'Chuyên khoa', value: 'specialty' },
        { label: 'Khảo sát / QLCL', value: 'quality' },
        { label: 'Nội dung chi tiết / Đính kèm / Khác', value: 'other' },
      ],
      admin: { description: 'Tất cả nhóm hiện chỉ lưu đúng một file gốc. Với ảnh có chữ nên tải ảnh chuẩn 16:9 để hiển thị đẹp trên trang chủ.' },
    },
    {
      name: 'accessLevel', label: 'Mức truy cập', type: 'select', required: true, defaultValue: 'public', index: true,
      access: { create: moduleAccess('media', 'create') as any, update: moduleAccess('media', 'edit') as any },
      options: [
        { label: 'Công khai', value: 'public' }, { label: 'Nội bộ', value: 'internal' }, { label: 'Hạn chế', value: 'restricted' },
      ],
      admin: { description: 'File public đọc công khai; internal/restricted được bảo vệ bằng Access Control của collection upload.' },
    },
    {
      name: 'uploadedBy', label: 'Người tải lên', type: 'relationship', relationTo: 'users', index: true,
      admin: { readOnly: true, position: 'sidebar' }, hooks: { beforeChange: [({ value, req }) => value || req.user?.id] },
    },
    { name: 'hash', label: 'SHA-256', type: 'text', index: true, admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'duplicateOf', label: 'Trùng với tệp', type: 'relationship', relationTo: 'media', index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Tự xác định khi SHA-256 trùng với tệp đã có.' },
    },
  ],
}
