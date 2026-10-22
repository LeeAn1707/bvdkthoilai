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
  // Đảm bảo không va chạm mã lịch sử, bảo vệ khỏi ghi lịch hẹn đồng thời và không làm lùi sequence khi chạy lại
  await client.query(`
    DO $$
    DECLARE
      max_val BIGINT;
      curr_seq_val BIGINT;
      seq_called BOOLEAN;
      target_val BIGINT;
    BEGIN
      -- Khóa bảng appointments ở mức EXCLUSIVE để ngăn chặn hoàn toàn việc ghi lịch hẹn đồng thời trong khi tính toán và khởi tạo sequence
      LOCK TABLE public.appointments IN EXCLUSIVE MODE;

      -- Lấy giá trị mã số lớn nhất hiện có trong bảng appointments
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS BIGINT)), 0)
      INTO max_val
      FROM public.appointments
      WHERE code ~ '^BVTL[0-9]+$';

      -- Kiểm tra trạng thái hiện tại của sequence
      SELECT last_value, is_called INTO curr_seq_val, seq_called 
      FROM public.appointment_code_seq;

      -- Đảm bảo không làm lùi sequence nếu migration chạy lại hoặc sequence đã tiến xa hơn mã đã lưu
      IF seq_called THEN
        target_val := GREATEST(max_val, curr_seq_val);
        PERFORM setval('public.appointment_code_seq', target_val, true);
      ELSE
        IF max_val > 0 THEN
          PERFORM setval('public.appointment_code_seq', max_val, true);
        ELSE
          PERFORM setval('public.appointment_code_seq', 1, false);
        END IF;
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

  // 2. Xác minh sâu UNIQUE index appointments_code_idx: thực sự duy nhất (indisunique), hợp lệ (indisvalid) và gắn trên cột 'code' của bảng appointments
  const indexDeepCheck = await client.query(`
    SELECT 
      c.relname AS index_name,
      i.indisunique AS is_unique,
      i.indisvalid AS is_valid,
      a.attname AS column_name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'appointments'
      AND c.relname = 'appointments_code_idx';
  `)
  if (indexDeepCheck.rows.length === 0) {
    throw new Error('Index appointments_code_idx không tồn tại trên bảng appointments.')
  }
  const idxInfo = indexDeepCheck.rows[0]
  if (!idxInfo.is_unique) {
    throw new Error('Index appointments_code_idx tồn tại nhưng không có cờ UNIQUE (indisunique = false).')
  }
  if (!idxInfo.is_valid) {
    throw new Error('Index appointments_code_idx không hợp lệ (indisvalid = false).')
  }
  if (idxInfo.column_name !== 'code') {
    throw new Error(`Index appointments_code_idx không áp dụng cho cột code (cột áp dụng: ${idxInfo.column_name}).`)
  }

  // 3. Xác minh tính duy nhất dữ liệu thực tế: không có bất kỳ mã trùng nào trong bảng appointments
  const dupCheck = await client.query(`
    SELECT code, COUNT(*) as cnt 
    FROM public.appointments 
    GROUP BY code 
    HAVING COUNT(*) > 1;
  `)
  if (dupCheck.rows.length > 0) {
    throw new Error(`Phát hiện mã bị trùng lặp trong appointments: ${JSON.stringify(dupCheck.rows)}`)
  }

  // 4. Kiểm tra giá trị sequence không nhỏ hơn mã lớn nhất hiện có
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
