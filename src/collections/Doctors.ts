import type { CollectionConfig } from 'payload'
import { anyone, organizationDepartmentScopedAccess } from '@/access'
import { slugField, seoFields } from '@/fields/common'
import { detachNavigationReference } from '@/hooks/detachNavigationReference'

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  labels: { singular: 'Bác sĩ / Chuyên gia', plural: 'Đội ngũ Bác sĩ & Chuyên gia' },
  admin: {
    useAsTitle: 'name', group: '🩺 Chuyên môn & Tổ chức',
    defaultColumns: ['name', 'department', 'specialtyRef', 'title', 'active', 'showOnHome', 'order'],
    description: 'Hệ thống quản lý thống nhất toàn bộ Thầy thuốc, Bác sĩ và Chuyên gia hiển thị trên Trang chủ cũng như toàn bộ website.',
  },
  access: {
    read: anyone,
    create: organizationDepartmentScopedAccess('doctors', 'create'),
    update: organizationDepartmentScopedAccess('doctors', 'edit'),
    delete: organizationDepartmentScopedAccess('doctors', 'delete'),
  },
  versions: { drafts: true, maxPerDoc: 20 },
  hooks: {
    beforeDelete: [detachNavigationReference('doctors')],
    beforeValidate: [({ data, req }) => {
      const user: any = req.user
      if (!user || ['super-admin', 'system-admin', 'admin', 'hr'].includes(user.role)) return data
      const assigned = typeof user.department === 'object' ? user.department?.id : user.department
      if (assigned && data) (data as any).department = assigned
      return data
    }],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '👤 Thông tin cơ bản & Chức danh',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'name', label: 'Họ và tên bác sĩ', type: 'text', required: true, admin: { width: '50%' } },
                { name: 'degree', label: 'Học vị / Học hàm', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: PGS. TS., BSCKII, BSCKI, ThS. BS...' } },
              ],
            },
            slugField('name', 'doctors'),
            {
              type: 'row',
              fields: [
                { name: 'title', label: 'Chức vụ / Vị trí công tác', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: Giám đốc Bệnh viện, Phó Giám đốc, Trưởng khoa...' } },
                { name: 'professionalTitle', label: 'Chức danh nghề nghiệp', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: Bác sĩ cao cấp, Bác sĩ chính...' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'department', label: 'Khoa / Phòng công tác', type: 'relationship', relationTo: 'departments', required: true, admin: { width: '50%' } },
                {
                  name: 'specialtyRef', label: 'Chuyên khoa chuyên môn sâu (không bắt buộc)', type: 'relationship', relationTo: 'specialties',
                  filterOptions: ({ data }: any) => data?.department ? ({ department: { equals: typeof data.department === 'object' ? data.department.id : data.department } }) : true,
                  admin: { width: '50%', description: 'Chọn khi cần phân loại chuyên môn sâu. Không bắt buộc nếu Khoa/Phòng đã đủ.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'licenseNumber', label: 'Số chứng chỉ hành nghề (nếu công khai)', type: 'text', admin: { width: '50%', placeholder: 'VD: 012345/BYT-CCHN' } },
                { name: 'specialty', label: 'Chuyên khoa cũ (tương thích dữ liệu)', type: 'text', admin: { width: '50%', readOnly: true, description: 'Bảo toàn dữ liệu cũ.' } },
              ],
            },
            {
              name: 'avatar',
              label: 'Ảnh chân dung bác sĩ',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: '💡 Tỷ lệ đứng 3:4 chuẩn bệnh viện (600×800px hoặc 450×600px). Chụp bán thân áo blouse trắng nền sáng. Hệ thống tự động căn chỉnh phủ khít khung hình, bảo đảm tuyệt đối không biến dạng, không méo ảnh.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'avatarDisplayMode',
                  label: 'Kiểu hiển thị ảnh trên Trang chủ (Luôn full khung)',
                  type: 'select',
                  defaultValue: 'inherit',
                  options: [
                    { label: '🔄 Theo cấu hình chung của mục Chuyên gia Trang chủ (Mặc định)', value: 'inherit' },
                    { label: '⭐ Chế độ 1: Zoom xa lấy > 2/3 người + Full nền đồng màu (85%)', value: 'zoom-out-2-3' },
                    { label: '🔍 Chế độ 2: Zoom rất xa lấy trọn thân người (76%) + Full nền', value: 'zoom-out-wide' },
                    { label: '🎯 Chế độ 3: Vừa khung tiêu chuẩn lấy 2/3 người (92%) + Full nền', value: 'zoom-out-medium' },
                    { label: '📐 Chế độ 4: Lấp đầy khung canh từ đỉnh đầu xuống ngực (Cover Top)', value: 'cover-top' },
                    { label: '👤 Chế độ 5: Lấp đầy khung canh giữa thân người (Cover Body)', value: 'cover-body' },
                    { label: '⚖️ Chế độ 6: Lấp đầy khung canh chính giữa tâm ảnh (Cover Center)', value: 'cover-center' },
                    { label: '🔬 Chế độ 7: Thu gần / Zoom cận mặt rõ nét (Zoom In 115%)', value: 'zoom-in-close' },
                    { label: '↔️ Chế độ 8: Co giãn lấp đầy khít 4 cạnh khung (Fill 100%)', value: 'fill' },
                  ],
                  admin: {
                    width: '40%',
                    description: 'Chọn nhanh chế độ hiển thị ảnh cho bác sĩ này trên Trang chủ (luôn đảm bảo full khung 100%).',
                  },
                },
                {
                  name: 'avatarScale',
                  label: 'Tinh chỉnh Zoom xa (<100%) / Thu gần (>100%)',
                  type: 'number',
                  min: 40,
                  max: 200,
                  admin: {
                    width: '30%',
                    placeholder: 'VD: 85 (Zoom xa) hoặc 115 (Thu gần)',
                    description: '💡 Nhập < 100% (VD: 75–92) để ZOOM XA lấy > 2/3 người; nhập > 100% (VD: 105–135) để THU GẦN lại.',
                  },
                },
                {
                  name: 'avatarOffsetY',
                  label: 'Vị trí canh dọc ảnh (%)',
                  type: 'number',
                  min: 0,
                  max: 100,
                  admin: {
                    width: '30%',
                    placeholder: 'Mặc định 12%',
                    description: 'Điều chỉnh điểm canh dọc từ 0% (đỉnh đầu) đến 100% (chân ảnh). Khuyên dùng 8%–25%.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: '🎓 Quá trình Đào tạo - Công tác',
          fields: [
            {
              name: 'education',
              label: 'Quá trình đào tạo',
              type: 'richText',
              admin: {
                description: 'Nhập thông tin năm tốt nghiệp Đại học Y, Thạc sĩ, Chuyên khoa, Tiến sĩ, tu nghiệp nước ngoài...',
              },
            },
            {
              name: 'experience',
              label: 'Quá trình công tác',
              type: 'richText',
              admin: {
                description: 'Nhập các mốc thời gian công tác, các đơn vị y tế từng đảm nhiệm, quá trình thăng tiến...',
              },
            },
          ],
        },
        {
          label: '⭐ Thế mạnh & Kinh nghiệm chuyên môn',
          fields: [
            {
              name: 'expertise',
              label: 'Lĩnh vực chuyên môn & Thế mạnh',
              type: 'richText',
              admin: {
                description: 'Kỹ thuật chuyên sâu, mũi nhọn điều trị, phẫu thuật, can thiệp hoặc lĩnh vực phụ trách...',
              },
            },
            {
              name: 'achievements',
              label: 'Thành tích, đề tài & Công trình nghiên cứu',
              type: 'richText',
              admin: {
                description: 'Giải thưởng y học, sách biên soạn, bài báo quốc tế, đề tài nghiên cứu khoa học các cấp...',
              },
            },
          ],
        },
        {
          label: '📅 Tùy chỉnh Nút Đặt Lịch & Hộp Thông Tin',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'bookingBtnText',
                  label: 'Tiêu đề nút đặt lịch',
                  type: 'text',
                  defaultValue: 'Đặt lịch khám',
                  admin: {
                    width: '50%',
                    placeholder: 'Ví dụ: Đặt lịch khám, Đặt hẹn chuyên gia...',
                    description: 'Mặc định là "Đặt lịch khám". Bạn có thể đổi sang từ ngữ mong muốn.',
                  },
                },
                {
                  name: 'bookingBtnUrl',
                  label: 'Đường dẫn liên kết (Link đặt lịch)',
                  type: 'text',
                  defaultValue: '/dat-lich-kham',
                  admin: {
                    width: '50%',
                    placeholder: 'Ví dụ: /dat-lich-kham hoặc link ngoài https://...',
                    description: 'Mặc định liên kết đến trang "/dat-lich-kham". Có thể đổi sang bất kỳ link nào tùy ý.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'bookingBtnOpenNewTab',
                  label: 'Mở link ở tab mới (target="_blank")',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '30%',
                    description: 'Bật nếu muốn người dùng bấm mở link sang một tab mới.',
                  },
                },
                {
                  name: 'bookingNoticeText',
                  label: 'Nội dung ô thông tin bên dưới nút đặt lịch',
                  type: 'textarea',
                  defaultValue: 'Đăng ký hẹn khám trực tuyến tiếp đón ưu tiên tại viện.',
                  admin: {
                    width: '70%',
                    rows: 2,
                    placeholder: 'Ví dụ: Đăng ký hẹn khám trực tuyến tiếp đón ưu tiên tại viện.',
                    description: 'Nội dung hiển thị trong ô màu xanh bên dưới nút đặt lịch. Để trống nếu muốn ẩn ô này.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: '📝 Giới thiệu chung & Thông tin bổ sung',
          fields: [
            {
              name: 'bio',
              label: 'Tiểu sử / Lời giới thiệu tổng quan',
              type: 'richText',
              admin: {
                description: 'Lời giới thiệu tâm huyết của bác sĩ hoặc bài viết tổng hợp về thầy thuốc.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'showOnHome',
      label: 'Hiển thị ở mục Chuyên gia trên Trang chủ',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để bác sĩ xuất hiện trong khối Chuyên gia của chúng tôi trên Trang chủ. Tắt nếu chỉ muốn hiện tại trang Bác sĩ (/bac-si).',
      },
    },
    {
      name: 'showDepartment',
      label: 'Hiển thị Khoa / Phòng sau chức vụ trên Trang chủ',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để hiển thị đầy đủ Chức vụ kèm Khoa/Phòng (VD: Phó Giám đốc · Ban Giám đốc). Tắt nếu chỉ muốn hiện chức vụ (VD: Giám đốc).',
      },
    },
    {
      name: 'customSubtitle',
      label: 'Dòng thông tin phụ tùy chỉnh (Ghi đè trên Trang chủ)',
      type: 'text',
      admin: {
        position: 'sidebar',
        placeholder: 'Ví dụ: Giám đốc hoặc Phó Giám đốc - Ban Giám đốc',
        description: 'Nếu nhập tại đây, hệ thống sẽ ưu tiên hiển thị chính xác nội dung này phía dưới tên trên Trang chủ.',
      },
    },
    { name: 'order', label: 'Thứ tự hiển thị', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'featured', label: 'Bác sĩ nổi bật', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'active', label: 'Hiển thị trên website', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'showInSpecialty',
      label: 'Hiển thị ở trang Chi tiết Chuyên khoa',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để thành viên/bác sĩ này hiển thị trong khối nhân sự của trang Chi tiết Chuyên khoa. Tắt nếu không muốn hiện.',
      },
    },
    {
      name: 'showInDepartment',
      label: 'Hiển thị ở trang Chi tiết Khoa / Phòng',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để thành viên/bác sĩ này hiển thị trong khối nhân sự của trang Chi tiết Khoa / Phòng. Tắt nếu không muốn hiện.',
      },
    },
    ...seoFields,
  ],
}
