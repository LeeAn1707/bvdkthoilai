'use client'

import React, { useState, useEffect } from 'react'
import styles from './SpecialtiesCarousel.module.css'

export type SpecialtyCarouselItem = {
  id: string
  name: string
  slug: string
  departmentName?: string
  summary?: string
  tagline?: string
  icon?: string
  iconCustomUrl?: string
  coverUrl?: string
  subCoverUrl?: string
  showSubCover?: boolean
  coverFitHome?: 'contain' | 'cover-top' | 'cover-center' | 'cover-bottom' | 'cover' | 'fill' | string
  coverFit?: 'contain' | 'cover-top' | 'cover-center' | 'cover-bottom' | 'cover' | 'fill' | string
  coverPosition?: 'top' | 'center' | 'bottom' | string
}

type Props = {
  items: SpecialtyCarouselItem[]
  autoplaySeconds?: number
}

// Bộ ảnh chất lượng cao chuyên biệt chuẩn y tế đại diện cho từng loại chuyên ngành
// Giúp ảnh thay đổi sống động, trực quan ngay lập tức khi hover/focus ngay cả khi chưa upload ảnh riêng
const SPECIALTY_DEFAULT_IMAGES: Record<string, { main: string; sub: string; badge: string }> = {
  emergency: {
    main: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop', // Cấp cứu - ICU hồi sức
    sub: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=800&auto=format&fit=crop',
    badge: 'CẤP CỨU & HỒI SỨC TÍCH CỰC 24/7',
  },
  imaging: {
    main: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop',
    sub: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=800&auto=format&fit=crop',
    badge: 'CHẨN ĐOÁN HÌNH ẢNH KỸ THUẬT CAO',
  },
  lab: {
    main: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop', // Phòng xét nghiệm / KSNK
    sub: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=800&auto=format&fit=crop',
    badge: 'XÉT NGHIỆM & KIỂM SOÁT NHIỄM KHUẨN',
  },
  pediatrics: {
    main: 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?q=80&w=1200&auto=format&fit=crop', // Nhi khoa thân thiện
    sub: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=800&auto=format&fit=crop',
    badge: 'CHĂM SÓC SỨC KHỎE NHI TOÀN DIỆN',
  },
  surgery: {
    main: 'https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=1200&auto=format&fit=crop', // Phòng mổ ngoại khoa
    sub: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=800&auto=format&fit=crop',
    badge: 'NGOẠI KHOA & PHẪU THUẬT AN TOÀN',
  },
  internal: {
    main: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1200&auto=format&fit=crop', // Khám nội tổng quát
    sub: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop',
    badge: 'NỘI KHOA ĐA KHOA CHUYÊN SÂU',
  },
  rehab: {
    main: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200&auto=format&fit=crop', // YHCT & Phục hồi chức năng
    sub: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop',
    badge: 'Y HỌC CỔ TRUYỀN & VẬT LÝ TRỊ LIỆU',
  },
  default: {
    main: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=1200&auto=format&fit=crop', // Không gian bệnh viện hiện đại
    sub: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=800&auto=format&fit=crop',
    badge: 'ĐƠN VỊ TIÊU BIỂU BỆNH VIỆN',
  },
}

export function SpecialtiesCarousel({
  items = [],
  autoplaySeconds = 4,
}: Props) {
  const safeItems = items.filter((item) => item?.name && item?.slug)
  const [hoveredIdx, setHoveredIdx] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  // Lấy tối đa 7 chuyên khoa tiêu biểu nhất hiển thị ở menu tra cứu nhanh bên trái
  const featuredList = safeItems.slice(0, 7)

  // Tự động chuyển động tuần hoàn giữa các chuyên khoa theo số giây cấu hình, tạm dừng khi người dùng rê chuột vào
  useEffect(() => {
    // Nếu đặt <= 0 thì tắt tự động chuyển động
    if (featuredList.length <= 1 || isPaused || autoplaySeconds <= 0) return

    const intervalMs = Math.max(1000, autoplaySeconds * 1000)
    const timer = setInterval(() => {
      setHoveredIdx((prev) => (prev + 1) % featuredList.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [featuredList.length, isPaused, autoplaySeconds])

  if (!safeItems.length) {
    return (
      <div className="professionalEmpty">
        Chưa có chuyên khoa nào được công khai.
      </div>
    )
  }

  const activeSpecialty = featuredList[hoveredIdx] || featuredList[0]

  // Xác định nhóm chuyên ngành (dựa vào cấu hình Admin CMS hoặc tự động phát hiện theo tên)
  const detectSpecialtyCategory = (name: string, iconKey?: string): string => {
    if (iconKey && iconKey !== 'default' && SPECIALTY_DEFAULT_IMAGES[iconKey]) {
      return iconKey
    }
    const lower = name.toLowerCase()
    if (lower.includes('cấp cứu') || lower.includes('hồi sức') || lower.includes('icu')) return 'emergency'
    if (lower.includes('chẩn đoán') || lower.includes('hình ảnh') || lower.includes('x-quang') || lower.includes('siêu âm') || lower.includes('ct')) return 'imaging'
    if (lower.includes('kiểm soát') || lower.includes('nhiễm khuẩn') || lower.includes('xét nghiệm') || lower.includes('vi sinh')) return 'lab'
    if (lower.includes('nhi')) return 'pediatrics'
    if (lower.includes('ngoại') || lower.includes('phẫu thuật') || lower.includes('gây mê')) return 'surgery'
    if (lower.includes('cổ truyền') || lower.includes('phục hồi') || lower.includes('vật lý trị liệu')) return 'rehab'
    if (lower.includes('nội') || lower.includes('khám bệnh')) return 'internal'
    return 'default'
  }

  // Tự động sinh dòng kỹ thuật / dịch vụ tóm tắt (dòng 2) nếu CMS chưa nhập
  const getSpecialtyTagline = (item: SpecialtyCarouselItem): string => {
    if (item.tagline && item.tagline.trim()) {
      return item.tagline.trim()
    }
    const lower = item.name.toLowerCase()
    if (lower.includes('cấp cứu') || lower.includes('hồi sức')) return 'Cấp cứu 24/7 • Hồi sức tích cực ICU'
    if (lower.includes('chẩn đoán') || lower.includes('hình ảnh')) return 'X-Quang kỹ thuật số • Siêu âm Doppler màu'
    if (lower.includes('kiểm soát') || lower.includes('nhiễm khuẩn')) return 'Vô khuẩn chuẩn quốc gia • An toàn người bệnh'
    if (lower.includes('khám bệnh')) return 'Tiếp nhận liên tục • Khám BHYT & Dịch vụ'
    if (lower.includes('nội tổng hợp')) return 'Điều trị tim mạch, hô hấp, tiêu hóa, tiểu đường'
    if (lower.includes('kế hoạch')) return 'Quản lý chất lượng • Điều phối chuyên môn'
    if (lower.includes('nhi')) return 'Khám & chăm sóc sơ sinh, bệnh nhi toàn diện'
    if (lower.includes('ngoại')) return 'Phẫu thuật an toàn • Chấn thương chỉnh hình'
    return 'Dịch vụ kỹ thuật chất lượng • Tận tâm phục vụ'
  }

  // Phân loại Icon y tế cho từng chuyên khoa (ưu tiên icon upload riêng trong CMS, rồi đến lựa chọn icon từ danh sách)
  const renderSpecialtyIcon = (item: SpecialtyCarouselItem) => {
    if (item.iconCustomUrl) {
      return (
        <img
          src={item.iconCustomUrl}
          alt=""
          style={{ width: 22, height: 22, objectFit: 'contain' }}
          aria-hidden="true"
        />
      )
    }

    const category = detectSpecialtyCategory(item.name, item.icon)

    switch (category) {
      case 'emergency':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            <path d="M12 5v6" /><path d="M9 8h6" />
          </svg>
        )
      case 'imaging':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        )
      case 'lab':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        )
      case 'pediatrics':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h.01" /><path d="M15 12h.01" />
            <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
            <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
          </svg>
        )
      case 'surgery':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14.5 9.5 4 4" /><path d="m17 7-6.5 6.5" /><path d="M8.5 15.5 3 21" /><path d="m18 10 3-3" />
          </svg>
        )
      case 'pharmacy':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
        )
      case 'dental':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C7.5 2 4 5.5 4 10c0 4.5 2 9 4 12 1.5-1 2-4 4-4s2.5 3 4 4c2-3 4-7.5 4-12 0-4.5-3.5-8-8-8z" />
          </svg>
        )
      case 'rehab':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        )
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 10.5h-4.5V6a1.5 1.5 0 0 0-3 0v4.5H7a1.5 1.5 0 0 0 0 3h4.5V18a1.5 1.5 0 0 0 3 0v-4.5H19a1.5 1.5 0 0 0 0-3z" />
          </svg>
        )
    }
  }

  // Nhận diện nhóm thể loại của chuyên khoa đang được active (hover hoặc focus)
  const activeCategory = detectSpecialtyCategory(activeSpecialty.name, activeSpecialty.icon)
  const defaultVisual = SPECIALTY_DEFAULT_IMAGES[activeCategory] || SPECIALTY_DEFAULT_IMAGES.default

  // Ảnh trực quan đại diện: Ưu tiên ảnh do Admin upload trong CMS, nếu chưa có thì dùng bộ ảnh đặc thù theo từng chuyên ngành
  const displayImage = activeSpecialty.coverUrl || defaultVisual.main
  const subDisplayImage = activeSpecialty.subCoverUrl || defaultVisual.sub
  const eyebrowText = defaultVisual.badge
  const shouldShowSubCover = activeSpecialty.showSubCover !== false

  // Tính toán cách hiển thị ảnh: ưu tiên coverFitHome/coverFit và coverPosition đã cấu hình trong CMS
  const getCoverImageStyle = (item: SpecialtyCarouselItem): React.CSSProperties => {
    const rawFit = item.coverFitHome || item.coverFit || 'cover-top'
    const rawPos = item.coverPosition || 'top'

    let objectFit: React.CSSProperties['objectFit'] = 'cover'
    let objectPosition: React.CSSProperties['objectPosition'] = 'center center'

    if (rawFit === 'contain') {
      objectFit = 'contain'
    } else if (rawFit === 'fill') {
      objectFit = 'fill'
    } else {
      objectFit = 'cover'
    }

    if (rawFit === 'cover-top' || rawPos === 'top') {
      objectPosition = 'top center'
    } else if (rawFit === 'cover-bottom' || rawPos === 'bottom') {
      objectPosition = 'bottom center'
    } else if (rawFit === 'cover-center' || rawPos === 'center') {
      objectPosition = 'center center'
    }

    return {
      objectFit,
      objectPosition,
    }
  }

  const activeImageStyle = getCoverImageStyle(activeSpecialty)

  return (
    <div
      className={styles.showcaseSplitLayout}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Khu vực chuyên khoa nổi bật"
    >
      {/* CỘT TRÁI: DANH BẠ TRA CỨU NHANH CÁC CHUYÊN KHOA */}
      <div className={styles.listColumn}>
        <div className={styles.specialtyList} role="tablist" aria-label="Danh sách chuyên khoa nổi bật">
          {featuredList.map((item, idx) => {
            const isActive = idx === hoveredIdx
            const tagline = getSpecialtyTagline(item)

            return (
              <a
                key={item.id || `spec-list-${idx}`}
                href={`/chuyen-khoa/${item.slug}`}
                className={`${styles.specialtyRow} ${isActive ? styles.rowActive : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                tabIndex={0}
              >
                <div className={styles.rowLeft}>
                  <div className={styles.rowIcon}>
                    {renderSpecialtyIcon(item)}
                  </div>
                  <div className={styles.rowTextGroup}>
                    <span className={styles.rowTitle}>{item.name}</span>
                    <span className={styles.rowSubtitle}>{tagline}</span>
                  </div>
                </div>

                <div className={styles.rowArrow}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </a>
            )
          })}
        </div>

        <div className={styles.actionBtnWrapper}>
          <a href="/chuyen-khoa" className={styles.seeAllPrimaryBtn}>
            <span>Xem tất cả chuyên khoa</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>
      </div>

      {/* CỘT PHẢI: CỤM ẢNH NGHỆ THUẬT Y KHOA NỔI KHỐI SANG TRỌNG - THAY ĐỔI THEO KHOA ĐƯỢC FOCUS/HOVER */}
      <div className={styles.visualColumn}>
        {/* Khối ảnh chính ở trên */}
        <div className={`${styles.mainPhotoCard} ${!shouldShowSubCover ? styles.mainPhotoCardFull : ''}`}>
          <img
            key={activeSpecialty.slug || activeSpecialty.name}
            src={displayImage}
            alt={activeSpecialty.name}
            className={styles.mainPhotoImg}
            style={activeImageStyle}
            loading="lazy"
          />
          <div className={styles.photoOverlayGradient} />
          
          <div className={styles.photoBadgeInfo}>
            <span className={styles.badgeEyebrow}>{eyebrowText}</span>
            <h4 className={styles.badgeTitle}>{activeSpecialty.name}</h4>
            <p className={styles.badgeDesc}>
              {activeSpecialty.summary ||
                getSpecialtyTagline(activeSpecialty) ||
                'Trang thiết bị hiện đại, quy trình điều trị chuyên môn sâu, tận tâm phục vụ bệnh nhân.'}
            </p>
          </div>
        </div>

        {/* Khối ảnh phụ nhỏ lồng ghép nghệ thuật góc dưới (cho phép bật/tắt để không che ảnh chính) */}
        {shouldShowSubCover && (
          <div className={styles.subFloatingPhoto}>
            <img
              key={`sub-${activeSpecialty.slug || activeSpecialty.name}`}
              src={subDisplayImage}
              alt={activeSpecialty.name}
              className={styles.subPhotoImg}
              loading="lazy"
            />
            <div className={styles.floatingStatPill}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0878d1" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              <span>Phục vụ 24/7</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
