import type { CollectionConfig } from 'payload'
import { anyone, moduleAccess, ownDepartmentRecordAccess } from '@/access'
import { slugField, seoFields } from '@/fields/common'
import { detachNavigationReference } from '@/hooks/detachNavigationReference'

function isEmptyRichText(val: any): boolean {
  if (!val) return true
  if (typeof val !== 'object') return false
  const children = val?.root?.children
  if (!Array.isArray(children) || children.length === 0) return true
  if (
    children.length === 1 &&
    children[0]?.type === 'paragraph' &&
    (!Array.isArray(children[0]?.children) || children[0].children.length === 0)
  ) {
    return true
  }
  return false
}

export const Departments: CollectionConfig = {
  slug: 'departments',
  labels: { singular: 'Khoa / Phòng', plural: 'Khoa / Phòng' },
  admin: {
    useAsTitle: 'name',
    group: '🩺 Chuyên môn & Tổ chức',
    defaultColumns: ['name', 'unitType', 'leader', 'order', 'active', 'updatedAt'],
    description:
      'Hồ sơ Khoa / Phòng trực thuộc. Tự động đồng bộ & kế thừa bài viết, ảnh bìa, dịch vụ, banner từ mục Chuyên khoa tương ứng nếu đã tạo bên Chuyên khoa.',
  },
  access: {
    read: anyone,
    create: moduleAccess('departments', 'create'),
    update: ownDepartmentRecordAccess('edit'),
    delete: moduleAccess('departments', 'delete'),
  },
  hooks: {
    beforeDelete: [detachNavigationReference('departments')],
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const record: any = data || {}
        const syncEnabled = record.syncFromSpecialty ?? originalDoc?.syncFromSpecialty ?? true
        if (!syncEnabled) return record

        const deptId = record.id || originalDoc?.id
        const linkedSpecId =
          typeof record.linkedSpecialty === 'object'
            ? record.linkedSpecialty?.id
            : record.linkedSpecialty ||
              (typeof originalDoc?.linkedSpecialty === 'object'
                ? originalDoc?.linkedSpecialty?.id
                : originalDoc?.linkedSpecialty)

        let specDoc: any = null
        try {
          if (linkedSpecId) {
            specDoc = await req.payload.findByID({
              collection: 'specialties',
              id: linkedSpecId,
              depth: 0,
            })
          } else if (deptId) {
            const found = await req.payload.find({
              collection: 'specialties',
              where: { department: { equals: deptId } },
              sort: ['order', '-updatedAt'],
              limit: 1,
              depth: 0,
            })
            specDoc = found.docs?.[0] || null
          } else if (record.slug || originalDoc?.slug) {
            const slugToMatch = record.slug || originalDoc?.slug
            const found = await req.payload.find({
              collection: 'specialties',
              where: { slug: { equals: slugToMatch } },
              limit: 1,
              depth: 0,
            })
            specDoc = found.docs?.[0] || null
          }
        } catch {
          // Bỏ qua nếu chưa có bảng hoặc lỗi truy vấn
        }

        if (specDoc) {
          if (!record.linkedSpecialty && !originalDoc?.linkedSpecialty && specDoc.id) {
            record.linkedSpecialty = specDoc.id
          }
          if (!record.summary && !originalDoc?.summary && specDoc.summary) {
            record.summary = specDoc.summary
          }
          if (isEmptyRichText(record.content ?? originalDoc?.content) && !isEmptyRichText(specDoc.content)) {
            record.content = specDoc.content
          }
          if (isEmptyRichText(record.services ?? originalDoc?.services) && !isEmptyRichText(specDoc.services)) {
            record.services = specDoc.services
          }
          if (!record.cover && !originalDoc?.cover && specDoc.cover) {
            record.cover = typeof specDoc.cover === 'object' ? specDoc.cover.id : specDoc.cover
          }
          if (!record.subCover && !originalDoc?.subCover && specDoc.subCover) {
            record.subCover = typeof specDoc.subCover === 'object' ? specDoc.subCover.id : specDoc.subCover
          }
          if (!record.tagline && !originalDoc?.tagline && specDoc.tagline) {
            record.tagline = specDoc.tagline
          }
          if ((!record.icon || record.icon === 'default') && specDoc.icon && specDoc.icon !== 'default') {
            record.icon = specDoc.icon
          }
          if (!record.iconCustomUpload && !originalDoc?.iconCustomUpload && specDoc.iconCustomUpload) {
            record.iconCustomUpload =
              typeof specDoc.iconCustomUpload === 'object' ? specDoc.iconCustomUpload.id : specDoc.iconCustomUpload
          }
          if (!record.coverFitHome && specDoc.coverFitHome) {
            record.coverFitHome = specDoc.coverFitHome
          }
          if (!record.coverFitDetail && specDoc.coverFitDetail) {
            record.coverFitDetail = specDoc.coverFitDetail
          }
          if (!record.coverPosition && specDoc.coverPosition) {
            record.coverPosition = specDoc.coverPosition
          }
          const existingBanners = record.sidebarBanners ?? originalDoc?.sidebarBanners
          if ((!Array.isArray(existingBanners) || existingBanners.length === 0) && Array.isArray(specDoc.sidebarBanners) && specDoc.sidebarBanners.length > 0) {
            record.sidebarBanners = specDoc.sidebarBanners.map((b: any) => ({
              image: typeof b.image === 'object' ? b.image?.id : b.image,
              title: b.title || '',
              btnText: b.btnText || '',
              link: b.link || '',
              openNewTab: b.openNewTab !== false,
              desc: b.desc || '',
            }))
          }
          if (!record.sidebarBannersJson && !originalDoc?.sidebarBannersJson && specDoc.sidebarBannersJson) {
            record.sidebarBannersJson = specDoc.sidebarBannersJson
          }
        }

        return record
      },
    ],
  },
  // Không cần quy trình draft/publish - khoa phòng là dữ liệu hành chính, hiển thị ngay
  versions: false,
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: 'Tên khoa / phòng',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'unitType',
          label: 'Phân loại đơn vị chuẩn',
          type: 'select',
          defaultValue: 'clinical',
          options: [
            { label: 'Khoa lâm sàng', value: 'clinical' },
            { label: 'Khoa cận lâm sàng', value: 'paraclinical' },
            { label: 'Phòng chức năng', value: 'office' },
            { label: 'Ban Lãnh đạo / Đơn vị khác', value: 'other' },
          ],
          admin: {
            width: '50%',
            description: 'Phân nhóm hiển thị trên trang Khoa / Phòng và trang chủ.',
          },
        },
      ],
    },
    {
      name: 'kind',
      label: 'Nhóm đơn vị cũ (tương thích dữ liệu)',
      type: 'text',
      required: true,
      defaultValue: 'clinical',
      admin: {
        hidden: true,
        description: 'Giữ nguyên field của các phiên bản trước để không làm mất giá trị đang sử dụng.',
      },
    },
    slugField('name', 'departments'),
    {
      type: 'row',
      fields: [
        {
          name: 'linkedSpecialty',
          label: '🔗 Liên kết bài viết Chuyên khoa (Tự động kế thừa nội dung)',
          type: 'relationship',
          relationTo: 'specialties',
          admin: {
            width: '65%',
            description:
              'Nếu khoa/phòng này đã có bài viết bên mục Chuyên khoa, hệ thống sẽ tự động lấy Nội dung, Ảnh bìa, Dịch vụ, Banner... từ Chuyên khoa đó qua đây mà không cần nhập lại.',
          },
        },
        {
          name: 'syncFromSpecialty',
          label: 'Tự động lấy dữ liệu từ Chuyên khoa nếu để trống',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '35%',
            description: 'Bật để tự động kế thừa bài viết & ảnh từ Chuyên khoa liên kết.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'icon',
          label: 'Biểu tượng khoa / phòng (Icon theo danh mục)',
          type: 'select',
          defaultValue: 'default',
          options: [
            { label: 'Tự động theo tên khoa/phòng (Khuyên dùng)', value: 'default' },
            { label: 'Cấp cứu & Hồi sức (Trái tim / Chữ thập)', value: 'emergency' },
            { label: 'Chẩn đoán hình ảnh (X-quang, Siêu âm, CT)', value: 'imaging' },
            { label: 'Xét nghiệm & Kiểm soát nhiễm khuẩn (Khiên chắn, Kính hiển vi)', value: 'lab' },
            { label: 'Khoa Nhi (Trẻ em & Mẹ)', value: 'pediatrics' },
            { label: 'Khoa Ngoại & Phẫu thuật (Dao mổ, Dụng cụ)', value: 'surgery' },
            { label: 'Khoa Nội tổng hợp (Ống nghe, Y tế chung)', value: 'internal' },
            { label: 'Dược & Cấp phát thuốc (Viên thuốc, Hộp thuốc)', value: 'pharmacy' },
            { label: 'Răng Hàm Mặt & Mắt (Nụ cười, Thị lực)', value: 'dental' },
            { label: 'Y học cổ truyền & Phục hồi chức năng (Bàn tay, Lá cây)', value: 'rehab' },
          ],
          admin: {
            width: '33.33%',
            description: 'Lựa chọn biểu tượng có sẵn theo chuyên môn.',
          },
        },
        {
          name: 'iconCustomUpload',
          label: 'Hoặc tải lên Icon riêng (Tùy chọn)',
          type: 'upload',
          relationTo: 'media',
          admin: {
            width: '33.33%',
            description: 'Tải ảnh icon riêng (SVG/PNG nền trong suốt). Ưu tiên cao hơn danh sách chọn.',
          },
        },
        {
          name: 'tagline',
          label: 'Dòng kỹ thuật / nhiệm vụ trọng tâm (Tagline)',
          type: 'text',
          admin: {
            width: '33.33%',
            placeholder: 'VD: Cấp cứu 24/7 • Đơn nguyên ICU',
            description: 'Dòng mô tả ngắn gọn 2-5 từ xuất hiện ngay dưới tên khoa/phòng.',
          },
        },
      ],
    },
    {
      name: 'summary',
      label: 'Giới thiệu ngắn (Để trống sẽ tự lấy từ Chuyên khoa)',
      type: 'textarea',
    },
    {
      name: 'content',
      label: 'Giới thiệu chi tiết (Để trống sẽ tự lấy bài viết từ Chuyên khoa)',
      type: 'richText',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cover',
          label: '🖼️ Ảnh đại diện chính (Để trống tự lấy từ Chuyên khoa)',
          type: 'upload',
          relationTo: 'media',
          admin: {
            width: '40%',
            description:
              '💡 Ảnh lớn 16:9 hoặc 3:2 (khoảng 1200×675px). Nếu đã tải ảnh bên Chuyên khoa thì không cần tải lại.',
          },
        },
        {
          name: 'showSubCover',
          label: 'Bật ảnh phụ nhỏ 3D góc dưới',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '20%',
            description: 'TẮT nếu không muốn ảnh nhỏ góc dưới che mất chi tiết của ảnh lớn chính.',
          },
        },
        {
          name: 'subCover',
          label: '🖼️ Ảnh phụ nổi 3D (Ảnh nhỏ góc dưới)',
          type: 'upload',
          relationTo: 'media',
          admin: {
            width: '40%',
            condition: (_data, siblingData) => siblingData?.showSubCover !== false,
            description: '💡 Ảnh nhỏ nổi 3D lồng ghép nghệ thuật góc dưới phải.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'coverFitHome',
          label: '🖼️ Cách hiển thị ảnh ở DANH SÁCH & TRANG CHỦ',
          type: 'select',
          defaultValue: 'cover-top',
          options: [
            { label: 'Lấp đầy khung - Canh đỉnh đầu / mặt bác sĩ (Khuyên dùng - cover-top)', value: 'cover-top' },
            { label: 'Vừa vặn khung, trọn vẹn 100% không bị cắt (contain)', value: 'contain' },
            { label: 'Lấp đầy khung - Canh chính giữa tâm ảnh (cover-center)', value: 'cover-center' },
            { label: 'Lấp đầy khung - Canh phần dưới (cover-bottom)', value: 'cover-bottom' },
            { label: 'Lấp đầy khung chuẩn (cover)', value: 'cover' },
            { label: 'Co giãn vừa kín khung ảnh (fill)', value: 'fill' },
          ],
          admin: {
            width: '50%',
            description: 'Tùy chọn hiển thị cho thẻ Khoa / Phòng.',
          },
        },
        {
          name: 'coverFitDetail',
          label: '🖼️ Cách hiển thị ảnh TRONG TRANG CHI TIẾT',
          type: 'select',
          defaultValue: 'contain',
          options: [
            { label: 'Vừa vặn khung, trọn vẹn 100% không bị cắt (Khuyên dùng - contain)', value: 'contain' },
            { label: 'Lấp đầy khung - Canh đỉnh đầu / phần trên (cover-top)', value: 'cover-top' },
            { label: 'Lấp đầy khung - Canh chính giữa tâm ảnh (cover-center)', value: 'cover-center' },
            { label: 'Lấp đầy khung - Canh phần dưới (cover-bottom)', value: 'cover-bottom' },
            { label: 'Lấp đầy khung chuẩn (cover)', value: 'cover' },
            { label: 'Co giãn vừa kín khung ảnh (fill)', value: 'fill' },
          ],
          admin: {
            width: '50%',
            description: 'Tùy chọn hiển thị cho Khung ảnh lớn trên trang chi tiết khoa/phòng.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'coverPosition',
          label: 'Điểm lấy nét ảnh (Trọng tâm)',
          type: 'select',
          defaultValue: 'top',
          options: [
            { label: 'Ưu tiên phần trên (Lấy rõ đầu/mặt - Mặc định)', value: 'top' },
            { label: 'Chính giữa ảnh (Center)', value: 'center' },
            { label: 'Ưu tiên phần dưới (Bottom)', value: 'bottom' },
          ],
          admin: {
            width: '50%',
            description: 'Chỉnh góc lấy nét khi ảnh bị xén mất phần đầu hoặc khuôn mặt.',
          },
        },
      ],
    },
    {
      name: 'services',
      label: 'Dịch vụ & Kỹ thuật mũi nhọn (Để trống tự lấy từ Chuyên khoa)',
      type: 'richText',
    },
    {
      type: 'collapsible',
      label: '🏛️ Thông tin Hành chính – Ban Chủ nhiệm – Chức năng Nhiệm vụ Khoa/Phòng',
      admin: {
        initCollapsed: false,
        description: 'Thông tin lãnh đạo khoa/phòng, liên hệ, vị trí, chức năng nhiệm vụ, hoạt động và thành tích.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'leader', label: 'Trưởng khoa / phòng', type: 'text', admin: { width: '50%' } },
            { name: 'location', label: 'Vị trí / Khu nhà', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'phone', label: 'Số điện thoại liên hệ', type: 'text', admin: { width: '50%' } },
            { name: 'email', label: 'Email công vụ', type: 'email', admin: { width: '50%' } },
          ],
        },
        {
          name: 'deputyLeaders',
          label: 'Phó trưởng khoa / phòng',
          type: 'array',
          fields: [
            { name: 'name', label: 'Họ và tên', type: 'text', required: true },
            { name: 'title', label: 'Chức danh', type: 'text' },
          ],
        },
        { name: 'functions', label: 'Chức năng – Nhiệm vụ bổ sung (Tùy chọn)', type: 'richText' },
        { name: 'activities', label: 'Hoạt động chuyên môn bổ sung (Tùy chọn)', type: 'richText' },
        { name: 'achievements', label: 'Thành tích & Điểm nổi bật (Tùy chọn)', type: 'richText' },
        {
          name: 'gallery',
          label: 'Thư viện hình ảnh hoạt động đơn vị',
          type: 'array',
          fields: [
            { name: 'image', label: 'Hình ảnh', type: 'upload', relationTo: 'media', required: true },
            { name: 'caption', label: 'Chú thích', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: '⚙️ Cấu hình Trang Chi Tiết & Bật/Tắt các khối (Sidebar, Bác sĩ, Phác đồ, Banner)',
      admin: {
        initCollapsed: false,
        description:
          'Tùy chỉnh bật/tắt độc lập từng khối nội dung trên trang chi tiết Khoa / Phòng (giống hệt Chuyên khoa) và chèn thêm các banner quảng cáo ở sidebar bên trái.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'showDepartmentCard',
              label: 'Hiển thị khối "Thông tin đơn vị" (Sidebar)',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
            {
              name: 'showBookingCard',
              label: 'Hiển thị khối "Đăng ký khám bệnh" (Sidebar)',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          admin: {
            condition: (_data, siblingData) => siblingData?.showBookingCard !== false,
          },
          fields: [
            {
              name: 'customBookingTitle',
              label: 'Tiêu đề khối Đăng ký (Ghi đè mặc định)',
              type: 'text',
              admin: { width: '50%', placeholder: 'Ví dụ: Đăng ký khám bệnh' },
            },
            {
              name: 'customBookingButtonLabel',
              label: 'Tên nút đặt khám',
              type: 'text',
              admin: { width: '50%', placeholder: 'Ví dụ: Đặt khám trực tuyến' },
            },
          ],
        },
        {
          type: 'row',
          admin: {
            condition: (_data, siblingData) => siblingData?.showBookingCard !== false,
          },
          fields: [
            {
              name: 'customBookingButtonUrl',
              label: 'Đường dẫn liên kết nút đặt khám (Để trống dùng Medpro)',
              type: 'text',
              admin: { width: '50%', placeholder: 'https://medpro.vn/...' },
            },
            {
              name: 'customHotline',
              label: 'Số Hotline tiếp nhận riêng (Nếu khác hotline bệnh viện)',
              type: 'text',
              admin: { width: '50%', placeholder: '02923686115' },
            },
          ],
        },
        {
          name: 'customBookingDesc',
          label: 'Mô tả khối Đăng ký (Để trống dùng mặc định)',
          type: 'textarea',
          admin: {
            condition: (_data, siblingData) => siblingData?.showBookingCard !== false,
            placeholder: 'Chủ động chọn bác sĩ và thời gian khám qua cổng đăng ký trực tuyến...',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'showNoticeBox',
              label: 'Hiển thị khối "Lưu ý BHYT & Giờ trực" (Sidebar)',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
            {
              name: 'customNoticeText',
              label: 'Nội dung khối lưu ý (Ghi đè mặc định)',
              type: 'text',
              admin: {
                width: '50%',
                condition: (_data, siblingData) => siblingData?.showNoticeBox !== false,
                placeholder: 'Ví dụ: Áp dụng đầy đủ quyền lợi BHYT đúng tuyến...',
              },
            },
          ],
        },
        {
          name: 'sidebarBanners',
          label: '🖼️ Danh sách Banner Quảng cáo / Tiện ích (Chọn ảnh & Thêm trực quan)',
          type: 'array',
          labels: { singular: 'Banner', plural: 'Các Banner quảng cáo' },
          admin: {
            description:
              'Bấm "Thêm Banner" để tải lên hoặc chọn ảnh từ thư viện. Nếu để trống sẽ tự lấy Banner của Chuyên khoa liên kết.',
            initCollapsed: false,
          },
          fields: [
            {
              name: 'image',
              label: 'Ảnh Banner',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Tải ảnh mới hoặc chọn ảnh từ thư viện media của bệnh viện.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'title',
                  label: 'Tiêu đề Banner (Tùy chọn)',
                  type: 'text',
                  admin: { width: '50%', placeholder: 'Ví dụ: Gói tầm soát sức khỏe' },
                },
                {
                  name: 'btnText',
                  label: 'Tên nút bấm (Tùy chọn)',
                  type: 'text',
                  admin: { width: '50%', placeholder: 'Ví dụ: Xem chi tiết' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'link',
                  label: 'Đường dẫn liên kết khi bấm vào',
                  type: 'text',
                  admin: { width: '70%', placeholder: '/bang-gia hoặc https://...' },
                },
                {
                  name: 'openNewTab',
                  label: 'Mở tab mới',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { width: '30%' },
                },
              ],
            },
            {
              name: 'desc',
              label: 'Mô tả ngắn (Tùy chọn)',
              type: 'textarea',
              admin: { placeholder: 'Nội dung phụ tóm tắt chương trình hoặc tiện ích...' },
            },
          ],
        },
        {
          name: 'sidebarBannersJson',
          label: 'Danh sách Banner bổ sung nâng cao (JSON tùy ý - Tùy chọn)',
          type: 'textarea',
          admin: {
            description: '💡 (Dành cho nâng cao) Nếu đã dùng danh sách chọn ảnh ở trên thì có thể để trống ô này.',
            placeholder: '[{"title": "TIÊM CHỦNG VẮC XIN", "desc": "Danh mục vắc xin mới nhất", "btnText": "Xem lịch tiêm", "link": "/tiem-chung"}]',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'showCoverImage',
              label: 'Hiển thị Ảnh bìa khoa / phòng',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
            {
              name: 'showSummaryLead',
              label: 'Hiển thị dòng Tóm tắt chuyên môn',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'showContentSection',
              label: 'Hiển thị khối "Giới thiệu chuyên môn" (RichText)',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
            {
              name: 'showServicesSection',
              label: 'Hiển thị khối "Dịch vụ & Kỹ thuật mũi nhọn"',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'showDoctorsSection',
              label: 'Hiển thị khối "Đội ngũ Bác sĩ / Nhân sự"',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '33.33%' },
            },
            {
              name: 'showProtocolsSection',
              label: 'Hiển thị khối "Phác đồ & Hướng dẫn điều trị"',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '33.33%' },
            },
            {
              name: 'showRelatedSection',
              label: 'Hiển thị khối "Các đơn vị / chuyên khoa liên quan"',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '33.33%' },
            },
          ],
        },
      ],
    },
    { name: 'order', label: 'Thứ tự hiển thị', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'active', label: 'Hiển thị trên website', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'showSpecialtiesSection',
      label: 'Hiển thị khối Chuyên khoa trực thuộc',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để hiển thị danh sách các Chuyên khoa trực thuộc khoa/phòng này trên trang chi tiết.',
      },
    },
    {
      name: 'showMembersSection',
      label: 'Hiển thị khối Đội ngũ nhân sự / Cán bộ y tế',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Bật để hiển thị khối danh sách các y bác sĩ, điều dưỡng, kỹ sư/cán bộ công tác tại khoa/phòng.',
      },
    },
    {
      name: 'membersSectionTitle',
      label: 'Tiêu đề khối nhân sự (Tùy chỉnh)',
      type: 'text',
      admin: {
        position: 'sidebar',
        placeholder: 'Mặc định: Đội ngũ Bác sĩ & Nhân sự chuyên môn',
        description: 'Tùy chỉnh tiêu đề hiển thị cho khối nhân sự.',
      },
    },
    ...seoFields,
  ],
}

