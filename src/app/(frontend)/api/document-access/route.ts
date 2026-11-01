import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit } from '@/lib/request-security'
import {
  createDocumentToken,
  pinsMatch,
  relationID,
  type ProtectedDocumentCollection,
} from '@/lib/documentAccess'

const isCollection = (value: unknown): value is ProtectedDocumentCollection =>
  value === 'documents' || value === 'clinical-protocols'

export async function POST(request: Request) {
  try {
    if (bodyIsTooLarge(request, 4_096)) {
      return NextResponse.json({ error: 'Yêu cầu quá lớn.' }, { status: 413 })
    }
    const throttle = rateLimit(request, 'document-access', 10, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter), 'Cache-Control': 'no-store' } },
      )
    }

    const parsed = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4_096)
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    }
    const body = parsed.data || null
    const collection = body?.collection
    const documentId = String(body?.documentId || '').trim()
    const pin = String(body?.pin || '').slice(0, 200)
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
    if (!document) {
      return NextResponse.json({ error: 'Không thể cấp quyền truy cập tài liệu.' }, { status: 404 })
    }

    const mode = String(document.accessMode || 'public')
    if (mode === 'locked') {
      return NextResponse.json({ error: 'Tài liệu hiện đang bị khóa.' }, { status: 403 })
    }

    if (mode === 'pin') {
      const settings = await payload.findGlobal({
        slug: 'site-settings',
        depth: 0,
        overrideAccess: true,
      }).catch(() => ({} as any)) as any
      const expectedPin = String(document.pinCode || process.env.DOCUMENT_DEFAULT_PIN || settings?.defaultDocumentPin || '')
      if (!expectedPin || !pinsMatch(pin, expectedPin)) {
        return NextResponse.json({ error: 'Mã xác thực không chính xác.' }, { status: 403 })
      }
    }

    if (mode === 'internal') {
      const user = await getVerifiedActiveUser(payload, request.headers)
      const moduleName = collection === 'documents' ? 'documents' : 'clinical-protocols'
      if (!user) {
        return NextResponse.json({ error: 'Bạn cần đăng nhập để xem tài liệu nội bộ.' }, { status: 401 })
      }
      if (!hasModulePermission(user, moduleName, 'view')) {
        return NextResponse.json({ error: 'Bạn không có quyền xem tài liệu nội bộ.' }, { status: 403 })
      }
    }

    const mediaId = relationID(document.file)
    if (!mediaId) {
      return NextResponse.json({ error: 'Tài liệu chưa có tệp đính kèm.' }, { status: 404 })
    }

    const token = createDocumentToken(collection, document.id, mediaId)
    const fileUrl = `/api/document-file?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(String(document.id))}&token=${encodeURIComponent(token)}`
    return NextResponse.json(
      { ok: true, token, fileUrl, expiresIn: 300 },
      { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    )
  } catch (error) {
    console.error('DOCUMENT ACCESS ERROR:', error instanceof Error ? error.message : 'UNKNOWN_ERROR')
    return NextResponse.json(
      { error: 'Không thể xác minh quyền truy cập tài liệu.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
