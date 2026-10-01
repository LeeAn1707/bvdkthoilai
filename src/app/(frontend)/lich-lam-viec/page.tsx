import type { Metadata } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { PageHero } from '@/components/PageHero'
import { getCMS } from '@/lib/payload'
import { mediaUrl } from '@/lib/media'
import { WorkScheduleNavClient } from './WorkScheduleNavClient'
import './lich-lam-viec-co-quan.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Lịch làm việc cơ quan & Lịch công tác tuần — BVĐK Khu vực Thới Lai',
  description: 'Tra cứu Lịch làm việc, Lịch công tác tuần của Ban Giám đốc và các Khoa/Phòng tại Bệnh viện Đa khoa Khu vực Thới Lai theo chuẩn cổng lịch làm việc Cần Thơ.',
}

type PageProps = {
  searchParams?: Promise<{ week?: string; year?: string; id?: string }>
}

export default async function WorkSchedulePage({ searchParams }: PageProps) {
  const query = (await searchParams) || {}
  const targetYear = query.year ? Number(query.year) : 2026
  const targetWeek = query.week ? Number(query.week) : 39

  let activeDoc: any = null
  let allWeeks: Array<{ weekNumber: number; year: number; title: string }> = []

  try {
    const payload = await getCMS()

    // 1. Lấy danh sách các tuần đã đăng để đưa vào dropdown bộ lọc
    const allSchedules = await payload.find({
      collection: 'work-schedules',
      where: { active: { equals: true } },
      sort: '-year,-weekNumber',
      limit: 52,
      depth: 1,
    })

    allWeeks = allSchedules.docs.map((d: any) => ({
      weekNumber: Number(d.weekNumber),
      year: Number(d.year),
      title: d.title || `Tuần ${d.weekNumber} năm ${d.year}`,
    }))

    // 2. Tìm lịch cụ thể theo query hoặc lấy lịch mới nhất
    if (query.id) {
      activeDoc = await payload.findByID({
        collection: 'work-schedules',
        id: query.id,
        depth: 2,
      })
    } else if (query.week) {
      const match = await payload.find({
        collection: 'work-schedules',
        where: {
          and: [
            { active: { equals: true } },
            { weekNumber: { equals: targetWeek } },
            { year: { equals: targetYear } },
          ],
        },
        limit: 1,
        depth: 2,
      })
      activeDoc = match.docs[0] || null
    }

    // Nếu không khớp, lấy lịch đầu tiên
    if (!activeDoc && allSchedules.docs.length > 0) {
      activeDoc = allSchedules.docs[0]
    }
  } catch (e) {
    console.error('Lỗi tải lịch làm việc cơ quan:', e)
  }

  // Dữ liệu fallback nếu chưa có dữ liệu trong DB
  const doc = activeDoc || {
    title: 'LỊCH CÔNG TÁC TUẦN (Từ ngày 21/9/2026 – 25/9/2026)',
    displayMode: 'table',
    documentNumber: '08/LLV - BVĐKKVTL',
    revision: 'CHỈNH SỬA 02',
    weekNumber: 39,
    year: 2026,
    startDate: '2026-09-21',
    endDate: '2026-09-25',
    generalNote: 'Tùy tình hình thực tế, Lịch làm việc này có thể thay đổi, Bệnh viện Đa khoa khu vực Thới Lai sẽ có thông báo sau./.',
    signerRole: 'TL. GIÁM ĐỐC',
    signerName: 'DSCKI. Dương Văn Bé',
    days: [
      { dayLabel: 'Thứ hai', dateFormatted: '(21/9/26)', morningContent: '', afternoonContent: '', note: '' },
      {
        dayLabel: 'Thứ ba',
        dateFormatted: '(22/9/26)',
        morningContent: '- 8h00: Ban giám đốc, phòng TCHC, P. KHTH, P. TCKT, K. DƯỢC và các bộ phận liên quan tiếp đoàn thẩm định giấy phép hoạt động SYT tại Hội trường giao ban',
        afternoonContent: '',
        note: '',
      },
      {
        dayLabel: 'Thứ tư',
        dateFormatted: '(23/9/26)',
        morningContent: '* Bs Thắng khám sức khỏe tại trường mầm non Cờ Đỏ (cả ngày)',
        afternoonContent: '13h00: Bs Hạnh, Bs Huy tham gia đoàn công tác hỗ trợ chuyên môn kỹ thuật, hỗ trợ, kiểm tra... tại BVĐKKV Cái Răng',
        note: '',
      },
      {
        dayLabel: 'Thứ năm',
        dateFormatted: '(24/9/26)',
        morningContent: '* Bs Thắng khám sức khỏe tại trường mầm non Cờ Đỏ (cả ngày)',
        afternoonContent: '',
        note: '',
      },
      { dayLabel: 'Thứ sáu', dateFormatted: '(25/9/26)', morningContent: '', afternoonContent: '', note: '' },
    ],
  }

  const currentWeekNum = Number(doc.weekNumber) || 39
  const currentYearNum = Number(doc.year) || 2026
  const prevWeekNum = currentWeekNum > 1 ? currentWeekNum - 1 : 52
  const prevYearNum = currentWeekNum > 1 ? currentYearNum : currentYearNum - 1
  const nextWeekNum = currentWeekNum < 52 ? currentWeekNum + 1 : 1
  const nextYearNum = currentWeekNum < 52 ? currentYearNum : currentYearNum + 1

  const attachedFileUrl = mediaUrl(doc.attachedFile)
  const scannedImageUrl = mediaUrl(doc.scannedImage)
  const isPdf = attachedFileUrl?.toLowerCase().endsWith('.pdf')
  const streamFileUrl = doc.id && doc.attachedFile
    ? `/api/document-file?collection=work-schedules&id=${encodeURIComponent(String(doc.id))}`
    : attachedFileUrl
  const isViewerMode = doc.displayMode === 'viewer' && (attachedFileUrl || scannedImageUrl)

  return (
    <>
      <SiteHeader />

      <PageHero
        title="Lịch làm việc cơ quan"
        description="Lịch công tác tuần của Ban Giám đốc và các Khoa/Phòng Bệnh viện Đa khoa Khu vực Thới Lai theo chuẩn mẫu cổng Cần Thơ."
        breadcrumbParent="Giới thiệu"
        breadcrumb="Lịch làm việc cơ quan"
      />

      <main className="workScheduleContainer">
        {/* 1. THANH ĐIỀU HƯỚNG TUẦN / NĂM KIỂU CỔNG CẦN THƠ */}
        <WorkScheduleNavClient
          currentWeek={currentWeekNum}
          currentYear={currentYearNum}
          prevWeek={prevWeekNum}
          prevYear={prevYearNum}
          nextWeek={nextWeekNum}
          nextYear={nextYearNum}
          allWeeks={allWeeks}
          attachedFileUrl={streamFileUrl ? `${streamFileUrl}${streamFileUrl.includes('?') ? '&' : '?'}download=1` : attachedFileUrl}
          scheduleDoc={doc}
        />

        {/* 2. NỘI DUNG CHÍNH (THEO 2 CHẾ ĐỘ HIỂN THỊ ADMIN ĐÃ CHỌN) */}
        {isViewerMode ? (
          /* ── TÙY CHỌN 2: TRÌNH XEM TỆP ĐÍNH KÈM NHÚNG TRỰC TIẾP ── */
          <div className="viewerContainer">
            <div className="viewerToolbar">
              <span>📄 Đang xem trực tiếp tệp văn bản lịch công tác</span>
              {(streamFileUrl || attachedFileUrl) && (
                <a href={streamFileUrl || attachedFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>
                  Mở tệp trong tab mới ↗
                </a>
              )}
            </div>

            {attachedFileUrl ? (
              isPdf ? (
                <iframe
                  src={`${streamFileUrl || attachedFileUrl}#toolbar=1&navpanes=0`}
                  className="viewerIframe"
                  title={doc.title}
                />
              ) : (
                <iframe
                  src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(attachedFileUrl)}`}
                  className="viewerIframe"
                  title={doc.title}
                />
              )
            ) : scannedImageUrl ? (
              <div className="scannedImageWrapper">
                <img src={scannedImageUrl} alt="Bản scan lịch công tác tuần" />
              </div>
            ) : null}
          </div>
        ) : (
          /* ── TÙY CHỌN 1: BẢNG LỊCH BIỂU CÔNG VỤ CHUẨN MẪU BỆNH VIỆN ── */
          <article className="officialDocumentCard" id="printOfficialDocumentCard">
            {/* Nhãn phiên bản / chỉnh sửa ở góc trái */}
            {doc.revision && (
              <div className="docRevisionBadge">
                {doc.revision}
              </div>
            )}

            {/* Header Quốc hiệu & Đơn vị (2 cột) */}
            <div className="docHeaderGrid">
              <div className="docHeaderLeft">
                <div className="agencySuper">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div className="agencyMain">
                  <span>BVĐK KHU VỰC THỚI LAI</span>
                  <div className="agencyDivider" />
                </div>
                <div className="docNumber">Số: {doc.documentNumber || '08/LLV - BVĐKKVTL'}</div>
              </div>

              <div className="docHeaderRight">
                <div className="republicTitle">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="mottoBox">
                  <span className="mottoText">Độc lập – Tự do – Hạnh phúc</span>
                  <div className="mottoDivider" />
                </div>
                <div className="docDateLocation">
                  Thới Lai, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {currentYearNum}
                </div>
              </div>
            </div>

            {/* Tiêu đề văn bản */}
            <div className="docTitleSection">
              <h1 className="docMainTitle">{doc.title?.replace(/\(.*?\)/g, '').trim() || 'LỊCH CÔNG TÁC TUẦN'}</h1>
              <p className="docWeekSub">
                ( Từ ngày {doc.startDate ? new Date(doc.startDate).toLocaleDateString('vi-VN') : '21/9/2026'} – {doc.endDate ? new Date(doc.endDate).toLocaleDateString('vi-VN') : '25/9/2026'} )
              </p>
            </div>

            {/* BẢNG LỊCH BIỂU THỨ 2 -> THỨ 6/CN */}
            <div className="workScheduleTableWrapper">
              <table className="workScheduleTable">
                <thead>
                  <tr>
                    <th style={{ width: '13%' }}>Thứ</th>
                    <th style={{ width: '43.5%' }}>Sáng</th>
                    <th style={{ width: '43.5%' }}>Chiều</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(doc.days) && doc.days.length > 0 ? (
                    doc.days.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="tdDayCell">
                          <span className="dayNameText">{item.dayLabel}</span>
                          {item.dateFormatted && (
                            <span className="dateFormattedText">{item.dateFormatted}</span>
                          )}
                        </td>
                        <td>
                          <div className="sessionContentText">
                            {item.morningContent || '—'}
                          </div>
                        </td>
                        <td>
                          <div className="sessionContentText">
                            {item.afternoonContent || '—'}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        Chưa có lịch công tác chi tiết cho tuần này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Chân trang văn bản: Ghi chú & Chữ ký */}
            <div className="docFooterSection">
              {doc.generalNote && (
                <div className="docGeneralNote">
                  <b>Ghi chú:</b> {doc.generalNote}
                </div>
              )}

              <div className="docSignatureRow">
                <div className="docSignerBox">
                  <div className="docSignerRole">{doc.signerRole || 'TL. GIÁM ĐỐC'}</div>
                  {scannedImageUrl ? (
                    <div style={{ margin: '8px 0' }}>
                      <img src={scannedImageUrl} alt="Chữ ký" style={{ height: '70px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="docSignedText">(Đã ký)</div>
                  )}
                  <div className="docSignerName">{doc.signerName || 'DSCKI. Dương Văn Bé'}</div>
                </div>
              </div>
            </div>
          </article>
        )}
      </main>

      <SiteFooter />
    </>
  )
}
