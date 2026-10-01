import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import nodemailer from 'nodemailer'
import { s3Storage } from '@payloadcms/storage-s3'
import { vi } from '@payloadcms/translations/languages/vi'
import { buildConfig, type CollectionConfig, type GlobalConfig } from 'payload'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { News } from './src/collections/News'
import { Notices } from './src/collections/Notices'
import { HealthWarnings } from './src/collections/HealthWarnings'
import { Procurement } from './src/collections/Procurement'
import { Documents } from './src/collections/Documents'
import { ClinicalProtocols } from './src/collections/ClinicalProtocols'
import { Departments } from './src/collections/Departments'
import { Doctors } from './src/collections/Doctors'
import { Specialties } from './src/collections/Specialties'
import { Schedules } from './src/collections/Schedules'
import { WorkSchedules } from './src/collections/WorkSchedules'
import { Services } from './src/collections/Services'
import { Vaccinations } from './src/collections/Vaccinations'
import { ServicePrices } from './src/collections/ServicePrices'
import { Vaccines } from './src/collections/Vaccines'
import { VaccinePrices } from './src/collections/VaccinePrices'
import { VaccinationSchedules } from './src/collections/VaccinationSchedules'
import { ImportJobs } from './src/collections/ImportJobs'
import { Recruitment } from './src/collections/Recruitment'
import { Pages } from './src/collections/Pages'
import { Feedback } from './src/collections/Feedback'
import { Consultations } from './src/collections/Consultations'
import { Categories } from './src/collections/Categories'
import { Redirects } from './src/collections/Redirects'
import { DynamicModules } from './src/collections/DynamicModules'
import { ContentSections } from './src/collections/ContentSections'
import { CustomPosts } from './src/collections/CustomPosts'
import { AdvancedTechniques } from './src/collections/AdvancedTechniques'
import { OurExperts } from './src/collections/OurExperts'
import { ScientificActivities } from './src/collections/ScientificActivities'
import { ScientificActivityGroups } from './src/collections/ScientificActivityGroups'
import { FAQs } from './src/collections/FAQs'
import { Forms } from './src/collections/Forms'
import { FormSubmissions } from './src/collections/FormSubmissions'
import { FeedbackCategories } from './src/collections/FeedbackCategories'
import { FeedbackCases } from './src/collections/FeedbackCases'
import { FeedbackActions } from './src/collections/FeedbackActions'
import { ChatbotIntents } from './src/collections/ChatbotIntents'
import { ChatbotConversations } from './src/collections/ChatbotConversations'
import { ChatbotUnanswered } from './src/collections/ChatbotUnanswered'
import { SurveyTemplates } from './src/collections/SurveyTemplates'
import { SurveyTemplateVersions } from './src/collections/SurveyTemplateVersions'
import { SurveyQuestions } from './src/collections/SurveyQuestions'
import { SurveyCampaigns } from './src/collections/SurveyCampaigns'
import { SurveyCodes } from './src/collections/SurveyCodes'
import { SurveyResponses } from './src/collections/SurveyResponses'
import { SurveyAnswers } from './src/collections/SurveyAnswers'
import { SurveyStatistics } from './src/collections/SurveyStatistics'
import { AuditLogs } from './src/collections/AuditLogs'
import { SiteSettings } from './src/globals/SiteSettings'
import { Navigation } from './src/globals/Navigation'
import { Homepage } from './src/globals/Homepage'
import { OrganizationChart } from './src/globals/OrganizationChart'
import { UploadSettings } from './src/globals/UploadSettings'
import { Footer } from './src/globals/Footer'
import { ContactSettings } from './src/globals/ContactSettings'
import { SocialSettings } from './src/globals/SocialSettings'
import { MedproSettings } from './src/globals/MedproSettings'
import { ThemeSettings } from './src/globals/ThemeSettings'
import { DefaultMediaSettings } from './src/globals/DefaultMediaSettings'
import { SeoSettings } from './src/globals/SeoSettings'
import { ChatbotSettings } from './src/globals/ChatbotSettings'
import { SystemSettings } from './src/globals/SystemSettings'
import { ScheduleSettings } from './src/globals/ScheduleSettings'
import { AppointmentSettings } from './src/globals/AppointmentSettings'
import { Appointments } from './src/collections/Appointments'
import { QuickLinksSettings } from './src/globals/QuickLinksSettings'
import { HospitalHistory } from './src/globals/HospitalHistory'
import { AboutPage } from './src/globals/AboutPage'
import { WorkingHoursSettings } from './src/globals/WorkingHoursSettings'
import { PatientPortalSettings } from './src/globals/PatientPortalSettings'
import { ExaminationFlowSettings } from './src/globals/ExaminationFlowSettings'
import { InpatientGuideSettings } from './src/globals/InpatientGuideSettings'
import { CheckupPackagesSettings } from './src/globals/CheckupPackagesSettings'
import { HospitalMapSettings } from './src/globals/HospitalMapSettings'
import { HospitalQualitySettings } from './src/globals/HospitalQualitySettings'
import { SurveyPageSettings } from './src/globals/SurveyPageSettings'
import { FaqPageSettings } from './src/globals/FaqPageSettings'
import { FormsPageSettings } from './src/globals/FormsPageSettings'
import { FeedbackPageSettings } from './src/globals/FeedbackPageSettings'
import { DisplaySettings } from './src/globals/DisplaySettings'
import { ArticleDetailSettings } from './src/globals/ArticleDetailSettings'
import { VaccinationSettings } from './src/globals/VaccinationSettings'
import { withAudit, withGlobalAudit } from './src/lib/audit'
import { hospitalEditor } from './src/editor/hospitalEditor'
import { hasModulePermission } from './src/access'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const isProduction = process.env.NODE_ENV === 'production'
const payloadSecret = process.env.PAYLOAD_SECRET
const databaseURL = process.env.DATABASE_URL || process.env.DATABASE_URI || process.env.POSTGRES_URL
const siteURL = process.env.NEXT_PUBLIC_SITE_URL
// Next dev tự chuyển sang cổng kế tiếp khi 3000 đang được dùng. Payload chỉ đọc
// JWT từ cookie khi Origin nằm trong CSRF allowlist, vì vậy cần khai báo rõ các
// cổng phát triển local thay vì để form Admin mất phiên đăng nhập ở cổng 3001+.
const localDevPorts = Array.from({ length: 11 }, (_, index) => 3000 + index)
const localOrigins = localDevPorts.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
])
const allowedOrigins = Array.from(new Set([...(siteURL ? [siteURL] : []), ...(!isProduction ? localOrigins : [])]))

const r2Bucket = process.env.R2_BUCKET || ''
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || ''
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
const r2Endpoint = process.env.R2_ENDPOINT || ''
const mediaStorage = String(process.env.MEDIA_STORAGE || '').trim().toLowerCase()
const r2EnvConfigured = Boolean(r2Bucket && r2AccessKeyId && r2SecretAccessKey && r2Endpoint)

// Production có đủ biến R2 thì dùng R2. Local/offline mặc định luôn dùng thư mục /media
// để không bị lỗi khi máy không có mạng hoặc còn sót biến R2 trong .env.local.
// Muốn test R2 ở local thì đặt MEDIA_STORAGE=r2.
const r2Enabled = r2EnvConfigured && (isProduction || mediaStorage === 'r2')

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpUser = process.env.SMTP_USER || ''
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '')
// Chỉ kích hoạt SMTP Adapter khi có cấu hình đầy đủ trong biến môi trường thực tế,
// tránh việc Nodemailer liên tục verify và timeout khi deploy trên Railway/Production
const smtpConfigured = Boolean(process.env.SMTP_PASS && process.env.SMTP_USER)

const collectionPermissionModules: Record<string, string> = {
  media: 'media',
  news: 'news',
  notices: 'notices',
  'health-warnings': 'health-warnings',
  procurement: 'procurement',
  documents: 'documents',
  'clinical-protocols': 'clinical-protocols',
  departments: 'departments',
  specialties: 'specialties',
  doctors: 'doctors',
  schedules: 'schedules',
  'work-schedules': 'work-schedules',
  appointments: 'appointments',
  services: 'services',
  servicePrices: 'services',
  vaccinations: 'vaccinations',
  vaccinationSchedules: 'vaccinations',
  vaccines: 'vaccinations',
  vaccinePrices: 'vaccinations',
  recruitment: 'recruitment',
  pages: 'pages',
  categories: 'categories',
  feedback: 'feedback',
  feedbackCategories: 'feedback',
  feedbackCases: 'feedback',
  feedbackActions: 'feedback',
  consultations: 'consultations',
  faqs: 'faqs',
  forms: 'forms',
  formSubmissions: 'forms',
  chatbotIntents: 'chatbot',
  chatbotConversations: 'chatbot',
  chatbotUnanswered: 'chatbot',
  'survey-templates': 'surveys',
  'survey-template-versions': 'surveys',
  'survey-questions': 'surveys',
  'survey-campaigns': 'surveys',
  'survey-codes': 'surveys',
  'survey-responses': 'surveys',
  'survey-answers': 'surveys',
  'survey-statistics': 'surveys',
  redirects: 'pages',
  'dynamic-modules': 'pages',
  'content-sections': 'custom-posts',
  'custom-posts': 'custom-posts',
  'advanced-techniques': 'advanced-techniques',
  'our-experts': 'doctors',
  'scientific-activity-groups': 'scientific-activities',
  'scientific-activities': 'scientific-activities',
  importJobs: 'services',
}

const globalPermissionModules: Record<string, string> = {
  'site-settings': 'site-settings',
  navigation: 'navigation',
  footer: 'site-settings',
  'contact-settings': 'site-settings',
  'social-settings': 'site-settings',
  'theme-settings': 'site-settings',
  homepage: 'homepage',
  'display-settings': 'homepage',
  'quick-links-settings': 'homepage',
  'medpro-settings': 'appointments',
  'chatbot-settings': 'chatbot',
  'schedule-settings': 'schedules',
  'working-hours-settings': 'schedules',
  'appointment-settings': 'appointments',
  'patient-portal-settings': 'site-settings',
  'examination-flow-settings': 'services',
  'inpatient-guide-settings': 'services',
  'checkup-packages-settings': 'services',
  'hospital-map-settings': 'services',
  'hospital-quality-settings': 'surveys',
  'survey-page-settings': 'surveys',
  'faq-page-settings': 'faqs',
  'forms-page-settings': 'forms',
  'feedback-page-settings': 'feedback',
  'article-detail-settings': 'site-settings',
  'vaccination-settings': 'services',
  'organization-chart': 'departments',
  'hospital-history': 'pages',
  'about-page': 'pages',
  'upload-settings': 'site-settings',
  'default-media-settings': 'site-settings',
  'seo-settings': 'site-settings',
}

const hideWithoutModulePermission = <T extends CollectionConfig | GlobalConfig>(
  config: T,
  moduleName?: string,
): T => {
  const existingHidden = config.admin?.hidden

  // Nhóm quản trị hệ thống cao cấp: Người dùng, Nhật ký và Cấu hình hệ thống chỉ dành cho Admin cấp cao
  if (config.slug === 'users' || config.slug === 'audit-logs' || config.slug === 'system-settings') {
    return {
      ...config,
      admin: {
        ...config.admin,
        hidden: (args: any) => {
          const alreadyHidden = typeof existingHidden === 'function'
            ? existingHidden(args)
            : existingHidden === true
          const userRole = args.user?.role
          const isElevated = userRole === 'super-admin' || userRole === 'system-admin' || userRole === 'admin'
          return alreadyHidden || !isElevated
        },
      },
    }
  }

  if (!moduleName) return config

  return {
    ...config,
    admin: {
      ...config.admin,
      hidden: (args: any) => {
        const alreadyHidden = typeof existingHidden === 'function'
          ? existingHidden(args)
          : existingHidden === true
        return alreadyHidden || !hasModulePermission(args.user, moduleName, 'view')
      },
    },
  }
}

const applyCollectionPermissionVisibility = (config: CollectionConfig): CollectionConfig =>
  hideWithoutModulePermission(config, collectionPermissionModules[config.slug])

const applyGlobalPermissionVisibility = (config: GlobalConfig): GlobalConfig =>
  hideWithoutModulePermission(config, globalPermissionModules[config.slug])

const isBuildPhase = Boolean(
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.env.npm_lifecycle_event === 'prebuild'
)
const effectivePayloadSecret = payloadSecret || (isBuildPhase || !isProduction ? 'development-build-secret-32characters-fallback' : '')
const effectiveDatabaseURL = databaseURL || (isBuildPhase ? 'postgresql://postgres:postgres@127.0.0.1:5432/build_placeholder' : '')

if (isProduction && !isBuildPhase && (!effectivePayloadSecret || effectivePayloadSecret === 'CHANGE_ME' || effectivePayloadSecret.length < 32)) {
  throw new Error('PAYLOAD_SECRET bắt buộc phải có ít nhất 32 ký tự trên Production khi khởi chạy.')
}
if (!effectiveDatabaseURL && !isBuildPhase) {
  throw new Error('Thiếu biến môi trường DATABASE_URL.')
}

export default buildConfig({
  serverURL: siteURL || 'http://localhost:3000',
  maxDepth: 4,
  upload: { limits: { fileSize: 50 * 1024 * 1024 } },
  graphQL: { disable: true },
  cors: allowedOrigins,
  csrf: allowedOrigins,
  i18n: {
    supportedLanguages: { vi },
    fallbackLanguage: 'vi',
  },
  editor: hospitalEditor,
  secret: effectivePayloadSecret || 'development-only-secret-change-before-production',
  email: smtpConfigured
    ? nodemailerAdapter({
        defaultFromAddress: process.env.SMTP_FROM_ADDRESS || smtpUser,
        defaultFromName: process.env.SMTP_FROM_NAME || 'Bệnh viện Đa khoa Khu vực Thới Lai',
        skipVerify: true,
        transport: nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        }),
      })
    : undefined,

  db: postgresAdapter({
    push: process.env.PAYLOAD_DB_PUSH === 'true',
    pool: {
      connectionString: effectiveDatabaseURL,
      connectionTimeoutMillis: 30000,
      max: Number(process.env.DB_POOL_MAX || (isProduction ? 10 : 20)),
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  }),
  sharp,
  // Luôn đăng ký adapter để importMap Production nhận diện đúng component S3.
  // `enabled` quyết định upload thật sự đi R2 hay local /media.
  plugins: [
    s3Storage({
      enabled: r2Enabled,
      collections: {
        // Keep Payload proxy/access control for public/internal/restricted media.
        media: true,
      },
      bucket: r2Bucket || 'r2-disabled-at-build',
      config: {
        credentials: {
          accessKeyId: r2AccessKeyId || 'r2-disabled-at-build',
          secretAccessKey: r2SecretAccessKey || 'r2-disabled-at-build',
        },
        region: 'auto',
        endpoint: r2Endpoint || 'https://example.invalid',
        forcePathStyle: true,
      },
    }),
  ],
  typescript: { outputFile: path.resolve(dirname, 'src/payload-types.ts') },
  admin: {
    user: Users.slug,
    components: {
      beforeDashboard: ['/src/components/admin/AdminDashboard'],
      beforeNavLinks: ['/src/components/admin/AdminNavHeader'],
      afterNavLinks: ['/src/components/admin/AdminLogoutButton'],
      graphics: {
        Logo: '/src/components/admin/AdminLogo',
        Icon: '/src/components/admin/AdminIcon',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'src/app/(payload)/admin/importMap.js'),
    },
    meta: {
      titleSuffix: ' — BVĐK Khu vực Thới Lai'
    }
  },
  collections: [
    applyCollectionPermissionVisibility(Users),
    ...[Media, News, Notices, HealthWarnings, Procurement, Documents, ClinicalProtocols,
      Departments, Specialties, Doctors, Schedules, WorkSchedules, Appointments, Services, ServicePrices, Vaccinations, VaccinationSchedules, Vaccines, VaccinePrices, Recruitment, Pages, Categories, Feedback, Consultations, FeedbackCategories, FeedbackCases, FeedbackActions, FAQs, Forms, FormSubmissions, ChatbotIntents, ChatbotConversations, ChatbotUnanswered, SurveyTemplates, SurveyTemplateVersions, SurveyQuestions, SurveyCampaigns, SurveyCodes, SurveyResponses, SurveyAnswers, SurveyStatistics, Redirects, DynamicModules, ContentSections, CustomPosts, AdvancedTechniques, OurExperts, ScientificActivityGroups, ScientificActivities, ImportJobs
    ].map((collection) => withAudit(applyCollectionPermissionVisibility(collection))),
    applyCollectionPermissionVisibility(AuditLogs),
  ],
  globals: [
    SiteSettings, Navigation, Footer, ContactSettings, SocialSettings, MedproSettings, ThemeSettings, Homepage, OrganizationChart, HospitalHistory, AboutPage, WorkingHoursSettings, PatientPortalSettings,
    ExaminationFlowSettings, InpatientGuideSettings, CheckupPackagesSettings, HospitalMapSettings, HospitalQualitySettings, SurveyPageSettings, FaqPageSettings, FormsPageSettings, FeedbackPageSettings,
    UploadSettings, DefaultMediaSettings, SeoSettings, ChatbotSettings, SystemSettings, ScheduleSettings, AppointmentSettings, QuickLinksSettings,
    DisplaySettings, ArticleDetailSettings, VaccinationSettings
  ].map((global) => withGlobalAudit(applyGlobalPermissionVisibility(global)))
})
