import path from 'path'
import { readFile, stat } from 'fs/promises'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import {
  relationID,
  verifyDocumentToken,
  type ProtectedDocumentCollection,
} from '@/lib/documentAccess'

export const runtime = 'nodejs'

const isCollection = (value: string | null): value is ProtectedDocumentCollection =>
  value === 'documents' || value === 'clinical-protocols' || value === 'work-schedules'

const safeName = (value: string) => value.replace(/[\r\n"\\]/g, '_')

const r2Enabled = () => Boolean(
  process.env.R2_BUCKET &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  (process.env.NODE_ENV === 'production' || String(process.env.MEDIA_STORAGE || '').toLowerCase() === 'r2'),
)

const parseRange = (value: string | null, size: number) => {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null
  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : size - 1
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null
  return { start, end: Math.min(end, size - 1) }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const collection = url.searchParams.get('collection')
    const documentId = String(url.searchParams.get('id') || '').trim()
    const tokenValue = String(url.searchParams.get('token') || '')
    if (!isCollection(collection) || !documentId) {
      return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 })
    }

    const payload = await getCMS()
    const document = await payload.findByID({
      collection,
      id: documentId,
      depth: 1,
      overrideAccess: true,
    }).catch(() => null) as any
    if (!document) return NextResponse.json({ error: 'Không tìm thấy tài liệu.' }, { status: 404 })

    const mode = String(document.accessMode || 'public')
    if (mode === 'locked') return NextResponse.json({ error: 'Tài liệu hiện đang bị khóa.' }, { status: 403 })

    const fileField = document.attachedFile || document.file
    const mediaId = relationID(fileField)
    const token = tokenValue ? verifyDocumentToken(tokenValue) : null
    const needsToken = mode === 'pin' || mode === 'internal'
    if (needsToken && (
      !token ||
      token.collection !== collection ||
      token.documentId !== String(document.id) ||
      token.mediaId !== mediaId
    )) {
      return NextResponse.json({ error: 'Quyền truy cập không hợp lệ hoặc đã hết hạn.' }, { status: 403 })
    }

    const media = typeof fileField === 'object' && fileField !== null ? fileField : await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null) as any
    if (!media?.filename) return NextResponse.json({ error: 'Không tìm thấy tệp đính kèm.' }, { status: 404 })

    const filename = safeName(String(media.originalFilename || media.filename))
    const mimeType = String(media.mimeType || 'application/octet-stream')
    const allowAttachment = url.searchParams.get('download') === '1' && document.allowDownload !== false && mode !== 'pin' && mode !== 'view_only'
    const disposition = `${allowAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(filename)}`
    const commonHeaders: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Disposition': disposition,
      'Cache-Control': mode === 'public' ? 'private, max-age=60' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      'Referrer-Policy': 'no-referrer',
      'Accept-Ranges': 'bytes',
    }

    if (r2Enabled()) {
      const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      })
      const range = request.headers.get('range') || undefined
      const object = await client.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: String(media.filename),
        Range: range,
      }))
      if (!object.Body) return NextResponse.json({ error: 'Không thể đọc tệp.' }, { status: 502 })
      const bytes = await object.Body.transformToByteArray()
      if (object.ContentLength != null) commonHeaders['Content-Length'] = String(object.ContentLength)
      if (object.ContentRange) commonHeaders['Content-Range'] = object.ContentRange
      return new Response(Uint8Array.from(bytes).buffer, { status: object.ContentRange ? 206 : 200, headers: commonHeaders })
    }

    const mediaRoot = path.resolve(process.cwd(), 'media')
    const filePath = path.resolve(mediaRoot, path.basename(String(media.filename)))
    if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) {
      return NextResponse.json({ error: 'Đường dẫn tệp không hợp lệ.' }, { status: 400 })
    }
    const fileStat = await stat(filePath)
    const range = parseRange(request.headers.get('range'), fileStat.size)
    const file = await readFile(filePath)
    if (range) {
      const chunk = file.subarray(range.start, range.end + 1)
      commonHeaders['Content-Length'] = String(chunk.length)
      commonHeaders['Content-Range'] = `bytes ${range.start}-${range.end}/${fileStat.size}`
      return new Response(chunk, { status: 206, headers: commonHeaders })
    }
    commonHeaders['Content-Length'] = String(fileStat.size)
    return new Response(file, { headers: commonHeaders })
  } catch (error) {
    console.error('DOCUMENT FILE ERROR:', error)
    return NextResponse.json(
      { error: 'Không thể tải tệp tài liệu.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
