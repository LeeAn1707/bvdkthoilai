import type { MetadataRoute } from 'next'
import { getGlobal } from '@/lib/payload'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  let seo: any = {}
  try { seo = await getGlobal('seo-settings') } catch {}
  const disallow = Array.isArray(seo?.robotsDisallow) && seo.robotsDisallow.length
    ? seo.robotsDisallow.map((item: any) => item?.path).filter(Boolean)
    : ['/admin/', '/api/']
  if (seo?.allowIndexing === false) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: seo?.enableSitemap === false ? undefined : `${base}/sitemap.xml`,
  }
}
