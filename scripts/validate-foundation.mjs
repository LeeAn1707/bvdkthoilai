import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = [
  ['Users có department scope', 'src/collections/Users.ts', "name: 'department'"],
  ['Users có permissions', 'src/collections/Users.ts', "name: 'permissions'"],
  ['Users có chế độ quyền tùy chỉnh', 'src/collections/Users.ts', "name: 'useCustomPermissions'"],
  ['Users dùng giao diện ma trận checkbox', 'src/collections/Users.ts', 'PermissionMatrixField'],
  ['Đổi quyền làm mới phiên đăng nhập', 'src/collections/Users.ts', 'data.sessions = []'],
  ['Users có status', 'src/collections/Users.ts', "name: 'status'"],
  ['Media có originalFilename', 'src/collections/Media.ts', "name: 'originalFilename'"],
  ['Media có accessLevel', 'src/collections/Media.ts', "name: 'accessLevel'"],
  ['Media có uploadedBy', 'src/collections/Media.ts', "name: 'uploadedBy'"],
  ['Access có module permission', 'src/access/index.ts', 'hasModulePermission'],
  ['Access có department scope', 'src/access/index.ts', 'departmentScopedAccess'],
  ['Upload Settings được khai báo', 'payload.config.ts', 'UploadSettings'],
  ['Tài khoản khóa bị chặn đăng nhập', 'src/collections/Users.ts', 'beforeLogin'],
  ['Ghi nhận thời điểm đăng nhập', 'src/collections/Users.ts', 'afterLogin'],
  ['Access từ chối user không active', 'src/access/index.ts', 'isActiveUser'],
  ['Ma trận quyền role/module', 'src/access/index.ts', 'moduleRoleDefaults'],
  ['Ma trận quyền có thể thu hồi quyền vai trò', 'src/access/index.ts', 'user?.useCustomPermissions === true'],
  ['Menu Admin ẩn mục không được cấp quyền', 'payload.config.ts', 'hideWithoutModulePermission'],
  ['Tin tức dùng quyền module', 'src/collections/News.ts', "moduleAccess('news', 'create')"],
  ['Thông báo dùng quyền module', 'src/collections/Notices.ts', "moduleAccess('notices', 'create')"],
  ['Đấu thầu dùng quyền module', 'src/collections/Procurement.ts', "moduleAccess('procurement', 'create')"],
  ['Lịch khám dùng quyền module', 'src/collections/Schedules.ts', "moduleAccess('schedules', 'create')"],
  ['Lịch hẹn dùng quyền module', 'src/collections/Appointments.ts', "moduleAccess('appointments', 'create')"],
  ['Bảng giá dùng quyền module', 'src/collections/Services.ts', "moduleAccess('services', 'create')"],
  ['Tiêm chủng dùng quyền module', 'src/collections/Vaccinations.ts', "moduleAccess('vaccinations', 'create')"],
  ['Media dùng quyền module', 'src/collections/Media.ts', "moduleAccess('media', 'create')"],
]

let failed = 0
for (const [label, file, token] of checks) {
  const full = path.join(root, file)
  const ok = fs.existsSync(full) && fs.readFileSync(full, 'utf8').includes(token)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failed++
}

if (failed) {
  console.error(`\nFoundation validation: ${failed} mục FAIL.`)
  process.exit(1)
}
console.log('\nFoundation static validation: PASS.')
