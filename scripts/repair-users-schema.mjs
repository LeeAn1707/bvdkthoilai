import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Client } = pg

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(path.resolve('.env.local'))
loadEnvFile(path.resolve('.env'))

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('Thiếu DATABASE_URL trong .env/.env.local')
const apply = process.argv.includes('--apply')

const client = new Client({ connectionString, connectionTimeoutMillis: 8000 })

async function q(sql, params=[]) { return client.query(sql, params) }
async function existsTable(name) {
  const r = await q(`select to_regclass($1) as reg`, [`public.${name}`])
  return Boolean(r.rows[0]?.reg)
}
async function columns(name) {
  const r = await q(`select column_name, data_type, udt_name, is_nullable
                     from information_schema.columns
                    where table_schema='public' and table_name=$1
                    order by ordinal_position`, [name])
  return r.rows
}
async function typeExists(name) {
  const r = await q(`select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname=$1`, [name])
  return r.rowCount > 0
}

function show(name, ok, detail='') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function audit() {
  console.log('\n=== KIỂM TRA SCHEMA USERS / PHÂN QUYỀN ===')
  const expected = {
    users: ['id','name','role','department_id','status','use_custom_permissions','last_login_at','updated_at','created_at','email','reset_password_token','reset_password_expiration','reset_password_requested_at','salt','hash','login_attempts','lock_until'],
    users_permissions: ['_order','_parent_id','id','module'],
    users_permissions_actions: ['order','parent_id','value','id'],
    users_sessions: ['_order','_parent_id','id','created_at','expires_at'],
  }
  let problems = 0
  for (const [table, cols] of Object.entries(expected)) {
    const okTable = await existsTable(table)
    show(`Bảng ${table}`, okTable)
    if (!okTable) { problems++; continue }
    const info = await columns(table)
    const names = new Set(info.map(x=>x.column_name))
    for (const c of cols) if (!names.has(c)) { show(`${table}.${c}`, false, 'thiếu cột'); problems++ }
    if (table === 'users_permissions') {
      const id = info.find(x=>x.column_name==='id')
      if (id && id.data_type !== 'character varying' && id.data_type !== 'text') { show('users_permissions.id', false, `đang là ${id.data_type}, Payload cần varchar/text`); problems++ }
    }
    if (table === 'users_permissions_actions') {
      const p = info.find(x=>x.column_name==='parent_id')
      if (p && p.data_type !== 'character varying' && p.data_type !== 'text') { show('users_permissions_actions.parent_id', false, `đang là ${p.data_type}, Payload cần varchar/text`); problems++ }
    }
  }
  for (const t of ['enum_users_role','enum_users_status','enum_users_permissions_actions']) {
    const ok = await typeExists(t); show(`Enum ${t}`, ok); if (!ok) problems++
  }
  console.log(`\nTổng vấn đề phát hiện: ${problems}`)
  return problems
}

async function ensureEnum(name, values) {
  if (!(await typeExists(name))) {
    const vals = values.map(v => `'${v.replaceAll("'", "''")}'`).join(',')
    await q(`CREATE TYPE public.${name} AS ENUM (${vals})`)
  } else {
    for (const v of values) await q(`ALTER TYPE public.${name} ADD VALUE IF NOT EXISTS '${v.replaceAll("'", "''")}'`)
  }
}

async function applyRepair() {
  console.log('\n=== ÁP DỤNG SỬA SCHEMA USERS ===')
  // PostgreSQL cũ không cho phép ALTER TYPE ... ADD VALUE trong transaction.
  // Đồng bộ enum trước, sau đó mới dùng transaction cho phần bảng/cột/index.
  await ensureEnum('enum_users_role', ['super-admin','system-admin','board','admin','editor','reviewer','department','department-manager','hr','finance','procurement','clinic-schedule','vaccination','quality-management'])
  await ensureEnum('enum_users_status', ['active','locked','inactive'])
  await ensureEnum('enum_users_permissions_actions', ['view','create','edit','delete','submit','approve','publish','hide','import','export','restore'])
  await q('BEGIN')
  try {
    await q(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id integer`)
    await q(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status public.enum_users_status DEFAULT 'active'::public.enum_users_status`)
    await q(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS use_custom_permissions boolean DEFAULT false`)
    await q(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at timestamp(3) with time zone`)
    await q(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_requested_at timestamp(3) with time zone`)
    await q(`CREATE TABLE IF NOT EXISTS public.users_permissions (_order integer NOT NULL,_parent_id integer NOT NULL,id character varying NOT NULL,module character varying NOT NULL)`)
    await q(`CREATE TABLE IF NOT EXISTS public.users_permissions_actions ("order" integer NOT NULL,parent_id character varying NOT NULL,value public.enum_users_permissions_actions,id serial PRIMARY KEY)`)
    await q(`CREATE TABLE IF NOT EXISTS public.users_sessions (_order integer NOT NULL,_parent_id integer NOT NULL,id character varying NOT NULL,created_at timestamp(3) with time zone,expires_at timestamp(3) with time zone NOT NULL)`)
    const upCols = await columns('users_permissions')
    const upId = upCols.find(x=>x.column_name==='id')
    if (upId && !['character varying','text'].includes(upId.data_type)) await q(`ALTER TABLE public.users_permissions ALTER COLUMN id TYPE character varying USING id::character varying`)
    const uaCols = await columns('users_permissions_actions')
    const uaParent = uaCols.find(x=>x.column_name==='parent_id')
    if (uaParent && !['character varying','text'].includes(uaParent.data_type)) await q(`ALTER TABLE public.users_permissions_actions ALTER COLUMN parent_id TYPE character varying USING parent_id::character varying`)
    const usCols = await columns('users_sessions')
    const usId = usCols.find(x=>x.column_name==='id')
    if (usId && !['character varying','text'].includes(usId.data_type)) await q(`ALTER TABLE public.users_sessions ALTER COLUMN id TYPE character varying USING id::character varying`)
    await q(`CREATE INDEX IF NOT EXISTS users_permissions_order_idx ON public.users_permissions (_order)`)
    await q(`CREATE INDEX IF NOT EXISTS users_permissions_parent_idx ON public.users_permissions (_parent_id)`)
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS users_permissions_id_idx ON public.users_permissions (id)`)
    await q(`CREATE INDEX IF NOT EXISTS users_permissions_actions_order_idx ON public.users_permissions_actions ("order")`)
    await q(`CREATE INDEX IF NOT EXISTS users_permissions_actions_parent_idx ON public.users_permissions_actions (parent_id)`)
    await q(`CREATE INDEX IF NOT EXISTS users_sessions_order_idx ON public.users_sessions (_order)`)
    await q(`CREATE INDEX IF NOT EXISTS users_sessions_parent_idx ON public.users_sessions (_parent_id)`)
    await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_permissions_parent_id_fk') THEN ALTER TABLE public.users_permissions ADD CONSTRAINT users_permissions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE; END IF; END $$`)
    await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_permissions_actions_parent_fk') THEN ALTER TABLE public.users_permissions_actions ADD CONSTRAINT users_permissions_actions_parent_fk FOREIGN KEY (parent_id) REFERENCES public.users_permissions(id) ON DELETE CASCADE; END IF; END $$`)
    await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_sessions_parent_id_fk') THEN ALTER TABLE public.users_sessions ADD CONSTRAINT users_sessions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE; END IF; END $$`)
    await q('COMMIT')
    console.log('✓ Sửa schema users hoàn tất. Không xóa tài khoản hay dữ liệu phân quyền hiện có.')
  } catch (e) {
    await q('ROLLBACK')
    throw e
  }
}

try {
  await client.connect()
  const problems = await audit()
  if (apply) {
    await applyRepair()
    await audit()
  } else if (problems > 0) {
    console.log('\nChỉ đang audit, CHƯA thay đổi database.')
    console.log('Sau khi backup DB, chạy: npm run repair:users-schema -- --apply')
  } else {
    console.log('\nSchema users hiện đã khớp cấu trúc Payload 3.88.')
  }
} catch (e) {
  console.error('\nLỖI:', e?.message || e)
  process.exitCode = 1
} finally {
  await client.end().catch(()=>{})
}
