import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RichText } from '@/components/RichText'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { getCMS, getGlobal } from '@/lib/payload'
import { mediaUrl } from '@/lib/media'
import './specialty-detail.css'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getCMS()
  const result = await payload.find({
    collection: 'specialties',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  const specialty: any = result.docs[0]
  if (!specialty || specialty.active === false) return { title: 'Chuyên khoa không tồn tại' }

  const deptName = typeof specialty.department === 'object' ? specialty.department?.name : ''
  const titleText = `${specialty.name}${deptName ? ` - ${deptName}` : ''} | BVĐK Khu vực Thới Lai`
  const descText = specialty.summary || `Thông tin chuyên môn, dịch vụ kỹ thuật và đội ngũ bác sĩ chuyên khoa ${specialty.name} tại Bệnh viện Đa khoa Khu vực Thới Lai.`
  const coverImage = mediaUrl(specialty.cover)

  return {
    title: titleText,
    description: descText,
    openGraph: {
      title: titleText,
      description: descText,
      images: coverImage ? [coverImage] : [],
    },
  }
}

export default async function SpecialtyDetail({ params }: Props) {
  const { slug } = await params
  const payload = await getCMS()
  const [result, siteSettings] = await Promise.all([
    payload.find({
      collection: 'specialties',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    }),
    getGlobal('site-settings').catch(() => null),
  ])

  const specialty: any = result.docs[0]
  if (!specialty || specialty.active === false) notFound()

  const department = typeof specialty.department === 'object' ? specialty.department : null
  const deptId = department?.id || specialty.department

  // Truy vấn song song Bác sĩ, Phác đồ liên quan và các Chuyên khoa khác cùng Khoa
  const [docResult, protocolResult, siblingSpecialties] = await Promise.all([
    payload.find({
      collection: 'doctors',
      where: {
        and: [
          { active: { equals: true } },
          {
            or: [
              { specialtyRef: { equals: specialty.id } },
              ...(deptId ? [{ department: { equals: deptId } }] : []),
            ],
          },
        ],
      },
      limit: 50,
      depth: 2,
    }),
    payload.find({
      collection: 'clinical-protocols',
      where: {
        and: [
          { specialty: { equals: specialty.id } },
          { _status: { equals: 'published' } },
        ],
      },
      limit: 10,
      sort: '-issuedAt',
      depth: 1,
    }).catch(() => ({ docs: [] })),
    deptId ? payload.find({
      collection: 'specialties',
      where: {
        and: [
          { department: { equals: deptId } },
          { id: { not_equals: specialty.id } },
          { active: { equals: true } },
        ],
      },
      limit: 6,
      sort: ['order', 'name'],
      depth: 0,
    }).catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] }),
  ])

  // QUY TẮC BẮT BUỘC DỰ ÁN (AGENTS.md):
  // Ban Giám đốc BỆNH VIỆN LUÔN LUÔN ĐƯỢC ƯU TIÊN HIỂN THỊ ĐẦU TIÊN, SẮP XẾP TỪ TRÊN XUỐNG DƯỚI.
  // Giám đốc bệnh viện -> Phó Giám đốc -> Trưởng/Phó các Khoa, Phòng -> Bác sĩ.
  const getDoctorRank = (doc: any): number => {
    const title = (doc.title || '').toLowerCase()
    const docDept = (typeof doc.department === 'object' ? doc.department?.name : '').toLowerCase()
    const isBoard = docDept.includes('ban giám đốc') || title.includes('giám đốc')
    if (isBoard) {
      if (title.includes('giám đốc') && !title.includes('phó')) return 1
      if (title.includes('phó giám đốc')) return 2
      return 3
    }
    if (title.includes('trưởng khoa') || title.includes('trưởng phòng')) return 10
    if (title.includes('phó trưởng khoa') || title.includes('phó khoa') || title.includes('phó trưởng phòng')) return 11
    return 20
  }

  const rawDoctors = (docResult.docs as any[]).filter((d) => {
    if (d.showInSpecialty === false) return false
    // Nếu bác sĩ được gán đích danh vào chuyên khoa con khác thì không hiển thị ở chuyên khoa này
    if (d.specialtyRef) {
      const docSpecId = typeof d.specialtyRef === 'object' ? d.specialtyRef.id : d.specialtyRef
      if (docSpecId && Number(docSpecId) !== Number(specialty.id)) {
        return false
      }
    }
    return true
  })
  const doctors = [...rawDoctors].sort((a, b) => {
    const rankA = getDoctorRank(a)
    const rankB = getDoctorRank(b)
    if (rankA !== rankB) return rankA - rankB
    const orderA = typeof a.order === 'number' ? a.order : 999
    const orderB = typeof b.order === 'number' ? b.order : 999
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '', 'vi')
  })

  const protocols = protocolResult.docs as any[]
  const otherSpecialties = (siblingSpecialties as any).docs as any[]
  const coverUrl = mediaUrl(specialty.cover)

  // Cấu hình liên hệ / đặt khám (cho phép override từ Admin của từng Chuyên khoa)
  const medproUrl = (specialty as any)?.customBookingButtonUrl || (siteSettings as any)?.medproBookingUrl || process.env.NEXT_PUBLIC_MEDPRO_URL || 'https://medpro.vn/trung-tam-y-te-khu-vuc-thoi-lai'
  const hotline = (specialty as any)?.customHotline || (siteSettings as any)?.hotline || process.env.NEXT_PUBLIC_HOTLINE || '02923686115'
  const bookingTitle = (specialty as any)?.customBookingTitle || 'Đăng ký khám bệnh'
  const bookingDesc = (specialty as any)?.customBookingDesc || 'Chủ động chọn bác sĩ và thời gian khám qua cổng đăng ký trực tuyến hoặc tổng đài tiếp nhận bệnh nhân.'
  const bookingButtonLabel = (specialty as any)?.customBookingButtonLabel || 'Đặt khám chuyên khoa'
  const noticeText = (specialty as any)?.customNoticeText || 'Áp dụng đầy đủ quyền lợi BHYT đúng tuyến và thông tuyến theo quy định Bộ Y tế. Cấp cứu trực 24/7.'

  // Các cờ bật/tắt hiển thị khối (mặc định true)
  const showDeptCard = (specialty as any)?.showDepartmentCard !== false
  const showBookingCard = (specialty as any)?.showBookingCard !== false
  const showNoticeBox = (specialty as any)?.showNoticeBox !== false
  const showCoverImage = (specialty as any)?.showCoverImage !== false
  const showSummaryLead = (specialty as any)?.showSummaryLead !== false
  const showContentSection = (specialty as any)?.showContentSection !== false
  const showServicesSection = (specialty as any)?.showServicesSection !== false
  const showDoctorsSection = (specialty as any)?.showDoctorsSection !== false
  const showProtocolsSection = (specialty as any)?.showProtocolsSection !== false
  const showRelatedSection = (specialty as any)?.showRelatedSection !== false

  // Cách hiển thị ảnh riêng biệt trong trang chi tiết
  const detailCoverFit = (specialty as any)?.coverFitDetail || (specialty as any)?.coverFit || 'contain'

  // Danh sách banner quảng cáo / tiện ích (kết hợp cả chọn ảnh từ Admin Media và JSON bổ sung)
  let sidebarBanners: Array<{
    title?: string
    desc?: string
    btnText?: string
    link?: string
    imageUrl?: string
    openNewTab?: boolean
  }> = []

  // 1. Lấy từ danh sách trực quan chọn ảnh trong Admin
  if (Array.isArray((specialty as any)?.sidebarBanners)) {
    for (const b of (specialty as any).sidebarBanners) {
      const bannerImgUrl = b?.image ? mediaUrl(b.image) : undefined
      if (bannerImgUrl || b?.title || b?.desc) {
        sidebarBanners.push({
          title: b.title || undefined,
          desc: b.desc || undefined,
          btnText: b.btnText || undefined,
          link: b.link || undefined,
          imageUrl: bannerImgUrl || undefined,
          openNewTab: b.openNewTab !== false,
        })
      }
    }
  }

  // 2. Lấy bổ sung từ JSON nếu có cấu hình thêm
  if ((specialty as any)?.sidebarBannersJson) {
    try {
      const parsed = JSON.parse((specialty as any).sidebarBannersJson)
      if (Array.isArray(parsed)) {
        sidebarBanners = [...sidebarBanners, ...parsed]
      }
    } catch {
      // bỏ qua nếu json lỗi
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="specialtyDetailPage">
        {/* ── HERO BANNER CHUẨN Y TẾ ────────────────────────────── */}
        <section className="specialtyHero">
          <div className="container">
            <div className="specialtyHeroInner">
              <nav className="specialtyBreadcrumb" aria-label="Breadcrumb">
                <Link href="/">Trang chủ</Link>
                <span aria-hidden="true">/</span>
                <Link href="/chuyen-khoa">Chuyên khoa</Link>
                <span aria-hidden="true">/</span>
                <span>{specialty.name}</span>
              </nav>

              <div className="specialtyBadgeWrap">
                <span className="specialtyBadge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 10.5h-4.5V6a1.5 1.5 0 0 0-3 0v4.5H7a1.5 1.5 0 0 0 0 3h4.5V18a1.5 1.5 0 0 0 3 0v-4.5H19a1.5 1.5 0 0 0 0-3z" />
                  </svg>
                  Lĩnh vực chuyên môn sâu
                </span>
                {department?.name && (
                  <Link href={`/khoa-phong/${department.slug}`} className="specialtyDeptLink">
                    <span>Thuộc: {department.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                )}
              </div>

              <h1 className="specialtyHeroTitle">{specialty.name}</h1>

              {specialty.summary && (
                <p className="specialtyHeroDesc">{specialty.summary}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── THÂN TRANG 2 CỘT ─────────────────────────────────── */}
        <div className="container specialtyBody">
          <div className="specialtyGrid">
            {/* ── CỘT TRÁI: SIDEBAR THÔNG TIN TIỆN ÍCH & ĐẶT KHÁM & BANNER ── */}
            <aside className="specialtySidebar">
              {/* Card Đơn vị phụ trách */}
              {showDeptCard && department && (
                <div className="specialtySideCard">
                  <h3 className="specialtySideTitle">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    Đơn vị phụ trách
                  </h3>
                  <ul className="specialtyInfoList">
                    <li className="specialtyInfoItem">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <div>
                        <span className="specialtyInfoLabel">Khoa / Phòng</span>
                        <div className="specialtyInfoValue">
                          <Link href={`/khoa-phong/${department.slug}`}>
                            {department.name}
                          </Link>
                        </div>
                      </div>
                    </li>
                    {department.leader && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Trưởng khoa / Đơn vị</span>
                          <div className="specialtyInfoValue">{department.leader}</div>
                        </div>
                      </li>
                    )}
                    {department.location && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Vị trí phòng khám</span>
                          <div className="specialtyInfoValue">{department.location}</div>
                        </div>
                      </li>
                    )}
                    {department.phone && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Điện thoại liên hệ</span>
                          <div className="specialtyInfoValue">
                            <a href={`tel:${department.phone}`}>{department.phone}</a>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Card Đặt lịch khám & Hỗ trợ */}
              {showBookingCard && (
                <div className="specialtyActionCard">
                  <h3 className="specialtyActionTitle">{bookingTitle}</h3>
                  <p className="specialtyActionDesc">{bookingDesc}</p>
                  <a
                    href={medproUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="specialtyBookingBtn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{bookingButtonLabel}</span>
                  </a>
                  <a href={`tel:${hotline}`} className="specialtyHotlineBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Hotline: {hotline}</span>
                  </a>
                </div>
              )}

              {/* Hộp lưu ý BHYT & Giờ làm việc */}
              {showNoticeBox && (
                <div className="specialtyNoticeBox">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div>
                    <strong>Tiếp nhận khám BHYT</strong>
                    <div style={{ marginTop: '2px', fontSize: '12.5px', whiteSpace: 'pre-line' }}>
                      {noticeText}
                    </div>
                  </div>
                </div>
              )}

              {/* Banner Quảng Cáo / Tiện Ích Tùy Ý (Thêm qua Admin) */}
              {sidebarBanners.length > 0 && (
                <div className="specialtyBannersWrap">
                  {sidebarBanners.map((b, idx) => (
                    <div key={idx} className="specialtySidebarBanner">
                      {b.imageUrl && (
                        <a
                          href={b.link || '#'}
                          target={b.openNewTab !== false ? '_blank' : '_self'}
                          rel="noopener noreferrer"
                          className="specialtyBannerImgLink"
                        >
                          <img
                            src={b.imageUrl}
                            alt={b.title || 'Banner quảng cáo'}
                            className="specialtySidebarBannerImg"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {(b.title || b.desc || b.btnText) && (
                        <div className="specialtySidebarBannerContent">
                          {b.title && <h4 className="specialtyBannerTitle">{b.title}</h4>}
                          {b.desc && <p className="specialtyBannerDesc">{b.desc}</p>}
                          {b.btnText && b.link && (
                            <a
                              href={b.link}
                              target={b.openNewTab !== false ? '_blank' : '_self'}
                              rel="noopener noreferrer"
                              className="specialtyBannerBtn"
                            >
                              <span>{b.btnText}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* ── CỘT PHẢI: NỘI DUNG CHUYÊN MÔN SÂU ─────────────── */}
            <div className="specialtyMainContent">
              {/* 1. Ảnh bìa chuyên khoa (nếu có và bật) */}
              {showCoverImage && coverUrl && (
                <div
                  className={`specialtyCoverBox ${detailCoverFit === 'contain' ? 'isContainMode' : ''}`}
                >
                  <img
                    src={coverUrl}
                    alt={specialty.name}
                    className={`specialtyCoverImg ${
                      detailCoverFit === 'contain'
                        ? 'fitContain'
                        : detailCoverFit === 'cover-center'
                        ? 'fitCoverCenter'
                        : detailCoverFit === 'cover-bottom'
                        ? 'fitCoverBottom'
                        : detailCoverFit === 'fill'
                        ? 'fitFill'
                        : 'fitCoverTop'
                    }`}
                    loading="eager"
                  />
                </div>
              )}

              {/* 2. Khối Giới thiệu chi tiết chuyên khoa */}
              {showContentSection && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>
                      <h2 className="specialtySectionTitle">Giới thiệu chuyên môn</h2>
                    </div>
                  </div>

                  {showSummaryLead && specialty.summary && (
                    <p className="specialtySectionLead">{specialty.summary}</p>
                  )}

                  {specialty.content ? (
                    <div className="specialtyRichTextWrap">
                      <RichText data={specialty.content} />
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                      Thông tin chi tiết về chuyên môn đang được cập nhật chuẩn hóa bởi Hội đồng Chuyên môn Bệnh viện.
                    </p>
                  )}
                </section>
              )}

              {/* 3. Khối Dịch vụ & Kỹ thuật nổi bật */}
              {showServicesSection && specialty.services && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                      <h2 className="specialtySectionTitle">Dịch vụ & Kỹ thuật mũi nhọn</h2>
                    </div>
                  </div>
                  <div className="specialtyRichTextWrap">
                    <RichText data={specialty.services} />
                  </div>
                </section>
              )}

              {/* 4. Khối Đội ngũ Bác sĩ Chuyên khoa (Tuân thủ Mandates AGENTS.md) */}
              {showDoctorsSection && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="specialtySectionTitle">Đội ngũ Bác sĩ chuyên khoa</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {doctors.length ? `${doctors.length} bác sĩ công tác tại chuyên môn` : 'Đang cập nhật danh sách'}
                        </span>
                      </div>
                    </div>
                    {doctors.length > 0 && (
                      <Link href={`/bac-si?dept=${deptId || ''}`} style={{ fontSize: '13px', fontWeight: 700, color: '#0878d1' }}>
                        Xem tất cả bác sĩ →
                      </Link>
                    )}
                  </div>

                  {doctors.length > 0 ? (
                    <div className="specialtyDoctorGrid">
                      {doctors.map((d) => {
                        const avatarUrl = mediaUrl(d.avatar)
                        const degreePrefix = d.degree ? `${d.degree}. ` : ''
                        const fullDoctorName = `${degreePrefix}${d.name}`

                        return (
                          <Link
                            key={d.id}
                            href={`/bac-si/${d.slug}`}
                            className="specialtyDocCard"
                          >
                            {/* Khung ảnh chân dung 3:4 chuẩn, không méo */}
                            <div className="specialtyDocAvatarWrap">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={fullDoctorName}
                                  className="specialtyDocAvatarImg"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="specialtyDocAvatarFallback">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {d.title?.trim() && (
                              <span className="specialtyDocBadgeRole">{d.title.trim()}</span>
                            )}
                            <h3 className="specialtyDocName">{fullDoctorName}</h3>
                            {d.professionalTitle && (
                              <span className="specialtyDocDegree">{d.professionalTitle}</span>
                            )}

                            <div className="specialtyDocFooter">
                              <span>Xem hồ sơ chuyên môn</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                      Danh sách bác sĩ phụ chuyên khoa đang được hoàn thiện hồ sơ điện tử.
                    </p>
                  )}
                </section>
              )}

              {/* 5. Khối Phác đồ & Hướng dẫn điều trị liên quan (nếu có) */}
              {showProtocolsSection && protocols.length > 0 && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="specialtySectionTitle">Phác đồ & Hướng dẫn điều trị</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Tài liệu chuyên môn chuẩn y khoa áp dụng tại bệnh viện
                        </span>
                      </div>
                    </div>
                    <Link href="/phac-do-dieu-tri" style={{ fontSize: '13px', fontWeight: 700, color: '#0878d1' }}>
                      Xem tất cả phác đồ →
                    </Link>
                  </div>

                  <div className="specialtyProtocolList">
                    {protocols.map((proto) => (
                      <Link
                        key={proto.id}
                        href={`/phac-do-dieu-tri/${proto.slug}`}
                        className="specialtyProtocolItem"
                      >
                        {proto.code && (
                          <span className="specialtyProtocolCode">{proto.code}</span>
                        )}
                        <span className="specialtyProtocolTitle">{proto.title}</span>
                        <span className="specialtyProtocolMeta">
                          {proto.issuedAt ? new Date(proto.issuedAt).toLocaleDateString('vi-VN') : 'Mới ban hành'}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* 6. Các chuyên khoa lân cận cùng Khoa / Phòng */}
              {showRelatedSection && otherSpecialties.length > 0 && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="specialtySectionTitle">Các chuyên khoa liên quan</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Cùng thuộc {department?.name || 'đơn vị chuyên môn'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="specialtyRelatedGrid">
                    {otherSpecialties.map((item) => (
                      <Link
                        key={item.id}
                        href={`/chuyen-khoa/${item.slug}`}
                        className="specialtyRelatedCard"
                      >
                        <h4 className="specialtyRelatedName">{item.name}</h4>
                        <p className="specialtyRelatedDesc">
                          {item.summary || 'Xem thông tin chuyên khoa và đội ngũ bác sĩ phụ trách.'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Điều hướng quay lại */}
              <div className="specialtyBackNav">
                <Link href="/chuyen-khoa" className="specialtyBackBtn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Xem danh sách tất cả chuyên khoa</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

