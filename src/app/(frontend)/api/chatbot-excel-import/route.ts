import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { bodyIsTooLarge, rateLimit } from '@/lib/request-security'

const MAX_ROWS = 2_000
const MAX_BYTES = 10 * 1024 * 1024

type Target = 'faqs' | 'intents'

const text = (value: unknown, max = 5000) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') {
    const item = value as any
    if (Array.isArray(item.richText)) return item.richText.map((part: any) => part?.text || '').join(' ').trim().slice(0, max)
    if (item.text != null) return String(item.text).trim().slice(0, max)
    if (item.result != null) return String(item.result).trim().slice(0, max)
    if (item.hyperlink != null) return String(item.text || item.hyperlink).trim().slice(0, max)
  }
  return String(value).trim().slice(0, max)
}

const normalize = (value: string) => value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim()
const boolValue = (value: unknown, fallback = true) => {
  const raw = normalize(text(value, 30))
  if (!raw) return fallback
  if (['co', 'yes', 'true', '1', 'x', 'bat', 'hien thi', 'dang su dung'].includes(raw)) return true
  if (['khong', 'no', 'false', '0', 'tat', 'an', 'khong hien thi'].includes(raw)) return false
  return fallback
}
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(text(value, 30).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
const splitPhrases = (value: unknown) => {
  const raw = text(value, 8000)
  return [...new Set(raw.split(/[;|\n\r]+/).map((item: string) => item.trim()).filter(Boolean))].slice(0, 100)
}
const lexicalText = (value: string) => ({
  root: {
    type: 'root', version: 1, direction: null, format: '', indent: 0,
    children: value.split(/\n+/).filter(Boolean).map(line => ({
      type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '',
      children: [{ type: 'text', version: 1, text: line, format: 0, detail: 0, mode: 'normal', style: '' }],
    })),
  },
})

const authorize = async (request: Request, target: Target) => {
  const payload = await getCMS()
  const user = await getVerifiedActiveUser(payload, request.headers)
  const module = target === 'faqs' ? 'faqs' : 'chatbot'
  const allowed = user && (hasModulePermission(user, module, 'create') || hasModulePermission(user, module, 'edit') || hasModulePermission(user, module, 'import'))
  return { payload, user, allowed }
}

const decodeXml = (value: string) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const attr = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

// Fallback OOXML reader. This is intentionally small: it reads cell values only.
// It handles workbooks exported by Excel/LibreOffice and also valid ZIP-based XLSX
// files whose Content_Types metadata is tolerated by Excel but rejected by ExcelJS.
const readRowsWithOOXML = async (buffer: Buffer, target: Target) => {
  const zip = await JSZip.loadAsync(buffer)
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookXml || !relsXml) throw new Error('OOXML_MISSING_WORKBOOK')

  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings: string[] = []
  if (sharedXml) {
    for (const match of sharedXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi)) {
      const parts = [...match[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi)].map(m => decodeXml(m[1]))
      sharedStrings.push(parts.join(''))
    }
  }

  const relMap = new Map<string, string>()
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\/>/gi)) {
    const tag = match[0]
    const id = attr(tag, 'Id')
    let targetPath = attr(tag, 'Target').replace(/^\//, '')
    if (targetPath && !targetPath.startsWith('xl/')) targetPath = `xl/${targetPath.replace(/^\.\//, '')}`
    if (id && targetPath) relMap.set(id, targetPath)
  }

  const wantedKey = normalize(target === 'faqs' ? 'Câu hỏi thường gặp' : 'Kịch bản Chatbot')
  let sheetPath = ''
  const available: string[] = []
  for (const match of workbookXml.matchAll(/<[^>]*sheet\b[^>]*\/>/gi)) {
    const tag = match[0]
    const name = attr(tag, 'name')
    const relId = attr(tag, 'r:id')
    if (name) available.push(name)
    if (normalize(name) === wantedKey) sheetPath = relMap.get(relId) || ''
  }
  if (!sheetPath) throw new Error(`NO_TARGET_SHEET:${available.join(' | ')}`)
  const sheetXml = await zip.file(sheetPath)?.async('string')
  if (!sheetXml) throw new Error('OOXML_MISSING_SHEET')

  const rows: Array<{ rowNumber: number; values: Record<string, unknown> }> = []
  let headers: Record<number, string> = {}
  for (const rowMatch of sheetXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/gi)) {
    const rowNumber = Number(attr(rowMatch[1], 'r')) || 0
    const cells: Record<number, unknown> = {}
    for (const cellMatch of rowMatch[2].matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/gi)) {
      const cellAttrs = cellMatch[1]
      const ref = attr(cellAttrs, 'r')
      const letters = (ref.match(/^[A-Z]+/i)?.[0] || '').toUpperCase()
      let col = 0
      for (const ch of letters) col = col * 26 + ch.charCodeAt(0) - 64
      if (!col) continue
      const type = attr(cellAttrs, 't')
      const body = cellMatch[2]
      const inline = body.match(/<(?:[A-Za-z_][\w.-]*:)?is\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?is>/i)
      const valueMatch = body.match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i)
      let value: unknown = ''
      if (inline) value = [...inline[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi)].map(m => decodeXml(m[1])).join('')
      else if (valueMatch) {
        const raw = decodeXml(valueMatch[1])
        value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : raw
      }
      cells[col] = value
    }
    if (rowNumber === 1 || (!Object.keys(headers).length && rowNumber <= 1)) {
      headers = Object.fromEntries(Object.entries(cells).map(([k, v]) => [Number(k), text(v, 100)]))
      continue
    }
    const record: Record<string, unknown> = {}
    for (const [colText, header] of Object.entries(headers)) if (header) record[header] = cells[Number(colText)] ?? ''
    if (Object.values(record).some(value => text(value).length > 0)) rows.push({ rowNumber, values: record })
  }
  if (rows.length > MAX_ROWS) throw new Error('TOO_MANY_ROWS')
  return rows
}

const readRows = async (upload: File, target: Target) => {
  if (upload.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE')
  if (!/\.xlsx$/i.test(upload.name)) throw new Error('INVALID_EXTENSION')
  const arrayBuffer = await upload.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('INVALID_XLSX_CONTENT')

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer as any)
    const wantedKey = normalize(target === 'faqs' ? 'Câu hỏi thường gặp' : 'Kịch bản Chatbot')
    const worksheet = workbook.worksheets.find(sheet => normalize(sheet.name) === wantedKey)
    if (!worksheet) throw new Error(`NO_TARGET_SHEET:${workbook.worksheets.map(sheet => sheet.name).join(' | ')}`)
    if (worksheet.rowCount - 1 > MAX_ROWS) throw new Error('TOO_MANY_ROWS')
    const headers = worksheet.getRow(1).values as unknown[]
    const rows: Array<{ rowNumber: number; values: Record<string, unknown> }> = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const record: Record<string, unknown> = {}
      for (let col = 1; col < headers.length; col++) {
        const header = text(headers[col], 100)
        if (header) record[header] = row.getCell(col).value
      }
      if (Object.values(record).some(value => text(value).length > 0)) rows.push({ rowNumber, values: record })
    })
    return rows
  } catch (excelReason) {
    // ExcelJS can reject some XLSX metadata that Microsoft Excel itself accepts.
    // Fall back to direct OOXML reading before reporting a parse failure.
    try { return await readRowsWithOOXML(buffer, target) }
    catch (fallbackReason) {
      const fallbackCode = fallbackReason instanceof Error ? fallbackReason.message : String(fallbackReason || '')
      if (fallbackCode.startsWith('NO_TARGET_SHEET') || fallbackCode === 'TOO_MANY_ROWS') throw new Error(fallbackCode)
      const excelDetail = excelReason instanceof Error ? excelReason.message : String(excelReason || '')
      throw new Error(`XLSX_PARSE_ERROR:${excelDetail}; fallback: ${fallbackCode}`)
    }
  }
}
const faqRow = (row: { rowNumber: number; values: Record<string, unknown> }) => {
  const question = text(row.values['Câu hỏi'], 500)
  const answer = text(row.values['Trả lời'], 10000)
  const category = text(row.values['Nhóm'], 200)
  const keywordsRaw = text(row.values['Từ khóa'], 5000)
  const keywords = splitPhrases(keywordsRaw).join(', ')
  const active = boolValue(row.values['Hiển thị'], true)
  const order = numberValue(row.values['Thứ tự'], numberValue(row.values['STT'], 0))
  const errors: string[] = []
  if (!question) errors.push('thiếu Câu hỏi')
  if (!answer) errors.push('thiếu Trả lời')
  return { row: row.rowNumber, question, answer, category, keywords, active, order, errors }
}

const intentRow = (row: { rowNumber: number; values: Record<string, unknown> }) => {
  const name = text(row.values['Tên kịch bản'], 300)
  const phrases = splitPhrases(row.values['Câu hỏi / từ khóa'])
  const answer = text(row.values['Câu trả lời'], 10000)
  const linkLabel = text(row.values['Tên liên kết'], 200)
  const linkUrl = text(row.values['Liên kết'], 1000)
  const openNewTab = boolValue(row.values['Mở tab mới'], false)
  const priority = numberValue(row.values['Độ ưu tiên'], 0)
  const active = boolValue(row.values['Đang sử dụng'], true)
  const errors: string[] = []
  if (!name) errors.push('thiếu Tên kịch bản')
  if (!phrases.length) errors.push('thiếu Câu hỏi / từ khóa')
  if (!answer) errors.push('thiếu Câu trả lời')
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith('/')) errors.push('Liên kết phải bắt đầu bằng / hoặc http(s)://')
  return { row: row.rowNumber, name, phrases, answer, linkLabel, linkUrl, openNewTab, priority, active, errors }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const upload = form.get('file')
    const mode = String(form.get('mode') || 'preview')
    const target = String(form.get('target') || '') as Target
    if (!['faqs', 'intents'].includes(target)) return NextResponse.json({ error: 'Phân hệ nhập dữ liệu không hợp lệ.' }, { status: 400 })
    if (bodyIsTooLarge(request, MAX_BYTES + 1024 * 1024)) return NextResponse.json({ error: 'File vượt quá giới hạn 10 MB.' }, { status: 413 })
    const { payload, user, allowed } = await authorize(request, target)
    if (!allowed || !user) return NextResponse.json({ error: 'Bạn không có quyền nhập dữ liệu cho phân hệ này.' }, { status: 403 })
    const throttle = rateLimit(request, `chatbot-excel-import:${user.id}`, 15, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều yêu cầu nhập file. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    if (!(upload instanceof File)) return NextResponse.json({ error: 'Chưa chọn file Excel.' }, { status: 400 })

    let rows: Array<{ rowNumber: number; values: Record<string, unknown> }>
    try { rows = await readRows(upload, target) } catch (reason) {
      const code = reason instanceof Error ? reason.message : ''
      const message = code === 'FILE_TOO_LARGE' ? 'File vượt quá giới hạn 10 MB.'
        : code === 'INVALID_EXTENSION' ? 'Chỉ chấp nhận file .xlsx.'
        : code.startsWith('NO_TARGET_SHEET') ? `Không tìm thấy sheet “${target === 'faqs' ? 'Câu hỏi thường gặp' : 'Kịch bản Chatbot'}”. Sheet hiện có: ${code.split(':').slice(1).join(':') || '(không có)'}.`
        : code === 'INVALID_XLSX_CONTENT' ? 'File không phải nội dung Excel .xlsx hợp lệ. Hãy mở bằng Excel và lưu lại dưới định dạng Excel Workbook (*.xlsx).'
        : code.startsWith('XLSX_PARSE_ERROR:') ? `ExcelJS không đọc được workbook: ${code.slice('XLSX_PARSE_ERROR:'.length) || 'không xác định được nguyên nhân'}`
        : code === 'TOO_MANY_ROWS' ? 'Sheet có hơn 2.000 dòng dữ liệu.'
        : `Không thể đọc file Excel${code ? `: ${code}` : '.'}`
      return NextResponse.json({ error: message }, { status: code === 'FILE_TOO_LARGE' ? 413 : 400 })
    }

    const normalized: any[] = target === 'faqs' ? rows.map(faqRow) : rows.map(intentRow)
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const item of normalized) {
      const key = normalize(target === 'faqs' ? item.question : item.name)
      if (!key) continue
      if (seen.has(key)) duplicates.add(target === 'faqs' ? item.question : item.name)
      seen.add(key)
    }
    if (duplicates.size) {
      const dupNorm = new Set([...duplicates].map(normalize))
      for (const item of normalized) {
        const key = normalize(target === 'faqs' ? item.question : item.name)
        if (dupNorm.has(key)) item.errors.push('bị trùng trong file Excel')
      }
    }

    const invalid = normalized.filter(item => item.errors.length)
    const preview = normalized.slice(0, 60).map(item => ({
      row: item.row,
      key: target === 'faqs' ? item.question : item.name,
      secondary: target === 'faqs' ? item.category : item.phrases?.slice(0, 3).join('; '),
      errors: item.errors,
    }))
    if (mode !== 'import') return NextResponse.json({ target, total: normalized.length, valid: normalized.length - invalid.length, invalid: invalid.length, duplicates: [...duplicates], preview, canImport: invalid.length === 0 && normalized.length > 0 })
    if (invalid.length) return NextResponse.json({ error: `Có ${invalid.length} dòng chưa hợp lệ. Hãy sửa file và kiểm tra lại trước khi nhập.` }, { status: 400 })

    let created = 0; let updated = 0; let skipped = 0
    const errors: string[] = []
    for (const item of normalized) {
      try {
        if (target === 'faqs') {
          const existing = await payload.find({ collection: 'faqs', where: { question: { equals: item.question } }, limit: 1, depth: 0, overrideAccess: true })
          const data: any = { question: item.question, answer: lexicalText(item.answer), category: item.category, keywords: item.keywords, active: item.active, order: item.order }
          if (existing.docs[0]) { await payload.update({ collection: 'faqs', id: existing.docs[0].id, data, overrideAccess: true }); updated++ }
          else { await payload.create({ collection: 'faqs', data, overrideAccess: true }); created++ }
        } else {
          const existing = await payload.find({ collection: 'chatbotIntents', where: { name: { equals: item.name } }, limit: 1, depth: 0, overrideAccess: true })
          const data: any = { name: item.name, phrases: item.phrases.map((phrase: string) => ({ text: phrase })), answer: item.answer, linkLabel: item.linkLabel, linkUrl: item.linkUrl, openNewTab: item.openNewTab, priority: item.priority, active: item.active }
          if (existing.docs[0]) { await payload.update({ collection: 'chatbotIntents', id: existing.docs[0].id, data, overrideAccess: true }); updated++ }
          else { await payload.create({ collection: 'chatbotIntents', data, overrideAccess: true }); created++ }
        }
      } catch {
        skipped++
        if (errors.length < 100) errors.push(`Dòng ${item.row} (${target === 'faqs' ? item.question : item.name}): không thể lưu dữ liệu`)
      }
    }
    return NextResponse.json({ mode: 'import', created, updated, skipped, errors })
  } catch (reason) {
    console.error('[chatbot-excel-import] Error:', reason instanceof Error ? reason.message : reason)
    return NextResponse.json({ error: 'Không thể xử lý file Excel. Vui lòng kiểm tra lại định dạng file .xlsx.' }, { status: 500 })
  }
}
