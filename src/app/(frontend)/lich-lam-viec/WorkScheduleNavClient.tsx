'use client'

import React, { useState, useEffect, useRef } from 'react'
import { exportWorkScheduleToWord, exportWorkScheduleToPdf, type WorkScheduleExportDoc } from '@/lib/workScheduleExport'

type Props = {
  currentWeek: number
  currentYear: number
  prevWeek: number
  prevYear: number
  nextWeek: number
  nextYear: number
  allWeeks: Array<{ weekNumber: number; year: number; title: string }>
  attachedFileUrl?: string | null
  scheduleDoc?: WorkScheduleExportDoc | null
}

export function WorkScheduleNavClient({
  currentWeek,
  currentYear,
  prevWeek,
  prevYear,
  nextWeek,
  nextYear,
  allWeeks,
  attachedFileUrl,
  scheduleDoc,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelectWeek = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    const [w, y] = val.split('_')
    window.location.href = `/lich-lam-viec?week=${w}&year=${y}`
  }

  const handleExportWord = () => {
    if (!scheduleDoc) return
    exportWorkScheduleToWord(scheduleDoc)
    setMenuOpen(false)
  }

  const handleExportPdf = () => {
    if (!scheduleDoc) return
    exportWorkScheduleToPdf(scheduleDoc)
    setMenuOpen(false)
  }

  return (
    <section className="scheduleNavToolbar" aria-label="Thanh điều hướng tuần">
      <div className="scheduleNavGroup">
        <a
          href={`/lich-lam-viec?week=${prevWeek}&year=${prevYear}`}
          className="scheduleNavBtn"
          title="Xem tuần trước"
        >
          ← Tuần {prevWeek}
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>Tuần:</span>
          <select
            className="scheduleNavSelect"
            value={`${currentWeek}_${currentYear}`}
            onChange={handleSelectWeek}
          >
            {allWeeks.length > 0 ? (
              allWeeks.map((w, idx) => (
                <option key={idx} value={`${w.weekNumber}_${w.year}`}>
                  Tuần {w.weekNumber} năm {w.year}
                </option>
              ))
            ) : (
              <option value={`${currentWeek}_${currentYear}`}>
                Tuần {currentWeek} năm {currentYear}
              </option>
            )}
          </select>
        </div>

        <a
          href={`/lich-lam-viec?week=${nextWeek}&year=${nextYear}`}
          className="scheduleNavBtn"
          title="Xem tuần sau"
        >
          Tuần {nextWeek} →
        </a>
      </div>

      <div className="scheduleActionBtns">
        {/* Nút dropdown tải lịch về với 2 tùy chọn Word và PDF */}
        {scheduleDoc && (
          <div className="scheduleDropdown" ref={menuRef}>
            <button
              type="button"
              className="actionBtn actionBtnDownload"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="Tải lịch công tác tuần về máy"
            >
              <span>📥 Tải lịch làm việc</span>
              <span style={{ fontSize: '11px', marginLeft: '2px' }}>▼</span>
            </button>

            {menuOpen && (
              <div className="scheduleDropdownMenu">
                <button
                  type="button"
                  className="scheduleDropdownItem"
                  onClick={handleExportWord}
                >
                  <span style={{ color: '#2563eb', fontSize: '16px' }}>📝</span>
                  <span>Tải định dạng <b>Word (.doc)</b></span>
                </button>
                <button
                  type="button"
                  className="scheduleDropdownItem"
                  onClick={handleExportPdf}
                >
                  <span style={{ color: '#dc2626', fontSize: '16px' }}>📄</span>
                  <span>Tải định dạng <b>PDF (.pdf)</b></span>
                </button>

                {attachedFileUrl && (
                  <>
                    <div className="scheduleDropdownDivider" />
                    <a
                      href={attachedFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="scheduleDropdownItem"
                      download
                      onClick={() => setMenuOpen(false)}
                    >
                      <span style={{ color: '#0284c7', fontSize: '16px' }}>📎</span>
                      <span>Tải file gốc đính kèm</span>
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nếu không có scheduleDoc nhưng có tệp đính kèm gốc */}
        {!scheduleDoc && attachedFileUrl && (
          <a
            href={attachedFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="actionBtn actionBtnDownload"
            download
          >
            📥 Tải văn bản gốc
          </a>
        )}
      </div>
    </section>
  )
}
