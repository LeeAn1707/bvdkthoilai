export const id = '20261022_081_create_global_appointment_code_sequence'
export const description = 'Tạo sequence toàn cục appointment_code_seq tăng liên tục không phụ thuộc ngày tháng, khởi tạo từ giá trị lớn nhất hiện có và duy trì unique index'
export const transactional = true

export async function up({ client }) {
  // 1. Tạo sequence toàn cục trong PostgreSQL cho việc sinh mã phiếu hẹn tăng dần liên tục
  await client.query(`
    CREATE SEQUENCE IF NOT EXISTS public.appointment_code_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1;
  `)

  // 2. Khởi tạo sequence an toàn từ giá trị lớn nhất hiện có trong cơ sở dữ liệu
  // Đảm bảo không va chạm mã lịch sử và không ảnh hưởng khi ứng dụng chạy đồng thời
  await client.query(`
    DO $$
    DECLARE
      max_val BIGINT;
    BEGIN
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS BIGINT)), 0)
      INTO max_val
      FROM public.appointments
      WHERE code ~ '^BVTL[0-9]+$';

      IF max_val > 0 THEN
        -- Gán giá trị hiện tại là max_val với is_called = true để lần gọi nextval kế tiếp sẽ trả về max_val + 1
        PERFORM setval('public.appointment_code_seq', max_val, true);
      ELSE
        -- Nếu bảng trống, khởi tạo giá trị 1 với is_called = false để lần gọi nextval đầu tiên trả về đúng 1
        PERFORM setval('public.appointment_code_seq', 1, false);
      END IF;
    END $$;
  `)

  // 3. Đảm bảo ràng buộc UNIQUE index luôn được duy trì trên cột appointments.code
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_code_idx ON public.appointments (code);
  `)
}

export async function verify({ client }) {
  // 1. Kiểm tra sequence appointment_code_seq tồn tại trong schema public
  const seqCheck = await client.query(`
    SELECT relname 
    FROM pg_class 
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' 
      AND pg_class.relkind = 'S' 
      AND pg_class.relname = 'appointment_code_seq';
  `)
  if (seqCheck.rows.length === 0) {
    throw new Error('Sequence public.appointment_code_seq chưa được tạo.')
  }

  // 2. Kiểm tra unique index appointments_code_idx tồn tại
  const indexCheck = await client.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'appointments' 
      AND indexname = 'appointments_code_idx';
  `)
  if (indexCheck.rows.length === 0) {
    throw new Error('Index appointments_code_idx chưa được duy trì trên bảng appointments.')
  }

  // 3. Kiểm tra giá trị sequence không nhỏ hơn mã lớn nhất hiện có
  const maxRow = await client.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS BIGINT)), 0) as max_val
    FROM public.appointments
    WHERE code ~ '^BVTL[0-9]+$';
  `)
  const maxVal = Number(maxRow.rows[0].max_val)
  const seqValRow = await client.query(`SELECT last_value, is_called FROM public.appointment_code_seq;`)
  const seqVal = Number(seqValRow.rows[0].last_value)
  const isCalled = Boolean(seqValRow.rows[0].is_called)

  if (maxVal > 0 && isCalled && seqVal < maxVal) {
    throw new Error(`Giá trị sequence (${seqVal}) nhỏ hơn mã lớn nhất hiện có (${maxVal}).`)
  }
}
