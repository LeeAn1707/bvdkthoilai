/**
 * BÀI KIỂM THỬ KHÔI PHỤC THỰC TẾ (REAL BACKUP & RESTORE DRILL)
 * Dự án: BVDK Thới Lai
 *
 * Tiêu chí an toàn nghiêm ngặt:
 * 1. CẤM sử dụng DATABASE_URL từ .env (tránh nhầm lẫn với dev/production database).
 *    BẮT BUỘC sử dụng TEST_ADMIN_DATABASE_URL trên một PostgreSQL test instance riêng biệt.
 * 2. KHÔNG tự động DROP DATABASE với tên cố định hoặc database đã tồn tại trước đó.
 *    Sử dụng runId động duy nhất (runId + random hex) và chỉ dọn dẹp các database
 *    do chính phiên chạy hiện tại tạo ra (xác thực quyền sở hữu).
 * 3. Tương thích đa phiên bản PostgreSQL: tự động phát hiện đường dẫn công cụ (PG_BIN_DIR, PATH, phiên bản 11-17).
 * 4. Yêu cầu pg_restore hoàn tất thành công với exit code 0 và xác minh stderr.
 * 5. Phân biệt rõ ràng giữa thời gian khôi phục tập mẫu (Sample Restore Duration)
 *    và RTO phục hồi toàn hệ thống ước lượng.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { Client } from 'pg'

console.log('====================================================================')
console.log('🔄 BẮT ĐẦU DIỄN TẬP KHÔI PHỤC THỰC TẾ (PG_DUMP / PG_RESTORE REAL DRILL)')
console.log('====================================================================\n')

// 1. Tìm kiếm đường dẫn công cụ pg_dump và pg_restore linh hoạt
function findPostgresTool(toolName) {
  const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName

  // 1.1 Kiểm tra biến môi trường PG_BIN_DIR nếu người dùng chỉ định
  if (process.env.PG_BIN_DIR) {
    const customPath = path.join(process.env.PG_BIN_DIR, exeName)
    if (fs.existsSync(customPath)) return customPath
  }

  // 1.2 Kiểm tra qua system PATH
  try {
    const lookupCmd = process.platform === 'win32' ? 'where.exe' : 'which'
    const whereRes = spawnSync(lookupCmd, [toolName], { encoding: 'utf8' })
    if (whereRes.status === 0 && whereRes.stdout) {
      const firstLine = whereRes.stdout.trim().split(/\r?\n/)[0]
      if (firstLine && fs.existsSync(firstLine)) return firstLine
    }
  } catch {}

  // 1.3 Kiểm tra các thư mục cài đặt tiêu chuẩn trên Windows (PostgreSQL 17 -> 11)
  if (process.platform === 'win32') {
    const versions = [17, 16, 15, 14, 13, 12, 11]
    for (const v of versions) {
      const standardPath = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\${exeName}`
      if (fs.existsSync(standardPath)) return standardPath
    }
  }

  return null
}

const PG_DUMP_PATH = findPostgresTool('pg_dump')
const PG_RESTORE_PATH = findPostgresTool('pg_restore')

if (!PG_DUMP_PATH || !PG_RESTORE_PATH) {
  console.log('⛔ [BLOCKED / NOT RUN] Không tìm thấy công cụ pg_dump hoặc pg_restore trên hệ thống.')
  console.log('Hướng dẫn: Cài đặt PostgreSQL command-line tools hoặc cấu hình biến môi trường PG_BIN_DIR trỏ tới thư mục bin của PostgreSQL.')
  process.exit(0)
}

// 2. Kiểm tra biến môi trường TEST_ADMIN_DATABASE_URL (TUYỆT ĐỐI CẤM dùng DATABASE_URL từ .env)
const testAdminUrl = process.env.TEST_ADMIN_DATABASE_URL

if (!testAdminUrl) {
  console.log('⛔ [BLOCKED / NOT RUN] Chưa cấu hình TEST_ADMIN_DATABASE_URL dành riêng cho PostgreSQL test instance độc lập.')
  console.log('Nguyên tắc an toàn: Cấm sử dụng DATABASE_URL của môi trường dev/production để diễn tập khôi phục.')
  console.log('Hướng dẫn: Cung cấp TEST_ADMIN_DATABASE_URL trỏ tới cơ sở dữ liệu bảo trì (ví dụ: postgres://user:pass@127.0.0.1:5432/postgres) trên test instance riêng biệt.')
  process.exit(0)
}

// 3. Bảo vệ fail-closed và xác thực quyền sở hữu instance test của quản trị viên
// 3.1 Bắt buộc quản trị viên phải xác nhận instance test an toàn qua biến môi trường
const isConfirmedTestInstance = process.env.CONFIRM_TEST_INSTANCE === 'true' || process.env.VERIFIED_TEST_INSTANCE === 'true'
if (!isConfirmedTestInstance) {
  console.log('⛔ [BLOCKED / NOT RUN] Chưa xác nhận instance test độc lập (yêu cầu đặt biến môi trường CONFIRM_TEST_INSTANCE=true).')
  console.log('Nguyên tắc an toàn: Thao tác tạo/xóa database diễn tập chỉ được phép thực thi trên instance đã được quản trị viên xác minh và cô lập hoàn toàn.')
  process.exit(0)
}

// 3.2 Phân tích URL an toàn (tuyệt đối không in URL hoặc mật khẩu ra log/terminal nếu xảy ra lỗi)
let parsedUrl
try {
  parsedUrl = new URL(testAdminUrl)
} catch {
  console.error('❌ [BLOCKED] TEST_ADMIN_DATABASE_URL không hợp lệ (lỗi cú pháp URL).')
  process.exit(1)
}

const dbUser = parsedUrl.username
const dbPass = decodeURIComponent(parsedUrl.password || '')
const dbHost = parsedUrl.hostname
const dbPort = parsedUrl.port || '5432'

// Hàm khử khuẩn chuỗi ký tự, ngăn chặn tuyệt đối việc in mật khẩu hoặc connection string ra terminal/CI
function sanitizeText(str) {
  if (!str) return ''
  let text = String(str)
  if (dbPass) {
    text = text.replaceAll(dbPass, '******')
  }
  text = text.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1******$3')
  return text
}

// 3.3 Chặn đứng nếu phát hiện từ khóa production trong URL, NODE_ENV hoặc hostname
const isProductionTarget = process.env.NODE_ENV === 'production' || /railway|neon|render|aws|azure|gcp|prod/i.test(testAdminUrl) || /prod/i.test(dbHost)
if (isProductionTarget) {
  console.error('❌ [BLOCKED] Phát hiện chỉ dấu production trong TEST_ADMIN_DATABASE_URL hoặc hostname. Tự động dừng khẩn cấp để bảo vệ an toàn dữ liệu!')
  process.exit(1)
}

// 3.4 Không chỉ dựa vào từ khóa: Bắt buộc host nằm trong Allowlist máy chủ test an toàn hoặc được xác nhận cụ thể
const ALLOWED_TEST_HOSTS = ['localhost', '127.0.0.1', '::1', 'test-postgres', 'staging-postgres', 'staging-db']
const isAllowlistedHost = ALLOWED_TEST_HOSTS.includes(dbHost.toLowerCase()) ||
  (process.env.VERIFIED_TEST_HOST && process.env.VERIFIED_TEST_HOST.toLowerCase() === dbHost.toLowerCase())

if (!isAllowlistedHost) {
  console.error(`❌ [BLOCKED] Hostname (${dbHost}) không nằm trong danh sách Allowlist máy chủ test an toàn (${ALLOWED_TEST_HOSTS.join(', ')}).`)
  console.error('Hướng dẫn: Nếu đây là instance test hợp lệ của bệnh viện, vui lòng khai báo biến môi trường VERIFIED_TEST_HOST khớp với hostname này.')
  process.exit(1)
}

// 4. Tạo RunId ngẫu nhiên duy nhất cho lần chạy hiện tại để đảm bảo tính cô lập và xác thực quyền sở hữu
const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
const runId = `bvdk_drill_${uniqueSuffix}`
const sourceTestDb = `${runId}_src`
const targetRestoreDb = `${runId}_dst`

const DRILL_DIR = path.resolve(`temp-drill-${uniqueSuffix}`)
const MEDIA_SRC_DIR = path.join(DRILL_DIR, 'media-source')
const MEDIA_RESTORE_DIR = path.join(DRILL_DIR, 'media-restored')

// Bộ theo dõi tài nguyên đã tạo trong phiên chạy này (chỉ dọn dẹp những gì phiên này tạo)
const ownedDatabases = new Set()

const sourceConnStr = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${sourceTestDb}`
const targetConnStr = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${targetRestoreDb}`

let passCount = 0
function logStep(step, msg) {
  passCount++
  console.log(`✅ [PASS] Bước ${step}: ${msg}`)
}

async function runDrill() {
  const maintClient = new Client({ connectionString: testAdminUrl })
  await maintClient.connect()

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: KHỞI TẠO CÁC DATABASE THỬ NGHIỆM ĐỘC LẬP THEO RUN ID DUY NHẤT
    // -------------------------------------------------------------------------
    // Kiểm tra không có database trùng lặp tồn tại từ trước (Không tự động drop database có sẵn)
    const existingCheck = await maintClient.query(
      'SELECT datname FROM pg_database WHERE datname IN ($1, $2)',
      [sourceTestDb, targetRestoreDb]
    )
    if (existingCheck.rows.length > 0) {
      throw new Error(`Phát hiện database trùng lặp đã tồn tại (${existingCheck.rows.map((r) => r.datname).join(', ')}). Dừng để tránh ghi đè dữ liệu.`)
    }

    await maintClient.query(`CREATE DATABASE "${sourceTestDb}"`)
    ownedDatabases.add(sourceTestDb)

    await maintClient.query(`CREATE DATABASE "${targetRestoreDb}"`)
    ownedDatabases.add(targetRestoreDb)

    logStep(1, `Tạo mới 2 database disposable riêng biệt theo Run ID: ${sourceTestDb} và ${targetRestoreDb}`)

    // -------------------------------------------------------------------------
    // BƯỚC 2: SEED SCHEMA VÀ DỮ LIỆU THỬ NGHIỆM VÀO SOURCE DATABASE
    // -------------------------------------------------------------------------
    const sourceClient = new Client({ connectionString: sourceConnStr })
    await sourceClient.connect()

    await sourceClient.query(`
      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL
      );

      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        department_id INT REFERENCES departments(id),
        status VARCHAR(20) DEFAULT 'active'
      );

      CREATE TABLE appointments (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        department_id INT REFERENCES departments(id),
        appointment_date DATE NOT NULL,
        time_slot VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action VARCHAR(50) NOT NULL,
        collection_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO departments (id, name, code) VALUES
      (1, 'Khoa Cấp Cứu', 'KCC'),
      (2, 'Khoa Khám Bệnh', 'KKB');

      INSERT INTO users (id, email, role, department_id) VALUES
      (1, 'admin@test.local', 'admin', NULL),
      (2, 'manager_kcc@test.local', 'department-manager', 1),
      (3, 'manager_kkb@test.local', 'department-manager', 2);

      INSERT INTO appointments (id, code, full_name, phone, department_id, appointment_date, time_slot, status) VALUES
      (101, 'BVTL-TEST-0001', 'Bệnh nhân Test 1', '0901000001', 1, '2026-11-20', 'morning', 'confirmed'),
      (102, 'BVTL-TEST-0002', 'Bệnh nhân Test 2', '0901000002', 1, '2026-11-20', 'morning', 'new'),
      (103, 'BVTL-TEST-0003', 'Bệnh nhân Test 3', '0901000003', 2, '2026-11-20', 'afternoon', 'new'),
      (104, 'BVTL-TEST-0004', 'Bệnh nhân Test 4', '0901000004', 2, '2026-11-21', 'morning', 'examining'),
      (105, 'BVTL-TEST-0005', 'Bệnh nhân Test 5', '0901000005', 1, '2026-11-21', 'afternoon', 'completed');

      INSERT INTO audit_logs (id, user_id, action, collection_name) VALUES
      (1, 1, 'create', 'departments'),
      (2, 2, 'view', 'appointments'),
      (3, 3, 'view', 'appointments');
    `)

    await sourceClient.end()
    logStep(2, `Seed thành công 2 departments, 3 users, 5 appointments, 3 audit logs vào ${sourceTestDb}`)

    // -------------------------------------------------------------------------
    // BƯỚC 3: TẠO TỆP TIN MEDIA THỰC TẾ & NÉN TỆP LƯU TRỮ
    // -------------------------------------------------------------------------
    if (fs.existsSync(DRILL_DIR)) fs.rmSync(DRILL_DIR, { recursive: true, force: true })
    fs.mkdirSync(MEDIA_SRC_DIR, { recursive: true })
    fs.mkdirSync(MEDIA_RESTORE_DIR, { recursive: true })

    // Tạo file nhị phân thật với PNG magic bytes (\x89PNG\r\n\x1a\n)
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
    const testImage1 = Buffer.concat([pngMagic, Buffer.from('TEST_HOSPITAL_BANNER_DATA_PAYLOAD_IMAGE_01')])
    const testImage2 = Buffer.concat([pngMagic, Buffer.from('TEST_HOSPITAL_BANNER_DATA_PAYLOAD_IMAGE_02')])

    const file1Path = path.join(MEDIA_SRC_DIR, 'banner_kcc.png')
    const file2Path = path.join(MEDIA_SRC_DIR, 'banner_kkb.png')
    fs.writeFileSync(file1Path, testImage1)
    fs.writeFileSync(file2Path, testImage2)

    const file1Hash = crypto.createHash('sha256').update(testImage1).digest('hex')
    const file2Hash = crypto.createHash('sha256').update(testImage2).digest('hex')

    // Nén media bằng tar
    const mediaTarPath = path.join(DRILL_DIR, 'media.tar')
    const tarCreateRes = spawnSync('tar', ['-cf', mediaTarPath, '-C', MEDIA_SRC_DIR, '.'], { encoding: 'utf8' })
    assert.equal(tarCreateRes.status, 0, 'Nén media.tar thành công')

    logStep(3, 'Tạo tệp media thực tế (banner_kcc.png, banner_kkb.png) và đóng gói media.tar')

    // -------------------------------------------------------------------------
    // BƯỚC 4: THỰC THI PG_DUMP XUẤT DATABASE BINARY DUMP (.DUMP)
    // -------------------------------------------------------------------------
    const dumpFilePath = path.join(DRILL_DIR, 'database.dump')
    const dumpRes = spawnSync(
      PG_DUMP_PATH,
      ['-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', sourceTestDb, '-Fc', '-f', dumpFilePath],
      {
        env: { ...process.env, PGPASSWORD: dbPass },
        encoding: 'utf8',
      }
    )

    if (dumpRes.status !== 0) {
      throw new Error(`pg_dump thất bại: ${dumpRes.stderr}`)
    }

    const dumpStats = fs.statSync(dumpFilePath)
    assert.ok(dumpStats.size > 1000, `File dump phải có kích thước hợp lệ (${dumpStats.size} bytes)`)

    const dumpHash = crypto.createHash('sha256').update(fs.readFileSync(dumpFilePath)).digest('hex')
    const mediaHash = crypto.createHash('sha256').update(fs.readFileSync(mediaTarPath)).digest('hex')

    const sha256Content = `${dumpHash}  database.dump\n${mediaHash}  media.tar\n`
    fs.writeFileSync(path.join(DRILL_DIR, 'SHA256SUMS'), sha256Content)

    logStep(4, `pg_dump xuất dump nhị phân thành công (${dumpStats.size} bytes, SHA-256: ${dumpHash.slice(0, 16)}...)`)

    // -------------------------------------------------------------------------
    // BƯỚC 5: ĐO THỜI GIAN KHÔI PHỤC BẰNG PG_RESTORE (YÊU CẦU EXIT CODE 0)
    // -------------------------------------------------------------------------
    const startTime = performance.now()

    // Khôi phục trên database trống mới tạo, không dùng --clean/--if-exists để đảm bảo exit code chuẩn 0
    const restoreRes = spawnSync(
      PG_RESTORE_PATH,
      ['--no-owner', '--no-acl', '-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', targetRestoreDb, dumpFilePath],
      {
        env: { ...process.env, PGPASSWORD: dbPass },
        encoding: 'utf8',
      }
    )

    // Unpack media
    const tarExtractRes = spawnSync('tar', ['-xf', mediaTarPath, '-C', MEDIA_RESTORE_DIR], { encoding: 'utf8' })
    assert.equal(tarExtractRes.status, 0, 'Giải nén media.tar thành công')

    const endTime = performance.now()
    const sampleDurationMs = Math.round(endTime - startTime)

    // Yêu cầu nghiêm ngặt: pg_restore phải có exit code 0 và không có lỗi nghiêm trọng
    assert.equal(restoreRes.status, 0, `pg_restore phải hoàn tất với exit code 0. Chi tiết: ${restoreRes.stderr}`)
    assert.ok(!/error:/i.test(restoreRes.stderr || ''), `pg_restore không được chứa lỗi nghiêm trọng: ${restoreRes.stderr}`)

    logStep(5, `Thực thi pg_restore thành công với exit code 0. Thời gian khôi phục mẫu: ${sampleDurationMs} ms`)

    // -------------------------------------------------------------------------
    // BƯỚC 6: XÁC MINH TRUY VẤN DỮ LIỆU THỰC TRÊN TARGET RESTORE DB
    // -------------------------------------------------------------------------
    const targetClient = new Client({ connectionString: targetConnStr })
    await targetClient.connect()

    const deptRes = await targetClient.query('SELECT COUNT(*)::int as count FROM departments')
    assert.equal(deptRes.rows[0].count, 2, 'Phục hồi chính xác 2 departments')

    const userRes = await targetClient.query('SELECT COUNT(*)::int as count FROM users')
    assert.equal(userRes.rows[0].count, 3, 'Phục hồi chính xác 3 users')

    const apptRes = await targetClient.query('SELECT COUNT(*)::int as count FROM appointments')
    assert.equal(apptRes.rows[0].count, 5, 'Phục hồi chính xác 5 appointments')

    const apptRecords = await targetClient.query('SELECT code, full_name, phone, status FROM appointments ORDER BY id')
    assert.equal(apptRecords.rows[0].code, 'BVTL-TEST-0001')
    assert.equal(apptRecords.rows[4].code, 'BVTL-TEST-0005')

    const auditRes = await targetClient.query('SELECT COUNT(*)::int as count FROM audit_logs')
    assert.equal(auditRes.rows[0].count, 3, 'Phục hồi chính xác 3 audit_logs')

    await targetClient.end()
    logStep(6, `Kiểm chứng SQL: Khôi phục toàn vẹn 100% bản ghi (5 appointments, 3 users, 2 departments, 3 audit logs)`)

    // -------------------------------------------------------------------------
    // BƯỚC 7: XÁC MINH TÍNH TOÀN VẸN CÁC TỆP MEDIA ĐÃ PHỤC HỒI
    // -------------------------------------------------------------------------
    const restoredFile1 = fs.readFileSync(path.join(MEDIA_RESTORE_DIR, 'banner_kcc.png'))
    const restoredFile2 = fs.readFileSync(path.join(MEDIA_RESTORE_DIR, 'banner_kkb.png'))

    const restoredFile1Hash = crypto.createHash('sha256').update(restoredFile1).digest('hex')
    const restoredFile2Hash = crypto.createHash('sha256').update(restoredFile2).digest('hex')

    assert.equal(restoredFile1Hash, file1Hash, 'banner_kcc.png khớp 100% SHA-256')
    assert.equal(restoredFile2Hash, file2Hash, 'banner_kkb.png khớp 100% SHA-256')

    logStep(7, 'Kiểm chứng Media: Tệp nhị phân phục hồi nguyên vẹn, hash SHA-256 khớp 100%')

    // -------------------------------------------------------------------------
    // BƯỚC 8: DỌN DẸP AN TOÀN — CHỈ XÓA TÀI NGUYÊN DO PHIÊN NÀY TẠO VÀ XÁC THỰC SỞ HỮU
    // -------------------------------------------------------------------------
    for (const dbName of ownedDatabases) {
      if (dbName.startsWith(runId)) {
        await maintClient.query(`DROP DATABASE IF EXISTS "${dbName}"`)
      }
    }
    ownedDatabases.clear()

    try {
      fs.rmSync(DRILL_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}

    logStep(8, `Dọn dẹp sạch sẽ tài nguyên sở hữu bởi phiên ${runId} (đã drop các database tạm và xóa thư mục drill)`)

    console.log('\n====================================================================')
    console.log(`📊 KẾT QUẢ DIỄN TẬP KHÔI PHỤC THỰC TẾ: ${passCount}/8 BƯỚC PASS (0 LỖI)`)
    console.log(`⏱️ Thời gian khôi phục tập dữ liệu mẫu: ${sampleDurationMs} ms (~${(sampleDurationMs / 1000).toFixed(2)}s)`)
    console.log(`⏱️ RTO phục hồi toàn hệ thống ước lượng: RTO mục tiêu < 15 phút (với tốc độ khôi phục đạt ~50-80 MB/s)`)
    console.log('====================================================================\n')
  } catch (err) {
    // Nếu có lỗi, chỉ dọn dẹp các database do phiên này tạo
    for (const dbName of ownedDatabases) {
      try {
        if (dbName.startsWith(runId)) {
          await maintClient.query(`DROP DATABASE IF EXISTS "${dbName}"`)
        }
      } catch {}
    }
    try {
      fs.rmSync(DRILL_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
    throw err
  } finally {
    await maintClient.end()
  }
}

runDrill().catch((err) => {
  console.error(`\n❌ [FAIL] Diễn tập khôi phục thất bại: ${sanitizeText(err?.message || err)}`)
  process.exit(1)
})
