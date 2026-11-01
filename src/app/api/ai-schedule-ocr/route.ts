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
      return json({ error: 'Bạn không có quyền nhập lịch trực.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (!Number.isFinite(contentLength) || contentLength <= 0 || bodyIsTooLarge(req, MAX_BODY_BYTES)) {
      return json({ error: 'Ảnh tải lên vượt giới hạn 8 MB hoặc request không hợp lệ.' }, 413)
    }

    const throttle = rateLimit(req, `schedule-ocr:${user.id}`, 5, 15 * 60_000)
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
      return json({ error: 'Vui lòng chọn hoặc tải lên ảnh chụp lịch trực.' }, 400)
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size <= 0 || imageFile.size > MAX_FILE_BYTES) {
      return json({ error: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 8 MB.' }, 415)
    }

    // API key chỉ được đọc từ secret phía server; không nhận từ client hoặc Payload CMS.
    const apiKey = process.env.GEMINI_API_KEY || ''

    if (!apiKey) {
      return json({
        error: 'Chưa cấu hình Google Gemini API Key trên máy chủ. Vui lòng liên hệ quản trị hệ thống.'
      }, 503)
    }

    // Chuyển file sang Base64
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const mimeType = imageFile.type || 'image/jpeg'
    if (!matchesImageSignature(buffer, mimeType)) {
      return json({ error: 'Nội dung tệp không khớp với định dạng ảnh đã khai báo.' }, 415)
    }
    const base64Image = buffer.toString('base64')

    // System prompt chuyên dụng cho ma trận lịch trực bệnh viện Việt Nam
    const prompt = `
Bạn là chuyên gia OCR và xử lý văn bản y tế cho bệnh viện Việt Nam.
Nhiệm vụ của bạn là phân tích bức ảnh LỊCH TRỰC TUẦN / MA TRẬN PHÂN CÔNG TRỰC BỆNH VIỆN và trích xuất dữ liệu thành định dạng JSON chuẩn.

QUY TẮC PHÂN TÍCH:
1. Xác định Tiêu đề lịch (VD: "LỊCH TRỰC BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI" hoặc tương đương).
2. Xác định Thời gian tuần: "Từ ngày DD/MM/YYYY đến ngày DD/MM/YYYY". Trả về emergencyWeekStart và emergencyWeekEnd dạng YYYY-MM-DD.
3. Nhận diện các cột ngày từ Thứ Hai đến Chủ Nhật:
   - day2: Thứ Hai
   - day3: Thứ Ba
   - day4: Thứ Tư
   - day5: Thứ Năm
   - day6: Thứ Sáu
   - day7: Thứ Bảy
   - day8: Chủ Nhật
4. Nhận diện từng dòng Khoa / Bộ phận (deptName), Vai trò / Loại nhân sự (subRole) và phân loại deptType:
   - Lãnh đạo trực ngày: deptName: "LÃNH ĐẠO", subRole: "LÃNH ĐẠO", deptType: "leader"
   - Cấp cứu tổng hợp - Bác sĩ: deptName: "CẤP CỨU TỔNG HỢP", subRole: "BÁC SĨ", deptType: "clinical"
   - Cấp cứu tổng hợp - Điều dưỡng: deptName: "CẤP CỨU TỔNG HỢP", subRole: "ĐIỀU DƯỠNG", deptType: "clinical"
   - Các khoa Sản, Nội - Nhi, Dược, Cận lâm sàng, X-Quang, Tài xế, Viện phí, Điện nước... Trích xuất chính xác tên bác sĩ / nhân viên trực từng ngày. Nếu 1 ô có nhiều tên (mỗi người 1 dòng hoặc cách nhau bởi dấu phẩy/chấm), nối các tên bằng ký tự xuống dòng '\\n'.
5. Nhận diện dòng "THƯỜNG TRỰC LÃNH ĐẠO" (nếu có, VD: "Bs Trần Quốc Luận (Thường trực 24/7, ĐT: 0943.068.189)"): tạo một slot RIÊNG trong mảng "slots" với deptName: "THƯỜNG TRỰC LÃNH ĐẠO", deptType: "leader", và điền NỘI DUNG ĐÓ vào TẤT CẢ các trường day2 đến day8 (vì ô này gộp toàn bộ 7 ngày trên bảng). KHÔNG đặt vào generalNote hay fixedStaff.
6. Nhận diện danh bạ điện thoại ở phía dưới (nếu có):
   - Tên bộ phận/cá nhân, số điện thoại, type ('internal' nếu là tài xế/điện nước/bảo vệ/nội bộ, 'emergency_unit' nếu là bệnh viện tuyến trên như Đa khoa TW, Nhi Đồng...).

ĐỊNH DẠNG JSON BẮT BUỘC TRẢ VỀ (CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "title": "Lịch trực Bệnh viện ...",
  "emergencyWeekStart": "YYYY-MM-DD",
  "emergencyWeekEnd": "YYYY-MM-DD",
  "weekLabel": "Từ ngày ... đến ngày ...",
  "generalNote": "...",
  "slots": [
    {
      "deptName": "Tên Khoa/Phòng",
      "subRole": "BÁC SĨ / ĐIỀU DƯỠNG / ...",
      "deptType": "clinical | leader | paraclinical | admin",
      "day2": "Tên nhân sự trực Thứ 2 (xuống dòng nếu nhiều người)",
      "day3": "Tên nhân sự trực Thứ 3",
      "day4": "Tên nhân sự trực Thứ 4",
      "day5": "Tên nhân sự trực Thứ 5",
      "day6": "Tên nhân sự trực Thứ 6",
      "day7": "Tên nhân sự trực Thứ 7",
      "day8": "Tên nhân sự trực Chủ Nhật",
      "fixedStaff": "",
      "note": ""
    }
  ],
  "contacts": [
    {
      "name": "Hiện (Tài xế)",
      "phone": "0798.010.703",
      "type": "internal",
      "note": ""
    }
  ]
}
`

    // Danh sách các model theo thứ tự ưu tiên (gemini-3.8-flash là model chuẩn mới nhất)
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

    // Làm sạch markdown nếu có ```json ... ```
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    if (cleanJson.length > 1_000_000) {
      return json({ error: 'Kết quả AI vượt giới hạn xử lý an toàn.' }, 502)
    }
    const parsedData = JSON.parse(cleanJson)
    if (!parsedData || typeof parsedData !== 'object' || !Array.isArray(parsedData.slots)) {
      return json({ error: 'Kết quả AI không đúng định dạng lịch trực.' }, 502)
    }
    if (parsedData.slots.length > 250 || (Array.isArray(parsedData.contacts) && parsedData.contacts.length > 100)) {
      return json({ error: 'Kết quả AI vượt giới hạn số dòng cho phép.' }, 502)
    }

    await payload.create({
      collection: 'audit-logs' as any,
      data: {
        actor: user.id,
        actorEmail: user.email,
        action: 'other',
        resource: 'schedules',
        summary: 'Quét ảnh lịch trực bằng AI OCR',
        metadata: { mimeType, fileSize: imageFile.size, slots: parsedData.slots.length },
      },
      overrideAccess: true,
    }).catch(() => null)

    return json({
      success: true,
      data: parsedData,
    })

  } catch (error: any) {
    console.error('OCR Error:', error)
    return json({ error: 'Có lỗi xảy ra trong quá trình quét ảnh lịch trực.' }, 500)
  }
}
