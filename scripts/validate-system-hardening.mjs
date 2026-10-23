import fs from 'node:fs'

const checks = [
  ['AuditLogs collection', 'src/collections/AuditLogs.ts', "slug: 'audit-logs'"],
  ['Audit immutable create false', 'src/collections/AuditLogs.ts', 'create: () => false'],
  ['Generic collection audit', 'src/lib/audit.ts', 'withAudit'],
  ['Generic global audit', 'src/lib/audit.ts', 'withGlobalAudit'],
  ['Media read enforcement', 'src/access/index.ts', 'mediaReadAccess'],
  ['Media trash', 'src/collections/Media.ts', 'trash: true'],
  ['Media SHA-256', 'src/collections/Media.ts', "createHash('sha256')"],
  ['Media duplicate detection', 'src/collections/Media.ts', 'duplicateOf'],
  ['Upload settings enforcement', 'src/collections/Media.ts', "slug: 'upload-settings'"],
  ['Storage threshold enforcement', 'src/collections/Media.ts', 'blockPercent'],
  ['Health DB + storage', 'src/app/(frontend)/api/health/route.ts', 'storageProbe'],
  ['CSP security header', 'next.config.mjs', 'Content-Security-Policy'],
  ['HSTS production', 'next.config.mjs', 'Strict-Transport-Security'],
  ['GraphQL disabled', 'payload.config.ts', 'graphQL: { disable: true }'],
  ['System settings', 'src/globals/SystemSettings.ts', "slug: 'system-settings'"],
  ['Schedule settings', 'src/globals/ScheduleSettings.ts', "slug: 'schedule-settings'"],
  ['AI OCR requires schedule import permission', 'src/app/api/ai-schedule-ocr/route.ts', "hasModulePermission(user, 'schedules', 'import')"],
  ['AI OCR limits file size', 'src/app/api/ai-schedule-ocr/route.ts', 'MAX_FILE_BYTES'],
  ['AI OCR limits MIME types', 'src/app/api/ai-schedule-ocr/route.ts', 'ALLOWED_IMAGE_TYPES'],
  ['AI OCR verifies image signatures', 'src/app/api/ai-schedule-ocr/route.ts', 'matchesImageSignature'],
  ['AI OCR rate limit', 'src/app/api/ai-schedule-ocr/route.ts', 'schedule-ocr:'],
  ['AI OCR provider timeout', 'src/app/api/ai-schedule-ocr/route.ts', 'AbortSignal.timeout'],
  ['Backup checksum', 'scripts/backup.sh', 'SHA256SUMS'],
  ['Backup verification', 'scripts/verify-backup.sh', 'pg_restore --list'],
  ['Restore verifies backup', 'scripts/restore.sh', 'verify-backup.sh'],
  ['Appointments collection create locked', 'src/collections/Appointments.ts', "create: moduleAccess('appointments', 'create')"],
]

const accessPolicy = fs.readFileSync('src/access/index.ts', 'utf8')
const leastPrivilegeChecks = [
  ['Site Settings has no business-role default edit', /'site-settings':\s*\{\s*view:\s*\['board'\],\s*edit:\s*\[\]\s*\}/.test(accessPolicy)],
  ['Homepage default edit is limited to website editors', /homepage:\s*\{\s*view:\s*\['board',\s*'editor',\s*'reviewer'\],\s*edit:\s*\['editor',\s*'reviewer'\]\s*\}/.test(accessPolicy)],
  ['Navigation default edit is limited to website editors', /navigation:\s*\{\s*view:\s*\['board',\s*'editor',\s*'reviewer'\],\s*edit:\s*\['editor',\s*'reviewer'\]\s*\}/.test(accessPolicy)],
  ['Appointments default edit/view excludes editor, hr, finance, procurement', !/'appointments':\s*\{[^}]*'(editor|hr|finance|procurement)'/.test(accessPolicy)],
  ['Appointments delete has no default business role', /appointments:\s*\{[^}]*delete:\s*\[\]/.test(accessPolicy)],
]

let failed = 0
for (const [name, file, needle] of checks) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const ok = content.includes(needle)
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`)
  if (!ok) failed++
}
for (const [name, ok] of leastPrivilegeChecks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`)
  if (!ok) failed++
}
const total = checks.length + leastPrivilegeChecks.length
console.log(`\nSystem Hardening: ${total - failed}/${total} PASS`)
if (failed) process.exit(1)
