import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { rateLimit } from '@/lib/request-security'

const PUBLIC_MIN_SAMPLE_SIZE = 5
const ALLOWED_PERIODS = new Set(['all', 'day', 'week', 'month', 'quarter', '6months', '9months', 'year'])

export async function GET(request: Request) {
  try {
    const throttle = rateLimit(request, 'surveys-statistics', 60, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Quá nhiều yêu cầu truy vấn thống kê khảo sát. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    }
    const payload = await getCMS()
    const { searchParams } = new URL(request.url)

    const campaign = searchParams.get('campaign') || 'all'
    const period = searchParams.get('period') || 'all' // all | day | week | month | quarter | 6months | 9months | year
    const wantsAdminDetails = searchParams.get('details') === 'admin'
    const user = await getVerifiedActiveUser(payload, request.headers)
    const canViewDetails = Boolean(user && hasModulePermission(user, 'surveys', 'view'))

    if (!ALLOWED_PERIODS.has(period)) {
      return NextResponse.json({ error: 'Khoảng thời gian thống kê không hợp lệ.' }, { status: 400 })
    }
    if (wantsAdminDetails && !user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để xem chi tiết khảo sát.' }, { status: 401 })
    }
    if (wantsAdminDetails && !canViewDetails) {
      return NextResponse.json({ error: 'Bạn không có quyền xem chi tiết khảo sát.' }, { status: 403 })
    }
    const includeDetails = wantsAdminDetails && canViewDetails

    // 1. Tính toán mốc thời gian bắt đầu (startDate) dựa theo period
    const now = new Date()
    let startDate: Date | null = null

    if (period === 'day') {
      // Hôm nay (từ 00:00:00)
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    } else if (period === 'week') {
      // 7 ngày gần nhất
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      // 30 ngày gần nhất (hoặc từ đầu tháng)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    } else if (period === 'quarter') {
      // Quý hiện tại (3 tháng gần nhất)
      const currentQuarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0)
    } else if (period === '6months') {
      // 6 tháng gần nhất
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0)
    } else if (period === '9months') {
      // 9 tháng gần nhất
      startDate = new Date(now.getFullYear(), now.getMonth() - 9, now.getDate(), 0, 0, 0)
    } else if (period === 'year') {
      // Từ đầu năm hiện tại (hoặc 12 tháng)
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
    }

    const startIso = startDate ? startDate.toISOString() : null

    // 2. Lấy danh sách tất cả các đợt khảo sát
    const allCampaignsRes = await payload.find({
      collection: 'survey-campaigns',
      limit: 200,
      sort: 'id',
      overrideAccess: true,
    })

    const allCampaigns = allCampaignsRes.docs || []
    const isAll = campaign === 'all'
    const campaignId = !isAll ? Number(campaign) : null
    if (!isAll && (!Number.isInteger(campaignId) || Number(campaignId) <= 0)) {
      return NextResponse.json({ error: 'Mã đợt khảo sát không hợp lệ.' }, { status: 400 })
    }

    // 3. Truy vấn survey-responses
    const surveyResponsesQuery: any = {
      collection: 'survey-responses',
      limit: 10000,
      sort: '-submittedAt',
      overrideAccess: true,
    }

    const surveyWhere: any[] = []
    if (!isAll && campaignId) {
      surveyWhere.push({ campaign: { equals: campaignId } })
    }
    if (startIso) {
      surveyWhere.push({ submittedAt: { greater_than_equal: startIso } })
    }

    if (surveyWhere.length === 1) {
      surveyResponsesQuery.where = surveyWhere[0]
    } else if (surveyWhere.length > 1) {
      surveyResponsesQuery.where = { and: surveyWhere }
    }

    const surveyResponses = await payload.find(surveyResponsesQuery)

    // 4. Truy vấn feedbackCases
    let feedbackDocs: any[] = []
    try {
      const fbWhere: any[] = []

      if (!isAll && campaignId) {
        const campaignDoc: any = allCampaigns.find((c: any) => c.id === campaignId)
        const orConditions: any[] = []
        if (campaignDoc) {
          orConditions.push(
            { subject: { contains: campaignDoc.title } },
            { name: { contains: campaignDoc.title } },
            { message: { contains: campaignDoc.title } }
          )
          if (campaignId === 1 || campaignDoc.slug === 'ngoai-tru') {
            orConditions.push({ subject: { contains: 'Ngoại trú' } }, { code: { like: 'KS-NT-%' } })
          } else if (campaignId === 2 || campaignDoc.slug === 'noi-tru') {
            orConditions.push({ subject: { contains: 'Nội trú' } }, { code: { like: 'KS-NOITRU-%' } })
          } else if (campaignId === 3 || campaignDoc.slug === 'nhan-vien') {
            orConditions.push({ subject: { contains: 'Nhân viên y tế' } }, { code: { like: 'KS-NVYT-%' } })
          }
        }
        if (orConditions.length > 0) {
          fbWhere.push({ or: orConditions })
        }
      } else {
        // Lấy tất cả các feedbackCases thuộc dạng khảo sát (code bắt đầu bằng KS- hoặc subject có Khảo sát)
        fbWhere.push({
          or: [
            { code: { like: 'KS-%' } },
            { subject: { contains: 'Khảo sát' } },
            { subject: { contains: 'hài lòng' } },
          ],
        })
      }

      if (startIso) {
        fbWhere.push({ createdAt: { greater_than_equal: startIso } })
      }

      const fbQuery: any = {
        collection: 'feedbackCases',
        limit: 10000,
        sort: '-createdAt',
        overrideAccess: true,
      }

      if (fbWhere.length === 1) {
        fbQuery.where = fbWhere[0]
      } else if (fbWhere.length > 1) {
        fbQuery.where = { and: fbWhere }
      }

      const fbRes = await payload.find(fbQuery)
      feedbackDocs = fbRes.docs || []
    } catch (fbErr) {
      console.warn('Lỗi query feedbackCases trong statistics:', fbErr)
    }

    // 5. Thống kê theo từng loại đợt khảo sát (Breakdown by Category / Campaign)
    // Bản đồ phân loại: map campaignId hoặc slug
    const campaignStatsMap = new Map<number | string, {
      id: number | string
      title: string
      slug: string
      count: number
      scores: number[]
    }>()

    // Khởi tạo các nhóm mặc định
    allCampaigns.forEach((c: any) => {
      campaignStatsMap.set(c.id, {
        id: c.id,
        title: c.title,
        slug: c.slug,
        count: 0,
        scores: [],
      })
    })

    // Đảm bảo 3 mẫu chuẩn luôn có mặt
    if (!campaignStatsMap.has(1)) {
      campaignStatsMap.set(1, { id: 1, title: 'Khảo sát Hài lòng Khám Ngoại trú', slug: 'ngoai-tru', count: 0, scores: [] })
    }
    if (!campaignStatsMap.has(2)) {
      campaignStatsMap.set(2, { id: 2, title: 'Khảo sát Hài lòng Điều trị Nội trú', slug: 'noi-tru', count: 0, scores: [] })
    }
    if (!campaignStatsMap.has(3)) {
      campaignStatsMap.set(3, { id: 3, title: 'Khảo sát Ý kiến Nhân viên Y tế', slug: 'nhan-vien', count: 0, scores: [] })
    }

    const seenCodes = new Set<string>()
    const allScores: number[] = []

    // Xử lý surveyResponses
    for (const r of surveyResponses.docs as any[]) {
      const code = r.responseCode || `SR-${r.id}`
      if (seenCodes.has(code)) continue
      seenCodes.add(code)

      const s = Number(r.overallScore)
      if (Number.isFinite(s) && s > 0) allScores.push(s)

      const cId = typeof r.campaign === 'object' && r.campaign ? r.campaign.id : Number(r.campaign)
      if (cId && campaignStatsMap.has(cId)) {
        const item = campaignStatsMap.get(cId)!
        item.count++
        if (Number.isFinite(s) && s > 0) item.scores.push(s)
      }
    }

    // Xử lý feedbackDocs
    for (const fb of feedbackDocs) {
      const code = fb.code || `FB-${fb.id}`
      if (seenCodes.has(code)) continue
      seenCodes.add(code)

      let s = 0
      const m = fb.subject?.match(/ĐTB:\s*([0-9.]+)/i)
      if (m) {
        s = Number(m[1])
        if (Number.isFinite(s) && s > 0) allScores.push(s)
      }

      // Xác định đợt của feedback này
      let matchedCId: number | null = null
      if (fb.code?.startsWith('KS-NT-') || fb.subject?.includes('Ngoại trú')) matchedCId = 1
      else if (fb.code?.startsWith('KS-NOITRU-') || fb.subject?.includes('Nội trú')) matchedCId = 2
      else if (fb.code?.startsWith('KS-NVYT-') || fb.subject?.includes('Nhân viên')) matchedCId = 3
      else {
        // Tìm theo title campaign
        for (const c of allCampaigns) {
          if (fb.subject?.includes(c.title) || fb.message?.includes(c.title)) {
            matchedCId = c.id
            break
          }
        }
      }

      if (matchedCId && campaignStatsMap.has(matchedCId)) {
        const item = campaignStatsMap.get(matchedCId)!
        item.count++
        if (Number.isFinite(s) && s > 0) item.scores.push(s)
      }
    }

    const totalResponses = seenCodes.size

    // Phân loại mức độ hài lòng
    let verySatisfied = 0
    let satisfied = 0
    let neutral = 0
    let unsatisfied = 0

    allScores.forEach((sc) => {
      const normalized = sc > 5 ? sc / 2 : sc
      if (normalized >= 4.5) verySatisfied++
      else if (normalized >= 3.5) satisfied++
      else if (normalized >= 2.5) neutral++
      else unsatisfied++
    })

    const averageScore = allScores.length
      ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
      : 0

    const positiveCount = verySatisfied + satisfied
    const satisfactionRate = allScores.length
      ? Number(((positiveCount * 100) / allScores.length).toFixed(1))
      : 0

    // Danh sách phản hồi gần đây nhất
    const recentResponses = includeDetails ? [
      ...surveyResponses.docs.map((r: any) => ({
        code: r.responseCode || `SR-${r.id}`,
        date: r.submittedAt,
        score: r.overallScore,
        comment: r.comment || '',
        campaignTitle: (typeof r.campaign === 'object' && r.campaign?.title) || 'Khảo sát ý kiến',
      })),
      ...feedbackDocs.map((fb: any) => ({
        code: fb.code,
        date: fb.createdAt,
        score: fb.subject?.match(/ĐTB:\s*([0-9.]+)/i)?.[1] || '—',
        comment: fb.message?.slice(0, 150) + (fb.message?.length > 150 ? '...' : ''),
        campaignTitle: fb.subject?.split(' - ')[0] || 'Khảo sát ý kiến',
      })),
    ]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 15) : []

    // Danh sách breakdown theo từng loại khảo sát
    const rawCategoryBreakdown = Array.from(campaignStatsMap.values()).map((c) => {
      const cAvg = c.scores.length
        ? Number((c.scores.reduce((a, b) => a + b, 0) / c.scores.length).toFixed(2))
        : 0
      const cPercent = totalResponses ? Math.round((c.count / totalResponses) * 100) : 0
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        count: c.count,
        percent: cPercent,
        averageScore: cAvg,
      }
    })
    const hasSmallPublicCategory = rawCategoryBreakdown.some(
      (item) => item.count > 0 && item.count < PUBLIC_MIN_SAMPLE_SIZE,
    )
    const categoryBreakdown = includeDetails
      ? rawCategoryBreakdown
      : hasSmallPublicCategory
        ? []
        : rawCategoryBreakdown.filter((item) => item.count >= PUBLIC_MIN_SAMPLE_SIZE)

    // Thông tin campaign hiện tại
    let currentCampaignInfo: any = {
      id: 'all',
      title: 'Tất cả các loại khảo sát',
      slug: 'all',
      active: true,
    }

    if (!isAll && campaignId) {
      const found = allCampaigns.find((c: any) => c.id === campaignId)
      if (found) {
        currentCampaignInfo = {
          id: found.id,
          title: found.title,
          slug: found.slug,
          active: found.active,
          startAt: found.startAt,
          endAt: found.endAt,
        }
      }
    }

    const publicSampleSuppressed = !includeDetails && totalResponses < PUBLIC_MIN_SAMPLE_SIZE
    const distributionValues = [verySatisfied, satisfied, neutral, unsatisfied]
    const publicDistributionSuppressed = !includeDetails && distributionValues.some(
      (count) => count > 0 && count < PUBLIC_MIN_SAMPLE_SIZE,
    )
    const suppressDistribution = publicSampleSuppressed || publicDistributionSuppressed

    return NextResponse.json({
      ok: true,
      period,
      campaign: currentCampaignInfo,
      responses: publicSampleSuppressed ? 0 : totalResponses,
      averageScore: publicSampleSuppressed ? 0 : Number(averageScore.toFixed(2)),
      satisfactionRate: publicSampleSuppressed ? 0 : satisfactionRate,
      ratingDistribution: {
        verySatisfied: suppressDistribution ? 0 : verySatisfied,
        satisfied: suppressDistribution ? 0 : satisfied,
        neutral: suppressDistribution ? 0 : neutral,
        unsatisfied: suppressDistribution ? 0 : unsatisfied,
      },
      categoryBreakdown,
      ...(includeDetails ? { recentResponses } : {}),
      privacy: {
        minimumPublicSampleSize: PUBLIC_MIN_SAMPLE_SIZE,
        suppressed: publicSampleSuppressed,
        distributionSuppressed: publicDistributionSuppressed,
        categoryBreakdownSuppressed: !includeDetails && hasSmallPublicCategory,
      },
    })
  } catch (err: any) {
    console.error('API SURVEY STATISTICS ERROR:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi khi tính toán thống kê.' }, { status: 500 })
  }
}
