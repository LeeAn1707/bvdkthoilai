import type { CSSProperties } from 'react'
import './khoa-phong.css'
import { PageHero } from '@/components/PageHero'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { getCMS } from '@/lib/payload'

export const revalidate = 60

// ── Phân loại đơn vị theo unitType / tên ────────────────────
type UnitGroup = 'leadership' | 'office' | 'clinical' | 'paraclinical'

function classifyUnit(item: any): UnitGroup {
  const name = (item.name || '').toLowerCase()
  const ut = (item.unitType || item.kind || '').toLowerCase()
  if (
    ut === 'leadership' ||
    name.includes('ban giám đốc') ||
    name.includes('ban lãnh đạo') ||
    name.includes('giám đốc bệnh viện')
  ) return 'leadership'
  if (ut === 'office') return 'office'
  if (ut === 'paraclinical') return 'paraclinical'
  return 'clinical'
}

// ── Cấu hình màu sắc & nhãn từng nhóm ─────────────────────
const GROUP_CONFIG: Record<UnitGroup, {
  label: string
  badge: string
  accent: string
  iconBg: string
  iconColor: string
  symbol: string
  filterKey: string
}> = {
  leadership: {
    label: 'Ban Lãnh đạo Bệnh viện',
    badge: 'BAN LÃNH ĐẠO',
    accent: '#b45309',
    iconBg: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
    iconColor: '#78350f',
    symbol: '★',
    filterKey: 'leadership',
  },
  office: {
    label: 'Phòng chức năng',
    badge: 'PHÒNG CHỨC NĂNG',
    accent: '#6d28d9',
    iconBg: 'linear-gradient(135deg, #ede9fe 0%, #8b5cf6 100%)',
    iconColor: '#ffffff',
    symbol: '⌂',
    filterKey: 'office',
  },
  clinical: {
    label: 'Khoa lâm sàng',
    badge: 'KHOA LÂM SÀNG',
    accent: '#15803d',
    iconBg: 'linear-gradient(135deg, #dcfce7 0%, #22c55e 100%)',
    iconColor: '#ffffff',
    symbol: '✚',
    filterKey: 'clinical',
  },
  paraclinical: {
    label: 'Khoa cận lâm sàng',
    badge: 'KHOA CẬN LÂM SÀNG',
    accent: '#0369a1',
    iconBg: 'linear-gradient(135deg, #e0f2fe 0%, #0ea5e9 100%)',
    iconColor: '#ffffff',
    symbol: '◎',
    filterKey: 'paraclinical',
  },
}

const GROUP_ORDER: UnitGroup[] = ['leadership', 'office', 'clinical', 'paraclinical']

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind: activeFilter } = await searchParams

  let allDepts: any[] = []
  try {
    const payload = await getCMS()
    const [result, specRes] = await Promise.all([
      payload.find({
        collection: 'departments',
        limit: 200,
        sort: ['order', 'name'],
        depth: 0,
      }),
      payload
        .find({
          collection: 'specialties',
          where: { active: { equals: true } },
          limit: 200,
          sort: ['order', '-updatedAt'],
          depth: 0,
        })
        .catch(() => ({ docs: [] })),
    ])

    const specs = (specRes.docs as any[]) || []
    const specByDeptId = new Map<string | number, any>()
    for (const s of specs) {
      const dId = typeof s.department === 'object' ? s.department?.id : s.department
      if (dId && !specByDeptId.has(dId)) {
        specByDeptId.set(dId, s)
      }
    }

    allDepts = (result.docs as any[])
      .filter((item) => item.active !== false)
      .map((item) => {
        const linkedSpec = specByDeptId.get(item.id)
        if (!linkedSpec || item.syncFromSpecialty === false) return item
        return {
          ...item,
          summary: item.summary || linkedSpec.summary || '',
          tagline: item.tagline || linkedSpec.tagline || '',
          cover: item.cover || linkedSpec.cover || null,
        }
      })
  } catch {}

  // Phân loại toàn bộ
  const classified = allDepts.map((item) => ({
    ...item,
    _group: classifyUnit(item),
  }))

  // Đếm theo nhóm (cho filter count)
  const counts: Record<string, number> = {}
  for (const key of GROUP_ORDER) {
    counts[key] = classified.filter((d) => d._group === key).length
  }

  // Lọc theo filter đang chọn
  const displayed = activeFilter
    ? classified.filter((d) => d._group === activeFilter)
    : classified

  // Tạo danh sách nhóm để render
  const groups = GROUP_ORDER
    .map((key) => ({
      key,
      cfg: GROUP_CONFIG[key],
      items: displayed.filter((d) => d._group === key),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      <SiteHeader />
      <PageHero
        eyebrow="TỔ CHỨC BỆNH VIỆN"
        title="Khoa, Phòng trực thuộc"
        description="Hệ thống các khoa chuyên môn và phòng chức năng của Bệnh viện Đa khoa Khu vực Thới Lai."
        breadcrumb="Khoa – Phòng"
      />

      {/* Filter Tab Bar */}
      <nav className="kpFilterBar" aria-label="Lọc theo loại đơn vị">
        <div className="kpFilterBarInner">
          <a
            href="/khoa-phong"
            className={`kpFilterBtn${!activeFilter ? ' active' : ''}`}
          >
            Tất cả
            <span className="kpFilterCount">{allDepts.length}</span>
          </a>
          {GROUP_ORDER.filter((k) => counts[k] > 0).map((key) => {
            const cfg = GROUP_CONFIG[key]
            return (
              <a
                key={key}
                href={`/khoa-phong?kind=${cfg.filterKey}`}
                className={`kpFilterBtn${activeFilter === cfg.filterKey ? ' active' : ''}`}
              >
                {cfg.label}
                <span className="kpFilterCount">{counts[key]}</span>
              </a>
            )
          })}
        </div>
      </nav>

      <main id="main-content" className="kpMain">
        <div className="container">
          {displayed.length === 0 ? (
            <div className="kpEmpty">Không tìm thấy đơn vị phù hợp.</div>
          ) : (
            groups.map(({ key, cfg, items }) => (
              <section
                key={key}
                className="kpSection"
                aria-labelledby={`section-${key}`}
                style={
                  {
                    '--kp-accent': cfg.accent,
                    '--kp-icon-bg': cfg.iconBg,
                  } as CSSProperties
                }
              >
                {/* Section Header */}
                <div className="kpSectionHeader">
                  <span
                    className="kpSectionIconWrap"
                    aria-hidden="true"
                    style={{ background: cfg.iconBg, color: cfg.iconColor }}
                  >
                    {cfg.symbol}
                  </span>
                  <div>
                    <h2 id={`section-${key}`} className="kpSectionTitle">
                      {cfg.label}
                    </h2>
                    <p className="kpSectionCount">{items.length} đơn vị</p>
                  </div>
                </div>

                {/* Card Grid */}
                <div className="kpGrid">
                  {items.map((item) => (
                    <a
                      key={item.id}
                      className="kpCard"
                      href={`/khoa-phong/${item.slug}`}
                      style={
                        {
                          '--kp-card-accent': cfg.accent,
                        } as CSSProperties
                      }
                    >
                      {/* Icon */}
                      <span
                        className="kpCardIcon"
                        aria-hidden="true"
                        style={{
                          background: cfg.iconBg,
                          color: cfg.iconColor,
                        }}
                      >
                        {cfg.symbol}
                      </span>

                      {/* Body */}
                      <div className="kpCardBody">
                        <span className="kpCardBadge">{cfg.badge}</span>
                        <h3 className="kpCardName">{item.name}</h3>
                        <p className="kpCardDesc">
                          {item.tagline || item.location || item.summary || 'Xem thông tin chi tiết đơn vị'}
                        </p>
                      </div>

                      {/* Arrow */}
                      <i className="kpCardArrow" aria-hidden="true">›</i>
                    </a>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
