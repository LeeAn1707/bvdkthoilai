import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import { bodyIsTooLarge, rateLimit, readJsonBodyWithLimit } from '@/lib/request-security'
import { resolveBookingConfig } from '@/lib/booking'

// Bộ từ điển phương ngữ Nam Bộ & Tây Nam Bộ (Cần Thơ, Thới Lai) được chuẩn hóa từ cụm dài đến từ đơn
const DIALECT_MAP: Record<string, string> = {
  // Cụm từ ghép / cụm mô tả
  'gio cang': 'chan',
  'chan tay': 'tay chan',
  'bao tu': 'da day',
  'cu hong': 'hong',
  'lo tai': 'tai',
  'con mat': 'mat',
  'cai rang': 'rang',
  'cai bung': 'bung',
  'cai dau': 'dau',
  'sanh de': 'sinh con',
  'de con': 'sinh con',
  'co bau': 'mang thai',
  'co thai': 'mang thai',
  'can bau': 'kham thai',
  'con nit': 'tre em',
  'be nho': 'tre em',
  'con em': 'tre em',
  'em be': 'tre em',
  'oc sua': 'non tro',
  'doi bang': 'lai xe',
  'bang lai': 'lai xe',
  'chay xe': 'lai xe',
  'xin viec': 'kham suc khoe',
  'di lam': 'kham suc khoe',
  'tien bac': 'chi phi',
  'gia ca': 'bang gia',
  'bao nhieu': 'chi phi',
  'may gio': 'gio lam viec',
  'nghi le': 'ngay nghi',
  'chu nhat': 'ngay nghi',
  'thu 7': 'ngay nghi',
  'thu bay': 'ngay nghi',
  'lay so': 'quy trinh',
  'xep hang': 'quy trinh',

  // Từ đơn địa phương
  'nhut': 'dau',
  'nhuc': 'dau',
  'moi': 'dau',
  'e am': 'dau',
  'thon': 'dau',
  'tuc': 'dau',
  'gio': 'chan',
  'cang': 'chan',
  'lung': 'cot song',
  'sanh': 'sinh',
  'de': 'sinh con',
}

const normalize = (value: string) => {
  let text = ' ' + (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' '

  for (const [dialect, standard] of Object.entries(DIALECT_MAP)) {
    text = text.replaceAll(' ' + dialect + ' ', ' ' + standard + ' ')
  }

  return text.replace(/\s+/g, ' ').trim()
}

const editDistance = (left: string, right: string) => {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    const current = [i]
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
    }
    for (let j = 0; j < current.length; j++) previous[j] = current[j]
  }
  return previous[right.length]
}

const tokensAreClose = (left: string, right: string) => {
  if (left === right) return true
  if (left.length < 4 || right.length < 4) return false
  if (left.length === right.length) {
    const differences = [...left].map((char, index) => char === right[index] ? index : -1).filter((index) => index >= 0)
    if (differences.length === 2) {
      const [first, second] = differences
      if (second === first + 1 && left[first] === right[second] && left[second] === right[first]) return true
    }
  }
  const maxDistance = Math.max(left.length, right.length) >= 7 ? 2 : 1
  if (Math.abs(left.length - right.length) > maxDistance) return false
  return editDistance(left, right) <= maxDistance
}

const matchScore = (question: string, candidate: string) => {
  if (!question || !candidate) return 0
  if (question === candidate) return 100
  let score = 0
  if (question.includes(candidate)) score += 18 + Math.min(candidate.length / 4, 10)
  if (candidate.includes(question) && question.length >= 4) score += 12
  const questionTokens = new Set(question.split(' ').filter((token) => token.length >= 2))
  const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length >= 2))
  // Câu quá ngắn không đủ ngữ cảnh để suy ra một kịch bản dài. Ví dụ
  // "dịch vụ" không được tự hiểu thành "dịch vụ kỹ thuật".
  if (questionTokens.size <= 2 && candidateTokens.size >= 3 && candidate.includes(question)) return 0
  const sharedTokens = [...candidateTokens].filter((token) => questionTokens.has(token))
  const shared = sharedTokens.length
  if (shared) score += shared * 4 + (shared / Math.max(candidateTokens.size, 1)) * 12
  // Một từ của câu hỏi chỉ được dùng cho một lần khớp. Nếu "viên" đã khớp
  // chính xác thì không được dùng lại để coi "việc" là lỗi chính tả.
  const availableQuestionTokens = [...questionTokens].filter((token) => !sharedTokens.includes(token))
  let fuzzyShared = 0
  for (const candidateToken of [...candidateTokens].filter((token) => !questionTokens.has(token))) {
    const matchedIndex = availableQuestionTokens.findIndex((questionToken) => tokensAreClose(questionToken, candidateToken))
    if (matchedIndex >= 0) {
      fuzzyShared += 1
      availableQuestionTokens.splice(matchedIndex, 1)
    }
  }
  if (fuzzyShared) score += fuzzyShared * 4 + (fuzzyShared / Math.max(candidateTokens.size, 1)) * 9
  return score
}

const MIN_MATCH_SCORE = 14

const lexicalToText = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(lexicalToText).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    const node = value as Record<string, unknown>
    const ownText = typeof node.text === 'string' ? node.text : ''
    const childText = lexicalToText(node.children || (node.root as Record<string, unknown> | undefined)?.children)
    return [ownText, childText].filter(Boolean).join(ownText && childText ? ' ' : '')
  }
  return ''
}

const emergencyTerms = [
  'cap cuu', 'cap cuu 115', 'cap cuu khan cap', 'khan cap', 'goi 115',
  'dau nguc', 'kho tho', 'bat tinh', 'hon me', 'co giat', 'chay mau nhieu',
  'tai nan nang', 'dot quy', 'liet nua nguoi', 'ngung tho', 'tu tu', 'uong thuoc qua lieu',
]

const staffSupportTerms = [
  'can chuyen vien', 'can tu van vien', 'gap tu van vien', 'gap nhan vien',
  'noi chuyen voi nhan vien', 'nhan vien ho tro', 'tu van truc tiep',
]


export async function POST(req: Request) {
  try {
    if (bodyIsTooLarge(req, 8_000)) return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 })
    const throttle = rateLimit(req, 'chatbot', 60, 15 * 60_000)
    if (!throttle.allowed) return NextResponse.json({ error: 'Bạn gửi quá nhiều câu hỏi.' }, { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } })
    const parsed = await readJsonBodyWithLimit<Record<string, any>>(req, 8_000)
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 })
    const body = parsed.data || {}
    const question = String(body.question || '').trim().slice(0, 1500)
    const sessionId = String(body.sessionId || '').trim().slice(0, 100)
    const feedback = body.feedback === 'up' || body.feedback === 'down' ? body.feedback : null
    if (feedback) {
      if (feedback === 'down' && question.length >= 2) {
        const payload = await getCMS()
        const normalizedQuestion = normalize(question)
        const old = await payload.find({ collection: 'chatbotUnanswered', where: { and: [{ normalizedQuestion: { equals: normalizedQuestion } }, { resolved: { equals: false } }] }, limit: 1, depth: 0, overrideAccess: true })
        const item: any = old.docs[0]
        const now = new Date().toISOString()
        if (item) await payload.update({ collection: 'chatbotUnanswered', id: item.id, data: { count: Number(item.count || 1) + 1, lastAskedAt: now }, overrideAccess: true })
        else await payload.create({ collection: 'chatbotUnanswered', data: { question, normalizedQuestion, count: 1, lastAskedAt: now, resolved: false }, overrideAccess: true })
      }
      return NextResponse.json({ ok: true })
    }
    if (question.length < 2) return NextResponse.json({ error: 'Câu hỏi không hợp lệ' }, { status: 400 })
    let q = normalize(question)
    const payload = await getCMS()
    let chatbotSettings: any = {}
    let medproSettings: any = {}
    let siteSettingsForBooking: any = {}
    try {
      chatbotSettings = await payload.findGlobal({ slug: 'chatbot-settings', depth: 0, overrideAccess: true })
    } catch {}
    try {
      [medproSettings, siteSettingsForBooking] = await Promise.all([
        payload.findGlobal({ slug: 'medpro-settings', depth: 0, overrideAccess: true }),
        payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }),
      ])
    } catch {}
    const booking = resolveBookingConfig(medproSettings, siteSettingsForBooking)
    const clarificationSets: Record<string, Array<{ label: string; value: string }>> = {
      'dich vu': [
        { label: 'Bảng giá dịch vụ', value: 'Giá dịch vụ khám bệnh' },
        { label: 'Gói khám sức khỏe', value: 'Các gói khám sức khỏe' },
        { label: 'Kỹ thuật chuyên sâu', value: 'Kỹ thuật chuyên sâu' },
        { label: 'Tiêm chủng', value: 'Dịch vụ tiêm chủng vắc xin' },
      ],
      'tu van': [
        { label: 'Gặp tư vấn viên', value: 'Tôi cần gặp tư vấn viên' },
        { label: 'Lịch khám', value: 'Xem lịch khám bác sĩ' },
        { label: 'Đặt lịch', value: 'Tôi muốn đặt lịch khám' },
        { label: 'BHYT & viện phí', value: 'Thông tin BHYT và viện phí' },
      ],
      'ho tro': [
        { label: 'Gặp tư vấn viên', value: 'Tôi cần gặp tư vấn viên' },
        { label: 'Liên hệ', value: 'Thông tin liên hệ bệnh viện' },
        { label: 'Quy trình khám', value: 'Quy trình khám bệnh' },
      ],
      'thong tin': [
        { label: 'Lịch khám', value: 'Xem lịch khám bác sĩ' },
        { label: 'Giờ làm việc', value: 'Giờ làm việc bệnh viện' },
        { label: 'Dịch vụ', value: 'Dịch vụ' },
        { label: 'Liên hệ', value: 'Thông tin liên hệ bệnh viện' },
      ],
    }
    if (clarificationSets[q]) {
      return NextResponse.json({
        matched: false,
        answer: 'Nội dung bạn hỏi còn khá rộng. Vui lòng chọn đúng nhóm thông tin cần tra cứu:',
        suggestions: clarificationSets[q],
      })
    }
    const hotline = '02923 689 115'
    const renderTemplate = (value: unknown, fallback: string, variables: Record<string, string> = {}) => {
      let output = String(value || fallback)
      for (const [key, replacement] of Object.entries({ HOTLINE: hotline, ...variables })) {
        output = output.replaceAll(`{{${key}}}`, replacement)
      }
      return output
    }
    let currentConversation: any = null
    if (sessionId) {
      try {
        const existing = await payload.find({ collection: 'chatbotConversations', where: { sessionId: { equals: sessionId } }, limit: 1, depth: 0, overrideAccess: true })
        currentConversation = existing.docs[0] || null
        const followUpTerms = ['co khong', 'bao nhieu', 'o dau', 'thu hai', 'thu ba', 'thu tu', 'thu nam', 'thu sau', 'thu bay', 'chu nhat', 'xem them', 'dang ky', 'the nao', 'con cai nay', 'vay thi sao']
        // Chỉ nối ngữ cảnh với câu thực sự phụ thuộc câu trước. Câu ngắn nhưng đã
        // có chủ đề rõ (ví dụ "lịch làm việc") phải được hiểu độc lập.
        if (followUpTerms.some((term) => q.includes(term))) {
          const previousUser = [...(Array.isArray(currentConversation?.messages) ? currentConversation.messages : [])]
            .reverse().find((message: any) => message?.from === 'user' && message?.text)
          if (previousUser?.text) q = normalize(`${previousUser.text} ${question}`)
        }
      } catch {}
    }
    let matched: any
    if (emergencyTerms.some((term) => q.includes(term))) {
      matched = {
        answer: renderTemplate(chatbotSettings.emergencyResponse, 'Dấu hiệu bạn mô tả có thể cần được cấp cứu. Vui lòng gọi ngay Bệnh viện Đa khoa Khu vực Thới Lai theo số {{HOTLINE}} hoặc gọi 115. Không tự dùng thuốc và không chờ chatbot tư vấn thêm nếu tình trạng đang nặng lên.'),
        linkLabel: 'Gọi cấp cứu 02923 689 115',
        linkUrl: 'tel:02923689115',
        openNewTab: false,
      }
    }

    if (!matched && staffSupportTerms.some((term) => q.includes(term))) {
      matched = {
        answer: 'Bạn vui lòng mô tả nội dung cần hỗ trợ, sau đó chọn “Gửi câu hỏi cho tư vấn viên”. Nếu cần liên hệ ngay, hãy mở trang Liên hệ bệnh viện.',
        linkLabel: 'Liên hệ bệnh viện',
        linkUrl: '/lien-he',
      }
    }

    const isBookingQuestion = q.includes('dat lich') || q.includes('dang ky kham') || q.includes('hen kham') || q.includes('lay hen')
    if (!matched && isBookingQuestion) {
      matched = booking.enabled
        ? {
            answer: booking.useFacilityBooking
              ? 'Bạn có thể đăng ký đặt lịch khám trực tiếp tại cơ sở trên website. Bệnh viện sẽ tiếp nhận và liên hệ xác nhận phiếu hẹn.'
              : 'Bạn có thể đặt lịch khám trực tuyến qua Medpro để chủ động lựa chọn thời gian phù hợp.',
            linkLabel: booking.label,
            linkUrl: booking.url,
            openNewTab: booking.openNewTab,
          }
        : { answer: 'Tính năng đặt lịch trực tuyến hiện đang tạm tắt. Vui lòng liên hệ bệnh viện để được hỗ trợ.', linkLabel: 'Liên hệ bệnh viện', linkUrl: '/lien-he' }
    }
    if (!matched && !isBookingQuestion && (q.includes('lich kham') || q.includes('bac si kham'))) {
      const schedules = await payload.find({ collection: 'schedules', where: { active: { equals: true } }, sort: '-date', limit: 1, depth: 0, overrideAccess: true })
      const latest: any = schedules.docs[0]
      matched = latest
        ? { answer: renderTemplate(chatbotSettings.scheduleResponseTemplate, 'Lịch khám mới nhất đang được bệnh viện công bố: {{TITLE}}. Bạn hãy mở trang Lịch khám để xem bác sĩ, chuyên khoa và thời gian cụ thể.', { TITLE: String(latest.title || '') }), linkLabel: 'Xem lịch khám mới nhất', linkUrl: `/lich-kham/${latest.id}` }
        : { answer: 'Bệnh viện chưa có lịch khám đang hoạt động trong hệ thống. Vui lòng gọi hotline để được hỗ trợ.', linkLabel: 'Gọi hotline', linkUrl: 'tel:02923689115' }
    }

    if (!matched && (
      q.includes('gio lam viec') || q.includes('lich lam viec') || q.includes('thoi gian lam viec') ||
      q.includes('gio kham') || q.includes('may gio kham') || q.includes('gio mo cua')
    )) {
      const workingHours: any = await payload.findGlobal({ slug: 'working-hours-settings', depth: 0, overrideAccess: true })
      const milestones = Array.isArray(workingHours?.announcement?.milestones)
        ? workingHours.announcement.milestones.filter((item: any) => item?.enabled !== false && item?.time && item?.title).slice(0, 4)
        : []
      const summary = milestones.map((item: any) => `${item.time}: ${item.title}`).join('\n')
      matched = {
        answer: summary
          ? renderTemplate(chatbotSettings.workingHoursResponseTemplate, 'Thời gian tiếp nhận và khám bệnh đang được bệnh viện công bố:\n{{ITEMS}}', { ITEMS: summary })
          : 'Thông tin giờ làm việc đang được cập nhật. Bạn vui lòng xem trang Lịch làm việc hoặc gọi hotline để được hỗ trợ.',
        linkLabel: 'Xem đầy đủ lịch khám bệnh',
        linkUrl: '/lich-kham-benh',
      }
    }

    if (!matched && (q.includes('vac xin') || q.includes('tiem chung') || q.includes('tiem ngua'))) {
      const vaccines = await payload.find({ collection: 'vaccines', where: { and: [{ active: { equals: true } }, { availability: { equals: 'available' } }] }, sort: 'name', limit: 5, depth: 0, overrideAccess: true })
      const names = (vaccines.docs as any[]).map((item) => item.name).filter(Boolean)
      matched = names.length
        ? { answer: renderTemplate(chatbotSettings.vaccineResponseTemplate, 'Các vắc xin đang được cập nhật là còn sẵn gồm: {{ITEMS}}. Tình trạng có thể thay đổi, vui lòng xem danh mục chi tiết trước khi đăng ký.', { ITEMS: `${names.join(', ')}${vaccines.totalDocs > names.length ? '…' : ''}` }), linkLabel: 'Xem danh mục vắc xin', linkUrl: '/tiem-chung?tab=vaccines' }
        : { answer: 'Hiện chưa có vắc xin nào được đánh dấu là đang có trong hệ thống.', linkLabel: 'Xem thông tin tiêm chủng', linkUrl: '/tiem-chung' }
    }

    if (!matched && (q.includes('thong bao') || q.includes('tin moi'))) {
      const notices = await payload.find({ collection: 'notices', where: { and: [{ _status: { equals: 'published' } }, { showOnHome: { equals: true } }] }, sort: ['-publishedAt', '-createdAt'], limit: 1, depth: 0, overrideAccess: true })
      const latest: any = notices.docs[0]
      if (latest) matched = { answer: renderTemplate(chatbotSettings.noticeResponseTemplate, 'Thông báo mới nhất: {{TITLE}}', { TITLE: String(latest.title || '') }), linkLabel: 'Xem thông báo', linkUrl: `/thong-bao/${latest.slug}` }
    }

    if (!matched && (q.includes('dau thau') || q.includes('mua sam') || q.includes('moi thau'))) {
      const procurement = await payload.find({ collection: 'procurement', where: { _status: { equals: 'published' } }, sort: ['-publishedAt', '-createdAt'], limit: 1, depth: 0, overrideAccess: true })
      const latest: any = procurement.docs[0]
      if (latest) matched = { answer: renderTemplate(chatbotSettings.procurementResponseTemplate, 'Thông tin Đấu thầu – Mua sắm mới nhất: {{TITLE}}', { TITLE: String(latest.title || '') }), linkLabel: 'Xem nội dung', linkUrl: `/dau-thau-mua-sam/${latest.slug}` }
    }

    if (!matched && (q.includes('bang gia') || q.includes('gia dich vu') || q.includes('vien phi') || q.includes('chi phi'))) {
      matched = { answer: renderTemplate(chatbotSettings.priceResponse, 'Bảng giá dịch vụ và viện phí được cập nhật trực tiếp trên trang tra cứu của bệnh viện. Bạn có thể tìm theo tên dịch vụ để xem mức giá hiện hành.'), linkLabel: 'Tra cứu bảng giá', linkUrl: '/bang-gia' }
    }

    // Kịch bản do quản trị viên cấu hình luôn được ưu tiên trước bộ dự phòng trong mã nguồn.
    if (!matched) {
      const intents = await payload.find({ collection: 'chatbotIntents', where: { active: { equals: true } }, sort: '-priority', limit: 200, depth: 0, overrideAccess: true })
      let bestIntent: any = null
      let bestIntentScore = 0
      for (const intent of intents.docs as any[]) {
        const phrases = Array.isArray(intent.phrases) ? intent.phrases.map((p: any) => normalize(String(p?.text || ''))).filter(Boolean) : []
        const phraseScore = phrases.reduce((best: number, phrase: string) => Math.max(best, matchScore(q, phrase)), 0)
        const score = phraseScore + Math.min(Number(intent.priority || 0), 100) / 100
        if (score > bestIntentScore) { bestIntent = intent; bestIntentScore = score }
      }
      if (bestIntent && bestIntentScore >= MIN_MATCH_SCORE) matched = bestIntent
    }

    // Chỉ dùng khi cơ sở dữ liệu chưa được nạp bộ kịch bản mặc định.
    if (!matched) {
      const websiteTopics = [
        {
          phrases: ['dat lich kham', 'dang ky kham', 'hen kham', 'lay hen bac si'],
          answer: 'Bạn có thể gửi yêu cầu đặt lịch khám tại cơ sở, chọn ngày, khung giờ và chuyên khoa phù hợp. Bệnh viện sẽ tiếp nhận và liên hệ xác nhận.',
          linkLabel: 'Đặt lịch khám', linkUrl: '/dat-lich-kham',
        },
        {
          phrases: ['tim bac si', 'danh sach bac si', 'bac si chuyen khoa', 'doi ngu bac si'],
          answer: 'Trang Đội ngũ bác sĩ giúp bạn tra cứu bác sĩ, chuyên môn và khoa/phòng công tác.',
          linkLabel: 'Xem đội ngũ bác sĩ', linkUrl: '/bac-si',
        },
        {
          phrases: ['chuyen khoa nao', 'danh sach chuyen khoa', 'khoa kham', 'kham khoa nao'],
          answer: 'Bạn có thể xem danh sách chuyên khoa và phạm vi khám chữa bệnh của từng khoa. Nếu chưa xác định được khoa phù hợp, hãy gửi câu hỏi cho tư vấn viên.',
          linkLabel: 'Xem các chuyên khoa', linkUrl: '/chuyen-khoa',
        },
        {
          phrases: ['quy trinh kham', 'thu tuc kham', 'di kham can gi', 'cac buoc kham benh', 'lay so kham'],
          answer: 'Trang Quy trình khám bệnh hướng dẫn các bước tiếp nhận, đăng ký, khám lâm sàng, cận lâm sàng, thanh toán và nhận thuốc.',
          linkLabel: 'Xem quy trình khám', linkUrl: '/quy-trinh-kham-benh',
        },
        {
          phrases: ['bao hiem y te', 'bhyt', 'quyen loi bao hiem', 'kham bao hiem', 'giay to bhyt'],
          answer: 'Thông tin dành cho người bệnh bao gồm hướng dẫn giấy tờ, quyền lợi BHYT, quy trình khám và các tiện ích hỗ trợ.',
          linkLabel: 'Thông tin dành cho người bệnh', linkUrl: '/danh-cho-nguoi-benh',
        },
        {
          phrases: ['dieu tri noi tru', 'nhap vien', 'tham nuoi benh', 'nguoi nuoi benh', 'noi quy noi tru'],
          answer: 'Trang Điều trị nội trú cung cấp hướng dẫn nhập viện, sinh hoạt, thăm nuôi và các lưu ý trong thời gian điều trị.',
          linkLabel: 'Xem hướng dẫn nội trú', linkUrl: '/dieu-tri-noi-tru',
        },
        {
          phrases: ['goi kham', 'kham tong quat', 'kham suc khoe', 'kham lai xe', 'kham xin viec'],
          answer: 'Bạn có thể tra cứu các gói khám sức khỏe, đối tượng áp dụng và nội dung kiểm tra trên trang Gói khám.',
          linkLabel: 'Xem các gói khám', linkUrl: '/goi-kham',
        },
        {
          phrases: ['so do benh vien', 'duong den khoa', 'khoa o dau', 'phong o dau', 'ban do benh vien'],
          answer: 'Sơ đồ bệnh viện giúp bạn xác định khu vực tiếp đón, khoa/phòng và hướng di chuyển trong khuôn viên.',
          linkLabel: 'Mở sơ đồ bệnh viện', linkUrl: '/so-do-benh-vien',
        },
        {
          phrases: ['dia chi benh vien', 'so dien thoai', 'hotline', 'lien he benh vien', 'duong di'],
          answer: 'Trang Liên hệ cung cấp địa chỉ, số điện thoại, hotline và bản đồ chỉ đường đến Bệnh viện Đa khoa Khu vực Thới Lai.',
          linkLabel: 'Xem thông tin liên hệ', linkUrl: '/lien-he',
        },
        {
          phrases: ['gop y', 'phan anh', 'khieu nai', 'khen ngoi', 'gui y kien'],
          answer: 'Bạn có thể gửi góp ý, phản ánh hoặc lời khen trực tuyến. Hệ thống sẽ cấp mã hồ sơ để theo dõi quá trình xử lý.',
          linkLabel: 'Gửi góp ý – phản ánh', linkUrl: '/gop-y',
        },
        {
          phrases: ['tra cuu gop y', 'tra cuu phan anh', 'ma phan anh', 'tinh trang phan anh'],
          answer: 'Bạn hãy nhập mã hồ sơ đã được cấp để kiểm tra trạng thái và nội dung phản hồi từ bệnh viện.',
          linkLabel: 'Tra cứu phản ánh', linkUrl: '/gop-y/tra-cuu',
        },
        {
          phrases: ['khao sat hai long', 'danh gia benh vien', 'phieu khao sat', 'khao sat nguoi benh'],
          answer: 'Bạn có thể tham gia khảo sát để đánh giá chất lượng phục vụ và gửi ý kiến cải tiến cho bệnh viện.',
          linkLabel: 'Tham gia khảo sát', linkUrl: '/khao-sat',
        },
        {
          phrases: ['bieu mau', 'tai mau don', 'mau don benh vien', 'form benh vien'],
          answer: 'Trang Biểu mẫu cung cấp các mẫu đơn và tài liệu hành chính đang được bệnh viện công khai.',
          linkLabel: 'Xem biểu mẫu', linkUrl: '/bieu-mau',
        },
        {
          phrases: ['van ban', 'tai lieu', 'quyet dinh', 'cong van'],
          answer: 'Bạn có thể tra cứu văn bản, quyết định và tài liệu công khai của bệnh viện.',
          linkLabel: 'Tra cứu văn bản', linkUrl: '/van-ban',
        },
        {
          phrases: ['tuyen dung', 'xin viec benh vien', 'viec lam benh vien', 'nop ho so tuyen dung'],
          answer: 'Thông tin vị trí tuyển dụng, yêu cầu và thời hạn nộp hồ sơ được cập nhật trên trang Tuyển dụng.',
          linkLabel: 'Xem thông tin tuyển dụng', linkUrl: '/tuyen-dung',
        },
        {
          phrases: ['phac do dieu tri', 'huong dan dieu tri', 'quy trinh chuyen mon'],
          answer: 'Kho Phác đồ điều trị cung cấp các hướng dẫn chuyên môn được bệnh viện công bố theo từng chuyên khoa.',
          linkLabel: 'Xem phác đồ điều trị', linkUrl: '/phac-do-dieu-tri',
        },
        {
          phrases: ['ky thuat chuyen sau', 'ky thuat moi', 'dich vu ky thuat'],
          answer: 'Trang Kỹ thuật chuyên sâu giới thiệu các kỹ thuật và năng lực chuyên môn đang triển khai tại bệnh viện.',
          linkLabel: 'Xem kỹ thuật chuyên sâu', linkUrl: '/ky-thuat-chuyen-sau',
        },
        {
          phrases: ['chat luong benh vien', 'an toan nguoi benh', 'chi so chat luong'],
          answer: 'Trang Chất lượng bệnh viện cung cấp thông tin về hoạt động cải tiến chất lượng và an toàn người bệnh.',
          linkLabel: 'Xem chất lượng bệnh viện', linkUrl: '/chat-luong-benh-vien',
        },
        {
          phrases: ['tim kiem tren website', 'tim noi dung', 'tra cuu website'],
          answer: 'Bạn có thể sử dụng trang Tìm kiếm để tra cứu đồng thời tin tức, thông báo, bác sĩ và các nội dung công khai.',
          linkLabel: 'Mở trang tìm kiếm', linkUrl: '/tim-kiem',
        },
      ]
      let bestTopic: any = null
      let bestTopicScore = 0
      for (const topic of websiteTopics) {
        const score = topic.phrases.reduce((best, phrase) => Math.max(best, matchScore(q, normalize(phrase))), 0)
        if (score > bestTopicScore) { bestTopic = topic; bestTopicScore = score }
      }
      if (bestTopic && bestTopicScore >= MIN_MATCH_SCORE) matched = bestTopic
    }

    if (!matched) {
      const faqs = await payload.find({ collection: 'faqs', where: { active: { equals: true } }, sort: 'order', limit: 500, depth: 0, overrideAccess: true })
      let bestFaq: any = null
      let bestFaqScore = 0
      for (const faq of faqs.docs as any[]) {
        const candidates = [faq.question, ...(String(faq.keywords || '').split(/[,;\n]/))]
          .map((value) => normalize(String(value || '')))
          .filter(Boolean)
        const score = candidates.reduce((best, candidate) => Math.max(best, matchScore(q, candidate)), 0)
        if (score > bestFaqScore) { bestFaq = faq; bestFaqScore = score }
      }
      if (bestFaq && bestFaqScore >= MIN_MATCH_SCORE) {
        const answer = lexicalToText(bestFaq.answer).trim()
        if (answer) matched = { answer, linkLabel: 'Xem thêm câu hỏi thường gặp', linkUrl: '/hoi-dap' }
      }
    }

    // Nếu chưa match trong chatbotIntents, kiểm tra tiếp trong customAnswers của site-settings
    if (!matched) {
      try {
        const siteSettings: any = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
        const customAnswers = siteSettings?.websiteAssistant?.customAnswers
        if (Array.isArray(customAnswers) && customAnswers.length > 0) {
          let bestCMS: any = null
          let bestScore = 0
          for (const ans of customAnswers) {
            if (!ans?.answer) continue
            const terms = [ans.question, ...(ans.keywords || '').split(/[,;\n]/)]
              .map((t: any) => normalize(String(t || '')))
              .filter((t: string) => t.length >= 2)
            const score = terms.reduce((best: number, term: string) => Math.max(best, matchScore(q, term)), 0)
            if (score > bestScore) {
              bestScore = score
              bestCMS = ans
            }
          }
          if (bestCMS && bestScore >= MIN_MATCH_SCORE) {
            const hotline = String(siteSettings?.hotline || '02923689115')
            const medproUrl = String(siteSettings?.medproUrl || 'https://medpro.vn/')
            const replaceVars = (v?: string) => v?.replaceAll('{{HOTLINE}}', hotline).replaceAll('{{MEDPRO_URL}}', medproUrl)
            matched = {
              answer: replaceVars(bestCMS.answer),
              linkLabel: replaceVars(bestCMS.linkLabel),
              linkUrl: replaceVars(bestCMS.linkUrl),
              openNewTab: bestCMS.openNewTab,
            }
          }
        }
      } catch {}
    }

    const now = new Date().toISOString()
    if (sessionId) {
      try {
        const current: any = currentConversation
        const messages = [...(Array.isArray(current?.messages) ? current.messages : []), { from: 'user', text: question, at: now }, ...(matched ? [{ from: 'bot', text: matched.answer, at: now }] : [])].slice(-100)
        if (current) await payload.update({ collection: 'chatbotConversations', id: current.id, data: { messages, lastMessageAt: now }, overrideAccess: true })
        else await payload.create({ collection: 'chatbotConversations', data: { sessionId, messages, lastMessageAt: now }, overrideAccess: true })
      } catch {}
    }

    if (!matched) {
      try {
        const old = await payload.find({ collection: 'chatbotUnanswered', where: { and: [{ normalizedQuestion: { equals: q } }, { resolved: { equals: false } }] }, limit: 1, depth: 0, overrideAccess: true })
        const item: any = old.docs[0]
        if (item) await payload.update({ collection: 'chatbotUnanswered', id: item.id, data: { count: Number(item.count || 1) + 1, lastAskedAt: now }, overrideAccess: true })
        else await payload.create({ collection: 'chatbotUnanswered', data: { question, normalizedQuestion: q, count: 1, lastAskedAt: now, resolved: false }, overrideAccess: true })
      } catch {}
      return NextResponse.json({
        matched: false,
        suggestions: [
          { label: 'Lịch khám', value: 'Xem lịch khám bác sĩ' },
          { label: 'Giờ làm việc', value: 'Thời gian làm việc của bệnh viện' },
          { label: 'Đặt lịch', value: 'Tôi muốn đặt lịch khám' },
          { label: 'BHYT & viện phí', value: 'Thông tin BHYT và bảng giá viện phí' },
        ],
      })
    }
    return NextResponse.json({ matched: true, answer: matched.answer, linkLabel: matched.linkLabel || undefined, linkUrl: matched.linkUrl || undefined, openNewTab: Boolean(matched.openNewTab) })
  } catch {
    return NextResponse.json({ matched: false })
  }
}
