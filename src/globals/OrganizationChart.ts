import type { GlobalConfig, Field } from 'payload'
import { admins, loggedIn } from '@/access'

const leaderFields = (): Field[] => [
  {
    name: 'doctorRef',
    label: 'Liên kết từ Bác sĩ (Quản trị → Tổ chức → Bác sĩ)',
    type: 'relationship',
    relationTo: 'doctors',
    admin: {
      description: 'Nếu chọn bác sĩ, hệ thống sẽ tự động lấy tên, ảnh đại diện và chức danh của bác sĩ.',
    },
  },
  { name: 'name', label: 'Họ và tên', type: 'text' },
  { name: 'title', label: 'Chức danh hiển thị', type: 'text' },
  { 
    name: 'photo', 
    label: 'Ảnh chân dung', 
    type: 'upload', 
    relationTo: 'media', 
    admin: { 
      description: 'Kích thước hiển thị đẹp nhất: Tỷ lệ 3:4 hoặc 4:5 (khuyến nghị 600×800px hoặc 450×600px, dung lượng < 2MB). Có thể tải ảnh mới hoặc chọn từ Thư viện. Nếu để trống, hệ thống sẽ tự dùng ảnh đại diện từ Bác sĩ liên kết.' 
    } 
  },
  { name: 'responsibility', label: 'Lĩnh vực phụ trách / Nhiệm vụ', type: 'text' },
  {
    type: 'row',
    fields: [
      {
        name: 'imageStyle',
        label: 'Kiểu hiển thị ảnh riêng cho ô này',
        type: 'select',
        enumName: 'org_leader_img_style',
        defaultValue: 'inherit',
        options: [
          { label: '⚙️ Theo cài đặt chung của sơ đồ', value: 'inherit' },
          { label: '🖼️ Tràn viền toàn ô thẻ (Full Width / Card Top - Khuyến nghị)', value: 'full-cover' },
          { label: '📐 Phủ kín khung ảnh (Cover Fit - Không viền trắng)', value: 'cover-box' },
          { label: '🔍 Vừa vặn nguyên gốc (Contain Fit - Giữ toàn ảnh)', value: 'contain-box' },
          { label: '🔲 Chân dung bo góc lọt lòng (Inset Rounded)', value: 'rounded-inset' },
          { label: '⚪ Chân dung hình tròn (Circle Avatar)', value: 'circle' },
        ],
        admin: {
          width: '50%',
          description: 'Chọn kiểu hiển thị riêng cho ô này hoặc để theo cài đặt chung.',
        },
      },
      {
        name: 'imageFit',
        label: 'Cách khớp ảnh riêng cho ô này',
        type: 'select',
        enumName: 'org_leader_img_fit',
        defaultValue: 'inherit',
        options: [
          { label: '⚙️ Theo cài đặt chung', value: 'inherit' },
          { label: 'Phủ kín không chừa viền trắng (Cover)', value: 'cover' },
          { label: 'Hiển thị trọn vẹn toàn bộ hình (Contain)', value: 'contain' },
        ],
        admin: {
          width: '50%',
          description: 'Cover giúp phủ kín ô; Contain giữ trọn hình gốc.',
        },
      },
    ],
  },
  { name: 'phone', label: 'Điện thoại liên hệ', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
]

export const OrganizationChart: GlobalConfig = {
  slug: 'organization-chart',
  label: 'Sơ đồ tổ chức',
  admin: {
    group: '🩺 Chuyên môn & Tổ chức',
    description: 'Quản lý sơ đồ bộ máy: Giám đốc, các Phó Giám đốc, Khối Phòng chức năng và Khối Khoa chuyên môn.',
  },
  access: { read: () => true, update: admins },
  versions: { max: 20 },
  fields: [
    { name: 'pageTitle', label: 'Tiêu đề trang', type: 'text', defaultValue: 'Sơ đồ tổ chức Bệnh viện Đa khoa Khu vực Thới Lai', required: true },
    { name: 'description', label: 'Mô tả ngắn (Hỗ trợ Enter xuống dòng)', type: 'textarea', defaultValue: 'Cơ cấu tổ chức bộ máy và hệ thống các khoa, phòng trực thuộc Bệnh viện Đa khoa Khu vực Thới Lai.' },
    {
      name: 'showLeadershipSection',
      label: 'Hiển thị Khối 1: Ban Lãnh đạo Bệnh viện',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'leadershipTitle',
      label: 'Tiêu đề Khối 1',
      type: 'text',
      defaultValue: 'Ban Lãnh đạo Bệnh Viện',
    },
    {
      name: 'showTreeSection',
      label: 'Hiển thị Khối 2: Sơ đồ tổ chức bộ máy',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'treeTitle',
      label: 'Tiêu đề Khối 2',
      type: 'text',
      defaultValue: 'Sơ đồ tổ chức bộ máy',
    },
    {
      name: 'director',
      label: 'Bậc 1 – Giám đốc Bệnh viện',
      type: 'group',
      fields: [
        { name: 'enabled', label: 'Hiển thị ô Giám đốc', type: 'checkbox', defaultValue: true },
        ...leaderFields(),
      ],
    },
    {
      name: 'deputyDirectors',
      label: 'Bậc 2 – Các Phó Giám đốc Bệnh viện',
      type: 'array',
      maxRows: 8,
      admin: { description: 'Có thể thêm các Phó Giám đốc (tối đa 8); tự động canh đều cân đối trên sơ đồ; kéo thả để đổi vị trí.' },
      fields: [
        { name: 'enabled', label: 'Hiển thị ô Phó Giám đốc này', type: 'checkbox', defaultValue: true },
        ...leaderFields(),
      ],
    },
    {
      name: 'offices',
      label: 'Bậc 3 – Khối Phòng chức năng',
      type: 'array',
      admin: { description: 'Chọn các Phòng chức năng; kéo thả để đổi thứ tự.' },
      fields: [
        {
          name: 'unit',
          label: 'Phòng chức năng',
          type: 'relationship',
          relationTo: 'departments',
          required: true,
          filterOptions: {
            or: [
              { unitType: { equals: 'office' } },
              { kind: { equals: 'office' } },
            ],
          },
        },
      ],
    },
    {
      name: 'departments',
      label: 'Bậc 3 – Khối Khoa chuyên môn',
      type: 'array',
      admin: { description: 'Chọn các Khoa chuyên môn; kéo thả để đổi thứ tự.' },
      fields: [
        {
          name: 'unit',
          label: 'Khoa',
          type: 'relationship',
          relationTo: 'departments',
          required: true,
          filterOptions: {
            and: [
              { unitType: { not_equals: 'office' } },
              { kind: { not_equals: 'office' } },
            ],
          },
        },
      ],
    },
    {
      name: 'appearance',
      label: 'Màu sắc hiển thị',
      type: 'group',
      fields: [
        { name: 'primaryColor', label: 'Màu chính', type: 'text', defaultValue: '#0878D1' },
        { name: 'directorColor', label: 'Màu thẻ Giám đốc', type: 'text', defaultValue: '#075B9E' },
        { name: 'deputyColor', label: 'Màu thẻ Phó Giám đốc', type: 'text', defaultValue: '#0B84D8' },
        { name: 'officeColor', label: 'Màu nhóm Phòng', type: 'text', defaultValue: '#188B72' },
        { name: 'departmentColor', label: 'Màu nhóm Khoa', type: 'text', defaultValue: '#6B62C8' },
      ],
    },
    {
      name: 'imageSettings',
      label: '🖼️ Tùy chọn hiển thị ảnh Ban Lãnh đạo (Toàn trang)',
      type: 'group',
      admin: {
        description: 'Cấu hình giao diện và cách hiển thị ảnh chân dung của Giám đốc và các Phó Giám đốc trên toàn sơ đồ.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'imageStyle',
              label: 'Kiểu hiển thị ảnh mặc định',
              type: 'select',
              enumName: 'org_global_img_style',
              defaultValue: 'full-cover',
              options: [
                { label: '🖼️ Tràn viền toàn ô thẻ (Full Width / Card Top - Khuyến nghị)', value: 'full-cover' },
                { label: '📐 Phủ kín khung ảnh (Cover Fit - Không viền trắng hai bên)', value: 'cover-box' },
                { label: '🔍 Vừa vặn nguyên gốc (Contain Fit - Giữ toàn bộ hình)', value: 'contain-box' },
                { label: '🔲 Chân dung bo góc lọt lòng (Inset Rounded)', value: 'rounded-inset' },
                { label: '⚪ Chân dung hình tròn (Circle Avatar)', value: 'circle' },
              ],
              admin: {
                width: '50%',
                description: 'Kiểu dáng hiển thị ảnh thẻ Ban Giám đốc.',
              },
            },
            {
              name: 'imageAspectRatio',
              label: 'Tỷ lệ khung ảnh',
              type: 'select',
              enumName: 'org_global_img_ratio',
              defaultValue: '3/4',
              options: [
                { label: 'Tỷ lệ 3:4 (Chuẩn chân dung y tế - Đẹp nhất)', value: '3/4' },
                { label: 'Tỷ lệ 4:5 (Chân dung đứng dài)', value: '4/5' },
                { label: 'Tỷ lệ 1:1 (Khung vuông)', value: '1/1' },
                { label: 'Tự do theo chiều cao thẻ', value: 'auto' },
              ],
              admin: {
                width: '50%',
                description: 'Tỷ lệ khung ảnh chân dung.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'imageFit',
              label: 'Cách khớp ảnh trong khung',
              type: 'select',
              enumName: 'org_global_img_fit',
              defaultValue: 'cover',
              options: [
                { label: 'Phủ kín khung không để viền trắng (Cover - Cắt vừa khung)', value: 'cover' },
                { label: 'Hiển thị trọn vẹn toàn bộ hình ảnh (Contain - Không cắt mép)', value: 'contain' },
              ],
              admin: {
                width: '50%',
                description: 'Cover giúp ảnh phủ kín ô thẻ đẹp mắt; Contain giữ nguyên 100% chi tiết ảnh.',
              },
            },
            {
              name: 'imagePosition',
              label: 'Vị trí tiêu điểm ảnh',
              type: 'select',
              enumName: 'org_global_img_pos',
              defaultValue: 'top',
              options: [
                { label: 'Ưu tiên phía trên (Gương mặt / Đầu)', value: 'top' },
                { label: 'Chính giữa khung hình', value: 'center' },
                { label: 'Phần thân áo', value: 'bottom' },
              ],
              admin: {
                width: '50%',
                description: 'Khi ảnh bị cắt theo tỷ lệ, hệ thống sẽ ưu tiên giữ phần tiêu điểm này.',
              },
            },
          ],
        },
      ],
    },
  ],
}
