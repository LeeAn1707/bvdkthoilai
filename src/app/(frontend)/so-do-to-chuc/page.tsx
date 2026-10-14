import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { PageHero } from '@/components/PageHero'
import { getCMS, getGlobal } from '@/lib/payload'
import { mediaUrl } from '@/lib/media'
import './org-chart.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Cơ cấu tổ chức - Bệnh viện Đa khoa Khu vực Thới Lai',
  description: 'Sơ đồ cơ cấu tổ chức bộ máy, Ban Giám đốc và các Phòng, Khoa trực thuộc Bệnh viện Đa khoa Khu vực Thới Lai theo chuẩn quốc gia.',
}

const unitValue = (entry: any) => (entry?.unit && typeof entry.unit === 'object' ? entry.unit : null)

interface LeaderProps {
  person: any
  kind: 'director' | 'deputy'
  fallbackRole: string
  fallbackDoctor?: any
  globalImageSettings?: any
  doctorExpertMap?: Map<number | string, any>
  mediaMap?: Map<number, any>
  doctorsList?: any[]
}

function LeaderCard({
  person,
  kind,
  fallbackRole,
  fallbackDoctor,
  globalImageSettings,
  doctorExpertMap,
  mediaMap,
  doctorsList,
}: LeaderProps) {
  // Tìm Bác sĩ liên kết đầy đủ
  const docRefId = typeof person?.doctorRef === 'object' ? person?.doctorRef?.id : person?.doctorRef
  const fullLinkedDoc = docRefId
    ? (doctorsList?.find((d: any) => d.id === docRefId) || (typeof person?.doctorRef === 'object' ? person.doctorRef : null))
    : null

  const linkedDoc = fullLinkedDoc || fallbackDoctor

  // 1. ƯU TIÊN 1: Lấy ảnh trực tiếp từ Sơ đồ tổ chức (person.photo)
  let rawPhoto = person?.photo
  if (typeof rawPhoto === 'number' && mediaMap?.has(rawPhoto)) {
    rawPhoto = mediaMap.get(rawPhoto)
  }
  let photoUrl = mediaUrl(rawPhoto, 'card')

  // 2. ƯU TIÊN 2: Nếu Sơ đồ tổ chức không có ảnh, lấy từ Bác sĩ liên kết (doctor.avatar)
  if (!photoUrl && linkedDoc?.avatar) {
    photoUrl = mediaUrl(linkedDoc.avatar, 'card')
  }

  // 3. ƯU TIÊN 3: Nếu vẫn chưa có ảnh, tìm trong danh mục Chuyên gia (our-experts)
  if (!photoUrl && linkedDoc?.id && doctorExpertMap) {
    const expert = doctorExpertMap.get(linkedDoc.id)
    if (expert?.image) {
      photoUrl = mediaUrl(expert.image, 'card')
    }
  }

  // 4. ƯU TIÊN 4: Fallback doctor avatar
  if (!photoUrl && fallbackDoctor?.avatar) {
    photoUrl = mediaUrl(fallbackDoctor.avatar, 'card')
  }

  const name = person?.name?.trim() || linkedDoc?.name || 'Đang cập nhật'
  const title = person?.title?.trim() || linkedDoc?.title || fallbackRole
  const responsibility = person?.responsibility?.trim() || (linkedDoc?.expertise || linkedDoc?.bio || '')
  const docUrl = linkedDoc?.slug ? `/bac-si/${linkedDoc.slug}` : undefined

  // Xác định kiểu hiển thị ảnh
  const effectiveStyle = (person?.imageStyle && person.imageStyle !== 'inherit')
    ? person.imageStyle
    : (globalImageSettings?.imageStyle || 'full-cover')

  const effectiveFit = (person?.imageFit && person.imageFit !== 'inherit')
    ? person.imageFit
    : (globalImageSettings?.imageFit || (effectiveStyle === 'contain-box' ? 'contain' : 'cover'))

  const effectiveAspectRatio = globalImageSettings?.imageAspectRatio || '3/4'
  const effectivePosition = globalImageSettings?.imagePosition || 'top'

  const cardContent = (
    <>
      <div
        className={`bmLeaderPhotoBox bmStyle_${effectiveStyle}`}
        data-style={effectiveStyle}
        data-fit={effectiveFit}
        data-aspect={effectiveAspectRatio}
        data-position={effectivePosition}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            loading="lazy"
            className="bmLeaderImg"
            style={{
              objectFit: effectiveFit as any,
              objectPosition: effectivePosition === 'top' ? 'top center' : (effectivePosition === 'bottom' ? 'bottom center' : 'center center'),
            }}
          />
        ) : (
          <div className="bmLeaderPlaceholder">
            <span>{name.trim().slice(0, 1) || '✚'}</span>
          </div>
        )}
      </div>
      <div className="bmLeaderMeta">
        <div className="bmLeaderRole">{title}</div>
        <h3 className="bmLeaderName">{name}</h3>
        {responsibility && <p className="bmLeaderDesc">{responsibility}</p>}
      </div>
    </>
  )

  if (docUrl) {
    return (
      <Link
        href={docUrl}
        className={kind === 'director' ? 'bmDirectorCard' : 'bmDeputyCard'}
        title={`Xem thông tin chi tiết: ${name}`}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <div className={kind === 'director' ? 'bmDirectorCard' : 'bmDeputyCard'}>
      {cardContent}
    </div>
  )
}

export default async function OrganizationChartPage() {
  let chart: any = {}
  let allUnits: any[] = []
  let doctors: any[] = []
  let siteSettings: any = null
  let doctorExpertMap = new Map<number | string, any>()
  let mediaMap = new Map<number, any>()

  try {
    const [settings, payload, siteRes] = await Promise.all([
      getGlobal('organization-chart'),
      getCMS(),
      getGlobal('site-settings').catch(() => null),
    ])
    chart = settings
    siteSettings = siteRes
    const [unitsRes, docsRes, expertsRes] = await Promise.all([
      payload.find({ collection: 'departments', limit: 100, sort: ['order', 'name'], depth: 1 }),
      payload.find({ collection: 'doctors', where: { active: { equals: true } }, limit: 100, sort: ['order', 'name'], depth: 1 }),
      payload.find({ collection: 'our-experts', limit: 100, depth: 1 }).catch(() => ({ docs: [] })),
    ])
    allUnits = unitsRes.docs as any[]
    doctors = docsRes.docs as any[]

    for (const exp of (expertsRes.docs as any[])) {
      const docId = typeof exp.doctorRef === 'object' ? exp.doctorRef?.id : exp.doctorRef
      if (docId) {
        doctorExpertMap.set(docId, exp)
      }
    }

    // Nếu ảnh trong sơ đồ là ID số (chưa populate), nạp bổ sung từ media
    const rawMediaIds: number[] = []
    if (typeof chart?.director?.photo === 'number') rawMediaIds.push(chart.director.photo)
    if (Array.isArray(chart?.deputyDirectors)) {
      for (const deputy of chart.deputyDirectors) {
        if (typeof deputy?.photo === 'number') rawMediaIds.push(deputy.photo)
      }
    }
    if (rawMediaIds.length > 0) {
      const mediaDocs = await payload.find({
        collection: 'media',
        where: { id: { in: rawMediaIds } },
        limit: rawMediaIds.length,
      }).then((res) => res.docs).catch(() => [])
      for (const m of mediaDocs) {
        mediaMap.set(m.id, m)
      }
    }
  } catch {}

  const hospitalName = siteSettings?.hospitalName || 'Bệnh viện Đa khoa Khu vực Thới Lai'

  // Lọc Ban Giám đốc từ DB Bác sĩ
  const boardDoctors = doctors.filter((doc: any) => {
    const dName = typeof doc.department === 'object' ? doc.department?.name : ''
    const t = `${doc.title || ''} ${doc.name || ''}`.toLowerCase()
    return dName.includes('Ban Giám đốc') || t.includes('giám đốc')
  })

  const directorDoctor = boardDoctors.find((d: any) => {
    const t = `${d.title || ''}`.toLowerCase()
    return (t.includes('giám đốc') || t.includes('gián đốc')) && !t.includes('phó')
  }) || doctors.find((d: any) => d.slug?.includes('tran-quoc-luan') || d.name?.includes('Trần Quốc Luận'))

  const deputyDoctors = boardDoctors.filter((d: any) => {
    const t = `${d.title || ''}`.toLowerCase()
    return t.includes('phó giám đốc') || (d.id !== directorDoctor?.id && d.name !== directorDoctor?.name)
  })
  // Đọc danh sách khoa phòng - luôn lấy từ CSDL thực
  const activeUnits = allUnits.filter((u) => u.active !== false && !u.name?.includes('Ban Giám đốc'))

  // Phân loại đơn vị theo chuẩn:
  // 1. Khối Phòng chức năng (office)
  // 2. Khối Lâm sàng (clinical)
  // 3. Khối Cận lâm sàng (paraclinical)
  // LUON lấy từ CSDL thực - nếu admin có thiết lập danh sách ưu tiên dùng đó, ngược lại tự phân loại từ unitType
  const configuredOffices = (chart?.offices || []).map(unitValue).filter(Boolean)
  const configuredDepartments = (chart?.departments || []).map(unitValue).filter(Boolean)

  // Phòng chức năng: admin chọn hoặc tự lậc theo unitType='office'
  const offices = configuredOffices.length > 0
    ? configuredOffices
    : activeUnits.filter((u) => u.unitType === 'office' || u.kind === 'office')

  // Khối lâm sàng: nếu admin chọn thì lấy các khoa lâm sàng được chọn, ngược lại tự động lấy từ DB
  const clinicalUnits = configuredDepartments.length > 0
    ? configuredDepartments.filter((u: any) => u.unitType === 'clinical' || (!u.unitType && u.kind === 'clinical'))
    : activeUnits.filter((u) => u.unitType === 'clinical' || (!u.unitType && u.kind === 'clinical' && u.name?.toLowerCase().includes('khoa')))

  // Khối cận lâm sàng: nếu admin chọn thì lấy các khoa cận lâm sàng được chọn, ngược lại tự động lấy từ DB
  const configuredParaclinical = configuredDepartments.filter((u: any) => u.unitType === 'paraclinical' || (!u.unitType && u.kind === 'paraclinical'))
  const paraclinicalUnits = configuredParaclinical.length > 0
    ? configuredParaclinical
    : activeUnits.filter((u) => u.unitType === 'paraclinical' || (!u.unitType && u.kind === 'paraclinical'))

  // Phó giám đốc
  const rawDeputies = Array.isArray(chart?.deputyDirectors) ? chart.deputyDirectors.filter((p: any) => p?.enabled !== false && (p?.name?.trim() || p?.doctorRef)) : []
  const deputies = rawDeputies.length > 0
    ? rawDeputies
    : (deputyDoctors.length > 0 ? deputyDoctors.map((doc: any) => ({ name: doc.name, title: doc.title, doctorRef: doc })) : [])

  const showLeadership = chart?.showLeadershipSection !== false
  const showTree = chart?.showTreeSection !== false
  const showDirector = chart?.director?.enabled !== false

  return (
    <>
      <SiteHeader />
      <PageHero
        eyebrow="CƠ CẤU BỘ MÁY"
        title={chart?.pageTitle || 'Sơ đồ tổ chức Bệnh viện'}
        description={chart?.description || `Cơ cấu tổ chức bộ máy và hệ thống các khoa, phòng trực thuộc ${hospitalName}.`}
      />
      <main className="bmOrgPage">
        <div className="container">
          {/* SECTION 1: BAN LÃNH ĐẠO BỆNH VIỆN */}
          {showLeadership && (showDirector || deputies.length > 0) && (
            <section className="bmLeadershipSection" aria-label="Ban Lãnh đạo Bệnh Viện">
              <div className="bmSectionHeader">
                <h2 className="bmSectionTitle" style={{ textWrap: 'balance' }}>{chart?.leadershipTitle || 'Ban Lãnh đạo Bệnh Viện'}</h2>
              </div>

              {/* Giám đốc ở trên cùng */}
              {showDirector && (
                <div className="bmDirectorWrap">
                  <LeaderCard
                    kind="director"
                    person={chart?.director}
                    fallbackRole="Giám đốc Bệnh viện"
                    fallbackDoctor={directorDoctor}
                    globalImageSettings={chart?.imageSettings}
                    doctorExpertMap={doctorExpertMap}
                    mediaMap={mediaMap}
                    doctorsList={doctors}
                  />
                </div>
              )}

              {/* Các Phó Giám đốc ở hàng dưới - tự canh chỉnh theo số lượng */}
              {deputies.length > 0 && (
                <div
                  className="bmDeputiesGrid"
                  data-count={String(Math.min(deputies.length, 8))}
                >
                  {deputies.map((person: any, index: number) => (
                    <LeaderCard
                      key={person?.id || index}
                      kind="deputy"
                      person={person}
                      fallbackRole="Phó Giám đốc Bệnh viện"
                      fallbackDoctor={deputyDoctors[index]}
                      globalImageSettings={chart?.imageSettings}
                      doctorExpertMap={doctorExpertMap}
                      mediaMap={mediaMap}
                      doctorsList={doctors}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: SƠ ĐỒ TỔ CHỨC BỘ MÁY */}
          {showTree && (
            <section className="bmTreeSection" aria-label="Sơ đồ tổ chức bộ máy">
              <div className="bmSectionHeader treeHead">
                <h2 className="bmSectionTitle" style={{ textWrap: 'balance' }}>{chart?.treeTitle || 'Sơ đồ tổ chức bộ máy'}</h2>
              </div>

              <div className="bmTreeWrap">
                {/* Cấp cao nhất: BAN GIÁM ĐỐC */}
                <div className="bmTreeBoardWrap">
                  <div className="bmTreeBoardBox">
                    <h3 className="bmTreeBoardBoxTitle">Ban Giám Đốc</h3>
                  <div className="bmTreeBoardBoxSub">Chỉ đạo & Điều hành toàn diện</div>
                </div>
              </div>

              {/* Đường nối xuống các khối */}
              <div className="bmTreeVerticalLine" aria-hidden="true" />
              <div className="bmTreeBranchContainer" aria-hidden="true">
                <div className="bmTreeBranchLine" />
                <div className="bmTreeBranchCenterLine" />
              </div>

              {/* 3 Khối Cột Chuẩn: Phòng Chức năng / Lâm sàng / Cận lâm sàng */}
              <div className="bmColumnsGrid">
                {/* Cột 1: Phòng Chức năng / VP */}
                <div className="bmColumnCard offices">
                  <div className="bmColumnHeader">
                    <div className="bmColumnHeaderLeft">
                      <span className="bmColumnIcon">🏢</span>
                      <h4 className="bmColumnHeaderTitle">Phòng Chức năng / VP</h4>
                    </div>
                    <span className="bmColumnCount">{offices.length}</span>
                  </div>
                  <ul className="bmUnitList">
                    {offices.map((unit: any, idx: number) => (
                      <li key={unit.id || idx} className="bmUnitItem">
                        <Link href={unit.slug ? `/khoa-phong/${unit.slug}` : '/khoa-phong'} className="bmUnitLink">
                          <span>{unit.name}</span>
                          <i>→</i>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cột 2: Khối Lâm sàng - Khoa */}
                <div className="bmColumnCard clinical">
                  <div className="bmColumnHeader">
                    <div className="bmColumnHeaderLeft">
                      <span className="bmColumnIcon">🩺</span>
                      <h4 className="bmColumnHeaderTitle">Khối Lâm sàng - Khoa</h4>
                    </div>
                    <span className="bmColumnCount">{clinicalUnits.length}</span>
                  </div>
                  <ul className="bmUnitList">
                    {clinicalUnits.map((unit: any, idx: number) => (
                      <li key={unit.id || idx} className="bmUnitItem">
                        <Link href={unit.slug ? `/khoa-phong/${unit.slug}` : '/khoa-phong'} className="bmUnitLink">
                          <span>{unit.name}</span>
                          <i>→</i>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cột 3: Khối Cận lâm sàng */}
                <div className="bmColumnCard paraclinical">
                  <div className="bmColumnHeader">
                    <div className="bmColumnHeaderLeft">
                      <span className="bmColumnIcon">🔬</span>
                      <h4 className="bmColumnHeaderTitle">Khối Cận lâm sàng</h4>
                    </div>
                    <span className="bmColumnCount">{paraclinicalUnits.length}</span>
                  </div>
                  <ul className="bmUnitList">
                    {paraclinicalUnits.map((unit: any, idx: number) => (
                      <li key={unit.id || idx} className="bmUnitItem">
                        <Link href={unit.slug ? `/khoa-phong/${unit.slug}` : '/khoa-phong'} className="bmUnitLink">
                          <span>{unit.name}</span>
                          <i>→</i>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Hộp Thông tin Nguyên tắc Phối hợp */}
              <div className="bmOrgInfoBox">
                <div className="bmOrgInfoIcon">ℹ️</div>
                <div className="bmOrgInfoContent">
                  <h4>Nguyên tắc hoạt động & Phối hợp chuyên môn</h4>
                  <p>
                    Bệnh viện Đa khoa Khu vực Thới Lai hoạt động dưới sự lãnh đạo tập trung của Ban Giám đốc. Các Phòng chức năng đóng vai trò tham mưu, tổng hợp và giám sát quy trình nghiệp vụ; các Khoa Lâm sàng và Cận lâm sàng phối hợp chặt chẽ trong tiếp nhận, cấp cứu, chẩn đoán và điều trị người bệnh với tinh thần trách nhiệm cao nhất.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
    <SiteFooter />
  </>
  )
}
