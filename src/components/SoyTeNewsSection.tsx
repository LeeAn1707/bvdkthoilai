'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import styles from './SoyTeNewsSection.module.css'

export type SoyTeNewsItem = {
  id: string
  title: string
  excerpt?: string
  image?: string
  imageFit?: 'cover' | 'contain' | 'fill'
  imagePosition?: string
  href: string
  kind?: string
  date?: string
  dateValue?: string
}

export function SoyTeNewsSection({
  items,
  featuredItems = [],
  sidebarTitle = 'TIN NỔI BẬT',
  cardFit = 'cover',
  autoplaySeconds = 5,
}: {
  items: SoyTeNewsItem[]
  featuredItems?: SoyTeNewsItem[]
  sidebarTitle?: string
  cardFit?: 'cover' | 'contain' | 'fill'
  autoplaySeconds?: number
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [zoomImg, setZoomImg] = useState<string | null>(null)

  // Nhóm các bài viết tham gia chuyển đổi ở khung chính (tối đa 5 bài)
  const sliderItems = items.slice(0, Math.min(items.length, 5))
  const totalSlides = sliderItems.length

  const handleNext = useCallback(() => {
    if (totalSlides <= 1) return
    setCurrentIndex((prev) => (prev + 1) % totalSlides)
    setProgress(0)
  }, [totalSlides])

  const handlePrev = useCallback(() => {
    if (totalSlides <= 1) return
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides)
    setProgress(0)
  }, [totalSlides])

  // Tự động chuyển bài viết qua lại theo chu kỳ thời gian
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return

    const intervalMs = Math.max(2500, autoplaySeconds * 1000)
    const tickStep = 50 // Cập nhật progress mỗi 50ms

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (tickStep / intervalMs) * 100
        if (next >= 100) {
          handleNext()
          return 0
        }
        return next
      })
    }, tickStep)

    return () => clearInterval(progressTimer)
  }, [totalSlides, isPaused, autoplaySeconds, handleNext])

  // Phím ESC đóng Lightbox
  useEffect(() => {
    if (!zoomImg) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomImg(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomImg])

  if (!items || items.length === 0) {
    return null
  }

  const currentLead = sliderItems[currentIndex] || items[0]

  // Cột "TIN NỔI BẬT" bên phải:
  // 1. Ưu tiên các bài từ featuredItems (đã sắp xếp tin nổi bật lên trước)
  const explicitFeatured = (featuredItems || []).filter((it) => it.id !== currentLead.id)

  // 2. Bổ sung thêm từ danh sách items để luôn có đủ 6-7 bài, không bị khoảng trống trắng
  const seenIds = new Set([currentLead.id, ...explicitFeatured.map((x) => x.id)])
  const fallbackPool = items.filter((it) => !seenIds.has(it.id))

  const sidebarList = [...explicitFeatured, ...fallbackPool].slice(0, 7)

  const rawFit = currentLead.imageFit || cardFit
  const normalizedFit = rawFit === 'contain' ? 'contain' : (rawFit === 'fill' ? 'fill' : 'cover')

  return (
    <div
      className={styles.soyteContainer}
      aria-label="Điểm tin hoạt động y tế"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={styles.soyteGrid}>
        {/* ================= CỘT TRÁI: TIN CHÍNH CÓ HIỆU ỨNG CHUYỂN BÀI ================= */}
        <div className={styles.leadCol}>
          {/* 1. Tiêu đề bài viết chính (tự động đổi mượt mà theo bài đang phát) */}
          <div className={styles.leadTitleWrap}>
            <h3 className={styles.leadTitle} key={`title-${currentLead.id}`}>
              <a href={currentLead.href} className={styles.leadTitleLink}>
                {currentLead.title}
              </a>
            </h3>
          </div>

          {/* 2. Ảnh lớn chất lượng cao với hiệu ứng chuyển slide fade/zoom */}
          <div
            className={styles.imageContainer}
            style={{
              background: normalizedFit === 'contain' ? '#eaf4fc' : undefined,
            }}
          >
            {currentLead.image && (
              <a href={currentLead.href} className={styles.imageLink} tabIndex={-1} aria-hidden="true">
                <img
                  key={`img-${currentLead.id}`}
                  src={currentLead.image}
                  alt={currentLead.title}
                  className={styles.leadImage}
                  loading="eager"
                  decoding="sync"
                  style={{
                    objectFit: normalizedFit,
                    objectPosition: currentLead.imagePosition || 'center center',
                  }}
                />
              </a>
            )}

            {/* Nhãn thể loại bài viết */}
            {currentLead.kind && (
              <span className={styles.leadBadge} key={`badge-${currentLead.id}`}>
                {currentLead.kind}
              </span>
            )}

            {/* Nút phóng to ảnh nét full HD/2K */}
            {currentLead.image && (
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setZoomImg(currentLead.image || null)
                }}
                title="Xem ảnh gốc sắc nét toàn màn hình"
                aria-label="Xem ảnh phóng to"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                <span>Phóng to</span>
              </button>
            )}

            {/* Bộ điều khiển chuyển bài qua lại (‹  1/5  ›) */}
            {totalSlides > 1 && (
              <div className={styles.sliderControls}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handlePrev()
                  }}
                  title="Bài trước"
                  aria-label="Chuyển bài trước"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <span className={styles.slideCounter}>
                  {currentIndex + 1}/{totalSlides}
                  {isPaused && <span className={styles.pauseBadge}>❚❚</span>}
                </span>

                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleNext()
                  }}
                  title="Bài kế tiếp"
                  aria-label="Chuyển bài tiếp theo"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}

            {/* Thanh tiến trình tự động chuyển slide */}
            {totalSlides > 1 && (
              <div className={styles.progressBarTrack} aria-hidden="true">
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* 3. Danh sách tin phụ bên dưới ảnh: nhấp hoặc hover bài nào để chuyển bài đó lên ảnh lớn */}
          {sliderItems.length > 0 && (
            <ul className={styles.leadSubList}>
              {sliderItems.map((item, idx) => {
                const isActive = idx === currentIndex
                return (
                  <li
                    key={item.id}
                    className={`${styles.leadSubItem} ${isActive ? styles.leadSubItemActive : ''}`}
                    onClick={() => {
                      setCurrentIndex(idx)
                      setProgress(0)
                    }}
                    title="Bấm để xem ảnh và nội dung bài này"
                  >
                    <span
                      className={`${styles.subBullet} ${isActive ? styles.subBulletActive : ''}`}
                      aria-hidden="true"
                    />
                    <a
                      href={item.href}
                      className={`${styles.subLink} ${isActive ? styles.subLinkActive : ''}`}
                      onClick={(e) => {
                        // Cho phép nhấp mở link bình thường nếu bấm trực tiếp vào chữ
                        e.stopPropagation()
                      }}
                    >
                      {item.title}
                    </a>
                    {isActive && (
                      <span className={styles.nowPlayingTag} aria-label="Đang hiển thị">
                        <span>●</span> Đang xem
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ================= CỘT PHẢI: TIN NỔI BẬT ================= */}
        <div className={styles.sidebarCol}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>{sidebarTitle}</h3>
          </div>

          <ul className={styles.sidebarList}>
            {sidebarList.map((item) => (
              <li key={item.id} className={styles.sidebarItem}>
                <span className={styles.featuredBullet} aria-hidden="true" />
                <a href={item.href} className={styles.featuredLink}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ================= POPUP LIGHTBOX XEM ẢNH NÉT GỐC ================= */}
      {zoomImg && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setZoomImg(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Cửa sổ xem ảnh phóng to"
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setZoomImg(null)}
              aria-label="Đóng cửa sổ xem ảnh"
            >
              ✕
            </button>
            <img
              src={zoomImg}
              alt="Ảnh phóng to chi tiết"
              className={styles.lightboxImg}
            />
          </div>
        </div>
      )}
    </div>
  )
}
