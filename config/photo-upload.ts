/**
 * Multipart photo upload handler (D2 local disk).
 */
import fsp from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Website } from 'thalia/website'
import { parseForm } from 'thalia/util'
import { insertPhoto, storeUploadFile } from './photo-store.js'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const FILE_FIELD = 'fileToUpload'

function firstFile(files: Record<string, unknown>): { filepath: string; mimetype?: string | null; originalFilename?: string | null } | null {
  const raw = files[FILE_FIELD]
  const file = Array.isArray(raw) ? raw[0] : raw
  if (!file || typeof file !== 'object' || !('filepath' in file)) return null
  const f = file as { filepath: string; mimetype?: string | null; originalFilename?: string | null }
  return f.filepath ? f : null
}

export async function handleUploadPhoto(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  try {
    const { fields, files } = await parseForm(res, req)
    const file = firstFile(files as Record<string, unknown>)
    if (!file) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Missing fileToUpload' }))
      return
    }
    const mime = (file.mimetype || '').toLowerCase()
    if (mime && !ALLOWED_MIME.has(mime)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Unsupported image type' }))
      return
    }
    const bytes = await fsp.readFile(file.filepath)
    await fsp.unlink(file.filepath).catch(() => {})
    const stored = await storeUploadFile(website.rootPath, bytes, file.originalFilename || 'upload.jpg')
    const photo = await insertPhoto(website, ownerUserId, stored, {
      title: fields.title,
      artist: fields.artist,
      year: fields.year,
    })
    if (!photo) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Database unavailable' }))
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true, photo }))
  } catch (err) {
    if (res.headersSent) return
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    )
  }
}
