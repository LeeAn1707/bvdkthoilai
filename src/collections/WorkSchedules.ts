import type { CollectionConfig } from 'payload'
import { moduleAccess, publicActiveFor } from '@/access'

export const WorkSchedules: CollectionConfig = {
  slug: 'work-schedules',
  labels: { singular: 'Lịch công tác tuần', plural: 'Lịch làm việc cơ quan' },
  admin: {
    useAsTitle: 'title',
    group: '🏥 Khám bệnh & Dịch vụ Y tế',
    defaultColumns: ['title', 'documentNumber', 'weekNumber', 'year', 'displayMode', 'active', 'updatedAt'],
    description: 'Đăng và quản lý Lịch làm việc & Lịch công tác tuần của Ban Giám đốc và Cơ quan BVĐK Khu vực Thới Lai theo chuẩn mẫu hành chính Cần Thơ.',
  },
  access: {
    read: publicActiveFor('work-schedules'),
    create: moduleAccess('work-schedules', 'create'),
    update: moduleAccess('work-schedules', 'edit'),
    delete: moduleAccess('work-schedules', 'delete'),
  },
  trash: true,
  versions: { drafts: { autosave: true }, maxPerDoc: 30 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '📋 Thông tin công văn & Chế độ xem',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'title',
                  label: 'Tiêu đề thông báo lịch',
                  type: 'text',
                  required: true,
                  defaultValue: 'LỊCH CÔNG TÁC TUẦN',
                  admin: { width: '60%', placeholder: 'VD: LỊCH CÔNG TÁC TUẦN (Từ ngày 21/9/2026 – 25/9/2026)' },
                },
                {
                  name: 'displayMode',
                  label: '2 TÙY CHỌN HIỂN THỊ CHÍNH',
                  type: 'select',
                  required: true,
                  defaultValue: 'table',
                  options: [
                    { label: '📊 Tùy chọn 1: Bảng lịch biểu chi tiết (Sáng / Chiều theo thứ)', value: 'table' },
                    { label: '📄 Tùy chọn 2: Nhúng xem file đính kèm trực tiếp (PDF / Word / Ảnh)', value: 'viewer' },
                  ],
                  admin: {
                    width: '40%',
                    description: 'Chọn "Bảng lịch biểu" để hiển thị bảng công tác tuần chuẩn Cần Thơ hoặc "Nhúng xem file" để hiển thị trình xem file trực tiếp.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'documentNumber',
                  label: 'Số hiệu văn bản',
                  type: 'text',
                  defaultValue: '08/LLV - BVĐKKVTL',
                  admin: { width: '35%', placeholder: 'VD: 08/LLV - BVĐKKVTL' },
                },
                {
                  name: 'revision',
                  label: 'Phiên bản / Lần chỉnh sửa (nếu có)',
                  type: 'text',
                  admin: { width: '35%', placeholder: 'VD: CHỈNH SỬA 02' },
                },
                {
                  name: 'active',
                  label: 'Áp dụng công khai',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { width: '30%', description: 'Hiển thị công khai trên website.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'weekNumber',
                  label: 'Tuần thứ',
                  type: 'number',
                  required: true,
                  min: 1,
                  max: 53,
                  admin: { width: '25%', placeholder: 'VD: 39' },
                },
                {
                  name: 'year',
                  label: 'Năm',
                  type: 'number',
                  required: true,
                  defaultValue: 2026,
                  admin: { width: '25%', placeholder: 'VD: 2026' },
                },
                {
                  name: 'startDate',
                  label: 'Từ ngày (Bắt đầu tuần)',
                  type: 'date',
                  admin: { width: '25%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
                },
                {
                  name: 'endDate',
                  label: 'Đến ngày (Kết thúc tuần)',
                  type: 'date',
                  admin: { width: '25%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
                },
              ],
            },
            {
              name: 'workScheduleHelper',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/components/admin/WorkScheduleAdminHelper#default',
                },
              },
            },
          ],
        },
        {
          label: '📅 Bảng chi tiết Lịch tuần (Sáng / Chiều)',
          admin: {
            condition: (_data, siblingData) => !siblingData?.displayMode || siblingData?.displayMode === 'table',
          },
          fields: [
            {
              name: 'daysHelper',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/components/admin/WorkScheduleDaysHelper#default',
                },
              },
            },
            {
              name: 'days',
              label: 'Lịch công tác từng ngày trong tuần (Thứ 2 đến Thứ 6 / CN)',
              type: 'array',
              admin: {
                initCollapsed: false,
                description: 'Nhập nội dung công tác Sáng / Chiều cho từng ngày. Bạn có thể bấm nút "⚡ Điền sẵn Thứ 2 → Thứ 6" ở trên để tự động điền ngày tháng theo tuần.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'dayLabel',
                      label: 'Thứ trong tuần',
                      type: 'text',
                      required: true,
                      admin: { width: '50%', placeholder: 'VD: Thứ hai, Thứ ba, Thứ tư...' },
                    },
                    {
                      name: 'dateFormatted',
                      label: 'Ngày cụ thể',
                      type: 'text',
                      admin: { width: '50%', placeholder: 'VD: (21/9/26) hoặc 21/09/2026' },
                    },
                  ],
                },
                {
                  name: 'morningContent',
                  label: 'Buổi Sáng',
                  type: 'textarea',
                  admin: {
                    rows: 3,
                    placeholder: 'VD: - 8h00: Ban giám đốc, phòng TCHC, P. KHTH... tiếp đoàn thẩm định SYT tại Hội trường giao ban',
                  },
                },
                {
                  name: 'afternoonContent',
                  label: 'Buổi Chiều',
                  type: 'textarea',
                  admin: {
                    rows: 3,
                    placeholder: 'VD: - 13h00: Bs Hạnh, Bs Huy tham gia đoàn công tác hỗ trợ chuyên môn kỹ thuật tại BVĐKKV Cái Răng',
                  },
                },
                {
                  name: 'note',
                  label: 'Ghi chú cho ngày này (nếu có)',
                  type: 'text',
                  admin: { placeholder: 'Ghi chú thêm...' },
                },
              ],
            },
          ],
        },
        {
          label: '📎 Tệp đính kèm & Ảnh chụp gốc',
          fields: [
            {
              name: 'attachedFile',
              label: 'Tệp văn bản lịch công tác (PDF / Word / Excel)',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Tệp đính kèm chính thức (được dùng để nhúng xem trực tiếp khi chọn Tùy chọn 2 và cho phép người xem tải về).',
              },
            },
            {
              name: 'scannedImage',
              label: 'Ảnh chụp văn bản lịch tuần (JPG / PNG có mộc đỏ)',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Ảnh chụp bản in có chữ ký và mộc đỏ để hiển thị xem trực tiếp hoặc làm ảnh minh họa.',
              },
            },
            {
              name: 'generalNote',
              label: 'Ghi chú chung chân trang',
              type: 'textarea',
              defaultValue: 'Tùy tình hình thực tế, Lịch làm việc này có thể thay đổi, Bệnh viện Đa khoa khu vực Thới Lai sẽ có thông báo sau./.',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'signerRole',
                  label: 'Chức vụ người ký',
                  type: 'text',
                  defaultValue: 'TL. GIÁM ĐỐC',
                  admin: { width: '50%', placeholder: 'VD: TL. GIÁM ĐỐC hoặc GIÁM ĐỐC' },
                },
                {
                  name: 'signerName',
                  label: 'Họ tên người ký',
                  type: 'text',
                  defaultValue: 'DSCKI. Dương Văn Bé',
                  admin: { width: '50%', placeholder: 'VD: DSCKI. Dương Văn Bé' },
                },
              ],
            },
          ],
        },
        {
          label: '📜 Nhật ký chỉnh sửa (Admin)',
          fields: [
            {
              name: 'auditHistoryView',
              type: 'ui',
              admin: {
                components: {
                  Field: '/src/components/admin/WorkScheduleAuditView#default',
                },
              },
            },
          ],
        },
      ],
    },
  ],
}
