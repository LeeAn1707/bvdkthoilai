import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import config from '@payload-config'
import { REST_GET, REST_POST, REST_PATCH, REST_DELETE } from '@payloadcms/next/routes'
import { getCMS } from '@/lib/payload'
import { readJsonBodyWithLimit, clientAddress, rateLimit, validEmail, validPhone, verifyTurnstile } from '@/lib/request-security'
import { getNextAtomicAppointmentCode } from '@/lib/appointment-code'

export const dynamic = 'force-dynamic'

const restGet = REST_GET(config)
const restPost = REST_POST(config)
const restPatch = REST_PATCH(config)
const restDelete = REST_DELETE(config)

const generateAppointmentCode = () => `LK-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`

// Ủy quyền GET /api/appointments về Payload REST API (kiểm tra access.read theo từng khoa)
export async function GET(req: Request) {
  return restGet(req, { params: Promise.resolve({ slug: ['appointments'] }) })
}

// Ủy quyền PATCH /api/appointments về Payload REST API
export async function PATCH(req: Request) {
  return restPatch(req, { params: Promise.resolve({ slug: ['appointments'] }) })
}

// Ủy quyền DELETE /api/appointments về Payload REST API
export async function DELETE(req: Request) {
  return restDelete(req, { params: Promise.resolve({ slug: ['appointments'] }) })
}

export async function POST(req: Request) {
  // 1. Phân định routing: Nếu request có Authorization header (JWT/Bearer), cookie payload-token hoặc header x-payload-rest,
  // đây là request từ Payload CMS REST API (admin/staff/integration test kiểm tra Access Control)
  const authHeader = req.headers.get('authorization')
  const cookieHeader = req.headers.get('cookie') || ''
  const isPayloadRest = Boolean(
    (authHeader && (authHeader.startsWith('JWT ') || authHeader.startsWith('Bearer '))) ||
    cookieHeader.includes('payload-token=') ||
    req.headers.get('x-payload-rest') === 'true'
  )

  if (isPayloadRest) {
    return restPost(req, { params: Promise.resolve({ slug: ['appointments'] }) })
  }

  // 2. Ngược lại: đây là request đặt lịch khám công khai từ người dân (AppointmentBookingForm.tsx)
  try {
    const parsed = await readJsonBodyWithLimit(req, 25_000)
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    }
    const body = parsed.data || {}

    // Honeypot: nếu bot điền trường website ẩn thì âm thầm trả về giả lập thành công
    if (body.website) {
      return NextResponse.json({ ok: true, code: 'LK-BOT' })
    }

    // Cloudflare Turnstile verification
    if (!(await verifyTurnstile(req, body['cf-turnstile-response']))) {
      return NextResponse.json({ error: 'Xác thực an toàn (Turnstile) không thành công. Vui lòng thử lại.' }, { status: 400 })
    }

    const fullName = String(body.fullName || '').trim().slice(0, 150)
    const phone = String(body.phone || '').trim().slice(0, 30)
    const email = String(body.email || '').trim().slice(0, 200)
    const address = String(body.address || '').trim().slice(0, 500)
    const dob = body.dob ? String(body.dob).trim().slice(0, 30) : undefined
    const gender = ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'male'
    const specialty = body.specialty ? String(body.specialty).trim() : undefined
    const appointmentDate = String(body.appointmentDate || '').trim().slice(0, 30)
    const rawTimeSlot = String(body.timeSlot || '').trim()
    const timeSlotLabelFromBody = body.timeSlotLabel ? String(body.timeSlotLabel).trim().slice(0, 150) : ''
    const symptoms = String(body.symptoms || '').trim().slice(0, 3000)
    const insuranceNumber = String(body.insuranceNumber || '').trim().slice(0, 50)
    const doctor = body.doctor ? String(body.doctor).trim() : undefined

    const specialtyTitle = body.specialtyTitle ? String(body.specialtyTitle).trim().slice(0, 200) : (typeof specialty === 'string' ? specialty : undefined)
    const isSpecialtyNumeric = specialty && Number.isFinite(Number(specialty))
    const rawSpecialtyId = isSpecialtyNumeric ? Number(specialty) : undefined
    const parsedDoctor = doctor && Number.isFinite(Number(doctor)) ? Number(doctor) : undefined

    if (!fullName) {
      return NextResponse.json({ error: 'Vui lòng nhập họ và tên.' }, { status: 400 })
    }
    if (!validPhone(phone)) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ (cần từ 9 đến 11 số).' }, { status: 400 })
    }
    if (email && !validEmail(email)) {
      return NextResponse.json({ error: 'Địa chỉ email không đúng định dạng.' }, { status: 400 })
    }
    if (!appointmentDate) {
      return NextResponse.json({ error: 'Vui lòng chọn ngày khám mong muốn.' }, { status: 400 })
    }

    // Kiểm tra ngày khám không được nhỏ hơn ngày hiện tại (múi giờ Việt Nam UTC+7)
    const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const todayVNStr = nowVN.toISOString().slice(0, 10) // YYYY-MM-DD
    if (appointmentDate < todayVNStr) {
      return NextResponse.json(
        { error: 'Ngày đặt khám không được nhỏ hơn ngày hiện tại. Vui lòng chọn lại ngày hẹn khám phù hợp.' },
        { status: 400 }
      )
    }

    // Map nhãn tiếng Việt mặc định ban đầu
    const DEFAULT_TIME_SLOT_LABELS: Record<string, string> = {
      morning: 'Buổi sáng (07:00 – 11:30)',
      afternoon: 'Buổi chiều (13:00 – 17:00)',
      anytime: 'Giờ hành chính',
    }

    // Thông tin bảo mật & định danh thiết bị
    const clientIp = clientAddress(req)
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) || 'Unknown'
    const submittedAtRaw = body.submittedAt ? String(body.submittedAt).trim() : ''
    const submittedAtDate = submittedAtRaw && !isNaN(Date.parse(submittedAtRaw)) ? new Date(submittedAtRaw) : new Date()

    const payload = await getCMS()

    // 1. Đọc cấu hình chống spam & khung giờ khám thực tế từ Admin (appointment-settings)
    let appSettings: any = {}
    try {
      appSettings = await payload.findGlobal({ slug: 'appointment-settings' as any, overrideAccess: true })
    } catch {
      // Bỏ qua nếu chưa load được
    }

    // 2. Kiểm tra giới hạn số lần gửi từ 1 địa chỉ IP (mặc định 5 lần / 15 phút hoặc theo admin cấu hình / biến môi trường kiểm thử tải)
    const envRateLimitMax = process.env.APPOINTMENTS_RATE_LIMIT_MAX ? Number(process.env.APPOINTMENTS_RATE_LIMIT_MAX) : undefined
    const maxSubmissions = envRateLimitMax && envRateLimitMax > 0
      ? envRateLimitMax
      : (typeof appSettings?.maxSubmissionsPerIp === 'number' && appSettings.maxSubmissionsPerIp > 0 ? appSettings.maxSubmissionsPerIp : 5)
    const throttle = rateLimit(req, 'appointment-create', maxSubmissions, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: `Bạn đã thao tác đặt lịch quá nhiều lần (tối đa ${maxSubmissions} lần trong 15 phút). Vui lòng thử lại sau ${throttle.retryAfter} giây.` },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } }
      )
    }

    // 3. Kiểm tra chặn đặt trùng (Cùng SĐT + Cùng ngày khám + Cùng chuyên khoa -> HTTP 409 Conflict)
    const preventDuplicate = appSettings?.preventDuplicateBooking !== false
    if (preventDuplicate) {
      try {
        const appointmentDateStr = typeof appointmentDate === 'string' ? appointmentDate.slice(0, 10) : ''
        const startOfDay = appointmentDateStr ? new Date(`${appointmentDateStr}T00:00:00.000Z`).toISOString() : appointmentDate
        const endOfDay = appointmentDateStr ? new Date(`${appointmentDateStr}T23:59:59.999Z`).toISOString() : appointmentDate

        const dateFilter = appointmentDateStr
          ? [
              { appointmentDate: { greater_than_equal: startOfDay } },
              { appointmentDate: { less_than_equal: endOfDay } },
            ]
          : [{ appointmentDate: { equals: appointmentDate } }]

        const duplicateCheck = await payload.find({
          collection: 'appointments' as any,
          where: {
            and: [
              { phone: { equals: phone } },
              ...dateFilter,
              { status: { not_in: ['cancelled'] } },
            ],
          },
          limit: 10,
          overrideAccess: true,
        })

        const matchedDup = duplicateCheck.docs.find((d: any) => {
          if (rawSpecialtyId && d.specialty && (String(d.specialty) === String(rawSpecialtyId) || String(d.specialty?.id) === String(rawSpecialtyId))) return true
          if (rawSpecialtyId && d.department && (String(d.department) === String(rawSpecialtyId) || String(d.department?.id) === String(rawSpecialtyId))) return true
          if (specialtyTitle && d.specialtyTitle && d.specialtyTitle.toLowerCase().trim() === specialtyTitle.toLowerCase().trim()) return true
          if (!rawSpecialtyId && !specialtyTitle && !d.specialty && !d.specialtyTitle) return true
          return false
        })

        if (matchedDup) {
          return NextResponse.json(
            {
              error: 'Yêu cầu đặt lịch khám chưa thể thực hiện do thông tin đăng ký trùng khớp với lịch hẹn đã có trên hệ thống. Quý khách vui lòng kiểm tra lại hoặc liên hệ trực tiếp tổng đài bệnh viện để được hỗ trợ.',
            },
            { status: 409 }
          )
        }
      } catch {
        // Tiếp tục nếu lỗi truy vấn
      }
    }

    // 4. Kiểm tra khoảng thời gian chờ giữa 2 lần đặt của cùng SĐT (chống click đúp / spam liên tiếp -> HTTP 429)
    const minSeconds = typeof appSettings?.minSecondsBetweenSubmissions === 'number' && appSettings.minSecondsBetweenSubmissions >= 0 ? appSettings.minSecondsBetweenSubmissions : 60
    if (minSeconds > 0) {
      try {
        const recentByPhone = await payload.find({
          collection: 'appointments' as any,
          where: {
            phone: { equals: phone },
          },
          sort: '-createdAt',
          limit: 1,
          overrideAccess: true,
        })

        if (recentByPhone.docs.length > 0) {
          const lastCreated = new Date(recentByPhone.docs[0].createdAt).getTime()
          const diffSeconds = Math.floor((Date.now() - lastCreated) / 1000)
          if (diffSeconds < minSeconds) {
            const waitTime = minSeconds - diffSeconds
            return NextResponse.json(
              { error: `Hệ thống vừa tiếp nhận yêu cầu từ số điện thoại này. Vui lòng chờ ${waitTime} giây trước khi gửi thêm lịch hẹn mới.` },
              { status: 429 }
            )
          }
        }
      } catch {
        // Tiếp tục nếu lỗi truy vấn kiểm tra
      }
    }

    // Lấy cấu hình khung giờ khám thực tế người quản trị đã chỉnh tay trong Admin
    let dbTimeSlot: 'morning' | 'afternoon' | 'anytime' = 'morning'
    let finalTimeSlotLabel = timeSlotLabelFromBody

    if (Array.isArray(appSettings?.timeSlots) && appSettings.timeSlots.length > 0) {
      const found = appSettings.timeSlots.find(
        (s: any) => s.value === rawTimeSlot || s.label === rawTimeSlot || s.label === timeSlotLabelFromBody
      )
      if (found) {
        finalTimeSlotLabel = found.label
      }
    }

    // Nếu chưa có nhãn thì tìm trong từ điển hoặc fallback
    if (!finalTimeSlotLabel) {
      finalTimeSlotLabel = DEFAULT_TIME_SLOT_LABELS[rawTimeSlot] || rawTimeSlot || 'Buổi sáng (07:00 – 11:30)'
    }

    // Xác định mã timeSlot hợp lệ cho Enum database ('morning' | 'afternoon' | 'anytime')
    if (['morning', 'afternoon', 'anytime'].includes(rawTimeSlot)) {
      dbTimeSlot = rawTimeSlot as any
    } else if (
      rawTimeSlot.toLowerCase().includes('chiều') ||
      rawTimeSlot.toLowerCase().includes('chieu') ||
      finalTimeSlotLabel.toLowerCase().includes('chiều')
    ) {
      dbTimeSlot = 'afternoon'
    } else if (
      rawTimeSlot.toLowerCase().includes('hành chính') ||
      rawTimeSlot.toLowerCase().includes('hanh chinh') ||
      finalTimeSlotLabel.toLowerCase().includes('hành chính')
    ) {
      dbTimeSlot = 'anytime'
    } else {
      dbTimeSlot = 'morning'
    }

    // Sinh mã phiếu hẹn nguyên tử duy nhất qua PostgreSQL daily counter (BVTL0001 -> BVTL9999)
    let code = await getNextAtomicAppointmentCode(payload)

    let validSpecialtyId: number | undefined = undefined
    let validDepartmentId: number | undefined = undefined

    // Kiểm tra ID được gửi lên thuộc collection `specialties` hay `departments` để tránh vi phạm Foreign Key PostgreSQL
    if (rawSpecialtyId) {
      try {
        const checkSpec = await payload.findByID({
          collection: 'specialties' as any,
          id: rawSpecialtyId,
          overrideAccess: true,
        })
        if (checkSpec) {
          validSpecialtyId = rawSpecialtyId
          if (checkSpec.department) {
            validDepartmentId = typeof checkSpec.department === 'object' ? checkSpec.department.id : checkSpec.department
          }
        }
      } catch {
        // Không tìm thấy trong specialties, kiểm tra trong departments
      }

      if (!validSpecialtyId) {
        try {
          const checkDept = await payload.findByID({
            collection: 'departments' as any,
            id: rawSpecialtyId,
            overrideAccess: true,
          })
          if (checkDept) {
            validDepartmentId = rawSpecialtyId
          }
        } catch {
          // Bỏ qua nếu không khớp ID
        }
      }
    }

    // Gom các trường tùy biến vào customData
    const standardKeys = new Set([
      'website', 'cf-turnstile-response', 'fullName', 'phone', 'email', 'address',
      'dob', 'gender', 'insuranceNumber', 'specialty', 'specialtyTitle', 'appointmentDate', 'timeSlot', 'timeSlotLabel', 'submittedAt', 'symptoms', 'doctor'
    ])
    const customData: Record<string, any> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!standardKeys.has(key) && value !== undefined && value !== null && value !== '') {
        customData[key] = typeof value === 'string' ? value.trim().slice(0, 1000) : value
      }
    }

    // Cơ chế retry an toàn xử lý va chạm mã khi có nhiều request đồng thời (Concurrency)
    let created: any = null
    let finalCode = code
    for (let retry = 0; retry < 5; retry++) {
      try {
        created = await payload.create({
          collection: 'appointments' as any,
          data: {
            code: finalCode,
            fullName,
            phone,
            email: email || undefined,
            address: address || undefined,
            dob: dob || undefined,
            gender,
            insuranceNumber: insuranceNumber || undefined,
            specialty: validSpecialtyId,
            department: validDepartmentId,
            specialtyTitle: specialtyTitle || undefined,
            appointmentDate,
            timeSlot: dbTimeSlot,
            timeSlotLabel: finalTimeSlotLabel,
            doctor: parsedDoctor || undefined,
            symptoms: symptoms || undefined,
            status: 'new',
            source: 'website',
            submittedAt: submittedAtDate.toISOString(),
            ipAddress: clientIp,
            userAgent: userAgent,
            customData: Object.keys(customData).length > 0 ? customData : undefined,
          },
          overrideAccess: true,
        })
        break
      } catch (createErr: any) {
        const isCollision =
          createErr?.code === '23505' ||
          createErr?.cause?.code === '23505' ||
          /unique|duplicate|code/i.test(createErr?.message || '')
        if (isCollision && retry < 4) {
          finalCode = await getNextAtomicAppointmentCode(payload)
          continue
        }
        throw createErr
      }
    }

    return NextResponse.json({
      ok: true,
      code: finalCode,
      id: created.id,
      appointmentDate,
      timeSlot: dbTimeSlot,
      timeSlotLabel: finalTimeSlotLabel,
      fullName,
      message: 'Đăng ký đặt lịch khám thành công! Bệnh viện sẽ liên hệ xác nhận trong thời gian sớm nhất.',
    })
  } catch (error: any) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`

    // Phân loại lỗi an toàn theo danh mục nghiệp vụ mà không phụ thuộc regex hay in chuỗi error.message thô của DB
    let errorCategory = 'INTERNAL_ERROR'
    if (error?.code === '23505') {
      errorCategory = 'DATABASE_UNIQUE_VIOLATION'
    } else if (error?.code === '23503') {
      errorCategory = 'DATABASE_FOREIGN_KEY_VIOLATION'
    } else if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      errorCategory = 'NETWORK_TIMEOUT'
    } else if (error?.name === 'ValidationError') {
      errorCategory = 'VALIDATION_ERROR'
    }

    console.error(`[AppointmentAPI][${errorId}] Lỗi tạo lịch hẹn:`, {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
      category: errorCategory,
    })
    return NextResponse.json(
      {
        error: 'Không thể xử lý yêu cầu đặt lịch khám vào lúc này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp tổng đài bệnh viện.',
        errorId,
      },
      { status: 500 }
    )
  }
}
