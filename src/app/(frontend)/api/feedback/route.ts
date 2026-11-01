import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit, validEmail, validPhone, verifyTurnstile } from '@/lib/request-security'

const makeCode = () => `GY-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`

export async function POST(req: Request) {
  try {
    if (bodyIsTooLarge(req, 20_000)) return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 })
    const throttle = rateLimit(req, 'feedback-case', 5, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const parsed = await readJsonBodyWithLimit<Record<string, any>>(req, 20_000)
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    const body = parsed.data || {}
    if (body.website) return NextResponse.json({ ok: true })
    if (!(await verifyTurnstile(req, body['cf-turnstile-response']))) return NextResponse.json({ error: 'Không thể xác minh yêu cầu. Vui lòng thử lại.' }, { status: 403 })
    const name = String(body.name || '').trim().slice(0, 150)
    const phone = String(body.phone || '').trim().slice(0, 30)
    const email = String(body.email || '').trim().slice(0, 200)
    const subject = String(body.subject || body.type || 'Góp ý – Phản hồi').trim().slice(0, 250)
    const message = String(body.message || '').trim().slice(0, 5000)
    const category = String(body.category || '').trim()
    const allowContact = body.allowContact !== false && body.allowContact !== 'false'
    if (!name || !validPhone(phone) || !validEmail(email) || message.length < 5) return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })

    const payload = await getCMS()
    let code = makeCode()
    for (let i = 0; i < 3; i++) {
      const exists = await payload.find({ collection: 'feedbackCases', where: { code: { equals: code } }, limit: 1, overrideAccess: true })
      if (!exists.docs.length) break
      code = makeCode()
    }
    let department: number | undefined
    let priority: 'normal' | 'urgent' | 'low' | 'high' = 'normal'
    if (category) {
      const categories = await payload.find({ collection: 'feedbackCategories', where: { id: { equals: category } }, limit: 1, depth: 0, overrideAccess: true })
      const item: any = categories.docs[0]
      const rawDepartment = typeof item?.department === 'object' ? item.department?.id : item?.department
      const parsedDepartment = Number(rawDepartment)
      department = Number.isFinite(parsedDepartment) ? parsedDepartment : undefined
      const rawPriority = String(item?.defaultPriority || 'normal')
      priority = ['normal', 'urgent', 'low', 'high'].includes(rawPriority) ? rawPriority as typeof priority : 'normal'
    }
    const categoryID = category ? Number(category) : undefined
    const validCategoryID = Number.isFinite(categoryID) && categoryID! > 0 ? categoryID : undefined

    const created: any = await payload.create({
      collection: 'feedbackCases',
      data: {
        code,
        name,
        phone,
        email: email || undefined,
        category: validCategoryID,
        subject,
        message,
        allowContact,
        priority,
        status: 'new',
        department,
      },
      overrideAccess: true,
    })

    // Đồng thời đồng bộ vào collection feedback để hiển thị trên Dashboard Admin
    try {
      await payload.create({
        collection: 'feedback',
        data: {
          code,
          name,
          phone,
          email: email || undefined,
          type: body.type || 'Góp ý',
          message: `${subject ? `[${subject}] ` : ''}${message}`,
          status: 'new',
        },
        overrideAccess: true,
      })
    } catch (fbErr) {
      console.warn('Sync to feedback collection warning:', fbErr)
    }

    await payload.create({
      collection: 'feedbackActions',
      data: {
        case: created.id,
        action: 'received',
        note: 'Phản ánh được tiếp nhận từ website.',
        public: true,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, code })
  } catch (err: any) {
    console.error('API FEEDBACK ERROR:', err instanceof Error ? err.message : 'UNKNOWN_ERROR')
    return NextResponse.json({ error: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const throttle = rateLimit(req, 'feedback-lookup', 10, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Không thể tra cứu lúc này. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter), 'Cache-Control': 'no-store' } },
      )
    }
    const url = new URL(req.url)
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase().slice(0, 40)
    const phone = String(url.searchParams.get('phone') || '').trim().slice(0, 30)

    if (!code || !validPhone(phone)) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ mã tra cứu và số điện thoại đã dùng khi gửi phản ánh.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const pairFingerprint = createHash('sha256').update(`${code}:${phone}`).digest('hex').slice(0, 16)
    const pairThrottle = rateLimit(req, `feedback-lookup-pair:${pairFingerprint}`, 5, 15 * 60_000)
    if (!pairThrottle.allowed) {
      return NextResponse.json(
        { error: 'Không thể tra cứu lúc này. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(pairThrottle.retryAfter), 'Cache-Control': 'no-store' } },
      )
    }

    const payload = await getCMS()

    // Chỉ tra cứu khi có đủ mã tiếp nhận và số điện thoại khớp cùng hồ sơ.
    // 1. Tìm trong feedbackCases trước
    const result = await payload.find({
      collection: 'feedbackCases',
      where: { and: [{ code: { equals: code } }, { phone: { equals: phone } }] },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    let caseItem: any = result.docs[0]
    let feedbackItem: any = null

    // 2. Tìm trong feedback collection (phản hồi người bệnh)
    try {
      const fbResult = await payload.find({
        collection: 'feedback',
        where: { and: [{ code: { equals: code } }, { phone: { equals: phone } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (fbResult.docs.length > 0) {
        feedbackItem = fbResult.docs[0]
      }
    } catch {}

    if (!caseItem && !feedbackItem) {
      return NextResponse.json(
        { error: 'Thông tin tra cứu không chính xác hoặc hồ sơ chưa sẵn sàng.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Lấy câu trả lời chính thức ưu tiên từ feedback (nếu admin vừa nhập vào feedback) hoặc feedbackCases
    const officialResponse = feedbackItem?.response || caseItem?.publicResponse || ''
    
    // Đồng bộ trạng thái mới nhất
    let rawStatus = caseItem?.status || 'new'
    if (feedbackItem?.status === 'done') {
      rawStatus = 'resolved'
    } else if (feedbackItem?.status === 'processing') {
      rawStatus = 'processing'
    }

    let timeline: any[] = []
    if (caseItem?.id) {
      const actions = await payload.find({
        collection: 'feedbackActions',
        where: { and: [{ case: { equals: caseItem.id } }, { public: { equals: true } }] },
        sort: 'createdAt',
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      timeline = actions.docs.map((row: any) => ({
        action: row.action,
        note: row.note || '',
        createdAt: row.createdAt,
      }))
    }

    // Nếu đã có câu trả lời chính thức mà chưa có mục trong timeline
    if (officialResponse && !timeline.some((t: any) => t.action === 'response')) {
      timeline.push({
        action: 'response',
        note: 'Bệnh viện Đa khoa Khu vực Thới Lai đã gửi phản hồi chính thức.',
        createdAt: feedbackItem?.resolvedAt || feedbackItem?.updatedAt || caseItem?.updatedAt || new Date().toISOString(),
      })
    }

    return NextResponse.json({
      code: code,
      name: feedbackItem?.name || caseItem?.name || 'Người bệnh',
      subject: caseItem?.subject || feedbackItem?.type || 'Phản ánh – Góp ý',
      message: feedbackItem?.message || caseItem?.message || '',
      status: rawStatus,
      publicResponse: officialResponse,
      resolvedAt: feedbackItem?.resolvedAt || caseItem?.closedAt || null,
      createdAt: caseItem?.createdAt || feedbackItem?.createdAt,
      updatedAt: feedbackItem?.updatedAt || caseItem?.updatedAt,
      timeline,
    }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return NextResponse.json(
      { error: 'Chưa thể tra cứu lúc này.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
