import type { Field, GlobalConfig } from 'payload'
import { moduleAccess } from '@/access'
import { resolveHomepageLinks } from '@/lib/managedLinks'

// Helper: field màu với ColorPickerField custom component
const colorField = (name: string, label: string, opts?: Partial<Field>): Field => ({
  name,
  label,
  type: 'text',
  admin: {
    components: {
      Field: '/src/components/admin/ColorPickerField#default',
    },
    ...((opts as any)?.admin || {}),
  },
  ...(opts || {}),
} as Field)

const smartLinkFields = (): Field[] => [
  {
    name: 'linkMode',
    label: 'Cách tạo liên kết',
    type: 'select',
    defaultValue: 'internal',
    options: [
      { label: 'Tự tạo trang mới / tự dùng trang đã có cùng slug', value: 'auto-page' },
      { label: 'Chọn một Trang nội dung đã có', value: 'existing-page' },
      { label: 'Nhập đường dẫn nội bộ', value: 'internal' },
      { label: 'Liên kết website bên ngoài', value: 'external' },
    ],
    admin: { description: 'Nếu chưa có trang, chọn Tự tạo trang mới. Nếu trang đã có, chọn trực tiếp để lấy đúng liên kết.' },
  },
  {
    name: 'linkedPage',
    label: 'Chọn trang đã có',
    type: 'relationship',
    relationTo: 'pages',
    admin: { condition: (_data, siblingData) => siblingData?.linkMode === 'existing-page' },
  },
  {
    name: 'newPageTitle',
    label: 'Tên trang sẽ tự tạo',
    type: 'text',
    admin: {
      condition: (_data, siblingData) => siblingData?.linkMode === 'auto-page',
      description: 'Để trống sẽ dùng tiêu đề nội dung. Hệ thống tự sinh slug và tự dùng trang cùng slug nếu đã tồn tại.',
    },
  },
  {
    name: 'newPageSlug',
    label: 'Slug trang mới (không bắt buộc)',
    type: 'text',
    admin: { condition: (_data, siblingData) => siblingData?.linkMode === 'auto-page' },
  },
  {
    name: 'url',
    label: 'Liên kết',
    type: 'text',
    admin: {
      condition: (_data, siblingData) => !siblingData?.linkMode || siblingData?.linkMode === 'internal' || siblingData?.linkMode === 'external',
      description: 'Khi chọn Tự tạo trang hoặc Chọn trang đã có, hệ thống tự sinh trường này lúc lưu.',
    },
  },
]

const defaultHomepageSections = [
  { type: 'featured-news', eyebrow: 'HOẠT ĐỘNG NỔI BẬT TẠI BỆNH VIỆN', title: 'Điểm tin Bệnh viện Đa khoa khu vực Thới Lai', description: 'Các hoạt động chuyên môn, chăm sóc người bệnh và sự kiện tiêu biểu mới nhất.', visible: true },
  { type: 'advanced-techniques', eyebrow: 'CHUYÊN KHOA & CÔNG NGHỆ Y TẾ', title: 'Kỹ thuật chuyên sâu', description: 'Tiên phong ứng dụng các kỹ thuật cao, trang thiết bị hiện đại phục vụ chăm sóc và điều trị.', visible: true, techniqueItemsPerView: 3, techniqueAutoplaySeconds: 5, cardBarBgColor: '#f0f7fd', cardBarTextColor: '#0754a8' },
  { type: 'our-experts', eyebrow: 'ĐỘI NGŨ Y BÁC SĨ', title: 'Chuyên gia của chúng tôi', description: 'Đội ngũ bác sĩ giàu kinh nghiệm, chuyên môn sâu, luôn tận tâm vì sức khỏe người bệnh.', visible: true, expertItemsPerView: 4, expertAutoplaySeconds: 5, expertCardBgColor: '#f0f7fd', expertCardTextColor: '#0754a8' },
  { type: 'news-portal', eyebrow: 'CỔNG THÔNG TIN BỆNH VIỆN', title: 'Trang tin tức Bệnh viện', visible: true },
  { type: 'organization', eyebrow: 'TỔ CHỨC BỆNH VIỆN', title: 'Đơn vị trực thuộc', visible: true },
  { type: 'notices', eyebrow: 'THÔNG BÁO', title: 'Thông báo mới từ bệnh viện', description: 'Cập nhật thông tin quan trọng dành cho người bệnh và cộng đồng.', visible: true },
  { type: 'procurement', eyebrow: 'CÔNG KHAI MUA SẮM', title: 'Đấu thầu – Mua sắm', description: 'Thông tin mời thầu, kế hoạch lựa chọn nhà thầu và kết quả mua sắm.', visible: true },
  { type: 'schedules', eyebrow: 'THÔNG TIN KHÁM BỆNH', title: 'Lịch khám bệnh', description: 'Tra cứu bác sĩ, chuyên khoa, thời gian và phòng khám trước khi đến bệnh viện.', visible: true, scheduleTabOrder: [{ tab: 'emergency', visible: true }, { tab: 'daily', visible: true }, { tab: 'weekly', visible: true }, { tab: 'attachments', visible: true }] },
  { type: 'vaccinations', eyebrow: 'TIÊM NGỪA AN TOÀN', title: 'Thông tin tiêm ngừa', description: 'Thông báo lịch tiêm chung, các đợt tiêm và danh mục vắc xin tại bệnh viện.', visible: true, vaccinationTabOrder: [{ tab: 'announcements', visible: true }, { tab: 'campaigns', visible: true }, { tab: 'vaccines', visible: true }] },
  { type: 'science', eyebrow: 'CHUYÊN MÔN – ĐÀO TẠO', title: 'Hoạt động khoa học', visible: true },
  { type: 'introduction', eyebrow: 'VỀ CHÚNG TÔI', title: 'Đồng hành cùng sức khỏe cộng đồng', visible: true },
  { type: 'documents', eyebrow: 'TÀI LIỆU CÔNG KHAI', title: 'Văn bản mới', description: 'Quyết định, biểu mẫu và tài liệu được cập nhật từ hệ thống quản trị.', visible: true },
  { type: 'cantho-health-dept', eyebrow: 'CHỈ ĐẠO & TIN TỨC NGÀNH', title: 'Sở Y tế thành phố Cần Thơ', description: 'Cập nhật tin tức hoạt động, văn bản chỉ đạo điều hành từ cơ quan chủ quản ngành Y tế.', visible: true },
]

const defaultNewsTabs = [
  { label: 'Tin bệnh viện', values: [{ value: 'Hoạt động bệnh viện' }] },
  { label: 'Tin y tế', values: [{ value: 'Tin y tế' }] },
  { label: 'Kiến thức sức khỏe', values: [{ value: 'Kiến thức sức khỏe' }, { value: 'Thông tin cho người bệnh' }] },
  { label: 'Đào tạo – nghiên cứu', values: [{ value: 'Đào tạo – nghiên cứu' }, { value: 'Đào tạo – Tập huấn' }, { value: 'Hội nghị – Hội thảo' }] },
]

const defaultScienceTabs = [
  { label: 'Đào tạo – Tập huấn', values: [{ value: 'Đào tạo – Tập huấn' }, { value: 'Đào tạo – nghiên cứu' }] },
  { label: 'Hội nghị – Hội thảo', values: [{ value: 'Hội nghị – Hội thảo' }] },
  { label: 'Kiến thức y khoa', values: [{ value: 'Kiến thức sức khỏe' }] },
]

const defaultDepartmentTabs = [
  { label: 'Khối lâm sàng', values: [{ value: 'clinical' }, { value: 'department' }] },
  { label: 'Khối cận lâm sàng', values: [{ value: 'paraclinical' }] },
  { label: 'Phòng chức năng', values: [{ value: 'office' }] },
]

const defaultScheduleTabs = [
  { label: 'Lịch trực cấp cứu', tab: 'emergency', visible: true },
  { label: 'Theo ngày', tab: 'daily', visible: true },
  { label: 'Theo tuần', tab: 'weekly', visible: true },
  { label: 'Lịch đính kèm', tab: 'attachments', visible: true },
]

const defaultVaccinationTabs = [
  { label: 'Thông báo lịch tiêm', tab: 'announcements', visible: true },
  { label: 'Tiêm ngừa theo đợt', tab: 'campaigns', visible: true },
  { label: 'Các loại vắc xin', tab: 'vaccines', visible: true },
]

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Giao diện & bố cục trang chủ',
  admin: {
    group: '🌐 Trang chủ & Giao diện Website',
    description: 'Quản lý banner, nội dung, thứ tự, màu sắc và cỡ chữ của các mục trên trang chủ.',
  },
  access: { read: () => true, update: moduleAccess('homepage', 'edit') },
  versions: { drafts: true, max: 20 },
  hooks: {
    beforeChange: [async ({ data, req }) => resolveHomepageLinks(req, data)],
  },
  // Không dùng afterRead để tự bổ sung section đã bị xóa.
  // defaultValue bên dưới chỉ seed cấu hình lần đầu; sau đó Admin có toàn quyền
  // thêm/xóa/ẩn/hiện/sắp xếp mà frontend phải tôn trọng đúng dữ liệu đã lưu.
  fields: [
    {
      name: 'hero',
      label: 'Banner mặc định (dự phòng)',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Nhãn nhỏ', type: 'text', defaultValue: 'BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI' },
        { name: 'title', label: 'Tiêu đề', type: 'text', defaultValue: 'Chăm sóc sức khỏe tận tâm, thuận tiện và an toàn' },
        { name: 'description', label: 'Mô tả', type: 'textarea' },
        {
          name: 'desktopImage',
          label: 'Ảnh Desktop',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Kích thước chuẩn khuyến nghị: 1920 × 600 px (tỉ lệ 16:5 hoặc 3.2:1). Tối thiểu rộng 1400px để hiển thị sắc nét trên màn hình máy tính.',
          },
        },
        {
          name: 'mobileImage',
          label: 'Ảnh Mobile',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Kích thước chuẩn điện thoại: 1080 × 608 px (tỉ lệ 16:9) hoặc 1080 × 540 px (tỉ lệ 2:1). Hiển thị vừa khít trọn vẹn màn hình smartphone.',
          },
        },
      ],
    },
    {
      name: 'banners',
      label: 'Banner trang chủ',
      type: 'array',
      maxRows: 10,
      admin: { description: 'Thêm nhiều banner và kéo thả để đổi thứ tự. Website tự chuyển lần lượt theo số giây cấu hình bên dưới. Ảnh có thể tải mới hoặc chọn lại từ Thư viện Tệp & Hình ảnh.' },
      defaultValue: [
        { eyebrow: 'BỆNH VIỆN ĐA KHOA KHU VỰC THỚI LAI', title: 'Chăm sóc sức khỏe tận tâm, thuận tiện và an toàn', description: 'Tra cứu lịch khám, dịch vụ y tế và thông tin bệnh viện nhanh chóng.', buttonLabel: 'Xem lịch khám', buttonUrl: '/lich-kham' },
        { eyebrow: 'TIÊM CHỦNG AN TOÀN', title: 'Theo dõi lịch tiêm chủng và đăng ký thuận tiện', description: 'Cập nhật lịch tiêm và các hướng dẫn cần thiết cho người dân.', buttonLabel: 'Xem lịch tiêm', buttonUrl: '/tiem-chung' },
        { eyebrow: 'DỊCH VỤ Y TẾ', title: 'Chủ động đặt lịch khám trực tuyến', description: 'Lựa chọn thời gian phù hợp và chuẩn bị thông tin trước khi đến khám.', buttonLabel: 'Đặt lịch khám', buttonUrl: 'https://medpro.vn/' },
      ],
      fields: [
        { name: 'eyebrow', label: 'Nhãn nhỏ', type: 'text', required: true },
        { name: 'title', label: 'Tiêu đề banner', type: 'text', required: true },
        {
          name: 'description',
          label: 'Mô tả & Tùy chỉnh kích thước hiển thị',
          type: 'textarea',
          admin: {
            description: 'Nhập mô tả bình thường. Nếu là ảnh chụp thật tập thể muốn chỉnh kích thước/tỉ lệ, anh/chị có thể dán thêm từ khóa vào cuối mô tả: [ratio:16/9] (chuẩn chụp ngang tập thể), [ratio:2/1] (rộng vừa mắt), [ratio:4/3] (chụp đứng/gần), [height:500px] (độ cao tùy ý), [fit:contain] (giữ 100% ảnh không cắt viền), [fit:cover] (phủ kín khung).',
          },
        },
        {
          name: 'desktopImage',
          label: 'Ảnh banner Desktop',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Kích thước chuẩn khuyến nghị: 1920 × 600 px (tỉ lệ 16:5 hoặc 3.2:1). Tối thiểu rộng 1400px để hiển thị sắc nét trên màn hình máy tính.',
          },
        },
        {
          name: 'mobileImage',
          label: 'Ảnh banner Mobile',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Kích thước chuẩn điện thoại: 1080 × 608 px (tỉ lệ 16:9) hoặc 1080 × 540 px (tỉ lệ 2:1). Hiển thị vừa khít trọn vẹn màn hình smartphone.',
          },
        },
        { name: 'buttonLabel', label: 'Nhãn nút', type: 'text' },
        { name: 'buttonUrl', label: 'Liên kết nút', type: 'text' },
        { name: 'visible', label: 'Hiển thị', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'showHeroBanners',
      label: 'Hiển thị banner lớn dưới menu',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Bỏ dấu chọn để ẩn toàn bộ banner dưới menu. Các banner đã nhập vẫn được giữ nguyên để bật lại sau.' },
    },
    {
      name: 'bannerAutoplaySeconds',
      label: 'Thời gian tự chuyển banner (giây)',
      type: 'number',
      min: 2,
      max: 30,
      defaultValue: 6,
      admin: { description: 'Khuyên dùng 5–7 giây. Chỉ áp dụng khi có từ 2 banner đang hiển thị.' },
    },
    {
      name: 'enableSectionScrollSnap',
      label: 'Bật hiệu ứng cuộn bắt dính từng Section (Scroll Snap)',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Khi bật: người dùng lăn chuột trên trang chủ, trình duyệt sẽ tự động hít nhẹ và căn chỉnh chuẩn đỉnh của từng Section (không bị dừng lửng lơ giữa 2 khối).',
      },
    },
    {
      name: 'intro',
      label: 'Giới thiệu ngắn',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text', defaultValue: 'VỀ CHÚNG TÔI' },
        { name: 'title', type: 'text', defaultValue: 'Đồng hành cùng sức khỏe cộng đồng' },
        { name: 'description', type: 'textarea' },
        { name: 'image', label: 'Hình ảnh', type: 'upload', relationTo: 'media', admin: { description: 'Tải ảnh mới hoặc chọn lại từ Thư viện Tệp & Hình ảnh.' } },
      ],
    },
    {
      name: 'stats',
      label: 'Số liệu nổi bật',
      type: 'array',
      maxRows: 6,
      fields: [
        { name: 'value', label: 'Số liệu', type: 'text', required: true },
        { name: 'label', label: 'Nhãn', type: 'text', required: true },
      ],
    },
    {
      name: 'sections',
      label: 'Bố cục & giao diện các mục trang chủ',
      type: 'array',
      admin: {
        description: 'Kéo thả để sắp xếp thứ tự. Mỗi section có công tắc Hiển thị/Ẩn; khi tắt, section không xuất hiện trên website nhưng toàn bộ cấu hình vẫn được giữ lại để bật lại sau.',
        initCollapsed: true,
      },
      defaultValue: defaultHomepageSections,
      fields: [
        {
          name: 'type',
          label: 'Mục trang chủ',
          type: 'select',
          required: true,
          options: [
            { label: 'Hoạt động nổi bật tại bệnh viện', value: 'featured-news' },
            { label: 'Kỹ thuật chuyên sâu (Carousel/Slider)', value: 'advanced-techniques' },
            { label: 'Chuyên gia của chúng tôi (Carousel/Slider)', value: 'our-experts' },
            { label: 'Cổng thông tin bệnh viện', value: 'news-portal' },
            { label: 'Cổng tiện ích & Dịch vụ người bệnh (Đa Tab: Gói khám, Quy trình, Nội trú...)', value: 'patient-portal-services' },
            { label: 'Cổng tiêm chủng đa năng (Đa Tab: Vắc xin, Đợt tiêm, Thông báo...)', value: 'vaccination-portal-services' },
            { label: 'Khối Thẻ Slider 3 ô Tùy Biến (Custom 3-Card Carousel)', value: 'custom-carousel' },
            { label: 'Tổ chức bệnh viện', value: 'organization' },
            { label: 'Thông báo', value: 'notices' },
            { label: 'Lịch khám', value: 'schedules' },
            { label: 'Thông tin tiêm ngừa', value: 'vaccinations' },
            { label: 'Đấu thầu – Mua sắm', value: 'procurement' },
            { label: 'Hoạt động khoa học', value: 'science' },
            { label: 'Giới thiệu bệnh viện', value: 'introduction' },
            { label: 'Văn bản mới', value: 'documents' },
            { label: 'Mục nội dung từ Menu (ví dụ: Chuyển đổi số)', value: 'content-section' },
            { label: 'Cổng thông tin Liên kết & Chỉ đạo ngành (Sở Y tế & các đơn vị liên kết)', value: 'cantho-health-dept' },
            { label: 'Liên kết Website & Cổng thông tin (Dạng Mini Banner)', value: 'partner-banners' },
            { label: 'Cảnh báo y tế & cộng đồng (Dịch bệnh, cảnh báo khẩn...)', value: 'health-warnings' },
            { label: 'Phổ biến văn bản pháp luật (Luật, Nghị định, Thông tư...)', value: 'legal-dissemination' },
            { label: 'Mục nội dung tùy chỉnh (thêm mới)', value: 'custom' },
            { label: 'Module động từ thư viện', value: 'dynamic-module' },
          ],
        },
        {
          name: 'visible',
          label: 'Hiển thị section trên trang chủ',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Bỏ dấu chọn để ẩn section khỏi website. Nội dung và cấu hình của section vẫn được giữ nguyên trong Admin.' },
        },
        { name: 'eyebrow', label: 'Nhãn nhỏ phía trên', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.visible !== false } },
        { name: 'title', label: 'Tiêu đề lớn', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.visible !== false } },
        { name: 'description', label: 'Dòng mô tả', type: 'textarea', admin: { condition: (_data, siblingData) => siblingData?.visible !== false } },
        {
          name: 'techniqueAutoplaySeconds',
          label: 'Thời gian tự chuyển slide kỹ thuật (giây)',
          type: 'number',
          defaultValue: 5,
          validate: (value: unknown, { siblingData }: any) => {
            if (siblingData?.type !== 'advanced-techniques') return true
            if (value === null || value === undefined || value === '') return true
            const num = Number(value)
            if (isNaN(num) || num < 0 || num > 60) return 'Thời gian chuyển slide phải từ 0 đến 60 giây'
            return true
          },
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'advanced-techniques',
            description: 'Để 0 nếu muốn tắt tự động chuyển động.',
          },
        },
        {
          name: 'techniqueItemsPerView',
          label: 'Số thẻ hiển thị trên màn hình lớn',
          type: 'number',
          defaultValue: 4,
          validate: (value: unknown, { siblingData }: any) => {
            if (siblingData?.type !== 'advanced-techniques') return true
            if (value === null || value === undefined || value === '') return true
            const num = Number(value)
            if (isNaN(num) || num < 1 || num > 6) return 'Số thẻ hiển thị phải từ 1 đến 6'
            return true
          },
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'advanced-techniques',
            description: 'Khuyên dùng 4 thẻ để bố cục cân đối và đẹp mắt.',
          },
        },
        {
          type: 'row',
          fields: [
            colorField('cardBarBgColor', 'Màu nền dải chữ thẻ', { admin: { condition: (_data, siblingData) => siblingData?.type === 'advanced-techniques', width: '50%', placeholder: '#f0f7fd' } }),
            colorField('cardBarTextColor', 'Màu chữ chân thẻ', { admin: { condition: (_data, siblingData) => siblingData?.type === 'advanced-techniques', width: '50%', placeholder: '#0754a8' } }),
          ],
        },
        {
          name: 'techniqueItems',
          dbName: 'tech_items',
          label: 'Danh sách Kỹ thuật chuyên sâu',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'advanced-techniques',
            description: 'Thêm, sửa, xóa và kéo thả thay đổi thứ tự các thẻ kỹ thuật chuyên sâu.',
            initCollapsed: false,
          },
          fields: [
            {
              name: 'techniqueRef',
              label: 'Chọn từ mục Kỹ thuật chuyên sâu (không bắt buộc)',
              type: 'relationship',
              relationTo: 'advanced-techniques',
              admin: {
                description: 'Khi chọn kỹ thuật đã tạo trong mục Nội dung → Kỹ thuật chuyên sâu, hệ thống sẽ tự động lấy thông tin và đường dẫn chi tiết.',
              },
            },
            { name: 'title', label: 'Tên kỹ thuật / Tiêu đề dải chữ', type: 'text', required: true },
            { name: 'badge', label: 'Nhãn nhỏ góc (không bắt buộc)', type: 'text', admin: { placeholder: 'Ví dụ: Kỹ thuật mới' } },
            {
              name: 'image',
              label: 'Hình ảnh / Poster kỹ thuật',
              type: 'upload',
              relationTo: 'media',
              required: false,
              admin: {
                description: '💡 Gợi ý kích thước chuẩn: Tỷ lệ đứng 1:1.15 hoặc 3:4 (ví dụ: 600×700px, 600×800px hoặc 500×580px). Tải poster hoặc ảnh kỹ thuật y tế chất lượng cao. Nếu để trống hệ thống sẽ tự lấy từ kỹ thuật liên kết.',
              },
            },
            {
              name: 'imageFit',
              label: 'Cách hiển thị ảnh',
              type: 'select',
              defaultValue: 'contain',
              options: [
                { label: 'Vừa vặn khung, trọn vẹn không bị cắt (khuyên dùng - contain)', value: 'contain' },
                { label: 'Lấp đầy khung - Canh đỉnh đầu / phần trên (cover-top)', value: 'cover-top' },
                { label: 'Lấp đầy khung - Canh chính giữa tâm ảnh (cover-center)', value: 'cover-center' },
                { label: 'Lấp đầy khung - Canh phần dưới (cover-bottom)', value: 'cover-bottom' },
                { label: 'Co giãn vừa kín khung ảnh (fill)', value: 'fill' },
              ],
              admin: {
                description: 'Tùy chọn cách hiển thị để poster/ảnh không bị cắt mất chữ hoặc góc: Chọn "Vừa vặn khung" để ảnh luôn hiển thị trọn vẹn 100% không bị cắt bất kỳ góc nào; hoặc chọn "Lấp đầy khung" nếu muốn ảnh phủ kín toàn bộ thẻ.',
              },
            },
            {
              name: 'enableLink',
              label: 'Bật liên kết khi bấm vào thẻ kỹ thuật',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'BẬT: Bấm vào thẻ kỹ thuật sẽ chuyển đến trang chi tiết kỹ thuật hoặc liên kết tùy chỉnh bên dưới. TẮT: Thẻ chỉ hiển thị thông tin để xem (không bấm chuyển trang, không hiện con trỏ link).',
              },
            },
            ...smartLinkFields(),
            {
              name: 'openNewTab',
              label: 'Mở liên kết ở tab mới',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                condition: (_data, siblingData) => siblingData?.enableLink !== false,
              },
            },
            { name: 'visible', label: 'Hiển thị thẻ này', type: 'checkbox', defaultValue: true },
          ],
        },

        /* Chuyên gia của chúng tôi */
        {
          name: 'expertDisplayLayout',
          label: 'Kiểu bố cục hiển thị chuyên gia',
          type: 'select',
          defaultValue: 'carousel',
          options: [
            { label: '⭐ Hàng ngang đồng nhất chuẩn y tế (Carousel 4 hoặc 5 thẻ - Khuyên dùng)', value: 'carousel' },
            { label: 'Bố cục phân cấp: Thẻ Lãnh đạo lớn bên trái + Lưới bên phải', value: 'featured-grid' },
          ],
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'our-experts',
            description: 'Chọn kiểu bố cục hiển thị trên trang chủ: Hàng ngang đồng nhất chuẩn mực cao cấp hoặc Bố cục phân cấp.',
          },
        },
        {
          name: 'expertAutoplaySeconds',
          label: 'Thời gian tự chuyển slide chuyên gia (giây)',
          type: 'number',
          defaultValue: 5,
          validate: (value: unknown, { siblingData }: any) => {
            if (siblingData?.type !== 'our-experts') return true
            if (value === null || value === undefined || value === '') return true
            const num = Number(value)
            if (isNaN(num) || num < 0 || num > 60) return 'Thời gian chuyển slide phải từ 0 đến 60 giây'
            return true
          },
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'our-experts',
            description: 'Để 0 nếu muốn tắt tự động chuyển động.',
          },
        },
        {
          name: 'expertItemsPerView',
          label: 'Số thẻ bác sĩ hiển thị (Carousel hoặc Lưới bên phải)',
          type: 'number',
          defaultValue: 3,
          validate: (value: unknown, { siblingData }: any) => {
            if (siblingData?.type !== 'our-experts') return true
            if (value === null || value === undefined || value === '') return true
            const num = Number(value)
            if (isNaN(num) || num < 1 || num > 6) return 'Số thẻ hiển thị phải từ 1 đến 6'
            return true
          },
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'our-experts',
            description: 'Đối với Phương án A: quy định số ô bác sĩ hiển thị ở lưới bên phải (mặc định 3 ô dạng 1 hàng 3 cột rất gọn và thoáng, hoặc 6 ô dạng 2 hàng). Đối với Carousel: quy định số thẻ trên 1 lượt trượt (từ 1 đến 6).',
          },
        },
        {
          type: 'row',
          fields: [
            colorField('expertCardBgColor', 'Màu nền dải chân thẻ chuyên gia', { admin: { condition: (_data, siblingData) => siblingData?.type === 'our-experts', width: '50%', placeholder: '#f0f7fd' } }),
            colorField('expertCardTextColor', 'Màu tên & chức vụ chuyên gia', { admin: { condition: (_data, siblingData) => siblingData?.type === 'our-experts', width: '50%', placeholder: '#0754a8' } }),
          ],
        },
        {
          name: 'expertItems',
          dbName: 'expert_items',
          label: 'Danh sách Chuyên gia / Bác sĩ',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'our-experts',
            description: 'Thêm, sửa, xóa và kéo thả thay đổi thứ tự các chuyên gia hiển thị.',
            initCollapsed: false,
          },
          fields: [
            {
              name: 'doctorRef',
              label: 'Chọn từ mục Bác sĩ (khuyên dùng)',
              type: 'relationship',
              relationTo: 'doctors',
              admin: {
                description: 'Khi chọn bác sĩ từ hệ thống Quản trị → Bác sĩ, website sẽ tự động lấy Họ tên, Chức vụ, Ảnh đại diện và đường dẫn chi tiết chuẩn xác.',
              },
            },
            {
              name: 'name',
              label: 'Họ và tên bác sĩ / chuyên gia',
              type: 'text',
              required: false,
              admin: {
                description: 'Để trống hệ thống sẽ tự lấy từ Bác sĩ đã chọn.',
              },
            },
            { name: 'position', label: 'Chức danh / Chức vụ', type: 'text', admin: { placeholder: 'Ví dụ: Giám đốc Bệnh viện' } },
            {
              name: 'showDepartment',
              label: 'Hiển thị Khoa / Phòng sau chức vụ',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Bật để hiển thị dạng "Chức vụ · Khoa/Phòng" (Ví dụ: Phó Giám đốc · Ban Giám đốc). Tắt nếu chỉ muốn hiển thị riêng chức vụ (Ví dụ: Giám đốc).',
              },
            },
            {
              name: 'customSubtitle',
              label: 'Dòng thông tin phụ tùy chỉnh (Ghi đè dòng chức vụ / phòng ban)',
              type: 'text',
              admin: {
                placeholder: 'Ví dụ: Giám đốc hoặc Phó Giám đốc - Ban Giám đốc',
                description: 'Nếu nhập tại đây, hệ thống sẽ ưu tiên hiển thị chính xác nội dung này thay cho chức vụ và phòng ban tự động.',
              },
            },
            {
              name: 'image',
              label: 'Hình chân dung bác sĩ (nếu khác ảnh hồ sơ)',
              type: 'upload',
              relationTo: 'media',
              required: false,
              admin: {
                description: '💡 Gợi ý kích thước chuẩn: Tỷ lệ đứng 3:4 hoặc 1:1.15 (ví dụ: 600×800px, 450×600px hoặc 400×460px). Tải ảnh chân dung áo blouse trắng nền sáng. Nếu để trống hệ thống sẽ tự dùng ảnh hồ sơ Bác sĩ.',
              },
            },
            {
              name: 'imageFit',
              label: 'Cách hiển thị ảnh chân dung',
              type: 'select',
              defaultValue: 'contain',
              options: [
                { label: 'Vừa vặn khung, trọn vẹn không bị cắt (khuyên dùng - contain)', value: 'contain' },
                { label: 'Lấp đầy khung - Canh đỉnh đầu / mặt rõ nét (cover-top)', value: 'cover-top' },
                { label: 'Lấp đầy khung - Canh chính giữa tâm ảnh (cover-center)', value: 'cover-center' },
                { label: 'Lấp đầy khung - Canh phần dưới (cover-bottom)', value: 'cover-bottom' },
                { label: 'Co giãn vừa kín khung ảnh (fill)', value: 'fill' },
              ],
              admin: {
                description: 'Tùy chọn cách hiển thị để ảnh chân dung không bị mất đầu hoặc viền xấu: Chọn "Vừa vặn khung" để ảnh luôn hiển thị trọn vẹn 100% không bị cắt bất kỳ góc nào; hoặc chọn "Lấp đầy khung - Canh đỉnh đầu" để ảnh phủ kín thẻ nhưng luôn thấy rõ khuôn mặt.',
              },
            },
            {
              name: 'enableLink',
              label: 'Bật liên kết khi bấm vào thẻ chuyên gia',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'BẬT: Bấm vào thẻ chuyên gia sẽ chuyển đến trang chi tiết Bác sĩ hoặc Link tùy chỉnh bên dưới. TẮT: Thẻ chuyên gia chỉ hiển thị thông tin tĩnh để xem (không bấm chuyển trang, không hiện con trỏ link).',
              },
            },
            ...smartLinkFields(),
            {
              name: 'openNewTab',
              label: 'Mở liên kết ở tab mới',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                condition: (_data, siblingData) => siblingData?.enableLink !== false,
              },
            },
            { name: 'visible', label: 'Hiển thị thẻ này', type: 'checkbox', defaultValue: true },
          ],
        },
        { name: 'carouselSeconds', label: 'Thời gian chuyển nội dung nổi bật (giây)', type: 'number', min: 2.5, max: 20, defaultValue: 4.5, admin: { condition: (_data, siblingData) => siblingData?.type === 'featured-news', description: 'Điểm tin nổi bật tự động chuyển qua các thẻ nội dung được chọn.' } },
        { name: 'featuredItemLimit', label: 'Tổng số nội dung tối đa tham gia chuyển động', type: 'number', min: 4, max: 40, defaultValue: 16, admin: { condition: (_data, siblingData) => siblingData?.type === 'featured-news', description: 'Khung ngoài hiển thị 4 card trên desktop. Số này quy định tổng số nội dung tối đa được đưa vào vòng chuyển động.' } },
        {
          name: 'featuredSources',
          dbName: 'fn_sources',
          label: 'Cấu hình các chuyên mục & số lượng bài đưa lên Điểm tin',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'featured-news',
            description: 'Tùy chọn những chuyên mục / nguồn tin nào được đưa lên Điểm tin, bật/tắt từng mục và quy định mỗi mục được lấy bao nhiêu bài.',
            initCollapsed: false,
          },
          defaultValue: [
            { source: 'news', label: 'Tin tức & Hoạt động', limit: 8, enabled: true },
            { source: 'notices', label: 'Thông báo', limit: 6, enabled: true },
            { source: 'procurement', label: 'Đấu thầu – Mua sắm', limit: 4, enabled: true },
            { source: 'schedules', label: 'Lịch khám & Lịch trực', limit: 0, enabled: false },
          ],
          fields: [
            {
              name: 'source',
              label: 'Nguồn nội dung',
              type: 'select',
              required: true,
              options: [
                { label: 'Tin tức chung (toàn bộ)', value: 'news' },
                { label: 'Tin theo chuyên mục cụ thể', value: 'news-category' },
                { label: 'Thông báo', value: 'notices' },
                { label: 'Đấu thầu – Mua sắm', value: 'procurement' },
                { label: 'Lịch khám & Lịch trực', value: 'schedules' },
                { label: 'Văn bản – Tài liệu', value: 'documents' },
              ],
            },
            {
              name: 'categoryRef',
              label: 'Chọn Chuyên mục cụ thể (khi chọn "Tin theo chuyên mục cụ thể")',
              type: 'relationship',
              relationTo: 'categories',
              filterOptions: { scope: { equals: 'news' }, active: { equals: true } },
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'news-category',
                description: 'Chỉ lấy các bài viết thuộc chuyên mục tin tức này.',
              },
            },
            {
              name: 'categoryName',
              label: 'Hoặc nhập tên chuyên mục (tương thích dữ liệu cũ)',
              type: 'text',
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'news-category',
                placeholder: 'Ví dụ: Hoạt động bệnh viện, Tin y tế, Kiến thức sức khỏe...',
                description: 'Nếu đã chọn chuyên mục ở trên thì có thể để trống ô này.',
              },
            },
            {
              name: 'customBadge',
              label: 'Tên nhãn hiển thị trên thẻ (Badge)',
              type: 'text',
              admin: {
                placeholder: 'Để trống sẽ tự động lấy theo tên nguồn / tên chuyên mục (Ví dụ: TIN TỨC, THÔNG BÁO)',
                description: 'Tùy chỉnh nhãn nổi bật gắn ở góc dưới ảnh đại diện.',
              },
            },
            {
              name: 'limit',
              label: 'Số lượng bài lấy từ nguồn này',
              type: 'number',
              min: 0,
              max: 50,
              defaultValue: 6,
              admin: {
                description: 'Quy định lấy tối đa bao nhiêu bài mới nhất từ nguồn/chuyên mục này đưa lên Điểm tin (đặt 0 nếu tạm ẩn).',
              },
            },
            {
              name: 'enabled',
              label: 'Bật hiển thị nguồn này',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Bỏ chọn nếu muốn tạm ẩn nội dung của chuyên mục này khỏi Điểm tin mà không cần xóa cấu hình.',
              },
            },
          ],
        },
        {
          name: 'featuredFilterMode',
          label: 'Cách lọc bài viết Tin tức trong Điểm tin',
          type: 'select',
          defaultValue: 'all',
          options: [
            { label: 'Lấy tất cả bài mới nhất theo số lượng quy định ở trên', value: 'all' },
            { label: 'Chỉ lấy những bài được tích chọn "Tin nổi bật" trong Quản trị', value: 'only-featured' },
          ],
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'featured-news',
            description: 'Tùy chọn hiển thị bài mới nhất thông thường hoặc chỉ hiển thị các bài được ban biên tập đánh dấu "Tin nổi bật".',
          },
        },
        {
          name: 'featuredSeeAllUrl',
          label: 'Đường dẫn liên kết "Xem tất cả →"',
          type: 'text',
          defaultValue: '/tin-tuc',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'featured-news',
            placeholder: '/tin-tuc hoặc /tim-kiem',
            description: 'Đổi liên kết khi bấm nút Xem tất cả phía trên bên phải của mục Điểm tin.',
          },
        },
        {
          name: 'featuredCardFit',
          label: 'Cách hiển thị ảnh trên thẻ Điểm tin',
          type: 'select',
          defaultValue: 'cover',
          options: [
            { label: 'Lấp đầy khung ảnh (Chuẩn giao diện y tế)', value: 'cover' },
            { label: 'Vừa vặn toàn bộ ảnh (Không crop, giữ trọn 100% chi tiết ảnh)', value: 'contain' },
          ],
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'featured-news',
            description: 'Cố định tỷ lệ, tuyệt đối không bị méo hình theo Quy tắc cốt lõi bắt buộc.',
          },
        },
        { name: 'organizationImage', label: 'Hình ảnh giữa khối Chuyên khoa', type: 'upload', relationTo: 'media', admin: { condition: (_data, siblingData) => siblingData?.type === 'organization', description: 'Tải ảnh mới hoặc chọn ảnh đã có trong thư viện. Ảnh hiển thị ở giữa danh sách chuyên khoa và khối Medpro.' } },
        {
          name: 'organizationMedpro',
          label: 'Khối Đặt lịch khám qua Medpro',
          type: 'group',
          admin: { condition: (_data, siblingData) => siblingData?.type === 'organization', description: 'Toàn bộ nội dung khối Medpro phía phải có thể chỉnh hoặc ẩn tại đây.' },
          fields: [
            { name: 'enabled', label: 'Hiển thị khối Medpro', type: 'checkbox', defaultValue: true },
            { name: 'eyebrow', label: 'Nhãn nhỏ', type: 'text', defaultValue: 'ĐẶT LỊCH KHÁM QUA MEDPRO' },
            { name: 'title', label: 'Tiêu đề', type: 'text', defaultValue: 'Chủ động thời gian – Giảm thời gian chờ đợi' },
            { name: 'bullet1', label: 'Dòng lợi ích 1', type: 'text', defaultValue: 'Đặt lịch nhanh chóng' },
            { name: 'bullet2', label: 'Dòng lợi ích 2', type: 'text', defaultValue: 'Chọn bác sĩ theo nhu cầu' },
            { name: 'bullet3', label: 'Dòng lợi ích 3', type: 'text', defaultValue: 'Nhận nhắc hẹn tự động' },
            { name: 'brandText', label: 'Chữ thương hiệu', type: 'text', defaultValue: 'Medpro' },
            { name: 'buttonLabel', label: 'Tên nút đặt lịch', type: 'text', defaultValue: 'ĐẶT LỊCH NGAY' },
            { name: 'buttonUrl', label: 'Liên kết nút đặt lịch', type: 'text', admin: { description: 'Để trống sẽ dùng liên kết Medpro chung trong Cấu hình website.' } },
            { name: 'openNewTab', label: 'Mở Medpro ở tab mới', type: 'checkbox', defaultValue: true },
            { name: 'guideLabel', label: 'Tên liên kết hướng dẫn', type: 'text', defaultValue: 'Hướng dẫn đặt lịch khám' },
            { name: 'guideUrl', label: 'Liên kết hướng dẫn', type: 'text', defaultValue: '/lich-kham' },
            { name: 'backgroundColor', label: 'Màu nền khối Medpro', type: 'text', admin: { placeholder: '#effbf3' } },
          ],
        },
        {
          name: 'contentTabs',
          dbName: 'content_tabs',
          label: 'Các tab nội dung',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'news-portal' || siblingData?.type === 'science',
            description: 'Thêm, xóa hoặc kéo thả để sắp xếp tab. Tên tab, chuyên mục và nội dung thủ công đều có thể tự nhập; hàng để trống sẽ được bỏ qua khi hiển thị.',
          },
          fields: [
            { name: 'label', label: 'Tên tab', type: 'text', admin: { placeholder: 'Ví dụ: Tin y tế' } },
            {
              name: 'values',
              dbName: 'content_values',
              label: 'Chuyên mục bài viết trong tab',
              type: 'array',
              fields: [{ name: 'value', label: 'Tên chuyên mục', type: 'text' }],
            },
            {
              name: 'manualItems',
              dbName: 'news_manual',
              label: 'Nội dung thêm thủ công (không bắt buộc)',
              type: 'array',
              fields: [
                { name: 'title', label: 'Tiêu đề', type: 'text' },
                { name: 'description', label: 'Mô tả ngắn', type: 'textarea' },
                ...smartLinkFields(),
                { name: 'image', label: 'Hình ảnh', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          name: 'departmentTabs',
          dbName: 'dept_tabs',
          label: 'Các tab Đơn vị trực thuộc',
          type: 'array',
          admin: {
            condition: () => false,
            description: 'Thiết lập cũ đã ngừng dùng. Trang chủ hiện lấy trực tiếp danh sách Chuyên khoa.',
          },
          fields: [
            { name: 'label', label: 'Tên tab', type: 'text', admin: { placeholder: 'Ví dụ: Khối lâm sàng' } },
            {
              name: 'values',
              dbName: 'dept_values',
              label: 'Loại đơn vị có sẵn (không bắt buộc)',
              type: 'array',
              fields: [{ name: 'value', label: 'Tên loại / nhóm đơn vị', type: 'text' }],
            },
            {
              name: 'manualItems',
              dbName: 'dept_manual',
              label: 'Đơn vị thêm thủ công (không bắt buộc)',
              type: 'array',
              fields: [
                { name: 'title', label: 'Tên đơn vị', type: 'text' },
                { name: 'description', label: 'Mô tả ngắn', type: 'textarea' },
                ...smartLinkFields(),
              ],
            },
          ],
        },
        {
          name: 'scheduleTabOrder',
          label: 'Thứ tự các tab Lịch khám',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'schedules',
            description: 'Kéo thả để đổi vị trí; bỏ dấu Hiển thị nếu muốn ẩn một tab.',
          },
          defaultValue: defaultScheduleTabs,
          fields: [
            { name: 'label', label: 'Tên tab', type: 'text', admin: { placeholder: 'Có thể tự nhập tên tab' } },
            { name: 'tab', label: 'Nguồn dữ liệu có sẵn (không bắt buộc)', type: 'select', options: [
              { label: 'Lịch trực cấp cứu', value: 'emergency' },
              { label: 'Theo ngày', value: 'daily' },
              { label: 'Theo tuần', value: 'weekly' },
              { label: 'Lịch đính kèm', value: 'attachments' },
            ] },
            { name: 'visible', label: 'Hiển thị tab', type: 'checkbox', defaultValue: true },
            {
              name: 'manualItems',
              dbName: 'schedule_manual',
              label: 'Nội dung thêm thủ công (không bắt buộc)',
              type: 'array',
              fields: [
                { name: 'title', label: 'Tiêu đề', type: 'text' },
                { name: 'description', label: 'Mô tả', type: 'textarea' },
                ...smartLinkFields(),
                { name: 'image', label: 'Hình ảnh', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          name: 'vaccinationTabOrder',
          dbName: 'homepage_vax_tabs',
          label: 'Thứ tự các tab Tiêm ngừa',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'vaccinations',
            description: 'Kéo thả để đổi thứ tự; có thể tắt từng tab khi chưa cần hiển thị.',
          },
          defaultValue: defaultVaccinationTabs,
          fields: [
            { name: 'label', label: 'Tên tab', type: 'text', admin: { placeholder: 'Có thể tự nhập tên tab' } },
            { name: 'tab', label: 'Nguồn dữ liệu có sẵn (không bắt buộc)', type: 'select', options: [
              { label: 'Thông báo lịch tiêm', value: 'announcements' },
              { label: 'Tiêm ngừa theo đợt', value: 'campaigns' },
              { label: 'Các loại vắc xin', value: 'vaccines' },
            ] },
            { name: 'visible', label: 'Hiển thị tab', type: 'checkbox', defaultValue: true },
            {
              name: 'manualItems',
              dbName: 'vaccine_manual',
              label: 'Nội dung thêm thủ công (không bắt buộc)',
              type: 'array',
              fields: [
                { name: 'title', label: 'Tiêu đề', type: 'text' },
                { name: 'description', label: 'Mô tả', type: 'textarea' },
                ...smartLinkFields(),
                { name: 'image', label: 'Hình ảnh', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          name: 'portalServiceTabs',
          dbName: 'hp_svc_tabs',
          label: 'Cấu hình các tab tiện ích dịch vụ người bệnh',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'patient-portal-services',
            description: 'Thêm, bớt, sắp xếp các Tab dịch vụ hiển thị trên Trang chủ. Bạn có thể chọn nguồn dữ liệu từ Gói khám, Quy trình khám, Điều trị nội trú, Sơ đồ bệnh viện, Cổng tiện ích hoặc tự soạn nội dung.',
            initCollapsed: false,
          },
          defaultValue: [
            { label: 'Gói khám sức khỏe', source: 'packages', enabled: true },
            { label: 'Quy trình khám bệnh', source: 'flow', enabled: true },
            { label: 'Hướng dẫn nội trú', source: 'inpatient', enabled: true },
          ],
          fields: [
            { name: 'enabled', label: 'Bật hiển thị tab này', type: 'checkbox', defaultValue: true },
            { name: 'label', label: 'Tên tab hiển thị', type: 'text', required: true, admin: { placeholder: 'Ví dụ: Gói khám sức khỏe, Quy trình khám...' } },
            {
              name: 'source',
              label: 'Nguồn dữ liệu gắn vào tab',
              type: 'select',
              required: true,
              defaultValue: 'packages',
              options: [
                { label: '📦 Gói khám sức khỏe & Tầm soát (Lấy từ /goi-kham)', value: 'packages' },
                { label: '🩺 Sơ đồ & Quy trình khám bệnh (Lấy từ /quy-trinh-kham-benh)', value: 'flow' },
                { label: '🛏️ Hướng dẫn điều trị nội trú (Lấy từ /dieu-tri-noi-tru)', value: 'inpatient' },
                { label: '🗺️ Sơ đồ các tầng & Tiện ích (Lấy từ /so-do-benh-vien)', value: 'map' },
                { label: '📋 Thẻ tiện ích Cổng người bệnh (Lấy từ /danh-cho-nguoi-benh)', value: 'portal-cards' },
                { label: '✍️ Tự nhập danh sách thẻ thủ công', value: 'manual' },
              ],
            },
            {
              name: 'limit',
              label: 'Số mục hiển thị tối đa',
              type: 'number',
              min: 1,
              max: 20,
              defaultValue: 6,
              admin: {
                description: 'Quy định số lượng thẻ hiển thị trong tab này trên Trang chủ (Mặc định: 6).',
              },
            },
            {
              name: 'customBadge',
              label: 'Nhãn phụ nổi bật trên Tab (Badge)',
              type: 'text',
              admin: { placeholder: 'Ví dụ: HOT, Mới, 24/7 (để trống nếu không dùng)' },
            },
            {
              name: 'seeMoreUrl',
              label: 'Đường dẫn xem thêm riêng cho tab này',
              type: 'text',
              admin: { placeholder: 'Ví dụ: /goi-kham, /quy-trinh-kham-benh (để trống sẽ tự động lấy theo nguồn)' },
            },
            {
              name: 'manualItems',
              dbName: 'hp_svc_manual',
              label: 'Danh sách thẻ tự nhập thủ công (khi chọn nguồn Tự nhập)',
              type: 'array',
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'manual',
              },
              fields: [
                { name: 'title', label: 'Tiêu đề thẻ', type: 'text', required: true },
                { name: 'desc', label: 'Mô tả tóm tắt', type: 'textarea' },
                { name: 'badge', label: 'Huy hiệu', type: 'text' },
                { name: 'icon', label: 'Biểu tượng (Icon / Emoji)', type: 'text', defaultValue: '🩺' },
                { name: 'href', label: 'Đường dẫn liên kết khi bấm', type: 'text', required: true },
                { name: 'buttonText', label: 'Chữ trên nút', type: 'text', defaultValue: 'Xem chi tiết →' },
              ],
            },
          ],
        },
        {
          name: 'portalVaccinationTabs',
          dbName: 'hp_vax_tabs_cfg',
          label: 'Cấu hình các tab Cổng tiêm chủng đa năng',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'vaccination-portal-services',
            description: 'Tự do thêm, bớt, chọn nguồn (Vắc xin, Đợt tiêm, Thông báo lịch tiêm hoặc tự nhập thủ công) và sắp xếp thứ tự tab tiêm chủng trên Trang chủ.',
            initCollapsed: false,
          },
          defaultValue: [
            { label: 'Các loại vắc xin', source: 'vaccines', enabled: true },
            { label: 'Tiêm ngừa theo đợt', source: 'campaigns', enabled: true },
            { label: 'Thông báo lịch tiêm', source: 'announcements', enabled: true },
          ],
          fields: [
            { name: 'enabled', label: 'Bật hiển thị tab này', type: 'checkbox', defaultValue: true },
            { name: 'label', label: 'Tên tab hiển thị', type: 'text', required: true, admin: { placeholder: 'Ví dụ: Các loại vắc xin, Đợt tiêm chủng...' } },
            {
              name: 'source',
              label: 'Nguồn dữ liệu gắn vào tab',
              type: 'select',
              required: true,
              defaultValue: 'vaccines',
              options: [
                { label: '💉 Danh mục các loại vắc xin (Có giá, độ tuổi, tình trạng)', value: 'vaccines' },
                { label: '🗓️ Tiêm ngừa theo đợt / Chiến dịch tiêm', value: 'campaigns' },
                { label: '📢 Thông báo lịch tiêm chủng của bệnh viện', value: 'announcements' },
                { label: '✍️ Tự nhập danh sách thẻ tiêm chủng thủ công', value: 'manual' },
              ],
            },
            {
              name: 'limit',
              label: 'Số mục hiển thị tối đa',
              type: 'number',
              min: 1,
              max: 30,
              defaultValue: 8,
              admin: {
                description: 'Quy định số lượng thẻ hiển thị trong tab này trên Trang chủ (Mặc định: 8).',
              },
            },
            {
              name: 'customBadge',
              label: 'Nhãn phụ nổi bật trên Tab (Badge)',
              type: 'text',
              admin: { placeholder: 'Ví dụ: Đang có, Mới, Miễn phí (để trống nếu không dùng)' },
            },
            {
              name: 'seeMoreUrl',
              label: 'Đường dẫn xem thêm riêng cho tab này',
              type: 'text',
              admin: { placeholder: 'Ví dụ: /tiem-chung (để trống sẽ tự động trỏ /tiem-chung)' },
            },
            {
              name: 'manualItems',
              dbName: 'hp_vax_manual',
              label: 'Danh sách thẻ tự nhập thủ công (khi chọn nguồn Tự nhập)',
              type: 'array',
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'manual',
              },
              fields: [
                { name: 'title', label: 'Tên vắc xin / Sự kiện', type: 'text', required: true },
                { name: 'desc', label: 'Mô tả tóm tắt', type: 'textarea' },
                { name: 'badge', label: 'Tình trạng / Huy hiệu', type: 'text', admin: { placeholder: 'Đang có, Sắp có...' } },
                { name: 'icon', label: 'Biểu tượng (Icon / Emoji)', type: 'text', defaultValue: '💉' },
                { name: 'priceText', label: 'Giá tiêm (nếu có)', type: 'text', admin: { placeholder: 'Ví dụ: 185.000đ hoặc Miễn phí' } },
                { name: 'href', label: 'Đường dẫn chi tiết', type: 'text', required: true },
                { name: 'buttonText', label: 'Chữ trên nút', type: 'text', defaultValue: 'Xem chi tiết →' },
              ],
            },
          ],
        },

        /* ── CẤU HÌNH KHỐI THẺ SLIDER 3 Ô TÙY BIẾN (CUSTOM-CAROUSEL) ── */
        {
          type: 'row',
          fields: [
            {
              name: 'carouselItemsPerView',
              label: 'Số thẻ hiển thị cùng lúc trên màn hình lớn',
              type: 'number',
              min: 1,
              max: 4,
              defaultValue: 3,
              admin: {
                condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
                width: '50%',
                description: 'Khuyên dùng 3 thẻ để cân đối giao diện.',
              },
            },
            {
              name: 'carouselAutoplaySeconds',
              label: 'Thời gian tự trượt sang ô khác (giây)',
              type: 'number',
              min: 0,
              max: 60,
              defaultValue: 5,
              admin: {
                condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
                width: '50%',
                description: 'Mặc định 5s. Đặt 0 nếu muốn tắt tự động trượt.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'carouselDetailBtnText',
              label: 'Chữ mặc định trên nút Chi tiết',
              type: 'text',
              defaultValue: 'Chi tiết',
              admin: {
                condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
                width: '33.3%',
              },
            },
            {
              name: 'carouselActionBtnText',
              label: 'Chữ mặc định trên nút Đăng ký / Hành động',
              type: 'text',
              defaultValue: 'Đăng ký ngay',
              admin: {
                condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
                width: '33.3%',
              },
            },
            {
              name: 'carouselSeeMoreText',
              label: 'Chữ liên kết xem tất cả (góc phải)',
              type: 'text',
              defaultValue: 'Xem tất cả →',
              admin: {
                condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
                width: '33.3%',
              },
            },
          ],
        },
        {
          name: 'carouselSeeMoreUrl',
          label: 'Đường dẫn liên kết khi bấm Xem tất cả',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
            placeholder: 'Ví dụ: /dich-vu, /tiem-chung, /kham-chuyen-khoa (để trống nếu không muốn hiện link Xem tất cả)',
          },
        },
        {
          name: 'customCarouselCards',
          dbName: 'hp_custom_cards',
          label: 'Danh sách các thẻ trong Slider (Kéo thả sắp xếp, thêm không giới hạn)',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'custom-carousel',
            description: 'Mỗi thẻ được thiết kế chuẩn y tế hiện đại: Badge trạng thái, Xuất xứ/Đơn vị, Mã, Tiêu đề, Mô tả, Bảng thông số, Giá niêm yết và 2 nút bấm.',
            initCollapsed: false,
          },
          fields: [
            { name: 'enabled', label: 'Bật hiển thị thẻ này', type: 'checkbox', defaultValue: true },
            {
              type: 'row',
              fields: [
                { name: 'title', label: 'Tiêu đề thẻ', type: 'text', required: true, admin: { width: '60%', placeholder: 'Ví dụ: Gói tầm soát tổng quát' } },
                { name: 'code', label: 'Mã định danh (tùy chọn)', type: 'text', admin: { width: '40%', placeholder: 'Ví dụ: GK-01' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'statusText', label: 'Trạng thái / Huy hiệu', type: 'text', admin: { width: '50%', placeholder: '● ĐANG TRIỂN KHAI, ● ĐANG CÓ, HOT...' } },
                {
                  name: 'statusType',
                  label: 'Màu trạng thái',
                  type: 'select',
                  defaultValue: 'available',
                  options: [
                    { label: 'Xanh lá (Đang có / Sẵn sàng)', value: 'available' },
                    { label: 'Xanh dương (Nổi bật / Tiêu chuẩn)', value: 'info' },
                    { label: 'Vàng cam (Sắp triển khai / Đặt trước)', value: 'warning' },
                    { label: 'Đỏ (Tạm ngưng / Tạm hết)', value: 'unavailable' },
                  ],
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'origin', label: 'Xuất xứ / Khoa phụ trách', type: 'text', admin: { width: '50%', placeholder: 'Xuất xứ: Bỉ hoặc Khoa Khám bệnh' } },
                { name: 'image', label: 'Ảnh thẻ (tùy chọn)', type: 'upload', relationTo: 'media', admin: { width: '50%' } },
              ],
            },
            { name: 'summary', label: 'Mô tả tóm tắt', type: 'textarea' },
            {
              type: 'row',
              fields: [
                { name: 'spec1Key', label: 'Thông số 1 (Tên)', type: 'text', admin: { width: '30%', placeholder: 'Phòng bệnh / Thời gian' } },
                { name: 'spec1Val', label: 'Thông số 1 (Giá trị)', type: 'text', admin: { width: '70%', placeholder: 'Nội dung thông số 1' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'spec2Key', label: 'Thông số 2 (Tên)', type: 'text', admin: { width: '30%', placeholder: 'Đối tượng / Bác sĩ' } },
                { name: 'spec2Val', label: 'Thông số 2 (Giá trị)', type: 'text', admin: { width: '70%', placeholder: 'Nội dung thông số 2' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'spec3Key', label: 'Thông số 3 (Tên)', type: 'text', admin: { width: '30%', placeholder: 'Đơn vị SX / Địa điểm' } },
                { name: 'spec3Val', label: 'Thông số 3 (Giá trị)', type: 'text', admin: { width: '70%', placeholder: 'Nội dung thông số 3' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'priceLabel', label: 'Nhãn giá', type: 'text', defaultValue: 'GIÁ NIÊM YẾT', admin: { width: '40%' } },
                { name: 'priceValue', label: 'Mức giá / Chi phí', type: 'text', admin: { width: '60%', placeholder: 'Ví dụ: 850.000 đ hoặc Miễn phí' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'detailUrl', label: 'Link nút Chi tiết', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: /dich-vu/goi-kham-1' } },
                { name: 'detailBtnText', label: 'Chữ nút Chi tiết riêng (tùy chọn)', type: 'text', admin: { width: '50%', placeholder: 'Để trống sẽ lấy mặc định' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'actionUrl', label: 'Link nút Đăng ký / Hành động', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: https://medpro.vn/ hoặc hotline:02923861234' } },
                { name: 'actionBtnText', label: 'Chữ nút Đăng ký riêng (tùy chọn)', type: 'text', admin: { width: '50%', placeholder: 'Để trống sẽ lấy mặc định' } },
              ],
            },
          ],
        },

        /* ── CẤU HÌNH CỔNG THÔNG TIN LIÊN KẾT ĐA TAB (SỞ Y TẾ & CÁC ĐƠN VỊ LIÊN KẾT) ── */
        {
          name: 'enableExternalFetch',
          label: 'Bật tự động lấy tin từ các đường liên kết bên ngoài (Sở Y tế, Website khác, RSS Feed)',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'cantho-health-dept',
            description: 'BẬT: Hệ thống mới kết nối mạng ra bên ngoài để quét và lấy bài viết mới nhất từ Sở Y tế hoặc các đường link / RSS Feed đã cấu hình. TẮT (Mặc định - Khuyên dùng): Tuyệt đối không kết nối ra bên ngoài để đảm bảo an toàn tuyệt đối và tối ưu tốc độ máy chủ; hệ thống sẽ chỉ dùng dữ liệu dự phòng có sẵn hoặc danh sách bài viết tự nhập.',
          },
        },
        {
          name: 'linkedWebsitesTabs',
          dbName: 'hp_linked_tabs',
          label: 'Danh sách các Tab đơn vị liên kết (Sở Y tế, Bộ Y tế, các đơn vị khác)',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'cantho-health-dept',
            description: 'Thêm, bớt, chọn nguồn dữ liệu (Lấy tự động từ Sở Y tế hoặc Tự nhập danh sách bài viết) và sắp xếp thứ tự các Tab hiển thị trên Trang chủ.',
            initCollapsed: false,
          },
          defaultValue: [
            {
              enabled: true,
              autoFetchEnabled: false,
              label: 'Sở Y tế TP. Cần Thơ',
              source: 'cantho-syt',
              seeMoreUrl: 'https://soyte.cantho.gov.vn/',
              seeMoreText: 'Xem tất cả tại soyte.cantho.gov.vn ↗',
            },
          ],
          fields: [
            { name: 'enabled', label: 'Bật hiển thị tab này', type: 'checkbox', defaultValue: true },
            {
              name: 'autoFetchEnabled',
              label: 'Bật kết nối lấy tin bên ngoài cho riêng tab này',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'cantho-syt' || siblingData?.source === 'auto-feed',
                description: 'Chỉ khi bật tùy chọn này VÀ bật kết nối ngoài ở trên thì tab này mới gọi mạng ra ngoài để lấy tin.',
              },
            },
            {
              type: 'row',
              fields: [
                { name: 'label', label: 'Tên tab / Tên đơn vị', type: 'text', required: true, admin: { width: '50%', placeholder: 'Ví dụ: Sở Y tế Cần Thơ, Bộ Y tế...' } },
                {
                  name: 'source',
                  label: 'Nguồn dữ liệu của tab',
                  type: 'select',
                  required: true,
                  defaultValue: 'cantho-syt',
                  options: [
                    { label: '🌐 Lấy tự động từ Cổng thông tin Sở Y tế Cần Thơ (Cập nhật 24/7)', value: 'cantho-syt' },
                    { label: '⚡ Quét tự động từ Website bất kỳ hoặc nguồn RSS Feed (Bộ Y tế, Báo y tế, Bệnh viện...)', value: 'auto-feed' },
                    { label: '✍️ Tự nhập danh sách bài viết thủ công', value: 'manual' },
                  ],
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'feedUrl',
              label: 'Đường dẫn Website hoặc RSS Feed cần lấy tin tự động',
              type: 'text',
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'auto-feed',
                placeholder: 'Ví dụ: https://moh.gov.vn/ hoặc https://suckhoedoisong.vn/rss/thoi-su.rss',
                description: 'Hệ thống tự động phát hiện RSS Feed hoặc quét HTML để bóc tách tiêu đề, hình ảnh và đường link bài viết gốc.',
              },
            },
            {
              type: 'row',
              fields: [
                { name: 'badge', label: 'Huy hiệu trên Tab (tùy chọn)', type: 'text', admin: { width: '33%', placeholder: 'Ví dụ: MỚI, CHỈ ĐẠO...' } },
                { name: 'seeMoreUrl', label: 'Liên kết xem tất cả của đơn vị', type: 'text', admin: { width: '33%', placeholder: 'Ví dụ: https://soyte.cantho.gov.vn/ hoặc https://moh.gov.vn/' } },
                { name: 'seeMoreText', label: 'Chữ trên nút xem tất cả', type: 'text', admin: { width: '34%', placeholder: 'Để trống sẽ tự động lấy theo tên đơn vị' } },
              ],
            },
            {
              name: 'manualItems',
              dbName: 'hp_linked_items',
              label: 'Danh sách bài viết của đơn vị (khi chọn Tự nhập)',
              type: 'array',
              admin: {
                condition: (_data, siblingData) => siblingData?.source === 'manual',
                description: 'Nhập các bài viết, thông báo, quyết định từ đơn vị này. Khi người đọc bấm vào thẻ bài viết trên trang chủ sẽ mở liên kết gốc ở tab mới.',
              },
              fields: [
                { name: 'title', label: 'Tiêu đề bài viết', type: 'text', required: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'url', label: 'Đường dẫn bài viết gốc (Link ngoài website)', type: 'text', required: true, admin: { width: '60%', placeholder: 'https://...' } },
                    { name: 'category', label: 'Chuyên mục / Phân loại', type: 'text', admin: { width: '40%', placeholder: 'Ví dụ: Tin chỉ đạo, Thông báo...' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'cover', label: 'Ảnh đại diện (Tải lên thư viện)', type: 'upload', relationTo: 'media', admin: { width: '50%' } },
                    { name: 'coverUrl', label: 'Hoặc dán URL ảnh trực tiếp từ website gốc', type: 'text', admin: { width: '50%', placeholder: 'https://...' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'date', label: 'Ngày đăng bài', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: 23/09/2026' } },
                    { name: 'badge', label: 'Nhãn nổi bật trên ảnh', type: 'text', admin: { width: '50%', placeholder: 'Ví dụ: VĂN BẢN, CHỈ ĐẠO...' } },
                  ],
                },
                { name: 'excerpt', label: 'Tóm tắt bài viết', type: 'textarea' },
              ],
            },
          ],
        },

        /* ── CẤU HÌNH LIÊN KẾT WEBSITE & CỔNG THÔNG TIN (DẠNG MINI BANNER) ── */
        {
          name: 'partnerBanners',
          dbName: 'hp_partner_banners',
          label: 'Danh sách Banner liên kết website (Bộ Y tế, Cổng TP, Chính phủ, Dịch vụ công...)',
          type: 'array',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'partner-banners',
            description: 'Thêm các banner liên kết website. Người dân nhấn vào banner sẽ tự động mở trang web của cơ quan/đơn vị đó ở tab mới.',
            initCollapsed: false,
          },
          defaultValue: [
            {
              enabled: true,
              title: 'CỔNG THÔNG TIN ĐIỆN TỬ THÀNH PHỐ CẦN THƠ',
              subTitle: 'cantho.gov.vn',
              url: 'https://cantho.gov.vn/',
              bgGradient: 'cantho',
              openNewTab: true,
            },
            {
              enabled: true,
              title: 'BỘ Y TẾ - CỔNG THÔNG TIN ĐIỆN TỬ',
              subTitle: 'moh.gov.vn',
              url: 'https://moh.gov.vn/',
              bgGradient: 'moh',
              openNewTab: true,
            },
            {
              enabled: true,
              title: 'CỔNG THÔNG TIN ĐIỆN TỬ CHÍNH PHỦ',
              subTitle: 'chinhphu.vn',
              url: 'https://chinhphu.vn/',
              bgGradient: 'chinhphu',
              openNewTab: true,
            },
            {
              enabled: true,
              title: 'CỔNG DỊCH VỤ CÔNG QUỐC GIA',
              subTitle: 'dichvucong.gov.vn',
              url: 'https://dichvucong.gov.vn/',
              bgGradient: 'dvc',
              openNewTab: true,
            },
          ],
          fields: [
            { name: 'enabled', label: 'Bật hiển thị banner này', type: 'checkbox', defaultValue: true },
            {
              type: 'row',
              fields: [
                { name: 'title', label: 'Tên đơn vị / Tiêu đề banner', type: 'text', required: true, admin: { width: '60%', placeholder: 'Ví dụ: BỘ Y TẾ, CỔNG TP CẦN THƠ...' } },
                { name: 'subTitle', label: 'Tên miền / Dòng phụ (tùy chọn)', type: 'text', admin: { width: '40%', placeholder: 'Ví dụ: cantho.gov.vn, moh.gov.vn' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'url', label: 'Đường dẫn website đích (Link ngoài)', type: 'text', required: true, admin: { width: '70%', placeholder: 'https://...' } },
                { name: 'openNewTab', label: 'Mở tab mới', type: 'checkbox', defaultValue: true, admin: { width: '30%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'bannerImage', label: 'Ảnh banner đồ họa (Nếu có sẵn)', type: 'upload', relationTo: 'media', admin: { width: '50%', description: 'Tải file ảnh banner chữ nhật (khuyên dùng tỷ lệ khoảng 3.5:1 hoặc 4:1)' } },
                { name: 'bannerImageUrl', label: 'Hoặc dán URL ảnh banner', type: 'text', admin: { width: '50%', placeholder: 'https://...' } },
              ],
            },
            {
              name: 'bgGradient',
              label: 'Màu nền banner tự động (khi không dùng ảnh tải lên)',
              type: 'select',
              defaultValue: 'cantho',
              options: [
                { label: '🌅 Bình minh Đô thị (Xanh ngọc - Vàng cam ĐBSCL)', value: 'cantho' },
                { label: '🔴 Đỏ tươi Truyền thống (Bộ Y tế / Cơ quan)', value: 'moh' },
                { label: '🟡 Vàng đồng Trang trọng (Quốc huy / Chính phủ)', value: 'chinhphu' },
                { label: '🔷 Xanh công nghệ số (Dịch vụ công / Chuyển đổi số)', value: 'dvc' },
                { label: '🏥 Xanh dương Y tế (Bệnh viện / Khám chữa bệnh)', value: 'medical' },
                { label: '🌿 Xanh lá Dược học (Y học cổ truyền / Dược liệu)', value: 'green' },
              ],
              admin: {
                description: 'Nếu bạn chưa có sẵn ảnh banner thiết kế, hệ thống sẽ tự động vẽ một banner màu sắc trang trọng theo mẫu chuẩn.',
              },
            },
          ],
        },

        {
          name: 'bannerColumns',
          label: 'Số banner trên 1 hàng (Desktop)',
          type: 'select',
          defaultValue: '4',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'partner-banners',
            description: 'Chọn số cột hiển thị dải banner (thường dùng 4 banner/hàng hoặc 3 banner/hàng).',
          },
          options: [
            { label: '4 Banner / Hàng (Khuyên dùng)', value: '4' },
            { label: '3 Banner / Hàng (To rõ)', value: '3' },
            { label: '5 Banner / Hàng (Gọn gàng)', value: '5' },
            { label: '2 Banner / Hàng (Rất to)', value: '2' },
          ],
        },
        {
          name: 'bannerMotionMode',
          label: 'Chế độ chuyển động banner',
          type: 'select',
          defaultValue: 'marquee',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'partner-banners',
            description: 'Chọn kiểu chuyển động cho dải banner liên kết website.',
          },
          options: [
            { label: '🌊 Chạy trượt ngang liên tục (Marquee Ticker) - Lướt vô tận, rê chuột dừng lại', value: 'marquee' },
            { label: '🎠 Băng chuyền chuyển trang tự động (Slide Carousel có nút ‹ ›)', value: 'carousel' },
            { label: '⏹️ Tĩnh (Hiển thị dạng lưới tĩnh, không trượt)', value: 'grid' },
          ],
        },
        {
          name: 'bannerAutoplaySpeed',
          label: 'Tốc độ chuyển động (Giây)',
          type: 'number',
          min: 1,
          max: 60,
          defaultValue: 5,
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'partner-banners' && siblingData?.bannerMotionMode !== 'grid',
            description: 'Với kiểu Băng chuyền: số giây tự động đổi trang (ví dụ 4s - 5s). Với kiểu Chạy trượt ngang liên tục: tốc độ lướt.',
          },
        },

        {
          name: 'linkedContentSection',
          label: 'Mục nội dung cần hiển thị',
          type: 'relationship',
          relationTo: 'content-sections',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'content-section',
            description: 'Chọn mục đã được tạo từ Menu, ví dụ Chuyển đổi số. Các bài thuộc mục này sẽ tự động hiển thị trên section và nút Xem tất cả sẽ trỏ đúng /chuyen-doi-so.',
          },
        },
        {
          name: 'linkedContentLimit',
          label: 'Số bài hiển thị trong section',
          type: 'number',
          min: 1,
          max: 12,
          defaultValue: 5,
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'content-section',
            description: 'Khuyến nghị 5 bài: 1 bài lớn + 4 bài nhỏ, đồng bộ Thông báo và Đấu thầu.',
          },
        },
        {
          name: 'dynamicModule',
          label: 'Module động',
          type: 'relationship',
          relationTo: 'dynamic-modules',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'dynamic-module',
            description: 'Chọn module được quản lý trong Nội dung → Module động. Có thể tái sử dụng cùng một module ở nhiều vị trí.',
          },
        },
        {
          name: 'customContent',
          label: 'Nội dung chi tiết của mục mới',
          type: 'richText',
          admin: {
            condition: (_data, siblingData) => siblingData?.type === 'custom',
            description: 'Soạn nội dung hiển thị trực tiếp trên trang chủ.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'customImage',
              label: 'Ảnh của mục mới',
              type: 'upload',
              relationTo: 'media',
              admin: { condition: (_data, siblingData) => siblingData?.type === 'custom', width: '50%', description: 'Tải ảnh mới hoặc chọn lại từ Thư viện Tệp & Hình ảnh.' },
            },
            {
              name: 'imagePosition',
              label: 'Vị trí ảnh',
              type: 'select',
              defaultValue: 'left',
              options: [{ label: 'Bên trái', value: 'left' }, { label: 'Bên phải', value: 'right' }, { label: 'Phía trên', value: 'top' }],
              admin: { condition: (_data, siblingData) => siblingData?.type === 'custom', width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'buttonLabel', label: 'Tên nút', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.type === 'custom', width: '50%', placeholder: 'Xem chi tiết' } },
            {
              name: 'buttonLinkMode', label: 'Cách tạo liên kết nút', type: 'select', defaultValue: 'internal',
              options: [
                { label: 'Tự tạo trang mới / dùng trang cùng slug đã có', value: 'auto-page' },
                { label: 'Chọn Trang nội dung đã có', value: 'existing-page' },
                { label: 'Nhập đường dẫn nội bộ', value: 'internal' },
                { label: 'Liên kết ngoài', value: 'external' },
              ],
              admin: { condition: (_data, siblingData) => siblingData?.type === 'custom', width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'buttonPage', label: 'Chọn trang đã có', type: 'relationship', relationTo: 'pages', admin: { condition: (_data, siblingData) => siblingData?.type === 'custom' && siblingData?.buttonLinkMode === 'existing-page', width: '50%' } },
            { name: 'buttonNewPageTitle', label: 'Tên trang sẽ tự tạo', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.type === 'custom' && siblingData?.buttonLinkMode === 'auto-page', width: '50%', description: 'Để trống sẽ lấy tiêu đề section.' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'buttonNewPageSlug', label: 'Slug trang mới (không bắt buộc)', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.type === 'custom' && siblingData?.buttonLinkMode === 'auto-page', width: '50%' } },
            { name: 'buttonUrl', label: 'Liên kết nút', type: 'text', admin: { condition: (_data, siblingData) => siblingData?.type === 'custom' && (!siblingData?.buttonLinkMode || siblingData?.buttonLinkMode === 'internal' || siblingData?.buttonLinkMode === 'external'), width: '50%', placeholder: '/trang/duong-dan', description: 'Chế độ tự tạo/chọn trang sẽ tự điền liên kết khi lưu.' } },
          ],
        },
        /* ── MẪU BỐ CỤC HIỂN THỊ ── */
        {
          name: 'sectionLayout',
          label: 'Mẫu bố cục hiển thị bài viết',
          type: 'select',
          defaultValue: 'editorial-grid',
          admin: {
            condition: (_data: unknown, siblingData: any) => [
              'notices', 'procurement', 'documents', 'content-section', 'science', 'cantho-health-dept',
            ].includes(siblingData?.type),
            description: 'Chọn cách trình bày danh sách bài viết trong section này. Thay đổi ngay lập tức sau khi lưu, không cần code lại.',
          },
          options: [
            { label: '📰 Mẫu chuẩn – Bài nổi bật lớn + danh sách nhỏ (Editorial Grid)', value: 'editorial-grid' },
            { label: '🃏 Lưới thẻ đều – 4 thẻ cân bằng, ảnh đồng đều (Card Grid)', value: 'card-grid-4' },
            { label: '📋 Danh sách hàng – Ảnh nhỏ trái + tiêu đề phải (List Rows)', value: 'list-rows' },
            { label: '📝 Danh sách gọn – Chỉ tiêu đề + ngày, không ảnh (Compact List)', value: 'compact-list' },
          ],
        },
        {
          name: 'documentColumns',
          label: 'Số ô hiển thị trên 1 hàng (Áp dụng cho khối Văn bản mới)',
          type: 'select',
          defaultValue: '3',
          options: [
            { label: '3 ô / hàng (Chuẩn thoáng, hiển thị đầy đủ chi tiết)', value: '3' },
            { label: '4 ô / hàng (Cân đối, gọn gàng, hiển thị nhiều nội dung)', value: '4' },
            { label: '5 ô / hàng (Nhiều ô nhất, tinh gọn trên màn hình lớn)', value: '5' },
          ],
          admin: {
            condition: (_data: unknown, siblingData: any) => siblingData?.type === 'documents',
            description: 'Tùy chọn hiển thị 3, 4 hoặc 5 thẻ văn bản trên 1 hàng trên màn hình máy tính. Hệ thống tự động co giãn 2 ô trên tablet và 1 ô trên mobile.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'layoutItemLimit',
              label: 'Số bài hiển thị tối đa',
              type: 'number',
              min: 1,
              max: 20,
              defaultValue: 5,
              admin: {
                width: '33%',
                condition: (_data: unknown, siblingData: any) => [
                  'notices', 'procurement', 'documents', 'content-section', 'cantho-health-dept',
                ].includes(siblingData?.type),
                description: 'Áp dụng cho tất cả mẫu bố cục.',
              },
            },
            {
              name: 'layoutShowDate',
              label: 'Hiển thị ngày đăng',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '33%',
                condition: (_data: unknown, siblingData: any) => [
                  'notices', 'procurement', 'documents', 'content-section', 'cantho-health-dept',
                ].includes(siblingData?.type),
              },
            },
            {
              name: 'layoutShowCategory',
              label: 'Hiển thị chuyên mục',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '33%',
                condition: (_data: unknown, siblingData: any) => [
                  'notices', 'procurement', 'documents', 'content-section', 'cantho-health-dept',
                ].includes(siblingData?.type),
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'layoutShowExcerpt',
              label: 'Hiển thị mô tả ngắn',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                width: '33%',
                condition: (_data: unknown, siblingData: any) => [
                  'notices', 'procurement', 'documents', 'content-section', 'cantho-health-dept',
                ].includes(siblingData?.type),
              },
            },
            {
              name: 'layoutCardBadge',
              label: 'Nhãn hiển thị góc thẻ (badge)',
              type: 'text',
              admin: {
                width: '66%',
                placeholder: 'Ví dụ: THÔNG BÁO – để trống sẽ dùng tên chuyên mục',
                condition: (_data: unknown, siblingData: any) => [
                  'notices', 'procurement', 'documents', 'content-section', 'cantho-health-dept',
                ].includes(siblingData?.type),
                description: 'Nhãn hiển thị trên thẻ bài nổi bật (chỉ với mẫu Editorial Grid và Card Grid).',
              },
            },
          ],
        },
        /* ── HẾT MẪU BỐ CỤC ── */
        {
          type: 'row',
          fields: [
            colorField('eyebrowColor', 'Màu nhãn nhỏ', { admin: { placeholder: '#0878d1', width: '25%' } }),
            colorField('titleColor', 'Màu tiêu đề', { admin: { placeholder: '#143653', width: '25%' } }),
            colorField('descriptionColor', 'Màu mô tả', { admin: { placeholder: '#647f94', width: '25%' } }),
            colorField('backgroundColor', 'Màu nền mục', { admin: { placeholder: '#ffffff', width: '25%' } }),
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'eyebrowSize', label: 'Cỡ nhãn nhỏ (px)', type: 'number', min: 8, max: 40, admin: { width: '25%' } },
            { name: 'titleSize', label: 'Cỡ tiêu đề (px)', type: 'number', min: 18, max: 72, admin: { width: '25%' } },
            { name: 'descriptionSize', label: 'Cỡ mô tả (px)', type: 'number', min: 10, max: 36, admin: { width: '25%' } },
            {
              name: 'fontFamily',
              label: 'Font chữ tiêu đề',
              type: 'select',
              admin: { width: '25%' },
              options: [
                { label: 'Mặc định hệ thống', value: '' },
                { label: 'Inter', value: 'Inter, sans-serif' },
                { label: 'Roboto', value: 'Roboto, sans-serif' },
                { label: 'Outfit', value: 'Outfit, sans-serif' },
                { label: 'Be Vietnam Pro', value: '"Be Vietnam Pro", sans-serif' },
                { label: 'Montserrat', value: 'Montserrat, sans-serif' },
                { label: 'Open Sans', value: '"Open Sans", sans-serif' },
                { label: 'Source Serif 4', value: '"Source Serif 4", serif' },
                { label: 'Merriweather', value: 'Merriweather, serif' },
              ],
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'paddingTop', label: 'Khoảng cách phía trên (px)', type: 'number', min: 0, max: 200, defaultValue: 42, admin: { width: '25%' } },
            { name: 'paddingBottom', label: 'Khoảng cách phía dưới (px)', type: 'number', min: 0, max: 200, defaultValue: 42, admin: { width: '25%' } },
            { name: 'contentWidth', label: 'Độ rộng nội dung (px)', type: 'number', min: 680, max: 1600, defaultValue: 1180, admin: { width: '25%' } },
            { name: 'headingGap', label: 'Cách tiêu đề với nội dung (px)', type: 'number', min: 0, max: 100, defaultValue: 18, admin: { width: '25%' } },
          ],
        },
      ],
    },
  ],
}
