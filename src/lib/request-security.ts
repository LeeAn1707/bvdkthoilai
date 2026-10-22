const buckets = new Map<string, { count: number; resetAt: number }>()

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const IPV6_REGEX = /^[a-fA-F0-9:]{2,39}$/

function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const cleaned = ip.trim().split(':')[0] === '::ffff' ? ip.trim().replace(/^::ffff:/, '') : ip.trim()
  if (IPV4_REGEX.test(cleaned) || IPV6_REGEX.test(cleaned)) {
    return cleaned
  }
  return null
}

// In production the app port is bound to 127.0.0.1 and Nginx/Cloudflare sets these
// headers. Ưu tiên cf-connecting-ip từ Cloudflare, sau đó là x-real-ip từ reverse proxy.
export function clientAddress(req: Request): string {
  const cfIp = sanitizeIp(req.headers.get('cf-connecting-ip'))
  if (cfIp) return cfIp

  const realIp = sanitizeIp(req.headers.get('x-real-ip'))
  if (realIp) return realIp

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // Lấy IP từ chuỗi forwarded, lọc qua validator an toàn
    const parts = forwarded.split(',').map((p) => p.trim())
    for (const part of parts) {
      const valid = sanitizeIp(part)
      if (valid && valid !== '127.0.0.1' && valid !== '::1') return valid
    }
  }

  return 'unknown'
}

export function rateLimit(req: Request, namespace: string, limit: number, windowMs: number) {
  const now = Date.now()
  const key = `${namespace}:${clientAddress(req)}`
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: Math.ceil(windowMs / 1000) }
  }
  current.count += 1
  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey)
  }
  return { allowed: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
}

export function bodyIsTooLarge(req: Request, maxBytes: number) {
  const length = Number(req.headers.get('content-length') || 0)
  return Number.isFinite(length) && length > maxBytes
}

/**
 * Đọc body JSON với cơ chế đếm byte thực tế (chống bypass bằng chunked transfer / fake Content-Length)
 */
export async function readJsonBodyWithLimit<T = any>(
  req: Request,
  maxBytes: number,
): Promise<{ data?: T; error?: string; status?: number }> {
  // 1. Kiểm tra nhanh Content-Length nếu có
  if (bodyIsTooLarge(req, maxBytes)) {
    return { error: 'Dữ liệu gửi lên vượt quá dung lượng cho phép.', status: 413 }
  }

  try {
    const rawText = await req.text()
    const byteLength = Buffer.byteLength(rawText, 'utf8')
    if (byteLength > maxBytes) {
      return { error: 'Dữ liệu gửi lên vượt quá dung lượng cho phép.', status: 413 }
    }
    if (!rawText.trim()) {
      return { data: {} as T }
    }
    const parsed = JSON.parse(rawText)
    return { data: parsed }
  } catch (err: any) {
    return { error: 'Dữ liệu yêu cầu không đúng định dạng JSON.', status: 400 }
  }
}

export async function verifyTurnstile(req: Request, token: unknown) {
  const isProduction = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test' || process.env.MOCK_TURNSTILE === 'true'
  const responseToken = String(token || '').trim()

  // 1. Token rỗng hoặc vượt quá độ dài tối đa cho phép luôn bị từ chối
  if (!responseToken || responseToken.length > 4096) {
    return false
  }

  // 2. Cho phép token giả lập hợp lệ trong môi trường kiểm thử tự động
  if (isTest && responseToken === 'cf-mock-valid-token') {
    return true
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    if (isProduction || isTest) {
      console.error('[Security] TURNSTILE_SECRET_KEY chưa được cấu hình. Từ chối yêu cầu (Fail-closed).')
      return false
    }
    // Môi trường dev địa phương chưa cấu hình keys thì cảnh báo nhưng cho phép để lập trình viên kiểm thử UI
    return true
  }

  try {
    const form = new URLSearchParams({ secret, response: responseToken })
    const ip = clientAddress(req)
    if (ip && ip !== 'unknown') form.set('remoteip', ip)
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}

export const validPhone = (value: string) => /^(?:\+?84|0)[0-9\s.-]{8,14}$/.test(value)
export const validEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
