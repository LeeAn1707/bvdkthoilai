'use client'

import React, { useState, useEffect } from 'react'
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
}: {
  items: SoyTeNewsItem[]
  featuredItems?: SoyTeNewsItem[]
  sidebarTitle?: string
  cardFit?: 'cover' | 'contain' | 'fill'
}) {
  const [zoomImg, setZoomImg] = useState<string | null>(null)

  // ESC key to close lightbox
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

  const leadItem = items[0]
  const subItems = items.slice(1, 5)

  // Cột "TIN NỔI BẬT" bên phải:
  // Ưu tiên lấy từ danh sách featuredItems riêng (nếu có),
  // nếu không thì lấy các bài từ vị trí thứ 5 trở đi của items.
  let sidebarList: SoyTeNewsItem[] = []
  if (featuredItems && featuredItems.length > 0) {
    // Lọc bỏ trùng lặp với bài chính
    sidebarList = featuredItems.filter((it) => it.id !== leadItem.id).slice(0, 7)
  }
  if (sidebarList.length === 0) {
    sidebarList = items.slice(5, 12)
  }
  // Trường hợp ít bài, nếu sidebar vẫn trống và subItems có nhiều bài, lấy ít nhất vài bài
  if (sidebarList.length === 0 && items.length > 2) {
    sidebarList = items.slice(2, 6)
  }

  const rawFit = leadItem.imageFit || cardFit
  const normalizedFit = rawFit === 'contain' ? 'contain' : (rawFit === 'fill' ? 'fill' : 'cover')

  return (
    <div className={styles.soyteContainer} aria-label="Điểm tin hoạt động y tế">
      <div className={styles.soyteGrid}>
        {/* ================= CỘT TRÁI: TIN CHÍNH ================= */}
        <div className={styles.leadCol}>
          {/* 1. Tiêu đề bài viết chính (nằm trên ảnh đúng chuẩn Sở Y tế) */}
          <h3 className={styles.leadTitle}>
            <a href={leadItem.href} className={styles.leadTitleLink}>
              {leadItem.title}
            </a>
          </h3>

          {/* 2. Ảnh lớn chất lượng cao, không bị dẹt méo */}
          {leadItem.image && (
            <div
              className={styles.imageContainer}
              style={{
                background: normalizedFit === 'contain' ? '#eaf4fc' : undefined,
              }}
            >
              <a href={leadItem.href} className={styles.imageLink} tabIndex={-1} aria-hidden="true">
                <img
                  src={leadItem.image}
                  alt={leadItem.title}
                  className={styles.leadImage}
                  loading="eager"
                  decoding="sync"
                  style={{
                    objectFit: normalizedFit,
                    objectPosition: leadItem.imagePosition || 'center center',
                  }}
                />
              </a>

              {/* Nhãn thể loại bài viết */}
              {leadItem.kind && (
                <span className={styles.leadBadge}>
                  {leadItem.kind}
                </span>
              )}

              {/* Nút phóng to ảnh nét full HD/2K */}
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setZoomImg(leadItem.image || null)
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

          {/* 3. Danh sách tin phụ bên dưới ảnh với bullet vuông */}
          {subItems.length > 0 && (
            <ul className={styles.leadSubList}>
              {subItems.map((item) => (
                <li key={item.id} className={styles.leadSubItem}>
                  <span className={styles.subBullet} aria-hidden="true" />
                  <a href={item.href} className={styles.subLink}>
                    {item.title}
                  </a>
                </li>
              ))}
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
