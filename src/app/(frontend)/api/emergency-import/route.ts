import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { getCMS } from '@/lib/payload'
import { parseEmergencyWorkbook } from '@/lib/emergencyExcelParser'
import { bodyIsTooLarge, rateLimit } from '@/lib/request-security'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_BODY_BYTES = MAX_FILE_SIZE + 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const payload = await getCMS()
    const user = await getVerifiedActiveUser(payload, req.headers)
    if (!user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để nhập dữ liệu lịch trực.' }, { status: 401 })
    }
    if (
      !hasModulePermission(user, 'schedules', 'import') &&
      !hasModulePermission(user, 'schedules', 'create') &&
      !hasModulePermission(user, 'schedules', 'edit')
    ) {
      return NextResponse.json({ error: 'Bạn không có quyền nhập dữ liệu lịch trực.' }, { status: 403 })
    }

    if (bodyIsTooLarge(req, MAX_BODY_BYTES)) {
      return NextResponse.json({ error: 'File vượt quá giới hạn 20 MB.' }, { status: 413 })
    }

    const throttle = rateLimit(req, `emergency-import:${user.id}`, 15, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Bạn đã gửi quá nhiều yêu cầu nhập file. Vui lòng thử lại sau ít phút.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Chỉ chấp nhận file Excel .xlsx.' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File vượt quá giới hạn 20 MB hoặc không hợp lệ.' }, { status: 400 })
    }

    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as any)

    const data = parseEmergencyWorkbook(workbook, file.name)
    return NextResponse.json({
      success: true,
      ...data,
      sheetName: workbook.worksheets[0]?.name || '',
    })
  } catch (error) {
    console.error('[emergency-import] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Không thể đọc file Excel lịch trực. Vui lòng kiểm tra lại định dạng file .xlsx.' },
      { status: 500 },
    )
  }
}
