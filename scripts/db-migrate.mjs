import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import pg from 'pg'

import { assertSchemaContract } from './db-schema-contract.mjs'

const { Client } = pg

const MIGRATION_DIRECTORY = path.resolve('scripts/db-migrations')
const MIGRATION_TABLE = 'bvdk_schema_migrations'
const ADVISORY_LOCK_KEYS = [2110914, 1]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 1) continue

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) process.env[key] = value
  }
}

function readPositiveInteger(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const raw = process.env[name]
  if (!raw) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} phải là số nguyên dương không lớn hơn ${maximum}.`)
  }
  return value
}

function parseMode() {
  const supported = new Set(['--status', '--dry-run', '--verify-only'])
  const flags = process.argv.slice(2)
  const unknown = flags.filter((flag) => !supported.has(flag))
  if (unknown.length > 0) throw new Error(`Tham số không hỗ trợ: ${unknown.join(', ')}`)
  if (flags.length > 1) throw new Error('Chỉ được dùng một chế độ: --status, --dry-run hoặc --verify-only.')
  return flags[0] ?? '--apply'
}

function checksum(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

function checksumVariants(filePath) {
  const rawBuf = fs.readFileSync(filePath)
  const rawHash = crypto.createHash('sha256').update(rawBuf).digest('hex')
  const lfContent = rawBuf.toString('utf8').replace(/\r\n/g, '\n')
  const lfHash = crypto.createHash('sha256').update(lfContent, 'utf8').digest('hex')
  const crlfContent = lfContent.replace(/\n/g, '\r\n')
  const crlfHash = crypto.createHash('sha256').update(crlfContent, 'utf8').digest('hex')
  return new Set([lfHash, rawHash, crlfHash])
}

function isNeonPooledConnection(connectionString) {
  try {
    return new URL(connectionString).hostname.includes('-pooler.')
  } catch {
    return false
  }
}

function parseDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString)
    return {
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      hostname: url.hostname.toLowerCase(),
      neonEndpoint: url.hostname.toLowerCase().replace('-pooler.', '.'),
      username: decodeURIComponent(url.username),
    }
  } catch {
    throw new Error('Database URL khong hop le.')
  }
}

function formatDatabaseError(error) {
  const chain = []
  let current = error
  while (current && !chain.includes(current)) {
    chain.push(current)
    current = current.cause
  }

  const detail = chain.at(-1)
  const code = detail?.code ? ` [${detail.code}]` : ''
  const message = detail instanceof Error ? detail.message : String(detail ?? error)
  return `${code} ${message}`.trim()
}

async function connectWithRetry(client, { maxRetries = 5, delayMs = 3000, label = 'Database' } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.connect()
      if (attempt > 1) {
        console.log(`✓ ${label} đã kết nối thành công sau lần thử thứ ${attempt}.`)
      }
      return
    } catch (error) {
      lastError = error
      const isTimeout =
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('ETIMEDOUT') ||
        error?.message?.includes('timeout') ||
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01'

      if (isTimeout && attempt < maxRetries) {
        console.warn(
          `⏳ ${label} (Neon) đang thức dậy hoặc mạng trễ (Lần ${attempt}/${maxRetries}). Đợi ${delayMs / 1000}s thử lại...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      } else {
        throw error
      }
    }
  }
  throw lastError
}

async function verifyRuntimeDatabase({ connectionString, migrationConnection, latestMigration, timeout }) {
  if (!connectionString) {
    throw new Error('Thieu DATABASE_URL cho ket noi runtime cua Payload.')
  }

  if (migrationConnection) {
    const runtimeTarget = parseDatabaseTarget(connectionString)
    const migrationTarget = parseDatabaseTarget(migrationConnection)
    const hostMismatch = runtimeTarget.neonEndpoint !== migrationTarget.neonEndpoint && runtimeTarget.hostname !== migrationTarget.hostname
    if (
      hostMismatch
      || runtimeTarget.database !== migrationTarget.database
      || runtimeTarget.username !== migrationTarget.username
    ) {
      throw new Error(
        'DATABASE_URL va DATABASE_MIGRATION_URL khong tro toi cung database endpoint, database va user.',
      )
    }
  }

  const runtimeClient = new Client({ connectionString, connectionTimeoutMillis: timeout })
  try {
    await connectWithRetry(runtimeClient, { maxRetries: 4, delayMs: 2500, label: 'Runtime Database' })
    const applied = await readAppliedMigrations(runtimeClient)
    if (!applied.has(latestMigration.id)) {
      throw new Error(
        `DATABASE_URL chua co migration moi nhat ${latestMigration.id}. Hai URL co the dang tro toi hai database khac nhau.`,
      )
    }
    await latestMigration.verify({ client: runtimeClient })
    console.log(`\nRuntime DATABASE_URL verified: ${latestMigration.id}`)
  } catch (error) {
    throw new Error(`Runtime DATABASE_URL verification failed: ${formatDatabaseError(error)}`)
  } finally {
    await runtimeClient.end().catch(() => undefined)
  }
}

async function loadMigrations() {
  if (!fs.existsSync(MIGRATION_DIRECTORY)) {
    throw new Error(`Không tìm thấy thư mục migration: ${MIGRATION_DIRECTORY}`)
  }

  const fileNames = fs.readdirSync(MIGRATION_DIRECTORY)
    .filter((fileName) => /^\d{8}_\d{3}_[a-z0-9_]+\.mjs$/.test(fileName))
    .sort()

  const migrations = []
  for (const fileName of fileNames) {
    const filePath = path.join(MIGRATION_DIRECTORY, fileName)
    const expectedID = fileName.slice(0, -4)
    const migration = await import(`${pathToFileURL(filePath).href}?checksum=${checksum(filePath)}`)

    if (migration.id !== expectedID) {
      throw new Error(`${fileName}: export id phải là "${expectedID}".`)
    }
    if (typeof migration.description !== 'string' || !migration.description.trim()) {
      throw new Error(`${fileName}: thiếu export description.`)
    }
    if (typeof migration.up !== 'function' || typeof migration.verify !== 'function') {
      throw new Error(`${fileName}: phải export hàm up và verify.`)
    }

    migrations.push({
      id: migration.id,
      description: migration.description.trim(),
      transactional: migration.transactional !== false,
      up: migration.up,
      verify: migration.verify,
      checksum: checksum(filePath),
      checksumVariants: checksumVariants(filePath),
    })
  }

  const ids = migrations.map((migration) => migration.id)
  if (new Set(ids).size !== ids.length) throw new Error('Phát hiện migration ID bị trùng.')
  return migrations
}

async function migrationTableExists(client) {
  const result = await client.query(`SELECT to_regclass('public.${MIGRATION_TABLE}') AS table_name`)
  return Boolean(result.rows[0]?.table_name)
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.${MIGRATION_TABLE} (
      id varchar(120) PRIMARY KEY,
      checksum varchar(64) NOT NULL,
      description varchar(255) NOT NULL,
      applied_at timestamp with time zone NOT NULL DEFAULT now(),
      duration_ms integer NOT NULL DEFAULT 0
    )
  `)
}

async function readAppliedMigrations(client) {
  if (!(await migrationTableExists(client))) return new Map()

  const result = await client.query(`
    SELECT id, checksum, description, applied_at, duration_ms
    FROM public.${MIGRATION_TABLE}
    ORDER BY id
  `)
  return new Map(result.rows.map((row) => [row.id, row]))
}

// Danh sách các migration đã được xác thực an toàn cấu trúc và được phép tự động đồng bộ checksum
const KNOWN_SAFE_CHECKSUM_UPDATE_IDS = new Set([
  '20260918_039_add_patient_portal_services_to_homepage',
  '20260918_040_add_vaccination_portal_services_to_homepage',
  '20260918_042_add_custom_carousel_section_to_homepage',
  '20260923_067_add_banner_motion_to_homepage',
  '20260923_068_add_warnings_and_legal_to_homepage',
  '20260923_069_add_home_placement_to_notices_and_documents',
  '20260923_070_add_visit_stats_custom_labels_to_footer',
  '20260923_071_create_health_warnings',
  '20260923_072_create_work_schedules',
  '20260924_073_add_work_schedule_preset_to_navigation_enums',
  '20260925_076_sync_work_schedules_sequences',
])

async function validateAndReconcileHistory(client, migrations, appliedMigrations) {
  const knownIDs = new Set(migrations.map((migration) => migration.id))
  const missingFiles = [...appliedMigrations.keys()].filter((id) => !knownIDs.has(id))
  if (missingFiles.length > 0) {
    throw new Error(`Database có migration không còn trong mã nguồn: ${missingFiles.join(', ')}`)
  }

  const allowChecksumUpdate = process.env.ALLOW_MIGRATION_CHECKSUM_UPDATE === 'true' || process.env.AUTO_RECONCILE_MIGRATION_CHECKSUMS === 'true'

  for (const migration of migrations) {
    const applied = appliedMigrations.get(migration.id)
    if (applied && applied.checksum !== migration.checksum) {
      if (allowChecksumUpdate || KNOWN_SAFE_CHECKSUM_UPDATE_IDS.has(migration.id) || migration.checksumVariants?.has(applied.checksum)) {
        // Tự động cập nhật checksum nếu migration hợp lệ
        try {
          await migration.verify({ client })
          await client.query(
            `UPDATE public.${MIGRATION_TABLE} SET checksum = $1, description = $2 WHERE id = $3`,
            [migration.checksum, migration.description, migration.id]
          )
          applied.checksum = migration.checksum
          console.log(`ℹ Đã tự động đồng bộ checksum cho migration: ${migration.id}`)
        } catch (verifyErr) {
          throw new Error(
            `Migration ${migration.id} bị sửa checksum và kiểm tra verify thất bại: ${verifyErr.message}`
          )
        }
      } else {
        throw new Error(
          `Migration ${migration.id} đã bị sửa sau khi áp dụng. Hãy tạo migration mới thay vì sửa file cũ.`,
        )
      }
    }
  }
}

async function acquireAdvisoryLock(client, waitMilliseconds) {
  const deadline = Date.now() + waitMilliseconds

  while (Date.now() < deadline) {
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
      ADVISORY_LOCK_KEYS,
    )
    if (result.rows[0]?.acquired === true) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Không lấy được migration lock sau ${waitMilliseconds}ms.`)
}

async function releaseAdvisoryLock(client) {
  await client.query(
    'SELECT pg_advisory_unlock($1::integer, $2::integer)',
    ADVISORY_LOCK_KEYS,
  ).catch(() => undefined)
}

async function verifyMigration(client, migration) {
  await migration.verify({ client })
  console.log(`✓ Verify ${migration.id}`)
}

async function applyMigration(client, migration) {
  const startedAt = Date.now()
  console.log(`→ Apply ${migration.id}: ${migration.description}`)

  if (migration.transactional) await client.query('BEGIN')

  try {
    await migration.up({ client })
    await migration.verify({ client })
    const duration = Date.now() - startedAt
    await client.query(
      `INSERT INTO public.${MIGRATION_TABLE} (id, checksum, description, duration_ms)
       VALUES ($1, $2, $3, $4)`,
      [migration.id, migration.checksum, migration.description, duration],
    )
    if (migration.transactional) await client.query('COMMIT')
    console.log(`✓ Applied ${migration.id} (${duration}ms)`)
  } catch (error) {
    if (migration.transactional) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

function printStatus(migrations, appliedMigrations) {
  console.log('\n=== TRẠNG THÁI DATABASE MIGRATIONS ===')
  for (const migration of migrations) {
    const applied = appliedMigrations.get(migration.id)
    console.log(`${applied ? '✓ APPLIED' : '○ PENDING'}  ${migration.id}  ${migration.description}`)
  }
  const appliedCount = migrations.filter((migration) => appliedMigrations.has(migration.id)).length
  console.log(`\nTổng: ${appliedCount} applied, ${migrations.length - appliedCount} pending.`)
}

async function run() {
  loadEnvFile(path.resolve('.env.local'))
  loadEnvFile(path.resolve('.env'))

  const mode = parseMode()
  const migrationConnection = process.env.DATABASE_MIGRATION_URL?.trim()
    || process.env.DATABASE_URL_UNPOOLED?.trim()
  const runtimeConnection = process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_URI?.trim()
    || process.env.POSTGRES_URL?.trim()
  const connectionString = migrationConnection || runtimeConnection
  if (!connectionString) {
    throw new Error('Thiếu DATABASE_MIGRATION_URL, DATABASE_URL_UNPOOLED, DATABASE_URL hoặc DATABASE_URI.')
  }
  if (isNeonPooledConnection(connectionString)) {
    const message =
      'Migration đang dùng Neon pooled URL (-pooler). Hãy cấu hình DATABASE_MIGRATION_URL bằng Direct connection string của Neon.'
    if (process.env.NODE_ENV === 'production') throw new Error(message)
    console.warn(`⚠ ${message}`)
  }

  const connectionTimeoutMillis = readPositiveInteger(
    'DB_MIGRATION_CONNECTION_TIMEOUT_MS',
    15000,
    300000,
  )
  const lockWaitMilliseconds = readPositiveInteger('DB_MIGRATION_LOCK_WAIT_MS', 60000, 300000)
  const statementTimeoutMilliseconds = readPositiveInteger(
    'DB_MIGRATION_STATEMENT_TIMEOUT_MS',
    240000,
    3600000,
  )
  const databaseLockTimeoutMilliseconds = readPositiveInteger(
    'DB_MIGRATION_DB_LOCK_TIMEOUT_MS',
    30000,
    300000,
  )

  const migrations = await loadMigrations()
  if (migrations.length === 0) throw new Error('Không có migration nào trong mã nguồn.')
  const contract = assertSchemaContract({ migrationIds: migrations.map((migration) => migration.id) })
  console.log(`✓ DB schema contract: ${contract.migrationId}`)
  console.log(`✓ Migration connection: ${migrationConnection ? 'direct URL' : 'DATABASE_URL fallback'}`)

  const client = new Client({ connectionString, connectionTimeoutMillis })
  let hasLock = false
  let completedApply = false

  try {
    await connectWithRetry(client, { maxRetries: 5, delayMs: 3000, label: 'Migration Database' })
    await client.query("SELECT set_config('statement_timeout', $1, false)", [
      `${statementTimeoutMilliseconds}ms`,
    ])
    await client.query("SELECT set_config('lock_timeout', $1, false)", [
      `${databaseLockTimeoutMilliseconds}ms`,
    ])

    let appliedMigrations = await readAppliedMigrations(client)
    await validateAndReconcileHistory(client, migrations, appliedMigrations)
    printStatus(migrations, appliedMigrations)

    if (mode === '--status' || mode === '--dry-run') return

    if (mode === '--verify-only') {
      const pending = migrations.filter((migration) => !appliedMigrations.has(migration.id))
      if (pending.length > 0) {
        throw new Error(`Còn ${pending.length} migration chưa được áp dụng.`)
      }
      for (const migration of migrations) await verifyMigration(client, migration)
      console.log('\n✓ Database đã khớp toàn bộ migration.')
      return
    }

    await acquireAdvisoryLock(client, lockWaitMilliseconds)
    hasLock = true
    await ensureMigrationTable(client)

    // Đọc lại sau khi có lock vì một deployment khác có thể vừa hoàn tất migration.
    appliedMigrations = await readAppliedMigrations(client)
    await validateAndReconcileHistory(client, migrations, appliedMigrations)

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.id)) {
        await verifyMigration(client, migration)
      } else {
        await applyMigration(client, migration)
      }
    }

    console.log('\n✓ Database migration hoàn tất và đã được xác minh.')
    completedApply = true
  } finally {
    if (hasLock) await releaseAdvisoryLock(client)
    await client.end().catch(() => undefined)
  }

  if (completedApply) {
    await verifyRuntimeDatabase({
      connectionString: runtimeConnection,
      migrationConnection,
      latestMigration: migrations.at(-1),
      timeout: connectionTimeoutMillis,
    })
  }
}

run().catch((error) => {
  console.error('\n✗ DATABASE MIGRATION FAILED')
  console.error(formatDatabaseError(error))
  process.exitCode = 1
})
