import type { Metadata } from 'next'
import { PageHero } from '@/components/PageHero'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { DocumentDirectoryView, type DocumentDirectoryItem } from '@/components/DocumentDirectoryView'
import { getCMS } from '@/lib/payload'
import { mediaUrl } from '@/lib/media'
import { categoryName, getDefaultContentMedia } from '@/lib/defaultMedia'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Thông báo – Bệnh viện Đa khoa Khu vực Thới Lai',
  description: 'Thông báo mới nhất từ Bệnh viện Đa khoa Khu vực Thới Lai: thông báo khẩn, thông báo thường và các thông tin quan trọng dành cho người bệnh và cộng đồng.',
}

export default async function Page() {
  let items: DocumentDirectoryItem[] = []

  try {
    const payload = await getCMS()
    const [r, defaults] = await Promise.all([
      payload.find({ collection: 'notices', where: { _status: { equals: 'published' } }, sort: '-startAt', limit: 200, depth: 2 }).catch(() => ({ docs: [] })),
      getDefaultContentMedia(),
    ])

    items = (r.docs as any[]).map(x => {
      const dateRaw = x.publishedAt || x.startAt
      const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString('vi-VN') : ''
      const yearStr = dateRaw ? String(new Date(dateRaw).getFullYear()) : ''
      const cat = categoryName(x) || x.level || x.noticeType || 'Thông báo'

      const levelMap: Record<string, string> = {
        urgent: '⚠️ Khẩn',
        important: '🟡 Quan trọng',
        normal: 'Thông thường',
      }
      const levelLabel = levelMap[x.level] || 'Thông thường'

      const summaryParts: string[] = []
      if (x.excerpt) {
        summaryParts.push(x.excerpt)
      }
      if (x.expireAt) {
        summaryParts.push(`⏳ Hạn hiệu lực: ${new Date(x.expireAt).toLocaleDateString('vi-VN')}`)
      }
      if (summaryParts.length === 0) {
        summaryParts.push('Thông báo chính thức từ Bệnh viện Đa khoa Khu vực Thới Lai dành cho người bệnh và nhân dân.')
      }

      // Chỉ lấy chuyên mục tiếng Việt thật sự, không lấy 'normal'/'urgent'/'important' tiếng Anh
      const rawCat = categoryName(x) || x.noticeType
      const cleanCat = (rawCat && rawCat !== 'normal' && rawCat !== 'urgent' && rawCat !== 'important') ? rawCat : undefined

      return {
        id: `notice-${x.id}`,
        title: x.title,
        slug: x.slug,
        number: levelLabel,
        category: cleanCat,
        documentType: cleanCat || 'Thông báo',
        issuedAt: dateRaw,
        date: dateStr,
        year: yearStr,
        summary: summaryParts.join(' • '),
        excerpt: x.excerpt || 'Thông báo chính thức từ Bệnh viện Đa khoa Khu vực Thới Lai.',
        coverUrl: mediaUrl(x.cover || x.seoImage) || defaults.notices,
        href: `/thong-bao/${x.slug}`,
        accessMode: 'public' as const,
        allowDownload: true,
      }
    })
  } catch {}

  return (
    <>
      <SiteHeader />
      <PageHero
        title="Thông báo mới"
        description="Cập nhật nhanh các thông báo khẩn, lịch khám bệnh, thời gian tiếp nhận và thông tin quan trọng từ Bệnh viện Đa khoa Khu vực Thới Lai."
      />
      <main className="section" style={{ background: '#f8fafc', minHeight: '80vh', padding: '36px 0 64px' }}>
        <div className="container">
          <DocumentDirectoryView
            items={items}
            title="Danh sách thông báo"
            eyebrow="TRA CỨU THÔNG BÁO"
            emptyText="Hiện chưa có thông báo nào được đăng."
            hideColumns={['issuer']}
            searchPlaceholder="Tìm kiếm thông báo theo tiêu đề, nội dung..."
            columnLabels={{
              number: 'Mức độ',
              date: 'Ngày thông báo',
              title: 'Tiêu đề & Nội dung thông báo',
              action: 'Chi tiết',
            }}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
