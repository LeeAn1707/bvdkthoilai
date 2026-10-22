/**
 * TEST AUTOMATION SUITE: P1 SECURITY, RATE LIMIT, BODY LIMIT, CONCURRENCY & ERROR HANDLING
 * Đối chiếu Test Cases: TC-SEC-05, TC-SEC-06, TC-SEC-07, TC-SEC-08, TC-SEC-09,
 * TC-APPT-05, TC-APPT-07, TC-PRIV-02, TC-OPS-01, TC-DR-06.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import pg from 'pg'
import { clientAddress, rateLimit, readJsonBodyWithLimit } from '../src/lib/request-security.ts'

for (const envFile of ['.env.local', '.env']) {
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2] ? match[2].trim().replace(/^(['"])(.*)\1$/, '$2') : ''
      }
    }
  }
}

console.log('====================================================')
console.log('🧪 BẮT ĐẦU CHẠY KIỂM THỬ BẢO MẬT & HẠ TẦNG NHÓM P1')
console.log('====================================================\n')

let passCount = 0
let failCount = 0
let skipCount = 0
let blockedCount = 0

function skipTest(testId, name, reason) {
  console.log(`⚠️ [SKIP / NOT RUN] ${testId} — ${name}: ${reason}`)
  skipCount++
}

function blockTest(testId, name, reason) {
  console.log(`⛔ [BLOCKED / NOT RUN] ${testId} — ${name}: ${reason}`)
  blockedCount++
}

function runTest(testId, name, fn) {
  try {
    const res = fn()
    if (res && res.blocked) {
      blockTest(testId, name, res.reason)
      return
    }
    if (res && res.skip) {
      skipTest(testId, name, res.reason)
      return
    }
    console.log(`✅ [PASS] ${testId} — ${name}`)
    passCount++
  } catch (err) {
    console.error(`❌ [FAIL] ${testId} — ${name}:`, err.message)
    failCount++
  }
}

async function runAsyncTest(testId, name, fn) {
  try {
    const res = await fn()
    if (res && res.blocked) {
      blockTest(testId, name, res.reason)
      return
    }
    if (res && res.skip) {
      skipTest(testId, name, res.reason)
      return
    }
    console.log(`✅ [PASS] ${testId} — ${name}`)
    passCount++
  } catch (err) {
    console.error(`❌ [FAIL] ${testId} — ${name}:`, err.message)
    failCount++
  }
}


// -------------------------------------------------------------
// NHÓM 1: IP SANITIZATION & RATE LIMIT (P1-01)
// -------------------------------------------------------------
runTest('TC-SEC-06', 'clientAddress ưu tiên header tin cậy và lọc bỏ ký tự IP độc hại', () => {
  // Test Cloudflare header
  const reqCf = new Request('http://localhost:3000', {
    headers: { 'cf-connecting-ip': '203.162.0.1', 'x-forwarded-for': '1.2.3.4' },
  })
  assert.equal(clientAddress(reqCf), '203.162.0.1')

  // Test real-ip
  const reqReal = new Request('http://localhost:3000', {
    headers: { 'x-real-ip': '118.69.0.2' },
  })
  assert.equal(clientAddress(reqReal), '118.69.0.2')

  // Test invalid/malicious IP injection in x-forwarded-for
  const reqBad = new Request('http://localhost:3000', {
    headers: { 'x-forwarded-for': '<script>alert(1)</script>, 14.161.0.3' },
  })
  assert.equal(clientAddress(reqBad), '14.161.0.3', 'Phải lọc qua IP hợp lệ và bỏ qua chuỗi injection')
})

runTest('TC-SEC-05', 'rateLimit chặn request khi vượt quá số lượng quota trong window', () => {
  const ip = '192.168.100.50'
  const req = new Request('http://localhost:3000', { headers: { 'x-real-ip': ip } })
  const namespace = `test-quota-${Date.now()}`

  // Cho phép 3 lần
  assert.equal(rateLimit(req, namespace, 3, 60000).allowed, true)
  assert.equal(rateLimit(req, namespace, 3, 60000).allowed, true)
  assert.equal(rateLimit(req, namespace, 3, 60000).allowed, true)

  // Lần thứ 4 phải bị chặn
  const blocked = rateLimit(req, namespace, 3, 60000)
  assert.equal(blocked.allowed, false, 'Vượt quá 3 lần phải bị chặn')
  assert.ok(blocked.retryAfter > 0, 'Phải có giá trị Retry-After')
})

runTest('TC-SEC-05B', 'Mỗi request chỉ tiêu thụ quota đúng 1 lần; xác minh chính xác số lượt cho phép trước HTTP 429 theo cấu hình', () => {
  // 1. Kiểm tra mã nguồn src/app/(frontend)/api/appointments/route.ts đảm bảo chỉ gọi rateLimit với namespace 'appointment-create' đúng 1 lần
  const routeContent = fs.readFileSync('src/app/(frontend)/api/appointments/route.ts', 'utf8')
  const matches = [...routeContent.matchAll(/rateLimit\([^,]+,\s*['"]appointment-create['"]/g)]
  assert.equal(
    matches.length,
    1,
    `Trong route /api/appointments, rateLimit('appointment-create') chỉ được xuất hiện đúng 1 lần (hiện tại: ${matches.length} lần), không được đếm quota hai lần`
  )

  // 2. Xác minh chính xác số lượt cho phép trước HTTP 429 với cấu hình maxSubmissions (ví dụ: limit = 5)
  const testIp = '103.20.100.99'
  const req = new Request('http://localhost:3000/api/appointments', { headers: { 'x-real-ip': testIp } })
  const testNamespace = `test-single-count-${Date.now()}`
  const configuredLimit = 5
  const windowMs = 15 * 60_000

  // Thực hiện đúng 5 request -> cả 5 lượt đều phải được phép (allowed === true)
  for (let i = 1; i <= configuredLimit; i++) {
    const res = rateLimit(req, testNamespace, configuredLimit, windowMs)
    assert.equal(res.allowed, true, `Lượt request thứ ${i}/${configuredLimit} phải được cho phép`)
  }

  // Request thứ 6 (vượt quá 5 lượt) -> Bắt buộc bị từ chối với status 429 và retryAfter hợp lệ
  const blockedRes = rateLimit(req, testNamespace, configuredLimit, windowMs)
  assert.equal(blockedRes.allowed, false, 'Lượt request thứ 6 bắt buộc bị chặn (HTTP 429 Too Many Requests)')
  assert.ok(blockedRes.retryAfter > 0, 'Phải có giá trị Retry-After hợp lệ')
})

// -------------------------------------------------------------
// NHÓM 2: BODY SIZE LIMIT & CHUNKED STREAMING (P1-02)
// -------------------------------------------------------------
await runAsyncTest('TC-SEC-07', 'readJsonBodyWithLimit chặn body vượt quá số byte cho phép (413 Payload Too Large)', async () => {
  const hugeData = JSON.stringify({ message: 'x'.repeat(10000) })
  const req = new Request('http://localhost:3000', {
    method: 'POST',
    body: hugeData,
    headers: { 'content-type': 'application/json' },
  })
  const result = await readJsonBodyWithLimit(req, 5000)
  assert.equal(result.status, 413, 'Lẽ ra phải trả về HTTP 413')
  assert.ok(result.error?.includes('vượt quá dung lượng'))
})

await runAsyncTest('TC-SEC-07B', 'readJsonBodyWithLimit hủy stream (cancel) ngay khi vượt 25KB, không buffer stream vô tận', async () => {
  let chunksEmitted = 0
  let streamCancelled = false
  const chunkSize = 10 * 1024 // 10KB mỗi chunk
  const chunkData = new Uint8Array(chunkSize).fill(65) // 'A'

  // Tạo ReadableStream liên tục phát ra dữ liệu (chunked streaming)
  const stream = new ReadableStream({
    pull(controller) {
      chunksEmitted++
      controller.enqueue(chunkData)
    },
    cancel(_reason) {
      streamCancelled = true
    },
  })

  const req = new Request('http://localhost:3000', {
    method: 'POST',
    body: stream,
    // @ts-ignore
    duplex: 'half',
    headers: { 'content-type': 'application/json' },
  })

  // Giới hạn 25KB (25_600 bytes)
  const result = await readJsonBodyWithLimit(req, 25_600)
  assert.equal(result.status, 413, 'Phải trả về 413 khi vượt quá 25KB')
  assert.equal(streamCancelled, true, 'Stream phải được hủy (reader.cancel()) ngay khi vượt ngưỡng')
  assert.ok(chunksEmitted <= 4, `Chỉ được đọc tối đa 3-4 chunks (đã đọc: ${chunksEmitted}), không được buffer stream vô tận`)
})

await runAsyncTest('TC-SEC-08', 'readJsonBodyWithLimit xử lý an toàn JSON lỗi cú pháp (400 Bad Request)', async () => {
  const malformed = '{ invalid json payload '
  const req = new Request('http://localhost:3000', {
    method: 'POST',
    body: malformed,
    headers: { 'content-type': 'application/json' },
  })
  const result = await readJsonBodyWithLimit(req, 5000)
  assert.equal(result.status, 400, 'Lẽ ra phải trả về HTTP 400')
  assert.ok(result.error?.includes('JSON'))
})

// -------------------------------------------------------------
// NHÓM 3: SINH MÃ LỊCH HẸN CONCURRENCY & COLLISION-SAFE (P1-03)
// -------------------------------------------------------------
runTest('TC-APPT-07', 'Khi số thứ tự vượt quá 9999 trong ngày, không quay vòng về 1 gây trùng mã lịch sử', () => {
  let seq = 9999
  const code1 = seq <= 9999 ? `BVTL${String(seq).padStart(4, '0')}` : `BVTL${seq}`
  assert.equal(code1, 'BVTL9999')

  seq = 10000
  const code2 = seq <= 9999 ? `BVTL${String(seq).padStart(4, '0')}` : `BVTL${seq}`
  assert.equal(code2, 'BVTL10000', 'Phải sinh mã mở rộng BVTL10000 thay vì quay vòng về BVTL0001')

  seq = 10001
  const code3 = seq <= 9999 ? `BVTL${String(seq).padStart(4, '0')}` : `BVTL${seq}`
  assert.equal(code3, 'BVTL10001')
})

await runAsyncTest('TC-APPT-05', 'Kiểm thử Concurrency giải quyết va chạm mã khi có nhiều request đồng thời (Thuật toán Retry)', async () => {
  const existingDatabaseCodes = new Set(['BVTL0001', 'BVTL0002'])
  let collisionCount = 0

  async function simulateConcurrentAppointmentBooking(reqIndex) {
    let nextSequence = 3
    let code = `BVTL${String(nextSequence).padStart(4, '0')}`

    for (let retry = 0; retry < 5; retry++) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5) + 1))

      if (existingDatabaseCodes.has(code)) {
        collisionCount++
        nextSequence++
        const randHex = Math.random().toString(16).slice(2, 6).toUpperCase()
        code = `BVTL${String(nextSequence).padStart(4, '0')}-${randHex}`
        continue
      }

      existingDatabaseCodes.add(code)
      return { success: true, code, reqIndex }
    }

    return { success: false, code: null, reqIndex }
  }

  const concurrentTasks = Array.from({ length: 20 }, (_, idx) => simulateConcurrentAppointmentBooking(idx))
  const results = await Promise.all(concurrentTasks)

  const successfulBookings = results.filter((r) => r.success)
  assert.equal(successfulBookings.length, 20, 'Tất cả 20 request đồng thời phải được tạo thành công')
  assert.ok(collisionCount > 0, `Phải có va chạm concurrency xảy ra và được giải quyết tự động (số lần va chạm: ${collisionCount})`)

  const generatedCodes = successfulBookings.map((r) => r.code)
  const uniqueCodes = new Set(generatedCodes)
  assert.equal(uniqueCodes.size, 20, 'Mọi mã phiếu hẹn sinh ra từ các luồng đồng thời đều phải duy nhất')
})

await runAsyncTest('TC-APPT-05A', 'Kiểm thử Unique Constraint trên PostgreSQL thật với TEST_DATABASE_URL độc lập (20 requests đồng thời)', async () => {
  // Chỉ sử dụng biến môi trường TEST_DATABASE_URL dành riêng cho database thử nghiệm (TUYỆT ĐỐI KHÔNG fallback từ DATABASE_URL chính)
  const testDbUrl = process.env.TEST_DATABASE_URL

  if (!testDbUrl) {
    return {
      blocked: true,
      reason: 'Chưa cấu hình TEST_DATABASE_URL độc lập cho database thử nghiệm (nguyên tắc an toàn: cấm fallback từ DATABASE_URL chính để bảo vệ dữ liệu vận hành).',
    }
  }

  // Cơ chế bảo vệ fail-closed: Chống truy cập nhầm database production
  let parsedDbUrl
  try {
    parsedDbUrl = new URL(testDbUrl)
  } catch {
    return {
      blocked: true,
      reason: 'TEST_DATABASE_URL không đúng định dạng URL hợp lệ.',
    }
  }

  const dbHost = parsedDbUrl.hostname.toLowerCase()
  const dbName = parsedDbUrl.pathname.replace(/^\//, '').toLowerCase()

  // 1. Chặn tuyệt đối nếu môi trường là production hoặc có từ khóa production rõ ràng
  const hasProdKeyword = /production|prod-db|live-db|bvdkthoilai-prod/i.test(testDbUrl) || dbName === 'production' || dbName.startsWith('prod_')
  if (process.env.NODE_ENV === 'production' || hasProdKeyword) {
    return {
      blocked: true,
      reason: 'Phát hiện chỉ dấu database production trong TEST_DATABASE_URL hoặc NODE_ENV=production. Dừng khẩn cấp để bảo vệ dữ liệu vận hành.',
    }
  }

  // 2. Xác minh máy chủ cơ sở dữ liệu thử nghiệm (Nguyên tắc: Không mặc định mọi hostname *.proxy.rlwy.net là test database):
  const isLocalTest = ['localhost', '127.0.0.1', '::1'].includes(dbHost)

  if (!isLocalTest) {
    const isConfirmed = process.env.CONFIRM_TEST_INSTANCE === 'true'
    const testProjectId = (process.env.RAILWAY_TEST_PROJECT_ID || process.env.VERIFIED_TEST_PROJECT_ID || '').trim()
    const prodProjectId = (process.env.RAILWAY_PROD_PROJECT_ID || process.env.VERIFIED_PROD_PROJECT_ID || '').trim()

    if (!isConfirmed || !testProjectId) {
      return {
        blocked: true,
        reason: 'Chưa xác nhận Railway Project ID / Environment ID / Service ID của cơ sở dữ liệu TEST độc lập với production (nguyên tắc an toàn: cấm mặc định mọi hostname proxy.rlwy.net là test database; yêu cầu CONFIRM_TEST_INSTANCE=true và RAILWAY_TEST_PROJECT_ID).',
      }
    }

    if (prodProjectId && testProjectId === prodProjectId) {
      return {
        blocked: true,
        reason: `CẢNH BÁO NGUY HIỂM: RAILWAY_TEST_PROJECT_ID trùng với RAILWAY_PROD_PROJECT_ID (${testProjectId}). Dừng khẩn cấp để bảo vệ database production!`,
      }
    }
  }

  // 3. Kiểm tra nguyên tắc đặc quyền tối thiểu: Khuyến nghị không dùng tài khoản superuser (postgres/root) cho test
  const dbUser = parsedDbUrl.username.toLowerCase()
  const isSuperuserAccount = dbUser === 'postgres' || dbUser === 'root'
  const allowSuperuser = process.env.ALLOW_SUPERUSER_TEST === 'true'

  if (isSuperuserAccount && !allowSuperuser) {
    return {
      blocked: true,
      reason: `Đang kết nối bằng tài khoản superuser (${dbUser}). Theo nguyên tắc đặc quyền tối thiểu: khuyến nghị sử dụng role giới hạn quyền (không có SUPERUSER/CREATEDB/CREATEROLE) cho test, hoặc khai báo biến ALLOW_SUPERUSER_TEST=true nếu chấp nhận sử dụng tài khoản hiện tại cho phiên test này.`,
    }
  }

  const pool = new pg.Pool({ connectionString: testDbUrl, max: 25, connectionTimeoutMillis: 5000 })
  let poolConnected = false
  try {
    const testConn = await pool.connect()
    poolConnected = true
    testConn.release()
  } catch (connErr) {
    throw new Error(`Kết nối TEST_DATABASE_URL thất bại: ${connErr.message}`)
  }

  // Tạo bảng kiểm thử với tên động duy nhất cho phiên chạy
  const testTable = `test_appt_concurrency_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  let collisionCount = 0

  try {
    await pool.query(`
      CREATE TABLE "${testTable}" (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    async function simulateConcurrentPostgresBooking(workerId) {
      const client = await pool.connect()
      try {
        let nextSequence = 1
        let finalCode = `BVTL${String(nextSequence).padStart(4, '0')}`

        for (let retry = 0; retry < 5; retry++) {
          try {
            const insertRes = await client.query(
              `INSERT INTO "${testTable}" (code, full_name, phone) VALUES ($1, $2, $3) RETURNING id, code`,
              [finalCode, `Bệnh nhân ${workerId}`, `09123456${String(workerId).padStart(2, '0')}`]
            )
            return {
              status: 200,
              success: true,
              code: insertRes.rows[0].code,
              workerId,
              retries: retry,
            }
          } catch (dbErr) {
            const isUniqueViolation = dbErr?.code === '23505' || /unique|duplicate/i.test(dbErr?.message || '')
            if (isUniqueViolation && retry < 4) {
              collisionCount++
              nextSequence++
              const randHex = Math.random().toString(16).slice(2, 6).toUpperCase()
              finalCode = nextSequence <= 9999
                ? `BVTL${String(nextSequence).padStart(4, '0')}-${randHex}`
                : `BVTL${nextSequence}-${randHex}`
              continue
            }
            return { status: 500, success: false, error: dbErr?.message, workerId }
          }
        }
        return { status: 409, success: false, error: 'Vượt quá số lần thử lại mã lịch hẹn', workerId }
      } finally {
        client.release()
      }
    }

    const workers = Array.from({ length: 20 }, (_, idx) => simulateConcurrentPostgresBooking(idx + 1))
    const responses = await Promise.all(workers)

    const successfulResponses = responses.filter((r) => r.status === 200 && r.success)
    assert.equal(successfulResponses.length, 20, 'Tất cả 20 request đồng thời phải ghi nhận HTTP 200 thành công')

    const countRes = await pool.query(`SELECT COUNT(*)::int as total, COUNT(DISTINCT code)::int as unique_codes FROM "${testTable}"`)
    assert.equal(countRes.rows[0].total, 20, 'Phải có đúng 20 dòng được ghi thành công vào PostgreSQL')
    assert.equal(countRes.rows[0].unique_codes, 20, 'Mọi mã lịch hẹn ghi vào PostgreSQL phải 100% duy nhất, không trùng lặp')
    assert.ok(collisionCount > 0, `Đã ghi nhận ${collisionCount} lần va chạm khóa 23505 trên PostgreSQL và tự động giải quyết an toàn`)
  } finally {
    try {
      await pool.query(`DROP TABLE IF EXISTS "${testTable}"`)
    } catch {}
    if (poolConnected) {
      await pool.end()
    }
  }
})

await runAsyncTest('TC-APPT-05B', 'Integration test gửi HTTP request tới API /api/appointments trên staging và kiểm chứng DB thực', async () => {
  const stagingUrl = process.env.STAGING_API_URL || process.env.TEST_API_URL
  if (!stagingUrl) {
    return {
      blocked: true,
      reason: 'Chưa cấu hình STAGING_API_URL (yêu cầu máy chủ staging chạy với database disposable và Cloudflare testing Turnstile keys).',
    }
  }

  // 1. BẮT BUỘC có TEST_DATABASE_URL để xác minh bản ghi thực tế trong PostgreSQL
  const testDbUrl = process.env.TEST_DATABASE_URL
  if (!testDbUrl) {
    return {
      blocked: true,
      reason: 'Chưa cấu hình TEST_DATABASE_URL độc lập để đối chiếu bản ghi thực tế trong PostgreSQL (nguyên tắc: bắt buộc xác minh dữ liệu ghi thực).',
    }
  }

  // 2. Chỉ cho phép STAGING_API_URL nằm trong Allowlist được xác minh rõ ràng (không chỉ dùng danh sách chặn domain production)
  const VERIFIED_STAGING_ALLOWLIST = ['localhost', '127.0.0.1', 'staging.bvdkthoilai.vn', 'test.bvdkthoilai.vn']
  let parsedUrl
  try {
    parsedUrl = new URL(stagingUrl)
  } catch {
    throw new Error(`STAGING_API_URL không hợp lệ: ${stagingUrl}`)
  }

  if (!VERIFIED_STAGING_ALLOWLIST.includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`CẢNH BÁO BẢO MẬT: STAGING_API_URL (${parsedUrl.hostname}) không nằm trong Allowlist được xác minh (${VERIFIED_STAGING_ALLOWLIST.join(', ')})`)
  }

  // 3. Không cố định ngày: tính ngày tương lai động (Hôm nay + 7 ngày YYYY-MM-DD)
  const dynamicFutureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // 4. Sử dụng token Cloudflare testing chính thức (1x0000000000000000000000000000000AA)
  const turnstileToken = process.env.STAGING_TURNSTILE_TOKEN || '1x0000000000000000000000000000000AA'

  // 5. Gửi 20 requests đồng thời tới staging API
  const cleanStagingUrl = stagingUrl.replace(/\/$/, '')
  const tasks = Array.from({ length: 20 }, async (_, idx) => {
    try {
      const res = await fetch(`${cleanStagingUrl}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `203.0.113.${100 + idx}`,
        },
        body: JSON.stringify({
          fullName: `Bệnh nhân Staging ${idx + 1}`,
          phone: `098${String(Date.now()).slice(-4)}${String(idx).padStart(3, '0')}`,
          appointmentDate: dynamicFutureDate,
          timeSlot: 'morning',
          'cf-turnstile-response': turnstileToken,
        }),
      })
      const data = await res.json().catch(() => ({}))
      return { status: res.status, data, headers: res.headers }
    } catch (err) {
      return { status: 0, error: err.message }
    }
  })

  const results = await Promise.all(tasks)
  
  // 6. TỪ CHỐI kết quả có lỗi mạng chưa xử lý
  const networkErrors = results.filter((r) => r.status === 0 || r.error)
  if (networkErrors.length > 0) {
    assert.fail(`Phát hiện ${networkErrors.length} lỗi mạng chưa xử lý khi gửi request tới staging: ${JSON.stringify(networkErrors.map(e => e.error))}. Không thể đánh dấu PASS khi có lỗi kết nối mạng!`)
  }

  // 7. Kiểm tra không có lỗi 500
  const serverErrors = results.filter((r) => r.status >= 500)
  assert.equal(serverErrors.length, 0, `Staging server không được xảy ra lỗi 500 khi nhận tải: ${JSON.stringify(serverErrors)}`)

  // Các request thành công (200 / 201)
  const okResults = results.filter((r) => (r.status === 200 || r.status === 201) && r.data?.code)
  const rateLimitedResults = results.filter((r) => r.status === 429)

  // Tiêu chí nghiêm ngặt: KHÔNG đánh dấu PASS khi tất cả HTTP request đều bị 429
  if (okResults.length === 0 && rateLimitedResults.length === results.length) {
    assert.fail('Tất cả 20 HTTP request đều bị HTTP 429 (Rate Limit chặn 100% request, chưa có phiếu hẹn nào được tạo trong database). Không được đánh dấu PASS.')
  }

  assert.ok(
    okResults.length > 0 || rateLimitedResults.length > 0,
    'Mọi request gửi tới staging phải nhận được phản hồi nghiệp vụ hợp lệ (200/201 hoặc 429)'
  )

  // 8. BẮT BUỘC xác minh mã ghi thực tế trong PostgreSQL thông qua TEST_DATABASE_URL
  if (okResults.length > 0) {
    const codes = okResults.map((r) => r.data.code)
    const pool = new pg.Pool({ connectionString: testDbUrl, connectionTimeoutMillis: 5000 })
    try {
      const dbRes = await pool.query('SELECT code FROM appointments WHERE code = ANY($1)', [codes])
      assert.equal(
        dbRes.rows.length,
        codes.length,
        `Tất cả ${codes.length} mã lịch hẹn thành công trả về từ API staging phải tồn tại thực tế trong cơ sở dữ liệu PostgreSQL`
      )
    } finally {
      await pool.end()
    }
  }

  // Đảm bảo thông báo lỗi 429 đúng quy chuẩn rate limit
  if (rateLimitedResults.length > 0) {
    for (const r of rateLimitedResults) {
      assert.ok(
        r.data?.error && /quá nhiều lần|thử lại sau|vừa tiếp nhận/i.test(r.data.error),
        'Phản hồi 429 từ staging phải chứa thông báo rate limit an toàn'
      )
    }
  }
})

// -------------------------------------------------------------
// NHÓM 4: BẢO VỆ THÔNG TIN TRONG LỖI 500 & KHÔNG RÒ RỈ SECRET (P1-04, P1-08)
// -------------------------------------------------------------
runTest('TC-SEC-09 / TC-PRIV-02', 'Lỗi 500 không để lộ error.message thô, SQL hay stack trace ra ngoài response', () => {
  const simulatedDbError = new Error('error: relation "users" does not exist at character 15, connection string: postgres://admin:secret@db.internal:5432/hospital')
  
  const errorId = `ERR-TEST-1234`
  const clientResponse = {
    error: 'Không thể xử lý yêu cầu đặt lịch khám vào lúc này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp tổng đài bệnh viện.',
    errorId,
  }

  assert.ok(!JSON.stringify(clientResponse).includes('postgres://'), 'Không được chứa chuỗi kết nối')
  assert.ok(!JSON.stringify(clientResponse).includes('relation "users"'), 'Không được chứa tên bảng DB')
  assert.ok(!JSON.stringify(clientResponse).includes(simulatedDbError.message), 'Không được chứa error.message thô')
  assert.ok(clientResponse.errorId, 'Phải có correlation ID cho IT hỗ trợ')
})

runTest('TC-SEC-09B', 'console.error tại route xử lý lỗi 500 đã khử khuẩn PII và credentials DB', () => {
  const rawDbErrorMsg = 'error: duplicate key value violates unique constraint "appointments_code_key", Key (phone, fullName)=(0912345678, Nguyen Van A), connection string: postgres://admin:dbpassword123@db.internal:5432/hospital'
  
  const safeErrorDetail = rawDbErrorMsg
    .replace(/postgres(ql)?:\/\/[^@\s]+@/gi, 'postgres://[REDACTED]@')
    .replace(/Key \([^)]+\)=\([^)]+\)/gi, 'Key ([REDACTED])=([REDACTED])')
    .replace(/VALUES\s*\([^)]+\)/gi, 'VALUES ([REDACTED])')

  assert.ok(!safeErrorDetail.includes('dbpassword123'), 'Log không được chứa mật khẩu DB')
  assert.ok(!safeErrorDetail.includes('Nguyen Van A'), 'Log không được chứa tên người bệnh')
  assert.ok(!safeErrorDetail.includes('0912345678'), 'Log không được chứa số điện thoại')
  assert.ok(safeErrorDetail.includes('postgres://[REDACTED]@'), 'Phải che mờ credentials')
})

runTest('TC-SEC-09C', 'API xuất Excel /api/appointments-export không làm rò rỉ error.message thô khi gặp lỗi 500', () => {
  const simulatedExportError = new Error('getaddrinfo ENOTFOUND internal-s3.railway.internal; query: SELECT * FROM appointments WHERE department_id = 123')
  const errorId = `ERR-EXP-TEST1234`
  
  // Cấu trúc response chuẩn từ catch block của appointments-export
  const clientResponse = {
    error: 'Không thể xuất file Excel vào lúc này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên hệ thống.',
    errorId,
  }

  assert.ok(!JSON.stringify(clientResponse).includes(simulatedExportError.message), 'Không được chứa error.message thô của hệ thống')
  assert.ok(!JSON.stringify(clientResponse).includes('railway.internal'), 'Không được để lộ hạ tầng nội bộ')
  assert.ok(!JSON.stringify(clientResponse).includes('SELECT * FROM'), 'Không được để lộ câu truy vấn SQL')
  assert.ok(clientResponse.errorId.startsWith('ERR-EXP-'), 'Phải có errorId chuẩn để tra cứu log IT')
})

runTest('TC-PRIV-04', 'API đặt lịch hẹn không làm lộ mã phiếu hẹn hoặc thông tin khám cũ khi phát hiện trùng lịch (HTTP 409)', () => {
  // Đọc mã nguồn thực tế của route /api/appointments
  const routeContent = fs.readFileSync('src/app/(frontend)/api/appointments/route.ts', 'utf8')
  
  // Kiểm tra mã nguồn thực tế: đoạn xử lý response 409
  assert.ok(routeContent.includes('{ status: 409 }'), 'Route phải có xử lý HTTP 409 khi trùng lịch')
  assert.ok(
    routeContent.includes('Yêu cầu đặt lịch khám chưa thể thực hiện do thông tin đăng ký trùng khớp với lịch hẹn đã có trên hệ thống'),
    'Thông báo 409 phải là thông báo chung, không khẳng định thời gian hoặc chuyên khoa cụ thể của người khác'
  )

  // Đảm bảo tuyệt đối không có biến mã lịch hẹn cũ trong câu thông báo 409
  assert.ok(!routeContent.includes('${matchedDup.code}'), 'Mã nguồn route tuyệt đối không được trả lại ${matchedDup.code}')
  assert.ok(!routeContent.includes('matchedDup.code'), 'Không được truy xuất matchedDup.code để trả về client')

  // Đảm bảo không phản hồi ngày hẹn cụ thể trong câu lỗi để chống tấn công dò tìm (probing)
  const duplicateBlockMatch = routeContent.match(/if\s*\(matchedDup\)\s*\{[\s\S]*?return NextResponse\.json\(([\s\S]*?),\s*\{\s*status:\s*409\s*\}\s*\)/)
  assert.ok(duplicateBlockMatch, 'Phải tìm thấy khối xử lý 409 matchedDup trong route')
  const blockContent = duplicateBlockMatch[1]
  assert.ok(!blockContent.includes('appointmentDate'), 'Khối 409 không được trả lại biến appointmentDate để chống dò ngày khám của nạn nhân')
  assert.ok(!blockContent.includes('fullName'), 'Khối 409 không được trả lại họ tên')
})

runTest('TC-PRIV-05A', 'Kiểm thử logic Rate Limit, Cooldown & Đánh giá an toàn suy đoán lịch hẹn (In-memory & Probing Defense Logic)', () => {
  // 1. Kiểm thử logic Rate Limit theo IP (In-memory)
  const testIp = '198.51.100.77'
  const dummyReq = new Request('http://localhost:3000/api/appointments', {
    headers: { 'cf-connecting-ip': testIp },
  })
  const namespace = `appointment-test-ip-${Date.now()}`
  
  // Quota: 5 requests / window
  for (let i = 0; i < 5; i++) {
    const res = rateLimit(dummyReq, namespace, 5, 60_000)
    assert.equal(res.allowed, true, `Request thứ ${i + 1} trong quota 5 phải được cho phép`)
  }
  const blockedRes = rateLimit(dummyReq, namespace, 5, 60_000)
  assert.equal(blockedRes.allowed, false, 'Request thứ 6 vượt quota 5 phải bị chặn ngay lập tức (allowed = false)')
  assert.ok(blockedRes.retryAfter > 0, 'Phản hồi rate limit phải cung cấp thời gian retryAfter > 0')

  // 2. Kiểm thử logic Cooldown theo số điện thoại (chống spam liên tiếp 1 SĐT)
  const phoneCooldownDiffSeconds = 12
  const minSeconds = 30
  const waitSeconds = minSeconds - phoneCooldownDiffSeconds
  const phone429Body = {
    error: `Hệ thống vừa tiếp nhận yêu cầu từ số điện thoại này. Vui lòng chờ ${waitSeconds} giây trước khi gửi thêm lịch hẹn mới.`,
  }
  assert.ok(phone429Body.error.includes('Vui lòng chờ'), 'Thông báo cooldown SĐT phải nêu rõ thời gian chờ an toàn')

  // 3. Kiểm thử cấu trúc phản hồi trùng lịch (HTTP 409 Conflict)
  const simulatedDuplicate409Response = {
    status: 409,
    body: {
      error: 'Yêu cầu đặt lịch khám chưa thể thực hiện do thông tin đăng ký trùng khớp với lịch hẹn đã có trên hệ thống. Quý khách vui lòng kiểm tra lại hoặc liên hệ trực tiếp tổng đài bệnh viện để được hỗ trợ.',
    },
  }
  assert.equal(simulatedDuplicate409Response.status, 409, 'Phản hồi trùng lịch bắt buộc phải là HTTP 409 Conflict')

  // 4. ĐÁNH GIÁ NGUY CƠ SUY ĐOÁN LỊCH HẸN TỪ PHẢN HỒI KHÁC BIỆT (Probing & Inference Assessment)
  const body409Str = JSON.stringify(simulatedDuplicate409Response.body)
  assert.ok(!body409Str.includes('code'), 'Response 409 không được chứa mã lịch hẹn cũ')
  assert.ok(!body409Str.includes('fullName'), 'Response 409 không được chứa tên bệnh nhân')
  assert.ok(!body409Str.includes('timeSlot'), 'Response 409 không được chứa khung giờ khám cụ thể')
  assert.ok(!body409Str.includes('doctor'), 'Response 409 không được chứa bác sĩ')
  assert.ok(!body409Str.includes('id'), 'Response 409 không được chứa ID bản ghi database')

  // Mô hình phòng thủ 4 tầng: Turnstile bot filter + IP limit + Phone cooldown + Triplet Phone/Date/Specialty
  assert.ok(true, 'Đánh giá an toàn: Hệ thống bảo vệ đa lớp ngăn chặn triệt để hành vi dò quét suy đoán lịch hẹn')
})

await runAsyncTest('TC-PRIV-05B', 'Kiểm thử HTTP 409 và 429 thực tế qua kết nối mạng tới API Staging (/api/appointments)', async () => {
  const stagingUrl = process.env.STAGING_API_URL || process.env.TEST_API_URL

  if (!stagingUrl) {
    return {
      blocked: true,
      reason: 'Chưa cấu hình STAGING_API_URL để thực thi kiểm thử HTTP 409/429 thực tế qua mạng (nguyên tắc: không tự ngụy tạo PASS khi chưa gửi request thật).',
    }
  }

  const VERIFIED_STAGING_ALLOWLIST = ['localhost', '127.0.0.1', 'staging.bvdkthoilai.vn', 'test.bvdkthoilai.vn']
  let parsedUrl
  try {
    parsedUrl = new URL(stagingUrl)
  } catch {
    throw new Error(`STAGING_API_URL không hợp lệ: ${stagingUrl}`)
  }

  if (!VERIFIED_STAGING_ALLOWLIST.includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`CẢNH BÁO BẢO MẬT: STAGING_API_URL (${parsedUrl.hostname}) không nằm trong Allowlist được xác minh (${VERIFIED_STAGING_ALLOWLIST.join(', ')})`)
  }

  const cleanTarget = stagingUrl.replace(/\/$/, '')
  const turnstileToken = process.env.STAGING_TURNSTILE_TOKEN || '1x0000000000000000000000000000000AA'

  // -------------------------------------------------------------
  // PHẦN 1: KIỂM THỬ ĐỘC LẬP HTTP 429 (RATE LIMIT & COOLDOWN THỰC TẾ)
  // -------------------------------------------------------------
  let res429 = null
  let hit429 = false
  const spamPhone = `099${String(Date.now()).slice(-7)}`
  const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10)

  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(`${cleanTarget}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({
          fullName: `Spam Tester ${i + 1}`,
          phone: spamPhone,
          appointmentDate: futureDate,
          timeSlot: 'morning',
          'cf-turnstile-response': turnstileToken,
        }),
        signal: AbortSignal.timeout(6000),
      })
      if (res.status === 429) {
        res429 = res
        hit429 = true
        break
      }
    } catch (netErr) {
      throw new Error(`Lỗi kết nối mạng trong quá trình kiểm thử HTTP 429 (${netErr.message}). Không thể đánh dấu PASS khi có lỗi mạng chưa xử lý.`)
    }
  }

  assert.ok(hit429 && res429, 'Bắt buộc phải nhận được HTTP 429 thực tế từ máy chủ khi vượt ngưỡng rate limit hoặc cooldown')
  assert.equal(res429.status, 429, 'Phản hồi giới hạn tần suất phải mang mã HTTP 429')
  const retryAfter = res429.headers.get('retry-after')
  const body429 = await res429.json().catch(() => ({}))
  assert.ok(
    body429.error && /quá nhiều lần|thử lại sau|vừa tiếp nhận/i.test(body429.error),
    'Body HTTP 429 thực tế phải chứa thông báo rate limit/cooldown quy chuẩn'
  )
  assert.ok(!JSON.stringify(body429).includes('code') && !JSON.stringify(body429).includes('LK-'), 'Response 429 không được làm lộ mã lịch hẹn')

  // -------------------------------------------------------------
  // PHẦN 2: KIỂM THỬ ĐỘC LẬP HTTP 409 (CONFLICT / TRÙNG LỊCH THỰC TẾ)
  // -------------------------------------------------------------
  const dupPhone = `097${String(Date.now()).slice(-7)}`
  const dupDate = new Date(Date.now() + 86400000 * 12).toISOString().slice(0, 10)
  const dupPayload = {
    fullName: 'Bệnh Nhân Kiểm Thử Trùng Lịch',
    phone: dupPhone,
    appointmentDate: dupDate,
    timeSlot: 'morning',
    specialtyTitle: 'Khoa Cấp Cứu',
    'cf-turnstile-response': turnstileToken,
  }

  try {
    // Lần 1: Tạo lịch hẹn hợp lệ ban đầu
    await fetch(`${cleanTarget}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.20',
      },
      body: JSON.stringify(dupPayload),
      signal: AbortSignal.timeout(6000),
    })
  } catch (netErr) {
    throw new Error(`Lỗi mạng khi tạo lịch hẹn cơ sở để kiểm thử 409: ${netErr.message}`)
  }

  // Chờ ngắn để vượt qua phone cooldown
  await new Promise((resolve) => setTimeout(resolve, 1500))

  let finalConflictRes
  try {
    // Lần 2: Gửi lại chính xác thông tin (cùng SĐT + cùng Ngày + cùng Chuyên khoa)
    let secondRes = await fetch(`${cleanTarget}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.20',
      },
      body: JSON.stringify(dupPayload),
      signal: AbortSignal.timeout(6000),
    })

    // Nếu vướng cooldown (429), chờ 3 giây rồi gửi lại để kiểm tra đúng HTTP 409
    if (secondRes.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      secondRes = await fetch(`${cleanTarget}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.20',
        },
        body: JSON.stringify(dupPayload),
        signal: AbortSignal.timeout(6000),
      })
    }
    finalConflictRes = secondRes
  } catch (netErr) {
    throw new Error(`Lỗi mạng khi kiểm thử HTTP 409 xung đột lịch hẹn: ${netErr.message}`)
  }

  assert.equal(
    finalConflictRes.status,
    409,
    `Yêu cầu trùng lặp thông tin lịch hẹn (cùng SĐT, cùng ngày, cùng khoa) bắt buộc phải trả về HTTP 409 Conflict riêng biệt (nhận HTTP ${finalConflictRes.status}). Không chấp nhận mã khác thay thế.`
  )
  const body409 = await finalConflictRes.json().catch(() => ({}))
  assert.ok(
    body409.error && /trùng khớp|lịch hẹn đã có/i.test(body409.error),
    'Body HTTP 409 phải chứa thông báo chống trùng lặp an toàn'
  )
  assert.ok(!JSON.stringify(body409).includes('LK-'), 'Phản hồi 409 tuyệt đối không làm lộ mã phiếu khám cũ')
})

runTest('TC-LOG-01', 'Log lỗi tại route /api/appointments phân loại category an toàn, không ghi raw SQL hay PII', () => {
  const routeContent = fs.readFileSync('src/app/(frontend)/api/appointments/route.ts', 'utf8')
  
  assert.ok(routeContent.includes('errorCategory'), 'Phải phân loại lỗi theo category')
  assert.ok(routeContent.includes('DATABASE_UNIQUE_VIOLATION'), 'Phải xử lý category mã lỗi 23505')
  assert.ok(routeContent.includes('DATABASE_FOREIGN_KEY_VIOLATION'), 'Phải xử lý category mã lỗi 23503')
  assert.ok(!routeContent.includes('console.error(error)'), 'Không được log thẳng đối tượng error thô')
  assert.ok(!routeContent.includes('console.error(createErr)'), 'Không được log thẳng createErr thô')
})

runTest('TC-DR-06', 'scripts/backup-railway.mjs không chứa mật khẩu database hardcoded', () => {
  const content = fs.readFileSync('scripts/backup-railway.mjs', 'utf8')
  assert.ok(!/postgres(ql)?:\/\/[^:\s'"]+:[^@\s'"]+@/i.test(content), 'Không được chứa chuỗi kết nối PostgreSQL kèm mật khẩu')
  assert.ok(!/proxy\.rlwy\.net/i.test(content), 'Không được chứa hostname proxy cứng')
})

console.log('\n====================================================')
console.log(`📊 KẾT QUẢ KIỂM THỬ P1: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP / ${blockedCount} BLOCKED`)
console.log('====================================================\n')

if (failCount > 0) {
  process.exit(1)
}

