import { randomBytes } from 'node:crypto'
import { APIError, type CollectionConfig } from 'payload'
import { appointmentAccess, appointmentCreateAccess, appointmentDepartmentFieldAccess } from '@/access'

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  labels: { singular: 'Lịch đặt khám', plural: 'Quản lý lịch đặt khám' },
  admin: {
    useAsTitle: 'code',
    group: '🏥 Khám bệnh & Dịch vụ Y tế',
    defaultColumns: ['code', 'fullName', 'phone', 'specialtyTitle', 'appointmentDate', 'timeSlot', 'status', 'createdAt'],
    description: 'Danh sách phiếu đặt lịch khám tại cơ sở từ website. Có bảng thống kê và tính năng xuất dữ liệu Excel màu xanh.',
    components: {
      beforeList: ['/src/components/admin/AppointmentsDashboard#default'],
    },
  },
  access: {
    // create: moduleAccess('appointments', 'create') - Nâng cấp lên appointmentCreateAccess để kiểm soát giới hạn khoa phòng
    create: appointmentCreateAccess,
    read: appointmentAccess('view'),
    update: appointmentAccess('edit'),
    delete: appointmentAccess('delete'),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          label: 'Mã phiếu hẹn',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: {
            readOnly: true,
            width: '33%',
            description: 'Tự động sinh mã duy nhất (VD: LK-2026-XXXX).',
          },
        },
        {
          name: 'status',
          label: 'Trạng thái xử lý',
          type: 'select',
          defaultValue: 'new',
          required: true,
          index: true,
          admin: { width: '33%' },
          options: [
            { label: '🆕 Mới tiếp nhận', value: 'new' },
            { label: '📞 Đã gọi xác nhận', value: 'confirmed' },
            { label: '🏥 Đang tiếp nhận khám', value: 'examining' },
            { label: '✅ Đã hoàn tất', value: 'completed' },
            { label: '❌ Đã hủy hẹn', value: 'cancelled' },
          ],
        },
        {
          name: 'source',
          label: 'Nguồn đăng ký',
          type: 'select',
          defaultValue: 'website',
          admin: { width: '34%' },
          options: [
            { label: '🌐 Website trực tuyến', value: 'website' },
            { label: '📞 Điện thoại / Tổng đài', value: 'phone' },
            { label: '🏥 Tại quầy tiếp đón', value: 'counter' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: '👤 Thông tin người bệnh',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'fullName', label: 'Họ và tên', type: 'text', required: true, index: true, admin: { width: '40%' } },
            { name: 'phone', label: 'Số điện thoại', type: 'text', required: true, index: true, admin: { width: '30%' } },
            { name: 'email', label: 'Email', type: 'email', admin: { width: '30%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'dob', label: 'Ngày sinh', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } } },
            {
              name: 'gender',
              label: 'Giới tính',
              type: 'select',
              defaultValue: 'male',
              admin: { width: '33%' },
              options: [
                { label: 'Nam', value: 'male' },
                { label: 'Nữ', value: 'female' },
                { label: 'Khác', value: 'other' },
              ],
            },
            { name: 'insuranceNumber', label: 'Mã số thẻ BHYT (nếu có)', type: 'text', admin: { width: '34%', placeholder: 'VD: GD479...' } },
          ],
        },
        { name: 'address', label: 'Địa chỉ nơi ở', type: 'text' },
      ],
    },
    {
      type: 'collapsible',
      label: '🏥 Thông tin hẹn khám',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'specialty',
              label: 'Chuyên khoa đăng ký (Liên kết dữ liệu)',
              type: 'relationship',
              relationTo: 'specialties',
              index: true,
              admin: { width: '35%', description: 'Liên kết tới danh mục Chuyên khoa nếu có.' },
            },
            {
              name: 'specialtyTitle',
              label: 'Tên chuyên khoa đã chọn',
              type: 'text',
              index: true,
              admin: { width: '35%', description: 'Tên chuyên khoa người bệnh nhìn thấy và chọn trên form (kể cả chuyên khoa tự tạo).' },
            },
            {
              name: 'department',
              label: 'Khoa / Phòng tiếp nhận',
              type: 'relationship',
              relationTo: 'departments',
              admin: { width: '30%' },
              access: {
                update: appointmentDepartmentFieldAccess,
              },
            },
            {
              name: 'doctor',
              label: 'Bác sĩ mong muốn (nếu có)',
              type: 'relationship',
              relationTo: 'doctors',
              admin: { width: '30%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'appointmentDate',
              label: 'Ngày hẹn khám',
              type: 'date',
              required: true,
              index: true,
              admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
            },
            {
              name: 'timeSlot',
              label: 'Khung giờ khám (Mã kỹ thuật)',
              type: 'select',
              defaultValue: 'morning',
              admin: { width: '25%' },
              options: [
                { label: 'Buổi sáng (07:00 – 11:30)', value: 'morning' },
                { label: 'Buổi chiều (13:00 – 17:00)', value: 'afternoon' },
                { label: 'Giờ hành chính', value: 'anytime' },
              ],
            },
            {
              name: 'timeSlotLabel',
              label: 'Khung giờ người bệnh chọn',
              type: 'text',
              index: true,
              admin: { width: '25%', description: 'Tên hiển thị tiếng Việt người bệnh nhìn thấy trên web (VD: Buổi sáng: 07:00 – 10:00).' },
            },
          ],
        },
        { name: 'symptoms', label: 'Thông tin bổ sung / Triệu chứng bệnh', type: 'textarea', admin: { rows: 3 } },
      ],
    },
    {
      type: 'collapsible',
      label: '📝 Ghi chú & Xử lý nội bộ của nhân viên',
      admin: { initCollapsed: false },
      fields: [
        { name: 'staffNote', label: 'Ghi chú điều dưỡng / Tiếp đón', type: 'textarea', admin: { description: 'Ghi chú thông tin khi gọi điện thoại xác nhận với người bệnh hoặc dặn dò khi đến viện.' } },
        { name: 'confirmedAt', label: 'Thời điểm gọi xác nhận', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'customData',
      label: 'Dữ liệu các trường tùy biến bổ sung',
      type: 'json',
      admin: {
        description: 'Lưu trữ các trường thông tin do quản trị viên tự thêm (CCCD, nghề nghiệp, ghi chú...).',
      },
    },
    {
      type: 'collapsible',
      label: '🛡️ Nhật ký gửi phiếu & Bảo mật chống spam',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'submittedAt',
              label: 'Thời điểm người dùng bấm nút đặt lịch',
              type: 'date',
              index: true,
              admin: {
                readOnly: true,
                width: '34%',
                date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm:ss' },
                description: 'Ghi nhận chính xác giờ phút giây khi người bệnh bấm gửi trên trình duyệt.',
              },
            },
            {
              name: 'ipAddress',
              label: 'Địa chỉ IP người gửi',
              type: 'text',
              admin: { readOnly: true, width: '33%' },
            },
            {
              name: 'userAgent',
              label: 'Trình duyệt / Thiết bị gửi',
              type: 'text',
              admin: { readOnly: true, width: '33%' },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeOperation: [
      ({ args, operation, req }) => {
        if (operation === 'update' && (args as any)?.data?.department !== undefined) {
          const user = (req as any)?.user
          if (user) {
            const role = user.role
            const isElevated = role === 'super-admin' || role === 'system-admin' || role === 'admin'
            if (!isElevated && role !== 'clinic-schedule') {
              const userDept = typeof user.department === 'object' ? user.department?.id : user.department
              const targetDept = typeof (args as any).data.department === 'object' ? (args as any).data.department?.id : (args as any).data.department
              if (Number(targetDept) !== Number(userDept)) {
                throw new APIError('Bạn không có quyền chuyển lịch hẹn sang khoa/phòng khác.', 403)
              }
            }
          }
        }
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation === 'create' && data && !data.code) {
          const { getNextAtomicAppointmentCode } = await import('@/lib/appointment-code')
          data.code = await getNextAtomicAppointmentCode(req.payload)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ req, data, operation }) => {
        if (!req.user) return data
        const role = (req.user as any)?.role
        const isElevated = role === 'super-admin' || role === 'system-admin' || role === 'admin'
        if (isElevated || role === 'clinic-schedule') return data

        const userDept = (req.user as any)?.department
        const userDeptID = typeof userDept === 'object' && userDept ? userDept.id : userDept
        if (!userDeptID) {
          throw new APIError('Tài khoản chưa được gán khoa/phòng, không thể tạo hoặc chỉnh sửa lịch hẹn.', 403)
        }

        if (operation === 'create') {
          if (!data.department) {
            data.department = userDeptID
          } else {
            const targetDeptID = typeof data.department === 'object' && data.department ? data.department.id : data.department
            if (Number(targetDeptID) !== Number(userDeptID)) {
              throw new APIError('Bạn không có quyền tạo lịch hẹn cho khoa/phòng khác.', 403)
            }
          }
        }

        if (operation === 'update' && data.department) {
          const targetDeptID = typeof data.department === 'object' && data.department ? data.department.id : data.department
          if (Number(targetDeptID) !== Number(userDeptID)) {
            throw new APIError('Bạn không có quyền chuyển lịch hẹn sang khoa/phòng khác.', 403)
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}

