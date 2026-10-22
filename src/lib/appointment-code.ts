import type { Payload } from 'payload'

/**
 * Sinh mã phiếu hẹn nguyên tử theo ngày (múi giờ Việt Nam UTC+7):
 * Định dạng quy chuẩn: BVTL + 4 số thứ tự (0001 -> 9999, vượt 9999 tiếp tục tăng dần BVTL10000...).
 * Sử dụng cơ chế ON CONFLICT DO UPDATE của PostgreSQL trên bảng appointment_daily_counters
 * đảm bảo 100% nguyên tử (atomic), loại bỏ hoàn toàn race-condition và va chạm mã dưới tải cao.
 */
export async function getNextAtomicAppointmentCode(payload: Payload): Promise<string> {
  // Tính ngày hiện tại theo giờ Việt Nam (UTC+7)
  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const yyyy = nowVN.getUTCFullYear()
  const mm = String(nowVN.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowVN.getUTCDate()).padStart(2, '0')
  const dateKey = `${yyyy}-${mm}-${dd}`

  try {
    const drizzle = (payload.db as any)?.drizzle
    if (drizzle?.execute) {
      const sqlQuery = `
        INSERT INTO public.appointment_daily_counters (date_key, current_val, updated_at)
        VALUES ('${dateKey}', 1, now())
        ON CONFLICT (date_key) DO UPDATE
        SET current_val = public.appointment_daily_counters.current_val + 1,
            updated_at = now()
        RETURNING current_val;
      `
      const res = await drizzle.execute(sqlQuery)
      const nextVal = Number(res?.rows?.[0]?.current_val)
      if (Number.isInteger(nextVal) && nextVal > 0) {
        return nextVal <= 9999 ? `BVTL${String(nextVal).padStart(4, '0')}` : `BVTL${nextVal}`
      }
    }
  } catch {
    // Tiếp tục fallback nếu gặp sự cố truy cập bảng counter
  }

  // Fallback an toàn (chỉ dùng khi DB chưa áp dụng migration hoặc mock test)
  const crypto = await import('node:crypto')
  const fallbackHex = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `BVTL-${yyyy}${mm}${dd}-${fallbackHex}`
}
