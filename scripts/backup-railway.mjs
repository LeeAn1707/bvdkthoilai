import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || process.argv[2];

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

  console.log(`[Backup] Đang kết nối tới Railway PostgreSQL...`);
  await client.connect();

  try {
    // 1. Lấy danh sách các bảng public
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[Backup] Tìm thấy ${tables.length} bảng.`);

    const backupData = {
      timestamp: new Date().toISOString(),
      source: "Railway PostgreSQL",
      tableCount: tables.length,
      tables: {}
    };

    let sqlDump = `-- BACKUP DUMP TẠO TỰ ĐỘNG\n-- Thời gian: ${new Date().toISOString()}\n-- Source: Railway\n\n`;

    for (const table of tables) {
      process.stdout.write(`Đang xuất bảng: ${table}... `);
      const res = await client.query(`SELECT * FROM "${table}"`);
      backupData.tables[table] = res.rows;
      console.log(`(${res.rows.length} dòng)`);

      if (res.rows.length > 0) {
        sqlDump += `-- Dữ liệu bảng: ${table}\n`;
        for (const row of res.rows) {
          const keys = Object.keys(row).map(k => `"${k}"`).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            if (typeof v === 'boolean' || typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlDump += `INSERT INTO "${table}" (${keys}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }
        sqlDump += `\n`;
      }
    }

    // Ghi file JSON (toàn vẹn dữ liệu gốc, dễ inspect)
    fs.writeFileSync(outputFile, JSON.stringify(backupData, null, 2), 'utf-8');
    // Ghi file SQL insert statements
    fs.writeFileSync(sqlOutputFile, sqlDump, 'utf-8');

    console.log(`\n========================================`);
    console.log(`[THÀNH CÔNG] Đã sao lưu dữ liệu Railway về máy:`);
    console.log(`- File JSON: ${outputFile}`);
    console.log(`- File SQL:  ${sqlOutputFile}`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`[LỖI]`, err);
  } finally {
    await client.end();
  }
}

backupDatabase();
