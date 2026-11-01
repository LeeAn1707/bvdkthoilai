export const id = '20261101_082_add_users_reset_password_requested_at'
export const description = 'Thêm cột reset_password_requested_at cho bảng users để đồng bộ với Payload CMS 3.92.1'
export const transactional = true

export async function up({ client }) {
  await client.query(`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS reset_password_requested_at TIMESTAMP(3) WITH TIME ZONE;
  `)
}

export async function verify({ client }) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'reset_password_requested_at';
  `)
  if (result.rowCount !== 1) {
    throw new Error('Cột public.users.reset_password_requested_at chưa được tạo.')
  }
}

