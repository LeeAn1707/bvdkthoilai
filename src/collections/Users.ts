import type { CollectionConfig } from 'payload'
import { adminField, admins, ownUserOrAdmins } from '@/access'
import { PERMISSION_ACTION_LABELS } from '@/access/permissionCatalog'

const permissionActions = Object.entries(PERMISSION_ACTION_LABELS).map(([value, label]) => ({
  label,
  value,
}))

const isProduction = process.env.NODE_ENV === 'production'

const permissionSnapshot = (user: any) => {
  const department = typeof user?.department === 'object' ? user.department?.id : user?.department
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions
      .map((row: any) => ({
        module: row?.module,
        actions: Array.isArray(row?.actions) ? [...row.actions].sort() : [],
      }))
      .sort((left: any, right: any) => String(left.module).localeCompare(String(right.module)))
    : []

  return JSON.stringify({
    role: user?.role,
    department,
    status: user?.status,
    useCustomPermissions: user?.useCustomPermissions === true,
    permissions,
  })
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Người dùng', plural: 'Người dùng & Phân quyền' },
  auth: {
    useSessions: false,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    cookies: {
      secure: isProduction,
      sameSite: 'Lax',
    },
    forgotPassword: {
      generateEmailSubject: () => 'Yêu cầu đặt lại mật khẩu - Bệnh viện Đa khoa Khu vực Thới Lai',
      generateEmailHTML: (args) => {
        const resetURL = `${args?.req?.payload?.config?.serverURL || 'http://localhost:3000'}/admin/reset-password?token=${args?.token}`
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; }
              .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              .header { background: linear-gradient(135deg, #072b4c 0%, #0754a8 100%); padding: 28px; text-align: center; color: #ffffff; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
              .header p { margin: 6px 0 0 0; font-size: 13px; color: #bae6fd; }
              .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
              .btn-wrap { text-align: center; margin: 28px 0; }
              .btn { display: inline-block; background-color: #0878D1; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
              .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI</h1>
                <p>HỆ THỐNG QUẢN TRỊ NỘI BỘ</p>
              </div>
              <div class="content">
                <p>Xin chào <strong>${args?.user?.name || 'Quý cán bộ, nhân viên'}</strong>,</p>
                <p>Hệ thống vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản: <strong>${args?.user?.email}</strong>.</p>
                <p>Để tạo mật khẩu mới, vui lòng bấm vào nút bên dưới:</p>
                <div class="btn-wrap">
                  <a href="${resetURL}" class="btn" target="_blank">Đặt lại mật khẩu mới →</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">(Liên kết này có hiệu lực trong vòng 2 giờ. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này).</p>
              </div>
              <div class="footer">
                Bệnh viện Đa khoa Khu vực Thới Lai<br>
                Địa chỉ: Huyện Thới Lai, TP. Cần Thơ | Hotline: 02923 689 115
              </div>
            </div>
          </body>
          </html>
        `
      },
    },
  },
  admin: {
    useAsTitle: 'name',
    group: '⚙️ Hệ thống & Dữ liệu',
    defaultColumns: ['name', 'email', 'role', 'department', 'status', 'updatedAt'],
    description: 'Tài khoản, vai trò, phạm vi khoa/phòng và quyền bổ sung theo module.',
  },
  access: {
    create: admins,
    read: ownUserOrAdmins,
    update: ownUserOrAdmins,
    delete: admins,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (operation !== 'update' || !originalDoc) return data

        const nextUser = { ...originalDoc, ...data }
        if (permissionSnapshot(originalDoc) !== permissionSnapshot(nextUser)) {
          // Thu hồi toàn bộ phiên cũ để quyền mới có hiệu lực ngay ở JWT và menu Admin.
          data.sessions = []
        }
        return data
      },
    ],
    beforeLogin: [
      ({ user }) => {
        if (user && (user.status === 'locked' || user.status === 'inactive')) {
          throw new Error('Tài khoản này đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Quản trị viên.')
        }
        return user
      },
    ],
    afterLogin: [
      async ({ req, user }) => {
        if (user?.id) {
          try {
            await req.payload.update({
              collection: 'users',
              id: user.id,
              data: { lastLoginAt: new Date().toISOString() },
              overrideAccess: true,
              req,
            })
          } catch {
            // Không làm gián đoạn luồng đăng nhập nếu update lastLoginAt gặp sự cố nhỏ
          }
        }
        return user
      },
    ],
  },
  fields: [
    { name: 'name', label: 'Họ và tên', type: 'text', required: true },
    {
      name: 'role',
      label: 'Vai trò / Quyền hạn',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      access: { create: adminField, update: adminField },
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'System Admin', value: 'system-admin' },
        { label: 'Ban Giám đốc', value: 'board' },
        { label: 'Quản trị website', value: 'admin' },
        { label: 'Biên tập viên', value: 'editor' },
        { label: 'Người duyệt bài', value: 'reviewer' },
        { label: 'Khoa / Phòng', value: 'department' },
        { label: 'Quản lý Khoa / Phòng (tương thích dữ liệu cũ)', value: 'department-manager' },
        { label: 'Tổ chức / Nhân sự', value: 'hr' },
        { label: 'Tài chính', value: 'finance' },
        { label: 'Đấu thầu / Vật tư', value: 'procurement' },
        { label: 'Lịch khám', value: 'clinic-schedule' },
        { label: 'Tiêm chủng', value: 'vaccination' },
        { label: 'Quản lý chất lượng', value: 'quality-management' },
      ],
    },
    {
      name: 'department',
      label: 'Phạm vi Khoa / Phòng',
      type: 'relationship',
      relationTo: 'departments',
      saveToJWT: true,
      access: { create: adminField, update: adminField },
      admin: { description: 'Dùng để giới hạn dữ liệu theo khoa/phòng đối với các vai trò được phân scope.' },
    },
    {
      name: 'status',
      label: 'Trạng thái tài khoản',
      type: 'select',
      required: true,
      defaultValue: 'active',
      saveToJWT: true,
      access: { create: adminField, update: adminField },
      options: [
        { label: 'Đang hoạt động', value: 'active' },
        { label: 'Đã khóa', value: 'locked' },
        { label: 'Ngừng hoạt động', value: 'inactive' },
      ],
      admin: { description: 'Đã chuẩn hóa trường trạng thái theo baseline. Tài khoản Locked/Inactive bị chặn đăng nhập ngay ở hook xác thực.' },
    },
    {
      name: 'useCustomPermissions',
      label: 'Dùng ma trận quyền tùy chỉnh',
      type: 'checkbox',
      defaultValue: false,
      saveToJWT: true,
      access: { create: adminField, update: adminField },
      admin: {
        description: 'Bật: chỉ cho phép đúng các mục và thao tác đã tích bên dưới. Tắt: giữ quyền mặc định theo vai trò và cộng thêm các quyền được tích.',
      },
    },
    {
      name: 'permissions',
      label: 'Ma trận phân quyền theo mục quản trị',
      type: 'array',
      saveToJWT: true,
      access: { create: adminField, update: adminField },
      admin: {
        description: 'Chọn trực quan từng mục và từng thao tác được phép trong Admin.',
        components: {
          Field: '/src/components/admin/PermissionMatrixField#default',
        },
      },
      fields: [
        { name: 'module', label: 'Module', type: 'text', required: true, admin: { description: 'Ví dụ: news, notices, procurement, schedules, services, quality.' } },
        { name: 'actions', label: 'Thao tác được phép', type: 'select', hasMany: true, required: true, options: permissionActions },
      ],
    },
    {
      name: 'lastLoginAt',
      label: 'Đăng nhập gần nhất',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', date: { displayFormat: 'dd/MM/yyyy HH:mm' } },
    },
  ],
}
