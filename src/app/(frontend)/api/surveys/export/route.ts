import { NextResponse } from 'next/server'
import { Workbook } from 'exceljs'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { rateLimit } from '@/lib/request-security'
import {
  RAW_OUTPATIENT_SURVEY_SECTIONS as OUTPATIENT_SURVEY_SECTIONS,
  RAW_INPATIENT_SURVEY_SECTIONS as INPATIENT_SURVEY_SECTIONS,
  RAW_STAFF_SURVEY_SECTIONS as STAFF_SURVEY_SECTIONS,
} from '@/data/surveyQuestionsData'

const MAX_EXPORT_ROWS = 5_000
const ALLOWED_PERIODS = new Set(['all', 'day', 'week', 'month', 'quarter', '6months', '9months', 'year'])

const requestIP = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  undefined

export async function GET(request: Request) {
  try {
    const payload = await getCMS()
    const user = await getVerifiedActiveUser(payload, request.headers)

    if (!user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để xuất dữ liệu khảo sát.' }, { status: 401 })
    }
    if (!hasModulePermission(user, 'surveys', 'export')) {
      return NextResponse.json({ error: 'Bạn không có quyền xuất dữ liệu khảo sát.' }, { status: 403 })
    }
    const throttle = rateLimit(request, `surveys-export:${user.id}`, 20, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Bạn đã xuất báo cáo khảo sát quá nhiều lần. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    }

    const { searchParams } = new URL(request.url)

    const campaignParam = searchParams.get('campaign') || 'all'
    const period = searchParams.get('period') || 'all'

    if (!ALLOWED_PERIODS.has(period)) {
      return NextResponse.json({ error: 'Khoảng thời gian xuất không hợp lệ.' }, { status: 400 })
    }

    // 1. Tính toán mốc thời gian lọc (startDate)
    const now = new Date()
    let startDate: Date | null = null
    let periodLabel = 'Toàn bộ thời gian'

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      periodLabel = `Hôm nay (${now.toLocaleDateString('vi-VN')})`
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      periodLabel = '7 ngày gần nhất'
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      periodLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`
    } else if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3) + 1
      const qStartMonth = (currentQuarter - 1) * 3
      startDate = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0)
      periodLabel = `Quý ${currentQuarter}/${now.getFullYear()}`
    } else if (period === '6months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0)
      periodLabel = '6 tháng gần nhất'
    } else if (period === '9months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 9, now.getDate(), 0, 0, 0)
      periodLabel = '9 tháng gần nhất'
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
      periodLabel = `Năm ${now.getFullYear()}`
    }

    const startIso = startDate ? startDate.toISOString() : null

    const isAll = campaignParam === 'all'
    const campaignId = !isAll ? Number(campaignParam) : null
    if (!isAll && (!Number.isInteger(campaignId) || Number(campaignId) <= 0)) {
      return NextResponse.json({ error: 'Mã đợt khảo sát không hợp lệ.' }, { status: 400 })
    }

    // 2. Lấy thông tin đợt khảo sát
    let campaignTitle = 'TẤT CẢ CÁC LOẠI KHẢO SÁT'
    let campaignDoc: any = null

    if (!isAll && campaignId) {
      campaignDoc = await payload.findByID({
        collection: 'survey-campaigns',
        id: campaignId,
        depth: 2,
        overrideAccess: true,
      })
      if (campaignDoc) {
        campaignTitle = campaignDoc.title
      }
    }

    // 3. Xác định bộ câu hỏi chuẩn
    interface QuestionMeta {
      key: string
      label: string
    }

    const questionsList: QuestionMeta[] = []

    if (!isAll && campaignDoc) {
      if (campaignDoc.useCustomQuestions && Array.isArray(campaignDoc.customQuestions) && campaignDoc.customQuestions.length > 0) {
        campaignDoc.customQuestions.forEach((cq: any, idx: number) => {
          const code = cq.code || `C${idx + 1}`
          questionsList.push({
            key: code,
            label: `${code}: ${cq.question || ''}`,
          })
        })
      } else if (campaignId === 1 || campaignDoc.slug === 'ngoai-tru') {
        OUTPATIENT_SURVEY_SECTIONS.forEach((sec) => {
          sec.questions.forEach((q) => {
            questionsList.push({
              key: q.id,
              label: `${q.id}: [${sec.code}] ${q.text}`,
            })
          })
        })
        questionsList.push(
          { key: 'overallRating10', label: 'Điểm chung: Đánh giá tổng thể chất lượng (Thang 1-10)' },
          { key: 'wouldReturn', label: 'Ý định: Khả năng quay lại / giới thiệu người thân' },
        )
      } else if (campaignId === 2 || campaignDoc.slug === 'noi-tru') {
        INPATIENT_SURVEY_SECTIONS.forEach((sec) => {
          sec.questions.forEach((q) => {
            questionsList.push({
              key: q.id,
              label: `${q.id}: [${sec.code}] ${q.text}`,
            })
          })
        })
        questionsList.push(
          { key: 'overallRating10', label: 'Điểm chung: Đánh giá tổng thể chất lượng (Thang 1-10)' },
          { key: 'wouldReturn', label: 'Ý định: Sẵn sàng quay lại / giới thiệu người thân' },
        )
      } else if (campaignId === 3 || campaignDoc.slug === 'nhan-vien') {
        STAFF_SURVEY_SECTIONS.forEach((sec) => {
          sec.questions.forEach((q) => {
            questionsList.push({
              key: q.id,
              label: `${q.id}: [${sec.code}] ${q.text}`,
            })
          })
        })
        questionsList.push(
          { key: 'overallRating10', label: 'Điểm chung: Mức độ hài lòng môi trường & đãi ngộ (Thang 1-10)' },
          { key: 'loyaltyIntent', label: 'Nguyện vọng: Ý định gắn bó lâu dài tại bệnh viện' },
        )
      }
    } else {
      // Trường hợp xuất TẤT CẢ các loại khảo sát
      // Đưa các câu hỏi phổ biến của cả 3 loại
      questionsList.push(
        { key: 'overallRating10', label: 'Điểm đánh giá tổng thể (Thang 1-10)' },
        { key: 'wouldReturn', label: 'Ý định quay lại / Giới thiệu người thân' },
        { key: 'loyaltyIntent', label: 'Ý định gắn bó lâu dài' },
      )
    }

    // 4. Thu thập danh sách phản hồi từ survey-responses
    const surveyWhere: any[] = []
    if (!isAll && campaignId) {
      surveyWhere.push({ campaign: { equals: campaignId } })
    }
    if (startIso) {
      surveyWhere.push({ submittedAt: { greater_than_equal: startIso } })
    }

    const surveyResponsesQuery: any = {
      collection: 'survey-responses',
      limit: MAX_EXPORT_ROWS + 1,
      sort: '-submittedAt',
      overrideAccess: true,
    }
    if (surveyWhere.length === 1) surveyResponsesQuery.where = surveyWhere[0]
    else if (surveyWhere.length > 1) surveyResponsesQuery.where = { and: surveyWhere }

    const surveyResponses = await payload.find(surveyResponsesQuery)

    // 5. Lấy thêm các phiếu phản hồi từ feedbackCases
    let feedbackDocs: any[] = []
    try {
      const fbWhere: any[] = []

      if (!isAll && campaignDoc) {
        const orConditions: any[] = [
          { subject: { contains: campaignTitle } },
          { name: { contains: campaignTitle } },
          { message: { contains: campaignTitle } },
        ]
        if (campaignId === 1 || campaignDoc.slug === 'ngoai-tru') {
          orConditions.push({ subject: { contains: 'Ngoại trú' } }, { code: { like: 'KS-NT-%' } })
        } else if (campaignId === 2 || campaignDoc.slug === 'noi-tru') {
          orConditions.push({ subject: { contains: 'Nội trú' } }, { code: { like: 'KS-NOITRU-%' } })
        } else if (campaignId === 3 || campaignDoc.slug === 'nhan-vien') {
          orConditions.push({ subject: { contains: 'Nhân viên y tế' } }, { code: { like: 'KS-NVYT-%' } })
        }
        fbWhere.push({ or: orConditions })
      } else {
        fbWhere.push({
          or: [
            { code: { like: 'KS-%' } },
            { subject: { contains: 'Khảo sát' } },
            { subject: { contains: 'hài lòng' } },
          ],
        })
      }

      if (startIso) {
        fbWhere.push({ createdAt: { greater_than_equal: startIso } })
      }

      const fbQuery: any = {
        collection: 'feedbackCases',
        limit: MAX_EXPORT_ROWS + 1,
        sort: '-createdAt',
        overrideAccess: true,
      }
      if (fbWhere.length === 1) fbQuery.where = fbWhere[0]
      else if (fbWhere.length > 1) fbQuery.where = { and: fbWhere }

      const fbCases = await payload.find(fbQuery)
      feedbackDocs = fbCases.docs || []
    } catch (fbErr) {
      console.warn('Lỗi khi lấy feedbackCases cho export:', fbErr)
    }

    // 6. Bóc tách chi tiết câu trả lời từng dòng
    interface ResponseDetailRow {
      code: string
      campaignType: string
      date: string
      participantName: string
      gender: string
      ageGroup: string
      departmentOrClinic: string
      overallScore: string | number
      answers: Record<string, string>
      comment: string
    }

    const rowsMap = new Map<string, ResponseDetailRow>()

    const parseFeedbackMessage = (msg: string) => {
      const result = {
        gender: '',
        ageGroup: '',
        departmentOrClinic: '',
        answers: {} as Record<string, string>,
        overallRating10: '',
        wouldReturn: '',
        comment: '',
      }

      if (!msg) return result

      const lines = msg.split('\n')
      for (const line of lines) {
        const clean = line.trim()
        if (clean.startsWith('- Giới tính:')) {
          result.gender = clean.replace('- Giới tính:', '').trim()
        } else if (clean.startsWith('- Độ tuổi:')) {
          result.ageGroup = clean.replace('- Độ tuổi:', '').trim()
        } else if (clean.startsWith('- Phòng khám:') || clean.startsWith('- Khoa điều trị:') || clean.startsWith('- Khoa/Phòng:') || clean.startsWith('- Vị trí:')) {
          result.departmentOrClinic = clean.split(':')[1]?.trim() || ''
        } else if (clean.startsWith('• [') || clean.startsWith('[')) {
          const match = clean.match(/\[([A-Za-z0-9_-]+)\]\s*([^:]+):\s*(.+)/)
          if (match) {
            const qCode = match[1].trim()
            const ans = match[3].trim()
            result.answers[qCode] = ans
          }
        } else if (clean.startsWith('- Đánh giá chung:') || clean.startsWith('- Điểm chung:')) {
          result.overallRating10 = clean.split(':')[1]?.trim() || ''
          result.answers['overallRating10'] = result.overallRating10
        } else if (clean.startsWith('- Khả năng quay lại:') || clean.startsWith('- Sẵn sàng quay lại:')) {
          result.wouldReturn = clean.split(':')[1]?.trim() || ''
          result.answers['wouldReturn'] = result.wouldReturn
        } else if (clean.startsWith('- Nguyện vọng / Ý định gắn bó:') || clean.startsWith('Đồng chí có ý định gắn bó')) {
          result.answers['loyaltyIntent'] = clean.split(':')[1]?.trim() || clean
        } else if (clean.startsWith('- Ý kiến phản hồi / góp ý:') || clean.startsWith('- Ý kiến / đóng góp:') || clean.startsWith('- Nội dung:')) {
          result.comment = clean.split(':')[1]?.trim() || ''
        }
      }

      return result
    }

    // Đưa surveyResponses vào map
    for (const r of surveyResponses.docs as any[]) {
      const code = r.responseCode || `SR-${r.id}`
      const dateStr = r.submittedAt
        ? new Date(r.submittedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : ''
      const cTitle = (typeof r.campaign === 'object' && r.campaign?.title) || campaignTitle

      rowsMap.set(code, {
        code,
        campaignType: cTitle,
        date: dateStr,
        participantName: 'Người tham gia',
        gender: '',
        ageGroup: '',
        departmentOrClinic: r.department?.name || '',
        overallScore: r.overallScore ?? '',
        answers: {},
        comment: r.comment ?? '',
      })
    }

    // Đưa feedbackCases vào map
    for (const fb of feedbackDocs) {
      const code = fb.code
      const dateStr = fb.createdAt
        ? new Date(fb.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : ''
      const parsed = parseFeedbackMessage(fb.message || '')

      let scoreExtracted: string | number = ''
      const matchScore = fb.subject?.match(/ĐTB:\s*([0-9.]+)/i)
      if (matchScore) {
        scoreExtracted = matchScore[1]
      }

      let cTitle = campaignTitle
      if (fb.code?.startsWith('KS-NT-')) cTitle = 'Khảo sát Ngoại trú'
      else if (fb.code?.startsWith('KS-NOITRU-')) cTitle = 'Khảo sát Nội trú'
      else if (fb.code?.startsWith('KS-NVYT-')) cTitle = 'Khảo sát Nhân viên y tế'
      else if (fb.subject) cTitle = fb.subject.split(' - ')[0] || cTitle

      const existing = rowsMap.get(code)
      if (existing) {
        existing.gender = parsed.gender || existing.gender
        existing.ageGroup = parsed.ageGroup || existing.ageGroup
        existing.departmentOrClinic = parsed.departmentOrClinic || existing.departmentOrClinic
        existing.answers = { ...existing.answers, ...parsed.answers }
        existing.comment = parsed.comment || existing.comment
        if (!existing.overallScore && scoreExtracted) {
          existing.overallScore = scoreExtracted
        }
      } else {
        rowsMap.set(code, {
          code,
          campaignType: cTitle,
          date: dateStr,
          participantName: fb.name && fb.name !== 'Khảo sát ẩn danh' ? fb.name : 'Người bệnh / Thân nhân',
          gender: parsed.gender,
          ageGroup: parsed.ageGroup,
          departmentOrClinic: parsed.departmentOrClinic,
          overallScore: scoreExtracted,
          answers: parsed.answers,
          comment: parsed.comment || fb.message?.slice(0, 150) || '',
        })
      }
    }

    const dataRows = Array.from(rowsMap.values())

    if (dataRows.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `Có hơn ${MAX_EXPORT_ROWS.toLocaleString('vi-VN')} lượt khảo sát. Vui lòng thu hẹp đợt hoặc khoảng thời gian trước khi xuất.` },
        { status: 413 },
      )
    }

    // 7. Tạo workbook Excel chuyên nghiệp với exceljs
    const workbook = new Workbook()
    workbook.creator = 'Bệnh viện Đa khoa Khu vực Thới Lai'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Danh sách khảo sát', {
      views: [{ showGridLines: true }],
    })

    // Dòng 1: Tiêu đề cơ quan
    worksheet.mergeCells('A1:H1')
    const row1 = worksheet.getCell('A1')
    row1.value = 'SỞ Y TẾ THÀNH PHỐ CẦN THƠ - BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI'
    row1.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF075985' } }
    row1.alignment = { vertical: 'middle', horizontal: 'left' }

    // Dòng 2: Tiêu đề đợt khảo sát
    worksheet.mergeCells('A2:H2')
    const row2 = worksheet.getCell('A2')
    row2.value = `BÁO CÁO DANH SÁCH KHẢO SÁT: ${campaignTitle.toUpperCase()}`
    row2.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF0284C7' } }
    row2.alignment = { vertical: 'middle', horizontal: 'left' }

    // Dòng 3: Khoảng thời gian và ngày xuất
    worksheet.mergeCells('A3:H3')
    const row3 = worksheet.getCell('A3')
    row3.value = `Khoảng thời gian: ${periodLabel} | Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số lượt: ${dataRows.length} lượt khảo sát`
    row3.font = { name: 'Times New Roman', size: 11, italic: true, color: { argb: 'FF475569' } }
    row3.alignment = { vertical: 'middle', horizontal: 'left' }

    // Dòng 4: Chú thích quy ước thang điểm (1 đến 5)
    worksheet.mergeCells('A4:H4')
    const row4 = worksheet.getCell('A4')
    row4.value = '📌 QUY ƯỚC ĐIỂM SỐ: 1 = Rất không hài lòng/Rất kém | 2 = Không hài lòng/Kém | 3 = Bình thường | 4 = Hài lòng/Tốt | 5 = Rất hài lòng/Rất tốt'
    row4.font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF15803D' } }
    row4.alignment = { vertical: 'middle', horizontal: 'left' }

    // Dòng 5 để trống
    worksheet.addRow([])

    // Dòng 6: Header cột dữ liệu
    const baseHeaders = [
      'STT',
      'Mã biên nhận',
      'Loại khảo sát',
      'Thời gian gửi',
      'Người tham gia',
      'Giới tính',
      'Độ tuổi',
      'Khoa / Phòng / Vị trí',
      'Điểm TB (Thang 5)',
    ]

    const dynamicHeaders = questionsList.map((q) => q.label)
    const finalHeaders = [...baseHeaders, ...dynamicHeaders, 'Ý kiến đóng góp & đề xuất']

    const headerRow = worksheet.addRow(finalHeaders)
    headerRow.height = 36
    headerRow.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber <= 9 ? 'FF075985' : 'FF0284C7' },
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0C4A6E' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      }
    })

    // Hàm làm sạch điểm số thành số thuần túy (1 đến 5 hoặc 1 đến 10)
    const cleanScoreValue = (raw: string | number | undefined | null) => {
      if (raw === undefined || raw === null || raw === '') return ''
      const str = String(raw).trim()
      const match = str.match(/^([0-9.]+)/)
      if (match) {
        const num = Number(match[1])
        return Number.isFinite(num) ? num : str
      }
      return str
    }

    // Đổ từng dòng dữ liệu
    dataRows.forEach((item, index) => {
      const rowValues: any[] = [
        index + 1,
        item.code,
        item.campaignType,
        item.date,
        item.participantName,
        item.gender || '—',
        item.ageGroup || '—',
        item.departmentOrClinic || '—',
        cleanScoreValue(item.overallScore),
      ]

      questionsList.forEach((q) => {
        const rawAns = item.answers[q.key] ?? ''
        rowValues.push(cleanScoreValue(rawAns))
      })

      rowValues.push(item.comment || '')

      const dataRow = worksheet.addRow(rowValues)
      dataRow.height = 24
      dataRow.font = { name: 'Times New Roman', size: 11 }
      dataRow.alignment = { vertical: 'middle', horizontal: 'left' }

      // Canh giữa STT, Mã, Ngày, Giới tính, Độ tuổi, Điểm số
      dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
      dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
      dataRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }
      dataRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' }
      dataRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' }
      dataRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' }

      for (let i = 10; i < 10 + questionsList.length; i++) {
        dataRow.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' }
      }

      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      })

      if (index % 2 === 1) {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          }
        })
      }
    })

    // Tự động căn chỉnh độ rộng cột
    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 6
      else if (idx === 1) col.width = 16
      else if (idx === 2) col.width = 24
      else if (idx === 3) col.width = 20
      else if (idx === 4) col.width = 18
      else if (idx === 5) col.width = 12
      else if (idx === 6) col.width = 14
      else if (idx === 7) col.width = 24
      else if (idx === 8) col.width = 16
      else if (idx === finalHeaders.length - 1) col.width = 36
      else col.width = 20
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `Danh-sach-khao-sat-${isAll ? 'tat-ca' : campaignId}-${period}-${Date.now()}.xlsx`

    await payload.create({
      collection: 'audit-logs' as any,
      overrideAccess: true,
      data: {
        summary: `EXPORT survey responses (${dataRows.length} records)`,
        action: 'other',
        resource: 'survey-responses',
        actor: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ip: requestIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          operation: 'export',
          recordCount: dataRows.length,
          campaign: isAll ? 'all' : campaignId,
          period,
        },
      } as any,
    }).catch((error) => {
      payload.logger.error({ err: error, msg: 'Không ghi được audit log cho export khảo sát' })
    })

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    console.error('API SURVEY EXPORT ERROR:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi khi xuất file Excel khảo sát.' }, { status: 500 })
  }
}
