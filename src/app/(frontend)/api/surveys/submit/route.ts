import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit, verifyTurnstile } from '@/lib/request-security'

export async function POST(req: Request) {
  try {
    if (bodyIsTooLarge(req, 100_000)) {
      return NextResponse.json({ error: 'Dữ liệu quá lớn.' }, { status: 413 })
    }

    const lim = rateLimit(req, 'survey-submit', 15, 15 * 60_000)
    if (!lim.allowed) {
      return NextResponse.json({ error: 'Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút.' }, { status: 429, headers: { 'Retry-After': String(lim.retryAfter) } })
    }

    const parsed = await readJsonBodyWithLimit<Record<string, any>>(req, 100_000)
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    }
    const b = parsed.data || {}

    // Honeypot bot check
    if (b.website) {
      return NextResponse.json({ ok: true, code: 'KS-OK' })
    }

    // Turnstile bot verification
    if (!(await verifyTurnstile(req, b['cf-turnstile-response']))) {
      return NextResponse.json({ error: 'Không thể xác minh bảo mật. Vui lòng thử lại.' }, { status: 403 })
    }

    const p = await getCMS()
    const campaignId = Number(b.campaignId)
    if (!Number.isFinite(campaignId)) {
      return NextResponse.json({ error: 'Mã đợt khảo sát không hợp lệ.' }, { status: 400 })
    }

    const cr = await p.find({
      collection: 'survey-campaigns',
      where: {
        and: [
          { id: { equals: campaignId } },
          { active: { equals: true } },
        ],
      },
      limit: 1,
      depth: 3,
      overrideAccess: true,
    })

    const c: any = cr.docs[0]
    if (!c) {
      return NextResponse.json({ error: 'Đợt khảo sát không tồn tại hoặc đã bị đóng.' }, { status: 404 })
    }

    const now = new Date()
    if ((c.startAt && new Date(c.startAt) > now) || (c.endAt && new Date(c.endAt) < now)) {
      return NextResponse.json({ error: 'Đợt khảo sát chưa mở hoặc đã kết thúc thời hạn tiếp nhận.' }, { status: 400 })
    }

    // Thu thập danh sách câu hỏi: từ customQuestions hoặc từ templateVersion snapshot
    let questions: any[] = []
    if (c.useCustomQuestions && Array.isArray(c.customQuestions) && c.customQuestions.length > 0) {
      questions = c.customQuestions.map((cq: any, idx: number) => ({
        id: cq.id || cq.code || `cq_${idx}`,
        code: cq.code || `C${idx + 1}`,
        question: cq.question,
        type: cq.type,
        required: cq.required !== false,
        options: cq.options,
      }))
    } else {
      const v: any = c.templateVersion
      questions = (v?.questions || [])
        .map((x: any) => (typeof x === 'object' ? x : null))
        .filter(Boolean)
    }

    const incoming = Array.isArray(b.answers) ? b.answers : []

    // Kiểm tra câu hỏi bắt buộc
    for (const q of questions) {
      const qKey = String(q.id || q.code)
      if (q.required) {
        const found = incoming.find((a: any) => String(a.question) === qKey)
        const answerVal = String(found?.value || '').trim()
        if (!answerVal) {
          return NextResponse.json({ error: `Vui lòng trả lời câu hỏi: "${q.question}"` }, { status: 400 })
        }
      }
    }

    // Tạo mã biên nhận định danh chuẩn
    const code = `KS-${now.getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`

    // Tính điểm trung bình (các câu hỏi dạng rating 1-5 hoặc 1-10)
    const numericScores: number[] = []
    for (const a of incoming) {
      const num = Number(a.value)
      if (Number.isFinite(num) && num >= 1 && num <= 10) {
        numericScores.push(num)
      }
    }
    const overallScore = numericScores.length > 0
      ? Number((numericScores.reduce((acc, curr) => acc + curr, 0) / numericScores.length).toFixed(2))
      : undefined

    const demographics = b.demographics || {}
    const comment = String(b.comment || '').trim().slice(0, 5000)

    // Tạo bản ghi trong feedbackCases để Ban Giám đốc & Phòng Quản lý Chất lượng theo dõi tập trung
    const detailedLines = [
      `PHIẾU KHẢO SÁT: ${c.title.toUpperCase()}`,
      `--------------------------------------------------`,
      `Mã biên nhận: ${code}`,
      `Thời gian tiếp nhận: ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      ``,
    ]

    if (b.demographics) {
      detailedLines.push(
        `I. THÔNG TIN NGƯỜI THAM GIA:`,
        `- Họ tên / Đại diện: ${demographics.name || 'Ẩn danh'}`,
        `- Giới tính: ${demographics.gender || 'Chưa cung cấp'}`,
        `- Độ tuổi: ${demographics.ageGroup || 'Chưa cung cấp'}`,
        `- Đối tượng: ${demographics.respondentType || 'Chưa cung cấp'}`,
        `- Số điện thoại: ${demographics.phone || 'Không lưu'}`,
        ``
      )
    }

    detailedLines.push(
      `II. CHI TIẾT CÂU TRẢ LỜI:`,
      ...questions.map((q: any, i: number) => {
        const qKey = String(q.id || q.code)
        const ans = incoming.find((a: any) => String(a.question) === qKey)
        return `${i + 1}. [${q.code || qKey}] ${q.question}\n   => Trả lời: ${ans?.value || '(Để trống)'}`
      }),
      ``,
      `III. Ý KIẾN / ĐÓNG GÓP KHÁC:`,
      `- Nội dung: ${comment || '(Không có)'}`,
      overallScore ? `- Điểm đánh giá trung bình: ${overallScore}/10` : ''
    )

    const detailedMessage = detailedLines.filter(Boolean).join('\n')

    try {
      await p.create({
        collection: 'feedbackCases',
        data: {
          code,
          name: `Khảo sát: ${c.title}`,
          phone: '0000000000',
          subject: `[${c.title}] ${overallScore ? `ĐTB: ${overallScore} điểm` : 'Ý kiến khảo sát mới'}`,
          message: detailedMessage,
          status: 'resolved',
          priority: 'normal',
          allowContact: false,
          publicResponse: 'Bệnh viện Đa khoa Khu vực Thới Lai xin chân thành cảm ơn Quý vị đã tham gia đóng góp ý kiến để bệnh viện ngày càng hoàn thiện chất lượng phục vụ.',
          closedAt: now.toISOString(),
        },
        overrideAccess: true,
      })
    } catch (caseErr) {
      console.warn('Could not save to feedbackCases:', caseErr)
    }

    // Nếu đợt khảo sát có liên kết templateVersion thì lưu tiếp vào survey-responses và survey-answers
    if (c.templateVersion) {
      try {
        const vId = typeof c.templateVersion === 'object' ? c.templateVersion.id : c.templateVersion
        const response: any = await p.create({
          collection: 'survey-responses',
          data: {
            responseCode: code,
            campaign: c.id,
            templateVersion: vId,
            department: typeof c.department === 'object' ? c.department?.id : c.department,
            submittedAt: now.toISOString(),
            overallScore,
            comment,
            locked: true,
          },
          overrideAccess: true,
        })

        for (const a of incoming) {
          const q = questions.find((x: any) => String(x.id || x.code) === String(a.question))
          if (!q || !Number.isFinite(Number(q.id))) continue
          const n = Number(a.value)
          await p.create({
            collection: 'survey-answers',
            data: {
              response: response.id,
              question: q.id,
              questionSnapshot: q.question,
              valueText: String(a.value || '').slice(0, 5000),
              score: Number.isFinite(n) && n >= 1 && n <= 10 ? n : undefined,
            },
            overrideAccess: true,
          })
        }
      } catch (respErr) {
        console.warn('Could not save to survey-responses collection:', respErr)
      }
    }

    return NextResponse.json({
      ok: true,
      code,
      overallScore,
    })
  } catch (e) {
    console.error('API SURVEY SUBMIT ERROR:', e)
    return NextResponse.json({ error: 'Không thể ghi nhận phiếu khảo sát. Vui lòng thử lại sau.' }, { status: 500 })
  }
}
