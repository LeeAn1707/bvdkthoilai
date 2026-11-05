import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RichText } from '@/components/RichText'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { getCMS, getGlobal } from '@/lib/payload'
import { mediaUrl } from '@/lib/media'
import './department-detail.css'
import '../../chuyen-khoa/[slug]/specialty-detail.css'

type Props = { params: Promise<{ slug: string }> }

function isEmptyRichText(val: any): boolean {
  if (!val) return true
  if (typeof val !== 'object') return false
  const children = val?.root?.children
  if (!Array.isArray(children) || children.length === 0) return true
  if (
    children.length === 1 &&
    children[0]?.type === 'paragraph' &&
    (!Array.isArray(children[0]?.children) || children[0].children.length === 0)
  ) {
    return true
  }
  return false
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getCMS()

  let dep: any = null
  const result = await payload.find({
    collection: 'departments',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  dep = result.docs[0]

  // Nếu không tìm thấy trong departments, thử tìm trong specialties theo slug
  let primarySpec: any = null
  if (!dep) {
    const specBySlug = await payload
      .find({
        collection: 'specialties',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
      })
      .catch(() => ({ docs: [] }))
    primarySpec = specBySlug.docs[0]
    if (primarySpec?.department && typeof primarySpec.department === 'object') {
      dep = primarySpec.department
    }
  } else {
    const linkedSpec =
      typeof dep.linkedSpecialty === 'object' && dep.linkedSpecialty
        ? dep.linkedSpecialty
        : null
    if (linkedSpec) {
      primarySpec = linkedSpec
    } else {
      const specByDept = await payload
        .find({
          collection: 'specialties',
          where: { department: { equals: dep.id } },
          sort: ['order', '-updatedAt'],
          limit: 1,
          depth: 2,
        })
        .catch(() => ({ docs: [] }))
      primarySpec = specByDept.docs[0] || null
    }
  }

  const target = dep || primarySpec
  if (!target || target.active === false) return { title: 'Khoa / Phòng không tồn tại' }

  const titleText = `${target.name} | BVĐK Khu vực Thới Lai`
  const descText =
    dep?.summary ||
    primarySpec?.summary ||
    `Thông tin tổ chức, chức năng nhiệm vụ, dịch vụ kỹ thuật và đội ngũ y bác sĩ ${target.name} tại Bệnh viện Đa khoa Khu vực Thới Lai.`
  const coverImage = mediaUrl(dep?.cover) || mediaUrl(primarySpec?.cover)

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

export default async function DepartmentDetail({ params }: Props) {
  const { slug } = await params
  const payload = await getCMS()
  const [result, siteSettings, themeSettings] = await Promise.all([
    payload.find({
      collection: 'departments',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    }),
    getGlobal('site-settings').catch(() => null),
    getGlobal('theme-settings').catch(() => null),
  ])

  let dep: any = result.docs[0]
  let matchedBySpecialtySlug: any = null

  if (!dep) {
    // Dự phòng nếu người dùng truy cập /khoa-phong/[slug] bằng slug của một Chuyên khoa
    const specFallback = await payload
      .find({
        collection: 'specialties',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
      })
      .catch(() => ({ docs: [] }))
    matchedBySpecialtySlug = specFallback.docs[0] || null
    if (matchedBySpecialtySlug?.department && typeof matchedBySpecialtySlug.department === 'object') {
      dep = matchedBySpecialtySlug.department
    } else if (matchedBySpecialtySlug) {
      dep = {
        ...matchedBySpecialtySlug,
        unitType: 'clinical',
        kind: 'clinical',
      }
    }
  }

  if (!dep || dep.active === false) notFound()

  const deptId = dep.id

  // Truy vấn song song Bác sĩ, Chuyên khoa trực thuộc, và các Khoa/Phòng cùng khối
  const [docResult, specialtyResult, relatedDeptsResult] = await Promise.all([
    payload
      .find({
        collection: 'doctors',
        where: {
          and: [
            { department: { equals: deptId } },
            { active: { equals: true } },
          ],
        },
        limit: 100,
        depth: 2,
      })
      .catch(() => ({ docs: [] })),
    payload
      .find({
        collection: 'specialties',
        where: {
          and: [
            { department: { equals: deptId } },
            { active: { equals: true } },
          ],
        },
        limit: 50,
        sort: ['order', 'name'],
        depth: 2,
      })
      .catch(() => ({ docs: [] })),
    payload
      .find({
        collection: 'departments',
        where: {
          and: [
            { id: { not_equals: deptId } },
            { active: { equals: true } },
          ],
        },
        limit: 6,
        sort: ['order', 'name'],
        depth: 1,
      })
      .catch(() => ({ docs: [] })),
  ])

  const specialties = (specialtyResult.docs as any[]) || []

  // Xác định Chuyên khoa chính liên kết với Khoa / Phòng này để kế thừa bài viết & hình ảnh
  const explicitLinkedSpec =
    typeof dep.linkedSpecialty === 'object' && dep.linkedSpecialty
      ? dep.linkedSpecialty
      : specialties.find((s) => Number(s.id) === Number(dep.linkedSpecialty))

  const primarySpec: any =
    matchedBySpecialtySlug ||
    explicitLinkedSpec ||
    specialties.find((s) => s.slug === dep.slug) ||
    specialties[0] ||
    null

  const syncEnabled = dep.syncFromSpecialty !== false
  const specSource = syncEnabled ? primarySpec : null

  // Truy vấn thêm Phác đồ điều trị thuộc các chuyên khoa của Khoa / Phòng này
  const specialtyIds = specialties.map((s) => s.id).filter(Boolean)
  if (primarySpec?.id && !specialtyIds.includes(primarySpec.id)) {
    specialtyIds.push(primarySpec.id)
  }

  let protocols: any[] = []
  if (specialtyIds.length > 0) {
    const protoRes = await payload
      .find({
        collection: 'clinical-protocols',
        where: {
          and: [
            { specialty: { in: specialtyIds } },
            { _status: { equals: 'published' } },
          ],
        },
        limit: 8,
        sort: '-issuedAt',
        depth: 1,
      })
      .catch(() => ({ docs: [] }))
    protocols = protoRes.docs as any[]
  }

  // QUY TẮC BẮT BUỘC DỰ ÁN (AGENTS.md - Mandate 1):
  // Ban Giám đốc BỆNH VIỆN LUÔN LUÔN ĐƯỢC ƯU TIÊN HIỂN THỊ TRANG ĐẦU TIÊN, SẮP XẾP TỪ TRÊN XUỐNG DƯỚI.
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

  // Hợp nhất bác sĩ thuộc department HOẶC thuộc specialtyRef của khoa
  let combinedDocList = [...(docResult.docs as any[])]
  if (combinedDocList.length === 0 && primarySpec?.id) {
    const specDocs = await payload
      .find({
        collection: 'doctors',
        where: {
          and: [
            { specialtyRef: { equals: primarySpec.id } },
            { active: { equals: true } },
          ],
        },
        limit: 50,
        depth: 2,
      })
      .catch(() => ({ docs: [] }))
    combinedDocList = specDocs.docs as any[]
  }

  const rawDoctors = combinedDocList.filter((d) => d.showInDepartment !== false)
  const doctors = [...rawDoctors].sort((a, b) => {
    const rankA = getDoctorRank(a)
    const rankB = getDoctorRank(b)
    if (rankA !== rankB) return rankA - rankB
    const orderA = typeof a.order === 'number' ? a.order : 999
    const orderB = typeof b.order === 'number' ? b.order : 999
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '', 'vi')
  })

  // Kế thừa thông minh từ Chuyên khoa nếu Khoa / Phòng chưa nhập riêng
  const summaryText = dep.summary || specSource?.summary || ''
  const taglineText = dep.tagline || specSource?.tagline || ''
  const richContent = !isEmptyRichText(dep.content)
    ? dep.content
    : !isEmptyRichText(specSource?.content)
      ? specSource.content
      : null
  const richServices = !isEmptyRichText(dep.services)
    ? dep.services
    : !isEmptyRichText(specSource?.services)
      ? specSource.services
      : null
  const coverUrl = mediaUrl(dep.cover) || mediaUrl(specSource?.cover)

  // Chế độ hiển thị ảnh chi tiết giống hệt Chuyên khoa
  const rawCoverFit =
    dep.coverFitDetail ||
    specSource?.coverFitDetail ||
    dep.coverFit ||
    (themeSettings as any)?.specialtyCoverFit ||
    'contain'
  const rawCoverPos = dep.coverPosition || specSource?.coverPosition || 'top'
  const detailCoverFit =
    rawCoverFit === 'cover'
      ? rawCoverPos === 'center'
        ? 'cover-center'
        : rawCoverPos === 'bottom'
          ? 'cover-bottom'
          : 'cover-top'
      : rawCoverFit

  // Cấu hình liên hệ & đặt khám
  const defaultMedproUrl =
    (siteSettings as any)?.medproBookingUrl ||
    process.env.NEXT_PUBLIC_MEDPRO_URL ||
    'https://medpro.vn/trung-tam-y-te-khu-vuc-thoi-lai'
  const defaultHotline =
    (siteSettings as any)?.hotline || process.env.NEXT_PUBLIC_HOTLINE || '02923686115'

  const showDepartmentCard = (dep.showDepartmentCard ?? specSource?.showDepartmentCard) !== false
  const showBookingCard = (dep.showBookingCard ?? specSource?.showBookingCard) !== false
  const showNoticeBox = (dep.showNoticeBox ?? specSource?.showNoticeBox) !== false
  const showCoverImage = (dep.showCoverImage ?? specSource?.showCoverImage) !== false
  const showSummaryLead = (dep.showSummaryLead ?? specSource?.showSummaryLead) !== false
  const showContentSection = (dep.showContentSection ?? specSource?.showContentSection) !== false
  const showServicesSection = (dep.showServicesSection ?? specSource?.showServicesSection) !== false
  const showDoctorsSection =
    (dep.showDoctorsSection ?? dep.showMembersSection ?? specSource?.showDoctorsSection) !== false
  const showProtocolsSection = (dep.showProtocolsSection ?? specSource?.showProtocolsSection) !== false
  const showRelatedSection = (dep.showRelatedSection ?? specSource?.showRelatedSection) !== false

  const bookingTitle =
    dep.customBookingTitle?.trim() ||
    specSource?.customBookingTitle?.trim() ||
    'Đăng ký khám bệnh'
  const bookingDesc =
    dep.customBookingDesc?.trim() ||
    specSource?.customBookingDesc?.trim() ||
    'Chủ động chọn bác sĩ và thời gian khám qua cổng đăng ký trực tuyến hoặc tổng đài hỗ trợ.'
  const bookingButtonLabel =
    dep.customBookingButtonLabel?.trim() ||
    specSource?.customBookingButtonLabel?.trim() ||
    'Đặt khám trực tuyến'
  const medproUrl =
    dep.customBookingButtonUrl?.trim() ||
    specSource?.customBookingButtonUrl?.trim() ||
    defaultMedproUrl
  const hotline =
    dep.customHotline?.trim() ||
    specSource?.customHotline?.trim() ||
    dep.phone?.trim() ||
    defaultHotline
  const noticeText =
    dep.customNoticeText?.trim() ||
    specSource?.customNoticeText?.trim() ||
    'Áp dụng đầy đủ quyền lợi BHYT đúng tuyến và thông tuyến toàn quốc theo quy định Bộ Y tế. Cấp cứu trực 24/7.'

  // Danh sách Banner Quảng Cáo / Tiện Ích ở Sidebar (kế thừa từ Chuyên khoa nếu Khoa/Phòng để trống)
  let sidebarBanners: Array<{
    imageUrl?: string
    title?: string
    desc?: string
    btnText?: string
    link?: string
    openNewTab?: boolean
  }> = []

  const bannerSourceArray =
    Array.isArray(dep.sidebarBanners) && dep.sidebarBanners.length > 0
      ? dep.sidebarBanners
      : Array.isArray(specSource?.sidebarBanners)
        ? specSource.sidebarBanners
        : []

  for (const item of bannerSourceArray) {
    const imgUrl = mediaUrl(item.image) || item.imageUrl || ''
    if (imgUrl || item.title || item.desc) {
      sidebarBanners.push({
        imageUrl: imgUrl,
        title: item.title,
        desc: item.desc,
        btnText: item.btnText,
        link: item.link,
        openNewTab: item.openNewTab !== false,
      })
    }
  }

  const bannerJsonSource = dep.sidebarBannersJson || specSource?.sidebarBannersJson
  if (typeof bannerJsonSource === 'string' && bannerJsonSource.trim()) {
    try {
      const parsed = JSON.parse(bannerJsonSource)
      if (Array.isArray(parsed)) {
        sidebarBanners = [...sidebarBanners, ...parsed.filter((b) => b && (b.title || b.imageUrl || b.desc))]
      }
    } catch {
      // Bỏ qua nếu JSON lỗi
    }
  }

  // Phân loại đơn vị hiển thị badge
  const unitKind = dep.unitType || dep.kind || 'clinical'
  const badgeLabel =
    unitKind === 'office'
      ? 'Phòng chức năng'
      : unitKind === 'paraclinical'
        ? 'Khoa cận lâm sàng'
        : unitKind === 'other'
          ? 'Đơn vị chuyên trách'
          : 'Khoa lâm sàng'

  const membersTitle =
    dep.membersSectionTitle?.trim() ||
    (unitKind === 'office' ? 'Đội ngũ Cán bộ – Chuyên viên' : 'Đội ngũ Bác sĩ & Nhân sự chuyên môn')

  // Các chuyên khoa con khác (nếu có nhiều chuyên khoa trực thuộc)
  const subSpecialties = specialties.filter((s) => s.slug !== dep.slug)
  const showSpecialties = dep.showSpecialtiesSection !== false && subSpecialties.length > 0
  const relatedDepts = (relatedDeptsResult.docs as any[]) || []

  // Tự động lấy tên Trưởng khoa / Phó khoa từ danh sách Bác sĩ nếu trong Khoa chưa điền text
  const autoLeaderDoc = doctors.find((d) => {
    const t = (d.title || '').toLowerCase()
    return t.includes('trưởng khoa') || t.includes('trưởng phòng') || (t.includes('giám đốc') && !t.includes('phó'))
  })
  const leaderDisplay =
    dep.leader ||
    (autoLeaderDoc ? `${autoLeaderDoc.degree ? `${autoLeaderDoc.degree}. ` : ''}${autoLeaderDoc.name}` : '')

  return (
    <>
      <SiteHeader />
      <main className="specialtyDetailPage departmentDetailPage">
        {/* ── HERO BANNER CHUẨN Y TẾ (ĐỒNG BỘ VỚI CHUYÊN KHOA) ──────────────── */}
        <section className="specialtyHero">
          <div className="container">
            <div className="specialtyHeroInner">
              <nav className="specialtyBreadcrumb" aria-label="Breadcrumb">
                <Link href="/">Trang chủ</Link>
                <span aria-hidden="true">/</span>
                <Link href="/khoa-phong">Khoa – Phòng</Link>
                <span aria-hidden="true">/</span>
                <span>{dep.name}</span>
              </nav>

              <div className="specialtyBadgeWrap">
                <span className="specialtyBadge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 10.5h-4.5V6a1.5 1.5 0 0 0-3 0v4.5H7a1.5 1.5 0 0 0 0 3h4.5V18a1.5 1.5 0 0 0 3 0v-4.5H19a1.5 1.5 0 0 0 0-3z" />
                  </svg>
                  {badgeLabel}
                </span>

                {taglineText && (
                  <span className="specialtyDeptLink" style={{ cursor: 'default' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {taglineText}
                  </span>
                )}

                {primarySpec?.slug && (
                  <Link href={`/chuyen-khoa/${primarySpec.slug}`} className="specialtyDeptLink">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    Chuyên khoa: {primarySpec.name}
                  </Link>
                )}
              </div>

              <h1 className="specialtyHeroTitle">{dep.name}</h1>

              {summaryText && <p className="specialtyHeroDesc">{summaryText}</p>}
            </div>
          </div>
        </section>

        {/* ── THÂN TRANG 2 CỘT (SIDEBAR TRÁI + NỘI DUNG PHẢI GIỐNG CHUYÊN KHOA) ── */}
        <div className="container specialtyBody">
          <div className="specialtyGrid">
            {/* ── CỘT TRÁI: SIDEBAR THÔNG TIN ĐƠN VỊ & ĐẶT KHÁM ── */}
            <aside className="specialtySidebar">
              {showDepartmentCard && (
                <div className="specialtySideCard">
                  <h3 className="specialtySideTitle">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    Thông tin đơn vị
                  </h3>
                  <ul className="specialtyInfoList">
                    <li className="specialtyInfoItem">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      <div>
                        <span className="specialtyInfoLabel">Tên Khoa / Phòng</span>
                        <div className="specialtyInfoValue">{dep.name}</div>
                      </div>
                    </li>

                    {leaderDisplay && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Trưởng đơn vị</span>
                          <div className="specialtyInfoValue">{leaderDisplay}</div>
                        </div>
                      </li>
                    )}

                    {Array.isArray(dep.deputyLeaders) && dep.deputyLeaders.length > 0 && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Phó trưởng đơn vị</span>
                          <div className="specialtyInfoValue">
                            {dep.deputyLeaders
                              .map((dl: any) => `${dl.title ? `${dl.title} ` : ''}${dl.name}`)
                              .join(' · ')}
                          </div>
                        </div>
                      </li>
                    )}

                    {dep.location && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Vị trí tiếp đón</span>
                          <div className="specialtyInfoValue">{dep.location}</div>
                        </div>
                      </li>
                    )}

                    {(dep.phone || hotline) && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Điện thoại liên hệ</span>
                          <div className="specialtyInfoValue">
                            <a href={`tel:${dep.phone || hotline}`}>{dep.phone || hotline}</a>
                          </div>
                        </div>
                      </li>
                    )}

                    {dep.email && (
                      <li className="specialtyInfoItem">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <div>
                          <span className="specialtyInfoLabel">Email liên hệ</span>
                          <div className="specialtyInfoValue">
                            <a href={`mailto:${dep.email}`}>{dep.email}</a>
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
                    <strong>Tiếp nhận khám BHYT & Cấp cứu</strong>
                    <div style={{ marginTop: '2px', fontSize: '12.5px', whiteSpace: 'pre-line' }}>
                      {noticeText}
                    </div>
                  </div>
                </div>
              )}

              {/* Banner Quảng Cáo / Tiện Ích Tùy Ý (Kế thừa từ Chuyên khoa hoặc nhập riêng) */}
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

            {/* ── CỘT PHẢI: NỘI DUNG CHUYÊN MÔN SÂU (GIỐNG CHUYÊN KHOA) ── */}
            <div className="specialtyMainContent">
              {/* 1. Ảnh bìa Khoa / Phòng (Tự động lấy từ Chuyên khoa nếu chưa tải riêng) */}
              {showCoverImage && coverUrl && (
                <div
                  className={`specialtyCoverBox ${detailCoverFit === 'contain' ? 'isContainMode' : ''}`}
                >
                  <img
                    src={coverUrl}
                    alt={dep.name}
                    className={`specialtyCoverImg ${detailCoverFit === 'contain'
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

              {/* 2. Khối Giới thiệu chuyên môn & Chức năng nhiệm vụ */}
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

                  {showSummaryLead && summaryText && (
                    <p className="specialtySectionLead">{summaryText}</p>
                  )}

                  {richContent ? (
                    <div className="specialtyRichTextWrap">
                      <RichText data={richContent} />
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                      Thông tin chi tiết về chuyên môn đang được cập nhật chuẩn hóa bởi Hội đồng Chuyên môn Bệnh viện Đa khoa Khu vực Thới Lai.
                    </p>
                  )}

                  {!isEmptyRichText(dep.functions) && (
                    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0754a8', marginBottom: '12px' }}>
                        Chức năng – Nhiệm vụ
                      </h3>
                      <div className="specialtyRichTextWrap">
                        <RichText data={dep.functions} />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 3. Khối Dịch vụ & Kỹ thuật mũi nhọn (Kế thừa từ Chuyên khoa hoặc Hoạt động chuyên môn) */}
              {showServicesSection && (richServices || !isEmptyRichText(dep.activities)) && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                      <h2 className="specialtySectionTitle">
                        {richServices ? 'Dịch vụ & Kỹ thuật mũi nhọn' : 'Hoạt động chuyên môn'}
                      </h2>
                    </div>
                  </div>
                  <div className="specialtyRichTextWrap">
                    <RichText data={richServices || dep.activities} />
                  </div>

                  {richServices && !isEmptyRichText(dep.activities) && (
                    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0754a8', marginBottom: '12px' }}>
                        Hoạt động chuyên môn
                      </h3>
                      <div className="specialtyRichTextWrap">
                        <RichText data={dep.activities} />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 4. Khối Đội ngũ Bác sĩ & Nhân sự chuyên môn (Chuẩn Mandate 1 & 2) */}
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
                        <h2 className="specialtySectionTitle">{membersTitle}</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {doctors.length
                            ? `${doctors.length} cán bộ y tế công tác tại đơn vị`
                            : 'Đang cập nhật danh sách nhân sự'}
                        </span>
                      </div>
                    </div>
                    {doctors.length > 0 && (
                      <Link
                        href={`/bac-si?dept=${deptId}`}
                        style={{ fontSize: '13px', fontWeight: 700, color: '#0878d1' }}
                      >
                        Xem tất cả nhân sự →
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
                      Danh sách nhân sự phụ trách đơn vị đang được hoàn thiện hồ sơ điện tử.
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
                          Tài liệu chuyên môn chuẩn y khoa áp dụng tại {dep.name}
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

              {/* 6. Khối Thành tích & Điểm nổi bật (nếu có) */}
              {!isEmptyRichText(dep.achievements) && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="7" />
                          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                      </div>
                      <h2 className="specialtySectionTitle">Thành tích & Điểm nổi bật</h2>
                    </div>
                  </div>
                  <div className="specialtyRichTextWrap">
                    <RichText data={dep.achievements} />
                  </div>
                </section>
              )}

              {/* 7. Khối Chuyên khoa trực thuộc (nếu khoa có nhiều phân khoa con) */}
              {showSpecialties && (
                <section className="specialtyCardSection">
                  <div className="specialtySectionHeader">
                    <div className="specialtySectionTitleWrap">
                      <div className="specialtySectionIcon" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="specialtySectionTitle">Lĩnh vực chuyên khoa sâu</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Các chuyên ngành trực thuộc {dep.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="specialtyRelatedGrid">
                    {subSpecialties.map((s) => (
                      <Link
                        key={s.id}
                        href={`/chuyen-khoa/${s.slug}`}
                        className="specialtyRelatedCard"
                      >
                        <h4 className="specialtyRelatedName">{s.name}</h4>
                        <p className="specialtyRelatedDesc">
                          {s.summary || 'Xem thông tin chi tiết dịch vụ và bác sĩ phụ trách chuyên khoa.'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* 8. Các Khoa / Phòng khác trong bệnh viện */}
              {showRelatedSection && relatedDepts.length > 0 && (
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
                        <h2 className="specialtySectionTitle">Các Khoa / Phòng khác</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Hệ thống khoa lâm sàng, cận lâm sàng và phòng chức năng
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="specialtyRelatedGrid">
                    {relatedDepts.map((item) => (
                      <Link
                        key={item.id}
                        href={`/khoa-phong/${item.slug}`}
                        className="specialtyRelatedCard"
                      >
                        <h4 className="specialtyRelatedName">{item.name}</h4>
                        <p className="specialtyRelatedDesc">
                          {item.summary || 'Xem thông tin chuyên môn và đội ngũ nhân sự tại đơn vị.'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Điều hướng quay lại */}
              <div className="specialtyBackNav">
                <Link href="/khoa-phong" className="specialtyBackBtn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Xem tất cả Khoa / Phòng</span>
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
