export type WorkScheduleExportDoc = {
  title?: string
  displayMode?: string
  documentNumber?: string
  revision?: string
  weekNumber?: number
  year?: number
  startDate?: string
  endDate?: string
  generalNote?: string
  signerRole?: string
  signerName?: string
  days?: Array<{
    dayLabel?: string
    dateFormatted?: string
    morningContent?: string
    afternoonContent?: string
    note?: string
  }>
}

const escapeHtml = (str: string = '') =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const formatContentWithBr = (content: string = '') => {
  return escapeHtml(content).replace(/\r?\n/g, '<br/>')
}

export function buildWorkScheduleDocHtml(doc: WorkScheduleExportDoc): string {
  const hospitalName = 'BVĐK KHU VỰC THỚI LAI'
  const superiorAgency = 'SỞ Y TẾ THÀNH PHỐ CẦN THƠ'
  const docNumber = doc.documentNumber || '08/LLV - BVĐKKVTL'
  const title = (doc.title?.replace(/\(.*?\)/g, '').trim() || 'LỊCH CÔNG TÁC TUẦN').toUpperCase()
  
  const startStr = doc.startDate ? new Date(doc.startDate).toLocaleDateString('vi-VN') : '21/9/2026'
  const endStr = doc.endDate ? new Date(doc.endDate).toLocaleDateString('vi-VN') : '25/9/2026'
  const weekSub = `( Từ ngày ${startStr} – ${endStr} )`

  const today = new Date()
  const dateLocation = `Thới Lai, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${doc.year || today.getFullYear()}`

  const daysList = doc.days && doc.days.length > 0 ? doc.days : []

  const tableRowsHtml = daysList.map((d) => {
    const dayLabel = escapeHtml(d.dayLabel || '')
    const dateFormatted = escapeHtml(d.dateFormatted || '')
    const morning = formatContentWithBr(d.morningContent) || '—'
    const afternoon = formatContentWithBr(d.afternoonContent) || '—'

    return `
      <tr>
        <td class="col-day" style="width: 13%; text-align: center; font-weight: bold; vertical-align: middle; background-color: #f8fafc;">
          <div style="font-size: 13pt; color: #0369a1;">${dayLabel}</div>
          ${dateFormatted ? `<div style="font-size: 11pt; color: #64748b; font-weight: normal; margin-top: 3px;">${dateFormatted}</div>` : ''}
        </td>
        <td class="col-content" style="width: 43.5%; padding: 8px 12px; vertical-align: top; line-height: 1.45;">
          ${morning}
        </td>
        <td class="col-content" style="width: 43.5%; padding: 8px 12px; vertical-align: top; line-height: 1.45;">
          ${afternoon}
        </td>
      </tr>
    `
  }).join('')

  const emptyRowHtml = `
    <tr>
      <td colspan="3" style="text-align: center; padding: 20px; color: #64748b; font-style: italic;">
        Chưa có nội dung lịch công tác chi tiết cho tuần này.
      </td>
    </tr>
  `

  const generalNote = doc.generalNote
    ? `<div style="margin-top: 15px; font-size: 12.5pt; font-style: italic; line-height: 1.45;">
         <span style="font-weight: bold; text-decoration: underline; font-style: normal;">Ghi chú:</span> ${escapeHtml(doc.generalNote)}
       </div>`
    : ''

  const signerRole = escapeHtml(doc.signerRole || 'TL. GIÁM ĐỐC')
  const signerName = escapeHtml(doc.signerName || 'DSCKI. Dương Văn Bé')

  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${escapeHtml(doc.title || 'Lịch công tác tuần')}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
          <w:Compatibility>
            <w:UseWord2002TableStyleRules/>
          </w:Compatibility>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        /* Định nghĩa khổ A4 chuẩn cho Microsoft Word (595.3pt x 841.9pt hay 210mm x 297mm) */
        /* Lề: Top 2.0cm (56.7pt / 1134dxa), Left 3.0cm (85.05pt / 1701dxa), Right 2.0cm, Bottom 2.0cm */
        @page Section1 {
          size: 595.3pt 841.9pt;
          mso-page-orientation: portrait;
          margin: 2.0cm 2.0cm 2.0cm 3.0cm;
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        @page {
          size: A4 portrait;
          margin: 2.0cm 2.0cm 2.0cm 3.0cm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Times New Roman', 'Liberation Serif', serif;
          font-size: 11pt;
          line-height: 1.25;
          color: #000000;
          margin: 0;
          padding: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        .header-table td {
          border: none !important;
          padding: 0 4px;
        }
        .work-table {
          width: 100%;
          margin-top: 8px;
          border: 1.5pt solid #0284c7;
        }
        .work-table th, .work-table td {
          border: 1pt solid #cbd5e1;
        }
        .work-table th {
          background-color: #0284c7;
          color: #ffffff;
          font-weight: bold;
          text-align: center;
          padding: 6px 4px;
          font-size: 11pt;
        }
        .work-table td {
          padding: 5px 8px;
          font-size: 10pt;
        }
        .work-table tr {
          page-break-inside: avoid;
          page-break-after: avoid;
        }
      </style>
    </head>
    <body style="font-family: 'Times New Roman', serif;">
      <div class="Section1">
      <!-- BẢNG HEADER QUỐC HIỆU & CƠ QUAN BAN HÀNH -->
      <table class="header-table" style="width: 100%; border: none; margin-bottom: 12px;">
        <tr style="border: none;">
          <td style="width: 46%; text-align: center; vertical-align: top; border: none; padding-right: 8px;">
            <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase; color: #334155; white-space: nowrap;">${superiorAgency}</div>
            <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase; margin-top: 2px; white-space: nowrap;">${hospitalName}</div>
            <div style="width: 110px; height: 1.5pt; background-color: #000000; margin: 3px auto 4px auto;"></div>
            <div style="font-size: 11pt; font-weight: 500; margin-top: 3px; white-space: nowrap;">Số: ${docNumber}</div>
          </td>
          <td style="width: 54%; text-align: center; vertical-align: top; border: none; padding-left: 8px;">
            <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase; white-space: nowrap;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style="font-size: 11.5pt; font-weight: bold; margin-top: 2px; white-space: nowrap;">Độc lập – Tự do – Hạnh phúc</div>
            <div style="width: 140px; height: 1.5pt; background-color: #000000; margin: 3px auto 5px auto;"></div>
            <div style="font-size: 11pt; font-style: italic; color: #475569; white-space: nowrap;">${dateLocation}</div>
          </td>
        </tr>
      </table>

      <!-- TIÊU ĐỀ LỊCH CÔNG TÁC -->
      <div style="text-align: center; margin: 10px 0 10px 0;">
        <div style="font-size: 14pt; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
        <div style="font-size: 11.5pt; font-weight: bold; color: #0284c7; margin-top: 3px;">${weekSub}</div>
      </div>

      <!-- BẢNG LỊCH CÔNG TÁC TUẦN -->
      <table class="work-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: 14%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 6px 4px; white-space: nowrap;">Thứ</th>
            <th style="width: 43%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 6px 8px;">Sáng</th>
            <th style="width: 43%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 6px 8px;">Chiều</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml || emptyRowHtml}
        </tbody>
      </table>

      <!-- GHI CHÚ CHÂN BẢNG -->
      ${generalNote}

      <!-- KHỐI CHỮ KÝ LÃNH ĐẠO -->
      <table style="width: 100%; border: none; margin-top: 14px; page-break-inside: avoid;">
        <tr style="border: none;">
          <td style="width: 52%; border: none;"></td>
          <td style="width: 48%; text-align: center; vertical-align: top; border: none;">
            <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase;">${signerRole}</div>
            <div style="font-size: 10.5pt; font-style: italic; color: #64748b; margin: 8px 0 14px 0;">(Đã ký)</div>
            <div style="font-size: 11.5pt; font-weight: bold;">${signerName}</div>
          </td>
        </tr>
      </table>
      </div>
    </body>
    </html>
  `
}

export function exportWorkScheduleToWord(doc: WorkScheduleExportDoc) {
  const html = buildWorkScheduleDocHtml(doc)
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const weekNum = doc.weekNumber || 39
  const yearNum = doc.year || 2026
  a.download = `Lich_Cong_Tac_Tuan_${weekNum}_Nam_${yearNum}_BVDK_Thoi_Lai.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportWorkScheduleToPdf(doc: WorkScheduleExportDoc) {
  // Lấy nguyên vẹn HTML chuẩn từ hàm buildWorkScheduleDocHtml (đã được kiểm chứng chuẩn đẹp như Word)
  const html = buildWorkScheduleDocHtml(doc)
  
  // Dọn dẹp iframe in cũ nếu có
  const oldIframe = document.getElementById('work-schedule-print-iframe')
  if (oldIframe) {
    oldIframe.remove()
  }

  // Tạo một hidden iframe để in ngay tại trang, không mở tab about:blank
  const iframe = document.createElement('iframe')
  iframe.id = 'work-schedule-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument
  if (!iframeDoc || !iframe.contentWindow) {
    alert('Không thể khởi tạo trình in PDF. Vui lòng thử lại.')
    return
  }

  // Tạo document HTML in chuẩn A4 đồng bộ 100% với file Word
  const pdfPrintHtml = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(doc.title || 'Lịch công tác tuần')}</title>
      <style>
        /* Ép triệt tiêu 100% Header và Footer của trình duyệt (ngày giờ, URL, tiêu đề, số trang) bằng margin: 0 */
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Times New Roman', 'Liberation Serif', serif;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          font-size: 11pt;
          line-height: 1.25;
        }
        /* Căn chuẩn lề văn bản Nhà nước trực tiếp lên vùng chứa trang: Top 2.0cm, Right 2.0cm, Bottom 2.0cm, Left 3.0cm */
        .Section1 {
          width: 100% !important;
          padding: 2.0cm 2.0cm 2.0cm 3.0cm !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        .header-table td {
          border: none !important;
          padding: 0 4px !important;
        }
        .work-table {
          width: 100% !important;
          margin-top: 8px !important;
          border: 1.5pt solid #0284c7 !important;
          page-break-inside: avoid !important;
        }
        .work-table th, .work-table td {
          border: 1pt solid #cbd5e1 !important;
        }
        .work-table th {
          background-color: #0284c7 !important;
          color: #ffffff !important;
          font-weight: bold !important;
          text-align: center !important;
          padding: 6px 4px !important;
          font-size: 11pt !important;
        }
        .work-table td {
          padding: 6px 8px !important;
          font-size: 10pt !important;
          vertical-align: top !important;
        }
        .work-table tr {
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
        }
        .col-day {
          background-color: #f8fafc !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .Section1 {
            padding: 2.0cm 2.0cm 2.0cm 3.0cm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      </style>
    </head>
    <body style="font-family: 'Times New Roman', serif;">
      ${html.substring(
        html.indexOf('<body') > -1 ? html.indexOf('>', html.indexOf('<body')) + 1 : 0,
        html.indexOf('</body>') > -1 ? html.indexOf('</body>') : html.length,
      )}
    </body>
    </html>
  `

  iframeDoc.open()
  iframeDoc.write(pdfPrintHtml)
  iframeDoc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Lỗi in iframe:', e)
    } finally {
      // Dọn dẹp iframe sau khi đóng hộp thoại in
      setTimeout(() => {
        iframe.remove()
      }, 3000)
    }
  }, 400)
}
