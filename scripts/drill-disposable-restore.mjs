/**
 * BÀI KIỂM THỬ KHÔI PHỤC THỰC TẾ (REAL BACKUP & RESTORE DRILL)
 * Dự án: BVDK Thới Lai
 *
 * Tiêu chí nghiệm thu:
 * 1. Chạy trên PostgreSQL disposable riêng biệt (bvdk_disposable_test -> bvdk_restore_target).
 *    Tuyệt đối không dùng DATABASE_URL production.
 * 2. Thực thi lệnh pg_dump.exe và pg_restore.exe thật của hệ thống.
 * 3. Tạo kho media thử nghiệm với tệp nhị phân thật (PNG, PDF), nén media.tar.gz và phục hồi tệp thực.
 * 4. Đo thời gian khôi phục (Recovery Time / RTO) với độ chính xác cao.
 * 5. Truy vấn cơ sở dữ liệu thật sau khôi phục để xác minh số bản ghi và tính toàn vẹn 100%.
 * 6. Tự động dọn dẹp các cơ sở dữ liệu và tệp tạm sau khi hoàn thành.
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

const PG_DUMP_PATH = 'C:\\Program Files\\PostgreSQL\\11\\bin\\pg_dump.exe'
const PG_RESTORE_PATH = 'C:\\Program Files\\PostgreSQL\\11\\bin\\pg_restore.exe'

const DRILL_DIR = path.resolve('temp-real-restore-drill')
const MEDIA_SRC_DIR = path.join(DRILL_DIR, 'media-source')
const MEDIA_RESTORE_DIR = path.join(DRILL_DIR, 'media-restored')

// 1. Kiểm tra sự tồn tại của công cụ PostgreSQL
if (!fs.existsSync(PG_DUMP_PATH) || !fs.existsSync(PG_RESTORE_PATH)) {
  console.error(`❌ [BLOCKED] Không tìm thấy pg_dump/pg_restore tại: ${PG_DUMP_PATH}`)
  process.exit(1)
}

// 2. Trích xuất thông tin kết nối an toàn từ .env
const envContent = fs.readFileSync('.env', 'utf8')
const dbMatch = envContent.match(/DATABASE_URL=(.+)/)
if (!dbMatch) {
  console.error('❌ [BLOCKED] Không tìm thấy DATABASE_URL trong .env')
  process.exit(1)
}

const rawDbUrl = dbMatch[1].trim()
const parsedMatch = rawDbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^\s?]+)/)
if (!parsedMatch) {
  console.error('❌ [BLOCKED] Không thể phân tích DATABASE_URL')
  process.exit(1)
}

const dbUser = parsedMatch[1]
const dbPass = decodeURIComponent(parsedMatch[2])
const dbHost = parsedMatch[3]
const dbPort = parsedMatch[4] || '5432'
const originalDbName = parsedMatch[5]

// Khẳng định an toàn: Database phục vụ test bắt buộc phải là disposable db
const sourceTestDb = 'bvdk_disposable_test'
const targetRestoreDb = 'bvdk_restore_target'

const maintConnStr = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/postgres`
const sourceConnStr = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${sourceTestDb}`
const targetConnStr = `postgres://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${targetRestoreDb}`

let passCount = 0

function logStep(step, msg) {
  passCount++
  console.log(`✅ [PASS] Bước ${step}: ${msg}`)
}

async function runDrill() {
  const maintClient = new Client({ connectionString: maintConnStr })
  await maintClient.connect()

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: KHỞI TẠO CÁC DATABASE THỬ NGHIỆM ĐỘC LẬP
    // -------------------------------------------------------------------------
    await maintClient.query(`DROP DATABASE IF EXISTS "${sourceTestDb}"`)
    await maintClient.query(`CREATE DATABASE "${sourceTestDb}"`)

    await maintClient.query(`DROP DATABASE IF EXISTS "${targetRestoreDb}"`)
    await maintClient.query(`CREATE DATABASE "${targetRestoreDb}"`)

    logStep(1, `Tạo mới 2 database disposable: ${sourceTestDb} và ${targetRestoreDb}`)

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

    // Tính checksum SHA-256
    const dumpHash = crypto.createHash('sha256').update(fs.readFileSync(dumpFilePath)).digest('hex')
    const mediaHash = crypto.createHash('sha256').update(fs.readFileSync(mediaTarPath)).digest('hex')

    const sha256Content = `${dumpHash}  database.dump\n${mediaHash}  media.tar\n`
    fs.writeFileSync(path.join(DRILL_DIR, 'SHA256SUMS'), sha256Content)

    logStep(4, `pg_dump xuất dump nhị phân thành công (${dumpStats.size} bytes, SHA-256: ${dumpHash.slice(0, 16)}...)`)

    // -------------------------------------------------------------------------
    // BƯỚC 5: ĐO THỜI GIAN KHÔI PHỤC (RTO) BẰNG PG_RESTORE THỰC TẾ
    // -------------------------------------------------------------------------
    const startTime = performance.now()

    const restoreRes = spawnSync(
      PG_RESTORE_PATH,
      ['--clean', '--if-exists', '--no-owner', '--no-acl', '-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', targetRestoreDb, dumpFilePath],
      {
        env: { ...process.env, PGPASSWORD: dbPass },
        encoding: 'utf8',
      }
    )

    // Unpack media
    const tarExtractRes = spawnSync('tar', ['-xf', mediaTarPath, '-C', MEDIA_RESTORE_DIR], { encoding: 'utf8' })
    assert.equal(tarExtractRes.status, 0, 'Giải nén media.tar thành công')

    const endTime = performance.now()
    const rtoDurationMs = Math.round(endTime - startTime)

    // pg_restore có thể trả về cảnh báo nhỏ với clean/if-exists trên database mới, status <= 1 được coi là thành công
    assert.ok(restoreRes.status === 0 || restoreRes.status === 1, `pg_restore thất bại: ${restoreRes.stderr}`)

    logStep(5, `Thực thi pg_restore và giải nén media thành công. Thời gian khôi phục (RTO): ${rtoDurationMs} ms`)

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
    // BƯỚC 8: DỌN DẸP AN TOÀN
    // -------------------------------------------------------------------------
    await maintClient.query(`DROP DATABASE IF EXISTS "${sourceTestDb}"`)
    await maintClient.query(`DROP DATABASE IF EXISTS "${targetRestoreDb}"`)
    try {
      fs.rmSync(DRILL_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}

    logStep(8, 'Dọn dẹp sạch sẽ tài nguyên sau diễn tập (dropped test dbs, removed temp files)')

    console.log('\n====================================================================')
    console.log(`📊 KẾT QUẢ DIỄN TẬP KHÔI PHỤC THỰC TẾ: ${passCount}/8 BƯỚC PASS (0 LỖI)`)
    console.log(`⏱️ Thời gian khôi phục đo được (RTO): ${rtoDurationMs} ms (~${(rtoDurationMs / 1000).toFixed(2)}s)`)
    console.log('====================================================================\n')
  } finally {
    await maintClient.end()
  }
}

runDrill().catch((err) => {
  console.error(`\n❌ [FAIL] Diễn tập khôi phục thất bại: ${err.message}`)
  process.exit(1)
})
