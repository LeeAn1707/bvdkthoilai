import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { getCMS } from '@/lib/payload'

export const dynamic = 'force-dynamic'

let cachedR2Health: { ok: boolean; expiresAt: number } | null = null

async function storageProbe(): Promise<boolean> {
  const isR2 = Boolean(
    process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT,
  )

  if (isR2 && (process.env.NODE_ENV === 'production' || process.env.MEDIA_STORAGE === 'r2')) {
    const now = Date.now()
    if (cachedR2Health && cachedR2Health.expiresAt > now) {
      return cachedR2Health.ok
    }
    try {
      const endpoint = process.env.R2_ENDPOINT?.trim()
      const bucket = process.env.R2_BUCKET?.trim()
      const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
      if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return false

      const s3 = new S3Client({
        endpoint,
        region: 'auto',
        credentials: { accessKeyId, secretAccessKey },
      })
      await s3.send(new HeadBucketCommand({ Bucket: bucket }), {
        abortSignal: AbortSignal.timeout(3000),
      })
      cachedR2Health = { ok: true, expiresAt: now + 30_000 }
      return true
    } catch {
      cachedR2Health = { ok: false, expiresAt: now + 15_000 }
      return false
    }
  }

  try {
    const mediaDir = path.resolve(process.cwd(), 'media')
    await fs.access(mediaDir)
    return true
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  const checks: { database?: string; storage?: string } = {}
  try {
    const payload = await getCMS()
    await payload.count({ collection: 'users', overrideAccess: true })
    checks.database = 'ok'

    const storageOk = await storageProbe()
    checks.storage = storageOk ? 'ok' : 'degraded'

    const detailKey = process.env.HEALTH_DETAIL_KEY
    const detailed = Boolean(detailKey && req.headers.get('x-health-key') === detailKey)

    return NextResponse.json(
      detailed
        ? { status: 'ok', checks: { database: checks.database, storage: checks.storage }, time: new Date().toISOString() }
        : { status: 'ok', checks },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('[HealthCheck] Lỗi kiểm tra trạng thái hệ thống:', error)
    return NextResponse.json(
      { status: 'error', checks: { database: checks.database || 'error', storage: checks.storage || 'unknown' } },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}

