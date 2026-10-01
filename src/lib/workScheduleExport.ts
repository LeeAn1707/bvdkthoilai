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
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: A4 portrait;
          margin: 1.5cm 1.5cm 1.5cm 2.0cm;
          mso-page-orientation: portrait;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Times New Roman', 'Liberation Serif', serif;
          font-size: 13pt;
          line-height: 1.3;
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
          margin-top: 12px;
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
          padding: 8px 6px;
          font-size: 12pt;
        }
        .work-table td {
          padding: 8px 10px;
          font-size: 11.5pt;
        }
      </style>
    </head>
    <body style="font-family: 'Times New Roman', serif;">
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
      <div style="text-align: center; margin: 14px 0 12px 0;">
        <div style="font-size: 15pt; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
        <div style="font-size: 12pt; font-weight: bold; color: #0284c7; margin-top: 3px;">${weekSub}</div>
      </div>

      <!-- BẢNG LỊCH CÔNG TÁC TUẦN -->
      <table class="work-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: 14%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 8px 4px; white-space: nowrap;">Thứ</th>
            <th style="width: 43%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 8px 10px;">Sáng</th>
            <th style="width: 43%; background-color: #0284c7; color: #ffffff; text-align: center; font-weight: bold; padding: 8px 10px;">Chiều</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml || emptyRowHtml}
        </tbody>
      </table>

      <!-- GHI CHÚ CHÂN BẢNG -->
      ${generalNote}

      <!-- KHỐI CHỮ KÝ LÃNH ĐẠO -->
      <table style="width: 100%; border: none; margin-top: 18px;">
        <tr style="border: none;">
          <td style="width: 52%; border: none;"></td>
          <td style="width: 48%; text-align: center; vertical-align: top; border: none;">
            <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase;">${signerRole}</div>
            <div style="font-size: 11pt; font-style: italic; color: #64748b; margin: 12px 0 18px 0;">(Đã ký)</div>
            <div style="font-size: 12pt; font-weight: bold;">${signerName}</div>
          </td>
        </tr>
      </table>
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
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const docBodyContent = html.substring(
    html.indexOf('<body') > -1 ? html.indexOf('>', html.indexOf('<body')) + 1 : 0,
    html.indexOf('</body>') > -1 ? html.indexOf('</body>') : html.length,
  )

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument
  if (!iframeDoc || !iframe.contentWindow) {
    alert('Không thể khởi tạo trình in PDF. Vui lòng thử lại.')
    return
  }

  iframeDoc.open()
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>${doc.title || 'Lịch công tác tuần'}</title>
      <style>
        /* Loại bỏ triệt để Header và Footer mặc định của trình duyệt (thời gian, ngày tháng, about:blank, số trang) */
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Times New Roman', 'Liberation Serif', serif;
          margin: 0;
          padding: 1.2cm 1.5cm 1.2cm 2.0cm;
          line-height: 1.3;
          font-size: 13pt;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .header-table td {
          border: none !important;
          padding: 0 4px;
        }
        .work-table {
          width: 100%;
          margin-top: 12px;
          border: 1.5pt solid #0284c7;
        }
        .work-table th, .work-table td {
          border: 1pt solid #cbd5e1;
        }
        .work-table th {
          background: #0284c7 !important;
          background-color: #0284c7 !important;
          color: #ffffff !important;
          font-weight: bold;
          text-align: center;
          padding: 8px 6px;
          font-size: 12pt;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .work-table td {
          padding: 8px 10px;
          font-size: 11.5pt;
        }
        .col-day {
          background-color: #f8fafc !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          body {
            padding: 1.2cm 1.5cm 1.2cm 2.0cm !important;
          }
        }
      </style>
    </head>
    <body>
      ${docBodyContent}
    </body>
    </html>
  `)
  iframeDoc.close()

  // Chờ iframe nạp xong rồi gọi lệnh in trực tiếp
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
