import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { HomeNewsTabs } from '@/components/HomeNewsTabs'
import { HomeScienceTabs } from '@/components/HomeScienceTabs'
import { HomePatientServiceTabs } from '@/components/HomePatientServiceTabs'
import { HomeProcurementTabs } from '@/components/HomeProcurementTabs'
import { HomeLinkedWebsitesTabs } from '@/components/HomeLinkedWebsitesTabs'
import { HomePartnerBanners } from '@/components/HomePartnerBanners'
import { HomeHealthWarnings } from '@/components/HomeHealthWarnings'
import { HomeLegalDissemination } from '@/components/HomeLegalDissemination'
import { RichText } from '@/components/RichText'
import { ScheduleExplorer } from '@/components/ScheduleExplorer'
import { VaccinationTabs } from '@/components/VaccinationTabs'
import { HeroBannerCarousel } from '@/components/HeroBannerCarousel'
import { FeaturedContentCarousel } from '@/components/FeaturedContentCarousel'
import { AdvancedTechniquesCarousel } from '@/components/AdvancedTechniquesCarousel'
import { OurExpertsCarousel } from '@/components/OurExpertsCarousel'
import { OurExpertsFeaturedGrid } from '@/components/OurExpertsFeaturedGrid'
import { SpecialtiesCarousel } from '@/components/SpecialtiesCarousel'
import { CustomCardsCarousel } from '@/components/CustomCardsCarousel'
import { QuickLinksCardsSlider } from '@/components/QuickLinksCardsSlider'
import { HomeScrollSnapHandler } from '@/components/HomeScrollSnapHandler'
import { getCMS, getGlobal, getHomepage } from '@/lib/payload'
import { mediaFormat, mediaLabel, mediaUrl } from '@/lib/media'
import { categoryName, getDefaultContentMedia, scientificActivityGroupName } from '@/lib/defaultMedia'
import { resolveBookingConfig } from '@/lib/booking'
import { getCanThoHealthDeptNews, FALLBACK_ITEMS } from '@/lib/canthoHealthDept'
import { fetchAutoLinkedNews } from '@/lib/autoLinkedNews'
import type { CSSProperties } from 'react'

export const revalidate = 0
export const dynamic = 'force-dynamic'

function databaseErrorDetails(error: unknown) {
  const seen = new Set<unknown>()
  let current: any = error
  while (current?.cause && !seen.has(current.cause)) {
    seen.add(current)
    current = current.cause
  }

  return {
    name: current?.name,
    code: current?.code,
    message: current?.message ?? String(current ?? error),
    detail: current?.detail,
    table: current?.table,
    column: current?.column,
  }
}

function HomeGlyph({ name }: { name?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'calendar') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="3" {...common} />
      <line x1="16" y1="2" x2="16" y2="6" {...common} />
      <line x1="8" y1="2" x2="8" y2="6" {...common} />
      <line x1="3" y1="10" x2="21" y2="10" {...common} />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
  if (name === 'doctor') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 3h15v4a4.5 4.5 0 0 1-9 0" {...common} />
      <circle cx="12" cy="7" r="4" {...common} />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...common} />
      <path d="M19 12v3a3 3 0 0 1-6 0v-1" {...common} />
      <circle cx="13" cy="15" r="1" fill="currentColor" />
    </svg>
  )
  if (name === 'hospital') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" {...common} />
      <path d="M12 7v6M9 10h6" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M9 21v-4h6v4" {...common} />
    </svg>
  )
  if (name === 'price') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" {...common} />
      <path d="M12 6v12M15 9.5a3 3 0 0 0-3-2.5h-1a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5H11a3 3 0 0 1-3-2.5" {...common} />
    </svg>
  )
  if (name === 'insurance') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l8 3.6v6.4c0 5.2-3.4 9.8-8 11-4.6-1.2-8-5.8-8-11V5.6L12 2z" {...common} />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (name === 'map') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="10" r="3" {...common} />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" {...common} />
    </svg>
  )
  if (name === 'phone') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" {...common} />
    </svg>
  )
  if (name === 'document') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...common} />
      <polyline points="14 2 14 8 20 8" {...common} />
      <line x1="16" y1="13" x2="8" y2="13" {...common} />
      <line x1="16" y1="17" x2="8" y2="17" {...common} />
      <line x1="10" y1="9" x2="8" y2="9" {...common} />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" {...common} />
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  )
}


export default async function HomePage() {
  let home: any = {}
  let news: any[] = []
  let notices: any[] = []
  let procurement: any[] = []
  let documents: any[] = []
  let clinicalProtocols: any[] = []
  let doctors: any[] = []
  let departments: any[] = []
  let specialties: any[] = []
  let services: any[] = []
  let schedules: any[] = []
  let vaccinationSchedules: any[] = []
  let vaccines: any[] = []
  let vaccinePrices: any[] = []
  let contentSections: any[] = []
  let customPosts: any[] = []
  let advancedTechniques: any[] = []
  let ourExpertsList: any[] = []
  let scientificActivities: any[] = []
  let scientificActivityGroups: any[] = []
  let healthWarnings: any[] = []
  let canthoHealthNews: any[] = []
  let siteSettings: any = {}
  let displaySettings: any = {}
  let quickLinksSettings: any = {}
  let medproSettings: any = {}
  let defaultMedia: any = { news: '/default-content/news.svg', notices: '/default-content/notices.svg', procurement: '/default-content/procurement.svg' }
  let totals = { news: 0, notices: 0, doctors: 0, departments: 0, services: 0 }

  try {
    const [payload, homepage, settings, display, contentDefaults, quickSettings, bookingSettings] = await Promise.all([
      getCMS(),
      getHomepage().catch((error: unknown) => { console.error('[HomePage] getHomepage error:', databaseErrorDetails(error)); return {} }),
      getGlobal('site-settings').catch((error: unknown) => { console.error('[HomePage] site-settings error:', databaseErrorDetails(error)); return {} }),
      getGlobal('display-settings').catch(() => ({})),
      getDefaultContentMedia().catch(() => ({ news: '/default-content/news.svg', notices: '/default-content/notices.svg', procurement: '/default-content/procurement.svg' })),
      getGlobal('quick-links-settings').catch(() => ({})),
      getGlobal('medpro-settings').catch(() => ({})),
    ])
    home = homepage || {}
    siteSettings = settings || {}
    displaySettings = display || {}
    defaultMedia = contentDefaults
    quickLinksSettings = quickSettings || {}
    medproSettings = bookingSettings || {}
    canthoHealthNews = []

    const [newsResult, noticeResult, procurementResult, documentResult, clinicalProtocolsResult, doctorResult, departmentResult, specialtyResult, serviceResult, scheduleResult, vaccinationScheduleResult, vaccineResult, vaccinePriceResult, contentSectionResult, customPostResult, advancedTechniquesResult, ourExpertsResult, scientificActivitiesResult, scientificActivityGroupsResult, healthWarningsResult] = await Promise.all([
      payload.find({ collection: 'news', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 100, depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'notices', where: { and: [{ _status: { equals: 'published' } }, { showOnHome: { equals: true } }] }, sort: ['-publishedAt', '-createdAt'], limit: 50, depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'procurement', where: { _status: { equals: 'published' } }, sort: ['-publishedAt', '-createdAt'], limit: 100, depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'documents', sort: '-issuedAt', limit: 50, depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'clinical-protocols' as any, sort: '-issuedAt', limit: 12, depth: 2 }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'doctors', where: { active: { equals: true } }, limit: 50, sort: ['order', 'name'], depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'departments', limit: 100, sort: 'name', depth: 0 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'specialties', where: { active: { equals: true } }, limit: 100, sort: 'order', depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'services', where: { active: { equals: true } }, limit: 8, sort: 'name', depth: 0 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'schedules', where: { active: { equals: true } }, limit: 100, sort: '-createdAt', depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'vaccinationSchedules', where: { active: { equals: true } }, limit: 200, sort: '-date', depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'vaccines', where: { active: { equals: true } }, limit: 200, sort: 'name', depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'vaccinePrices', where: { active: { equals: true } }, limit: 1000, sort: '-effectiveFrom', depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'content-sections', where: { and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] }, limit: 100, sort: 'title', depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'custom-posts', where: { _status: { equals: 'published' } }, limit: 300, sort: '-publishedAt', depth: 2 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'advanced-techniques', where: { active: { equals: true } }, limit: 50, sort: ['order', 'title'], depth: 1 }).catch(() => ({ docs: [], totalDocs: 0 })),
      payload.find({ collection: 'our-experts', where: { active: { equals: true } }, limit: 50, sort: ['order', 'name'], depth: 2 }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'scientific-activities', where: { _status: { equals: 'published' } }, limit: 100, sort: ['-featured', '-publishedAt'], depth: 1 }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'scientific-activity-groups', where: { active: { equals: true } }, limit: 100, sort: ['order', 'name'], depth: 0 }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'health-warnings' as any, where: { and: [{ _status: { equals: 'published' } }, { showOnHome: { equals: true } }] }, sort: ['-pinned', '-publishedAt', '-createdAt'], limit: 20, depth: 2 }).catch(() => ({ docs: [] })),
    ])
    news = newsResult.docs as any[]
    notices = noticeResult.docs as any[]
    procurement = procurementResult.docs as any[]
    documents = documentResult.docs as any[]
    clinicalProtocols = (clinicalProtocolsResult?.docs || []) as any[]
    doctors = doctorResult.docs as any[]
    departments = departmentResult.docs as any[]
    specialties = specialtyResult.docs as any[]
    services = serviceResult.docs as any[]
    schedules = scheduleResult.docs as any[]
    vaccinationSchedules = vaccinationScheduleResult.docs as any[]
    vaccines = vaccineResult.docs as any[]
    vaccinePrices = vaccinePriceResult.docs as any[]
    contentSections = contentSectionResult.docs as any[]
    customPosts = customPostResult.docs as any[]
    advancedTechniques = advancedTechniquesResult.docs as any[]
    ourExpertsList = (ourExpertsResult?.docs || []) as any[]
    scientificActivities = (scientificActivitiesResult?.docs || []) as any[]
    scientificActivityGroups = (scientificActivityGroupsResult?.docs || []) as any[]
    healthWarnings = (healthWarningsResult?.docs || []) as any[]
    totals = { news: newsResult.totalDocs, notices: noticeResult.totalDocs, doctors: doctorResult.totalDocs, departments: departmentResult.totalDocs, services: serviceResult.totalDocs }
  } catch (err) {
    console.error('[HomePage] Error loading initial data:', err)
  }

  // Tải dữ liệu các chuyên mục Dịch vụ Người bệnh (Gói khám, Quy trình, Nội trú, Sơ đồ, Cổng người bệnh, Tiêm chủng)
  let checkupPackagesData: any = null
  let examinationFlowData: any = null
  let inpatientGuideData: any = null
  let hospitalMapData: any = null
  let patientPortalData: any = null
  let vaxSettingsData: any = null

  try {
    const [pkgRes, flowRes, inpatRes, mapRes, portalRes, vaxRes] = await Promise.all([
      getGlobal('checkup-packages-settings').catch(() => null),
      getGlobal('examination-flow-settings').catch(() => null),
      getGlobal('inpatient-guide-settings').catch(() => null),
      getGlobal('hospital-map-settings').catch(() => null),
      getGlobal('patient-portal-settings').catch(() => null),
      getGlobal('vaccination-settings' as any).catch(() => null),
    ])
    checkupPackagesData = pkgRes
    examinationFlowData = flowRes
    inpatientGuideData = inpatRes
    hospitalMapData = mapRes
    patientPortalData = portalRes
    vaxSettingsData = vaxRes
  } catch (e) {
    console.error('[HomePage] Error loading patient care globals:', e)
  }

  const booking = resolveBookingConfig(medproSettings, siteSettings)
  const medpro = booking.url
  const builtInHeroImage = '/banners/banner-bvdk-thoi-lai-1920x600.png'
  const builtInHeroMobileImage = '/banners/banner-bvdk-thoi-lai-mobile.png'
  const parseBannerDirectives = (descText?: string) => {
    const raw = String(descText || '')
    const ratioMatch = raw.match(/\[ratio:([0-9/.:]+)\]/i)
    const heightMatch = raw.match(/\[height:([0-9]+(?:px|vh)?)\]/i)
    const fitMatch = raw.match(/\[fit:(cover|contain|fill)\]/i)
    const cleaned = raw
      .replace(/\[ratio:[0-9/.:]+\]/gi, '')
      .replace(/\[height:[0-9]+(?:px|vh)?\]/gi, '')
      .replace(/\[fit:(?:cover|contain|fill)\]/gi, '')
      .trim()
    return {
      ratio: ratioMatch ? ratioMatch[1].replace(':', ' / ') : undefined,
      height: heightMatch ? (heightMatch[1].endsWith('px') || heightMatch[1].endsWith('vh') ? heightMatch[1] : `${heightMatch[1]}px`) : undefined,
      fit: fitMatch ? fitMatch[1].toLowerCase() as 'cover' | 'contain' | 'fill' : undefined,
      cleanDescription: cleaned,
    }
  }

  const configuredHeroSlides = (Array.isArray(home?.banners) ? home.banners : [])
    .filter((item: any) => item.visible !== false && mediaUrl(item.desktopImage))
    .map((item: any, index: number) => {
      const directives = parseBannerDirectives(item.description)
      return {
        id: String(item.id || index),
        desktopUrl: mediaUrl(item.desktopImage),
        mobileUrl: mediaUrl(item.mobileImage) || builtInHeroMobileImage,
        title: item.title,
        description: directives.cleanDescription,
        customRatio: directives.ratio,
        customHeight: directives.height,
        customFit: directives.fit,
      }
    })
  const fallbackHeroImage = mediaUrl(home?.hero?.desktopImage) || builtInHeroImage
  const fallbackHeroMobile = mediaUrl(home?.hero?.mobileImage) || builtInHeroMobileImage
  const heroSlides = configuredHeroSlides.length
    ? configuredHeroSlides
    : [{ id: 'default', desktopUrl: fallbackHeroImage, mobileUrl: fallbackHeroMobile, title: home?.hero?.title }]
  const showHeroBanners = home?.showHeroBanners !== false

  const fallbackQuickLinks = [
    { title: 'Đặt lịch khám', description: 'Đặt lịch nhanh chóng', url: medpro, icon: 'calendar' },
    { title: 'Lịch khám bệnh', description: 'Xem lịch khám bác sĩ', url: '/lich-kham', icon: 'doctor' },
    { title: 'Lịch tiêm chủng', description: 'Lịch tiêm theo ngày', url: '/tiem-chung', icon: 'insurance' },
    { title: 'Bảng giá dịch vụ', description: 'Tra cứu chi phí', url: '/bang-gia', icon: 'price' },
    { title: 'Thông báo', description: 'Thông tin mới nhất', url: '/thong-bao', icon: 'hospital' },
    { title: 'Đấu thầu – Mua sắm', description: 'Công khai, minh bạch', url: '/dau-thau-mua-sam', icon: 'map' },
    { title: 'Văn bản – Tài liệu', description: 'Tra cứu tài liệu', url: '/van-ban', icon: 'document' },
    { title: 'Liên hệ', description: 'Hỗ trợ và phản hồi', url: '/lien-he', icon: 'phone' },
  ]
  const configuredQuickLinks = Array.isArray(quickLinksSettings?.items)
    ? quickLinksSettings.items
    : (Array.isArray(home?.quickLinks) ? home.quickLinks : fallbackQuickLinks)
  const quickLinksEnabled = quickLinksSettings?.enabled !== false
  const quickLinks = configuredQuickLinks
    .filter((item: any) => item?.visible !== false && (booking.enabled || !String(item?.title || '').toLowerCase().includes('đặt lịch')))
    .map((item: any) => booking.useFacilityBooking && String(item?.title || '').toLowerCase().includes('đặt lịch') ? { ...item, url: booking.url, openNewTab: false } : item)
    .slice(0, 12)
  const configuredStats = Array.isArray(home?.stats) ? home.stats.filter((item: any) => item?.value && item?.label) : []
  const stats = configuredStats.length ? configuredStats.slice(0, 4) : [
    { value: `${totals.departments || 20}+`, label: 'Khoa & Phòng' },
    { value: `${totals.doctors || 100}+`, label: 'Bác sĩ, nhân viên' },
    { value: `${totals.services || 250}+`, label: 'Dịch vụ y tế' },
    { value: `${totals.news + totals.notices || 100}+`, label: 'Tin bài công khai' },
  ]

  const rawSections = Array.isArray(home?.sections) && home.sections.length > 0 ? [...home.sections] : []
  // Nếu database đã lưu sections từ trước nhưng chưa có advanced-techniques, tự động chèn vào để hiển thị ngay
  if (!rawSections.some((s: any) => s?.type === 'advanced-techniques')) {
    const defaultTechSection = {
      type: 'advanced-techniques',
      eyebrow: 'CHUYÊN KHOA & CÔNG NGHỆ Y TẾ',
      title: 'Kỹ thuật chuyên sâu',
      description: 'Tiên phong ứng dụng các kỹ thuật cao, trang thiết bị hiện đại phục vụ chăm sóc và điều trị.',
      visible: true,
      techniqueItemsPerView: 3,
      techniqueAutoplaySeconds: 5,
      cardBarBgColor: '#f0f7fd',
      cardBarTextColor: '#0754a8',
      techniqueItems: [],
    }
    const featuredIdx = rawSections.findIndex((s: any) => s?.type === 'featured-news' || s?.type === 'news')
    if (featuredIdx >= 0) {
      rawSections.splice(featuredIdx + 1, 0, defaultTechSection)
    } else {
      rawSections.unshift(defaultTechSection)
    }
  }

  // Nếu database đã lưu sections từ trước nhưng chưa có our-experts, tự động chèn vào để hiển thị ngay
  if (!rawSections.some((s: any) => s?.type === 'our-experts')) {
    const defaultExpertsSection = {
      type: 'our-experts',
      eyebrow: 'ĐỘI NGŨ Y BÁC SĨ',
      title: 'Chuyên gia của chúng tôi',
      description: 'Đội ngũ bác sĩ giàu kinh nghiệm, chuyên môn sâu, luôn tận tâm vì sức khỏe người bệnh.',
      visible: true,
      expertItemsPerView: 4,
      expertAutoplaySeconds: 5,
      expertCardBgColor: '#f0f7fd',
      expertCardTextColor: '#0754a8',
      expertItems: [],
    }
    const techIdx = rawSections.findIndex((s: any) => s?.type === 'advanced-techniques')
    if (techIdx >= 0) {
      rawSections.splice(techIdx + 1, 0, defaultExpertsSection)
    } else {
      rawSections.push(defaultExpertsSection)
    }
  }

  // Tự động sắp xếp vị trí hiển thị đẹp mắt: nếu advanced-techniques và our-experts đang nằm ở cuối cùng (do được thêm mới sau),
  // di chuyển chúng lên ngay sau mục Tin tức nổi bật (featured-news) để người dùng dễ nhìn thấy ngay khi vào trang chủ
  const techSectionIdx = rawSections.findIndex((s: any) => s?.type === 'advanced-techniques')
  if (techSectionIdx > 2) {
    const [techSec] = rawSections.splice(techSectionIdx, 1)
    const fIdx = rawSections.findIndex((s: any) => s?.type === 'featured-news' || s?.type === 'news')
    rawSections.splice(fIdx >= 0 ? fIdx + 1 : 1, 0, techSec)
  }
  const expertSectionIdx = rawSections.findIndex((s: any) => s?.type === 'our-experts')
  if (expertSectionIdx > 3) {
    const [expSec] = rawSections.splice(expertSectionIdx, 1)
    const tIdx = rawSections.findIndex((s: any) => s?.type === 'advanced-techniques')
    rawSections.splice(tIdx >= 0 ? tIdx + 1 : 2, 0, expSec)
  }

  const configuredSections = rawSections
  const sectionDefaults: Record<string, { eyebrow: string; title: string; description?: string; order: number }> = {
    'featured-news': { eyebrow: 'TIN TỨC', title: 'Tin tức & hoạt động', description: 'Cập nhật hoạt động nổi bật và thông tin chuyên môn mới nhất.', order: 0 },
    'advanced-techniques': { eyebrow: '', title: 'Kỹ thuật chuyên sâu', description: '', order: 1 },
    'our-experts': { eyebrow: 'ĐỘI NGŨ Y BÁC SĨ', title: 'Chuyên gia của chúng tôi', description: '', order: 2 },
    'news-portal': { eyebrow: 'CỔNG THÔNG TIN BỆNH VIỆN', title: 'Các chuyên mục tin tức', order: 3 },
    'patient-portal-services': { eyebrow: 'DÀNH CHO NGƯỜI BỆNH', title: 'Tiện ích & Dịch vụ y tế', description: 'Chủ động tra cứu gói khám sức khỏe, quy trình khám chữa bệnh và các tiện ích nội trú tại bệnh viện.', order: 3.5 },
    'vaccination-portal-services': { eyebrow: 'LỊCH TIÊM CHỦNG', title: 'Cổng thông tin & Lịch tiêm ngừa', description: 'Tra cứu danh mục vắc xin, các đợt tiêm chủng định kỳ và thông báo tiêm chủng mới nhất.', order: 7.5 },
    organization: { eyebrow: 'CHUYÊN KHOA', title: 'Hệ thống chuyên khoa', description: 'Đội ngũ tận tâm, quy trình chuyên nghiệp và trang thiết bị phù hợp.', order: 3 },
    notices: { eyebrow: 'THÔNG BÁO', title: 'Thông báo mới', description: 'Thông tin dành cho người bệnh và cộng đồng.', order: 4 },
    procurement: { eyebrow: 'CÔNG KHAI', title: 'Đấu thầu – Mua sắm', description: 'Thông tin mời thầu và kết quả mua sắm.', order: 5 },
    schedules: { eyebrow: 'LỊCH KHÁM BỆNH', title: 'Chủ động trước khi đến khám', description: 'Tra cứu bác sĩ, chuyên khoa, thời gian và phòng khám.', order: 6 },
    vaccinations: { eyebrow: 'LỊCH TIÊM CHỦNG', title: 'Thông tin tiêm ngừa', description: 'Lịch tiêm, đợt tiêm và danh mục vắc xin tại bệnh viện.', order: 7 },
    science: { eyebrow: 'HOẠT ĐỘNG NỔI BẬT', title: 'Chuyên môn – Đào tạo', order: 8 },
    introduction: { eyebrow: home?.intro?.eyebrow || 'BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI', title: home?.intro?.title || 'Tận tâm chăm sóc sức khỏe cộng đồng', description: home?.intro?.description, order: 9 },
    documents: { eyebrow: 'TÀI LIỆU CÔNG KHAI', title: 'Văn bản mới', description: 'Quyết định, biểu mẫu và tài liệu được cập nhật từ hệ thống quản trị.', order: 10 },
    'partner-banners': { eyebrow: 'LIÊN KẾT WEBSITE', title: 'Cổng thông tin & Đơn vị Liên kết', description: 'Liên kết nhanh đến các cổng thông tin điện tử, cơ quan quản lý và đối tác y tế.', order: 11 },
    'health-warnings': { eyebrow: 'CẢNH BÁO Y TẾ & CỘNG ĐỒNG', title: 'Cảnh báo khẩn cấp & Khuyến cáo sức khỏe', description: 'Thông tin cảnh báo dịch bệnh, ngộ độc thực phẩm, phòng chống lừa đảo và các khuyến cáo khẩn cấp từ Bệnh viện và Ngành Y tế.', order: 3.2 },
    'legal-dissemination': { eyebrow: 'PHỔ BIẾN VĂN BẢN PHÁP LUẬT', title: 'Tuyên truyền & Phổ biến chính sách pháp luật y tế', description: 'Hệ thống các Luật, Nghị định của Chính phủ, Thông tư của Bộ Y tế và văn bản chỉ đạo điều hành về công tác y tế.', order: 10.5 },
  }
  const sectionConfig = (key: string) => {
    const aliases: Record<string, string[]> = { 'featured-news': ['news'] }
    const index = configuredSections.findIndex((item: any) => item?.type === key || aliases[key]?.includes(item?.type))
    const custom = index >= 0 ? configuredSections[index] : {}
    return { ...sectionDefaults[key], ...custom, order: index >= 0 ? index : sectionDefaults[key].order }
  }
  const organizationConfig = sectionConfig('organization') as any
  const introImage = mediaUrl(organizationConfig?.organizationImage || home?.intro?.image, 'article') || '/banners/banner-benh-vien.png'
  const medproCard = organizationConfig?.organizationMedpro || {}
  const medproCardUrl = medproCard.buttonUrl || medpro
  const featuredInterval = Math.max(2500, Number(sectionConfig('featured-news')?.carouselSeconds || 4.5) * 1000)
  const featuredItemLimit = Math.min(40, Math.max(4, Number(sectionConfig('featured-news')?.featuredItemLimit || 16)))

  const sectionStyle = (key: string) => {
    const item = sectionConfig(key)
    return {
      order: item.order,
      display: item.visible === false ? 'none' : undefined,
      '--section-eyebrow-color': item.eyebrowColor || undefined,
      '--section-title-color': item.titleColor || undefined,
      '--section-description-color': item.descriptionColor || undefined,
      '--section-background': item.backgroundColor || undefined,
      '--section-eyebrow-size': item.eyebrowSize ? `${item.eyebrowSize}px` : undefined,
      '--section-title-size': item.titleSize ? `${item.titleSize}px` : undefined,
      '--section-description-size': item.descriptionSize ? `${item.descriptionSize}px` : undefined,
      '--section-font-family': item.fontFamily || undefined,
      '--section-padding-top': item.paddingTop !== null && item.paddingTop !== undefined ? `${item.paddingTop}px` : undefined,
      '--section-padding-bottom': item.paddingBottom !== null && item.paddingBottom !== undefined ? `${item.paddingBottom}px` : undefined,
      '--section-content-width': item.contentWidth ? `${item.contentWidth}px` : undefined,
      '--section-heading-gap': item.headingGap !== null && item.headingGap !== undefined ? `${item.headingGap}px` : undefined,
    } as CSSProperties
  }
  const customSectionStyle = (item: any, index: number) => ({
    order: index,
    display: item.visible === false ? 'none' : undefined,
    '--section-eyebrow-color': item.eyebrowColor || undefined,
    '--section-title-color': item.titleColor || undefined,
    '--section-description-color': item.descriptionColor || undefined,
    '--section-background': item.backgroundColor || undefined,
    '--section-eyebrow-size': item.eyebrowSize ? `${item.eyebrowSize}px` : undefined,
    '--section-title-size': item.titleSize ? `${item.titleSize}px` : undefined,
    '--section-description-size': item.descriptionSize ? `${item.descriptionSize}px` : undefined,
    '--section-font-family': item.fontFamily || undefined,
    '--section-padding-top': item.paddingTop !== null && item.paddingTop !== undefined ? `${item.paddingTop}px` : undefined,
    '--section-padding-bottom': item.paddingBottom !== null && item.paddingBottom !== undefined ? `${item.paddingBottom}px` : undefined,
    '--section-content-width': item.contentWidth ? `${item.contentWidth}px` : undefined,
  } as CSSProperties)

  const homeEmergencySchedules = schedules.filter(item => item.mode === 'emergency').map(item => ({ id: item.id, title: item.title, summary: item.summary, note: item.note, emergencyWeekStart: item.emergencyWeekStart, emergencyWeekEnd: item.emergencyWeekEnd, imageUrl: mediaUrl(item.coverImage || item.scheduleImage) || defaultMedia.schedules, href: `/lich-kham/${item.id}` }))
  const homeNurseSchedules = schedules.filter(item => item.mode === 'nurse' || item.dailyScheduleType === 'nurse').map(item => ({ id: item.id, title: item.title, summary: item.summary || item.nurseGeneralNote, date: item.date, note: item.note || item.nurseGeneralNote, imageUrl: mediaUrl(item.coverImage || item.scheduleImage) || defaultMedia.schedules, href: `/lich-kham/${item.id}` }))
  const homeDailySchedules = schedules.filter(item => (!item.mode || item.mode === 'daily') && item.dailyScheduleType !== 'nurse').map(item => ({ id: item.id, title: item.title, summary: item.summary, doctor: item.doctor?.name || item.dailyAssignments?.[0]?.doctor?.name, department: item.department?.name || item.dailyAssignments?.[0]?.department?.name, date: item.date, startTime: item.startTime || item.dailyAssignments?.[0]?.startTime, endTime: item.endTime || item.dailyAssignments?.[0]?.endTime, room: item.room || item.dailyAssignments?.[0]?.room, note: item.note, imageUrl: mediaUrl(item.coverImage) || defaultMedia.schedules, href: `/lich-kham/${item.id}` }))
  const homeWeeklySchedules = schedules.filter(item => item.mode === 'weekly').map(item => ({ id: item.id, title: item.title, summary: item.summary, weekStart: item.weekStart, weekEnd: item.weekEnd, note: item.note, imageUrl: mediaUrl(item.coverImage) || defaultMedia.schedules, slots: (item.weeklySlots || []).map((slot: any) => ({ id: slot.id, dayOfWeek: slot.dayOfWeek, doctor: slot.doctor?.name || 'Bác sĩ', department: slot.department?.name || '', startTime: slot.startTime, endTime: slot.endTime, room: slot.room, note: slot.note })), href: `/lich-kham/${item.id}` }))
  const homeAttachedSchedules = schedules.filter(item => item.mode === 'attachment').map(item => ({ id: item.id, title: item.title, summary: item.summary, note: item.note, validFrom: item.validFrom, validTo: item.validTo, imageUrl: mediaUrl(item.coverImage || item.scheduleImage) || defaultMedia.schedules, fileUrl: mediaUrl(item.scheduleFile), fileName: mediaLabel(item.scheduleFile), fileFormat: mediaFormat(item.scheduleFile), href: `/lich-kham/${item.id}` }))
  const configuredScheduleOrder = (sectionConfig('schedules')?.scheduleTabOrder || []).filter((tab: any) => tab.visible !== false)
  const defaultHomeScheduleTabs = [
    { label: 'Lịch trực cấp cứu', kind: 'emergency', tab: 'emergency', visible: true },
    { label: 'Lịch điều dưỡng', kind: 'nurse', tab: 'nurse', visible: true },
    { label: 'Lịch khám bác sĩ', kind: 'daily', tab: 'daily', visible: true },
    { label: 'Lịch khám tuần', kind: 'weekly', tab: 'weekly', visible: true },
    { label: 'Lịch đính kèm', kind: 'attachments', tab: 'attachments', visible: true },
  ]
  const rawScheduleTabs = configuredScheduleOrder.length ? configuredScheduleOrder : defaultHomeScheduleTabs
  // Tự động bổ sung tab 'emergency' và tab 'nurse' nếu chưa có trong cấu hình tùy chỉnh
  let mergedScheduleTabs = [...rawScheduleTabs]
  if (!mergedScheduleTabs.some((t: any) => (t.tab || t.kind) === 'emergency') && homeEmergencySchedules.length > 0) {
    mergedScheduleTabs.unshift({ label: 'Lịch trực cấp cứu', kind: 'emergency', tab: 'emergency', visible: true })
  }
  if (!mergedScheduleTabs.some((t: any) => (t.tab || t.kind) === 'nurse') && homeNurseSchedules.length > 0) {
    const dailyIdx = mergedScheduleTabs.findIndex((t: any) => (t.tab || t.kind) === 'daily')
    if (dailyIdx >= 0) {
      mergedScheduleTabs.splice(dailyIdx + 1, 0, { label: 'Lịch điều dưỡng', kind: 'nurse', tab: 'nurse', visible: true })
    } else {
      mergedScheduleTabs.push({ label: 'Lịch điều dưỡng', kind: 'nurse', tab: 'nurse', visible: true })
    }
  }

  const scheduleTabOrder = mergedScheduleTabs.filter((item: any) => item.visible !== false && (item.tab || item.kind)).map((item: any) => item.tab || item.kind)
  const scheduleTabs = mergedScheduleTabs.filter((tab: any) => tab.visible !== false).map((tab: any, tabIndex: number) => ({
    label: tab.label?.trim(),
    kind: tab.tab || tab.kind,
    manualItems: (tab.manualItems || []).filter((entry: any) => entry.title?.trim()).map((entry: any, itemIndex: number) => ({ id: entry.id || `manual-schedule-${tabIndex}-${itemIndex}`, title: entry.title, summary: entry.description, imageUrl: mediaUrl(entry.image, 'card'), href: entry.url || '/lich-kham' })),
  })).filter((tab: any) => tab.label || tab.kind || tab.manualItems.length)

  const nowForVaccinePrice = new Date()
  const currentVaccinePrice = new Map<string, number>()
  for (const price of vaccinePrices) {
    const vaccineId = typeof price.vaccine === 'object' ? String(price.vaccine?.id || '') : String(price.vaccine || '')
    if (!vaccineId || currentVaccinePrice.has(vaccineId)) continue
    const from = price.effectiveFrom ? new Date(price.effectiveFrom) : null
    const to = price.effectiveTo ? new Date(price.effectiveTo) : null
    if (from && from > nowForVaccinePrice) continue
    if (to && to < nowForVaccinePrice) continue
    if (typeof price.price === 'number') currentVaccinePrice.set(vaccineId, price.price)
  }
  const homeVaccinationAnnouncements = vaccinationSchedules.filter(item => item.scheduleKind === 'announcement').map(item => ({ id: item.id, title: item.title, summary: item.summary, content: item.detailContent, imageUrl: mediaUrl(item.scheduleImage) || defaultMedia.vaccinations, fileUrl: mediaUrl(item.scheduleFile), fileName: mediaLabel(item.scheduleFile), fileFormat: mediaFormat(item.scheduleFile), href: `/tiem-chung/${item.id}?type=schedule` }))
  const homeVaccinationCampaigns = vaccinationSchedules.filter(item => item.scheduleKind !== 'announcement').map(item => ({ id: item.id, title: item.title, summary: item.summary, target: item.target, date: item.date, endDate: item.endDate, startTime: item.startTime, endTime: item.endTime, location: item.location, registrationUrl: item.registrationUrl, note: item.note, imageUrl: mediaUrl(item.scheduleImage) || defaultMedia.vaccinations, href: `/tiem-chung/${item.id}?type=schedule` }))
  const homeVaccines = vaccines.map(item => {
    const resolvedFee = typeof item.price === 'number' ? item.price : currentVaccinePrice.get(String(item.id))
    return {
      id: item.id,
      code: item.code,
      slug: item.slug,
      title: item.name,
      summary: item.summary,
      manufacturer: item.manufacturer,
      origin: item.origin,
      prevents: item.prevents,
      targetGroup: item.targetGroup || 'all',
      ageGroup: item.ageGroup,
      availability: item.availability,
      fee: resolvedFee,
      imageUrl: mediaUrl(item.image) || defaultMedia.vaccinations,
      registrationUrl: item.registrationUrl,
      href: `/tiem-chung/${item.id}?type=vaccine`,
    }
  })
  const vaccinationTabOrder = (sectionConfig('vaccinations')?.vaccinationTabOrder || []).filter((item: any) => item.visible !== false && item.tab).map((item: any) => item.tab)
  const contentTabsFor = (key: 'news-portal' | 'science') => (sectionConfig(key)?.contentTabs || []).map((tab: any, tabIndex: number) => ({
    label: tab.label?.trim() || `Chuyên mục ${tabIndex + 1}`,
    categories: (tab.values || []).map((entry: any) => entry.value?.trim()).filter(Boolean),
    manualItems: (tab.manualItems || []).filter((entry: any) => entry.title?.trim()).map((entry: any, itemIndex: number) => ({ id: entry.id || `manual-${tabIndex}-${itemIndex}`, title: entry.title, slug: '', excerpt: entry.description, coverUrl: mediaUrl(entry.image, 'card'), href: entry.url || '/tin-tuc' })),
  })).filter((tab: any) => tab.label || tab.categories.length || tab.manualItems.length)
  const vaccinationTabs = (sectionConfig('vaccinations')?.vaccinationTabOrder || []).filter((tab: any) => tab.visible !== false).map((tab: any, tabIndex: number) => ({
    label: tab.label?.trim(),
    kind: tab.tab,
    manualItems: (tab.manualItems || []).filter((entry: any) => entry.title?.trim()).map((entry: any, itemIndex: number) => ({ id: entry.id || `manual-vaccine-${tabIndex}-${itemIndex}`, title: entry.title, summary: entry.description, imageUrl: mediaUrl(entry.image, 'card'), href: entry.url || '/tiem-chung' })),
  })).filter((tab: any) => tab.label || tab.kind || tab.manualItems.length)


  const fnConfig = sectionConfig('featured-news') as any
  const fnSources = (Array.isArray(fnConfig?.featuredSources) && fnConfig.featuredSources.length > 0)
    ? fnConfig.featuredSources
    : [
        { source: 'news', limit: 8, enabled: true },
        { source: 'notices', limit: 6, enabled: true },
        { source: 'procurement', limit: 4, enabled: true },
        { source: 'schedules', limit: 0, enabled: false },
      ]
  const fnFilterMode = fnConfig?.featuredFilterMode || 'all'

  const dynamicFeaturedItems: any[] = []

  for (const src of fnSources) {
    if (src.enabled === false) continue
    const limit = Math.max(1, Number(src.limit || 6))
    const customBadge = (src.customBadge || '').trim()

    if (src.source === 'news') {
      let filteredNews = news
      if (fnFilterMode === 'only-featured') {
        filteredNews = filteredNews.filter((item: any) => item.featured === true)
      }
      const items = filteredNews.slice(0, limit).map((item: any) => ({
        id: `news-${item.id}`,
        title: item.title,
        excerpt: item.excerpt,
        image: mediaUrl(item.cover || item.seoImage) || defaultMedia.news,
        imageFit: item.coverFit || fnConfig?.featuredCardFit || 'cover',
        imagePosition: item.coverPosition ? (item.coverPosition === 'center' ? 'center center' : (item.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : undefined,
        href: `/tin-tuc/${item.slug}`,
        kind: customBadge || (typeof item.categoryRef === 'object' && item.categoryRef?.name ? item.categoryRef.name.toUpperCase() : (item.category ? item.category.toUpperCase() : 'TIN TỨC')),
        dateValue: item.publishedAt || item.updatedAt,
        date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    } else if (src.source === 'news-category') {
      const targetCatId = typeof src.categoryRef === 'object' ? String(src.categoryRef?.id || '') : String(src.categoryRef || '')
      const targetCatName = (typeof src.categoryRef === 'object' ? src.categoryRef?.name : src.categoryName || '').trim().toLowerCase()

      let matchingNews = news.filter((item: any) => {
        const itemCatId = typeof item.categoryRef === 'object' ? String(item.categoryRef?.id || '') : String(item.categoryRef || '')
        const itemCatName = (typeof item.categoryRef === 'object' ? item.categoryRef?.name : item.category || '').trim().toLowerCase()
        if (targetCatId && itemCatId && targetCatId === itemCatId) return true
        if (targetCatName && itemCatName && (itemCatName === targetCatName || itemCatName.includes(targetCatName))) return true
        return false
      })

      if (fnFilterMode === 'only-featured') {
        matchingNews = matchingNews.filter((item: any) => item.featured === true)
      }

      const defaultBadge = (typeof src.categoryRef === 'object' && src.categoryRef?.name) || src.categoryName || 'TIN TỨC'
      const items = matchingNews.slice(0, limit).map((item: any) => ({
        id: `news-cat-${item.id}`,
        title: item.title,
        excerpt: item.excerpt,
        image: mediaUrl(item.cover || item.seoImage) || defaultMedia.news,
        imageFit: item.coverFit || fnConfig?.featuredCardFit || 'cover',
        imagePosition: item.coverPosition ? (item.coverPosition === 'center' ? 'center center' : (item.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : undefined,
        href: `/tin-tuc/${item.slug}`,
        kind: customBadge || defaultBadge.toUpperCase(),
        dateValue: item.publishedAt || item.updatedAt,
        date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    } else if (src.source === 'notices') {
      const items = notices.slice(0, limit).map((item: any) => ({
        id: `notice-${item.id}`,
        title: item.title,
        excerpt: item.excerpt,
        image: mediaUrl(item.cover || item.seoImage) || defaultMedia.notices,
        imageFit: item.coverFit || fnConfig?.featuredCardFit || 'cover',
        imagePosition: item.coverPosition ? (item.coverPosition === 'center' ? 'center center' : (item.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : undefined,
        href: `/thong-bao/${item.slug}`,
        kind: customBadge || 'THÔNG BÁO',
        dateValue: item.publishedAt || item.startAt || item.updatedAt,
        date: (item.publishedAt || item.startAt) ? new Date(item.publishedAt || item.startAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    } else if (src.source === 'procurement') {
      const items = procurement.slice(0, limit).map((item: any) => ({
        id: `procurement-${item.id}`,
        title: item.title,
        excerpt: item.excerpt || item.summary,
        image: mediaUrl(item.cover || item.seoImage) || defaultMedia.procurement,
        imageFit: item.coverFit || fnConfig?.featuredCardFit || 'cover',
        imagePosition: item.coverPosition ? (item.coverPosition === 'center' ? 'center center' : (item.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : undefined,
        href: `/dau-thau-mua-sam/${item.slug}`,
        kind: customBadge || 'ĐẤU THẦU – MUA SẮM',
        dateValue: item.publishedAt || item.updatedAt,
        date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    } else if (src.source === 'schedules') {
      const items = schedules.slice(0, limit).map((item: any) => ({
        id: `schedule-${item.id}`,
        title: item.title,
        excerpt: item.summary || item.note || 'Lịch khám mới được cập nhật từ bệnh viện.',
        image: mediaUrl(item.coverImage || item.scheduleImage) || defaultMedia.schedules,
        imageFit: fnConfig?.featuredCardFit || 'cover',
        href: `/lich-kham/${item.id}`,
        kind: customBadge || (item.mode === 'emergency' ? 'LỊCH TRỰC CẤP CỨU' : 'LỊCH KHÁM'),
        dateValue: item.date || item.validFrom || item.weekStart || item.emergencyWeekStart || item.updatedAt,
        date: (item.date || item.validFrom || item.weekStart || item.emergencyWeekStart) ? new Date(item.date || item.validFrom || item.weekStart || item.emergencyWeekStart).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    } else if (src.source === 'documents') {
      const items = documents.slice(0, limit).map((item: any) => ({
        id: `doc-${item.id}`,
        title: item.title,
        excerpt: item.summary || [item.number, item.issuer].filter(Boolean).join(' · ') || 'Văn bản, biểu mẫu của bệnh viện.',
        image: mediaUrl(item.cover || item.seoImage) || defaultMedia.documents,
        imageFit: item.coverFit || fnConfig?.featuredCardFit || 'cover',
        imagePosition: item.coverPosition ? (item.coverPosition === 'center' ? 'center center' : (item.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : undefined,
        href: item.slug ? `/van-ban/${item.slug}` : (mediaUrl(item.file) || '/van-ban'),
        kind: customBadge || 'VĂN BẢN',
        dateValue: item.issuedAt || item.updatedAt,
        date: item.issuedAt ? new Date(item.issuedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
      }))
      dynamicFeaturedItems.push(...items)
    }
  }

  // Khử trùng lặp ID (nếu có bài thuộc cả 2 nguồn)
  const uniqueFeaturedItemsMap = new Map<string, any>()
  for (const it of dynamicFeaturedItems) {
    if (!uniqueFeaturedItemsMap.has(it.id)) {
      uniqueFeaturedItemsMap.set(it.id, it)
    }
  }

  const featuredItems = Array.from(uniqueFeaturedItemsMap.values())
    .sort((a: any, b: any) => new Date(b.dateValue || 0).getTime() - new Date(a.dateValue || 0).getTime())
    .slice(0, featuredItemLimit)

  // ── HÀM RENDER SECTION THEO MẪU BỐ CỤC (đọc từ Admin config) ──
  // Mỗi section notices/procurement/documents/content-section đều gọi hàm này
  // để render theo layout đã chọn trong Admin → Homepage → section → "Mẫu bố cục"
  function renderEditorialSection(params: {
    items: any[]
    layout?: string
    showDate?: boolean
    showCategory?: boolean
    showExcerpt?: boolean
    badgeOverride?: string
    emptyText?: string
    actionText?: string
  }) {
    const {
      items,
      layout = 'editorial-grid',
      showDate = true,
      showCategory = true,
      showExcerpt = true,
      badgeOverride,
      emptyText = 'Chưa có nội dung.',
      actionText = 'Xem chi tiết →',
    } = params

    if (!items || items.length === 0) return <div className="professionalEmpty">{emptyText}</div>

    // ── MẪU 1: Editorial Grid (Phương án 3: 1 Thẻ Lớn Nổi Bật Trái + Danh Sách Hàng Ngang Phải) ──
    if (layout === 'editorial-grid') {
      const mainEntry = items[0] || null
      const subEntries = items.slice(1, 5)

      const renderImageProps = (entry: any) => {
        const fit = (entry.coverFit === 'fill' ? 'fill' : (entry.coverFit === 'contain' ? 'contain' : 'cover')) as React.CSSProperties['objectFit']
        const pos = entry.coverFit === 'cover-top' || entry.coverPosition === 'top'
          ? 'top center'
          : (entry.coverFit === 'cover-bottom' || entry.coverPosition === 'bottom'
            ? 'bottom center'
            : 'center center')
        return { fit, pos }
      }

      return (
        <div className="homeEditorialGrid editorialVariant3">
          {/* CỘT TRÁI: 1 THẺ LỚN NỔI BẬT (FEATURED HERO CARD) */}
          {mainEntry ? (
            (() => {
              const { fit, pos } = renderImageProps(mainEntry)
              const isExt = mainEntry.isExternal || (typeof mainEntry.href === 'string' && mainEntry.href.startsWith('http'))
              return (
                <a
                  href={mainEntry.href}
                  className="editorialHeroCard featured"
                  key={mainEntry.id}
                  target={isExt ? '_blank' : undefined}
                  rel={isExt ? 'noopener noreferrer' : undefined}
                >
                  <div
                    className="editorialHeroThumb"
                    style={{
                      background: mainEntry.coverFit === 'contain' ? '#eaf4fc' : undefined,
                    }}
                  >
                    <img
                      src={mainEntry.cover}
                      alt={mainEntry.title}
                      className="editorialHeroImg"
                      loading="lazy"
                      style={{
                        objectFit: fit,
                        objectPosition: pos,
                      }}
                    />
                    {showCategory && (
                      <span className="editorialHeroBadge">
                        {badgeOverride || mainEntry.category || 'THÔNG BÁO'}
                      </span>
                    )}
                  </div>
                  <div className="editorialHeroBody">
                    {showDate && (
                      <div className="editorialHeroDate">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{mainEntry.date || 'Mới cập nhật'}</span>
                      </div>
                    )}
                    <h3 className="editorialHeroTitle">{mainEntry.title}</h3>
                    {showExcerpt && (
                      <p className="editorialHeroExcerpt">{mainEntry.excerpt || ''}</p>
                    )}
                    <div className="editorialHeroAction">
                      <span>{actionText}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </div>
                </a>
              )
            })()
          ) : (
            <div className="homeEditorialEmptyCard" aria-hidden="true" />
          )}

          {/* CỘT PHẢI: DANH SÁCH CÁC HÀNG NGANG (SUB LIST ROWS) */}
          <div className="editorialRowList">
            {subEntries.length > 0 ? (
              subEntries.map((entry: any) => {
                const { fit, pos } = renderImageProps(entry)
                const isExt = entry.isExternal || (typeof entry.href === 'string' && entry.href.startsWith('http'))
                return (
                  <a
                    href={entry.href}
                    className="editorialRowItem"
                    key={entry.id}
                    target={isExt ? '_blank' : undefined}
                    rel={isExt ? 'noopener noreferrer' : undefined}
                  >
                    <div
                      className="editorialRowThumb"
                      style={{
                        background: entry.coverFit === 'contain' ? '#f4f8fb' : undefined,
                      }}
                    >
                      <img
                        src={entry.cover}
                        alt={entry.title}
                        className="editorialRowImg"
                        loading="lazy"
                        style={{
                          objectFit: fit,
                          objectPosition: pos,
                        }}
                      />
                    </div>
                    <div className="editorialRowContent">
                      <div className="editorialRowMeta">
                        {showCategory && (entry.category || badgeOverride) && (
                          <span className="editorialRowBadge">
                            {badgeOverride || entry.category}
                          </span>
                        )}
                        {showDate && (
                          <span className="editorialRowDate">
                            {entry.date || 'Mới cập nhật'}
                          </span>
                        )}
                      </div>
                      <h4 className="editorialRowTitle">{entry.title}</h4>
                      {showExcerpt && entry.excerpt && (
                        <p className="editorialRowExcerpt">{entry.excerpt}</p>
                      )}
                    </div>
                    <div className="editorialRowArrow" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </a>
                )
              })
            ) : (
              <div className="editorialRowEmpty">Chưa có thêm thông tin trong mục này.</div>
            )}
          </div>
        </div>
      )
    }

    // ── MẪU 2: Card Grid – 4 thẻ đều nhau ──
    if (layout === 'card-grid-4') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '18px' }}>
          {items.map((entry: any) => {
            const isExt = entry.isExternal || (typeof entry.href === 'string' && entry.href.startsWith('http'))
            return (
              <a key={entry.id} href={entry.href} target={isExt ? '_blank' : undefined} rel={isExt ? 'noopener noreferrer' : undefined} style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(10,45,75,0.05)', textDecoration: 'none', color: 'inherit', transition: 'transform .22s,box-shadow .22s', height: '100%' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 24px rgba(8,120,209,.12)' }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(10,45,75,0.05)' }}
              >
                <div style={{ width: '100%', aspectRatio: '16/9', background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  <img src={entry.cover} alt={entry.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                  {showCategory && entry.category && <span style={{ position: 'absolute', bottom: 8, left: 10, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(4px)', color: '#008046', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', padding: '3px 7px', borderRadius: '5px' }}>{badgeOverride || entry.category}</span>}
                </div>
                <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', padding: '13px 14px 14px' }}>
                  {showDate && <span style={{ fontSize: '11px', color: '#64748b', marginBottom: 6 }}>{entry.date || 'Mới cập nhật'}</span>}
                  <strong style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.42, color: '#0f172a', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', marginBottom: 6 }}>{entry.title}</strong>
                  {showExcerpt && entry.excerpt && <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', margin: '0 0 8px' }}>{entry.excerpt}</p>}
                  <span style={{ marginTop: 'auto', fontSize: '12px', fontWeight: 700, color: '#0878d1' }}>Xem chi tiết →</span>
                </div>
              </a>
            )
          })}
        </div>
      )
    }

    // ── MẪU 3: List Rows – hàng ngang, ảnh nhỏ trái + nội dung phải ──
    if (layout === 'list-rows') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((entry: any) => {
            const isExt = entry.isExternal || (typeof entry.href === 'string' && entry.href.startsWith('http'))
            return (
              <a key={entry.id} href={entry.href} target={isExt ? '_blank' : undefined} rel={isExt ? 'noopener noreferrer' : undefined} style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#fff', border: '1px solid #e8edf4', borderRadius: '10px', overflow: 'hidden', textDecoration: 'none', color: 'inherit', padding: '0 14px 0 0', transition: 'box-shadow .2s,border-color .2s' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(8,120,209,.1)'; (e.currentTarget as HTMLElement).style.borderColor = '#7fb9e5' }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = '#e8edf4' }}
              >
                <div style={{ width: '110px', minWidth: '110px', height: '74px', background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  <img src={entry.cover} alt={entry.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 0' }}>
                  {(showDate || showCategory) && (
                    <div style={{ display: 'flex', gap: 8, fontSize: '11px', color: '#64748b', alignItems: 'center' }}>
                      {showDate && <span>{entry.date || 'Mới cập nhật'}</span>}
                      {showDate && showCategory && entry.category && <span>·</span>}
                      {showCategory && entry.category && <span style={{ color: '#0878d1', fontWeight: 600 }}>{entry.category}</span>}
                    </div>
                  )}
                  <strong style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.4, color: '#0f172a', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{entry.title}</strong>
                  {showExcerpt && entry.excerpt && <p style={{ fontSize: '12px', color: '#64748b', margin: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden' }}>{entry.excerpt}</p>}
                </div>
                <span style={{ fontSize: '18px', color: '#bfcfdb', flexShrink: 0 }}>›</span>
              </a>
            )
          })}
        </div>
      )
    }

    // ── MẪU 4: Compact List – chỉ text, ngày + tiêu đề + chuyên mục ──
    // compact-list hoặc fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((entry: any, idx: number) => {
          const isExt = entry.isExternal || (typeof entry.href === 'string' && entry.href.startsWith('http'))
          return (
            <a key={entry.id} href={entry.href} target={isExt ? '_blank' : undefined} rel={isExt ? 'noopener noreferrer' : undefined} style={{ display: 'flex', alignItems: 'baseline', gap: '12px', padding: '10px 0', borderBottom: idx < items.length - 1 ? '1px solid #f0f4f8' : 'none', textDecoration: 'none', color: 'inherit', transition: 'color .18s' }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#0878d1' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = '' }}
            >
              {showDate && <span style={{ fontSize: '11.5px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '72px' }}>{entry.date || '—'}</span>}
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{entry.title}</span>
              {showCategory && entry.category && <span style={{ fontSize: '11px', fontWeight: 700, color: '#0878d1', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.category}</span>}
            </a>
          )
        })}
      </div>
    )
  }
  // ── HẾT HÀM RENDER ──

  // Pre-fetch tin tức cho các tab liên kết ngoài (Cổng thông tin liên kết / cantho-health-dept)
  // CHỈ KHI quản trị viên BẬT công tắc enableExternalFetch thì mới gọi mạng ra bên ngoài
  const autoFeedNewsMap = new Map<string, any[]>()
  try {
    const healthDeptSection = configuredSections.find((s: any) => s && s.visible !== false && s.type === 'cantho-health-dept')
    if (healthDeptSection) {
      const isExternalFetchEnabled = healthDeptSection.enableExternalFetch === true
      const rawTabs = Array.isArray(healthDeptSection.linkedWebsitesTabs) ? healthDeptSection.linkedWebsitesTabs : []
      const hasCanThoSytTab = rawTabs.length === 0 || rawTabs.some((t: any) => t && t.enabled !== false && t.source === 'cantho-syt')

      if (isExternalFetchEnabled) {
        const sLimit = Math.min(20, Math.max(1, Number(healthDeptSection.layoutItemLimit || 5)))
        const tasks: Promise<any>[] = []

        // 1. Quét Cổng Sở Y tế nếu tab Sở Y tế đang bật và cho phép fetch
        if (hasCanThoSytTab) {
          const sytTab = rawTabs.find((t: any) => t && t.source === 'cantho-syt')
          const canFetchSyt = !sytTab || sytTab.autoFetchEnabled === true
          if (canFetchSyt) {
            tasks.push(
              getCanThoHealthDeptNews(12, { skipFetch: false })
                .then((items) => {
                  canthoHealthNews = items && items.length > 0 ? items : FALLBACK_ITEMS
                })
                .catch(() => {
                  canthoHealthNews = FALLBACK_ITEMS
                })
            )
          } else {
            canthoHealthNews = FALLBACK_ITEMS
          }
        }

        // 2. Quét các tab auto-feed nếu bật và cho phép fetch
        const autoFeedTabs = rawTabs.filter(
          (t: any) => t && t.enabled !== false && t.source === 'auto-feed' && t.autoFetchEnabled === true && t.feedUrl?.trim()
        )
        for (const t of autoFeedTabs) {
          const url = t.feedUrl.trim()
          if (!autoFeedNewsMap.has(url)) {
            tasks.push(
              fetchAutoLinkedNews(url, sLimit)
                .then((feedItems) => {
                  autoFeedNewsMap.set(url, feedItems)
                })
                .catch(() => {
                  autoFeedNewsMap.set(url, [])
                })
            )
          }
        }

        await Promise.all(tasks)
      } else {
        // External fetch TẮT: Tuyệt đối KHÔNG gọi fetch() ra ngoài! Dùng ngay dữ liệu fallback tĩnh 0ms.
        canthoHealthNews = FALLBACK_ITEMS
      }
    }
  } catch (err) {
    console.error('[HomePage] Error prefetching external linked news:', err)
    if (!canthoHealthNews || canthoHealthNews.length === 0) {
      canthoHealthNews = FALLBACK_ITEMS
    }
  }

  const quickUpdates = [
    sectionConfig('notices')?.visible !== false && notices[0] ? {
      type: 'notice', label: 'THÔNG BÁO NHANH', title: notices[0].title,
      href: `/thong-bao/${notices[0].slug}`,
    } : null,
    sectionConfig('procurement')?.visible !== false && procurement[0] ? {
      type: 'procurement', label: 'ĐẤU THẦU – MUA SẮM', title: procurement[0].title,
      href: `/dau-thau-mua-sam/${procurement[0].slug}`,
    } : null,
  ].filter(Boolean) as Array<{ type: string; label: string; title: string; href: string }>

  return (
    <main className="homePortalPage">
      <SiteHeader />
      <HomeScrollSnapHandler enabled={home?.enableSectionScrollSnap !== false} />

      {showHeroBanners && <HeroBannerCarousel slides={heroSlides} intervalSeconds={home?.bannerAutoplaySeconds || 6} bannerWidth={siteSettings?.headerBannerWidth || 1920} />}

      {quickLinksEnabled && quickLinks.length > 0 && (
        <QuickLinksCardsSlider
          items={quickLinks.map((item: any) => ({
            ...item,
            quickImage: item.visualMode === 'image' ? mediaUrl(item.image) : '',
          }))}
          showHeroBanners={showHeroBanners}
        />
      )}

      {quickUpdates.length > 0 && (
        <section className="homeQuickUpdates" aria-label="Thông tin mới">
          <div className="container homeQuickUpdatesInner">
            <div className="homeQuickUpdatesHeading">
              <span className="homeQuickUpdatesPulse" aria-hidden="true" />
              <strong>THÔNG TIN MỚI</strong>
            </div>
            <div className="homeQuickUpdatesList">
              {quickUpdates.map((update) => (
                <a className={`homeQuickUpdateItem ${update.type}`} href={update.href} key={update.type}>
                  <span className="homeQuickUpdateIcon" aria-hidden="true">{update.type === 'notice' ? '!' : '✓'}</span>
                  <span className="homeQuickUpdateContent">
                    <small>{update.label}</small>
                    <strong>{update.title}</strong>
                  </span>
                  <span className="homeQuickUpdateArrow" aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="homeSections">
        {configuredSections.map((item: any, index: number) => {
          if (!item || item.visible === false) return null
          const type = item.type === 'news' ? 'featured-news' : item.type
          const cfg = { ...(sectionDefaults[type] || {}), ...item }
          const style = customSectionStyle(cfg, index)
          const key = item.id || `${type}-${index}`

          if (type === 'introduction') return <section className="sectionPro configurableHomeSection homeOverviewSection" style={style} key={key}>
            <div className="container homeOverviewGrid"><div className="homeIntroCopy"><span className="sectionKicker">{cfg.eyebrow}</span><h2>{cfg.title}</h2><p>{cfg.description || 'Không ngừng nâng cao chất lượng khám chữa bệnh, ứng dụng công nghệ và phát triển đội ngũ nhân lực chuyên môn cao, hướng đến sự hài lòng của người bệnh.'}</p><a className="homeSolidButton" href="/gioi-thieu">Xem thêm về bệnh viện <span>→</span></a></div><div className="homeStatsGrid">{stats.map((stat: any, statIndex: number) => <article key={stat.id || `${stat.label}-${statIndex}`}><span className="homeStatIcon"><HomeGlyph name={['hospital', 'doctor', 'calendar', 'insurance'][statIndex]} /></span><strong>{stat.value}</strong><small>{stat.label}</small></article>)}</div></div>
          </section>

          if (type === 'organization') {
            const carouselSpecialties = specialties.map((item: any) => ({
              id: item.id,
              name: item.name,
              slug: item.slug,
              departmentName: typeof item.department === 'object' ? item.department?.name : undefined,
              summary: item.summary,
              tagline: item.tagline || undefined,
              icon: item.icon || 'default',
              iconCustomUrl: mediaUrl(item.iconCustomUpload, 'icon') || undefined,
              coverUrl: mediaUrl(item.cover, 'article') || undefined,
              subCoverUrl: mediaUrl(item.subCover, 'article') || undefined,
              showSubCover: item.showSubCover !== false,
              coverFitHome: item.coverFitHome || item.coverFit || 'cover-top',
              coverFit: item.coverFitHome || item.coverFit || 'cover-top',
              coverPosition: item.coverPosition || 'top',
            }))

            return (
              <section className="sectionPro configurableHomeSection homeSpecialtiesShowcaseSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow || 'CHUYÊN MÔN Y TẾ'}</span>
                      <h2>{cfg.title || 'Hệ thống Chuyên khoa'}</h2>
                      <p>{cfg.description || 'Đội ngũ bác sĩ tận tâm, quy trình tiêu chuẩn và hệ thống trang thiết bị hiện đại phục vụ khám chữa bệnh.'}</p>
                    </div>
                    <a href="/chuyen-khoa">Xem tất cả chuyên khoa →</a>
                  </div>

                  <SpecialtiesCarousel
                    items={carouselSpecialties}
                    autoplaySeconds={4}
                  />
                </div>
              </section>
            )
          }

          if (type === 'featured-news') {
            const seeAllUrl = cfg.featuredSeeAllUrl || '/tin-tuc'
            return (
              <section className="sectionPro configurableHomeSection homeFeaturedSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow}</span>
                      <h2>{cfg.title}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    <a href={seeAllUrl}>Xem tất cả →</a>
                  </div>
                  <FeaturedContentCarousel items={featuredItems} interval={featuredInterval} cardFit={cfg.featuredCardFit || 'cover'} />
                </div>
              </section>
            )
          }


          if (type === 'advanced-techniques') {
            const collectionSlides = advancedTechniques.map((tech: any) => {
              const isLinkEnabled = tech.enableLink !== false
              const autoUrl = isLinkEnabled ? (tech.customUrl || `/ky-thuat-chuyen-sau/${tech.slug}`) : undefined
              return {
                id: tech.id,
                title: tech.title,
                badge: tech.badge || undefined,
                image: mediaUrl(tech.cover) || '',
                imageFit: tech.imageFit || 'contain',
                url: autoUrl,
                openNewTab: false,
                visible: tech.active !== false,
              }
            })

            const hasCustomList = Array.isArray(item.techniqueItems) && item.techniqueItems.length > 0
            const configuredSlides = (item.techniqueItems || []).map((tech: any, techIdx: number) => {
              const linkedDoc = tech.techniqueRef && typeof tech.techniqueRef === 'object' ? tech.techniqueRef : undefined
              const isLinkEnabled = tech.enableLink !== false && linkedDoc?.enableLink !== false
              const autoUrl = isLinkEnabled
                ? (linkedDoc?.slug ? `/ky-thuat-chuyen-sau/${linkedDoc.slug}` : (tech.url || undefined))
                : undefined
              const autoTitle = tech.title || linkedDoc?.title || 'Kỹ thuật chuyên sâu'
              const autoBadge = tech.badge || linkedDoc?.badge || undefined
              const autoImage = mediaUrl(tech.image) || (linkedDoc?.cover ? mediaUrl(linkedDoc.cover) : '')
              const autoFit = tech.imageFit || linkedDoc?.imageFit || 'contain'
              return {
                id: tech.id || `tech-${techIdx}`,
                title: autoTitle,
                badge: autoBadge,
                image: autoImage,
                imageFit: autoFit,
                url: autoUrl,
                openNewTab: isLinkEnabled && tech.openNewTab === true,
                visible: tech.visible !== false,
              }
            })

            // Ưu tiên hiển thị từ mục quản trị Kỹ thuật chuyên sâu nếu có bài viết, hoặc các thẻ được cấu hình có liên kết
            const techniqueSlides = collectionSlides.length > 0
              ? collectionSlides
              : (hasCustomList ? configuredSlides : [])

            const isPinkish = (val?: string) => !val || val === '#fce4f0' || val === '#fce8f3' || val === '#d42d7d' || val === '#c92372' || val.toLowerCase().includes('fc')
            const finalCardBg = isPinkish(item.cardBarBgColor) ? '#f0f7fd' : item.cardBarBgColor
            const finalCardText = isPinkish(item.cardBarTextColor) ? '#0754a8' : item.cardBarTextColor

            return (
              <section className="sectionPro configurableHomeSection homeAdvancedTechniquesSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow || 'CHUYÊN KHOA & CÔNG NGHỆ Y TẾ'}</span>
                      <h2>{cfg.title || 'Kỹ thuật chuyên sâu'}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    <a href="/ky-thuat-chuyen-sau">Xem tất cả →</a>
                  </div>
                  <AdvancedTechniquesCarousel
                    items={techniqueSlides}
                    autoplaySeconds={Number(item.techniqueAutoplaySeconds ?? 5)}
                    itemsPerView={Math.min(6, Math.max(1, Number(item.techniqueItemsPerView || 4)))}
                    cardBarBgColor={finalCardBg}
                    cardBarTextColor={finalCardText}
                  />
                </div>
              </section>
            )
          }

          if (type === 'our-experts') {
            // Helper loại bỏ tiền tố chức danh quản lý/chức vụ trước tên (ví dụ "Phó Giám Đốc", "Giám đốc", "Trưởng Phòng")
            const cleanTitleFromName = (rawName: string, title?: string): string => {
              if (!rawName) return ''
              let result = rawName.trim()
              if (title && title.trim()) {
                const escapedTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                result = result.replace(new RegExp(`^${escapedTitle}\\s*`, 'i'), '').trim()
              }
              // Lọc các chức danh quản lý thông dụng nếu người dùng nhập sẵn trong tên
              const commonTitles = [
                'Giám Đốc Bệnh Viện',
                'Giám đốc Bệnh viện',
                'Phó Giám Đốc Bệnh Viện',
                'Phó Giám đốc Bệnh viện',
                'Phó Giám Đốc',
                'Phó Giám đốc',
                'Giám Đốc',
                'Giám đốc',
                'Trưởng Khoa',
                'Trưởng khoa',
                'Phó Trưởng Khoa',
                'Phó Trưởng khoa',
                'Phó Khoa',
                'Phó khoa',
                'Trưởng Phòng',
                'Trưởng phòng',
                'Phó Trưởng Phòng',
                'Phó Trưởng phòng',
                'Phó Phòng',
                'Phó phòng',
              ]
              for (const t of commonTitles) {
                if (result.toLowerCase().startsWith(t.toLowerCase())) {
                  result = result.slice(t.length).trim()
                  break
                }
              }
              return result
            }

            // 1. Dữ liệu từ Quản trị -> Nội dung -> Chuyên gia của chúng tôi (our-experts collection)
            const ourExpertsCollectionSlides = ourExpertsList.map((exp: any) => {
              const linkedDoc = exp.doctorRef && typeof exp.doctorRef === 'object' ? exp.doctorRef : undefined
              const linkedDept = linkedDoc && typeof linkedDoc.department === 'object' ? linkedDoc.department?.name : ''
              const isLinkEnabled = exp.enableLink !== false
              const autoUrl = isLinkEnabled
                ? (exp.url || (linkedDoc?.slug ? `/bac-si/${linkedDoc.slug}` : (linkedDoc ? `/bac-si/${linkedDoc.id}` : undefined)))
                : undefined
              
              // Bỏ phần chức vụ trước tên: chỉ hiển thị học vị + họ tên (ví dụ: BSCKII. Lê Thị Đức Hạnh)
              const doctorBaseName = linkedDoc?.name ? linkedDoc.name.trim() : ''
              const rawName = doctorBaseName || exp.name || 'Bác sĩ / Chuyên gia'
              const autoName = cleanTitleFromName(rawName, linkedDoc?.title)

              // Kiểm tra xem có hiển thị kèm Khoa/Phòng không (mặc định true trừ khi bị tắt ở exp hoặc linkedDoc)
              const shouldShowDept = exp.showDepartment !== false && linkedDoc?.showDepartment !== false

              // Xác định dòng mô tả / chức vụ:
              // Ưu tiên cao nhất: customSubtitle (nếu có nhập tại Chuyên gia hoặc Bác sĩ liên kết)
              const customSubtitle = (exp.customSubtitle || linkedDoc?.customSubtitle || '').trim()

              let autoPos: string | undefined = undefined
              let autoSubPos: string | undefined = undefined

              if (customSubtitle) {
                autoPos = customSubtitle
              } else {
                // Tách riêng chức danh/chức vụ và khoa/phòng
                const titles = linkedDoc ? [linkedDoc.title, linkedDoc.degree, linkedDoc.professionalTitle].filter(Boolean) : []
                const baseTitle = titles.join(' · ') || exp.position || ''
                
                const doctorPos = linkedDoc
                  ? (shouldShowDept ? ([baseTitle, linkedDept].filter(Boolean).join(' · ') || linkedDept) : (baseTitle || linkedDept))
                  : (exp.position || '')
                
                const customExpPos = (exp.position || '').trim()
                autoPos = doctorPos || customExpPos || undefined
                if (doctorPos && customExpPos && customExpPos !== doctorPos) {
                  autoPos = doctorPos
                  autoSubPos = customExpPos
                }
              }

              // Ưu tiên Ảnh đại diện của Bác sĩ; chỉ khi bên Bác sĩ không có hình ảnh thì mới áp dụng hình ảnh bên Chuyên gia
              const doctorAvatarUrl = linkedDoc?.avatar ? mediaUrl(linkedDoc.avatar) : ''
              const autoImage = doctorAvatarUrl || mediaUrl(exp.image) || ''
              const autoFit = exp.imageFit || 'contain'
              return {
                id: exp.id,
                name: autoName,
                position: autoPos,
                subPosition: autoSubPos,
                image: autoImage,
                imageFit: autoFit,
                url: autoUrl,
                openNewTab: isLinkEnabled && exp.openNewTab === true,
                visible: exp.active !== false,
              }
            })

            // 2. Dữ liệu trực tiếp từ Quản trị -> Tổ chức -> Bác sĩ (doctors collection)
            // Lọc các bác sĩ cho phép hiển thị lên Trang chủ (showOnHome !== false)
            const collectionDoctorSlides = doctors
              .filter((doc: any) => doc.active !== false && doc.showOnHome !== false)
              .map((doc: any) => {
                const deptName = typeof doc.department === 'object' ? doc.department?.name : ''
                const shouldShowDept = doc.showDepartment !== false
                const titles = [doc.title, doc.degree, doc.professionalTitle].filter(Boolean)
                const baseTitle = titles.join(' · ')
                
                const position = doc.customSubtitle?.trim()
                  ? doc.customSubtitle.trim()
                  : (shouldShowDept
                      ? ([baseTitle, deptName].filter(Boolean).join(' · ') || deptName || 'Bác sĩ chuyên khoa')
                      : (baseTitle || deptName || 'Bác sĩ chuyên khoa'))

                return {
                  id: doc.id,
                  name: (doc.name || '').trim(),
                  position,
                  image: mediaUrl(doc.avatar) || '',
                  imageFit: 'contain',
                  url: `/bac-si/${doc.slug}`,
                  openNewTab: false,
                  visible: doc.active !== false,
                }
              })

            const hasCustomExpertList = Array.isArray(item.expertItems) && item.expertItems.length > 0
            const configuredExpertSlides = (item.expertItems || []).map((exp: any, expIdx: number) => {
              const linkedDoc = exp.doctorRef && typeof exp.doctorRef === 'object' ? exp.doctorRef : undefined
              const linkedDept = linkedDoc && typeof linkedDoc.department === 'object' ? linkedDoc.department?.name : ''
              const isLinkEnabled = exp.enableLink !== false
              const autoUrl = isLinkEnabled
                ? (linkedDoc?.slug ? `/bac-si/${linkedDoc.slug}` : (exp.url || (linkedDoc ? `/bac-si/${linkedDoc.id}` : undefined)))
                : undefined
              
              // Bỏ phần chức vụ trước tên: chỉ hiển thị học vị + họ tên
              const doctorBaseName = linkedDoc?.name ? linkedDoc.name.trim() : ''
              const rawName = doctorBaseName || exp.name || 'Bác sĩ / Chuyên gia'
              const autoName = cleanTitleFromName(rawName, linkedDoc?.title)

              const shouldShowDept = exp.showDepartment !== false && linkedDoc?.showDepartment !== false
              const customSubtitle = (exp.customSubtitle || linkedDoc?.customSubtitle || '').trim()

              let autoPos: string | undefined = undefined
              let autoSubPos: string | undefined = undefined

              if (customSubtitle) {
                autoPos = customSubtitle
              } else {
                const titles = linkedDoc ? [linkedDoc.title, linkedDoc.degree, linkedDoc.professionalTitle].filter(Boolean) : []
                const baseTitle = titles.join(' · ') || exp.position || ''
                const doctorPos = linkedDoc
                  ? (shouldShowDept ? ([baseTitle, linkedDept].filter(Boolean).join(' · ') || linkedDept) : (baseTitle || linkedDept))
                  : (exp.position || '')
                const customExpPos = (exp.position || '').trim()

                autoPos = doctorPos || customExpPos || undefined
                if (doctorPos && customExpPos && customExpPos !== doctorPos) {
                  autoPos = doctorPos
                  autoSubPos = customExpPos
                }
              }

              // Ưu tiên Ảnh đại diện của Bác sĩ; chỉ khi bên Bác sĩ không có hình ảnh thì mới áp dụng hình ảnh bên Chuyên gia
              const doctorAvatarUrl = linkedDoc?.avatar ? mediaUrl(linkedDoc.avatar) : ''
              const autoImage = doctorAvatarUrl || mediaUrl(exp.image) || ''
              const autoFit = exp.imageFit || 'contain'
              return {
                id: exp.id || `expert-${expIdx}`,
                name: autoName,
                position: autoPos,
                subPosition: autoSubPos,
                image: autoImage,
                imageFit: autoFit,
                url: autoUrl,
                openNewTab: isLinkEnabled && exp.openNewTab === true,
                visible: exp.visible !== false,
              }
            })

            // Thứ tự ưu tiên nguồn dữ liệu:
            // 1) Ưu tiên cao nhất: Danh sách Bác sĩ từ Quản trị -> Tổ chức -> Đội ngũ Bác sĩ & Chuyên gia (doctors collection có showOnHome !== false)
            // 2) Nếu không có Bác sĩ nào được bật showOnHome: Lấy từ Quản trị -> Nội dung -> Chuyên gia của chúng tôi (our-experts collection)
            // 3) Danh sách cấu hình thủ công trong Homepage (expertItems)
            const expertSlides = collectionDoctorSlides.length > 0
              ? collectionDoctorSlides
              : (ourExpertsCollectionSlides.length > 0
                  ? ourExpertsCollectionSlides
                  : (hasCustomExpertList ? configuredExpertSlides : []))

            const isPinkish = (val?: string) => !val || val === '#fce4f0' || val === '#fce8f3' || val === '#d42d7d' || val === '#c92372' || val.toLowerCase().includes('fc')
            const finalCardBg = isPinkish(item.expertCardBgColor) ? '#f0f7fd' : item.expertCardBgColor
            const finalCardText = isPinkish(item.expertCardTextColor) ? '#0754a8' : item.expertCardTextColor

            // Sắp xếp các slide chuyên gia theo quy tắc lãnh đạo bệnh viện (Giám đốc -> Phó Giám đốc -> ...)
            const rawSortedExperts = [...expertSlides].sort((a: any, b: any) => {
              const getRank = (exp: any) => {
                const text = `${exp.name || ''} ${exp.position || ''} ${exp.subPosition || ''}`.toLowerCase()
                if (text.includes('giám đốc') || text.includes('giam doc')) {
                  if (text.includes('phó') || text.includes('pho')) return 2
                  return 1
                }
                if (text.includes('trưởng') || text.includes('truong')) return 3
                if (text.includes('phó') || text.includes('pho')) return 4
                return 10
              }
              return getRank(a) - getRank(b)
            })

            const displayLayout = item.expertDisplayLayout || 'featured-grid'

            return (
              <section className="sectionPro configurableHomeSection homeOurExpertsSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow || 'ĐỘI NGŨ Y BÁC SĨ'}</span>
                      <h2>{cfg.title || 'Chuyên gia của chúng tôi'}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    <a href="/bac-si">Xem tất cả →</a>
                  </div>
                  {displayLayout === 'carousel' ? (
                    <OurExpertsCarousel
                      items={rawSortedExperts}
                      autoplaySeconds={Number(item.expertAutoplaySeconds ?? 5)}
                      itemsPerView={Math.min(6, Math.max(1, Number(item.expertItemsPerView || 4)))}
                      cardBarBgColor={finalCardBg}
                      cardBarTextColor={finalCardText}
                    />
                  ) : (
                    <OurExpertsFeaturedGrid
                      items={rawSortedExperts}
                      autoplaySeconds={Number(item.expertAutoplaySeconds ?? 5)}
                      cardBarBgColor={finalCardBg}
                      cardBarTextColor={finalCardText}
                      subItemsPerPage={Math.min(6, Math.max(1, Number(item.expertItemsPerView || 3)))}
                    />
                  )}
                </div>
              </section>
            )
          }

          if (type === 'news-portal') {
            if (!news || news.length === 0) return null
            const newsPortalTabs = contentTabsFor('news-portal')
            const newsPortalItems = news.map((article: any) => ({
              id: article.id,
              slug: article.slug,
              href: `/tin-tuc/${article.slug}`,
              coverUrl: mediaUrl(article.cover || article.seoImage) || defaultMedia.news,
              coverFit: article.coverFit || 'cover',
              coverPosition: article.coverPosition || 'top',
              title: article.title,
              excerpt: article.excerpt || '',
              date: article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
              category: categoryName(article) || article.category || 'TIN TỨC',
            }))
            return (
              <section className="sectionPro configurableHomeSection homePortalNewsSection homePortalPage" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead"><div><span className="sectionKicker">{cfg.eyebrow}</span><h2>{cfg.title}</h2>{cfg.description && <p>{cfg.description}</p>}</div><a href="/tin-tuc">Xem toàn bộ bài viết →</a></div>
                  <HomeNewsTabs items={newsPortalItems} tabs={newsPortalTabs.length ? newsPortalTabs : undefined} />
                </div>
              </section>
            )
          }

          if (type === 'patient-portal-services') {
            // Nguồn 1: Gói khám sức khỏe
            const rawPkgs = Array.isArray(checkupPackagesData?.packages) ? checkupPackagesData.packages : []
            const packagesItems = rawPkgs
              .filter((p: any) => p?.enabled !== false && p?.title)
              .map((p: any, pIdx: number) => ({
                id: `pkg-${pIdx}`,
                title: p.title,
                desc: p.desc,
                badge: p.badge,
                targetUser: p.targetUser,
                priceText: p.priceText,
                features: typeof p.features === 'string' ? p.features.split('\n').filter(Boolean) : (Array.isArray(p.features) ? p.features : []),
                href: '/goi-kham',
                buttonText: p.buttonText || 'Đăng ký / Xem chi tiết →',
              }))

            // Nguồn 2: Quy trình khám bệnh
            const rawFlowSteps = Array.isArray(examinationFlowData?.steps) ? examinationFlowData.steps : []
            const flowItems = rawFlowSteps
              .filter((s: any) => s?.enabled !== false && s?.title)
              .map((s: any, sIdx: number) => ({
                id: `flow-${sIdx}`,
                title: s.title,
                desc: s.desc,
                badge: s.badge || `Bước ${s.step || sIdx + 1}`,
                icon: s.icon || '🩺',
                href: '/quy-trinh-kham-benh',
                buttonText: 'Xem quy trình →',
              }))

            // Nguồn 3: Hướng dẫn điều trị nội trú
            const rawInpatientSteps = Array.isArray(inpatientGuideData?.steps) ? inpatientGuideData.steps : []
            const inpatientItems = rawInpatientSteps
              .filter((s: any) => s?.enabled !== false && s?.title)
              .map((s: any, sIdx: number) => ({
                id: `inpat-${sIdx}`,
                title: s.title,
                desc: s.desc,
                badge: `Bước ${s.step || sIdx + 1}`,
                icon: '🛏️',
                href: '/dieu-tri-noi-tru',
                buttonText: 'Xem hướng dẫn nội trú →',
              }))

            // Nguồn 4: Sơ đồ các tầng
            const rawFloors = Array.isArray(hospitalMapData?.floors) ? hospitalMapData.floors : []
            const mapItems = rawFloors
              .filter((f: any) => f?.enabled !== false && f?.floorName)
              .map((f: any, fIdx: number) => ({
                id: `map-${fIdx}`,
                title: f.floorName,
                desc: f.overview,
                badge: `Tầng ${fIdx + 1}`,
                icon: '🗺️',
                href: '/so-do-benh-vien',
                buttonText: 'Xem sơ đồ tầng →',
              }))

            // Nguồn 5: Thẻ Cổng người bệnh
            const rawPortalGroups = Array.isArray(patientPortalData?.serviceGroups) ? patientPortalData.serviceGroups : []
            const portalCardsItems: any[] = []
            for (const grp of rawPortalGroups) {
              if (grp?.enabled === false) continue
              const items = Array.isArray(grp?.items) ? grp.items : []
              for (const itm of items) {
                if (itm?.enabled !== false && itm?.title) {
                  portalCardsItems.push({
                    id: `portal-${portalCardsItems.length}`,
                    title: itm.title,
                    desc: itm.desc,
                    badge: itm.badge,
                    icon: itm.icon || '🏥',
                    href: itm.href || '/danh-cho-nguoi-benh',
                    buttonText: itm.buttonText || 'Truy cập dịch vụ →',
                  })
                }
              }
            }

            // Xử lý các tab được cấu hình trong mục này
            const rawConfiguredTabs = Array.isArray(item.portalServiceTabs) ? item.portalServiceTabs : []
            const defaultSourceTabs = [
              { label: 'Gói khám sức khỏe', source: 'packages', enabled: true },
              { label: 'Quy trình khám bệnh', source: 'flow', enabled: true },
              { label: 'Hướng dẫn nội trú', source: 'inpatient', enabled: true },
            ]
            const sourceTabs = rawConfiguredTabs.length > 0 ? rawConfiguredTabs : defaultSourceTabs

            const resolvedTabs: any[] = []
            for (const tabCfg of sourceTabs) {
              if (tabCfg.enabled === false) continue
              const limit = Math.min(20, Math.max(1, Number(tabCfg.limit || 6)))
              let resolvedItems: any[] = []
              let defaultSeeMore = '/danh-cho-nguoi-benh'

              if (tabCfg.source === 'packages') {
                resolvedItems = packagesItems.slice(0, limit)
                defaultSeeMore = '/goi-kham'
              } else if (tabCfg.source === 'flow') {
                resolvedItems = flowItems.slice(0, limit)
                defaultSeeMore = '/quy-trinh-kham-benh'
              } else if (tabCfg.source === 'inpatient') {
                resolvedItems = inpatientItems.slice(0, limit)
                defaultSeeMore = '/dieu-tri-noi-tru'
              } else if (tabCfg.source === 'map') {
                resolvedItems = mapItems.slice(0, limit)
                defaultSeeMore = '/so-do-benh-vien'
              } else if (tabCfg.source === 'portal-cards') {
                resolvedItems = portalCardsItems.slice(0, limit)
                defaultSeeMore = '/danh-cho-nguoi-benh'
              } else if (tabCfg.source === 'manual') {
                const manualList = Array.isArray(tabCfg.manualItems) ? tabCfg.manualItems : []
                resolvedItems = manualList.slice(0, limit).map((m: any, mIdx: number) => ({
                  id: `manual-${mIdx}`,
                  title: m.title,
                  desc: m.desc,
                  badge: m.badge,
                  icon: m.icon || '🩺',
                  href: m.href || '#',
                  buttonText: m.buttonText || 'Xem chi tiết →',
                }))
                defaultSeeMore = tabCfg.seeMoreUrl || '/danh-cho-nguoi-benh'
              }

              // Chỉ thêm tab nếu có items thực tế
              if (resolvedItems.length > 0) {
                resolvedTabs.push({
                  label: tabCfg.label || 'Dịch vụ',
                  source: tabCfg.source,
                  limit,
                  customBadge: tabCfg.customBadge,
                  seeMoreUrl: tabCfg.seeMoreUrl || defaultSeeMore,
                  items: resolvedItems,
                })
              }
            }

            // Nếu không có bất kỳ tab nào có dữ liệu -> Tự động ẩn toàn bộ Section khỏi Trang chủ
            if (resolvedTabs.length === 0) return null

            const topSeeMoreUrl = resolvedTabs[0]?.seeMoreUrl || '/danh-cho-nguoi-benh'

            return (
              <section className="sectionPro configurableHomeSection homePatientServicesSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow}</span>
                      <h2>{cfg.title}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    <a href={topSeeMoreUrl}>Xem tất cả dịch vụ →</a>
                  </div>
                  <HomePatientServiceTabs tabs={resolvedTabs} />
                </div>
              </section>
            )
          }

          if (type === 'notices' || type === 'procurement') {
            const hasBoth = configuredSections.some((s: any) => s?.type === 'notices' && s.visible !== false) &&
                            configuredSections.some((s: any) => s?.type === 'procurement' && s.visible !== false)
            
            // Nếu cả 2 đều bật và đây là section thứ hai (procurement khi notices đứng trước, hoặc notices khi procurement đứng trước) -> bỏ qua để không bị render đúp
            if (hasBoth) {
              const firstPairType = configuredSections.find((s: any) => (s?.type === 'notices' || s?.type === 'procurement') && s.visible !== false)?.type
              if (type !== firstPairType) {
                return null
              }
            }

            const noticeItem = configuredSections.find((s: any) => s?.type === 'notices') || {}
            const procItem = configuredSections.find((s: any) => s?.type === 'procurement') || {}
            const noticeCfg = { ...(sectionDefaults['notices'] || {}), ...noticeItem }
            const procCfg = { ...(sectionDefaults['procurement'] || {}), ...procItem }

            const showNoticeCol = noticeItem.visible !== false
            const showProcCol = procItem.visible !== false

            // Thông báo hiển thị 5 ô, Đấu thầu hiển thị 3 ô (giá trị cố định; nếu cần thay đổi sửa tại đây)
            const noticeLimit = 5
            const procLimit = 3

            // Lọc thông báo hiển thị ở mục Thông báo (notices hoặc both hoặc chưa gán)
            const filteredNotices = notices.filter((n: any) => {
              const placement = n.homePlacement || 'notices'
              return placement === 'notices' || placement === 'both'
            })
            const noticeList = filteredNotices.slice(0, noticeLimit)

            return (
              <section className="sectionPro configurableHomeSection homeNoticeProcurementPairSection" style={style} key={key}>
                <div className="container">
                  <div className={`noticeProcurementPairGrid ${!showNoticeCol || !showProcCol ? 'singleCol' : ''}`}>
                    {/* CỘT 1: THÔNG BÁO MỚI */}
                    {showNoticeCol && (
                      <div className="pairColumn noticeCol">
                        <div className="pairColHead">
                          <div className="pairColHeadLeft">
                            <span className="pairColKicker">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                              </svg>
                              {noticeCfg.eyebrow || 'THÔNG BÁO'}
                            </span>
                            <h2 className="pairColTitle">{noticeCfg.title || 'Thông báo mới'}</h2>
                            {noticeCfg.description && <p className="pairColDesc">{noticeCfg.description}</p>}
                          </div>
                          <a className="pairColSeeAll" href="/thong-bao">
                            Xem tất cả <span>→</span>
                          </a>
                        </div>

                        <div className="pairColList">
                          {noticeList.length > 0 ? (
                            noticeList.map((notice: any) => {
                              const d = notice.publishedAt ? new Date(notice.publishedAt) : (notice.startAt ? new Date(notice.startAt) : null)
                              const day = d ? String(d.getDate()).padStart(2, '0') : '--'
                              const month = d ? `Th${d.getMonth() + 1}` : 'MỚI'
                              const levelClass = notice.level === 'urgent' ? 'urgent' : (notice.level === 'important' ? 'important' : 'normal')
                              const levelText = notice.level === 'urgent' ? 'Khẩn' : (notice.level === 'important' ? 'Quan trọng' : 'Thông báo')
                              const categoryText = typeof notice.category === 'object' ? notice.category?.title || notice.category?.name : notice.category

                              return (
                                <a className="noticeCardItem" href={`/thong-bao/${notice.slug}`} key={notice.id}>
                                  <div className="noticeDateBlock" aria-hidden="true">
                                    <span className="noticeDateDay">{day}</span>
                                    <span className="noticeDateMonth">{month}</span>
                                  </div>
                                  <div className="noticeCardBody">
                                    <div className="noticeCardMeta">
                                      <span className={`noticeCardBadge ${levelClass}`}>
                                        {levelText}
                                      </span>
                                      {categoryText && (
                                        <span className="noticeCardCategory">{categoryText}</span>
                                      )}
                                    </div>
                                    <h3 className="noticeCardTitle">{notice.title}</h3>
                                    {notice.excerpt && (
                                      <p className="noticeCardExcerpt">{notice.excerpt}</p>
                                    )}
                                  </div>
                                </a>
                              )
                            })
                          ) : (
                            <div className="pairColEmpty">Chưa có thông báo được đăng.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CỘT 2: ĐẤU THẦU – MUA SẮM */}
                    {showProcCol && (
                      <div className="pairColumn procurementCol">
                        <div className="pairColHead">
                          <div className="pairColHeadLeft">
                            <span className="pairColKicker">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                              </svg>
                              {procCfg.eyebrow || 'CÔNG KHAI MUA SẮM'}
                            </span>
                            <h2 className="pairColTitle">{procCfg.title || 'Đấu thầu – Mua sắm'}</h2>
                            {procCfg.description && <p className="pairColDesc">{procCfg.description}</p>}
                          </div>
                          <a className="pairColSeeAll" href="/dau-thau-mua-sam">
                            Xem tất cả <span>→</span>
                          </a>
                        </div>

                        <HomeProcurementTabs items={procurement} limit={procLimit} />
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )
          }

          if (type === 'schedules') {
            return (
              <section id="schedules" className="sectionPro configurableHomeSection homeScheduleSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead"><div><span className="sectionKicker">{cfg.eyebrow}</span><h2>{cfg.title}</h2>{cfg.description && <p>{cfg.description}</p>}</div><a href="/lich-kham">Xem tất cả →</a></div>
                  <ScheduleExplorer daily={homeDailySchedules} nurse={homeNurseSchedules} weekly={homeWeeklySchedules} attachments={homeAttachedSchedules} emergency={homeEmergencySchedules} medpro={medpro} tabOrder={scheduleTabOrder.length ? scheduleTabOrder : undefined} tabs={scheduleTabs.length ? scheduleTabs : undefined} compact />
                </div>
              </section>
            )
          }

          if (type === 'vaccination-portal-services') {
            const rawVaxTabs = Array.isArray(item.portalVaccinationTabs) ? item.portalVaccinationTabs : []
            const defaultVaxSourceTabs = [
              { label: 'Các loại vắc xin', source: 'vaccines', enabled: true },
              { label: 'Tiêm ngừa theo đợt', source: 'campaigns', enabled: true },
              { label: 'Thông báo lịch tiêm', source: 'announcements', enabled: true },
            ]
            const sourceVaxTabs = rawVaxTabs.length > 0 ? rawVaxTabs : defaultVaxSourceTabs

            const customVaxTabs: any[] = []
            for (const tCfg of sourceVaxTabs) {
              if (tCfg.enabled === false) continue
              const tLimit = Math.min(30, Math.max(1, Number(tCfg.limit || 8)))
              const manualItems = (tCfg.manualItems || []).map((m: any, mIdx: number) => ({
                id: `vax-manual-${mIdx}`,
                title: m.title,
                desc: m.desc,
                badge: m.badge,
                icon: m.icon || '💉',
                priceText: m.priceText,
                href: m.href || '/tiem-chung',
                buttonText: m.buttonText || 'Xem chi tiết →',
              }))

              customVaxTabs.push({
                label: tCfg.label?.trim() || 'Tiêm chủng',
                kind: tCfg.source,
                limit: tLimit,
                customBadge: tCfg.customBadge,
                seeMoreUrl: tCfg.seeMoreUrl || '/tiem-chung',
                manualItems,
              })
            }

            // Kiểm tra xem có dữ liệu nào không
            const hasAnyData = (
              homeVaccines.length > 0 ||
              homeVaccinationCampaigns.length > 0 ||
              homeVaccinationAnnouncements.length > 0 ||
              customVaxTabs.some(t => t.manualItems?.length > 0)
            )
            if (!hasAnyData) return null

            const vaxBookBtnText = vaxSettingsData?.bookButtonText || 'Đăng ký tiêm'
            const vaxDetailBtnText = vaxSettingsData?.detailButtonText || 'Chi tiết'
            const vaxItemsPerView = typeof vaxSettingsData?.itemsPerView === 'number' ? vaxSettingsData.itemsPerView : 3
            const vaxAutoplaySec = typeof vaxSettingsData?.autoplaySeconds === 'number' ? vaxSettingsData.autoplaySeconds : 5

            return (
              <section className="sectionPro configurableHomeSection homeVaccinationSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow}</span>
                      <h2>{cfg.title}</h2>
                      <p>{cfg.description}</p>
                    </div>
                    <a href="/tiem-chung">Xem tất cả →</a>
                  </div>
                  <VaccinationTabs
                    announcements={homeVaccinationAnnouncements}
                    campaigns={homeVaccinationCampaigns}
                    vaccines={homeVaccines}
                    medpro={medpro}
                    tabs={customVaxTabs}
                    bookButtonText={vaxBookBtnText}
                    detailButtonText={vaxDetailBtnText}
                    itemsPerView={vaxItemsPerView}
                    autoplaySeconds={vaxAutoplaySec}
                    compact
                  />
                </div>
              </section>
            )
          }

          if (type === 'vaccinations') {
            const vaxBookBtnText = vaxSettingsData?.bookButtonText || 'Đăng ký tiêm'
            const vaxDetailBtnText = vaxSettingsData?.detailButtonText || 'Chi tiết'
            const vaxItemsPerView = typeof vaxSettingsData?.itemsPerView === 'number' ? vaxSettingsData.itemsPerView : 3
            const vaxAutoplaySec = typeof vaxSettingsData?.autoplaySeconds === 'number' ? vaxSettingsData.autoplaySeconds : 5

            return (
              <section className="sectionPro configurableHomeSection homeVaccinationSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow}</span>
                      <h2>{cfg.title}</h2>
                      <p>{cfg.description}</p>
                    </div>
                    <a href="/tiem-chung">Xem tất cả →</a>
                  </div>
                  <VaccinationTabs
                    announcements={homeVaccinationAnnouncements}
                    campaigns={homeVaccinationCampaigns}
                    vaccines={homeVaccines}
                    medpro={medpro}
                    tabOrder={vaccinationTabOrder.length ? vaccinationTabOrder : undefined}
                    tabs={vaccinationTabs.length ? vaccinationTabs : undefined}
                    bookButtonText={vaxBookBtnText}
                    detailButtonText={vaxDetailBtnText}
                    itemsPerView={vaxItemsPerView}
                    autoplaySeconds={vaxAutoplaySec}
                    compact
                  />
                </div>
              </section>
            )
          }

          if (type === 'science') {
            if (!scientificActivities || scientificActivities.length === 0) return null
            return <section className="sectionPro configurableHomeSection homePortalNewsSection homePortalPage homeScienceSection" style={style} key={key}><div className="container"><div className="homeSectionHead"><div><span className="sectionKicker">{cfg.eyebrow}</span><h2>{cfg.title}</h2>{cfg.description && <p>{cfg.description}</p>}</div><a href="/hoat-dong-khoa-hoc">Xem toàn bộ bài viết →</a></div><HomeScienceTabs items={scientificActivities.map((article) => ({ id: article.id, title: article.title, slug: article.slug, category: scientificActivityGroupName(article), excerpt: article.excerpt, date: article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('vi-VN') : '', coverUrl: mediaUrl(article.cover || article.seoImage) || defaultMedia.news, href: `/hoat-dong-khoa-hoc/${article.slug}` }))} tabs={scientificActivityGroups.map((group) => ({ label: group.name, categories: [group.name] }))} /></div></section>
          }

          if (type === 'documents') {
            const docLimit = Math.min(20, Math.max(1, Number(item.layoutItemLimit || 6)))

            const normalDocItems = documents
              .filter((docItem: any) => {
                if (docItem.showOnHome === false) return false
                const placement = docItem.homePlacement || 'documents'
                return placement === 'documents' || placement === 'both'
              })
              .map((docItem: any) => {
                const fileLink = mediaUrl(docItem.file)
                const isLocked = docItem.accessMode === 'pin' || docItem.accessMode === 'internal' || docItem.accessMode === 'locked' || docItem.accessMode === 'view_only' || docItem.allowDownload === false
                return {
                id: `doc-${docItem.id}`,
                href: docItem.slug ? `/van-ban/${docItem.slug}` : (fileLink || '/van-ban'),
                title: docItem.title,
                number: docItem.number || 'Chưa số',
                issuer: docItem.issuer || 'Bệnh viện Đa khoa Khu vực Thới Lai',
                excerpt: docItem.summary || 'Văn bản, biểu mẫu và tài liệu chỉ đạo điều hành công khai của bệnh viện.',
                dateValue: docItem.issuedAt || docItem.updatedAt,
                date: docItem.issuedAt ? new Date(docItem.issuedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
                category: docItem.documentType || docItem.type || docItem.category || 'Văn bản – Tài liệu',
                fileUrl: fileLink,
                isProtocol: false,
                accessMode: docItem.accessMode || 'public',
                isPinProtected: docItem.accessMode === 'pin',
                isViewOnly: docItem.accessMode === 'view_only',
                canDownload: !isLocked && Boolean(fileLink),
              }
            })

            const cpDocItems = clinicalProtocols.map((cpItem: any) => {
              const specs = Array.isArray(cpItem.specialty)
                ? cpItem.specialty.map((s: any) => (typeof s === 'object' && s?.name ? s.name : '')).filter(Boolean)
                : (typeof cpItem.specialty === 'object' && cpItem.specialty?.name ? [cpItem.specialty.name] : [])
              const spec = specs.join(', ')
              const cat = spec ? `Phác đồ (${spec})` : (cpItem.documentType || 'Phác đồ điều trị')
              const fileLink = mediaUrl(cpItem.file)
              const isLocked = cpItem.accessMode === 'pin' || cpItem.accessMode === 'internal' || cpItem.accessMode === 'locked' || cpItem.accessMode === 'view_only' || cpItem.allowDownload === false
              return {
                id: `cp-${cpItem.id}`,
                href: cpItem.slug ? `/phac-do-dieu-tri/${cpItem.slug}` : (fileLink || '/phac-do-dieu-tri'),
                title: cpItem.title,
                number: cpItem.code || 'Phác đồ KCB',
                issuer: cpItem.issuer || 'Hội đồng Khoa học Kỹ thuật BVĐK Thới Lai',
                excerpt: cpItem.summary || 'Phác đồ điều trị và hướng dẫn chẩn đoán chuyên môn chuẩn hóa.',
                dateValue: cpItem.issuedAt || cpItem.updatedAt,
                date: cpItem.issuedAt ? new Date(cpItem.issuedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
                category: cat,
                fileUrl: fileLink,
                isProtocol: true,
                accessMode: cpItem.accessMode || 'public',
                isPinProtected: cpItem.accessMode === 'pin',
                isViewOnly: cpItem.accessMode === 'view_only',
                canDownload: !isLocked && Boolean(fileLink),
              }
            })

            const allDocItems = [...normalDocItems, ...cpDocItems]
              .sort((a, b) => new Date(b.dateValue || 0).getTime() - new Date(a.dateValue || 0).getTime())
              .slice(0, docLimit)

            const docCols = String(item.documentColumns || '3')
            const gridColClass = docCols === '5' ? 'cols-5' : docCols === '4' ? 'cols-4' : 'cols-3'

            return (
              <section className="sectionPro configurableHomeSection homeDocumentsSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      <span className="sectionKicker">{cfg.eyebrow}</span>
                      <h2>{cfg.title}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    <a href="/van-ban">Xem tất cả văn bản →</a>
                  </div>

                  {allDocItems.length > 0 ? (
                    <div className={`homeDocDossierGrid ${gridColClass}`}>
                      {allDocItems.map((doc) => (
                        <div className="homeDocDossierCard" key={doc.id}>
                          <div className="homeDocCardHeader">
                            <div className={`homeDocCardIconWrap ${doc.fileUrl ? 'pdfFormat' : ''}`} aria-hidden="true">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                              </svg>
                              <span className="homeDocFileFormatText">PDF</span>
                            </div>

                            <div className="homeDocCardMetaTop">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className={`homeDocTypeBadge ${doc.isProtocol ? 'protocolBadge' : ''}`}>
                                  {doc.category}
                                </span>
                                {doc.isViewOnly && (
                                  <span className="homeDocViewOnlyBadge" title="Chế độ chỉ xem trực tuyến, nghiêm cấm tải về, sao chép và in ấn">
                                    👁️ Chỉ xem
                                  </span>
                                )}
                                {doc.isPinProtected && (
                                  <span className="homeDocLockBadge" title="Văn bản yêu cầu mã PIN xác thực để xem nội dung và tải về">
                                    🔒 Mã PIN
                                  </span>
                                )}
                              </div>
                              <div className="homeDocNumberBox">
                                <span>Số:</span>
                                <span className="homeDocNumberCode">{doc.number}</span>
                              </div>
                            </div>
                          </div>

                          <div className="homeDocCardBody">
                            <a href={doc.href} className="homeDocCardTitle" title={doc.title}>
                              {doc.title}
                            </a>
                            <p className="homeDocCardSummary">{doc.excerpt}</p>

                            <div className="homeDocCardSpecs">
                              <div className="homeDocSpecRow">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span>Ngày ban hành: <strong style={{ color: '#334155' }}>{doc.date}</strong></span>
                              </div>
                              <div className="homeDocSpecRow">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span title={doc.issuer}>Cơ quan: {doc.issuer}</span>
                              </div>
                            </div>
                          </div>

                          <div className="homeDocCardFooter">
                            <a href={doc.href} className="homeDocActionView">
                              <span>Xem chi tiết</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </a>

                            {doc.canDownload ? (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="homeDocActionDownload"
                                title="Mở hoặc tải về tệp PDF đính kèm"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Tải PDF</span>
                              </a>
                            ) : doc.isViewOnly ? (
                              <span className="homeDocActionViewOnly" title="Văn bản chỉ cho phép xem trực tuyến, không được phép tải về máy">
                                👁️ Chỉ xem
                              </span>
                            ) : doc.isPinProtected ? (
                              <span className="homeDocActionLocked" title="Nhập mã PIN trong trang chi tiết để mở khóa tải về">
                                🔒 Khóa tải
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="homeDocDossierEmpty">Chưa có văn bản nào được đăng tải.</div>
                  )}
                </div>
              </section>
            )
          }


          if (type === 'content-section') {
            const relationId = typeof item.linkedContentSection === 'object' ? item.linkedContentSection?.id : item.linkedContentSection
            const linkedSection = contentSections.find((section: any) => String(section.id) === String(relationId)) || (typeof item.linkedContentSection === 'object' ? item.linkedContentSection : null)
            if (!linkedSection) return null
            const csLayout = item.sectionLayout || 'editorial-grid'
            const csLimit = Math.min(20, Math.max(1, Number(item.layoutItemLimit || item.linkedContentLimit || 5)))
            const fallback = mediaUrl(linkedSection.defaultImage || linkedSection.seoImage)
            const sectionHref = `/${linkedSection.slug}`
            const sectionPosts = customPosts.filter((post: any) => String(typeof post.section === 'object' ? post.section?.id : post.section) === String(linkedSection.id)).slice(0, csLimit)
            const csItems = sectionPosts.map((post: any) => ({
              id: post.id,
              href: `${sectionHref}/${post.slug}`,
              cover: mediaUrl(post.cover || post.seoImage) || fallback,
              title: post.title,
              excerpt: post.excerpt || `Thông tin mới thuộc mục ${linkedSection.title}.`,
              date: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
              category: post.category || '',
              coverFit: post.coverFit || 'cover',
              coverPosition: post.coverPosition || 'top',
            }))
            return (
              <section className="sectionPro configurableHomeSection homeDynamicContentSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead"><div><span className="sectionKicker">{item.eyebrow || 'NỘI DUNG'}</span><h2>{item.title || linkedSection.title}</h2>{(item.description || linkedSection.description) && <p>{item.description || linkedSection.description || `Các bài viết mới thuộc mục ${linkedSection.title}.`}</p>}</div><a href={sectionHref}>Xem tất cả →</a></div>
                  {renderEditorialSection({ items: csItems, layout: csLayout, showDate: item.layoutShowDate !== false, showCategory: item.layoutShowCategory !== false, showExcerpt: item.layoutShowExcerpt !== false, badgeOverride: item.layoutCardBadge || String(linkedSection.title || 'NỘI DUNG').toUpperCase(), emptyText: `Chưa có bài viết trong mục ${linkedSection.title}.`, actionText: item.heroActionText || `Xem ${linkedSection.title} →` })}
                </div>
              </section>
            )
          }

          if (type === 'cantho-health-dept') {
            const sytLayout = item.sectionLayout || 'editorial-grid'
            const sytLimit = Math.min(20, Math.max(1, Number(item.layoutItemLimit || 5)))

            // 1. Danh sách bài viết lấy tự động từ Crawler Cổng Sở Y tế Cần Thơ
            const sytNewsList = canthoHealthNews && canthoHealthNews.length > 0 ? canthoHealthNews : FALLBACK_ITEMS
            const autoSytArticles = sytNewsList.slice(0, sytLimit).map((art: any) => ({
              id: `syt-${art.id}`,
              href: art.href,
              cover: art.cover || defaultMedia.news,
              title: art.title,
              excerpt: art.excerpt || 'Thông tin, văn bản chỉ đạo điều hành từ Cổng thông tin điện tử Sở Y tế TP Cần Thơ.',
              date: art.date || 'Mới cập nhật',
              category: art.category || 'Sở Y tế Cần Thơ',
              coverFit: 'cover',
              coverPosition: 'top',
              isExternal: true,
            }))

            // 2. Cấu hình các Tabs (mặc định có 1 tab Sở Y tế Cần Thơ)
            const rawLinkedTabs = Array.isArray(item.linkedWebsitesTabs) ? item.linkedWebsitesTabs : []
            const defaultLinkedTabs = [
              {
                enabled: true,
                label: 'Sở Y tế TP. Cần Thơ',
                source: 'cantho-syt',
                seeMoreUrl: 'https://soyte.cantho.gov.vn/',
                seeMoreText: 'Xem tất cả tại soyte.cantho.gov.vn ↗',
              },
            ]
            const sourceTabs = rawLinkedTabs.length > 0 ? rawLinkedTabs : defaultLinkedTabs

            // 3. Chuẩn hóa dữ liệu bài viết cho từng Tab
            const configuredTabs: any[] = []
            for (const tCfg of sourceTabs) {
              if (tCfg.enabled === false) continue

              let tabArticles: any[] = []

              if (tCfg.source === 'cantho-syt') {
                tabArticles = autoSytArticles
              } else if (tCfg.source === 'auto-feed') {
                // Tab quét tin tự động từ website / RSS feed
                const feedUrl = tCfg.feedUrl?.trim() || ''
                const autoItems = (autoFeedNewsMap.get(feedUrl) || []).slice(0, sytLimit)
                tabArticles = autoItems.map((a: any, aIdx: number) => ({
                  id: `linked-auto-${a.id || aIdx}`,
                  href: a.href || '#',
                  cover: a.cover || defaultMedia.news,
                  title: a.title,
                  excerpt: a.excerpt || '',
                  date: a.date || 'Mới cập nhật',
                  category: a.category || tCfg.label,
                  coverFit: 'cover',
                  coverPosition: 'top',
                  isExternal: true,
                }))
              } else {
                // Tab nhập thủ công
                const mItems = Array.isArray(tCfg.manualItems) ? tCfg.manualItems : []
                tabArticles = mItems.slice(0, sytLimit).map((m: any, mIdx: number) => ({
                  id: `linked-m-${m.id || mIdx}`,
                  href: m.url || '#',
                  cover: mediaUrl(m.cover) || m.coverUrl || defaultMedia.news,
                  title: m.title,
                  excerpt: m.excerpt || '',
                  date: m.date || 'Mới cập nhật',
                  category: m.category || tCfg.label,
                  coverFit: 'cover',
                  coverPosition: 'top',
                  isExternal: true,
                }))
              }

              configuredTabs.push({
                id: tCfg.id || tCfg.label,
                enabled: tCfg.enabled !== false,
                label: tCfg.label?.trim() || 'Đơn vị liên kết',
                source: tCfg.source,
                badge: tCfg.badge,
                seeMoreUrl: tCfg.seeMoreUrl || (tCfg.source === 'cantho-syt' ? 'https://soyte.cantho.gov.vn/' : (tCfg.source === 'auto-feed' ? tCfg.feedUrl : undefined)),
                seeMoreText: tCfg.seeMoreText || `Xem tất cả tại ${tCfg.label} ↗`,
                items: tabArticles,
              })
            }

            // Nếu không có tab nào hợp lệ thì không render
            if (configuredTabs.length === 0) return null

            return (
              <section className="sectionPro configurableHomeSection homeCanThoHealthDeptSection homePortalPage" style={style} key={key}>
                <div className="container">
                  <HomeLinkedWebsitesTabs
                    tabs={configuredTabs}
                    layout={sytLayout}
                    showDate={item.layoutShowDate !== false}
                    showCategory={item.layoutShowCategory !== false}
                    showExcerpt={item.layoutShowExcerpt !== false}
                    badgeOverride={item.layoutCardBadge}
                    eyebrow={cfg.eyebrow || 'CHỈ ĐẠO & TIN TỨC NGÀNH'}
                    title={cfg.title || 'Cổng thông tin Liên kết & Chỉ đạo ngành'}
                    description={cfg.description || 'Cập nhật tin tức hoạt động, văn bản chỉ đạo điều hành từ các cơ quan, đơn vị y tế liên kết.'}
                    defaultSeeMoreUrl="https://soyte.cantho.gov.vn/"
                  />
                </div>
              </section>
            )
          }

          if (type === 'dynamic-module') {
            const module = typeof item.dynamicModule === 'object' ? item.dynamicModule : null
            if (!module || module.active === false) return null
            const image = mediaUrl(module.image, 'article')
            return <section className="sectionPro configurableHomeSection customHomepageSection" style={style} key={key}><div className={`container customHomepageLayout left ${image ? 'hasImage' : 'withoutImage'}`}>{image && <div className="customHomepageImage"><img src={image} alt={module.title || cfg.title || 'Hình ảnh module'} /></div>}<div className="customHomepageContent">{(cfg.eyebrow || module.eyebrow) && <span className="sectionKicker">{cfg.eyebrow || module.eyebrow}</span>}<h2>{cfg.title || module.title}</h2>{(cfg.description || module.description) && <p className="sectionDescription">{cfg.description || module.description}</p>}{module.content && <div className="customRichText"><RichText data={module.content} /></div>}{module.buttonLabel && module.buttonUrl && <a className="homeSolidButton customSectionButton" href={module.buttonUrl}>{module.buttonLabel} →</a>}</div></div></section>
          }

          if (type === 'custom-carousel') {
            const rawCards = Array.isArray(item.customCarouselCards) ? item.customCarouselCards : []
            const activeCards = rawCards.filter((c: any) => c && c.enabled !== false && c.title)
            if (activeCards.length === 0) return null

            const itemsPerView = typeof item.carouselItemsPerView === 'number' ? item.carouselItemsPerView : 3
            const autoplaySeconds = typeof item.carouselAutoplaySeconds === 'number' ? item.carouselAutoplaySeconds : 5
            const defaultDetailText = item.carouselDetailBtnText || 'Chi tiết'
            const defaultActionText = item.carouselActionBtnText || 'Đăng ký ngay'
            const seeMoreUrl = item.carouselSeeMoreUrl
            const seeMoreText = item.carouselSeeMoreText || 'Xem tất cả →'

            return (
              <section className="sectionPro configurableHomeSection homeCustomCarouselSection" style={style} key={key}>
                <div className="container">
                  <div className="homeSectionHead">
                    <div>
                      {cfg.eyebrow && <span className="sectionKicker">{cfg.eyebrow}</span>}
                      <h2>{cfg.title}</h2>
                      {cfg.description && <p>{cfg.description}</p>}
                    </div>
                    {seeMoreUrl && (
                      <a href={seeMoreUrl}>{seeMoreText}</a>
                    )}
                  </div>
                  <CustomCardsCarousel
                    cards={activeCards.map((c: any) => ({
                      id: c.id,
                      enabled: c.enabled,
                      title: c.title,
                      code: c.code,
                      statusText: c.statusText,
                      statusType: c.statusType,
                      origin: c.origin,
                      image: c.image,
                      summary: c.summary,
                      spec1Key: c.spec1Key,
                      spec1Val: c.spec1Val,
                      spec2Key: c.spec2Key,
                      spec2Val: c.spec2Val,
                      spec3Key: c.spec3Key,
                      spec3Val: c.spec3Val,
                      priceLabel: c.priceLabel,
                      priceValue: c.priceValue,
                      detailUrl: c.detailUrl,
                      detailBtnText: c.detailBtnText,
                      actionUrl: c.actionUrl,
                      actionBtnText: c.actionBtnText,
                    }))}
                    itemsPerView={itemsPerView}
                    autoplaySeconds={autoplaySeconds}
                    defaultDetailBtnText={defaultDetailText}
                    defaultActionBtnText={defaultActionText}
                  />
                </div>
              </section>
            )
          }

          if (type === 'partner-banners') {
            const rawBanners = Array.isArray(item.partnerBanners) ? item.partnerBanners : []
            const activeBanners = rawBanners.filter((b: any) => b && b.enabled !== false && b.title?.trim() && b.url?.trim())
            if (activeBanners.length === 0) return null

            return (
              <section className="sectionPro configurableHomeSection homePartnerBannersSection" style={style} key={key}>
                <div className="container">
                  <HomePartnerBanners
                    banners={activeBanners}
                    columns={item.bannerColumns || '4'}
                    motionMode={item.bannerMotionMode || 'marquee'}
                    autoplaySpeed={Number(item.bannerAutoplaySpeed) || 5}
                    eyebrow={cfg.eyebrow}
                    title={cfg.title}
                    description={cfg.description}
                  />
                </div>
              </section>
            )
          }

          if (type === 'health-warnings' || type === 'legal-dissemination') {
            const hasBoth = configuredSections.some((s: any) => s?.type === 'health-warnings' && s.visible !== false) &&
                            configuredSections.some((s: any) => s?.type === 'legal-dissemination' && s.visible !== false)

            // Nếu cả 2 đều bật và đây là section thứ hai -> bỏ qua để không bị render đúp
            if (hasBoth) {
              const firstPairType = configuredSections.find((s: any) => (s?.type === 'health-warnings' || s?.type === 'legal-dissemination') && s.visible !== false)?.type
              if (type !== firstPairType) {
                return null
              }
            }

            const warningItemCfg = configuredSections.find((s: any) => s?.type === 'health-warnings') || {}
            const legalItemCfg = configuredSections.find((s: any) => s?.type === 'legal-dissemination') || {}
            const warningCfg = { ...(sectionDefaults['health-warnings'] || {}), ...warningItemCfg }
            const legalCfg = { ...(sectionDefaults['legal-dissemination'] || {}), ...legalItemCfg }

            const showWarningCol = warningItemCfg.visible !== false
            const showLegalCol = legalItemCfg.visible !== false

            // DỮ LIỆU CẢNH BÁO: Ưu tiên collection health_warnings độc lập, fallback sang notices cũ
            const warningNotices = notices.filter((n: any) => {
              const placement = n.homePlacement
              if (placement === 'warning' || placement === 'both') return true
              if (placement === 'notices') return false

              const catName = (typeof n.category === 'object' ? n.category?.name : n.category || '').toLowerCase()
              const titleLower = (n.title || '').toLowerCase()
              return (
                n.level === 'urgent' ||
                n.level === 'important' ||
                catName.includes('cảnh báo') ||
                titleLower.includes('cảnh báo') ||
                titleLower.includes('khuyến cáo')
              )
            })
            const rawWarningList = healthWarnings.length > 0 ? healthWarnings : warningNotices
            const displayWarningList = rawWarningList.slice(0, 4)

            // DỮ LIỆU PHỔ BIẾN PHÁP LUẬT
            const legalDocs = documents.filter((d: any) => {
              if (d.showOnHome === false) return false
              const placement = d.homePlacement
              if (placement === 'legal' || placement === 'both') return true
              if (placement === 'documents') return false

              const catName = (typeof d.category === 'object' ? d.category?.name : d.category || '').toLowerCase()
              const docType = (d.documentType || '').toLowerCase()
              const titleLower = (d.title || '').toLowerCase()
              return (
                catName.includes('pháp luật') ||
                catName.includes('pháp quy') ||
                catName.includes('luật') ||
                catName.includes('thông tư') ||
                catName.includes('nghị định') ||
                docType.includes('luật') ||
                docType.includes('thông tư') ||
                docType.includes('nghị định') ||
                titleLower.includes('luật') ||
                titleLower.includes('nghị định') ||
                titleLower.includes('thông tư') ||
                titleLower.includes('chỉ thị')
              )
            })
            const displayLegalList = legalDocs.slice(0, 4)

            // Nếu cả 2 đều không có dữ liệu để hiển thị thì ẩn section
            if (displayWarningList.length === 0 && displayLegalList.length === 0) return null

            return (
              <section className="sectionPro configurableHomeSection homeNoticeProcurementPairSection homeWarningsLegalPairSection" style={style} key={key}>
                <div className="container">
                  <div className={`noticeProcurementPairGrid warningsLegalPairGrid ${!showWarningCol || !showLegalCol ? 'singleCol' : ''}`}>
                    {/* CỘT 1: CẢNH BÁO Y TẾ & CỘNG ĐỒNG */}
                    {showWarningCol && (
                      <div className="pairColumn warningPairCol">
                        <div className="pairColHead">
                          <div className="pairColHeadLeft">
                            <span className="pairColKicker">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              {warningCfg.eyebrow || 'CẢNH BÁO KHẨN'}
                            </span>
                            <h2 className="pairColTitle">{warningCfg.title || 'Cảnh báo y tế & Cộng đồng'}</h2>
                            {warningCfg.description && <p className="pairColDesc">{warningCfg.description}</p>}
                          </div>
                          <a className="pairColSeeAll" href="/goc-canh-bao">
                            Xem tất cả <span>→</span>
                          </a>
                        </div>

                        <div className="pairColList">
                          {displayWarningList.length > 0 ? (
                            displayWarningList.map((notice: any) => {
                              const d = notice.publishedAt ? new Date(notice.publishedAt) : (notice.startAt ? new Date(notice.startAt) : null)
                              const day = d ? String(d.getDate()).padStart(2, '0') : '--'
                              const month = d ? String(d.getMonth() + 1).padStart(2, '0') : '--'
                              const year = d ? d.getFullYear() : ''
                              const fullDateStr = d ? `${day}/${month}/${year}` : ''
                              const levelClass = notice.level === 'urgent' ? 'urgent' : (notice.level === 'important' ? 'important' : 'normal')
                              const levelText = notice.level === 'urgent' ? 'Khẩn' : (notice.level === 'important' ? 'Quan trọng' : 'Cảnh báo')
                              const categoryText = typeof notice.category === 'object' ? notice.category?.title || notice.category?.name : (notice.category || 'Cảnh báo')

                              const coverImg = mediaUrl(notice.cover || notice.seoImage) || defaultMedia.notices

                              return (
                                <a className="warningCardItem hasThumb" href={`/goc-canh-bao/${notice.slug}`} key={notice.id}>
                                  <div className="warningThumbBlock" aria-hidden="true">
                                    <img
                                      src={coverImg}
                                      alt=""
                                      loading="lazy"
                                      className="warningThumbImg"
                                      style={{
                                        objectFit: notice.coverFit === 'cover' ? 'cover' : 'contain',
                                        objectPosition: notice.coverPosition ? (notice.coverPosition === 'center' ? 'center center' : (notice.coverPosition === 'bottom' ? 'center bottom' : 'top center')) : 'center center',
                                      }}
                                    />
                                  </div>
                                  <div className="warningCardBody">
                                    <div className="warningCardMeta">
                                      <span className={`warningCardBadge ${levelClass}`}>
                                        {levelText}
                                      </span>
                                      {categoryText && (
                                        <span className="noticeCardCategory">{categoryText}</span>
                                      )}
                                      {fullDateStr && (
                                        <span className="warningCardDate">
                                          {fullDateStr}
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="warningCardTitle">{notice.title}</h3>
                                    {notice.excerpt && (
                                      <p className="warningCardExcerpt">{notice.excerpt}</p>
                                    )}
                                  </div>
                                </a>
                              )
                            })
                          ) : (
                            <div className="pairColEmpty">Hiện chưa có cảnh báo y tế khẩn cấp.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CỘT 2: PHỔ BIẾN VĂN BẢN PHÁP LUẬT */}
                    {showLegalCol && (
                      <div className="pairColumn legalPairCol">
                        <div className="pairColHead">
                          <div className="pairColHeadLeft">
                            <span className="pairColKicker">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                <line x1="9" y1="7" x2="15" y2="7" />
                                <line x1="9" y1="11" x2="15" y2="11" />
                              </svg>
                              {legalCfg.eyebrow || 'PHÁP LUẬT Y TẾ'}
                            </span>
                            <h2 className="pairColTitle">{legalCfg.title || 'Phổ biến văn bản pháp luật'}</h2>
                            {legalCfg.description && <p className="pairColDesc">{legalCfg.description}</p>}
                          </div>
                          <a className="pairColSeeAll" href="/van-ban">
                            Xem tất cả <span>→</span>
                          </a>
                        </div>

                        <div className="pairColList">
                          {displayLegalList.length > 0 ? (
                            displayLegalList.map((doc: any) => {
                              const d = doc.issuedAt ? new Date(doc.issuedAt) : null
                              const dateStr = d ? d.toLocaleDateString('vi-VN') : 'Mới'
                              const cat = typeof doc.category === 'object' ? doc.category?.name : (doc.category || doc.documentType || 'VĂN BẢN')
                              const href = doc.slug ? `/van-ban/${doc.slug}` : (mediaUrl(doc.file) || '/van-ban')

                              return (
                                <a className="legalPairCardItem" href={href} key={doc.id}>
                                  <div className="legalDocIconBlock" aria-hidden="true">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                      <line x1="16" y1="13" x2="8" y2="13" />
                                      <line x1="16" y1="17" x2="8" y2="17" />
                                      <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                  </div>
                                  <div className="legalDocCardBody">
                                    <div className="legalDocCardMeta">
                                      <span className="legalDocBadge">{cat}</span>
                                      {doc.number && (
                                        <span className="legalDocNumber">Số: {doc.number}</span>
                                      )}
                                      <span className="legalDocDate">{dateStr}</span>
                                    </div>
                                    <h3 className="legalDocCardTitle">{doc.title}</h3>
                                    {doc.summary && (
                                      <p className="legalDocCardExcerpt">{doc.summary}</p>
                                    )}
                                  </div>
                                </a>
                              )
                            })
                          ) : (
                            <div className="pairColEmpty">Chưa có văn bản pháp luật được đăng tải.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )
          }

          if (type === 'custom') {
            const image = mediaUrl(item.customImage, 'article')
            return <section className="sectionPro configurableHomeSection customHomepageSection" style={style} key={key}><div className={`container customHomepageLayout ${item.imagePosition || 'left'} ${image ? 'hasImage' : 'withoutImage'}`}>{image && <div className="customHomepageImage"><img src={image} alt={item.title || 'Hình ảnh mục trang chủ'} /></div>}<div className="customHomepageContent">{item.eyebrow && <span className="sectionKicker">{item.eyebrow}</span>}{item.title && <h2>{item.title}</h2>}{item.description && <p className="sectionDescription">{item.description}</p>}{item.customContent && <div className="customRichText"><RichText data={item.customContent} /></div>}{item.buttonLabel && item.buttonUrl && <a className="homeSolidButton customSectionButton" href={item.buttonUrl}>{item.buttonLabel} →</a>}</div></div></section>
          }

          return null
        })}
      </div>

      <SiteFooter />
    </main>
  )
}
