'use client'

import React, { useEffect, useState } from 'react'
import { useAllFormFields } from '@payloadcms/ui'

type AuditLog = {
  id: string
  summary: string
  action: 'create' | 'update' | 'delete' | string
  actorEmail?: string
  actorRole?: string
  ip?: string
  changedFields?: Record<string, { before: unknown; after: unknown }>
  createdAt: string
}

export default function WorkScheduleAuditView() {
  const [fields] = useAllFormFields()
  const docId = fields?.id?.value ? String(fields.id.value) : ''

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchHistory = async () => {
    if (!docId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-schedule-history?id=${encodeURIComponent(docId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error('Lỗi máy chủ khi lấy nhật ký.')
      }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Lỗi tải nhật ký:', err)
      setError('Không thể tải nhật ký chỉnh sửa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (docId) {
      fetchHistory()
    }
  }, [docId])

  if (!docId) {
    return (
      <div style={{
        padding: '24px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px dashed #cbd5e1',
        color: '#64748b',
        fontSize: '13.5px',
        textAlign: 'center'
      }}>
        💡 <b>Bản ghi đang được tạo mới</b>. Sau khi bấm <b>Lưu thay đổi (Save)</b>, hệ thống sẽ tự động bắt đầu ghi lại toàn bộ lịch sử chỉnh sửa tại đây.
      </div>
    )
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      padding: '18px 20px',
      marginTop: '10px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📜 NHẬT KÝ THEO DÕI CHỈNH SỬA (CHỈ LƯU NỘI BỘ ADMIN)</span>
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
            Toàn bộ các lần thay đổi nội dung lịch công tác tuần, người thực hiện và trường dữ liệu trước/sau đều được lưu trữ bảo mật tại đây.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#1e40af',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {loading ? '⏳ Đang tải...' : '🔄 Làm mới nhật ký'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Chưa có nhật ký chỉnh sửa nào được ghi nhận cho bản ghi lịch này.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.map((log) => {
          const dateStr = new Date(log.createdAt).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })

          const isCreate = log.action === 'create'
          const changes = log.changedFields || {}
          const changeKeys = Object.keys(changes)

          return (
            <div
              key={log.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '12px 14px',
                background: isCreate ? '#f0fdf4' : '#fafafa'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: isCreate ? '#16a34a' : '#2563eb',
                    color: '#ffffff'
                  }}>
                    {isCreate ? 'TẠO MỚI' : 'CHỈNH SỬA'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    {log.actorEmail || 'Người quản trị'}
                  </span>
                  {log.actorRole && (
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '3px' }}>
                      {log.actorRole}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  🕒 {dateStr} {log.ip ? `(IP: ${log.ip})` : ''}
                </div>
              </div>

              {/* Chi tiết các trường thay đổi */}
              {changeKeys.length > 0 ? (
                <div style={{ marginTop: '8px', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '6px 10px', width: '25%' }}>Trường thay đổi</th>
                        <th style={{ padding: '6px 10px', width: '37.5%' }}>Trước khi sửa</th>
                        <th style={{ padding: '6px 10px', width: '37.5%' }}>Sau khi sửa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeKeys.map((key) => {
                        const item = changes[key]
                        const formatVal = (val: unknown) => {
                          if (val === null || val === undefined || val === '') return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>[Để trống]</span>
                          if (typeof val === 'boolean') return val ? 'Bật (True)' : 'Tắt (False)'
                          if (typeof val === 'object') return JSON.stringify(val)
                          return String(val)
                        }

                        // Tên tiếng Việt thân thiện cho một số trường phổ biến
                        const fieldLabels: Record<string, string> = {
                          title: 'Tiêu đề lịch',
                          displayMode: 'Chế độ hiển thị',
                          documentNumber: 'Số hiệu văn bản',
                          revision: 'Lần chỉnh sửa',
                          weekNumber: 'Tuần thứ',
                          year: 'Năm',
                          startDate: 'Ngày bắt đầu',
                          endDate: 'Ngày kết thúc',
                          generalNote: 'Ghi chú chân trang',
                          signerRole: 'Chức danh người ký',
                          signerName: 'Họ tên người ký',
                          days: 'Bảng các ngày trong tuần',
                          active: 'Áp dụng công khai',
                        }

                        return (
                          <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>
                              {fieldLabels[key] || key}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#b91c1c', wordBreak: 'break-word' }}>
                              {formatVal(item.before)}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#15803d', wordBreak: 'break-word', fontWeight: 500 }}>
                              {formatVal(item.after)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                  {isCreate ? 'Bản ghi được khởi tạo ban đầu.' : 'Cập nhật tài liệu nhưng không có trường chính nào thay đổi giá trị.'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
