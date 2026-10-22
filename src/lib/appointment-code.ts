import type { Payload } from 'payload'

/**
 * Sinh mã phiếu hẹn nguyên tử tăng liên tục toàn hệ thống (Monotonic Global Sequence):
 * Định dạng quy chuẩn: BVTL + 4 số thứ tự (0001 -> 9999, vượt 9999 tiếp tục tăng dần BVTL10000...).
 * Sử dụng PostgreSQL SEQUENCE (public.appointment_code_seq):
 * - 100% nguyên tử (atomic), non-blocking, an toàn tuyệt đối dưới tải cao.
 * - Hoàn toàn độc lập với múi giờ (timezone) và không bao giờ bị reset về 1 khi chuyển ngày mới,
 *   loại bỏ hoàn toàn rủi ro va chạm với mã của các ngày trước đó.
 * - Loại bỏ hoàn toàn fallback âm thầm sinh mã ngẫu nhiên; nếu gặp sự cố sẽ ném lỗi có kiểm soát.
 */
export async function getNextAtomicAppointmentCode(payload: Payload): Promise<string> {
  const drizzle = (payload.db as any)?.drizzle
  if (!drizzle?.execute) {
    throw new Error('APPOINTMENT_CODE_GENERATOR_ERROR: Drizzle database adapter is not available on payload.db')
  }

  // Gọi nextval() từ sequence toàn cục của PostgreSQL
  const res = await drizzle.execute("SELECT nextval('public.appointment_code_seq') as next_val")
  const nextVal = Number(res?.rows?.[0]?.next_val)

  if (!Number.isInteger(nextVal) || nextVal <= 0) {
    throw new Error(
      `APPOINTMENT_CODE_GENERATOR_ERROR: Invalid sequence value received from PostgreSQL: ${res?.rows?.[0]?.next_val}`
    )
  }

  // Format quy chuẩn: BVTL + 4 số thứ tự tối thiểu (BVTL0001 -> BVTL9999, BVTL10000+)
  return nextVal <= 9999 ? `BVTL${String(nextVal).padStart(4, '0')}` : `BVTL${nextVal}`
}
