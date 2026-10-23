export const id = '20261022_080_enforce_appointments_code_unique_and_counter'
export const description = 'Tạo bảng đếm số thứ tự lịch khám nguyên tử appointment_daily_counters và thiết lập unique constraint trên appointments.code'
export const transactional = true

export async function up({ client }) {
  // 1. Tạo bảng đếm số thứ tự nguyên tử theo ngày cho lịch hẹn
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.appointment_daily_counters (
      date_key date PRIMARY KEY,
      current_val integer NOT NULL DEFAULT 0,
      updated_at timestamp with time zone DEFAULT now()
    );
  `)

  // 2. Khởi tạo giá trị ban đầu cho ngày hôm nay từ số thứ tự cao nhất hiện có
  await client.query(`
    INSERT INTO public.appointment_daily_counters (date_key, current_val, updated_at)
    VALUES (
      CURRENT_DATE,
      COALESCE((
        SELECT MAX(SUBSTRING(code FROM 5)::integer)
        FROM public.appointments
        WHERE code ~ '^BVTL[0-9]+$'
      ), 0),
      now()
    )
    ON CONFLICT (date_key) DO NOTHING;
  `)

  // 3. Đảm bảo tính toàn vẹn duy nhất trên bảng appointments
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_code_idx ON public.appointments (code);
  `)
}

export async function verify({ client }) {
  // 1. Kiểm tra bảng appointment_daily_counters tồn tại
  const tableCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'appointment_daily_counters'
  `)
  if (tableCheck.rows.length === 0) {
    throw new Error('Bảng appointment_daily_counters chưa được tạo.')
  }

  // 2. Kiểm tra unique index appointments_code_idx tồn tại
  const indexCheck = await client.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'appointments' AND indexname = 'appointments_code_idx'
  `)
  if (indexCheck.rows.length === 0) {
    throw new Error('Index appointments_code_idx chưa được tạo trên bảng appointments.')
  }
}
