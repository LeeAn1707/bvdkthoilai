import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit } from '@/lib/request-security'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const GEMINI_TIMEOUT_MS = 25_000

const matchesImageSignature = (buffer: Buffer, mimeType: string) => {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  return false
}

const json = (body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
  })

export async function POST(req: NextRequest) {
  try {
    const payload = await getCMS()
    const user = await getVerifiedActiveUser(payload, req.headers)
    if (!user) return json({ error: 'Bạn cần đăng nhập để sử dụng tính năng AI OCR.' }, 401)
    if (
      !hasModulePermission(user, 'work-schedules', 'import') &&
      !hasModulePermission(user, 'work-schedules', 'create') &&
      !hasModulePermission(user, 'work-schedules', 'edit')
    ) {
      return json({ error: 'Bạn không có quyền nhập hoặc chỉnh sửa lịch công tác tuần.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (!Number.isFinite(contentLength) || contentLength <= 0 || bodyIsTooLarge(req, MAX_BODY_BYTES)) {
      return json({ error: 'Ảnh tải lên vượt giới hạn 8 MB hoặc request không hợp lệ.' }, 413)
    }

    const throttle = rateLimit(req, `work-schedule-ocr:${user.id}`, 8, 15 * 60_000)
    if (!throttle.allowed) {
      return json(
        { error: 'Bạn đã dùng tính năng Quét ảnh AI quá nhiều lần. Vui lòng thử lại sau ít phút.' },
        429,
        { 'Retry-After': String(throttle.retryAfter) },
      )
    }

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile || typeof imageFile.arrayBuffer !== 'function') {
      return json({ error: 'Vui lòng chọn hoặc tải lên ảnh chụp lịch công tác tuần.' }, 400)
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size <= 0 || imageFile.size > MAX_FILE_BYTES) {
      return json({ error: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 8 MB.' }, 415)
    }

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      return json({
        error: 'Chưa cấu hình GEMINI_API_KEY trong biến môi trường của máy chủ.'
      }, 503)
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const mimeType = imageFile.type
    if (!matchesImageSignature(buffer, mimeType)) {
      return json({ error: 'Nội dung tệp không khớp với định dạng ảnh đã khai báo.' }, 415)
    }
    const base64Image = buffer.toString('base64')

    const prompt = `
Bạn là chuyên gia phân tích văn bản hành chính y tế tại Việt Nam.
Bức ảnh này là một văn bản "LỊCH CÔNG TÁC TUẦN" của "BVĐK KHU VỰC THỚI LAI" (thuộc SỞ Y TẾ THÀNH PHỐ CẦN THƠ).
Nhiệm vụ của bạn là đọc và trích xuất TOÀN BỘ dữ liệu trên ảnh thành định dạng JSON chuẩn.

QUY TẮC BÓC TÁCH:
1. "documentNumber": Số hiệu văn bản (VD: "08/LLV - BVĐKKVTL").
2. "revision": Phiên bản hoặc lần chỉnh sửa nếu có trong ô góc trái (VD: "CHỈNH SỬA 02", "CHỈNH SỬA 01" hoặc để trống).
3. "title": Tiêu đề lịch (VD: "LỊCH CÔNG TÁC TUẦN (Từ ngày 21/9/2026 – 25/9/2026)").
4. "startDate": Ngày bắt đầu tuần dạng YYYY-MM-DD (VD: "2026-09-21").
5. "endDate": Ngày kết thúc tuần dạng YYYY-MM-DD (VD: "2026-09-25").
6. "weekNumber": Số thứ tự của tuần trong năm (nếu tính được từ ngày hoặc trên văn bản có ghi, VD: 39).
7. "year": Năm (VD: 2026).
8. "days": Mảng chứa các ngày từ Thứ Hai đến Thứ Sáu (hoặc đến Chủ Nhật):
   - "dayLabel": "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật".
   - "dateFormatted": Ngày cụ thể ghi trong ngoặc dưới thứ (VD: "(21/9/26)", "(22/9/26)", "(23/9/26)...").
   - "morningContent": Nội dung công tác buổi Sáng (VD: "- 8h00: Ban giám đốc, phòng TCHC... tiếp đoàn thẩm định SYT tại Hội trường giao ban"). Nếu có gạch đầu dòng hoặc dấu sao *, giữ nguyên.
   - "afternoonContent": Nội dung công tác buổi Chiều (VD: "13h00: Bs Hạnh, Bs Huy tham gia đoàn công tác...").
   - "note": Ghi chú riêng cho ngày (nếu có cột Ghi chú).
9. "generalNote": Ghi chú chân trang (VD: "Tùy tình hình thực tế. Lịch làm việc này có thể thay đổi, Bệnh viện Đa khoa khu vực Thới Lai sẽ có thông báo sau./.").
10. "signerRole": Chức danh người ký (VD: "TL. GIÁM ĐỐC" hoặc "GIÁM ĐỐC").
11. "signerName": Họ tên người ký bên dưới chữ ký (VD: "DSCKI. Dương Văn Bé").

ĐỊNH DẠNG JSON BẮT BUỘC TRẢ VỀ (CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "documentNumber": "08/LLV - BVĐKKVTL",
  "revision": "CHỈNH SỬA 02",
  "title": "LỊCH CÔNG TÁC TUẦN (Từ ngày 21/9/2026 – 25/9/2026)",
  "weekNumber": 39,
  "year": 2026,
  "startDate": "2026-09-21",
  "endDate": "2026-09-25",
  "generalNote": "Tùy tình hình thực tế. Lịch làm việc này có thể thay đổi, Bệnh viện Đa khoa khu vực Thới Lai sẽ có thông báo sau./.",
  "signerRole": "TL. GIÁM ĐỐC",
  "signerName": "DSCKI. Dương Văn Bé",
  "days": [
    {
      "dayLabel": "Thứ hai",
      "dateFormatted": "(21/9/26)",
      "morningContent": "",
      "afternoonContent": "",
      "note": ""
    },
    {
      "dayLabel": "Thứ ba",
      "dateFormatted": "(22/9/26)",
      "morningContent": "- 8h00: Ban giám đốc, phòng TCHC, P. KHTH, P. TCKT, K. DƯỢC và các bộ phận liên quan tiếp đoàn thẩm định giấy phép hoạt động SYT tại Hội trường giao ban",
      "afternoonContent": "",
      "note": ""
    },
    {
      "dayLabel": "Thứ tư",
      "dateFormatted": "(23/9/26)",
      "morningContent": "* Bs Thắng khám sức khỏe tại trường mầm non Cờ Đỏ (cả ngày)",
      "afternoonContent": "13h00: Bs Hạnh, Bs Huy tham gia đoàn công tác hỗ trợ chuyên môn kỹ thuật, hỗ trợ, kiểm tra... tại BVĐKKV Cái Răng",
      "note": ""
    },
    {
      "dayLabel": "Thứ năm",
      "dateFormatted": "(24/9/26)",
      "morningContent": "* Bs Thắng khám sức khỏe tại trường mầm non Cờ Đỏ (cả ngày)",
      "afternoonContent": "",
      "note": ""
    },
    {
      "dayLabel": "Thứ sáu",
      "dateFormatted": "(25/9/26)",
      "morningContent": "",
      "afternoonContent": "",
      "note": ""
    }
  ]
}
`

    const CANDIDATE_MODELS = [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ]

    let geminiRes: Response | null = null
    let lastErrorText = ''

    for (const modelName of CANDIDATE_MODELS) {
      let attempts = 0
      const maxAttempts = 2
      while (attempts < maxAttempts) {
        attempts++
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Image } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                response_mime_type: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          })

          if (res.ok) {
            geminiRes = res
            break
          } else {
            lastErrorText = await res.text()
            console.warn(`Model ${modelName} thất bại (status ${res.status}):`, lastErrorText.slice(0, 160))
            if ((res.status === 503 || res.status === 429) && attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              continue
            }
            break
          }
        } catch (err) {
          lastErrorText = err instanceof Error ? err.message : String(err)
          console.warn(`Model ${modelName} gặp lỗi:`, lastErrorText)
          break
        }
      }
      if (geminiRes) break
    }

    if (!geminiRes) {
      console.error('Tất cả models Gemini đều không phản hồi thành công:', lastErrorText)
      return json({ error: 'Dịch vụ AI OCR tạm thời không phản hồi. Vui lòng thử lại sau.' }, 502)
    }

    const resJson = await geminiRes.json()
    const textOutput = resJson?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textOutput) {
      return json({ error: 'AI không đọc được nội dung trên bức ảnh này.' }, 502)
    }

    if (textOutput.length > 1_000_000) {
      return json({ error: 'Kết quả AI vượt giới hạn xử lý an toàn.' }, 502)
    }

    let parsed: any
    try {
      parsed = JSON.parse(textOutput)
    } catch {
      const match = textOutput.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else return json({ error: 'Kết quả AI không đúng định dạng lịch công tác tuần.' }, 502)
    }

    await payload.create({
      collection: 'audit-logs' as any,
      data: {
        actor: user.id,
        actorEmail: user.email,
        action: 'other',
        resource: 'work-schedules',
        summary: 'Quét ảnh lịch công tác tuần bằng AI OCR',
        metadata: { mimeType, fileSize: imageFile.size, days: Array.isArray(parsed?.days) ? parsed.days.length : 0 },
      },
      overrideAccess: true,
    }).catch(() => null)

    return json({
      success: true,
      data: parsed,
    })
  } catch (error) {
    console.error('Lỗi API ai-work-schedule-ocr:', error instanceof Error ? error.message : error)
    return json({ error: 'Có lỗi xảy ra trong quá trình quét ảnh lịch công tác tuần.' }, 500)
  }
}
