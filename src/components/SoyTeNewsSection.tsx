'use client'

import React, { useState, useEffect, useCallback } from 'react'
import styles from './SoyTeNewsSection.module.css'

export type SoyTeNewsItem = {
  id: string
  title: string
  excerpt?: string
  image?: string
  imageFit?: 'cover' | 'contain' | 'fill' | string
  imagePosition?: string
  href: string
  kind?: string
  date?: string
  dateValue?: string
}

const ITEM_HEIGHT = 78 // Chiều cao chuẩn mỗi bài ở cột phải (px)
const VISIBLE_COUNT = 5 // Số lượng bài hiển thị trong khung nhìn

export function SoyTeNewsSection({
  items,
  featuredItems = [],
  sidebarTitle = 'TIN NỔI BẬT',
  cardFit = 'cover',
  autoplaySeconds = 3.5,
}: {
  items: SoyTeNewsItem[]
  featuredItems?: SoyTeNewsItem[]
  sidebarTitle?: string
  cardFit?: 'cover' | 'contain' | 'fill'
  autoplaySeconds?: number
}) {
  const [zoomImg, setZoomImg] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [step, setStep] = useState(0)
  const [withTransition, setWithTransition] = useState(true)

  if (!items || items.length === 0) {
    return null
  }

  // Danh sách các bài viết tham gia xoay vòng:
  // Ưu tiên featuredItems (tin nổi bật), bổ sung từ items để luôn đầy đủ bài
  const candidateList = featuredItems && featuredItems.length > 0 ? featuredItems : items
  const seenIds = new Set<string>()
  const rotationList: SoyTeNewsItem[] = []

  for (const it of candidateList) {
    if (it && !seenIds.has(it.id)) {
      seenIds.add(it.id)
      rotationList.push(it)
    }
  }
  for (const it of items) {
    if (it && !seenIds.has(it.id)) {
      seenIds.add(it.id)
      rotationList.push(it)
    }
  }

  const totalItems = rotationList.length
  const shouldAnimate = totalItems > 1

  // BÀI VIẾT ĐƯỢC CHỌN HIỂN THỊ Ở CỘT BÊN TRÁI:
  // Đồng bộ 100% với bài viết đang ở vị trí xoay vòng (step % totalItems)
  const activeIndex = shouldAnimate ? step % totalItems : 0
  const currentLead = rotationList[activeIndex] || items[0]

  // Chuyển tới bài tiếp theo trong vòng xoay
  const handleNext = useCallback(() => {
    if (!shouldAnimate) return
    setWithTransition(true)
    setStep((prev) => prev + 1)
  }, [shouldAnimate])

  // Lùi lại bài trước đó
  const handlePrev = useCallback(() => {
    if (!shouldAnimate) return
    if (step === 0) {
      setWithTransition(false)
      setStep(totalItems)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWithTransition(true)
          setStep(totalItems - 1)
        })
      })
    } else {
      setWithTransition(true)
      setStep((prev) => prev - 1)
    }
  }, [shouldAnimate, step, totalItems])

  // Khi người dùng bấm trực tiếp vào một bài ở cột phải: Lập tức hiển thị bài đó qua bên trái
  const handleSelectArticle = (indexInList: number) => {
    setWithTransition(true)
    setStep(indexInList)
  }

  // Reset về 0 không hiệu ứng khi vừa cuộn hết một vòng lặp vô tận
  useEffect(() => {
    if (!shouldAnimate) return
    if (step === totalItems) {
      const timer = setTimeout(() => {
        setWithTransition(false)
        setStep(0)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [step, totalItems, shouldAnimate])

  // Tự động xoay vòng danh sách tin nổi bật theo chu kỳ thời gian
  useEffect(() => {
    if (!shouldAnimate || isPaused) return

    const intervalMs = Math.max(2000, autoplaySeconds * 1000)
    const timer = setInterval(() => {
      handleNext()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [shouldAnimate, isPaused, autoplaySeconds, handleNext])

  // Phím ESC để đóng Lightbox
  useEffect(() => {
    if (!zoomImg) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomImg(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomImg])

  // Danh sách hiển thị nhân bản phần đầu để tạo vòng xoay liên tục không giật
  const displayList = shouldAnimate
    ? [...rotationList, ...rotationList.slice(0, VISIBLE_COUNT)]
    : rotationList

  const rawFit = currentLead.imageFit || cardFit
  const normalizedFit = rawFit === 'contain' ? 'contain' : (rawFit === 'fill' ? 'fill' : 'cover')

  return (
    <div className={styles.soyteContainer} aria-label="Điểm tin hoạt động y tế">
      <div className={styles.soyteGrid}>
        {/* ================= CỘT TRÁI: CHỈ HIỂN THỊ 1 BÀI VIẾT (ĐỒNG BỘ THEO VÒNG XOAY) ================= */}
        <div className={styles.leadCol}>
          {/* 1. Tiêu đề bài viết */}
          <div className={styles.leadTitleWrap}>
            <h3 className={styles.leadTitle} key={`title-${currentLead.id}`}>
              <a href={currentLead.href} className={styles.leadTitleLink}>
                {currentLead.title}
              </a>
            </h3>
          </div>

          {/* 2. Thẻ Meta: Nhãn chuyên mục & Ngày đăng bài */}
          <div className={styles.leadMeta} key={`meta-${currentLead.id}`}>
            {currentLead.kind && (
              <span className={styles.leadBadge}>
                {currentLead.kind}
              </span>
            )}
            {currentLead.date && (
              <span className={styles.leadDate}>
                📅 {currentLead.date}
              </span>
            )}
          </div>

          {/* 3. Khung ảnh lớn sắc nét của bài viết đang xoay vòng */}
          {currentLead.image && (
            <div
              className={styles.imageContainer}
              style={{
                background: normalizedFit === 'contain' ? '#eaf4fc' : undefined,
              }}
            >
              <a href={currentLead.href} className={styles.imageLink}>
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

              {/* Nút phóng to ảnh nét full HD/2K */}
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
            </div>
          )}

          {/* 4. Đoạn tóm tắt nội dung ngắn gọn của bài viết */}
          {currentLead.excerpt && (
            <p className={styles.leadExcerpt} key={`excerpt-${currentLead.id}`}>
              {currentLead.excerpt}
            </p>
          )}

          {/* 5. Nút xem chi tiết bài viết */}
          <div className={styles.leadActionWrap}>
            <a href={currentLead.href} className={styles.leadActionBtn}>
              Xem chi tiết bài viết →
            </a>
          </div>
        </div>

        {/* ================= CỘT PHẢI: TIN NỔI BẬT CHUYỂN ĐỘNG XOAY VÒNG ================= */}
        <div
          className={styles.sidebarCol}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Tiêu đề & Nút điều khiển xoay vòng */}
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleWrap}>
              <h3 className={styles.sidebarTitle}>{sidebarTitle}</h3>
              {shouldAnimate && (
                <span className={styles.liveIndicator} title={isPaused ? 'Đang tạm dừng' : 'Đang tự động xoay vòng'}>
                  <span className={styles.pulseDot} aria-hidden="true" />
                  {isPaused ? 'Tạm dừng' : 'Xoay vòng'}
                </span>
              )}
            </div>

            {/* Nút bấm điều khiển Lên / Xuống */}
            {shouldAnimate && (
              <div className={styles.tickerControls}>
                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={handlePrev}
                  title="Cuộn lên bài trước"
                  aria-label="Cuộn lên"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={handleNext}
                  title="Cuộn xuống bài kế tiếp"
                  aria-label="Cuộn xuống"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Khung chuyển động xoay vòng các bài viết */}
          <div className={styles.tickerViewport}>
            <ul
              className={styles.tickerTrack}
              style={{
                transform: `translateY(-${step * ITEM_HEIGHT}px)`,
                transition: withTransition ? 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
              }}
            >
              {displayList.map((item, idx) => {
                const isItemActive = item.id === currentLead.id
                return (
                  <li
                    key={`${item.id}-${idx}`}
                    className={`${styles.tickerItem} ${isItemActive ? styles.tickerItemActive : ''}`}
                    onClick={() => handleSelectArticle(idx % totalItems)}
                    title="Bấm để xem bài viết này ở khung ảnh bên trái"
                  >
                    <span
                      className={`${styles.featuredBullet} ${isItemActive ? styles.featuredBulletActive : ''}`}
                      aria-hidden="true"
                    />
                    <div className={styles.itemContent}>
                      <a
                        href={item.href}
                        className={`${styles.featuredLink} ${isItemActive ? styles.featuredLinkActive : ''}`}
                        title={item.title}
                        onClick={(e) => {
                          // Click chữ tiêu đề cho phép mở link bài viết
                          e.stopPropagation()
                        }}
                      >
                        {item.title}
                      </a>
                      <div className={styles.itemMeta}>
                        {item.date && (
                          <span className={styles.itemDate}>
                            {item.date}
                          </span>
                        )}
                        {isItemActive && (
                          <span className={styles.nowPlayingTag} aria-label="Đang hiển thị">
                            <span>●</span> Đang xem
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
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
