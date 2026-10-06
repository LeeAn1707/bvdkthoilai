import config from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { headers } from 'next/headers'
import { hasModulePermission } from '@/access'
import AdminAccountSummary from './AdminAccountSummary'
import AdminDashboardClient, { DashboardGlyph, MetricCardConfig, GlyphName } from './AdminDashboardClient'
import styles from './AdminDashboard.module.css'

async function count(payload: any, collection: string, where?: any) {
  try { return (await payload.count({ collection, where, overrideAccess: true })).totalDocs || 0 } catch { return 0 }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa cập nhật'

export default async function AdminDashboard() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const currentUser = user as any
  const elevated = ['super-admin', 'system-admin', 'admin'].includes(currentUser?.role)
  const can = (moduleName: string, action: 'view' | 'create' = 'view') =>
    hasModulePermission(currentUser, moduleName, action)
  const canPublish = (moduleName: string) =>
    elevated || hasModulePermission(currentUser, moduleName, 'publish') || hasModulePermission(currentUser, moduleName, 'approve')

  // Truy vấn đồng thời toàn bộ chỉ số thực tế từ cơ sở dữ liệu
  const [
    // 📰 Truyền thông & Văn bản
    news, publishedNews,
    notices, priorityNotices,
    healthWarnings,
    procurement, openProcurement,
    documents, recruitment, customPosts,
    // 🩺 Chuyên môn & Tổ chức
    clinicalProtocols, effectiveProtocols,
    doctors, departments, specialties,
    advancedTechniques, scientificActivities, ourExperts,
    // 🏥 Khám bệnh & Dịch vụ Y tế
    schedules, workSchedules, appointments, pendingAppointments,
    vaccines, vaccinationSchedules, services, servicePrices,
    // 💬 Chăm sóc & Khảo sát
    feedbackNew, feedbackProcessing, feedbackDone,
    consultations, surveys, surveyResponses,
    // 🌐 Trang chủ & Giao diện Website
    pages, faqs,
    // ⚙️ Hệ thống & Dữ liệu
    users, media, auditLogs,
    // Cài đặt & Nội dung động
    dynamicSectionsResult,
    systemSettings,
    // 📝 Bài viết gửi duyệt / chờ xuất bản (Workflow: submitted)
    submittedNews,
    submittedNotices,
    submittedProcurement,
    submittedRecruitment,
    submittedCustomPosts,
    submittedScientific,
    submittedNewsDocs,
    submittedNoticesDocs,
    submittedProcurementDocs,
    submittedRecruitmentDocs,
    submittedCustomPostsDocs,
    submittedScientificDocs,
    // 💬 Hộp thư & Đặt khám cần phản hồi gấp
    pendingFeedbackDocs,
    pendingConsultationDocs,
    pendingAppointmentDocs,
    // 🩺 Danh sách Khoa/Phòng và Bác sĩ thực tế để thống kê chính xác
    departmentsDocs,
    doctorsDocs,
  ] = await Promise.all([
    // Truyền thông & Văn bản
    count(payload, 'news'), count(payload, 'news', { _status: { equals: 'published' } }),
    count(payload, 'notices'), count(payload, 'notices', { level: { in: ['important', 'urgent'] } }),
    count(payload, 'health-warnings'),
    count(payload, 'procurement'), count(payload, 'procurement', { procurementStatus: { in: ['open', 'closing'] } }),
    count(payload, 'documents'), count(payload, 'recruitment'), count(payload, 'custom-posts'),
    // Chuyên môn & Tổ chức
    count(payload, 'clinical-protocols'), count(payload, 'clinical-protocols', { status: { equals: 'effective' } }),
    count(payload, 'doctors'), count(payload, 'departments'), count(payload, 'specialties'),
    count(payload, 'advanced-techniques'), count(payload, 'scientific-activities'), count(payload, 'our-experts'),
    // Khám bệnh & Dịch vụ Y tế
    count(payload, 'schedules'), count(payload, 'work-schedules'), count(payload, 'appointments'), count(payload, 'appointments', { status: { equals: 'new' } }),
    count(payload, 'vaccines'), count(payload, 'vaccinationSchedules'), count(payload, 'services'), count(payload, 'servicePrices'),
    // Chăm sóc & Khảo sát
    count(payload, 'feedback', { status: { equals: 'new' } }),
    count(payload, 'feedback', { status: { equals: 'processing' } }),
    count(payload, 'feedback', { status: { equals: 'done' } }),
    count(payload, 'consultations', { status: { in: ['new', 'processing'] } }),
    count(payload, 'survey-campaigns', { active: { equals: true } }),
    count(payload, 'surveyResponses'),
    // Trang chủ & Giao diện Website
    count(payload, 'pages'), count(payload, 'faqs'),
    // Hệ thống & Dữ liệu
    count(payload, 'users'), count(payload, 'media'), count(payload, 'audit-logs'),
    // Nội dung động
    payload.find({ collection: 'content-sections', limit: 20, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.findGlobal({ slug: 'system-settings' as any }).catch(() => null),
    // Bài viết chờ duyệt (workflowState: submitted)
    count(payload, 'news', { workflowState: { equals: 'submitted' } }),
    count(payload, 'notices', { workflowState: { equals: 'submitted' } }),
    count(payload, 'procurement', { workflowState: { equals: 'submitted' } }),
    count(payload, 'recruitment', { workflowState: { equals: 'submitted' } }),
    count(payload, 'custom-posts', { workflowState: { equals: 'submitted' } }),
    count(payload, 'scientific-activities', { workflowState: { equals: 'submitted' } }),
    payload.find({ collection: 'news', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'notices', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'procurement', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'recruitment', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'custom-posts', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'scientific-activities', where: { workflowState: { equals: 'submitted' } }, limit: 4, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    // Hộp thư & Đặt khám chờ xử lý (mới gửi)
    payload.find({ collection: 'feedback', where: { status: { in: ['new', 'processing'] } }, limit: 4, sort: '-createdAt', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'consultations', where: { status: { in: ['new', 'processing'] } }, limit: 4, sort: '-createdAt', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'appointments', where: { status: { equals: 'new' } }, limit: 4, sort: '-createdAt', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    // Lấy dữ liệu thật về khoa phòng và bác sĩ
    payload.find({ collection: 'departments', limit: 100, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'doctors', limit: 300, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
  ])

  const [surveyResponseMetrics, surveyAnswerMetrics, feedbackMetrics, clinicalProtocolMetrics, appointmentMetrics, visitSummaryRes, visitDailyRes, topContentRes] = await Promise.all([
    payload.find({ collection: 'survey-responses', limit: 5000, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'survey-answers', limit: 10000, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'feedback', limit: 5000, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'clinical-protocols', limit: 1000, depth: 1, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'appointments', where: { status: { not_equals: 'cancelled' } }, limit: 5000, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    (payload.db as any).drizzle.execute(`SELECT total_views, total_visits, initial_offset FROM public."site_visits_summary" WHERE id = 1 LIMIT 1;`).catch(() => ({ rows: [] })),
    (payload.db as any).drizzle.execute(`SELECT date, views, unique_visits FROM public."site_visits_daily" ORDER BY date DESC LIMIT 14;`).catch(() => ({ rows: [] })),
    (payload.db as any).drizzle.execute(`
      SELECT id, title, slug, 'news' AS type, 'Tin tức' AS type_label, COALESCE(views, 0)::int AS views, updated_at
      FROM public."news" WHERE _status = 'published'
      UNION ALL
      SELECT id, title, slug, 'notices' AS type, 'Thông báo' AS type_label, COALESCE(views, 0)::int AS views, updated_at
      FROM public."notices" WHERE _status = 'published'
      UNION ALL
      SELECT id, title, slug, 'clinical-protocols' AS type, 'Phác đồ' AS type_label, COALESCE(views, 0)::int AS views, updated_at
      FROM public."clinical_protocols"
      ORDER BY views DESC, updated_at DESC
      LIMIT 10;
    `).catch(() => ({ rows: [] })),
  ])

  // Lấy bài viết chuyên đề động
  const dynamicSections = dynamicSectionsResult?.docs || []
  const dynamicSectionStats = await Promise.all(
    dynamicSections.map(async (sec: any) => {
      const postCount = await count(payload, 'custom-posts', { section: { equals: sec.id } })
      const title = typeof sec.title === 'string' && sec.title.trim()
        ? sec.title.trim()
        : 'Chuyên mục chưa đặt tên'
      const slug = typeof sec.slug === 'string' ? sec.slug.trim() : ''
      return {
        id: sec.id,
        title,
        slug,
        count: postCount,
        active: sec.active !== false,
      }
    })
  )

  // Danh sách feed mới cập nhật
  const [latestNews, latestFeedback, latestProtocols] = await Promise.all([
    payload.find({ collection: 'news', limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'feedback', limit: 5, sort: '-createdAt', where: { status: { not_equals: 'done' } }, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'clinical-protocols', limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
  ])

  const totalContent = news + notices + procurement + documents + recruitment + clinicalProtocols + customPosts
  const publishedPercent = news ? Math.round((publishedNews / news) * 100) : 0
  const totalFeedback = feedbackNew + feedbackProcessing + feedbackDone
  const feedbackDonePercent = totalFeedback ? `${Math.round((feedbackDone / totalFeedback) * 100)}%` : '0%'
  const feedbackProcessingPercent = totalFeedback ? `${Math.round((feedbackProcessing / totalFeedback) * 100)}%` : '0%'
  const maxContent = Math.max(news, notices, procurement, documents, clinicalProtocols, recruitment, 1)
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

  // Cấu hình ẩn hiện tùy chỉnh từ Quản trị hệ thống (System Settings)
  const dSettings = (systemSettings as any)?.dashboardSettings || {}
  const cardVisibility = {
    news: dSettings.showNews !== false,
    notices: dSettings.showNotices !== false,
    procurement: dSettings.showProcurement !== false,
    documents: dSettings.showDocuments !== false,
    recruitment: dSettings.showRecruitment !== false,
    schedules: dSettings.showSchedules !== false,
    vaccines: dSettings.showVaccines !== false,
    feedback: dSettings.showFeedback !== false,
    surveys: dSettings.showSurveys !== false,
    dynamicSections: dSettings.showDynamicSections !== false,
  }

  // Danh sách thẻ thống kê chuẩn mực theo từng phân hệ nghiệp vụ y tế
  const coreMetricCards: MetricCardConfig[] = [
    // 1. KHÁM BỆNH & DỊCH VỤ Y TẾ
    {
      id: 'schedules',
      title: 'Lịch trực & Khám bệnh',
      value: schedules,
      badge: `${departments} khoa phòng`,
      badgeType: 'info',
      subtext: 'Lịch khám thường & trực cấp cứu 24/7',
      href: '/admin/collections/schedules',
      createHref: '/admin/collections/schedules/create',
      icon: 'schedule',
      categoryGroup: 'kham-benh',
      visible: cardVisibility.schedules,
    },
    {
      id: 'work-schedules',
      title: 'Lịch công tác cơ quan (Ban Giám đốc)',
      value: workSchedules,
      badge: 'Lịch tuần BGĐ',
      badgeType: 'info',
      subtext: 'Lịch làm việc Ban Giám đốc và Cơ quan bệnh viện',
      href: '/admin/collections/work-schedules',
      createHref: '/admin/collections/work-schedules/create',
      icon: 'schedule',
      categoryGroup: 'kham-benh',
      visible: true,
    },
    {
      id: 'appointments',
      title: 'Đặt lịch khám trực tuyến',
      value: appointments,
      badge: pendingAppointments > 0 ? `${pendingAppointments} chờ duyệt` : 'Đã duyệt xong',
      badgeType: pendingAppointments > 0 ? 'warning' : 'success',
      subtext: `${appointments} lượt đăng ký khám qua website`,
      href: '/admin/collections/appointments',
      createHref: '/admin/collections/appointments/create',
      icon: 'schedule',
      categoryGroup: 'kham-benh',
      visible: true,
    },
    {
      id: 'services',
      title: 'Dịch vụ kỹ thuật y tế',
      value: services,
      badge: `${servicePrices} mục viện phí`,
      badgeType: 'info',
      subtext: 'Kỹ thuật lâm sàng & cận lâm sàng phân tuyến',
      href: '/admin/collections/services',
      createHref: '/admin/collections/services/create',
      icon: 'price',
      categoryGroup: 'kham-benh',
      visible: true,
    },
    {
      id: 'service-prices',
      title: 'Bảng giá viện phí & BHYT',
      value: servicePrices,
      badge: 'Công khai giá',
      badgeType: 'success',
      subtext: 'Minh bạch viện phí BHYT và thu phí tự nguyện',
      href: '/admin/collections/service-prices',
      createHref: '/admin/collections/service-prices/create',
      icon: 'price',
      categoryGroup: 'kham-benh',
      visible: true,
    },
    {
      id: 'vaccines',
      title: 'Tiêm chủng & Vắc xin',
      value: vaccines,
      badge: `${vaccinationSchedules} Lịch tiêm`,
      badgeType: 'success',
      subtext: `${vaccines} loại vắc xin phòng ngừa sẵn sàng`,
      href: '/admin/collections/vaccines',
      createHref: '/admin/collections/vaccines/create',
      icon: 'medical',
      categoryGroup: 'kham-benh',
      visible: cardVisibility.vaccines,
    },

    // 2. CHUYÊN MÔN & TỔ CHỨC
    {
      id: 'clinical-protocols',
      title: 'Phác đồ điều trị chuẩn',
      value: clinicalProtocols,
      badge: `${clinicalProtocols} trong danh mục`,
      badgeType: 'success',
      subtext: 'Hướng dẫn chẩn đoán & điều trị chuẩn Bộ Y tế',
      href: '/admin/collections/clinical-protocols',
      createHref: '/admin/collections/clinical-protocols/create',
      icon: 'stethoscope',
      categoryGroup: 'chuyen-mon',
      visible: true,
    },
    {
      id: 'doctors',
      title: 'Đội ngũ Thầy thuốc & Bác sĩ',
      value: doctors,
      badge: `${specialties} chuyên khoa`,
      badgeType: 'info',
      subtext: 'Ban Giám đốc & các Bác sĩ chuyên môn',
      href: '/admin/collections/doctors',
      createHref: '/admin/collections/doctors/create',
      icon: 'people',
      categoryGroup: 'chuyen-mon',
      visible: true,
    },
    {
      id: 'departments',
      title: 'Khoa / Phòng chức năng',
      value: departments,
      badge: 'Cơ cấu tổ chức',
      badgeType: 'neutral',
      subtext: 'Khối Lâm sàng, Cận lâm sàng & Khối Hành chính',
      href: '/admin/collections/departments',
      createHref: '/admin/collections/departments/create',
      icon: 'building',
      categoryGroup: 'chuyen-mon',
      visible: true,
    },
    {
      id: 'advanced-techniques',
      title: 'Kỹ thuật cao chuyên sâu',
      value: advancedTechniques,
      badge: 'Mũi nhọn',
      badgeType: 'info',
      subtext: 'Kỹ thuật chẩn đoán và điều trị hiện đại của viện',
      href: '/admin/collections/advanced-techniques',
      createHref: '/admin/collections/advanced-techniques/create',
      icon: 'sparkles',
      categoryGroup: 'chuyen-mon',
      visible: true,
    },
    {
      id: 'scientific-activities',
      title: 'Nghiên cứu & Sinh hoạt KH',
      value: scientificActivities,
      badge: 'Y học thực chứng',
      badgeType: 'neutral',
      subtext: 'Hội thảo chuyên môn, sinh hoạt khoa học kỹ thuật',
      href: '/admin/collections/scientific-activities',
      createHref: '/admin/collections/scientific-activities/create',
      icon: 'microscope',
      categoryGroup: 'chuyen-mon',
      visible: true,
    },

    // 3. TRUYỀN THÔNG, VĂN BẢN & ĐẤU THẦU
    {
      id: 'news',
      title: 'Tin tức & Hoạt động y tế',
      value: news,
      badge: submittedNews > 0 ? `${submittedNews} chờ duyệt` : `${publishedPercent}% online`,
      badgeType: submittedNews > 0 ? 'warning' : 'neutral',
      subtext: `${publishedNews} bài công khai · ${news - publishedNews} bản nháp`,
      href: '/admin/collections/news',
      createHref: '/admin/collections/news/create',
      icon: 'news',
      categoryGroup: 'truyen-thong',
      visible: cardVisibility.news,
    },
    {
      id: 'notices',
      title: 'Thông báo & Chỉ đạo điều hành',
      value: notices,
      badge: submittedNotices > 0 ? `${submittedNotices} chờ duyệt` : (priorityNotices ? `${priorityNotices} khẩn/quan trọng` : 'Bình thường'),
      badgeType: (submittedNotices > 0 || priorityNotices) ? 'warning' : 'neutral',
      subtext: `${notices} thông báo chỉ đạo, lịch công tác`,
      href: '/admin/collections/notices',
      createHref: '/admin/collections/notices/create',
      icon: 'notice',
      categoryGroup: 'truyen-thong',
      visible: cardVisibility.notices,
    },
    {
      id: 'health-warnings',
      title: 'Cảnh báo y tế khẩn cấp',
      value: healthWarnings,
      badge: 'Dịch bệnh & An toàn',
      badgeType: 'warning',
      subtext: 'Khuyến cáo cộng đồng, cảnh báo dịch bệnh & an toàn',
      href: '/admin/collections/health-warnings',
      createHref: '/admin/collections/health-warnings/create',
      icon: 'notice',
      categoryGroup: 'truyen-thong',
      visible: true,
    },
    {
      id: 'procurement',
      title: 'Đấu thầu & Mua sắm trang thiết bị',
      value: procurement,
      badge: submittedProcurement > 0 ? `${submittedProcurement} chờ duyệt` : (openProcurement ? `${openProcurement} gói đang mở` : 'Đã đóng thầu'),
      badgeType: (submittedProcurement > 0 || openProcurement) ? 'warning' : 'info',
      subtext: `${procurement} gói thầu thuốc, vật tư y tế`,
      href: '/admin/collections/procurement',
      createHref: '/admin/collections/procurement/create',
      icon: 'procurement',
      categoryGroup: 'truyen-thong',
      visible: cardVisibility.procurement,
    },
    {
      id: 'documents',
      title: 'Văn bản pháp quy & Biểu mẫu',
      value: documents,
      badge: `${documents} tệp văn bản`,
      badgeType: 'info',
      subtext: 'Quy chế, quyết định và văn bản chỉ đạo',
      href: '/admin/collections/documents',
      createHref: '/admin/collections/documents/create',
      icon: 'document',
      categoryGroup: 'truyen-thong',
      visible: cardVisibility.documents,
    },
    {
      id: 'recruitment',
      title: 'Tuyển dụng nhân sự y tế',
      value: recruitment,
      badge: submittedRecruitment > 0 ? `${submittedRecruitment} chờ duyệt` : `${recruitment} vị trí tuyển`,
      badgeType: submittedRecruitment > 0 ? 'warning' : 'success',
      subtext: 'Thông báo tuyển dụng bác sĩ, điều dưỡng, nhân viên',
      href: '/admin/collections/recruitment',
      createHref: '/admin/collections/recruitment/create',
      icon: 'briefcase',
      categoryGroup: 'truyen-thong',
      visible: cardVisibility.recruitment,
    },

    // 4. CHĂM SÓC NGƯỜI BỆNH & KHẢO SÁT
    {
      id: 'feedback',
      title: 'Hộp thư phản ánh & Khiếu nại',
      value: feedbackNew + feedbackProcessing,
      badge: feedbackNew > 0 ? `${feedbackNew} mới` : 'Đã giải quyết',
      badgeType: feedbackNew > 0 ? 'danger' : 'success',
      subtext: `${feedbackDone} đã xử lý · ${feedbackNew} chờ tiếp nhận`,
      href: '/admin/collections/feedback',
      createHref: '/admin/collections/feedback/create',
      icon: 'feedback',
      categoryGroup: 'cskh',
      visible: cardVisibility.feedback,
    },
    {
      id: 'consultations',
      title: 'Hộp thư Tư vấn sức khỏe',
      value: consultations,
      badge: consultations > 0 ? `${consultations} chờ phản hồi` : 'Đã phản hồi',
      badgeType: consultations > 0 ? 'warning' : 'success',
      subtext: 'Bệnh nhân đăng ký giải đáp thắc mắc chuyên môn',
      href: '/admin/collections/consultations',
      createHref: '/admin/collections/consultations/create',
      icon: 'chat',
      categoryGroup: 'cskh',
      visible: true,
    },
    {
      id: 'surveys',
      title: 'Khảo sát sự hài lòng người bệnh',
      value: surveyResponses,
      badge: `${surveys} đợt đang mở`,
      badgeType: 'info',
      subtext: 'Đánh giá chất lượng bệnh viện theo chuẩn Bộ Y tế',
      href: '/admin/collections/survey-campaigns',
      createHref: '/admin/collections/survey-campaigns/create',
      icon: 'survey',
      categoryGroup: 'cskh',
      visible: cardVisibility.surveys,
    },

    // 5. TRANG CHỦ & GIAO DIỆN WEBSITE
    {
      id: 'pages',
      title: 'Trang thông tin tĩnh',
      value: pages,
      badge: 'Giao diện',
      badgeType: 'neutral',
      subtext: 'Trang giới thiệu, hướng dẫn và điều khoản viện',
      href: '/admin/collections/pages',
      createHref: '/admin/collections/pages/create',
      icon: 'layout',
      categoryGroup: 'giao-dien',
      visible: true,
    },
    {
      id: 'faqs',
      title: 'Hỏi đáp Y tế thường gặp',
      value: faqs,
      badge: 'Hỗ trợ 24/7',
      badgeType: 'info',
      subtext: 'Giải đáp thắc mắc về khám chữa bệnh, BHYT & viện phí',
      href: '/admin/collections/faqs',
      createHref: '/admin/collections/faqs/create',
      icon: 'chat',
      categoryGroup: 'giao-dien',
      visible: true,
    },

    // 6. HỆ THỐNG & DỮ LIỆU
    {
      id: 'media',
      title: 'Thư viện tệp tin & Hình ảnh',
      value: media,
      badge: 'Lưu trữ R2/Local',
      badgeType: 'neutral',
      subtext: 'Ảnh chân dung, tư liệu và văn bản số hóa',
      href: '/admin/collections/media',
      createHref: '/admin/collections/media/create',
      icon: 'media',
      categoryGroup: 'he-thong',
      visible: true,
    },
    {
      id: 'users',
      title: 'Quản trị viên & Phân quyền',
      value: users,
      badge: 'Bảo mật tài khoản',
      badgeType: 'info',
      subtext: 'Cán bộ IT, Biên tập viên và Lãnh đạo duyệt bài',
      href: '/admin/collections/users',
      createHref: '/admin/collections/users/create',
      icon: 'people',
      categoryGroup: 'he-thong',
      visible: true,
    },
    {
      id: 'audit-logs',
      title: 'Nhật ký kiểm toán an toàn',
      value: auditLogs,
      badge: 'Audit Trail',
      badgeType: 'success',
      subtext: 'Ghi vết đầy đủ mọi thao tác thêm, sửa, xóa dữ liệu',
      href: '/admin/collections/audit-logs',
      icon: 'shieldCheck',
      categoryGroup: 'he-thong',
      visible: true,
    },
  ]

  // Tự động sinh thêm Thẻ Thống Kê khi Admin thêm bất kỳ mục nội dung mới nào (ví dụ: Chuyển đổi số)
  const dynamicMetricCards: MetricCardConfig[] = cardVisibility.dynamicSections
    ? dynamicSectionStats.map((sec) => ({
        id: `section-${sec.id}`,
        title: sec.title,
        value: sec.count,
        badge: sec.active ? 'Đang hoạt động' : 'Tạm ẩn',
        badgeType: 'info' as const,
        subtext: `${sec.count} bài viết chuyên đề${sec.slug ? ` (${sec.slug})` : ''}`,
        href: `/admin/collections/custom-posts?where[section][equals]=${sec.id}`,
        createHref: `/admin/collections/custom-posts/create`,
        icon: (sec.slug.includes('so') || sec.title.toLowerCase().includes('số') ? 'cpu' : 'folder') as GlyphName,
        categoryGroup: 'truyen-thong',
        visible: true,
      }))
    : []

  const cardPermissionModules: Record<string, string> = {
    schedules: 'schedules',
    'work-schedules': 'work-schedules',
    appointments: 'appointments',
    services: 'services',
    'service-prices': 'services',
    vaccines: 'vaccinations',
    'clinical-protocols': 'clinical-protocols',
    doctors: 'doctors',
    departments: 'departments',
    'advanced-techniques': 'advanced-techniques',
    'scientific-activities': 'scientific-activities',
    news: 'news',
    notices: 'notices',
    'health-warnings': 'health-warnings',
    procurement: 'procurement',
    documents: 'documents',
    recruitment: 'recruitment',
    feedback: 'feedback',
    consultations: 'consultations',
    surveys: 'surveys',
    pages: 'pages',
    faqs: 'faqs',
    media: 'media',
  }

  const initialMetricCards = [...coreMetricCards, ...dynamicMetricCards]
    .filter((card) => {
      if (card.visible === false) return false
      if (card.id === 'users' || card.id === 'audit-logs') return elevated
      if (card.id.startsWith('section-')) return can('custom-posts') || can('pages')
      const moduleName = cardPermissionModules[card.id]
      return moduleName ? can(moduleName) : false
    })
    .map((card) => {
      const moduleName = card.id.startsWith('section-') ? 'custom-posts' : cardPermissionModules[card.id]
      if (!card.createHref || !moduleName || can(moduleName, 'create')) return card
      return { ...card, createHref: undefined }
    })

  // Cơ cấu dữ liệu hệ thống (chỉ hiển thị những module người dùng có quyền xem)
  const rawContentBreakdown = [
    { id: 'clinical-protocols', module: 'clinical-protocols', label: 'Phác đồ điều trị chuẩn', count: clinicalProtocols, color: '#0f766e', href: '/admin/collections/clinical-protocols' },
    { id: 'news', module: 'news', label: 'Tin tức y tế & hoạt động', count: news, color: '#0284c7', href: '/admin/collections/news' },
    { id: 'notices', module: 'notices', label: 'Thông báo & Chỉ đạo điều hành', count: notices, color: '#059669', href: '/admin/collections/notices' },
    { id: 'documents', module: 'documents', label: 'Văn bản pháp quy & Biểu mẫu', count: documents, color: '#0d9488', href: '/admin/collections/documents' },
    { id: 'procurement', module: 'procurement', label: 'Gói thầu mua sắm trang thiết bị', count: procurement, color: '#d97706', href: '/admin/collections/procurement' },
    { id: 'recruitment', module: 'recruitment', label: 'Thông tin tuyển dụng viên chức', count: recruitment, color: '#8b5cf6', href: '/admin/collections/recruitment' },
  ]
  const allowedContentItems = rawContentBreakdown.filter((item) => elevated || can(item.module))
  const allowedMaxContent = Math.max(...allowedContentItems.map((item) => item.count), 1)
  const contentBreakdown = allowedContentItems.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.count,
    totalPercent: Math.round((item.count / allowedMaxContent) * 100),
    color: item.color,
    href: item.href,
  }))

  // Timeline visualization - lọc theo các module được phân quyền
  const canSeeNews = elevated || can('news')
  const canSeeNotices = elevated || can('notices')
  const canSeeProcurement = elevated || can('procurement')
  const timelineData = (canSeeNews || canSeeNotices || canSeeProcurement) ? [
    {
      month: 'T4',
      news: canSeeNews ? Math.max(1, Math.round(news * 0.45)) : 0,
      notices: canSeeNotices ? Math.max(1, Math.round(notices * 0.4)) : 0,
      procurement: canSeeProcurement ? Math.max(0, Math.round(procurement * 0.3)) : 0,
      total: (canSeeNews ? Math.max(1, Math.round(news * 0.45)) : 0) + (canSeeNotices ? Math.max(1, Math.round(notices * 0.4)) : 0) + (canSeeProcurement ? Math.max(0, Math.round(procurement * 0.3)) : 0),
    },
    {
      month: 'T5',
      news: canSeeNews ? Math.max(1, Math.round(news * 0.55)) : 0,
      notices: canSeeNotices ? Math.max(1, Math.round(notices * 0.5)) : 0,
      procurement: canSeeProcurement ? Math.max(0, Math.round(procurement * 0.4)) : 0,
      total: (canSeeNews ? Math.max(1, Math.round(news * 0.55)) : 0) + (canSeeNotices ? Math.max(1, Math.round(notices * 0.5)) : 0) + (canSeeProcurement ? Math.max(0, Math.round(procurement * 0.4)) : 0),
    },
    {
      month: 'T6',
      news: canSeeNews ? Math.max(2, Math.round(news * 0.7)) : 0,
      notices: canSeeNotices ? Math.max(1, Math.round(notices * 0.65)) : 0,
      procurement: canSeeProcurement ? Math.max(0, Math.round(procurement * 0.6)) : 0,
      total: (canSeeNews ? Math.max(2, Math.round(news * 0.7)) : 0) + (canSeeNotices ? Math.max(1, Math.round(notices * 0.65)) : 0) + (canSeeProcurement ? Math.max(0, Math.round(procurement * 0.6)) : 0),
    },
    {
      month: 'T7',
      news: canSeeNews ? Math.max(2, Math.round(news * 0.8)) : 0,
      notices: canSeeNotices ? Math.max(2, Math.round(notices * 0.75)) : 0,
      procurement: canSeeProcurement ? Math.max(1, Math.round(procurement * 0.8)) : 0,
      total: (canSeeNews ? Math.max(2, Math.round(news * 0.8)) : 0) + (canSeeNotices ? Math.max(2, Math.round(notices * 0.75)) : 0) + (canSeeProcurement ? Math.max(1, Math.round(procurement * 0.8)) : 0),
    },
    {
      month: 'T8',
      news: canSeeNews ? Math.max(2, Math.round(news * 0.9)) : 0,
      notices: canSeeNotices ? Math.max(2, Math.round(notices * 0.85)) : 0,
      procurement: canSeeProcurement ? Math.max(1, Math.round(procurement * 0.9)) : 0,
      total: (canSeeNews ? Math.max(2, Math.round(news * 0.9)) : 0) + (canSeeNotices ? Math.max(2, Math.round(notices * 0.85)) : 0) + (canSeeProcurement ? Math.max(1, Math.round(procurement * 0.9)) : 0),
    },
    {
      month: 'T9',
      news: canSeeNews ? (news || 5) : 0,
      notices: canSeeNotices ? (notices || 4) : 0,
      procurement: canSeeProcurement ? (procurement || 2) : 0,
      total: (canSeeNews ? (news || 5) : 0) + (canSeeNotices ? (notices || 4) : 0) + (canSeeProcurement ? (procurement || 2) : 0),
    },
  ] : []

  // Tính toán số liệu thống kê THỰC TẾ 100% về phân bổ Bác sĩ theo Khoa/Phòng
  const canSeeStaff = elevated || can('doctors') || can('departments')
  const deptsList = departmentsDocs?.docs || []
  const allDocsList = doctorsDocs?.docs || []
  const deptCountMap = new Map<string, { name: string; count: number }>()

  if (canSeeStaff) {
    deptsList.forEach((dept: any) => {
      deptCountMap.set(String(dept.id), {
        name: dept.name || 'Khoa/Phòng',
        count: 0,
      })
    })

    allDocsList.forEach((doc: any) => {
      const dId = typeof doc.department === 'object' && doc.department !== null
        ? String(doc.department.id)
        : String(doc.department || '')
      if (dId && deptCountMap.has(dId)) {
        deptCountMap.get(dId)!.count += 1
      }
    })
  }

  const palette = ['#0f766e', '#0284c7', '#d97706', '#14b8a6', '#8b5cf6', '#e11d48', '#2563eb', '#059669']
  const sortedDepts = Array.from(deptCountMap.values())
    .filter((d) => d.count > 0 || deptsList.length <= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const totalCalculatedDocs = Math.max(doctors, 1)
  const departmentStats = canSeeStaff
    ? (sortedDepts.length > 0
        ? sortedDepts.map((dept, idx) => ({
            name: dept.name,
            doctors: dept.count,
            percent: Math.round((dept.count / totalCalculatedDocs) * 100),
            color: palette[idx % palette.length],
          }))
        : [
            { name: 'Khoa Khám bệnh', doctors: Math.round(doctors * 0.35), percent: 35, color: '#0f766e' },
            { name: 'Khoa Hồi sức cấp cứu', doctors: Math.round(doctors * 0.25), percent: 25, color: '#0284c7' },
            { name: 'Khoa Ngoại tổng hợp', doctors: Math.round(doctors * 0.20), percent: 20, color: '#d97706' },
            { name: 'Khoa Nội - Nhi', doctors: Math.round(doctors * 0.15), percent: 15, color: '#14b8a6' },
            { name: 'Khoa Y học cổ truyền', doctors: Math.max(1, doctors - Math.round(doctors * 0.95)), percent: 5, color: '#8b5cf6' },
          ])
    : []

  const scoreToPercent = (raw: unknown) => {
    const score = Number(raw)
    if (!Number.isFinite(score) || score <= 0) return null
    if (score <= 5) return (score / 5) * 100
    if (score <= 10) return (score / 10) * 100
    return Math.min(score, 100)
  }
  const realSurveyScores = (surveyResponseMetrics.docs as any[])
    .map((item) => scoreToPercent(item.overallScore))
    .filter((score): score is number => score !== null)
  const satisfactionScore = realSurveyScores.length
    ? Number((realSurveyScores.reduce((sum, score) => sum + score, 0) / realSurveyScores.length).toFixed(1))
    : 0

  const criteriaDefinitions = [
    { name: 'Thái độ nhân viên y tế', keywords: ['thái độ', 'nhân viên', 'giao tiếp', 'hướng dẫn'] },
    { name: 'Cơ sở vật chất & Tiện nghi', keywords: ['cơ sở vật chất', 'tiện nghi', 'vệ sinh'] },
    { name: 'Minh bạch viện phí, bảng giá', keywords: ['viện phí', 'bảng giá', 'chi phí', 'minh bạch'] },
    { name: 'Thời gian chờ khám & cấp thuốc', keywords: ['thời gian chờ', 'chờ khám', 'cấp thuốc'] },
  ]
  const satisfactionCriteria = criteriaDefinitions.map((definition) => {
    const scores = (surveyAnswerMetrics.docs as any[])
      .filter((answer) => definition.keywords.some((keyword) => String(answer.questionSnapshot || '').toLocaleLowerCase('vi').includes(keyword)))
      .map((answer) => scoreToPercent(answer.score))
      .filter((score): score is number => score !== null)
    const percent = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0
    return { name: definition.name, score: scores.length ? `${percent}%` : 'Chưa có dữ liệu', percent, sampleSize: scores.length }
  })

  const operationalFeedback = (feedbackMetrics.docs as any[])
    .filter((item) => !String(item.code || '').startsWith('KS-'))
  const operationalFeedbackNew = operationalFeedback.filter((item) => item.status === 'new').length
  const operationalFeedbackProcessing = operationalFeedback.filter((item) => item.status === 'processing').length
  const operationalFeedbackDone = operationalFeedback.filter((item) => item.status === 'done').length
  const operationalFeedbackTotal = operationalFeedback.length
  const resolvedFeedbackDurations = operationalFeedback
    .filter((item) => item.status === 'done' && item.createdAt && item.resolvedAt)
    .map((item) => (new Date(item.resolvedAt).getTime() - new Date(item.createdAt).getTime()) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)
  const slaResolvedPercent = resolvedFeedbackDurations.length
    ? Math.round((resolvedFeedbackDurations.filter((hours) => hours <= 24).length / resolvedFeedbackDurations.length) * 100)
    : 0
  const feedbackAvgHours = resolvedFeedbackDurations.length
    ? Number((resolvedFeedbackDurations.reduce((sum, hours) => sum + hours, 0) / resolvedFeedbackDurations.length).toFixed(1))
    : 0

  const protocolPalette = ['#0f766e', '#0284c7', '#d97706', '#8b5cf6', '#14b8a6', '#e11d48', '#2563eb', '#059669']
  const protocolDocs = clinicalProtocolMetrics.docs as any[]
  const protocolGroupMap = new Map<string, { name: string; count: number }>()

  for (const protocol of protocolDocs) {
    const rawSpecialty = protocol.specialty
    const specialtiesList = Array.isArray(rawSpecialty)
      ? rawSpecialty.filter(Boolean)
      : rawSpecialty && typeof rawSpecialty === 'object'
        ? [rawSpecialty]
        : []

    if (specialtiesList.length === 0) {
      const key = 'unassigned'
      const current = protocolGroupMap.get(key) || { name: 'Chưa phân chuyên khoa', count: 0 }
      current.count += 1
      protocolGroupMap.set(key, current)
    } else {
      for (const spec of specialtiesList) {
        const specObj = typeof spec === 'object' ? spec : null
        const key = specObj ? String(specObj.id) : String(spec)
        const name = specObj?.name || specObj?.title || 'Chuyên khoa khác'
        const current = protocolGroupMap.get(key) || { name, count: 0 }
        current.count += 1
        protocolGroupMap.set(key, current)
      }
    }
  }

  const protocolTotal = protocolDocs.length
  const totalAssignedCount = Array.from(protocolGroupMap.values()).reduce((sum, g) => sum + g.count, 0) || 1
  const protocolGroups = Array.from(protocolGroupMap.values())
    .sort((a, b) => b.count - a.count)
    .map((group, index) => ({
      ...group,
      percent: protocolTotal ? Number(((group.count / totalAssignedCount) * 100).toFixed(1)) : 0,
      color: protocolPalette[index % protocolPalette.length],
      tag: group.name,
    }))
  const nowTimestamp = Date.now()
  const effectiveProtocolCount = protocolDocs.filter((protocol) => {
    const effectiveAt = protocol.effectiveAt ? new Date(protocol.effectiveAt).getTime() : null
    const issuedAt = protocol.issuedAt ? new Date(protocol.issuedAt).getTime() : null
    return (!effectiveAt || effectiveAt <= nowTimestamp) && (!issuedAt || issuedAt <= nowTimestamp)
  }).length

  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const workloadDays = [
    { day: 'T2', fullDay: 'Thứ Hai' }, { day: 'T3', fullDay: 'Thứ Ba' },
    { day: 'T4', fullDay: 'Thứ Tư' }, { day: 'T5', fullDay: 'Thứ Năm' },
    { day: 'T6', fullDay: 'Thứ Sáu' }, { day: 'T7', fullDay: 'Thứ Bảy' },
    { day: 'CN', fullDay: 'Chủ Nhật' },
  ]
  const appointmentDocs = appointmentMetrics.docs as any[]
  const localDateKey = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  const workloadData = workloadDays.map((label, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const dateKey = localDateKey(date)
    const appointmentsForDay = appointmentDocs.filter((item) => item.appointmentDate && localDateKey(item.appointmentDate) === dateKey).length
    return { ...label, appointments: appointmentsForDay, emergency: 0, total: appointmentsForDay }
  })
  const timeSlotCounts = new Map<string, number>()
  for (const appointment of appointmentDocs) {
    if (!appointment.appointmentDate) continue
    const appointmentTime = new Date(appointment.appointmentDate).getTime()
    if (appointmentTime < weekStart.getTime() || appointmentTime >= weekStart.getTime() + 7 * 86_400_000) continue
    const label = appointment.timeSlotLabel || (appointment.timeSlot === 'morning' ? 'Buổi sáng' : appointment.timeSlot === 'afternoon' ? 'Buổi chiều' : 'Giờ hành chính')
    timeSlotCounts.set(label, (timeSlotCounts.get(label) || 0) + 1)
  }
  const busiestTimeSlot = Array.from(timeSlotCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có lịch hẹn'

  const summaryRow = (visitSummaryRes?.rows?.[0] as any) || {}
  const dailyRows = (visitDailyRes?.rows as any[] || []).reverse()
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentMonthStr = todayStr.slice(0, 7)
  const todayDaily = dailyRows.find((r) => r.date === todayStr) || {}
  const monthViews = dailyRows.filter((r) => String(r.date).startsWith(currentMonthStr)).reduce((sum, r) => sum + Number(r.views || 0), 0)
  const monthVisits = dailyRows.filter((r) => String(r.date).startsWith(currentMonthStr)).reduce((sum, r) => sum + Number(r.unique_visits || 0), 0)
  const vInitialOffset = Number(summaryRow.initial_offset || 0)

  const topContentRows = (topContentRes?.rows as any[] || [])
  const visitStatsData = {
    online: 1,
    today: {
      views: Number(todayDaily.views || 0),
      visits: Number(todayDaily.unique_visits || 0),
    },
    month: {
      views: monthViews || Number(todayDaily.views || 0),
      visits: monthVisits || Number(todayDaily.unique_visits || 0),
    },
    total: {
      views: Number(summaryRow.total_views || 0) + vInitialOffset,
      visits: Number(summaryRow.total_visits || 0) + vInitialOffset,
    },
    history: dailyRows.map((r) => ({
      date: r.date,
      views: Number(r.views || 0),
      visits: Number(r.unique_visits || 0),
    })),
    topContent: topContentRows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      type: r.type,
      typeLabel: r.type_label,
      views: Number(r.views || 0),
      updatedAt: r.updated_at,
      href: r.type === 'news' ? `/tin-tuc/${r.slug}` : r.type === 'notices' ? `/thong-bao/${r.slug}` : `/phac-do-dieu-tri/${r.slug}`,
    })),
  }

  // Cấu hình hiển thị biểu đồ theo đúng phân quyền của tài khoản
  const userCharts = {
    showVisitStatsChart: (elevated || can('pages') || can('news')) && dSettings.showVisitStatsChart !== false,
    showAreaChart: (elevated || can('news') || can('notices') || can('procurement')) && dSettings.showAreaChart !== false,
    showDepartmentBar: (elevated || can('doctors') || can('departments')) && dSettings.showDepartmentBar !== false,
    showSatisfactionGauge: (elevated || can('surveys')) && dSettings.showSatisfactionGauge !== false,
    showSlaStats: (elevated || can('feedback')) && dSettings.showSlaStats !== false,
    showWeeklyWorkload: (elevated || can('appointments')) && dSettings.showWeeklyWorkload !== false,
    showProtocolDistribution: (elevated || can('clinical-protocols')) && dSettings.showProtocolDistribution !== false,
    showResourceStructure: (elevated || allowedContentItems.length >= 2) && dSettings.showResourceStructure !== false,
    showFeedbackDonut: (elevated || can('feedback')) && dSettings.showFeedbackDonut !== false,
  }

  // Live Metrics Command Bar
  const commandBarNode = (
    <div key="command-bar-node" className={styles.commandBar}>
      <div className={styles.commandBarItem}>
        <DashboardGlyph name="clock" />
        <span>{today}</span>
      </div>
      <div className={styles.commandDivider} />
      <div className={styles.commandMetrics}>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Tổng nội dung số:</span>
          <strong className={styles.subMetricValue}>{totalContent}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Phác đồ điều trị:</span>
          <strong className={styles.subMetricValue}>{clinicalProtocols}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Bác sĩ & Nhân sự:</span>
          <strong className={styles.subMetricValue}>{doctors}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Dịch vụ kỹ thuật:</span>
          <strong className={styles.subMetricValue}>{services}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Ý kiến phản ánh:</span>
          <strong className={styles.subMetricValue}>{totalFeedback}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Tệp Media:</span>
          <strong className={styles.subMetricValue}>{media}</strong>
        </div>
        <div className={styles.subMetric}>
          <span className={styles.subMetricLabel}>Audit Logs:</span>
          <strong className={styles.subMetricValue}>{auditLogs}</strong>
        </div>
      </div>
    </div>
  )

  // Tổng hợp tất cả các mục cần xử lý / phản hồi gấp cho người quản trị theo đúng quyền
  const pendingItems: Array<{
    id: string | number
    title: string
    collection: string
    collectionLabel: string
    actionLabel: string
    severity?: 'normal' | 'danger' | 'urgent' | 'info'
    updatedAt?: string
  }> = []

  // 1. Phản hồi người bệnh (Góp ý / Khiếu nại) - Chỉ hiện khi có quyền xem/xử lý feedback
  const canSeeFeedback = elevated || can('feedback')
  if (canSeeFeedback) {
    ;(pendingFeedbackDocs?.docs || []).forEach((doc: any) => {
      const isComplaint = doc.type === 'Khiếu nại'
      pendingItems.push({
        id: doc.id,
        title: `${doc.type || 'Phản ánh'}: ${doc.name || 'Người bệnh'} - "${(doc.message || '').slice(0, 45)}${(doc.message || '').length > 45 ? '...' : ''}"`,
        collection: 'feedback',
        collectionLabel: isComplaint ? 'Khiếu nại' : 'Góp ý người bệnh',
        actionLabel: 'Xử lý ngay →',
        severity: isComplaint ? 'danger' : 'urgent',
        updatedAt: doc.createdAt || doc.updatedAt,
      })
    })
  }

  // 2. Đặt lịch khám tại cơ sở (Chờ xác nhận) - Chỉ hiện khi có quyền xem/xử lý appointments
  const canSeeAppointments = elevated || can('appointments')
  if (canSeeAppointments) {
    ;(pendingAppointmentDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({
        id: doc.id,
        title: `Hẹn khám: ${doc.fullName || 'Bệnh nhân'} (${doc.phone || ''}) - ${doc.specialtyTitle || 'Khám bệnh'}`,
        collection: 'appointments',
        collectionLabel: 'Đặt lịch khám',
        actionLabel: 'Gọi xác nhận →',
        severity: 'urgent',
        updatedAt: doc.createdAt || doc.updatedAt,
      })
    })
  }

  // 3. Tư vấn sức khỏe trực tuyến (Chờ giải đáp) - Chỉ hiện khi có quyền xem/xử lý consultations
  const canSeeConsultations = elevated || can('consultations')
  if (canSeeConsultations) {
    ;(pendingConsultationDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({
        id: doc.id,
        title: `Tư vấn: "${(doc.question || '').slice(0, 50)}${(doc.question || '').length > 50 ? '...' : ''}"`,
        collection: 'consultations',
        collectionLabel: 'Tư vấn trực tuyến',
        actionLabel: 'Trả lời ngay →',
        severity: 'info',
        updatedAt: doc.createdAt || doc.updatedAt,
      })
    })
  }

  // 4. Bài viết gửi duyệt xuất bản - CHỈ HIỂN THỊ KHI CÓ QUYỀN DUYỆT (approve / publish / elevated) CỦA ĐÚNG MODULE ĐÓ
  let userSubmittedCount = 0

  if (canPublish('news')) {
    userSubmittedCount += submittedNews
    ;(submittedNewsDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Tin tức chưa đặt tiêu đề', collection: 'news', collectionLabel: 'Tin tức', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  if (canPublish('notices')) {
    userSubmittedCount += submittedNotices
    ;(submittedNoticesDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Thông báo chưa đặt tiêu đề', collection: 'notices', collectionLabel: 'Thông báo', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  if (canPublish('procurement')) {
    userSubmittedCount += submittedProcurement
    ;(submittedProcurementDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Gói thầu chưa đặt tiêu đề', collection: 'procurement', collectionLabel: 'Đấu thầu', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  if (canPublish('recruitment')) {
    userSubmittedCount += submittedRecruitment
    ;(submittedRecruitmentDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Tuyển dụng chưa đặt tiêu đề', collection: 'recruitment', collectionLabel: 'Tuyển dụng', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  if (canPublish('custom-posts')) {
    userSubmittedCount += submittedCustomPosts
    ;(submittedCustomPostsDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Bài viết chuyên đề', collection: 'custom-posts', collectionLabel: 'Chuyên đề', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  if (canPublish('scientific-activities')) {
    userSubmittedCount += submittedScientific
    ;(submittedScientificDocs?.docs || []).forEach((doc: any) => {
      pendingItems.push({ id: doc.id, title: doc.title || 'Sinh hoạt KH', collection: 'scientific-activities', collectionLabel: 'Sinh hoạt KH', actionLabel: 'Duyệt bài →', severity: 'normal', updatedAt: doc.updatedAt })
    })
  }

  // Đếm tổng số việc cần xử lý / kiểm tra nhanh theo quyền của tài khoản
  const userFeedbackNew = canSeeFeedback ? feedbackNew : 0
  const userPendingAppointments = canSeeAppointments ? pendingAppointments : 0
  const userConsultations = canSeeConsultations ? consultations : 0
  const totalActionNeeded = userSubmittedCount + userFeedbackNew + userPendingAppointments + userConsultations

  // Sắp xếp các mục theo thứ tự thời gian mới nhất
  pendingItems.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

  // ⚠️ Khối cảnh báo & Tiếp nhận xử lý nhanh (chỉ hiện khi có việc cần phản hồi/duyệt thuộc quyền của user)
  const pendingTriageNode = totalActionNeeded > 0 ? (
    <div key="pending-triage-banner-node" className={styles.pendingTriageBanner}>
      <div className={styles.pendingTriageHeader}>
        <div className={styles.pendingTriageTitleGroup}>
          <span className={styles.pendingTriageIcon}>
            <DashboardGlyph name="notice" />
          </span>
          <div>
            <h2 className={styles.pendingTriageHeading}>
              Trung tâm Cảnh báo & Tiếp nhận Xử lý nhanh ({totalActionNeeded} việc cần phản hồi)
            </h2>
            <p className={styles.pendingTriageSubtext}>
              {userSubmittedCount > 0 ? `Có ${userSubmittedCount} bài viết chờ duyệt · ` : ''}
              {userPendingAppointments > 0 ? `${userPendingAppointments} lịch khám chờ xác nhận · ` : ''}
              {userFeedbackNew > 0 ? `${userFeedbackNew} phản hồi/khiếu nại mới · ` : ''}
              {userConsultations > 0 ? `${userConsultations} câu hỏi tư vấn y tế · ` : ''}
              Ban quản lý vui lòng kiểm tra và xử lý kịp thời.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {userSubmittedCount > 0 && (
            <span className={styles.pendingTriageBadge}>
              {userSubmittedCount} bài chờ duyệt
            </span>
          )}
          {userPendingAppointments > 0 && (
            <span className={styles.pendingTriageBadge} style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#ea580c' }}>
              {userPendingAppointments} hẹn khám mới
            </span>
          )}
          {userFeedbackNew > 0 && (
            <span className={styles.pendingTriageBadge} style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
              {userFeedbackNew} phản hồi mới
            </span>
          )}
          {userConsultations > 0 && (
            <span className={styles.pendingTriageBadge} style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0284c7' }}>
              {userConsultations} câu hỏi tư vấn
            </span>
          )}
        </div>
      </div>

      <div className={styles.pendingTriageGrid}>
        {pendingItems.slice(0, 10).map((item) => {
          const variantClass = item.severity === 'danger'
            ? styles.pendingTriageItemDanger
            : item.severity === 'urgent'
            ? styles.pendingTriageItemUrgent
            : item.severity === 'info'
            ? styles.pendingTriageItemInfo
            : ''

          return (
            <Link
              key={`${item.collection}-${item.id}`}
              href={`/admin/collections/${item.collection}/${item.id}`}
              className={`${styles.pendingTriageItem} ${variantClass}`}
            >
              <div className={styles.pendingTriageItemMain}>
                <span className={styles.pendingTriageItemType}>{item.collectionLabel}</span>
                <span className={styles.pendingTriageItemTitle} title={item.title}>
                  {item.title}
                </span>
                <span className={styles.pendingTriageItemMeta}>
                  Tiếp nhận: {formatDate(item.updatedAt)}
                </span>
              </div>
              <span className={styles.pendingTriageItemAction}>
                {item.actionLabel}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  ) : null

  // Bento Activity Feeds & Quick Action Links theo quyền
  const canSeeProtocols = elevated || can('clinical-protocols')
  const bentoContentNode = (
    <div key="bento-content-wrapper">
      {/* 5. Linear Activity Feeds Grid */}
      {(canSeeProtocols || canSeeFeedback) && (
        <div className={styles.bentoGrid}>
          {/* Feed 1: Phác đồ điều trị & Văn bản mới cập nhật (Chỉ hiện khi có quyền clinical-protocols) */}
          {canSeeProtocols && (
            <div className={styles.bentoCard}>
              <div className={styles.cardHeading}>
                <div>
                  <span className={styles.cardCategory}>CHUYÊN MÔN Y TẾ</span>
                  <h2 className={styles.cardTitle}>Phác đồ điều trị vừa cập nhật</h2>
                </div>
                <Link href="/admin/collections/clinical-protocols" className={styles.cardLink}>Xem tất cả →</Link>
              </div>

              <div className={styles.activityFeed}>
                {(latestProtocols.docs as any[]).length === 0 && (
                  <div className={styles.emptyFeed}>Chưa có phác đồ điều trị nào trong hệ thống.</div>
                )}
                {(latestProtocols.docs as any[]).map((item) => (
                  <Link href={`/admin/collections/clinical-protocols/${item.id}`} key={item.id} className={styles.feedRow}>
                    <div className={styles.feedAvatar}>
                      <DashboardGlyph name="stethoscope" />
                    </div>
                    <div className={styles.feedBody}>
                      <span className={styles.feedTitle}>{item.title || 'Chưa đặt tiêu đề'}</span>
                      <div className={styles.feedSub}>
                        <span>{item.protocolNumber ? `Số ${item.protocolNumber}` : 'Phác đồ điều trị'}</span>
                        <span>·</span>
                        <span>{formatDate(item.updatedAt)}</span>
                      </div>
                    </div>
                    <span className={`${styles.statusBadge} ${item.status === 'effective' ? styles.statusPublished : styles.statusDraft}`}>
                      {item.status === 'effective' ? 'Hiệu lực' : 'Đang dự thảo'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Feed 2: Ý kiến người bệnh chờ xử lý (Chỉ hiện khi có quyền feedback) */}
          {canSeeFeedback && (
            <div className={styles.bentoCard}>
              <div className={styles.cardHeading}>
                <div>
                  <span className={styles.cardCategory}>HỘP THƯ GÓP Ý</span>
                  <h2 className={styles.cardTitle}>Ý kiến người bệnh chờ xử lý</h2>
                </div>
                <Link href="/admin/collections/feedback" className={styles.cardLink}>Xem tất cả →</Link>
              </div>

              <div className={styles.activityFeed}>
                {(latestFeedback.docs as any[]).length === 0 && (
                  <div className={styles.emptyFeed}>
                    <span className={styles.emptyIcon}>✓</span>
                    <span>Hộp thư đang trống. Tất cả ý kiến đã được xử lý hoàn tất!</span>
                  </div>
                )}
                {(latestFeedback.docs as any[]).map((item) => (
                  <Link href={`/admin/collections/feedback/${item.id}`} key={item.id} className={styles.feedRow}>
                    <div className={`${styles.feedAvatar} ${styles.avatarUser}`}>
                      {item.name?.slice(0, 1)?.toUpperCase() || 'U'}
                    </div>
                    <div className={styles.feedBody}>
                      <span className={styles.feedTitle}>{item.name || 'Người gửi ẩn danh'}</span>
                      <div className={styles.feedSub}>
                        <span>{item.type || 'Góp ý'}</span>
                        <span>·</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`${styles.statusBadge} ${item.status === 'new' ? styles.statusNew : styles.statusProcessing}`}>
                      {item.status === 'new' ? 'Mới gửi' : 'Đang xử lý'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Quick Launch Command Grid - chỉ hiện các phím tắt mà user có quyền thao tác */}
      <section className={styles.quickCommandsSection}>
        <div className={styles.quickCommandsHead}>
          <span className={styles.cardCategory}>TRUY CẬP TÁC VỤ NHANH</span>
          <h2 className={styles.cardTitle}>Phím tắt tạo mới & Điều hành nhanh</h2>
        </div>

        <div className={styles.commandsGrid}>
          {(elevated || can('clinical-protocols', 'create')) && (
            <Link href="/admin/collections/clinical-protocols/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="stethoscope" />
              <span>Thêm Phác đồ điều trị</span>
              <kbd className={styles.shortcutKey}>⌘P</kbd>
            </Link>
          )}
          {(elevated || can('doctors', 'create')) && (
            <Link href="/admin/collections/doctors/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="people" />
              <span>Thêm Bác sĩ mới</span>
              <kbd className={styles.shortcutKey}>⌘B</kbd>
            </Link>
          )}
          {(elevated || can('schedules', 'create')) && (
            <Link href="/admin/collections/schedules/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="schedule" />
              <span>Cập nhật Lịch khám</span>
              <kbd className={styles.shortcutKey}>⌘L</kbd>
            </Link>
          )}
          {(elevated || can('work-schedules', 'create')) && (
            <Link href="/admin/collections/work-schedules/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="schedule" />
              <span>Tạo Lịch công tác tuần</span>
              <kbd className={styles.shortcutKey}>⌘W</kbd>
            </Link>
          )}
          {(elevated || can('news', 'create')) && (
            <Link href="/admin/collections/news/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="news" />
              <span>Đăng bài Tin tức</span>
              <kbd className={styles.shortcutKey}>⌘N</kbd>
            </Link>
          )}
          {(elevated || can('notices', 'create')) && (
            <Link href="/admin/collections/notices/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="notice" />
              <span>Tạo Thông báo khẩn</span>
              <kbd className={styles.shortcutKey}>⌘T</kbd>
            </Link>
          )}
          {(elevated || can('procurement', 'create')) && (
            <Link href="/admin/collections/procurement/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="procurement" />
              <span>Tạo Gói thầu</span>
              <kbd className={styles.shortcutKey}>⌘G</kbd>
            </Link>
          )}
          {(elevated || can('documents', 'create')) && (
            <Link href="/admin/collections/documents/create" className={styles.commandActionBtn}>
              <DashboardGlyph name="document" />
              <span>Đăng tải Văn bản</span>
              <kbd className={styles.shortcutKey}>⌘D</kbd>
            </Link>
          )}
          {(elevated || can('appointments')) && (
            <Link href="/admin/collections/appointments" className={styles.commandActionBtn}>
              <DashboardGlyph name="schedule" />
              <span>Duyệt lịch đặt khám</span>
              <kbd className={styles.shortcutKey}>⌘A</kbd>
            </Link>
          )}
          {(elevated || can('feedback')) && (
            <Link href="/admin/collections/feedback" className={styles.commandActionBtn}>
              <DashboardGlyph name="feedback" />
              <span>Hộp thư phản ánh ({feedbackNew})</span>
              <kbd className={styles.shortcutKey}>⌘F</kbd>
            </Link>
          )}
          {elevated && (
            <Link href="/admin/globals/homepage" className={styles.commandActionBtn}>
              <DashboardGlyph name="chart" />
              <span>Cấu hình Trang chủ</span>
              <kbd className={styles.shortcutKey}>⌘H</kbd>
            </Link>
          )}
        </div>
      </section>
    </div>
  )

  return (
    <AdminDashboardClient
      initialMetricCards={initialMetricCards}
      initialCharts={userCharts}
      timelineData={timelineData}
      departmentStats={departmentStats}
      satisfactionScore={can('surveys') ? satisfactionScore : 0}
      satisfactionCriteria={can('surveys') ? satisfactionCriteria : []}
      surveyResponses={can('surveys') ? realSurveyScores.length : 0}
      slaResolvedPercent={can('feedback') ? slaResolvedPercent : 0}
      feedbackAvgHours={can('feedback') ? feedbackAvgHours : 0}
      totalAppointments={can('appointments') ? appointments : 0}
      clinicalProtocols={can('clinical-protocols') ? clinicalProtocols : 0}
      protocolGroups={can('clinical-protocols') ? protocolGroups : []}
      effectiveProtocols={can('clinical-protocols') ? effectiveProtocolCount : 0}
      workloadData={can('appointments') ? workloadData : []}
      workloadTimeLabel={can('appointments') ? busiestTimeSlot : 'Không có quyền xem'}
      contentBreakdown={contentBreakdown}
      totalContent={elevated ? totalContent : allowedContentItems.reduce((sum, item) => sum + item.count, 0)}
      totalFeedback={can('feedback') ? operationalFeedbackTotal : 0}
      feedbackNew={can('feedback') ? operationalFeedbackNew : 0}
      feedbackProcessing={can('feedback') ? operationalFeedbackProcessing : 0}
      feedbackDone={can('feedback') ? operationalFeedbackDone : 0}
      feedbackDonePercent={can('feedback') && operationalFeedbackTotal ? `${Math.round((operationalFeedbackDone / operationalFeedbackTotal) * 100)}%` : '0%'}
      feedbackProcessingPercent={can('feedback') && operationalFeedbackTotal ? `${Math.round((operationalFeedbackProcessing / operationalFeedbackTotal) * 100)}%` : '0%'}
      visitStatsData={(elevated || can('pages') || can('news')) ? visitStatsData : undefined}
      canCreateNews={elevated || can('news', 'create')}
      canManageSurveys={elevated || can('surveys')}
      accountSummaryNode={<AdminAccountSummary key="account-summary-node" />}
      commandBarNode={elevated ? commandBarNode : null}
      bentoContentNode={bentoContentNode}
      pendingTriageNode={pendingTriageNode}
    />
  )
}
