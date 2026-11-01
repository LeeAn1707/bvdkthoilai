'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import styles from './OurExpertsCarousel.module.css'

export type ExpertItem = {
  id?: string
  name: string
  position?: string
  subPosition?: string
  badge?: string
  image?: string
  imageFit?: 'contain' | 'cover' | string
  displayMode?: string
  imageScale?: number
  imageOffsetY?: number
  url?: string
  openNewTab?: boolean
  visible?: boolean
}

type Props = {
  items: ExpertItem[]
  autoplaySeconds?: number
  itemsPerView?: number
  cardBarBgColor?: string
  cardBarTextColor?: string
  defaultDisplayMode?: string
  defaultImageScale?: number
  defaultImageOffsetY?: number
  cardHeight?: number
}

export function OurExpertsCarousel({
  items = [],
  autoplaySeconds = 5,
  itemsPerView = 4,
  cardBarBgColor,
  cardBarTextColor,
  defaultDisplayMode = 'zoom-out-2-3',
  defaultImageScale = 86,
  defaultImageOffsetY = 12,
  cardHeight,
}: Props) {
  const safeItems = useMemo(
    () => items.filter((item) => item?.visible !== false && item?.name),
    [items]
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [viewportPerView, setViewportPerView] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  const total = safeItems.length
  const targetPerView = itemsPerView && itemsPerView >= 1 ? itemsPerView : 4

  // Lắng nghe kích thước màn hình để xác định số lượng thẻ phù hợp:
  // Mobile (<=600px): 1 thẻ
  // Tablet nhỏ (<=800px): tối đa 2 thẻ
  // Tablet lớn (<=1024px): tối đa 3 thẻ
  // Desktop (>1024px): theo cấu hình itemsPerView
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width <= 600) {
        setViewportPerView(1)
      } else if (width <= 800) {
        setViewportPerView(Math.min(2, targetPerView))
      } else if (width <= 1024) {
        setViewportPerView(Math.min(3, targetPerView))
      } else {
        setViewportPerView(targetPerView)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [targetPerView])

  const activePerView = viewportPerView !== null ? viewportPerView : targetPerView
  const maxPerView = total >= activePerView ? activePerView : (total >= 1 ? total : 1)

  useEffect(() => {
    if (total <= 1 || !autoplaySeconds || autoplaySeconds <= 0 || isPaused) return
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total)
    }, autoplaySeconds * 1000)
    return () => window.clearInterval(timer)
  }, [total, autoplaySeconds, isPaused])

  if (!total) {
    return (
      <div className="professionalEmpty">
        Chưa có chuyên gia nào được kích hoạt. Hãy thêm chuyên gia trong phần Cấu hình Trang chủ.
      </div>
    )
  }

  const next = () => setCurrentIndex((prev) => (prev + 1) % total)
  const prev = () => setCurrentIndex((prev) => (prev - 1 + total) % total)

  // Xử lý vuốt màn hình cảm ứng
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    if (deltaX > 45) {
      prev()
    } else if (deltaX < -45) {
      next()
    }
    touchStartX.current = null
  }

  const visibleItems = Array.from({ length: maxPerView }).map((_, offset) => {
    const idx = (currentIndex + offset) % total
    return { ...safeItems[idx], originalIndex: idx }
  })

  // Dynamic overrides only if customized differently from default
  const footerCustomStyle = (cardBarBgColor && cardBarBgColor !== '#f0f7fd') || (cardBarTextColor && cardBarTextColor !== '#0754a8')
    ? {
      backgroundColor: cardBarBgColor || undefined,
      color: cardBarTextColor || undefined,
    }
    : undefined

  const titleCustomStyle = cardBarTextColor && cardBarTextColor !== '#0754a8'
    ? { color: cardBarTextColor }
    : undefined

  const resolveDisplayConfig = (item: ExpertItem) => {
    const activeMode =
      item.displayMode && item.displayMode !== 'inherit'
        ? item.displayMode
        : defaultDisplayMode || 'cover-top'

    let presetScale = 100
    let presetOffsetY = 8
    let forceContain = false

    switch (activeMode) {
      case 'zoom-out-2-3':
      case 'cover-top':
        presetScale = 100
        presetOffsetY = 8
        break
      case 'zoom-out-wide':
        presetScale = 82
        presetOffsetY = 6
        forceContain = true
        break
      case 'zoom-out-medium':
        presetScale = 90
        presetOffsetY = 8
        forceContain = true
        break
      case 'cover-body':
        presetScale = 100
        presetOffsetY = 25
        break
      case 'cover-center':
        presetScale = 100
        presetOffsetY = 50
        break
      case 'zoom-in-close':
        presetScale = 112
        presetOffsetY = 8
        break
      case 'fill':
        presetScale = 100
        presetOffsetY = 12
        break
      default:
        break
    }

    const hasCustomItemScale = item.imageScale !== null && item.imageScale !== undefined
    const hasCustomSectionScale =
      defaultImageScale !== null &&
      defaultImageScale !== undefined &&
      defaultImageScale !== 86 &&
      defaultImageScale !== 88 &&
      defaultImageScale !== 75
    const rawScale = hasCustomItemScale
      ? Number(item.imageScale)
      : hasCustomSectionScale
        ? Number(defaultImageScale)
        : presetScale

    const clampedScale = Number.isFinite(rawScale) && rawScale > 0
      ? Math.min(200, Math.max(40, rawScale))
      : presetScale

    const hasCustomItemOffsetY = item.imageOffsetY !== null && item.imageOffsetY !== undefined
    const hasCustomSectionOffsetY =
      defaultImageOffsetY !== null &&
      defaultImageOffsetY !== undefined &&
      defaultImageOffsetY !== 12 &&
      defaultImageOffsetY !== 15 &&
      defaultImageOffsetY !== 5
    const rawOffsetY = hasCustomItemOffsetY
      ? Number(item.imageOffsetY)
      : hasCustomSectionOffsetY
        ? Number(defaultImageOffsetY)
        : presetOffsetY

    const clampedOffsetY = Number.isFinite(rawOffsetY)
      ? Math.min(100, Math.max(0, rawOffsetY))
      : presetOffsetY

    if (clampedScale < 100 || forceContain) {
      return {
        showBackdrop: true,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'contain' as const,
          objectPosition: `center ${clampedOffsetY}%`,
          transform: clampedScale < 100 ? `scale(${(clampedScale / 100).toFixed(3)})` : undefined,
          transformOrigin: `center ${clampedOffsetY}%`,
          position: 'relative' as const,
          zIndex: 1,
        },
      }
    }

    return {
      showBackdrop: false,
      style: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        objectPosition: `center ${clampedOffsetY}%`,
        transform: clampedScale > 100 ? `scale(${(clampedScale / 100).toFixed(3)})` : undefined,
        transformOrigin: `center ${clampedOffsetY}%`,
        position: 'relative' as const,
        zIndex: 1,
      },
    }
  }

  const imageFrameCustomStyle: React.CSSProperties | undefined =
    cardHeight && Number(cardHeight) >= 200
      ? { height: `${Math.min(520, Math.max(200, Number(cardHeight)))}px`, maxHeight: 'none', aspectRatio: 'auto' }
      : undefined

  return (
    <div
      className={styles.expertCarouselWrapper}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Chuyên gia của chúng tôi carousel"
    >
      <div className={styles.expertCarouselTrack} data-count={maxPerView}>
        {visibleItems.map((item, idx) => {
          const content = (
            <div className={styles.expertCard}>
              <div className={styles.expertCardImage} style={imageFrameCustomStyle}>
                {item.image ? (
                  (() => {
                    const cfg = resolveDisplayConfig(item)
                    return (
                      <>
                        {cfg.showBackdrop && (
                          <img
                            src={item.image}
                            alt=""
                            aria-hidden="true"
                            className={styles.smartBackdropImg}
                            loading="lazy"
                          />
                        )}
                        <img
                          src={item.image}
                          alt={item.name}
                          style={cfg.style}
                          className={`${styles.expertCardImg} ${item.imageFit === 'cover' || item.imageFit === 'cover-top'
                              ? styles.fitCoverTop
                              : item.imageFit === 'cover-center'
                                ? styles.fitCoverCenter
                                : item.imageFit === 'cover-bottom'
                                  ? styles.fitCoverBottom
                                  : item.imageFit === 'fill'
                                    ? styles.fitFill
                                    : styles.fitContain
                            }`}
                          loading="lazy"
                        />
                      </>
                    )
                  })()
                ) : (
                  <div className={styles.expertCardPlaceholder}>
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#0878d1" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                {(item.badge || item.position?.toLowerCase().includes('giám đốc') || item.position?.toLowerCase().includes('giam doc')) && (
                  <div className={styles.expertCardBadge}>
                    {item.position?.toLowerCase().includes('phó') || item.position?.toLowerCase().includes('pho') ? 'PHÓ GIÁM ĐỐC' : (item.position?.toLowerCase().includes('giám đốc') ? 'GIÁM ĐỐC' : (item.badge || 'BAN LÃNH ĐẠO'))}
                  </div>
                )}
              </div>
              <div className={styles.expertCardFooter} style={footerCustomStyle}>
                <h3 className={styles.expertCardName} style={titleCustomStyle}>
                  {item.name}
                </h3>
                {item.position && (
                  <p className={styles.expertCardPosition}>
                    {item.position}
                  </p>
                )}
                {item.subPosition && (
                  <p className={styles.expertCardSubPosition}>
                    {item.subPosition}
                  </p>
                )}
              </div>
            </div>
          )

          const key = `${item.id ?? 'expert'}-slot-${idx}`
          if (item.url) {
            return (
              <a
                key={key}
                href={item.url}
                className={styles.expertCardLink}
                target={item.openNewTab ? '_blank' : undefined}
                rel={item.openNewTab ? 'noopener noreferrer' : undefined}
              >
                {content}
              </a>
            )
          }

          return (
            <div key={key} className={`${styles.expertCardLink} ${styles.noCursor}`}>
              {content}
            </div>
          )
        })}
      </div>

      {total > 1 && (
        <div className={styles.expertCarouselControls}>
          <button
            type="button"
            className={styles.expertNavBtn}
            onClick={prev}
            aria-label="Chuyên gia trước"
            title="Chuyên gia trước"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.expertNavBtn}
            onClick={next}
            aria-label="Chuyên gia kế tiếp"
            title="Chuyên gia kế tiếp"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
