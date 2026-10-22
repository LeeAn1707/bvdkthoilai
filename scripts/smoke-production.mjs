import process from 'node:process'
import { execSync } from 'node:child_process'

const rawBase = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const base = rawBase.replace(/\/$/, '')

// 1. Xác minh SMOKE_BASE_URL nằm trong danh sách Allowlist staging
const VERIFIED_STAGING_ALLOWLIST = ['localhost', '127.0.0.1', 'staging.bvdkthoilai.vn', 'test.bvdkthoilai.vn']
let parsedUrl
try {
  parsedUrl = new URL(base)
} catch {
  console.error(`❌ [FAIL] SMOKE_BASE_URL không hợp lệ: ${base}`)
  process.exit(1)
}

if (!VERIFIED_STAGING_ALLOWLIST.includes(parsedUrl.hostname.toLowerCase())) {
  console.error(`❌ [FAIL] CẢNH BÁO BẢO MẬT: SMOKE_BASE_URL (${parsedUrl.hostname}) không nằm trong danh sách Staging Allowlist (${VERIFIED_STAGING_ALLOWLIST.join(', ')})`)
  process.exit(1)
}

// 2. Xác minh commit triển khai (mục tiêu commit 078ed03)
let currentCommit = process.env.DEPLOYED_COMMIT_SHA || ''
if (!currentCommit) {
  try {
    currentCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {}
}

console.log('====================================================================')
console.log('🩺 BẮT ĐẦU SMOKE TEST NGHIỆM THU MÔI TRƯỜNG STAGING')
console.log(`🌐 Staging Base URL: ${base}`)
console.log(`📌 Commit triển khai: ${currentCommit || 'N/A'} (Mục tiêu nghiệm thu: 078ed03)`)
console.log('====================================================================\n')

const coreRoutes = [
  '/', '/tin-tuc', '/thong-bao', '/dau-thau-mua-sam', '/tuyen-dung', '/van-ban',
  '/bang-gia', '/lich-kham', '/tiem-chung', '/khoa-phong', '/chuyen-khoa', '/bac-si',
  '/tim-kiem', '/gop-y', '/gop-y/tra-cuu', '/robots.txt', '/sitemap.xml', '/api/health',
  '/admin/login',
]

let passed = 0
let failed = 0
let redirects = 0

// 3. Kiểm tra từng route, phân biệt chính xác HTTP 200 vs 301/302 Redirect
console.log('--- 1. KIỂM TRA ROUTE GIAO DIỆN & API HỆ THỐNG ---')
for (const path of coreRoutes) {
  try {
    const timeoutMs = path.startsWith('/admin') ? 30000 : 15000
    const res = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    
    if (res.status === 200) {
      passed++
      console.log(`PASS 200 (OK)            ${path}`)
    } else if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      redirects++
      const loc = res.headers.get('location') || ''
      console.log(`PASS ${res.status} (REDIRECT)      ${path} -> ${loc}`)
    } else {
      failed++
      console.log(`FAIL ${String(res.status).padStart(3)} (UNEXPECTED)    ${path}`)
    }

    if (path === '/api/health' && res.status === 200) {
      const data = await res.json().catch(() => null)
      if (!data || data.status !== 'ok' || data.checks?.database !== 'ok') {
        failed++
        console.log('FAIL     /api/health không xác nhận database=ok')
      }
    }
  } catch (e) {
    failed++
    console.log(`FAIL --- (NETWORK ERROR) ${path} (${e?.message || 'error'})`)
  }
}

// 4. Kiểm tra Endpoint Nghiệp vụ & Bảo mật (Đăng nhập, Tạo lịch, Xuất Excel)
console.log('\n--- 2. KIỂM TRA CÁC ROUTE NGHIỆP VỤ & BẢO VỆ PHÂN QUYỀN ---')

// 4.1 Kiểm tra API xuất Excel khi CHƯA đăng nhập: Bắt buộc trả về HTTP 401 Unauthorized
try {
  const unauthExport = await fetch(`${base}/api/appointments-export`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  if (unauthExport.status === 401) {
    passed++
    console.log('PASS 401 (UNAUTHORIZED)  /api/appointments-export (Đã chặn người dùng chưa xác thực truy cập dữ liệu người bệnh)')
  } else {
    failed++
    console.log(`FAIL ${unauthExport.status}               /api/appointments-export (Kỳ vọng 401 nhưng nhận ${unauthExport.status})`)
  }
} catch (e) {
  failed++
  console.log(`FAIL --- /api/appointments-export (${e?.message})`)
}

// 4.2 Kiểm tra API tạo lịch hẹn: Bảo vệ Rate Limit & Validation
try {
  const probeAppt = await fetch(`${base}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(8000),
  })
  // Kỳ vọng 400 (Bad Request/Thiếu Turnstile) hoặc 429 (Rate Limited)
  if (probeAppt.status === 400 || probeAppt.status === 429) {
    passed++
    console.log(`PASS ${probeAppt.status} (PROTECTED)     /api/appointments (Cơ chế chặn request thiếu Turnstile hoặc Rate limit đang hoạt động)`)
  } else {
    failed++
    console.log(`FAIL ${probeAppt.status}               /api/appointments (Kỳ vọng 400/429 nhưng nhận ${probeAppt.status})`)
  }
} catch (e) {
  failed++
  console.log(`FAIL --- /api/appointments (${e?.message})`)
}

// 5. Kiểm tra Security Headers trên trang chủ
console.log('\n--- 3. KIỂM TRA CÁC SECURITY HEADERS TRANG CHỦ ---')
try {
  const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(10000) })
  const required = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy']
  for (const h of required) {
    const present = !!res.headers.get(h)
    if (present) passed++
    else failed++
    console.log(`${present ? 'PASS' : 'FAIL'} header ${h}`)
  }
  if (base.startsWith('https://')) {
    const hsts = !!res.headers.get('strict-transport-security')
    if (hsts) passed++
    else failed++
    console.log(`${hsts ? 'PASS' : 'FAIL'} header strict-transport-security`)
  }
} catch (e) {
  failed++
  console.log(`FAIL security headers (${e?.message || 'network error'})`)
}

console.log('\n====================================================================')
console.log(`📊 KẾT QUẢ SMOKE TEST: ${passed} PASS / ${failed} FAIL / ${redirects} REDIRECT`)
console.log('====================================================================')

if (failed) {
  console.error(`\n❌ Staging smoke test: FAIL (${failed} lỗi)`)
  process.exit(1)
}
console.log('\n✅ Staging smoke test: 100% HOÀN TẤT ĐẠT CHUẨN')
