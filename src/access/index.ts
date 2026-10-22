import type { Access, FieldAccess, Where } from 'payload'

export type Role =
  | 'super-admin'
  | 'system-admin'
  | 'board'
  | 'admin'
  | 'editor'
  | 'reviewer'
  | 'department'
  | 'department-manager'
  | 'hr'
  | 'finance'
  | 'procurement'
  | 'clinic-schedule'
  | 'vaccination'
  | 'quality-management'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'publish'
  | 'hide'
  | 'import'
  | 'export'
  | 'restore'

const roleOf = (user: any): Role | undefined => user?.role

export const isActiveUser = (user: any): boolean => Boolean(user) && (user.status == null || user.status === 'active')

const isElevatedRole = (role?: Role) =>
  role === 'super-admin' || role === 'system-admin' || role === 'admin'

/**
 * Payload có thể hydrate req.user từ JWT với tập field tối thiểu. Khi access
 * control cần role/status/permissions mà token cũ hoặc môi trường production
 * chưa mang đủ field, đọc lại chính user đang đăng nhập từ DB. Không cấp quyền
 * theo email/id và không bypass xác thực.
 */
const resolveAuthenticatedUser = async (req: any): Promise<any | null> => {
  const current = req?.user
  if (!current?.id) return null

  if (current.role && current.status != null) return current

  try {
    return await req.payload.findByID({
      collection: 'users',
      id: current.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return current
  }
}

export const anyone: Access = () => true
export const loggedIn: Access = ({ req }) => isActiveUser(req.user)

export const ownUserOrAdmins: Access = ({ req }) => {
  const user = req.user
  if (!isActiveUser(user) || !user) return false
  if (isElevatedRole(roleOf(user))) return true
  return { id: { equals: user.id } }
}

export const publicActive: Access = ({ req }) => {
  if (isActiveUser(req.user)) return true
  return { active: { equals: true } }
}

export const publicPublished: Access = ({ req }) => {
  if (isActiveUser(req.user)) return true
  return { _status: { equals: 'published' } } as Where
}

export const publicActiveFor = (module: string): Access => ({ req }) => {
  if (isActiveUser(req.user) && hasModulePermission(req.user, module, 'view')) return true
  return { active: { equals: true } }
}

export const publicPublishedFor = (module: string): Access => ({ req }) => {
  if (isActiveUser(req.user) && hasModulePermission(req.user, module, 'view')) return true
  return { _status: { equals: 'published' } } as Where
}

export const admins: Access = ({ req }) => isActiveUser(req.user) && isElevatedRole(roleOf(req.user))
export const superAdmins: Access = ({ req }) => isActiveUser(req.user) && roleOf(req.user) === 'super-admin'
export const publishers: Access = ({ req }) => isActiveUser(req.user) && ['super-admin', 'system-admin', 'admin', 'reviewer'].includes(roleOf(req.user) || '')
export const editors: Access = ({ req }) => isActiveUser(req.user) && ['super-admin', 'system-admin', 'admin', 'editor', 'reviewer', 'department', 'department-manager'].includes(roleOf(req.user) || '')
export const procurementTeam: Access = ({ req }) => isActiveUser(req.user) && ['super-admin', 'system-admin', 'admin', 'procurement'].includes(roleOf(req.user) || '')
export const adminField: FieldAccess = ({ req }) => isActiveUser(req.user) && isElevatedRole(roleOf(req.user))

const moduleRoleDefaults: Record<string, Partial<Record<PermissionAction, Role[]>>> = {
  homepage: { view: ['board', 'editor', 'reviewer'], edit: ['editor', 'reviewer'] },
  // Cấu hình nhận diện/hệ thống chỉ elevated admin được sửa mặc định.
  // Role khác phải được cấp explicit permission trong ma trận người dùng.
  'site-settings': { view: ['board'], edit: [] },
  navigation: { view: ['board', 'editor', 'reviewer'], edit: ['editor', 'reviewer'] },
  news: { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], submit: ['editor', 'department', 'department-manager'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  notices: { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], submit: ['editor', 'department', 'department-manager'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  'health-warnings': { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], submit: ['editor', 'department', 'department-manager'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  'custom-posts': { view: ['editor', 'reviewer'], create: ['editor', 'reviewer'], edit: ['editor', 'reviewer'], delete: ['reviewer'], submit: ['editor'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  documents: { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], publish: ['reviewer'], restore: ['reviewer'] },
  'clinical-protocols': { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], publish: ['reviewer'], restore: ['reviewer'] },
  pages: { view: ['editor', 'reviewer'], create: ['editor', 'reviewer'], edit: ['editor', 'reviewer'], delete: ['reviewer'], submit: ['editor'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  procurement: { view: ['procurement'], create: ['procurement'], edit: ['procurement'], delete: ['procurement'], submit: ['procurement'], approve: ['procurement'], publish: ['procurement'], hide: ['procurement'], import: ['procurement'], export: ['procurement'], restore: ['procurement'] },
  recruitment: { view: ['hr'], create: ['hr'], edit: ['hr'], delete: ['hr'], submit: ['hr'], approve: ['hr'], publish: ['hr'], hide: ['hr'], import: ['hr'], export: ['hr'], restore: ['hr'] },
  departments: { view: ['hr', 'department', 'department-manager'], create: ['hr'], edit: ['hr', 'department', 'department-manager'], delete: ['hr'] },
  specialties: { view: ['hr', 'department', 'department-manager'], create: ['hr', 'department-manager'], edit: ['hr', 'department', 'department-manager'], delete: ['hr'], publish: ['hr', 'department-manager'] },
  doctors: { view: ['hr', 'department', 'department-manager'], create: ['hr', 'department', 'department-manager'], edit: ['hr', 'department', 'department-manager'], delete: ['hr'], import: ['hr'], export: ['hr'] },
  'advanced-techniques': { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer'], edit: ['editor', 'reviewer'], delete: ['reviewer'], submit: ['editor'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  'scientific-activities': { view: ['editor', 'reviewer', 'department', 'department-manager'], create: ['editor', 'reviewer', 'department', 'department-manager'], edit: ['editor', 'reviewer', 'department', 'department-manager'], delete: ['reviewer'], submit: ['editor', 'department', 'department-manager'], approve: ['reviewer'], publish: ['reviewer'], hide: ['reviewer'], restore: ['reviewer'] },
  'work-schedules': { view: ['board', 'clinic-schedule', 'department-manager', 'editor', 'reviewer'], create: ['clinic-schedule'], edit: ['clinic-schedule'], delete: ['clinic-schedule'], publish: ['clinic-schedule'], import: ['clinic-schedule'], export: ['clinic-schedule'] },
  schedules: { view: ['clinic-schedule', 'department-manager'], create: ['clinic-schedule'], edit: ['clinic-schedule'], delete: ['clinic-schedule'], publish: ['clinic-schedule'], import: ['clinic-schedule'], export: ['clinic-schedule'] },
  appointments: {
    view: ['board', 'clinic-schedule', 'department-manager'],
    create: ['clinic-schedule', 'department-manager'],
    edit: ['clinic-schedule', 'department-manager'],
    delete: [],
    export: ['board', 'department-manager'],
  },
  vaccinations: { view: ['vaccination'], create: ['vaccination'], edit: ['vaccination'], delete: ['vaccination'], publish: ['vaccination'], import: ['vaccination'], export: ['vaccination'] },
  services: { view: ['finance'], create: ['finance'], edit: ['finance'], delete: ['finance'], publish: ['finance'], import: ['finance'], export: ['finance'] },
  feedback: { view: ['quality-management', 'department-manager'], create: ['quality-management'], edit: ['quality-management', 'department-manager'], delete: ['quality-management'], export: ['quality-management'] },
  consultations: { view: ['quality-management'], create: ['quality-management'], edit: ['quality-management'], delete: ['quality-management'] },
  faqs: { view: ['quality-management', 'editor', 'reviewer'], create: ['quality-management'], edit: ['quality-management'], delete: ['quality-management'], import: ['quality-management'] },
  forms: { view: ['quality-management'], create: ['quality-management'], edit: ['quality-management'], delete: ['quality-management'], export: ['quality-management'] },
  chatbot: { view: ['quality-management'], create: ['quality-management'], edit: ['quality-management'], delete: ['quality-management'], import: ['quality-management'], export: ['quality-management'] },
  surveys: { view: ['quality-management'], create: ['quality-management'], edit: ['quality-management'], delete: ['quality-management'], publish: ['quality-management'], export: ['quality-management'] },
  media: { view: ['editor', 'reviewer', 'department', 'department-manager', 'hr', 'finance', 'procurement', 'clinic-schedule', 'vaccination', 'quality-management'], create: ['editor', 'reviewer', 'department', 'department-manager', 'hr', 'finance', 'procurement', 'clinic-schedule', 'vaccination', 'quality-management'], edit: ['editor', 'reviewer', 'department-manager'], delete: ['reviewer'] },
  categories: { view: ['editor', 'reviewer'], create: ['reviewer'], edit: ['reviewer'], delete: ['reviewer'], restore: ['reviewer'] },
}

export const roleHasModulePermission = (user: any, module: string, action: PermissionAction): boolean => {
  if (!isActiveUser(user)) return false
  const role = roleOf(user)
  if (isElevatedRole(role)) return true
  const allowed = moduleRoleDefaults[module]?.[action] || []
  return Boolean(role && allowed.includes(role))
}

export const hasModulePermission = (user: any, module: string, action: PermissionAction): boolean => {
  if (!isActiveUser(user)) return false
  const role = roleOf(user)
  if (isElevatedRole(role)) return true
  const rows = Array.isArray(user?.permissions) ? user.permissions : []
  const hasExplicitPermission = rows.some(
    (row: any) => row?.module === module && Array.isArray(row.actions) && row.actions.includes(action),
  )

  if (user?.useCustomPermissions === true) return hasExplicitPermission
  return roleHasModulePermission(user, module, action) || hasExplicitPermission
}

export const mediaReadAccess: Access = ({ req }) => {
  if (isActiveUser(req.user) && hasModulePermission(req.user, 'media', 'view')) return true
  return {
    or: [
      { accessLevel: { equals: 'public' } },
      { accessLevel: { exists: false } },
    ],
  } as Where
}

export const moduleAccess = (module: string, action: PermissionAction): Access => async ({ req }) => {
  const user = await resolveAuthenticatedUser(req)
  if (!isActiveUser(user)) return false
  return hasModulePermission(user, module, action)
}

export const departmentScopedAccess = (module: string, action: PermissionAction, departmentField = 'department'): Access => ({ req }) => {
  if (!isActiveUser(req.user)) return false
  if (isElevatedRole(roleOf(req.user))) return true
  if (!hasModulePermission(req.user, module, action)) return false
  const department = (req.user as any)?.department
  const departmentID = typeof department === 'object' && department ? department.id : department
  if (!departmentID) return false
  return { [departmentField]: { equals: departmentID } } as Where
}

export const ownDepartmentRecordAccess = (action: PermissionAction): Access => ({ req }) => {
  if (!isActiveUser(req.user)) return false
  if (isElevatedRole(roleOf(req.user))) return true
  if (!hasModulePermission(req.user, 'departments', action)) return false
  const role = roleOf(req.user)
  if (role === 'hr') return true
  const department = (req.user as any)?.department
  const departmentID = typeof department === 'object' && department ? department.id : department
  if (!departmentID) return false
  return { id: { equals: departmentID } } as Where
}

export const organizationDepartmentScopedAccess = (module: 'specialties' | 'doctors', action: PermissionAction): Access => ({ req }) => {
  if (!isActiveUser(req.user)) return false
  if (isElevatedRole(roleOf(req.user))) return true
  if (!hasModulePermission(req.user, module, action)) return false
  const role = roleOf(req.user)
  if (role === 'hr') return true
  const department = (req.user as any)?.department
  const departmentID = typeof department === 'object' && department ? department.id : department
  if (!departmentID) return false
  return { department: { equals: departmentID } } as Where
}

export const publishedOrOwnedDraft: Access = ({ req }) => {
  const user = req.user
  if (!isActiveUser(user) || !user) return { _status: { equals: 'published' } } as Where
  if (['super-admin', 'system-admin', 'admin', 'reviewer'].includes(roleOf(user) || '')) return true
  return { or: [{ _status: { equals: 'published' } }, { createdBy: { equals: user.id } }] } as Where
}

export const workflowUpdateAccess = (module: string): Access => async ({ req, data }) => {
  const user = await resolveAuthenticatedUser(req)
  if (!isActiveUser(user)) return false

  // Nhóm quản trị cấp cao luôn có toàn quyền workflow. Kiểm tra trước dữ liệu
  // trạng thái để tránh production từ chối publish khi request chỉ gửi _status.
  if (isElevatedRole(roleOf(user))) return true

  const next = data as any
  if (next?._status === 'published' || next?.workflowState === 'published') return hasModulePermission(user, module, 'publish')
  if (next?.workflowState === 'approved') return hasModulePermission(user, module, 'approve')
  if (next?.workflowState === 'submitted') return hasModulePermission(user, module, 'submit')
  if (next?.workflowState === 'hidden') return hasModulePermission(user, module, 'hide')
  return hasModulePermission(user, module, 'edit')
}

export const contentDeleteAccess = (module: string): Access => async ({ req, data }) => {
  const user = await resolveAuthenticatedUser(req)
  if (!isActiveUser(user)) return false
  if (isElevatedRole(roleOf(user))) return true
  if (!data) return false
  return hasModulePermission(user, module, 'delete')
}
