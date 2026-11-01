import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { bodyIsTooLarge, rateLimit } from '@/lib/request-security'

const COLUMNS = ['STT', 'Mã dịch vụ', 'Tên dịch vụ', 'Nhóm dịch vụ', 'Đơn vị tính', 'Giá BHYT', 'Giá dịch vụ', 'Số quyết định', 'Hiệu lực từ', 'Hiệu lực đến', 'Ghi chú']
const MAX_ROWS = 10_000
const MAX_BYTES = 20 * 1024 * 1024

const numberValue = (input: unknown) => {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : undefined
  if (input === undefined || input === null || input === '') return undefined
  const cleaned = String(input).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}
const cell = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
  return undefined
}
const text = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max)
const dateValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') {
    // Excel 1900 date system (with the historic leap-year compatibility offset).
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + value * 86_400_000)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  const raw = text(value, 30)
  const vn = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  const date = vn ? new Date(Date.UTC(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]))) : new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const authorize = async (request: Request) => {
  const payload = await getCMS()
  const user = await getVerifiedActiveUser(payload, request.headers)
  return { payload, user }
}

const readRows = async (upload: File) => {
  if (upload.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE')
  if (!/\.xlsx$/i.test(upload.name)) throw new Error('INVALID_EXTENSION')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(await upload.arrayBuffer()) as any)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('NO_SHEET')
  if (worksheet.rowCount - 1 > MAX_ROWS) throw new Error('TOO_MANY_ROWS')
  const headers = worksheet.getRow(1).values as unknown[]
  const rows: Record<string, unknown>[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: Record<string, unknown> = {}
    for (let col = 1; col < headers.length; col++) {
      const header = String(headers[col] ?? '').trim()
      if (!header) continue
      const value: any = row.getCell(col).value
      record[header] = value instanceof Date ? value.toISOString() : (value && typeof value === 'object' && 'result' in value ? value.result : value)
    }
    if (Object.values(record).some(v => v !== null && v !== undefined && String(v).trim() !== '')) rows.push(record)
  })
  if (rows.length > MAX_ROWS) throw new Error('TOO_MANY_ROWS')
  return rows
}

const normalizeRow = (row: Record<string, unknown>, index: number) => {
  const code = text(cell(row, 'Mã dịch vụ', 'MA_DV', 'Mã DV', 'Code'), 100)
  const name = text(cell(row, 'Tên dịch vụ', 'TEN_DV', 'Tên DV', 'Name'), 500)
  const effectiveFrom = dateValue(cell(row, 'Hiệu lực từ', 'TU_NGAY', 'Từ ngày'))
  const errors: string[] = []
  if (!code) errors.push('thiếu Mã dịch vụ')
  if (!name) errors.push('thiếu Tên dịch vụ')
  if (!effectiveFrom) errors.push('thiếu/sai Hiệu lực từ')
  return {
    row: index + 2,
    sequence: numberValue(cell(row, 'STT', 'Số thứ tự')),
    code,
    name,
    category: text(cell(row, 'Nhóm dịch vụ', 'Nhóm', 'NHOM_DV'), 300) || undefined,
    unit: text(cell(row, 'Đơn vị tính', 'DVT'), 100) || undefined,
    insurancePrice: numberValue(cell(row, 'Giá BHYT', 'GIA_BHYT')),
    servicePrice: numberValue(cell(row, 'Giá dịch vụ', 'GIA_DV')),
    decisionNo: text(cell(row, 'Số quyết định', 'SO_QD'), 200) || undefined,
    effectiveFrom,
    effectiveTo: dateValue(cell(row, 'Hiệu lực đến', 'DEN_NGAY', 'Đến ngày')),
    note: text(cell(row, 'Ghi chú', 'GHI_CHU'), 1000) || undefined,
    errors,
  }
}

export async function GET() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Bang gia dich vu')
  sheet.addRow(COLUMNS)
  sheet.addRow([1, 'DV001', 'Khám bệnh nội tổng quát', 'Khám bệnh', 'Lần', 38700, 50000, '123/QĐ-BV', '01/09/2026', '', 'Áp dụng theo quyết định hiện hành'])
  sheet.addRow([2, 'DV002', 'Siêu âm ổ bụng tổng quát', 'Chẩn đoán hình ảnh', 'Lần', 43900, 80000, '123/QĐ-BV', '01/09/2026', '', ''])
  ;[8,18,42,26,15,18,18,22,16,16,38].forEach((width,index)=>{ sheet.getColumn(index+1).width=width })
  sheet.getRow(1).font = { bold: true }
  const output = await workbook.xlsx.writeBuffer()
  return new Response(new Uint8Array(output), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': "attachment; filename*=UTF-8''mau-bang-gia-dich-vu-v4.3.xlsx", 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function POST(request: Request) {
  try {
    const { payload, user } = await authorize(request)
    if (!user || !hasModulePermission(user, 'services', 'import')) return NextResponse.json({ error: 'Bạn không có quyền nhập bảng giá.' }, { status: 403 })
    if (bodyIsTooLarge(request, MAX_BYTES + 1024 * 1024)) return NextResponse.json({ error: 'File vượt quá giới hạn 20 MB.' }, { status: 413 })
    const throttle = rateLimit(request, `services-import:${user.id}`, 10, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều yêu cầu nhập bảng giá. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const form = await request.formData()
    const upload = form.get('file')
    const mode = String(form.get('mode') || 'preview')
    if (!(upload instanceof File)) return NextResponse.json({ error: 'Chưa chọn file Excel.' }, { status: 400 })

    let rows: Record<string, unknown>[]
    try { rows = await readRows(upload) } catch (reason) {
      const code = reason instanceof Error ? reason.message : ''
      const message = code === 'FILE_TOO_LARGE' ? 'File vượt quá giới hạn 20 MB.' : code === 'INVALID_EXTENSION' ? 'Chỉ chấp nhận file .xlsx. Hãy lưu file Excel cũ (.xls) thành .xlsx trước khi nhập.' : code === 'NO_SHEET' ? 'File Excel không có bảng dữ liệu.' : code === 'TOO_MANY_ROWS' ? 'File có hơn 10.000 dòng.' : 'Không thể đọc file Excel.'
      return NextResponse.json({ error: message }, { status: code === 'FILE_TOO_LARGE' ? 413 : 400 })
    }

    const normalized = rows.map(normalizeRow)
    const duplicateCodes = new Set<string>()
    const seen = new Set<string>()
    for (const item of normalized) {
      if (item.code && seen.has(item.code)) duplicateCodes.add(item.code)
      if (item.code) seen.add(item.code)
    }
    for (const item of normalized) if (duplicateCodes.has(item.code)) item.errors.push('mã dịch vụ bị lặp trong file')

    const invalid = normalized.filter(item => item.errors.length)
    const preview = normalized.slice(0, 50).map(item => ({ row: item.row, code: item.code, name: item.name, insurancePrice: item.insurancePrice, servicePrice: item.servicePrice, effectiveFrom: item.effectiveFrom, errors: item.errors }))
    if (mode !== 'import') return NextResponse.json({ mode: 'preview', total: normalized.length, valid: normalized.length - invalid.length, invalid: invalid.length, duplicateCodes: [...duplicateCodes], preview, canImport: invalid.length === 0 && normalized.length > 0 })
    if (invalid.length) return NextResponse.json({ error: `Có ${invalid.length} dòng chưa hợp lệ. Hãy sửa file và kiểm tra lại trước khi nhập.`, preview }, { status: 400 })

    let created = 0; let updated = 0; let skipped = 0; const errors: string[] = []
    for (const item of normalized) {
      try {
        const existing = await payload.find({ collection: 'services', where: { code: { equals: item.code } }, limit: 1, depth: 0, overrideAccess: true })
        const serviceData = { sequence: item.sequence, code: item.code, name: item.name, category: item.category, unit: item.unit, insurancePrice: item.insurancePrice, price: item.servicePrice, note: item.note, active: true }
        let service: any
        if (existing.docs[0]) { service = await payload.update({ collection: 'services', id: existing.docs[0].id, data: serviceData, overrideAccess: true }); updated++ }
        else { service = await payload.create({ collection: 'services', data: serviceData, overrideAccess: true }); created++ }

        const priceExisting = await payload.find({ collection: 'servicePrices', where: { and: [{ service: { equals: service.id } }, { effectiveFrom: { equals: item.effectiveFrom } }] }, limit: 1, depth: 0, overrideAccess: true })
        const priceData = { service: service.id, insurancePrice: item.insurancePrice, servicePrice: item.servicePrice, decisionNo: item.decisionNo, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo, sourceFileName: upload.name, note: item.note, active: true }
        if (priceExisting.docs[0]) await payload.update({ collection: 'servicePrices', id: priceExisting.docs[0].id, data: priceData, overrideAccess: true })
        else await payload.create({ collection: 'servicePrices', data: priceData, overrideAccess: true } as any)
      } catch {
        skipped++
        if (errors.length < 100) errors.push(`Dòng ${item.row} (${item.code}): không thể lưu dữ liệu.`)
      }
    }

    try {
      await payload.create({ collection: 'importJobs', data: { module: 'services', fileName: upload.name, status: errors.length ? 'failed' : 'completed', createdCount: created, updatedCount: updated, skippedCount: skipped, errorCount: errors.length, errors, importedBy: user.id }, overrideAccess: true })
    } catch {}
    return NextResponse.json({ mode: 'import', created, updated, skipped, errors })
  } catch (error: any) {
    console.error('Lỗi import bảng giá:', error?.message || error)
    return NextResponse.json({
      error: 'Không thể xử lý file Excel. Hãy tải mẫu và kiểm tra lại dữ liệu.'
    }, { status: 500 })
  }
}
