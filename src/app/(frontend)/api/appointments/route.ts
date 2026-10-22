import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getCMS } from '@/lib/payload'
import { readJsonBodyWithLimit, clientAddress, rateLimit, validEmail, validPhone, verifyTurnstile } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

const generateAppointmentCode = () => `LK-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`

export async function POST(req: Request) {
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

    // Kiểm tra giới hạn IP sớm nhằm chống tấn công DoS và cạn kiệt quota Turnstile
    const ipThrottle = rateLimit(req, 'appointment-create', 5, 15 * 60_000)
    if (!ipThrottle.allowed) {
      return NextResponse.json(
        { error: `Bạn đã thao tác đặt lịch quá nhiều lần (tối đa 5 lần trong 15 phút). Vui lòng thử lại sau ${ipThrottle.retryAfter} giây.` },
        { status: 429, headers: { 'Retry-After': String(ipThrottle.retryAfter) } }
      )
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

    // 2. Kiểm tra giới hạn số lần gửi từ 1 địa chỉ IP (mặc định 5 lần / 15 phút hoặc theo admin cấu hình)
    const maxSubmissions = typeof appSettings?.maxSubmissionsPerIp === 'number' && appSettings.maxSubmissionsPerIp > 0 ? appSettings.maxSubmissionsPerIp : 5
    const throttle = rateLimit(req, 'appointment-create', maxSubmissions, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: `Bạn đã thao tác đặt lịch quá nhiều lần (tối đa ${maxSubmissions} lần trong 15 phút). Vui lòng thử lại sau ${throttle.retryAfter} giây.` },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } }
      )
    }

    // 3. Kiểm tra khoảng thời gian chờ giữa 2 lần đặt của cùng SĐT (chống click đúp / spam liên tiếp)
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

    // 4. Kiểm tra chặn đặt trùng (Cùng SĐT + Cùng ngày khám + Cùng chuyên khoa)
    const preventDuplicate = appSettings?.preventDuplicateBooking !== false
    if (preventDuplicate) {
      try {
        const duplicateCheck = await payload.find({
          collection: 'appointments' as any,
          where: {
            and: [
              { phone: { equals: phone } },
              { appointmentDate: { equals: appointmentDate } },
              { status: { not_in: ['cancelled'] } },
            ],
          },
          limit: 5,
          overrideAccess: true,
        })

        const matchedDup = duplicateCheck.docs.find((d: any) => {
          if (rawSpecialtyId && d.specialty && (d.specialty === rawSpecialtyId || d.specialty?.id === rawSpecialtyId)) return true
          if (rawSpecialtyId && d.department && (d.department === rawSpecialtyId || d.department?.id === rawSpecialtyId)) return true
          if (specialtyTitle && d.specialtyTitle && d.specialtyTitle.toLowerCase() === specialtyTitle.toLowerCase()) return true
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

    // Sinh mã phiếu hẹn duy nhất theo quy cách: BVTL + 4 số thứ tự từ 0001 đến 9999 (reset lại 0001 theo ngày mới)
    // Xác định mốc thời gian bắt đầu và kết thúc của ngày hôm nay theo múi giờ Việt Nam (UTC+7)
    const nowForCodeVN = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const yyyyVN = nowForCodeVN.getUTCFullYear()
    const mIdxVN = nowForCodeVN.getUTCMonth()
    const dVN = nowForCodeVN.getUTCDate()
    const startOfTodayVN = new Date(Date.UTC(yyyyVN, mIdxVN, dVN, 0, 0, 0) - 7 * 60 * 60 * 1000)
    const endOfTodayVN = new Date(Date.UTC(yyyyVN, mIdxVN, dVN, 23, 59, 59, 999) - 7 * 60 * 60 * 1000)

    let nextSequence = 1
    try {
      // Tìm các phiếu hẹn đã tạo trong ngày hôm nay
      const todayAppointments = await payload.find({
        collection: 'appointments' as any,
        where: {
          and: [
            { createdAt: { greater_than_equal: startOfTodayVN.toISOString() } },
            { createdAt: { less_than_equal: endOfTodayVN.toISOString() } },
          ],
        },
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })

      // Lọc ra số thứ tự lớn nhất của định dạng BVTLxxxx hoặc TLxxxx trong ngày hôm nay
      for (const doc of todayAppointments.docs || []) {
        if (typeof doc.code === 'string') {
          if (/^BVTL\d{4}$/.test(doc.code)) {
            const num = parseInt(doc.code.slice(4), 10)
            if (!isNaN(num) && num >= nextSequence) {
              nextSequence = num + 1
            }
          } else if (/^TL\d{4}$/.test(doc.code)) {
            const num = parseInt(doc.code.slice(2), 10)
            if (!isNaN(num) && num >= nextSequence) {
              nextSequence = num + 1
            }
          }
        }
      }
    } catch {
      // Nếu có lỗi truy vấn, thử đếm bản ghi thông thường
    }

    let code = nextSequence <= 9999
      ? `BVTL${String(nextSequence).padStart(4, '0')}`
      : `BVTL${nextSequence}`

    // Đảm bảo mã chưa từng bị trùng lặp trong DB
    for (let attempt = 0; attempt < 50; attempt++) {
      const exists = await payload.find({
        collection: 'appointments' as any,
        where: { code: { equals: code } },
        limit: 1,
        overrideAccess: true,
      })
      if (!exists.docs.length) break
      nextSequence++
      code = nextSequence <= 9999
        ? `BVTL${String(nextSequence).padStart(4, '0')}`
        : `BVTL${nextSequence}`
    }

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
          /unique|duplicate|code/i.test(createErr?.message || '')
        if (isCollision && retry < 4) {
          nextSequence++
          const randHex = randomBytes(2).toString('hex').toUpperCase()
          finalCode = nextSequence <= 9999
            ? `BVTL${String(nextSequence).padStart(4, '0')}-${randHex}`
            : `BVTL${nextSequence}-${randHex}`
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
