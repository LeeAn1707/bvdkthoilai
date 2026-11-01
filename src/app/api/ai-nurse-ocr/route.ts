import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit } from '@/lib/request-security'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const GEMINI_TIMEOUT_MS = 20_000

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
    if (!user) return json({ error: 'Bạn cần đăng nhập để sử dụng chức năng AI OCR.' }, 401)
    if (!hasModulePermission(user, 'schedules', 'import')) {
      return json({ error: 'Bạn không có quyền nhập lịch điều dưỡng.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (!Number.isFinite(contentLength) || contentLength <= 0 || bodyIsTooLarge(req, MAX_BODY_BYTES)) {
      return json({ error: 'Ảnh tải lên vượt giới hạn 8 MB hoặc request không hợp lệ.' }, 413)
    }

    const throttle = rateLimit(req, `nurse-ocr:${user.id}`, 5, 15 * 60_000)
    if (!throttle.allowed) {
      return json(
        { error: 'Bạn đã dùng AI OCR quá nhiều lần. Vui lòng thử lại sau.' },
        429,
        { 'Retry-After': String(throttle.retryAfter) },
      )
    }

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile || typeof imageFile.arrayBuffer !== 'function') {
      return json({ error: 'Vui lòng chọn hoặc tải lên ảnh chụp lịch điều dưỡng.' }, 400)
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size <= 0 || imageFile.size > MAX_FILE_BYTES) {
      return json({ error: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 8 MB.' }, 415)
    }

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      return json({
        error: 'Chưa cấu hình Google Gemini API Key trên máy chủ. Vui lòng liên hệ quản trị hệ thống.'
      }, 503)
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const mimeType = imageFile.type || 'image/jpeg'
    if (!matchesImageSignature(buffer, mimeType)) {
      return json({ error: 'Nội dung tệp không khớp với định dạng ảnh đã khai báo.' }, 415)
    }
    const base64Image = buffer.toString('base64')

    // System prompt chuyên dụng cho LỊCH NGÀY ĐD - NHS (ĐIỀU DƯỠNG - NỮ HỘ SINH)
    const prompt = `
Bạn là chuyên gia OCR và xử lý văn bản y tế cho bệnh viện Việt Nam.
Nhiệm vụ của bạn là phân tích bức ảnh "LỊCH NGÀY ĐD - NHS" (Lịch Điều dưỡng - Nữ hộ sinh theo ngày) của bệnh viện và trích xuất dữ liệu thành định dạng JSON chuẩn.

CẤU TRÚC BẢNG LỊCH ĐD - NHS:
- Tiêu đề phía trên: "LỊCH NGÀY ĐD - NHS" và dòng ngày "(Ngày DD/MM/YYYY)".
- Bảng có 3 cột chính:
  1. Cột 1: "KHOA" (VD: KHÁM BỆNH-LCK, HSCC, NỘI- NHI- TRUYỀN NHIỄM, YHCT và PHCN, PHỤ SẢN, NGOẠI TH, KSNK, Phòng KHTH, Phòng ĐD...)
  2. Cột 2: "Hành chánh" (hoặc "Hành chính") chứa danh sách điều dưỡng/nữ hộ sinh trực hành chánh. Các thông tin vị trí phụ có thể ghi kèm như "Tuyền S: Phòng răng. Phòng tiêm ngừa: Ys Trang, Ys Oanh. Phòng khám lao: CN Thắm."
  3. Cột 3: "Tăng cường" chứa nhân sự tăng cường, hỗ trợ (VD: "Trình ký giấy: Thiện. Ys Ngân S: (Phòng DV + BSGĐ)", "M.Nga, Bích, T.Hằng, Hs Loan, Ys Ngân C, Liễu, Duy, Thông C, Công C", "B.Ngân, Uyên S"...)
- Chân trang bên dưới bảng: Có thể có dòng "Ghi chú: Nghỉ phép: ..." (VD: "Ghi chú: Nghỉ phép: Lập, Nghi, Kiên.")

QUY TẮC TRÍCH XUẤT:
1. Xác định ngày từ tiêu đề: trả về "date" dạng YYYY-MM-DD (VD: "(Ngày 18/09/2026)" -> "2026-09-18").
2. Xác định tiêu đề lịch: "LỊCH NGÀY ĐD - NHS (Ngày 18/09/2026)".
3. Với mỗi hàng Khoa / Phòng:
   - "departmentName": Tên khoa chính xác như trong ảnh (VD: "KHÁM BỆNH-LCK", "HSCC", "NỘI- NHI- TRUYỀN NHIỄM", "YHCT và PHCN", "PHỤ SẢN", "NGOẠI TH", "KSNK", "Phòng KHTH", "Phòng ĐD").
   - "departmentIcon": Chọn icon tương ứng từ danh sách:
     + "stethoscope": KHÁM, KHÁM BỆNH-LCK, PHÒNG KHÁM
     + "ambulance": HSCC, CẤP CỨU
     + "bed": NỘI, NỘI-NHI, TRUYỀN NHIỄM
     + "mortar": YHCT, PHCN, Y HỌC CỔ TRUYỀN
     + "baby": PHỤ SẢN, SẢN
     + "scalpel": NGOẠI TH, NGOẠI
     + "virus": KSNK, KIỂM SOÁT NHIỄM KHUẨN
     + "clinic": Phòng KHTH, Phòng ĐD, các phòng ban khác
   - "administrativeStaff": Toàn bộ nội dung ở cột Hành chánh của hàng đó. Giữ nguyên xuống dòng hoặc dấu chấm phân cách các vị trí cụ thể.
   - "reinforcementStaff": Toàn bộ nội dung ở cột Tăng cường của hàng đó. Nếu ô trống, trả về "".
4. Dòng ghi chú nghỉ phép ở cuối: Trích xuất vào trường "generalNote" (VD: "Ghi chú: Nghỉ phép: Lập, Nghi, Kiên."). Nếu không có, trả về "".

ĐỊNH DẠNG JSON BẮT BUỘC TRẢ VỀ (CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "title": "LỊCH NGÀY ĐD - NHS (Ngày 18/09/2026)",
  "date": "2026-09-18",
  "generalNote": "Ghi chú: Nghỉ phép: Lập, Nghi, Kiên.",
  "assignments": [
    {
      "departmentName": "KHÁM BỆNH-LCK",
      "departmentIcon": "stethoscope",
      "administrativeStaff": "Vân, Song, Tuấn, Hạnh, Diễm, Tuyền C, Yến.\\nTuyền S: Phòng răng.\\nPhòng tiêm ngừa: Ys Trang, Ys Oanh.\\nPhòng khám lao: CN Thắm.",
      "reinforcementStaff": "Trình ký giấy: Thiện\\nYs Ngân S: (Phòng DV + BSGĐ)",
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

    const payloadBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    }

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
            body: JSON.stringify(payloadBody),
            cache: 'no-store',
            signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          })

          if (res.ok) {
            geminiRes = res
            break
          } else {
            lastErrorText = await res.text()
            console.warn(`Model ${modelName} thất bại (${res.status}): ${lastErrorText.slice(0, 150)}`)
            if ((res.status === 503 || res.status === 429) && attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              continue
            }
            break
          }
        } catch (err: any) {
          lastErrorText = err?.message || String(err)
          console.warn(`Lỗi khi gọi model ${modelName}:`, err)
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
    const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!rawText) {
      return json({ error: 'AI không trả về kết quả nhận diện nào.' }, 502)
    }

    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    if (cleanJson.length > 1_000_000) {
      return json({ error: 'Kết quả AI vượt giới hạn xử lý an toàn.' }, 502)
    }
    const parsedData = JSON.parse(cleanJson)
    if (!parsedData || typeof parsedData !== 'object' || !Array.isArray(parsedData.assignments)) {
      return json({ error: 'Kết quả AI không đúng định dạng lịch điều dưỡng.' }, 502)
    }
    if (parsedData.assignments.length > 100) {
      return json({ error: 'Kết quả AI vượt giới hạn số dòng cho phép.' }, 502)
    }

    await payload.create({
      collection: 'audit-logs' as any,
      data: {
        actor: user.id,
        actorEmail: user.email,
        action: 'other',
        resource: 'schedules',
        summary: 'Quét ảnh lịch điều dưỡng (ĐD - NHS) bằng AI OCR',
        metadata: { mimeType, fileSize: imageFile.size, rows: parsedData.assignments.length },
      },
      overrideAccess: true,
    }).catch(() => null)

    return json({
      success: true,
      data: parsedData,
    })

  } catch (error: any) {
    console.error('Nurse OCR Error:', error)
    return json({ error: 'Có lỗi xảy ra trong quá trình quét ảnh lịch điều dưỡng.' }, 500)
  }
}
