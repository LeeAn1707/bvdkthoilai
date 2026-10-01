'use client'

import React from 'react'
import { useAllFormFields, useForm } from '@payloadcms/ui'

type DayItem = {
  dayLabel: string
  dateFormatted: string
  morningContent: string
  afternoonContent: string
  note: string
}

const generateHexId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')
  const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${timestamp}${randomHex}`
}

function getDateOfISOWeek(week: number, year: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const ISOweekStart = new Date(simple)
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - (simple.getDay() || 7) + 1)
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - (simple.getDay() || 7))
  }
  return ISOweekStart
}

function getCurrentWeekAndYear(): { week: number; year: number } {
  const now = new Date()
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week: weekNo, year: target.getUTCFullYear() }
}

export default function WorkScheduleDaysHelper() {
  const [fields, dispatchFields] = useAllFormFields()
  const { getFields, setModified } = useForm()

  const handleGenerateDays = (count: 5 | 6) => {
    if (!dispatchFields) return

    const currentFields: Record<string, any> = typeof getFields === 'function' ? getFields() : fields || {}
    const defaultInfo = getCurrentWeekAndYear()
    const weekNumber = Number(currentFields['weekNumber']?.value) || defaultInfo.week
    const year = Number(currentFields['year']?.value) || defaultInfo.year

    const monday = getDateOfISOWeek(weekNumber, year)
    const dayNames = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

    const newDays: DayItem[] = []
    for (let i = 0; i < count; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yy = String(d.getFullYear()).slice(-2)

      newDays.push({
        dayLabel: dayNames[i],
        dateFormatted: `(${dd}/${mm}/${yy})`,
        morningContent: '',
        afternoonContent: '',
        note: '',
      })
    }

    const nextState: Record<string, any> = {}
    for (const [key, val] of Object.entries(currentFields)) {
      if (!key.startsWith('days.') && key !== 'days' && key !== 'id') {
        nextState[key] = val
      }
    }
    delete nextState['id']

    const rowMetadata = newDays.map((d, index) => {
      const rowId = generateHexId()
      const rowPath = `days.${index}`

      nextState[`${rowPath}.id`] = {
        value: rowId,
        initialValue: rowId,
        valid: true,
        passesCondition: true,
      }
      nextState[`${rowPath}.dayLabel`] = {
        value: d.dayLabel,
        initialValue: d.dayLabel,
        valid: true,
        passesCondition: true,
      }
      nextState[`${rowPath}.dateFormatted`] = {
        value: d.dateFormatted,
        initialValue: d.dateFormatted,
        valid: true,
        passesCondition: true,
      }
      nextState[`${rowPath}.morningContent`] = {
        value: '',
        initialValue: '',
        valid: true,
        passesCondition: true,
      }
      nextState[`${rowPath}.afternoonContent`] = {
        value: '',
        initialValue: '',
        valid: true,
        passesCondition: true,
      }
      nextState[`${rowPath}.note`] = {
        value: '',
        initialValue: '',
        valid: true,
        passesCondition: true,
      }

      return {
        id: rowId,
        isLoading: false,
      }
    })

    nextState['days'] = {
      ...(currentFields['days'] || {}),
      disableFormData: true,
      rows: rowMetadata,
      value: newDays.length,
      initialValue: newDays.length,
      valid: true,
      passesCondition: true,
    }

    dispatchFields({
      type: 'REPLACE_STATE',
      state: nextState,
      optimize: false,
      sanitize: true,
    })

    if (typeof setModified === 'function') {
      setModified(true)
    }
  }

  const currentFields: Record<string, any> = typeof getFields === 'function' ? getFields() : fields || {}
  const daysCount = Number(currentFields['days']?.value) || 0
  const defaultInfo = getCurrentWeekAndYear()
  const weekNumber = Number(currentFields['weekNumber']?.value) || defaultInfo.week
  const year = Number(currentFields['year']?.value) || defaultInfo.year

  return (
    <div style={{
      background: '#f8fafc',
      border: '1.5px dashed #38bdf8',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⚡ TỰ ĐỘNG ĐIỀN CÁC NGÀY TRONG TUẦN (TUẦN {weekNumber} / {year})</span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
          Tự động tính ngày Thứ 2 đến Thứ 6 (hoặc Thứ 7) theo Tuần {weekNumber} năm {year}, tạo sẵn các ô trống để bạn chỉ việc gõ nội dung công việc.
          {daysCount > 0 && (
            <span style={{ color: '#0284c7', fontWeight: 600, marginLeft: '6px' }}>
              (Hiện đang có {daysCount} ngày trong bảng)
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleGenerateDays(5)}
          style={{
            padding: '7px 14px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#ffffff',
            background: '#0284c7',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Tự động sinh 5 ngày từ Thứ 2 đến Thứ 6 điền sẵn ngày tháng, để trống sáng/chiều"
        >
          <span>⚡ Điền sẵn Thứ 2 → Thứ 6 (5 ngày)</span>
        </button>

        <button
          type="button"
          onClick={() => handleGenerateDays(6)}
          style={{
            padding: '7px 14px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#0369a1',
            background: '#e0f2fe',
            border: '1px solid #7dd3fc',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Tự động sinh 6 ngày từ Thứ 2 đến Thứ 7 điền sẵn ngày tháng, để trống sáng/chiều"
        >
          <span>⚡ Điền sẵn Thứ 2 → Thứ 7 (6 ngày)</span>
        </button>
      </div>
    </div>
  )
}
