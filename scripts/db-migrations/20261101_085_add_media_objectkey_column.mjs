export const id = '20261101_085_add_media_objectkey_column'
export const description = 'Thêm cột _objectkey và prefix cho bảng media để đồng bộ với @payloadcms/storage-s3 3.92.1 (R2/S3 storage)'
export const transactional = true

export async function up({ client }) {
  await client.query(`
    ALTER TABLE public.media
      ADD COLUMN IF NOT EXISTS _objectkey VARCHAR,
      ADD COLUMN IF NOT EXISTS prefix VARCHAR;
  `)
}

export async function verify({ client }) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media'
      AND column_name IN ('_objectkey', 'prefix');
  `)
  if (result.rowCount < 2) {
    throw new Error('Cột public.media._objectkey hoặc public.media.prefix chưa được tạo.')
  }
}
