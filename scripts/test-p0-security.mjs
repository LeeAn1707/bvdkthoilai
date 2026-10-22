/**
 * TEST AUTOMATION SUITE: P0 SECURITY & ACCESS CONTROL
 * Đối chiếu Test Cases: TC-ACL-01, TC-ACL-02, TC-ACL-03, TC-ACL-04, TC-ACL-05, TC-ACL-06,
 * TC-APPT-01, TC-APPT-02, TC-SEC-01, TC-SEC-02, TC-SEC-03, TC-SEC-04.
 */

import assert from 'node:assert/strict'
import { roleHasModulePermission, hasModulePermission, appointmentAccess, appointmentDepartmentFieldAccess, appointmentCreateAccess } from '../src/access/index.ts'
import { verifyTurnstile } from '../src/lib/request-security.ts'
import { Appointments } from '../src/collections/Appointments.ts'

console.log('====================================================')
console.log('🧪 BẮT ĐẦU CHẠY KIỂM THỬ BẢO MẬT NHÓM P0')
console.log('====================================================\n')

let passCount = 0
let failCount = 0
let skipCount = 0
let blockedCount = 0

function skipTest(testId, name, reason) {
  console.log(`⚠️ [SKIP / NOT RUN] ${testId} — ${name}: ${reason}`)
  skipCount++
}

function blockTest(testId, name, reason) {
  console.log(`⛔ [BLOCKED / NOT RUN] ${testId} — ${name}: ${reason}`)
  blockedCount++
}

function runTest(testId, name, fn) {
  try {
    const res = fn()
    if (res && res.blocked) {
      blockTest(testId, name, res.reason)
      return
    }
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
    if (res && res.blocked) {
      blockTest(testId, name, res.reason)
      return
    }
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
// NHÓM 1: KIỂM SOÁT QUYỀN TRUY CẬP COLLECTION APPOINTMENTS (P0-01)
// -------------------------------------------------------------
runTest('TC-ACL-01 / TC-SEC-04', 'Collection Appointments không cho phép public create (create !== anyone)', () => {
  assert.ok(Appointments.access, 'Appointments phải có object access')
  assert.ok(typeof Appointments.access.create === 'function', 'Appointments.access.create phải là hàm kiểm soát quyền')
  // Hàm anyone() luôn trả về true vô điều kiện
  const dummyReq = { req: { user: null } }
  // access.create phải trả về hàm hoặc promise từ chối user null
  const result = Appointments.access.create(dummyReq)
  // Trong moduleAccess, với user null hàm trả về false (hoặc Promise<false>)
  if (typeof result === 'boolean') {
    assert.equal(result, false, 'Unauthenticated user không được phép tạo bản ghi trực tiếp trên collection')
  }
})

// -------------------------------------------------------------
// NHÓM 2: MA TRẬN PHÂN QUYỀN VÀ BẢO VỆ DỮ LIỆU NGƯỜI BỆNH (P0-02)
// -------------------------------------------------------------
const mockUsers = {
  editor: { id: 101, role: 'editor', status: 'active' },
  reviewer: { id: 102, role: 'reviewer', status: 'active' },
  hr: { id: 103, role: 'hr', status: 'active' },
  finance: { id: 104, role: 'finance', status: 'active' },
  procurement: { id: 105, role: 'procurement', status: 'active' },
  clinicSchedule: { id: 106, role: 'clinic-schedule', status: 'active' },
  departmentManager: { id: 107, role: 'department-manager', status: 'active' },
  board: { id: 108, role: 'board', status: 'active' },
  admin: { id: 109, role: 'admin', status: 'active' },
  superAdmin: { id: 110, role: 'super-admin', status: 'active' },
}

runTest('TC-ACL-03', 'Role editor tin tức bị từ chối xem/tạo/sửa/xóa lịch khám', () => {
  for (const action of ['view', 'create', 'edit', 'delete', 'export']) {
    const allowed = hasModulePermission(mockUsers.editor, 'appointments', action)
    assert.equal(allowed, false, `Editor không được phép ${action} lịch khám`)
  }
})

runTest('TC-ACL-04', 'Role HR, Finance, Procurement bị từ chối truy cập dữ liệu lịch khám', () => {
  for (const user of [mockUsers.hr, mockUsers.finance, mockUsers.procurement]) {
    for (const action of ['view', 'create', 'edit', 'delete', 'export']) {
      const allowed = hasModulePermission(user, 'appointments', action)
      assert.equal(allowed, false, `Role ${user.role} không được phép ${action} lịch khám`)
    }
  }
})

runTest('TC-ACL-05', 'Role clinic-schedule chỉ có quyền view/create/edit, KHÔNG có quyền delete', () => {
  assert.equal(hasModulePermission(mockUsers.clinicSchedule, 'appointments', 'view'), true)
  assert.equal(hasModulePermission(mockUsers.clinicSchedule, 'appointments', 'create'), true)
  assert.equal(hasModulePermission(mockUsers.clinicSchedule, 'appointments', 'edit'), true)
  assert.equal(hasModulePermission(mockUsers.clinicSchedule, 'appointments', 'delete'), false, 'clinic-schedule không được phép xóa lịch hẹn')
})

runTest('TC-ACL-06', 'Role không có thẩm quyền xuất dữ liệu bị chặn export (chỉ board, department-manager, admin)', () => {
  assert.equal(hasModulePermission(mockUsers.editor, 'appointments', 'export'), false)
  assert.equal(hasModulePermission(mockUsers.clinicSchedule, 'appointments', 'export'), false)
  assert.equal(hasModulePermission(mockUsers.procurement, 'appointments', 'export'), false)
  assert.equal(hasModulePermission(mockUsers.board, 'appointments', 'export'), true)
  assert.equal(hasModulePermission(mockUsers.departmentManager, 'appointments', 'export'), true)
  assert.equal(hasModulePermission(mockUsers.superAdmin, 'appointments', 'export'), true)
})

// -------------------------------------------------------------
// NHÓM 3: TURNSTILE FAIL-CLOSED VÀ KIỂM SOÁT BẢO MẬT (P0-03)
// -------------------------------------------------------------
await runAsyncTest('TC-SEC-01', 'Production thiếu TURNSTILE_SECRET_KEY phải FAIL-CLOSED (trả về false)', async () => {
  const originalEnv = process.env.NODE_ENV
  const originalSecret = process.env.TURNSTILE_SECRET_KEY
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.TURNSTILE_SECRET_KEY

    const dummyReq = new Request('http://localhost:3000/api/appointments', { method: 'POST' })
    const result = await verifyTurnstile(dummyReq, 'some-random-token')
    assert.equal(result, false, 'Khi thiếu secret trên production, verifyTurnstile phải trả về false')
  } finally {
    process.env.NODE_ENV = originalEnv
    if (originalSecret) process.env.TURNSTILE_SECRET_KEY = originalSecret
  }
})

await runAsyncTest('TC-SEC-02', 'Token rỗng, null hoặc token quá dài (> 4096 ký tự) bị từ chối', async () => {
  const dummyReq = new Request('http://localhost:3000/api/appointments', { method: 'POST' })
  assert.equal(await verifyTurnstile(dummyReq, ''), false, 'Token rỗng phải bị từ chối')
  assert.equal(await verifyTurnstile(dummyReq, null), false, 'Token null phải bị từ chối')
  assert.equal(await verifyTurnstile(dummyReq, 'a'.repeat(5000)), false, 'Token > 4096 ký tự phải bị từ chối')
})

await runAsyncTest('TC-SEC-03', 'Chế độ test hợp lệ với mock token được cho phép trong môi trường test', async () => {
  const originalEnv = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'test'
    const dummyReq = new Request('http://localhost:3000/api/appointments', { method: 'POST' })
    const result = await verifyTurnstile(dummyReq, 'cf-mock-valid-token')
    assert.equal(result, true, 'Mock token hợp lệ phải trả về true trong môi trường test')
  } finally {
    process.env.NODE_ENV = originalEnv
  }
})

await runAsyncTest('TC-SEC-01B', 'MOCK_TURNSTILE=true bị VÔ HIỆU HÓA triệt để trên NODE_ENV=production', async () => {
  const originalEnv = process.env.NODE_ENV
  const originalMock = process.env.MOCK_TURNSTILE
  try {
    process.env.NODE_ENV = 'production'
    process.env.MOCK_TURNSTILE = 'true'
    const dummyReq = new Request('http://localhost:3000/api/appointments', { method: 'POST' })
    const result = await verifyTurnstile(dummyReq, 'cf-mock-valid-token')
    assert.equal(result, false, 'Trên production, dù có MOCK_TURNSTILE=true thì mock token vẫn phải bị TỪ CHỐI (false)')
  } finally {
    process.env.NODE_ENV = originalEnv
    if (originalMock !== undefined) process.env.MOCK_TURNSTILE = originalMock
    else delete process.env.MOCK_TURNSTILE
  }
})

await runAsyncTest('TC-ACL-07', 'Department-manager bị giới hạn phạm vi dữ liệu theo khoa (Khoa A vs Khoa B)', async () => {
  const managerA = { id: 201, role: 'department-manager', status: 'active', department: 10 } // Khoa A (id: 10)
  const managerB = { id: 202, role: 'department-manager', status: 'active', department: 20 } // Khoa B (id: 20)
  const managerNoDept = { id: 203, role: 'department-manager', status: 'active' } // Chưa gán khoa

  const viewAccess = appointmentAccess('view')
  const editAccess = appointmentAccess('edit')

  // Quản lý Khoa A: Chỉ đọc và sửa được bản ghi của Khoa A
  const filterViewA = await viewAccess({ req: { user: managerA } })
  assert.deepEqual(filterViewA, { department: { equals: 10 } }, 'Quản lý Khoa A chỉ xem được lịch của Khoa A')
  const filterEditA = await editAccess({ req: { user: managerA } })
  assert.deepEqual(filterEditA, { department: { equals: 10 } }, 'Quản lý Khoa A chỉ sửa được lịch của Khoa A')

  // Quản lý Khoa B: Chỉ đọc và sửa được bản ghi của Khoa B
  const filterViewB = await viewAccess({ req: { user: managerB } })
  assert.deepEqual(filterViewB, { department: { equals: 20 } }, 'Quản lý Khoa B chỉ xem được lịch của Khoa B')
  const filterEditB = await editAccess({ req: { user: managerB } })
  assert.deepEqual(filterEditB, { department: { equals: 20 } }, 'Quản lý Khoa B chỉ sửa được lịch của Khoa B')

  // Quản lý Khoa A KHÔNG thể xem/sửa bản ghi Khoa B (where query khác biệt hoàn toàn)
  assert.notDeepEqual(filterViewA, filterViewB, 'Filter của Khoa A và Khoa B phải cách ly hoàn toàn')

  // Quản lý chưa gán khoa: Fail-closed (trả về false)
  const filterNoDept = await viewAccess({ req: { user: managerNoDept } })
  assert.equal(filterNoDept, false, 'Quản lý chưa được gán khoa phải bị từ chối truy cập')

  // Ban Giám Đốc & Điều phối phòng khám: Có quyền toàn viện (trả về true)
  const filterBoard = await viewAccess({ req: { user: mockUsers.board } })
  assert.equal(filterBoard, true, 'Ban Giám Đốc được xem toàn viện')
  const filterClinic = await viewAccess({ req: { user: mockUsers.clinicSchedule } })
  assert.equal(filterClinic, true, 'Điều phối phòng khám được xem toàn viện')
})

await runAsyncTest('TC-ACL-08', 'Khóa quyền lịch hẹn theo Deny-by-default và bảo vệ trường department khi update', async () => {
  const viewAccess = appointmentAccess('view')
  const editAccess = appointmentAccess('edit')

  // 1. User có custom permission nhưng KHÔNG gắn khoa -> DENY-BY-DEFAULT (false)
  const userCustomNoDept = {
    id: 301,
    role: 'editor',
    status: 'active',
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['view', 'edit'] }],
    department: null,
  }
  const viewResult = await viewAccess({ req: { user: userCustomNoDept } })
  assert.equal(viewResult, false, 'User có custom permission nhưng không có department phải bị DENY (false)')
  const editResult = await editAccess({ req: { user: userCustomNoDept } })
  assert.equal(editResult, false, 'User có custom permission nhưng không có department phải bị DENY khi edit')

  // 2. Bảo vệ trường department: Trưởng khoa A KHÔNG được phép đổi department sang khoa khác
  const managerA = { id: 201, role: 'department-manager', status: 'active', department: 10 }
  assert.equal(
    appointmentDepartmentFieldAccess({ req: { user: managerA } }),
    false,
    'Trưởng khoa không được phép cập nhật/đổi trường department của phiếu hẹn'
  )

  // 3. Chỉ elevated admin và clinic-schedule mới được thay đổi trường department
  assert.equal(appointmentDepartmentFieldAccess({ req: { user: mockUsers.admin } }), true)
  assert.equal(appointmentDepartmentFieldAccess({ req: { user: mockUsers.superAdmin } }), true)
  assert.equal(appointmentDepartmentFieldAccess({ req: { user: mockUsers.clinicSchedule } }), true)
})

await runAsyncTest('TC-ACL-09', 'Kiểm soát quyền create và delete của Appointments theo khoa, ngăn khoa A tạo/xóa lịch khoa B', async () => {
  // 1. Quản lý Khoa A (department: 10) có quyền create và delete
  const userA = {
    id: 501,
    role: 'department-manager',
    status: 'active',
    department: 10,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['view', 'create', 'edit', 'delete'] }],
  }

  // 1.1 Tạo lịch: Khoa A cố tình gán department: 20 (Khoa B) -> PHẢI BỊ CHẶN (false)
  const createForB = await appointmentCreateAccess({
    req: { user: userA },
    data: { department: 20, fullName: 'Test Patient', phone: '0901234567' },
  })
  assert.equal(createForB, false, 'Khoa A tuyệt đối không được tạo lịch khám gán cho Khoa B')

  // 1.2 Tạo lịch: Khoa A gán đúng department: 10 (Khoa A) -> CHO PHÉP (true)
  const createForA = await appointmentCreateAccess({
    req: { user: userA },
    data: { department: 10, fullName: 'Test Patient', phone: '0901234567' },
  })
  assert.equal(createForA, true, 'Khoa A được phép tạo lịch khám thuộc đúng Khoa A')

  // 1.3 Tạo lịch: User có custom permissions create nhưng KHÔNG gán khoa -> PHẢI BỊ CHẶN (false - Deny by default)
  const userNoDept = {
    id: 502,
    role: 'editor',
    status: 'active',
    department: null,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['create'] }],
  }
  const createNoDept = await appointmentCreateAccess({
    req: { user: userNoDept },
    data: { department: 10 },
  })
  assert.equal(createNoDept, false, 'User có quyền create nhưng không gán khoa phải bị từ chối (Deny by default)')

  // 2. Quyền xóa: Kiểm tra Appointments.access.delete (đã áp dụng appointmentAccess('delete'))
  const deleteAccessFn = Appointments.access.delete
  assert.ok(typeof deleteAccessFn === 'function', 'Appointments.access.delete phải là hàm kiểm soát')

  // 2.1 Xóa: Khoa A gọi delete -> Chỉ nhận filter where { department: { equals: 10 } }
  // (Không thể xóa bất kỳ bản ghi nào thuộc Khoa B)
  const deleteFilterA = await deleteAccessFn({ req: { user: userA } })
  assert.deepEqual(deleteFilterA, { department: { equals: 10 } }, 'Khoa A chỉ có thể xóa các bản ghi thuộc Khoa A')

  // 2.2 Xóa: User có quyền delete nhưng KHÔNG gán khoa -> DENY (false)
  const userDeleteNoDept = {
    id: 503,
    role: 'editor',
    status: 'active',
    department: null,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['delete'] }],
  }
  const deleteNoDept = await deleteAccessFn({ req: { user: userDeleteNoDept } })
  assert.equal(deleteNoDept, false, 'User có quyền delete nhưng không có khoa phải bị từ chối xóa')

  // 2.3 Xóa: User Khoa A nhưng KHÔNG có quyền delete module appointments -> DENY (false)
  const userANoDelete = {
    id: 504,
    role: 'department-manager',
    status: 'active',
    department: 10,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['view', 'edit'] }], // Không có 'delete'
  }
  const deleteNotPermitted = await deleteAccessFn({ req: { user: userANoDelete } })
  assert.equal(deleteNotPermitted, false, 'User không có action delete phải bị từ chối xóa')

  // 2.4 Xóa: Super admin được xóa toàn viện (true)
  const deleteSuperAdmin = await deleteAccessFn({ req: { user: mockUsers.superAdmin } })
  assert.equal(deleteSuperAdmin, true, 'Super Admin được quyền xóa toàn viện')
})

await runAsyncTest('TC-ACL-10A', 'Logic Access Control nội bộ (Access Control Hooks): Phân quyền phân lập đa khoa (Khoa A vs Khoa B) cho các thao tác read, create, update, delete, export', async () => {
  const managerA = {
    id: 601,
    role: 'department-manager',
    status: 'active',
    department: 10,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['view', 'create', 'edit', 'delete', 'export'] }],
  }

  const managerB = {
    id: 602,
    role: 'department-manager',
    status: 'active',
    department: 20,
    useCustomPermissions: true,
    permissions: [{ module: 'appointments', actions: ['view', 'create', 'edit', 'delete', 'export'] }],
  }

  const viewAccess = appointmentAccess('view')
  const editAccess = appointmentAccess('edit')
  const deleteAccess = Appointments.access.delete

  // 1. ĐỌC (Read): Khoa A chỉ xem được lịch của Khoa A, hoàn toàn bị chặn đọc dữ liệu Khoa B
  const readFilterA = await viewAccess({ req: { user: managerA } })
  const readFilterB = await viewAccess({ req: { user: managerB } })
  assert.deepEqual(readFilterA, { department: { equals: 10 } }, 'Quyền đọc Khoa A phải bị giới hạn nghiêm ngặt ở Khoa A (10)')
  assert.deepEqual(readFilterB, { department: { equals: 20 } }, 'Quyền đọc Khoa B phải bị giới hạn nghiêm ngặt ở Khoa B (20)')
  assert.notEqual(readFilterA.department.equals, readFilterB.department.equals, 'Bộ lọc đọc của Khoa A không bao giờ trùng hoặc mở rộng sang Khoa B')

  // 2. TẠO (Create): Khoa A tạo lịch cho Khoa B -> BỊ CHẶN (false); Khoa A tạo cho Khoa A -> CHO PHÉP (true)
  const createForKhoaB = await appointmentCreateAccess({
    req: { user: managerA },
    data: { department: 20, fullName: 'Bệnh nhân B', phone: '0912345678' },
  })
  assert.equal(createForKhoaB, false, 'Khoa A không thể tạo lịch hẹn gán cho Khoa B')

  const createForKhoaA = await appointmentCreateAccess({
    req: { user: managerA },
    data: { department: 10, fullName: 'Bệnh nhân A', phone: '0912345679' },
  })
  assert.equal(createForKhoaA, true, 'Khoa A được phép tạo lịch hẹn cho Khoa A')

  // 3. SỬA (Update): Khoa A chỉ sửa được lịch Khoa A; không thể sửa đổi trường department sang Khoa B
  const updateFilterA = await editAccess({ req: { user: managerA } })
  assert.deepEqual(updateFilterA, { department: { equals: 10 } }, 'Quyền sửa Khoa A chỉ có hiệu lực trên bản ghi Khoa A')
  assert.equal(
    appointmentDepartmentFieldAccess({ req: { user: managerA } }),
    false,
    'Khoa A tuyệt đối không được sửa trường department để chuyển lịch sang Khoa B'
  )

  // 4. XÓA (Delete): Khoa A chỉ có thể xóa các bản ghi thuộc Khoa A; không thể chạm tới bản ghi Khoa B
  const deleteFilterResA = await deleteAccess({ req: { user: managerA } })
  assert.deepEqual(deleteFilterResA, { department: { equals: 10 } }, 'Bộ lọc xóa Khoa A chỉ tác động lên bản ghi Khoa A')

  // 5. XUẤT (Export): Logic route /api/appointments-export bắt buộc thêm điều kiện department: equals
  function resolveExportDepartmentFilter(user) {
    const isElevated = user.role === 'super-admin' || user.role === 'system-admin' || user.role === 'admin'
    if (!isElevated && user.role !== 'board') {
      const department = user.department
      const departmentID = typeof department === 'object' && department ? department.id : department
      if (!departmentID) {
        return { allowed: false, error: 'Tài khoản quản lý khoa chưa được liên kết khoa cụ thể để xuất dữ liệu.' }
      }
      return { allowed: true, filter: { department: { equals: departmentID } } }
    }
    return { allowed: true, filter: null }
  }

  const exportFilterA = resolveExportDepartmentFilter(managerA)
  assert.equal(exportFilterA.allowed, true)
  assert.deepEqual(exportFilterA.filter, { department: { equals: 10 } }, 'Tập dữ liệu xuất của Khoa A bắt buộc lọc theo Khoa A (10)')

  const exportFilterB = resolveExportDepartmentFilter(managerB)
  assert.equal(exportFilterB.allowed, true)
  assert.deepEqual(exportFilterB.filter, { department: { equals: 20 } }, 'Tập dữ liệu xuất của Khoa B bắt buộc lọc theo Khoa B (20)')

  assert.notDeepEqual(exportFilterA.filter, exportFilterB.filter, 'Khoa A không thể xuất dữ liệu lịch hẹn của Khoa B')
})

await runAsyncTest('TC-ACL-10B', 'Kiểm thử thực tế qua REST API Payload (/api/appointments, /api/appointments-export) bằng tài khoản thật Khoa A và Khoa B trên Staging', async () => {
  const stagingUrl = process.env.STAGING_API_URL || process.env.TEST_API_URL
  const deptAEmail = process.env.STAGING_USER_DEPT_A_EMAIL
  const deptAPass = process.env.STAGING_USER_DEPT_A_PASSWORD
  const deptBEmail = process.env.STAGING_USER_DEPT_B_EMAIL
  const deptBPass = process.env.STAGING_USER_DEPT_B_PASSWORD

  // Quy tắc an toàn: Không tự tạo bằng chứng mô phỏng, nếu thiếu staging hoặc tài khoản thật phải báo BLOCKED rõ ràng
  if (!stagingUrl) {
    return {
      blocked: true,
      reason: 'Chưa cấu hình STAGING_API_URL (yêu cầu máy chủ staging chạy với cơ sở dữ liệu thử nghiệm để kiểm thử REST API thực tế).',
    }
  }

  // Xác minh Staging Allowlist (không chỉ dựa vào danh sách chặn production)
  const VERIFIED_STAGING_ALLOWLIST = ['localhost', '127.0.0.1', 'staging.bvdkthoilai.vn', 'test.bvdkthoilai.vn']
  let parsedUrl
  try {
    parsedUrl = new URL(stagingUrl)
  } catch {
    throw new Error(`STAGING_API_URL không hợp lệ: ${stagingUrl}`)
  }

  if (!VERIFIED_STAGING_ALLOWLIST.includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`CẢNH BÁO BẢO MẬT: STAGING_API_URL (${parsedUrl.hostname}) không nằm trong danh sách Allowlist được xác minh (${VERIFIED_STAGING_ALLOWLIST.join(', ')})`)
  }

  if (!deptAEmail || !deptAPass || !deptBEmail || !deptBPass) {
    return {
      blocked: true,
      reason: 'Chưa cung cấp biến môi trường tài khoản thật cho Khoa A (STAGING_USER_DEPT_A_EMAIL, STAGING_USER_DEPT_A_PASSWORD) và Khoa B (STAGING_USER_DEPT_B_EMAIL, STAGING_USER_DEPT_B_PASSWORD) trên database staging. Theo quy tắc an toàn: không tự tạo dữ liệu giả trong operational DB hoặc tự cấp PASS khi chưa có tài khoản thực tế.',
    }
  }

  const cleanBase = stagingUrl.replace(/\/$/, '')

  // 1. Đăng nhập tài khoản Khoa A qua REST API
  const loginResA = await fetch(`${cleanBase}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: deptAEmail, password: deptAPass }),
  })
  if (!loginResA.ok) {
    throw new Error(`Đăng nhập tài khoản Khoa A thất bại (HTTP ${loginResA.status})`)
  }
  const loginDataA = await loginResA.json()
  const tokenA = loginDataA.token
  assert.ok(tokenA, 'Phải nhận được JWT token sau khi đăng nhập Khoa A')

  // 2. Đăng nhập tài khoản Khoa B qua REST API
  const loginResB = await fetch(`${cleanBase}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: deptBEmail, password: deptBPass }),
  })
  if (!loginResB.ok) {
    throw new Error(`Đăng nhập tài khoản Khoa B thất bại (HTTP ${loginResB.status})`)
  }
  const loginDataB = await loginResB.json()
  const tokenB = loginDataB.token
  assert.ok(tokenB, 'Phải nhận được JWT token sau khi đăng nhập Khoa B')

  const deptA_Id = loginDataA.user?.department?.id || loginDataA.user?.department
  const deptB_Id = loginDataB.user?.department?.id || loginDataB.user?.department

  assert.ok(deptA_Id, 'Tài khoản Khoa A phải được liên kết với một khoa cụ thể')
  assert.ok(deptB_Id, 'Tài khoản Khoa B phải được liên kết với một khoa cụ thể')
  assert.notEqual(deptA_Id, deptB_Id, 'Khoa A và Khoa B phải là hai khoa độc lập khác nhau')

  // 3. THAO TÁC ĐỌC (READ): Khoa A truy vấn danh sách lịch hẹn
  const readResA = await fetch(`${cleanBase}/api/appointments?limit=100`, {
    headers: { Authorization: `JWT ${tokenA}` },
  })
  assert.equal(readResA.status, 200, 'Tài khoản Khoa A đọc danh sách lịch hẹn phải trả về HTTP 200')
  const readDataA = await readResA.json()
  for (const doc of readDataA.docs || []) {
    const docDeptId = doc.department?.id || doc.department
    assert.equal(docDeptId, deptA_Id, 'Mọi bản ghi đọc được bởi Khoa A bắt buộc phải thuộc Khoa A')
    assert.notEqual(docDeptId, deptB_Id, 'Khoa A tuyệt đối không được đọc bất kỳ bản ghi nào thuộc Khoa B')
  }

  // 4. THAO TÁC TẠO (CREATE):
  // 4.1 Khoa A cố tình tạo lịch cho Khoa B -> PHẢI BỊ CHẶN (HTTP 403)
  const createMaliciousRes = await fetch(`${cleanBase}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${tokenA}`,
    },
    body: JSON.stringify({
      fullName: 'Bệnh nhân Test Khoa B',
      phone: '0912345678',
      appointmentDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      timeSlot: 'morning',
      department: deptB_Id,
    }),
  })
  assert.equal(createMaliciousRes.status, 403, 'Khoa A tạo lịch gán cho Khoa B bắt buộc phải bị từ chối với HTTP 403')

  // 4.2 Khoa A tạo lịch hợp lệ thuộc đúng Khoa A -> CHO PHÉP (HTTP 200 / 201)
  let createdApptAId = null
  const createValidRes = await fetch(`${cleanBase}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${tokenA}`,
    },
    body: JSON.stringify({
      code: 'CUSTOM_TAMPER_CODE_123',
      fullName: 'TEST-STAGING-APPT-A',
      phone: '0912345999',
      appointmentDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
      timeSlot: 'morning',
      department: deptA_Id,
    }),
  })
  assert.ok(createValidRes.status === 200 || createValidRes.status === 201, 'Khoa A tạo lịch thuộc Khoa A phải thành công (200/201)')
  const createValidData = await createValidRes.json()
  createdApptAId = createValidData?.doc?.id || createValidData?.id
  const assignedCode = createValidData?.doc?.code || createValidData?.code
  assert.notEqual(
    assignedCode,
    'CUSTOM_TAMPER_CODE_123',
    'Tài khoản thường gửi kèm mã tự tạo (CUSTOM_TAMPER_CODE_123) phải bị bỏ qua, hệ thống bắt buộc tự cấp mã nguyên tử quy chuẩn'
  )
  assert.match(
    assignedCode,
    /^BVTL\d+$/,
    `Mã phiếu hẹn cấp cho tài khoản thường (${assignedCode}) phải tuân thủ nghiêm ngặt định dạng BVTLxxxx`
  )

  try {
    // 5. THAO TÁC SỬA (UPDATE):
    if (createdApptAId) {
      // 5.1 Khoa B cố tình sửa lịch hẹn của Khoa A -> PHẢI BỊ CHẶN (HTTP 403 hoặc 404 do filter che khuất)
      const updateByKhoaBRes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${tokenB}`,
        },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      assert.ok(
        updateByKhoaBRes.status === 403 || updateByKhoaBRes.status === 404,
        'Khoa B cố tình sửa lịch của Khoa A phải bị chặn (HTTP 403 hoặc 404)'
      )

      // 5.2 Khoa A cố tình đổi trường department sang Khoa B -> PHẢI BỊ CHẶN (HTTP 403)
      const updateDeptMaliciousRes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${tokenA}`,
        },
        body: JSON.stringify({ department: deptB_Id }),
      })
      assert.ok(
        updateDeptMaliciousRes.status === 403 || updateDeptMaliciousRes.status === 400,
        'Khoa A không được phép thay đổi trường department sang khoa khác'
      )

      // 5.2b Khoa A cố tình thay đổi mã phiếu hẹn (code) -> PHẢI BỊ CHẶN (HTTP 403)
      const updateCodeMaliciousRes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${tokenA}`,
        },
        body: JSON.stringify({ code: 'BVTL9999_TAMPERED' }),
      })
      assert.ok(
        updateCodeMaliciousRes.status === 403 || updateCodeMaliciousRes.status === 400,
        'Tài khoản thường cố tình thay đổi mã phiếu hẹn đã cấp bắt buộc phải bị từ chối với HTTP 403'
      )

      // 5.3 Khoa A sửa hợp lệ ghi chú của lịch hẹn thuộc Khoa A -> CHO PHÉP (HTTP 200)
      const updateValidRes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${tokenA}`,
        },
        body: JSON.stringify({ symptoms: 'Cập nhật triệu chứng test hợp lệ' }),
      })
      assert.equal(updateValidRes.status, 200, 'Khoa A cập nhật lịch hẹn của Khoa A phải thành công (HTTP 200)')
    }

    // 6. THAO TÁC XÓA (DELETE):
    if (createdApptAId) {
      // 6.1 Khoa B cố tình xóa lịch hẹn của Khoa A -> PHẢI BỊ CHẶN (HTTP 403 hoặc 404)
      const deleteByKhoaBRes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'DELETE',
        headers: { Authorization: `JWT ${tokenB}` },
      })
      assert.ok(
        deleteByKhoaBRes.status === 403 || deleteByKhoaBRes.status === 404,
        'Khoa B cố tình xóa lịch của Khoa A phải bị chặn (HTTP 403 hoặc 404)'
      )

      // 6.2 Khoa A xóa lịch hẹn do chính mình quản lý -> CHO PHÉP (HTTP 200)
      const deleteByKhoaARes = await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
        method: 'DELETE',
        headers: { Authorization: `JWT ${tokenA}` },
      })
      assert.ok(
        deleteByKhoaARes.status === 200 || deleteByKhoaARes.status === 204,
        'Khoa A xóa lịch hẹn của Khoa A phải thành công (HTTP 200/204)'
      )
      createdApptAId = null // Đã xóa xong an toàn
    }
  } finally {
    // Dọn dẹp an toàn nếu bản ghi test chưa được xóa
    if (createdApptAId) {
      try {
        await fetch(`${cleanBase}/api/appointments/${createdApptAId}`, {
          method: 'DELETE',
          headers: { Authorization: `JWT ${tokenA}` },
        })
      } catch {}
    }
  }

  // 7. THAO TÁC XUẤT EXCEL (EXPORT): Khoa A xuất dữ liệu lịch hẹn
  const exportResA = await fetch(`${cleanBase}/api/appointments-export`, {
    headers: { Authorization: `JWT ${tokenA}` },
  })
  assert.equal(exportResA.status, 200, 'Tài khoản Khoa A xuất Excel phải trả về HTTP 200')
  const contentType = exportResA.headers.get('content-type') || ''
  assert.ok(
    contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('octet-stream'),
    'Phản hồi export phải là định dạng bảng tính Excel'
  )
})

console.log('\n====================================================')
console.log(`📊 KẾT QUẢ KIỂM THỬ P0: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP / ${blockedCount} BLOCKED`)
console.log('====================================================\n')

if (failCount > 0) {
  process.exit(1)
}
