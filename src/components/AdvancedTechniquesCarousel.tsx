'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import styles from './AdvancedTechniquesCarousel.module.css'

export type TechniqueItem = {
  id?: string
  title: string
  badge?: string
  summary?: string
  departmentName?: string
  image?: string
  imageFit?: 'contain' | 'cover' | string
  url?: string
  openNewTab?: boolean
  visible?: boolean
}

type Props = {
  items: TechniqueItem[]
  autoplaySeconds?: number
  itemsPerView?: number
  cardBarBgColor?: string
  cardBarTextColor?: string
}

export function AdvancedTechniquesCarousel({
  items = [],
  autoplaySeconds = 5,
  itemsPerView = 4,
  cardBarBgColor,
  cardBarTextColor,
}: Props) {
  const safeItems = useMemo(
    () => items.filter((item) => item?.visible !== false && item?.title),
    [items]
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const total = safeItems.length
  const targetPerView = itemsPerView && itemsPerView >= 4 ? itemsPerView : 4
  const maxPerView = total >= targetPerView ? targetPerView : (total >= 1 ? targetPerView : 1)

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
        Chưa có kỹ thuật chuyên sâu nào được kích hoạt. Hãy thêm kỹ thuật trong phần Cấu hình Trang chủ hoặc mục Kỹ thuật chuyên sâu.
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

  const renderImageFitClass = (fit?: string) => {
    if (fit === 'contain') return styles.fitContain
    if (fit === 'cover' || fit === 'cover-top') return styles.fitCoverTop
    if (fit === 'cover-center') return styles.fitCoverCenter
    if (fit === 'cover-bottom') return styles.fitCoverBottom
    if (fit === 'fill') return styles.fitFill
    return styles.fitCoverTop
  }

  return (
    <div
      className={styles.techCarouselWrapper}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Kỹ thuật chuyên sâu carousel"
    >
      <div className={styles.techCarouselTrack} data-count={maxPerView}>
        {visibleItems.map((item, idx) => {
          const content = (
            <div className={styles.techCard}>
              <div className={styles.techCardMediaWrap}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className={`${styles.techCardImg} ${renderImageFitClass(item.imageFit)}`}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.techCardPlaceholder}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#0878d1" strokeWidth="1.5">
                      <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" strokeLinecap="round" />
                    </svg>
                  </div>
                )}

                <div className={styles.techCardOverlay} />

                {item.badge && (
                  <span className={styles.techCardBadge}>
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>{item.badge}</span>
                  </span>
                )}
              </div>

              <div className={styles.techCardBody} style={footerCustomStyle}>
                {item.departmentName && (
                  <span className={styles.techCardKicker}>{item.departmentName}</span>
                )}

                <h3 className={styles.techCardTitle} style={titleCustomStyle}>
                  {item.title}
                </h3>

                <p className={styles.techCardSummary}>
                  {item.summary || 'Ứng dụng trang thiết bị y tế hiện đại, nâng cao độ chính xác và chất lượng chăm sóc điều trị.'}
                </p>

                <div className={styles.techCardAction}>
                  <span className={styles.techActionText}>Xem chi tiết kỹ thuật</span>
                  <span className={styles.techActionIcon}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          )

          const key = `${item.id ?? 'tech'}-slot-${idx}`
          if (item.url) {
            return (
              <a
                key={key}
                href={item.url}
                className={styles.techCardLink}
                target={item.openNewTab ? '_blank' : undefined}
                rel={item.openNewTab ? 'noopener noreferrer' : undefined}
              >
                {content}
              </a>
            )
          }

          return (
            <div key={key} className={`${styles.techCardLink} ${styles.noCursor}`}>
              {content}
            </div>
          )
        })}
      </div>

      {total > 1 && (
        <div className={styles.techCarouselControls}>
          <button
            type="button"
            className={styles.techNavBtn}
            onClick={prev}
            aria-label="Kỹ thuật trước"
            title="Kỹ thuật trước"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className={styles.techCarouselDots} aria-hidden="true">
            {Array.from({ length: total }).map((_, dotIdx) => (
              <button
                key={`dot-${dotIdx}`}
                type="button"
                className={`${styles.techDot} ${dotIdx === currentIndex ? styles.techDotActive : ''}`}
                onClick={() => setCurrentIndex(dotIdx)}
                aria-label={`Chuyển tới kỹ thuật số ${dotIdx + 1}`}
                title={`Kỹ thuật ${dotIdx + 1}/${total}`}
              />
            ))}
          </div>

          <button
            type="button"
            className={styles.techNavBtn}
            onClick={next}
            aria-label="Kỹ thuật kế tiếp"
            title="Kỹ thuật kế tiếp"
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
