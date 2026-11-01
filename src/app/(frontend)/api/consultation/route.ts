import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit, validPhone } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    if (bodyIsTooLarge(req, 8_000)) return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 })
    const throttle = rateLimit(req, 'consultation-create', 60, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều câu hỏi. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const parsed = await readJsonBodyWithLimit<Record<string, any>>(req, 8_000)
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    const body = parsed.data || {}
    if (body.website) return NextResponse.json({ ok: true, token: 'CONSULT-BOT' })
    const rawQuestion = String(body.question || '').trim().slice(0, 3000)
    const existingToken = String(body.token || '').trim().slice(0, 100)
    const fullName = String(body.fullName || '').trim().slice(0, 150)
    const phone = String(body.phone || '').trim().slice(0, 30)

    if ((rawQuestion.length < 2 && !phone) || (phone && !validPhone(phone))) return NextResponse.json({ error: 'Nội dung hoặc số điện thoại không hợp lệ' }, { status: 400 })

    const payload = await getCMS()
    const now = new Date().toISOString()
    if (existingToken) {
      if (existingToken.length < 20) return NextResponse.json({ error: 'Mã hội thoại không hợp lệ' }, { status: 400 })
      const result = await payload.find({
        collection: 'consultations',
        where: { publicToken: { equals: existingToken } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const current: any = result.docs[0]
      if (!current) return NextResponse.json({ error: 'Không tìm thấy hội thoại' }, { status: 404 })
      if (current.status === 'closed') return NextResponse.json({ error: 'Hội thoại đã kết thúc' }, { status: 409 })
      const messages = [
        ...(Array.isArray(current.messages) ? current.messages : []),
        { sender: 'user', text: rawQuestion, sentAt: now },
      ].slice(-200)
      await payload.update({
        collection: 'consultations',
        id: current.id,
        data: { messages, status: current.status === 'answered' ? 'processing' : current.status, lastMessageAt: now },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, token: existingToken })
    }

    let question = rawQuestion
    if (fullName || phone) {
      const contactInfo = [
        fullName ? `Họ tên: ${fullName}` : '',
        phone ? `SĐT: ${phone}` : '',
      ].filter(Boolean).join(' | ')
      question = `[YÊU CẦU GỌI LẠI / TƯ VẤN] ${contactInfo}\nNội dung: ${rawQuestion || 'Yêu cầu tư vấn viên liên hệ hỗ trợ'}`
    }

    const publicToken = randomUUID()
    await payload.create({
      collection: 'consultations',
      data: { publicToken, question, status: 'new', messages: [{ sender: 'user', text: question, sentAt: now }], lastMessageAt: now },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, token: publicToken })
  } catch {
    return NextResponse.json({ error: 'Chưa thể chuyển câu hỏi đến tư vấn viên' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const throttle = rateLimit(req, 'consultation-status', 400, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const token = new URL(req.url).searchParams.get('token')?.trim() || ''
    if (token.length < 20) return NextResponse.json({ error: 'Mã yêu cầu không hợp lệ' }, { status: 400 })

    const payload = await getCMS()
    const result = await payload.find({
      collection: 'consultations',
      where: { publicToken: { equals: token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const item: any = result.docs[0]
    if (!item) return NextResponse.json({ error: 'Không tìm thấy yêu cầu' }, { status: 404 })
    const messages = Array.isArray(item.messages)
      ? item.messages.map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, sentAt: message.sentAt }))
      : []
    return NextResponse.json({ status: item.status, reply: item.staffReply || '', messages })
  } catch {
    return NextResponse.json({ error: 'Chưa thể kiểm tra câu trả lời' }, { status: 500 })
  }
}
