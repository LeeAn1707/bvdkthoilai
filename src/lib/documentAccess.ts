import { createHmac, timingSafeEqual } from 'crypto'

export type ProtectedDocumentCollection = 'documents' | 'clinical-protocols' | 'work-schedules'

type DocumentToken = {
  collection: ProtectedDocumentCollection
  documentId: string
  mediaId: string
  exp: number
}

const secret = () => {
  const value = process.env.DOCUMENT_ACCESS_SECRET || process.env.PAYLOAD_SECRET || ''
  if (value.length < 32) throw new Error('DOCUMENT_ACCESS_SECRET_NOT_CONFIGURED')
  return value
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export const securePinDigest = (pin: string) =>
  createHmac('sha256', secret()).update(pin.trim()).digest()

export const pinsMatch = (input: string, expected: string) => {
  if (!input.trim() || !expected.trim()) return false
  return timingSafeEqual(securePinDigest(input), securePinDigest(expected))
}

export const createDocumentToken = (
  collection: ProtectedDocumentCollection,
  documentId: string | number,
  mediaId: string | number,
  ttlSeconds = 300,
) => {
  const token: DocumentToken = {
    collection,
    documentId: String(documentId),
    mediaId: String(mediaId),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payload = Buffer.from(JSON.stringify(token)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export const verifyDocumentToken = (value: string): DocumentToken | null => {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  const receivedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DocumentToken
    if (!['documents', 'clinical-protocols', 'work-schedules'].includes(parsed.collection)) return null
    if (!parsed.documentId || !parsed.mediaId || parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export const relationID = (value: unknown) => {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: string | number }).id)
  return ''
}
