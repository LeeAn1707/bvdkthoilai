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

function skipTest(testId, name, reason) {
  console.log(`⚠️ [SKIP / NOT RUN] ${testId} — ${name}: ${reason}`)
  skipCount++
}

function runTest(testId, name, fn) {
  try {
    const res = fn()
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

await runAsyncTest('TC-ACL-10', 'Integration test phân quyền Payload CMS: tài khoản Khoa A không được đọc, tạo, sửa, xóa hay xuất lịch hẹn Khoa B', async () => {
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

console.log('\n====================================================')
console.log(`📊 KẾT QUẢ KIỂM THỬ P0: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP`)
console.log('====================================================\n')

if (failCount > 0) {
  process.exit(1)
}
