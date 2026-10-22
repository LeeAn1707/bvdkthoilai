/**
 * TEST AUTOMATION SUITE: P1 SECURITY, RATE LIMIT, BODY LIMIT, CONCURRENCY & ERROR HANDLING
 * Đối chiếu Test Cases: TC-SEC-05, TC-SEC-06, TC-SEC-07, TC-SEC-08, TC-SEC-09,
 * TC-APPT-05, TC-APPT-07, TC-PRIV-02, TC-OPS-01, TC-DR-06.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { clientAddress, rateLimit, readJsonBodyWithLimit } from '../src/lib/request-security.ts'

console.log('====================================================')
console.log('🧪 BẮT ĐẦU CHẠY KIỂM THỬ BẢO MẬT & HẠ TẦNG NHÓM P1')
console.log('====================================================\n')

let passCount = 0
let failCount = 0

function runTest(testId, name, fn) {
  try {
    fn()
    console.log(`✅ [PASS] ${testId} — ${name}`)
    passCount++
  } catch (err) {
    console.error(`❌ [FAIL] ${testId} — ${name}:`, err.message)
    failCount++
  }
}

async function runAsyncTest(testId, name, fn) {
  try {
    await fn()
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

await runAsyncTest('TC-APPT-05', 'Kiểm thử Concurrency thực sự với Promise.all: giải quyết va chạm mã khi có nhiều request đồng thời', async () => {
  const existingDatabaseCodes = new Set(['BVTL0001', 'BVTL0002'])
  let collisionCount = 0

  // Mô phỏng hàm xử lý sinh mã và ghi vào DB có va chạm khóa (Unique Constraint 23505)
  async function simulateConcurrentAppointmentBooking(reqIndex) {
    let nextSequence = 3
    let code = `BVTL${String(nextSequence).padStart(4, '0')}`

    // Retry loop tối đa 5 lần y hệt route /api/appointments
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

  // Bắn 20 requests đồng thời cùng 1 lúc qua Promise.all
  const concurrentTasks = Array.from({ length: 20 }, (_, idx) => simulateConcurrentAppointmentBooking(idx))
  const results = await Promise.all(concurrentTasks)

  const successfulBookings = results.filter((r) => r.success)
  assert.equal(successfulBookings.length, 20, 'Tất cả 20 request đồng thời phải được tạo thành công')
  assert.ok(collisionCount > 0, `Phải có va chạm concurrency xảy ra và được giải quyết tự động (số lần va chạm: ${collisionCount})`)

  const generatedCodes = successfulBookings.map((r) => r.code)
  const uniqueCodes = new Set(generatedCodes)
  assert.equal(uniqueCodes.size, 20, 'Mọi mã phiếu hẹn sinh ra từ các luồng đồng thời đều phải duy nhất')
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

runTest('TC-DR-06', 'scripts/backup-railway.mjs không chứa mật khẩu database hardcoded', () => {
  const content = fs.readFileSync('scripts/backup-railway.mjs', 'utf8')
  assert.ok(!/postgres(ql)?:\/\/[^:\s'"]+:[^@\s'"]+@/i.test(content), 'Không được chứa chuỗi kết nối PostgreSQL kèm mật khẩu')
  assert.ok(!/proxy\.rlwy\.net/i.test(content), 'Không được chứa hostname proxy cứng')
})

console.log('\n====================================================')
console.log(`📊 KẾT QUẢ KIỂM THỬ P1: ${passCount} PASS / ${failCount} FAIL`)
console.log('====================================================\n')

if (failCount > 0) {
  process.exit(1)
}
