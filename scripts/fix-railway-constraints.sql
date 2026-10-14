-- ==============================================================================
-- SCRIPT TỰ ĐỘNG KHÔI PHỤC PRIMARY KEY VÀ SEQUENCE TRÊN POSTGRESQL (RAILWAY)
-- Khắc phục:
--   1. Lỗi treo admin "ĐANG TẢI" (ON CONFLICT id DO UPDATE trên payload_preferences)
--   2. Lỗi không tạo được bài mới / không upload được ảnh ('_rels' in undefined)
--   3. Đồng bộ lại toàn bộ Sequence ID cho mọi bảng trong CSDL
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_seq_name TEXT;
    v_max_id BIGINT;
    v_has_pk BOOLEAN;
    v_has_id_col BOOLEAN;
    v_id_type TEXT;
BEGIN
    RAISE NOTICE '>>> Bắt đầu kiểm tra và khôi phục PRIMARY KEY & SEQUENCE...';

    -- 1. Xử lý trùng lặp và làm sạch payload_preferences trước
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payload_preferences'
    ) THEN
        DELETE FROM public.payload_preferences a
        WHERE a.ctid <> (
            SELECT ctid FROM public.payload_preferences b
            WHERE b.id = a.id
            ORDER BY b.updated_at DESC NULLS LAST, b.ctid DESC
            LIMIT 1
        );
    END IF;

    -- 2. Duyệt qua tất cả các bảng thông thường trong schema public
    FOR r IN (
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          AND t.table_name NOT IN ('spatial_ref_sys')
        ORDER BY t.table_name
    ) LOOP
        -- Kiểm tra bảng có cột id không và kiểu dữ liệu của cột id
        SELECT 
            EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'id'
            ),
            (
                SELECT data_type FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'id'
                LIMIT 1
            )
        INTO v_has_id_col, v_id_type;

        -- Kiểm tra bảng đã có Primary Key hay chưa
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public' 
              AND tc.table_name = r.table_name 
              AND tc.constraint_type = 'PRIMARY KEY'
        ) INTO v_has_pk;

        -- Nếu có cột id nhưng chưa có PRIMARY KEY
        IF v_has_id_col AND NOT v_has_pk THEN
            -- Xóa các bản ghi trùng id nếu có
            EXECUTE format('
                DELETE FROM public.%I a
                WHERE a.ctid <> (
                    SELECT ctid FROM public.%I b
                    WHERE b.id = a.id
                    LIMIT 1
                )', r.table_name, r.table_name);

            -- Đặt cột id là NOT NULL
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET NOT NULL', r.table_name);
            -- Tạo ràng buộc khóa chính
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', r.table_name, r.table_name || '_pkey');
            RAISE NOTICE '[OK] Đã tạo PRIMARY KEY cho bảng: %', r.table_name;
        END IF;

        -- Xử lý SEQUENCE cho cột id kiểu số (integer / bigint / smallint)
        IF v_has_id_col AND v_id_type IN ('integer', 'bigint', 'smallint') THEN
            v_seq_name := pg_get_serial_sequence('public.' || quote_ident(r.table_name), 'id');
            IF v_seq_name IS NULL THEN
                v_seq_name := r.table_name || '_id_seq';
                EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', v_seq_name);
                EXECUTE format('ALTER SEQUENCE public.%I OWNED BY public.%I.id', v_seq_name, r.table_name);
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L)', r.table_name, 'public.' || v_seq_name);
                v_seq_name := 'public.' || v_seq_name;
                RAISE NOTICE '[OK] Đã tạo SEQUENCE và gắn DEFAULT cho bảng: %', r.table_name;
            END IF;

            IF v_seq_name NOT LIKE '%.%' THEN
                v_seq_name := 'public.' || v_seq_name;
            END IF;

            -- Đồng bộ lại sequence với MAX(id) hiện có trong bảng
            EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM public.%I', r.table_name) INTO v_max_id;
            EXECUTE format('SELECT setval(%L, %s, false)', v_seq_name, v_max_id);
        END IF;
    END LOOP;

    -- 3. Đảm bảo bảng thống kê site_visits_daily (dùng cột date làm PK)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_visits_daily'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'site_visits_daily' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.site_visits_daily ALTER COLUMN date SET NOT NULL;
        ALTER TABLE public.site_visits_daily ADD CONSTRAINT site_visits_daily_pkey PRIMARY KEY (date);
        RAISE NOTICE '[OK] Đã tạo PRIMARY KEY cho site_visits_daily (date)';
    END IF;

    RAISE NOTICE '>>> Hoàn tất! Toàn bộ bảng đã có Primary Key và Sequence ID đồng bộ chuẩn xác.';
END $$;
