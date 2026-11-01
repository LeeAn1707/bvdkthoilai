import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit, verifyTurnstile } from '@/lib/request-security'

const code = () => `BM-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`
export async function POST(req: Request) {
  try {
    if (bodyIsTooLarge(req, 64_000)) return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 })
    const throttle = rateLimit(req, 'dynamic-form', 10, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều biểu mẫu.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const parsed = await readJsonBodyWithLimit<Record<string, any>>(req, 64_000)
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    const body = parsed.data || {}
    if (body.website) return NextResponse.json({ ok: true })
    if (!(await verifyTurnstile(req, body['cf-turnstile-response']))) return NextResponse.json({ error: 'Không thể xác minh yêu cầu. Vui lòng thử lại.' }, { status: 403 })
    const slug = String(body.form || '').trim().slice(0, 100)
    const values = body.data && typeof body.data === 'object' ? body.data : {}
    const payload = await getCMS()
    const forms = await payload.find({ collection: 'forms', where: { and: [{ slug: { equals: slug } }, { active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true })
    const form: any = forms.docs[0]
    if (!form) return NextResponse.json({ error: 'Biểu mẫu không tồn tại hoặc đã ngừng nhận.' }, { status: 404 })
    const safe: Record<string, unknown> = {}
    for (const field of Array.isArray(form.fields) ? form.fields : []) {
      const name = String(field?.name || '')
      if (!name) continue
      const value = values[name]
      if (field.required && (value === undefined || value === null || String(value).trim() === '')) return NextResponse.json({ error: `Vui lòng nhập ${field.label || name}.` }, { status: 400 })
      if (value !== undefined) safe[name] = typeof value === 'string' ? value.slice(0, 5000) : value
    }
    const publicCode = code()
    await payload.create({ collection: 'formSubmissions', data: { publicCode, form: form.id, data: safe, status: 'new' }, overrideAccess: true })
    return NextResponse.json({ ok: true, code: publicCode, message: form.successMessage || 'Thông tin đã được tiếp nhận.' })
  } catch {
    return NextResponse.json({ error: 'Không thể gửi biểu mẫu.' }, { status: 500 })
  }
}
