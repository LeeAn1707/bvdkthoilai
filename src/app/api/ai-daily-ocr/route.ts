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
      return json({ error: 'Bạn không có quyền nhập lịch khám.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (!Number.isFinite(contentLength) || contentLength <= 0 || bodyIsTooLarge(req, MAX_BODY_BYTES)) {
      return json({ error: 'Ảnh tải lên vượt giới hạn 8 MB hoặc request không hợp lệ.' }, 413)
    }

    const throttle = rateLimit(req, `daily-ocr:${user.id}`, 5, 15 * 60_000)
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
      return json({ error: 'Vui lòng chọn hoặc tải lên ảnh chụp lịch khám.' }, 400)
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

    // System prompt chuyên dụng cho LỊCH KHÁM THEO NGÀY (4 ca)
    const prompt = `
Bạn là chuyên gia OCR và xử lý văn bản y tế cho bệnh viện Việt Nam.
Nhiệm vụ của bạn là phân tích bức ảnh LỊCH KHÁM THEO NGÀY của bệnh viện và trích xuất dữ liệu thành định dạng JSON chuẩn.

CẤU TRÚC BẢNG LỊCH NGÀY:
- Hàng tiêu đề: "LỊCH NGÀY DD/MM/YYYY" (hoặc "LỊCH KHÁM NGÀY...")
- Cột 1: Tên Khoa / Phòng (VD: KHÁM, CẤP CỨU, NỘI, YHCT, NGOẠI, SKSS, SIÊU ÂM, RA TRỰC, TRỰC COVID...)
- Cột 2: Ca sáng "7 - 10 giờ" (hoặc "7:00 - 10:00", "Sáng")
- Cột 3: Ca giữa sáng "10 - 11 giờ" (hoặc "10:00 - 11:00", "Trưa")
- Cột 4: Ca chiều "13 - 16 giờ" (hoặc "13:00 - 16:00", "Chiều")
- Cột 5: Ca cuối chiều "16 - 17 giờ" (hoặc "16:00 - 17:00", "Tối")

QUY TẮC TRÍCH XUẤT:
1. Xác định ngày từ tiêu đề: trả về "date" dạng YYYY-MM-DD (VD: "2026-09-18").
2. Xác định tiêu đề lịch (VD: "LỊCH NGÀY 18.9.2026").
3. Với mỗi hàng Khoa/Phòng:
   - Trích xuất CHÍNH XÁC tên bác sĩ / nhân sự tại từng ca.
   - Nếu 1 ô có nhiều tên (mỗi người 1 dòng hoặc cách nhau bởi dấu phẩy/chấm/gạch ngang), nối các tên bằng dấu phẩy ", ".
   - Nếu ô trống hoặc chỉ có dấu gạch, trả về chuỗi rỗng "".
   - Tên viết tắt như "Bs Năm", "Bs. Dương", "Phương", "Sang(mắt)"... giữ nguyên như trong ảnh.
4. Nhận diện tên khoa chính xác: đừng bịa tên — chỉ lấy những gì thực sự có trong ảnh.
5. Nếu có dòng "TRỰC COVID" hoặc "TRỰC ĐÊM" hoặc dòng đặc biệt, vẫn trích xuất tương tự.

ĐỊNH DẠNG JSON BẮT BUỘC TRẢ VỀ (CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "title": "LỊCH NGÀY DD/MM/YYYY",
  "date": "YYYY-MM-DD",
  "assignments": [
    {
      "departmentName": "KHÁM",
      "departmentIcon": "stethoscope",
      "morningDoctors": "Dương, Tuấn, Trang, Tân, Trung, Thu, Phương, Sang (mắt)",
      "noonDoctors": "Dương, Tuấn, Trang, Tân, Trung, Thu, Phương, Sang (mắt)",
      "afternoonDoctors": "Dương, Tuấn, Trang, Tân, Trung, Thu, Phương, Sang (mắt)",
      "eveningDoctors": "Dương, Tuấn, Trang, Tân, Trung, Thu, Phương, Sang (mắt)",
      "note": ""
    }
  ]
}

QUY TẮC CHỌN departmentIcon (chọn giá trị phù hợp nhất):
- "stethoscope": KHÁM BỆNH, KHÁM ĐA KHOA, PHÒNG KHÁM
- "ambulance": CẤP CỨU, CẤP CỨU TỔNG HỢP
- "bed": NỘI, NỘI-NHI, NỘI NHI, NHI KHOA, NỘI TỔNG HỢP
- "mortar": YHCT, Y HỌC CỔ TRUYỀN, DƯỢC
- "scalpel": NGOẠI, NGOẠI KHOA, PHẪU THUẬT
- "baby": SẢN, SKSS, SỨC KHỎE SINH SẢN, PHỤ SẢN
- "ultrasound": SIÊU ÂM, X-QUANG, CẬN LÂM SÀNG, XÉT NGHIỆM
- "tooth": RĂNG HÀM MẶT, NHA KHOA
- "virus": TRỰC COVID, PHÒNG CHỐNG DỊCH
- "clinic": (tất cả các khoa còn lại)
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
      return json({ error: 'Kết quả AI không đúng định dạng lịch ngày.' }, 502)
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
        summary: 'Quét ảnh lịch khám ngày bằng AI OCR',
        metadata: { mimeType, fileSize: imageFile.size, rows: parsedData.assignments.length },
      },
      overrideAccess: true,
    }).catch(() => null)

    return json({
      success: true,
      data: parsedData,
    })

  } catch (error: any) {
    console.error('Daily OCR Error:', error)
    return json({ error: 'Có lỗi xảy ra trong quá trình quét ảnh lịch khám.' }, 500)
  }
}
