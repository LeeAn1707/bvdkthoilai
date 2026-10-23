import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import ExcelJS from 'exceljs'
import { getCMS } from '@/lib/payload'
import { hasModulePermission } from '@/access'

export const dynamic = 'force-dynamic'

const MAX_EXPORT_ROWS = 5_000
const MAX_RANGE_DAYS = 366
const DEFAULT_RANGE_DAYS = 90
const ALLOWED_STATUSES = new Set(['new', 'confirmed', 'examining', 'completed', 'cancelled'])

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới tiếp nhận',
  confirmed: 'Đã gọi xác nhận',
  examining: 'Đang tiếp nhận khám',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy hẹn',
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'Buổi sáng (07:00 – 11:30)',
  afternoon: 'Buổi chiều (13:00 – 17:00)',
  anytime: 'Giờ hành chính',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
}

const formatDateVN = (dateVal?: string | Date) => {
  if (!dateVal) return ''
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const formatDateTimeVN = (dateVal?: string | Date) => {
  if (!dateVal) return ''
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const parseDateParam = (value: string | null, endOfDay = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10)

const requestIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  undefined

export async function GET(req: Request) {
  try {
    const payload = await getCMS()
    const auth = await payload.auth({ headers: req.headers })
    const user = auth.user as any

    if (!user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để xuất dữ liệu lịch hẹn.' }, { status: 401 })
    }
    if (!hasModulePermission(user, 'appointments', 'export')) {
      return NextResponse.json({ error: 'Bạn không có quyền xuất dữ liệu lịch hẹn.' }, { status: 403 })
    }

    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')

    if (statusFilter && statusFilter !== 'all' && !ALLOWED_STATUSES.has(statusFilter)) {
      return NextResponse.json({ error: 'Trạng thái lọc không hợp lệ.' }, { status: 400 })
    }

    const now = new Date()
    const requestedTo = url.searchParams.get('to')
    const requestedFrom = url.searchParams.get('from')
    const toDate = requestedTo ? parseDateParam(requestedTo, true) : now
    const defaultFrom = new Date((toDate || now).getTime() - (DEFAULT_RANGE_DAYS - 1) * 86_400_000)
    const fromDate = requestedFrom ? parseDateParam(requestedFrom) : defaultFrom

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Khoảng ngày phải có định dạng YYYY-MM-DD.' }, { status: 400 })
    }
    const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
    if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Khoảng xuất phải từ 1 đến ${MAX_RANGE_DAYS} ngày.` },
        { status: 400 },
      )
    }

    const filters: any[] = [
      { createdAt: { greater_than_equal: fromDate.toISOString() } },
      { createdAt: { less_than_equal: toDate.toISOString() } },
    ]
    if (statusFilter && statusFilter !== 'all') {
      filters.push({ status: { equals: statusFilter } })
    }

    // RBAC: Giới hạn dữ liệu xuất theo khoa nếu là department-manager hoặc tài khoản có ràng buộc department
    const userRole = user.role
    const isElevated = userRole === 'super-admin' || userRole === 'system-admin' || userRole === 'admin'
    if (!isElevated && userRole !== 'board') {
      const department = user.department
      const departmentID = typeof department === 'object' && department ? department.id : department
      if (!departmentID) {
        return NextResponse.json(
          { error: 'Tài khoản quản lý khoa chưa được liên kết khoa cụ thể để xuất dữ liệu.' },
          { status: 403 }
        )
      }
      filters.push({ department: { equals: departmentID } })
    }

    const where = { and: filters }

    const [result, settings] = await Promise.all([
      payload.find({
        collection: 'appointments' as any,
        where,
        limit: MAX_EXPORT_ROWS + 1,
        sort: '-createdAt',
        depth: 1,
        // Authorization đã được cưỡng chế ngay phía trên bằng appointments.export.
        overrideAccess: true,
      }),
      payload.findGlobal({ slug: 'appointment-settings' as any, overrideAccess: true }).catch(() => ({})),
    ])

    if (result.totalDocs > MAX_EXPORT_ROWS || result.docs.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `Có hơn ${MAX_EXPORT_ROWS.toLocaleString('vi-VN')} bản ghi. Vui lòng thu hẹp khoảng ngày hoặc trạng thái trước khi xuất.` },
        { status: 413 },
      )
    }

    const dynamicTimeSlotMap: Record<string, string> = { ...TIME_SLOT_LABELS }
    if (Array.isArray((settings as any)?.timeSlots)) {
      for (const slot of (settings as any).timeSlots) {
        if (slot?.value && slot?.label) {
          dynamicTimeSlotMap[slot.value] = slot.label
        }
      }
    }

    const docs = (result.docs || []) as any[]

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Bệnh viện Đa khoa Khu vực Thới Lai'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Danh sach lich hen', {
      views: [{ showGridLines: true }],
    })

    // 1. Title Banner Bệnh viện (Màu xanh thương hiệu y tế)
    sheet.mergeCells('A1:O1')
    const titleCell1 = sheet.getCell('A1')
    titleCell1.value = 'BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI'
    titleCell1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell1.alignment = { vertical: 'middle', horizontal: 'center' }
    titleCell1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0756B4' }, // Xanh dương đậm y tế
    }
    sheet.getRow(1).height = 32

    sheet.mergeCells('A2:O2')
    const titleCell2 = sheet.getCell('A2')
    titleCell2.value = 'DANH SÁCH BỆNH NHÂN ĐẶT LỊCH KHÁM TẠI CƠ SỞ'
    titleCell2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell2.alignment = { vertical: 'middle', horizontal: 'center' }
    titleCell2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' }, // Xanh cyan chủ đạo
    }
    sheet.getRow(2).height = 26

    sheet.mergeCells('A3:O3')
    const timeExportCell = sheet.getCell('A3')
    timeExportCell.value = `Thời điểm xuất dữ liệu: ${formatDateTimeVN(new Date())} | Khoảng dữ liệu: ${formatDateVN(fromDate)} - ${formatDateVN(toDate)} | Tổng số bản ghi: ${docs.length}`
    timeExportCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } }
    timeExportCell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(3).height = 20

    // Row 4: Empty separator
    sheet.getRow(4).height = 8

    // 2. Header Columns (Dòng 5)
    const headers = [
      'STT',
      'Mã phiếu hẹn',
      'Thời điểm bấm đặt lịch',
      'Họ và tên',
      'Số điện thoại',
      'Email',
      'Giới tính',
      'Ngày sinh',
      'Địa chỉ',
      'Chuyên khoa đăng ký',
      'Ngày hẹn khám',
      'Khung giờ',
      'Thông tin bổ sung / Triệu chứng',
      'Thông tin tùy biến thêm',
      'Trạng thái',
    ]

    const headerRow = sheet.getRow(5)
    headerRow.values = headers
    headerRow.height = 28

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0369A1' }, // Xanh header y tế thanh lịch
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBAE6FD' } },
        bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
        left: { style: 'thin', color: { argb: 'FFBAE6FD' } },
        right: { style: 'thin', color: { argb: 'FFBAE6FD' } },
      }
    })

    // 3. Fill Rows
    docs.forEach((item, index) => {
      const rowIndex = 6 + index
      const specialtyName = item.specialtyTitle || (typeof item.specialty === 'object' ? item.specialty?.name : item.specialty) || '–'
      const statusText = STATUS_LABELS[item.status] || item.status || 'Mới'
      const timeSlotText = item.timeSlotLabel || dynamicTimeSlotMap[item.timeSlot] || item.timeSlot || '–'
      const genderText = GENDER_LABELS[item.gender] || item.gender || '–'

      let customDataStr = ''
      if (item.customData && typeof item.customData === 'object') {
        customDataStr = Object.entries(item.customData)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
      }

      const submittedAtText = item.submittedAt ? formatDateTimeVN(item.submittedAt) : (item.createdAt ? formatDateTimeVN(item.createdAt) : '–')

      const row = sheet.getRow(rowIndex)
      row.values = [
        index + 1,
        item.code || '',
        submittedAtText,
        item.fullName || '',
        item.phone || '',
        item.email || '',
        genderText,
        formatDateVN(item.dob),
        item.address || '',
        specialtyName,
        formatDateVN(item.appointmentDate),
        timeSlotText,
        item.symptoms || '',
        customDataStr,
        statusText,
      ]

      row.height = 24

      // Tô màu xen kẽ nhẹ
      const isEven = index % 2 === 0
      const bgColor = isEven ? 'FFFFFFFF' : 'FFF0F9FF'

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }

        // Căn lề từng cột
        if (colNumber === 1 || colNumber === 3 || colNumber === 7 || colNumber === 8 || colNumber === 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNumber === 2 || colNumber === 5 || colNumber === 15) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
        }

        // Highlight mã hẹn và trạng thái
        if (colNumber === 2) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0369A1' } }
        }
        if (colNumber === 15) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: item.status === 'completed' ? { argb: 'FF15803D' } : item.status === 'confirmed' ? { argb: 'FF0284C7' } : { argb: 'FFB45309' } }
        }
      })
    })

    // 4. Set Column Widths
    const colWidths = [
      6,   // 1. STT
      18,  // 2. Mã phiếu hẹn
      20,  // 3. Thời điểm bấm đặt lịch
      24,  // 4. Họ và tên
      15,  // 5. Số điện thoại
      24,  // 6. Email
      10,  // 7. Giới tính
      14,  // 8. Ngày sinh
      30,  // 9. Địa chỉ
      24,  // 10. Chuyên khoa
      15,  // 11. Ngày hẹn khám
      26,  // 12. Khung giờ
      32,  // 13. Thông tin bổ sung
      30,  // 14. Thông tin tùy biến
      18,  // 15. Trạng thái
    ]
    colWidths.forEach((width, i) => {
      sheet.getColumn(i + 1).width = width
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `lich-dat-kham-thoi-lai-${new Date().toISOString().slice(0, 10)}.xlsx`

    await payload.create({
      collection: 'audit-logs' as any,
      overrideAccess: true,
      data: {
        summary: `EXPORT appointments (${docs.length} records)`,
        action: 'other',
        resource: 'appointments',
        actor: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ip: requestIP(req),
        userAgent: req.headers.get('user-agent') || undefined,
        metadata: {
          operation: 'export',
          recordCount: docs.length,
          status: statusFilter || 'all',
          from: dateOnly(fromDate),
          to: dateOnly(toDate),
        },
      } as any,
    }).catch((error) => {
      payload.logger.error({ err: error, msg: 'Không ghi được audit log cho export lịch hẹn' })
    })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    const errorId = `ERR-EXP-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`
    console.error(`[AppointmentsExport][${errorId}] Lỗi xuất file Excel:`, {
      name: error?.name || 'Error',
      code: error?.code || 'INTERNAL_ERROR',
    })
    return NextResponse.json(
      {
        error: 'Không thể xuất file Excel vào lúc này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên hệ thống.',
        errorId,
      },
      { status: 500 }
    )
  }
}
