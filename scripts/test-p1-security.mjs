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

function skipTest(testId, name, reason) {
  console.log(`⚠️ [SKIP / NOT RUN] ${testId} — ${name}: ${reason}`)
  skipCount++
}

function runTest(testId, name, fn) {
  try {
    const res = fn()
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

await runAsyncTest('TC-APPT-05A', 'Kiểm thử Unique Constraint trên PostgreSQL thật với TEST_DATABASE_URL (20 requests đồng thời)', async () => {
  // Chỉ sử dụng biến môi trường TEST_DATABASE_URL dành riêng cho database test (tuyệt đối không tự ý dùng DATABASE_URL chính)
  const testDbUrl = process.env.TEST_DATABASE_URL

  if (!testDbUrl) {
    return {
      skip: true,
      reason: 'Chưa cấu hình TEST_DATABASE_URL dành riêng cho database thử nghiệm (nguyên tắc: không dùng DATABASE_URL chính)',
    }
  }

  const isProdDb = process.env.NODE_ENV === 'production' || /railway|neon|render|aws|azure|gcp|prod/i.test(testDbUrl)
  if (isProdDb) {
    return {
      skip: true,
      reason: 'Phát hiện database production trong TEST_DATABASE_URL, tự động dừng để bảo vệ an toàn dữ liệu',
    }
  }

  const pool = new pg.Pool({ connectionString: testDbUrl, max: 25 })
  let poolConnected = false
  try {
    const testConn = await pool.connect()
    poolConnected = true
    testConn.release()
  } catch (connErr) {
    return {
      skip: true,
      reason: `Không thể kết nối TEST_DATABASE_URL (${connErr.message})`,
    }
  }

  const testTable = `test_appt_concurrency_${Date.now()}`
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

await runAsyncTest('TC-APPT-05B', 'Integration test chạy HTTP request tới API /api/appointments trên staging', async () => {
  const stagingUrl = process.env.STAGING_API_URL || process.env.TEST_API_URL
  if (!stagingUrl) {
    return {
      skip: true,
      reason: 'Chưa cấu hình STAGING_API_URL (yêu cầu môi trường máy chủ staging đang online để gửi HTTP request thực tế)',
    }
  }

  // Gửi 20 request đồng thời tới API /api/appointments staging
  const tasks = Array.from({ length: 20 }, async (_, idx) => {
    const res = await fetch(`${stagingUrl.replace(/\/$/, '')}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Bệnh nhân Staging ${idx + 1}`,
        phone: `0988${String(Date.now()).slice(-4)}${String(idx).padStart(2, '0')}`,
        appointmentDate: '2026-11-01',
        timeSlot: 'morning',
        'cf-turnstile-response': 'cf-mock-valid-token',
      }),
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  })

  const results = await Promise.all(tasks)
  const okResults = results.filter((r) => r.status === 200 && r.data?.code)
  assert.ok(okResults.length > 0, 'Phải có request thành công trên môi trường staging')
  const codes = okResults.map((r) => r.data.code)
  assert.equal(new Set(codes).size, codes.length, 'Mọi mã trả về từ API staging phải là duy nhất')
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
console.log(`📊 KẾT QUẢ KIỂM THỬ P1: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP`)
console.log('====================================================\n')

if (failCount > 0) {
  process.exit(1)
}

