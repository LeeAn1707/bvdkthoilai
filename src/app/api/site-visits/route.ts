import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getCMS } from '@/lib/payload'
import { clientAddress, rateLimit, readJsonBodyWithLimit } from '@/lib/request-security'

// Cache đếm người đang online (hoạt động trong 5 phút gần nhất)
// Key: visitorId/IP hash, Value: timestamp
const activeSessions = new Map<string, number>()
const ONLINE_WINDOW_MS = 5 * 60 * 1000 // 5 phút
const MAX_ACTIVE_SESSIONS = 10_000
const SLUG_PATTERN = /^[a-z0-9-]+$/i

function cleanOldSessions() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS
  for (const [key, ts] of activeSessions.entries()) {
    if (ts < cutoff) {
      activeSessions.delete(key)
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const throttle = rateLimit(req, 'site-visits-get', 60, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu truy vấn thống kê. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } },
      )
    }

    const payload = await getCMS()
    cleanOldSessions()

    // 1. Tính số người đang online
    const onlineCount = Math.max(1, activeSessions.size)

    // 2. Lấy ngày hôm nay định dạng YYYY-MM-DD
    const todayStr = new Date().toISOString().slice(0, 10)
    const currentMonthLike = `${todayStr.slice(0, 7)}%` // YYYY-MM%

    // 3. Truy vấn thống kê từ DB (Parameterized SQL)
    const [summaryRes, todayRes, monthRes, historyRes, topContentRes] = await Promise.all([
      payload.db.drizzle.execute(
        sql`SELECT total_views, total_visits, initial_offset FROM public."site_visits_summary" WHERE id = 1 LIMIT 1;`
      ).catch(() => ({ rows: [] })),
      payload.db.drizzle.execute(
        sql`SELECT views, unique_visits FROM public."site_visits_daily" WHERE date = ${todayStr} LIMIT 1;`
      ).catch(() => ({ rows: [] })),
      payload.db.drizzle.execute(
        sql`SELECT COALESCE(SUM(views), 0)::bigint AS month_views, COALESCE(SUM(unique_visits), 0)::bigint AS month_visits 
         FROM public."site_visits_daily" WHERE date LIKE ${currentMonthLike};`
      ).catch(() => ({ rows: [] })),
      // Lấy 14 ngày gần nhất để vẽ biểu đồ đường xu hướng
      payload.db.drizzle.execute(
        sql`SELECT date, views, unique_visits 
         FROM public."site_visits_daily" 
         ORDER BY date DESC LIMIT 14;`
      ).catch(() => ({ rows: [] })),
      // Lấy top 10 bài viết xem nhiều nhất từ News và Notices
      payload.db.drizzle.execute(
        sql`SELECT id, title, slug, 'news' AS type, 'Tin tức' AS type_label, COALESCE(views, 0)::int AS views, updated_at
         FROM public."news" WHERE _status = 'published'
         UNION ALL
         SELECT id, title, slug, 'notices' AS type, 'Thông báo' AS type_label, COALESCE(views, 0)::int AS views, updated_at
         FROM public."notices" WHERE _status = 'published'
         UNION ALL
         SELECT id, title, slug, 'clinical-protocols' AS type, 'Phác đồ' AS type_label, COALESCE(views, 0)::int AS views, updated_at
         FROM public."clinical_protocols"
         ORDER BY views DESC, updated_at DESC
         LIMIT 10;`
      ).catch(() => ({ rows: [] })),
    ])

    const summary = summaryRes.rows?.[0] as any || {}
    const today = todayRes.rows?.[0] as any || {}
    const month = monthRes.rows?.[0] as any || {}
    const historyRows = (historyRes.rows as any[] || []).reverse()
    const topContentRows = (topContentRes.rows as any[] || [])

    const initialOffset = Number(summary.initial_offset || 0)
    const totalViews = Number(summary.total_views || 0) + initialOffset
    const totalVisits = Number(summary.total_visits || 0) + initialOffset
    const todayViews = Number(today.views || 0)
    const todayVisits = Number(today.unique_visits || 0)
    const monthViews = Number(month.month_views || 0)
    const monthVisits = Number(month.month_visits || 0)

    return NextResponse.json({
      success: true,
      data: {
        online: onlineCount,
        today: {
          views: todayViews,
          visits: todayVisits,
        },
        month: {
          views: monthViews,
          visits: monthVisits,
        },
        total: {
          views: totalViews,
          visits: totalVisits,
        },
        history: historyRows.map((r) => ({
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
      },
    })
  } catch (error: any) {
    console.error('[site-visits][GET] Error:', error?.message || error)
    return NextResponse.json({ success: false, error: 'Không thể tải dữ liệu thống kê truy cập.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const throttle = rateLimit(req, 'site-visits-post', 120, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu ghi nhận lượt truy cập.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } },
      )
    }

    const parsedBody = await readJsonBodyWithLimit<Record<string, unknown>>(req, 4096)
    if (parsedBody.status === 413) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 413 })
    }
    const body = parsedBody.data && typeof parsedBody.data === 'object' ? parsedBody.data : {}

    const payload = await getCMS()
    const now = Date.now()

    const rawCollection = typeof body.collection === 'string' ? body.collection.trim() : ''
    const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : ''

    // 1. Nhận diện visitor (từ IP đã khử khuẩn + User-Agent rút gọn)
    const clientIp = clientAddress(req)
    const userAgent = (req.headers.get('user-agent') || 'unknown').slice(0, 30)
    const visitorId = `${clientIp}_${userAgent}`

    cleanOldSessions()

    // Giới hạn kích thước activeSessions chống DoS bộ nhớ
    const isNewVisitorSession = !activeSessions.has(visitorId)
    if (isNewVisitorSession && activeSessions.size >= MAX_ACTIVE_SESSIONS) {
      const oldestKey = activeSessions.keys().next().value
      if (oldestKey) activeSessions.delete(oldestKey)
    }
    activeSessions.set(visitorId, now)

    const visitDelta = isNewVisitorSession ? 1 : 0
    const todayStr = new Date().toISOString().slice(0, 10)

    // 2. Cập nhật bảng site_visits_summary (Parameterized SQL)
    await payload.db.drizzle.execute(sql`
      INSERT INTO public."site_visits_summary" ("id", "total_views", "total_visits", "initial_offset", "updated_at")
      VALUES (1, 1, ${visitDelta}, 0, now())
      ON CONFLICT ("id") DO UPDATE
      SET total_views = public."site_visits_summary".total_views + 1,
          total_visits = public."site_visits_summary".total_visits + ${visitDelta},
          updated_at = now();
    `)

    // 3. Cập nhật bảng site_visits_daily (Parameterized SQL)
    await payload.db.drizzle.execute(sql`
      INSERT INTO public."site_visits_daily" ("date", "views", "unique_visits", "updated_at")
      VALUES (${todayStr}, 1, ${visitDelta}, now())
      ON CONFLICT ("date") DO UPDATE
      SET views = public."site_visits_daily".views + 1,
          unique_visits = public."site_visits_daily".unique_visits + ${visitDelta},
          updated_at = now();
    `)

    // 4. Nếu có truyền thông tin bài viết cụ thể -> Tăng views bằng Parameterized SQL (Chống tuyệt đối SQL Injection)
    if (rawCollection && rawSlug && rawSlug.length <= 200 && SLUG_PATTERN.test(rawSlug)) {
      if (rawCollection === 'news') {
        await payload.db.drizzle.execute(
          sql`UPDATE public."news" SET views = COALESCE(views, 0) + 1 WHERE slug = ${rawSlug};`
        ).catch(() => {})
      } else if (rawCollection === 'notices') {
        await payload.db.drizzle.execute(
          sql`UPDATE public."notices" SET views = COALESCE(views, 0) + 1 WHERE slug = ${rawSlug};`
        ).catch(() => {})
      } else if (rawCollection === 'clinical-protocols') {
        await payload.db.drizzle.execute(
          sql`UPDATE public."clinical_protocols" SET views = COALESCE(views, 0) + 1 WHERE slug = ${rawSlug};`
        ).catch(() => {})
      } else if (rawCollection === 'health-warnings') {
        await payload.db.drizzle.execute(
          sql`UPDATE public."health_warnings" SET views = COALESCE(views, 0) + 1 WHERE slug = ${rawSlug};`
        ).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      online: activeSessions.size,
    })
  } catch (error: any) {
    console.error('[site-visits][POST] Error:', error?.message || error)
    return NextResponse.json({ success: false, error: 'Không thể ghi nhận lượt truy cập.' }, { status: 500 })
  }
}
