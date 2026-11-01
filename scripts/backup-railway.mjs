import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

const rawConnectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || process.argv[2];
const connectionString = rawConnectionString ? rawConnectionString.trim() : '';

if (!connectionString) {
  console.error('[Backup] Lỗi: Chưa cung cấp DATABASE_URL hoặc RAILWAY_DATABASE_URL qua biến môi trường.');
  process.exit(1);
}

async function backupDatabase() {
  const client = new Client({ connectionString, ssl: false });
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(backupDir, `railway_backup_${timestamp}.json`);
  const sqlOutputFile = path.join(backupDir, `railway_backup_${timestamp}.sql`);
  const latestVpsSqlFile = path.join(backupDir, `vps_ready_full_backup.sql`);

  console.log(`[Backup] Đang kết nối tới Railway PostgreSQL...`);
  await client.connect();

  try {
    // 1. Xuất toàn bộ ENUM types (quan trọng cho Payload CMS)
    const enumsRes = await client.query(`
      SELECT t.typname AS enum_name,
             string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);

    // 2. Xuất toàn bộ Sequences
    const seqRes = await client.query(`
      SELECT relname AS seq_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S'
      ORDER BY relname;
    `);

    // 3. Lấy danh sách các bảng public
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[Backup] Tìm thấy ${tables.length} bảng, ${enumsRes.rows.length} enum types, ${seqRes.rows.length} sequences.`);

    const backupData = {
      timestamp: new Date().toISOString(),
      source: "Railway PostgreSQL",
      tableCount: tables.length,
      tables: {}
    };

    let sqlDump = `-- ====================================================================\n`;
    sqlDump += `-- FULL BACKUP DUMP (SCHEMA + DATA) CHUẨN ĐỂ ĐƯA LÊN VPS MỚI\n`;
    sqlDump += `-- Thời gian: ${new Date().toISOString()}\n`;
    sqlDump += `-- Source: Railway PostgreSQL (${tables.length} bảng, ${enumsRes.rows.length} enums, ${seqRes.rows.length} sequences)\n`;
    sqlDump += `-- ====================================================================\n\n`;
    sqlDump += `SET client_encoding = 'UTF8';\n`;
    sqlDump += `SET standard_conforming_strings = on;\n`;
    sqlDump += `SET session_replication_role = 'replica';\n\n`;

    // Ghi ENUMs
    if (enumsRes.rows.length > 0) {
      sqlDump += `-- 1. KHỞI TẠO ENUM TYPES\n`;
      for (const row of enumsRes.rows) {
        sqlDump += `DO $$ BEGIN CREATE TYPE "public"."${row.enum_name}" AS ENUM (${row.enum_values}); EXCEPTION WHEN duplicate_object THEN null; END $$;\n`;
      }
      sqlDump += `\n`;
    }

    // Ghi Sequences
    if (seqRes.rows.length > 0) {
      sqlDump += `-- 2. KHỞI TẠO SEQUENCES\n`;
      for (const s of seqRes.rows) {
        sqlDump += `CREATE SEQUENCE IF NOT EXISTS "public"."${s.seq_name}";\n`;
      }
      sqlDump += `\n`;
    }

    // 4. Lấy cấu trúc cột và tạo CREATE TABLE cho tất cả các bảng
    sqlDump += `-- 3. KHỞI TẠO CẤU TRÚC BẢNG (CREATE TABLES)\n`;
    for (const table of tables) {
      const colsRes = await client.query(`
        SELECT 
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnotnull AS not_null,
          pg_get_expr(d.adbin, d.adrelid) AS column_default
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
        WHERE a.attrelid = $1::regclass
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum;
      `, [`"public"."${table}"`]);

      const pkRes = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum);
      `, [`"public"."${table}"`]);

      const colDefs = colsRes.rows.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
        if (col.column_default !== null) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.not_null) {
          def += ` NOT NULL`;
        }
        return def;
      });

      if (pkRes.rows.length > 0) {
        const pkCols = pkRes.rows.map(r => `"${r.attname}"`).join(', ');
        colDefs.push(`  PRIMARY KEY (${pkCols})`);
      }

      sqlDump += `CREATE TABLE IF NOT EXISTS "public"."${table}" (\n${colDefs.join(',\n')}\n);\n\n`;
    }

    // 5. Xuất dữ liệu từng bảng
    sqlDump += `-- 4. CHÈN DỮ LIỆU (DATA INSERTS)\n`;
    for (const table of tables) {
      process.stdout.write(`Đang xuất bảng: ${table}... `);
      const res = await client.query(`SELECT * FROM "${table}"`);
      backupData.tables[table] = res.rows;
      console.log(`(${res.rows.length} dòng)`);

      if (res.rows.length > 0) {
        sqlDump += `-- Dữ liệu bảng: ${table} (${res.rows.length} dòng)\n`;
        for (const row of res.rows) {
          const keys = Object.keys(row).map(k => `"${k}"`).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            if (typeof v === 'boolean' || typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlDump += `INSERT INTO "public"."${table}" (${keys}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }
        sqlDump += `\n`;
      }
    }

    // 6. Đồng bộ lại giá trị hiện tại của các Sequences (tránh trùng ID khi thêm mới trên VPS)
    sqlDump += `-- 5. ĐỒNG BỘ GIÁ TRỊ SEQUENCES\n`;
    for (const s of seqRes.rows) {
      try {
        const valRes = await client.query(`SELECT last_value, is_called FROM "public"."${s.seq_name}"`);
        if (valRes.rows.length > 0) {
          const { last_value, is_called } = valRes.rows[0];
          sqlDump += `SELECT pg_catalog.setval('"public"."${s.seq_name}"', ${last_value}, ${is_called});\n`;
        }
      } catch {}
    }

    // 7. Xuất các Indexes (Unique & Normal indexes ngoài Primary Key)
    const idxRes = await client.query(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);
    if (idxRes.rows.length > 0) {
      sqlDump += `\n-- 6. KHỞI TẠO INDEXES\n`;
      for (const idx of idxRes.rows) {
        const safeIdxDef = idx.indexdef
          .replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ')
          .replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
        sqlDump += `${safeIdxDef};\n`;
      }
    }

    // 8. Xuất các Foreign Keys (Khóa ngoại)
    const fkRes = await client.query(`
      SELECT
        conrelid::regclass AS table_name,
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_def
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, conname;
    `);
    if (fkRes.rows.length > 0) {
      sqlDump += `\n-- 7. KHỞI TẠO FOREIGN KEYS (KHÓA NGOẠI)\n`;
      for (const fk of fkRes.rows) {
        sqlDump += `DO $$ BEGIN ALTER TABLE ${fk.table_name} ADD CONSTRAINT "${fk.constraint_name}" ${fk.constraint_def}; EXCEPTION WHEN duplicate_object THEN null; END $$;\n`;
      }
    }

    sqlDump += `\nSET session_replication_role = 'origin';\n`;
    sqlDump += `-- HOÀN TẤT BACKUP\n`;

    // Ghi file JSON (toàn vẹn dữ liệu gốc, dễ inspect)
    fs.writeFileSync(outputFile, JSON.stringify(backupData, null, 2), 'utf-8');
    // Ghi file SQL full schema + data theo timestamp
    fs.writeFileSync(sqlOutputFile, sqlDump, 'utf-8');
    // Ghi thêm 1 bản cố định dễ nhớ để đưa lên VPS
    fs.writeFileSync(latestVpsSqlFile, sqlDump, 'utf-8');

    console.log(`\n========================================`);
    console.log(`[THÀNH CÔNG] Đã tạo bộ dữ liệu chuẩn đầy đủ (Schema + Data) cho VPS mới:`);
    console.log(`- File SQL chuẩn cho VPS: ${latestVpsSqlFile}`);
    console.log(`- File SQL (Timestamp):   ${sqlOutputFile}`);
    console.log(`- File JSON:              ${outputFile}`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`[LỖI]`, err);
  } finally {
    await client.end();
  }
}

backupDatabase();
