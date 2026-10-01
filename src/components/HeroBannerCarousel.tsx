'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

type HeroSlide = {
  id: string
  desktopUrl: string
  mobileUrl?: string
  title?: string
}

export function HeroBannerCarousel({ slides, intervalSeconds = 6, bannerWidth = 1300 }: { slides: HeroSlide[]; intervalSeconds?: number; bannerWidth?: number }) {
  const [active, setActive] = useState(0)
  const duration = Math.max(2, Math.min(intervalSeconds || 6, 30)) * 1000

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), duration)
    return () => window.clearInterval(timer)
  }, [duration, slides.length])

  useEffect(() => {
    if (active >= slides.length) setActive(0)
  }, [active, slides.length])

  if (slides.length === 0) return null

  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length)

  const safeWidth = Math.max(600, Math.min(bannerWidth || 1300, 3000))
  const bannerStyle = {
    '--hero-banner-width': `${safeWidth}px`,
    '--hero-banner-height': `${Math.round(safeWidth * 600 / 1920)}px`,
  } as CSSProperties

  return <section className="hospitalHero heroBannerCarousel" aria-label="Banner Bệnh viện Đa khoa khu vực Thới Lai" style={bannerStyle}>
    {slides.map((slide, index) => <picture className={`heroBannerSlide ${index === active ? 'active' : ''}`} key={slide.id} aria-hidden={index !== active}>
      {slide.mobileUrl && <source media="(max-width: 820px)" srcSet={slide.mobileUrl} />}
      <img src={slide.desktopUrl} alt={slide.title || 'Bệnh viện Đa khoa khu vực Thới Lai'} />
    </picture>)}

    {slides.length > 1 && <>
      <button className="heroBannerArrow previous" type="button" onClick={() => move(-1)} aria-label="Banner trước">‹</button>
      <button className="heroBannerArrow next" type="button" onClick={() => move(1)} aria-label="Banner tiếp theo">›</button>
      <div className="heroBannerDots" aria-label="Chọn banner">
        {slides.map((slide, index) => <button className={index === active ? 'active' : ''} type="button" onClick={() => setActive(index)} aria-label={`Xem banner ${index + 1}`} key={slide.id} />)}
      </div>
    </>}
  </section>
}
