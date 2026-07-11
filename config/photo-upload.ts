/**
 * Photo upload — UploadThing → SmugMug (D3) or local disk (D2 fallback).
 */
import fsp from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Website } from 'thalia/website'
import { readLimitedJsonObject } from 'thalia/controllers'
import { parseForm } from 'thalia/util'
import { fetchRemoteHttpsImageBytes, pickRemoteFileUrl } from 'thalia/images'
import {
  insertPhoto,
  insertPhotoRecord,
  storeUploadFile,
  type PhotoDto,
} from './photo-store.js'
import {
  loadDefaultAlbumKey,
  loadSmugMugCreds,
  loadUploadThingToken,
  resolveImageAdapter,
} from './load-secrets.js'
import { uploadBytesToSmugMugAlbum } from './smugmug-upload.js'
import { addTempFile, runCleanupIfNeeded } from './uploadthing-cleanup.js'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const FILE_FIELD = 'fileToUpload'

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function firstFile(files: Record<string, unknown>): { filepath: string; mimetype?: string | null; originalFilename?: string | null } | null {
  const raw = files[FILE_FIELD]
  const file = Array.isArray(raw) ? raw[0] : raw
  if (!file || typeof file !== 'object' || !('filepath' in file)) return null
  const f = file as { filepath: string; mimetype?: string | null; originalFilename?: string | null }
  return f.filepath ? f : null
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename
}

function filenameFromUrl(urlString: string): string | undefined {
  try {
    const base = new URL(urlString).pathname.split('/').pop()
    return base?.trim() || undefined
  } catch {
    return undefined
  }
}

function parseOptionalFolderId(raw: unknown): number | null | undefined {
  if (raw == null || raw === '') return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

async function persistSmugMugPhoto(
  website: Website,
  ownerUserId: number,
  bytes: Buffer,
  meta: { filename: string; title?: string; artist?: string; year?: string; folderId?: number | null },
  albumKey: string
): Promise<PhotoDto> {
  const creds = await loadSmugMugCreds()
  if (!creds) throw new Error('SmugMug credentials not configured')
  const stored = await uploadBytesToSmugMugAlbum(creds, albumKey, bytes, {
    filename: meta.filename,
    title: meta.title ?? titleFromFilename(meta.filename),
  })
  const photo = await insertPhotoRecord(website, ownerUserId, {
    title: meta.title ?? titleFromFilename(meta.filename),
    artist: meta.artist,
    year: meta.year,
    filename: stored.filename,
    url: stored.url,
    thumbnailUrl: stored.thumbnailUrl,
    folderId: meta.folderId ?? null,
    adapterName: 'smugmug',
    smugmugAlbumKey: stored.smugmugAlbumKey,
    smugmugImageKey: stored.smugmugImageKey,
    archivedMd5: stored.archivedMd5,
  })
  if (!photo) throw new Error('Database unavailable')
  return photo
}

async function handleJsonUpload(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  const body = await readLimitedJsonObject(req)
  const remoteUrl = pickRemoteFileUrl(body)
  if (!remoteUrl) {
    json(res, 400, { ok: false, error: 'uploadThingUrl, fileUrl, or url required' })
    return
  }
  const creds = await loadSmugMugCreds()
  if (!creds) {
    json(res, 503, { ok: false, error: 'SmugMug credentials not configured' })
    return
  }
  const albumKey =
    (typeof body.albumKey === 'string' && body.albumKey.trim()) ||
    (await loadDefaultAlbumKey()) ||
    creds.album?.trim() ||
    ''
  if (!albumKey) {
    json(res, 503, { ok: false, error: 'SmugMug album key not configured (BINGO_ALBUM_KEY)' })
    return
  }

  const { buffer: bytes } = await fetchRemoteHttpsImageBytes(remoteUrl, {
    log: { website: 'gallery', service: 'uploadthing' },
  })
  const filename =
    (typeof body.filename === 'string' && body.filename.trim()) ||
    filenameFromUrl(remoteUrl) ||
    'image.jpg'
  const folderId = parseOptionalFolderId(body.folderId)
  const photo = await persistSmugMugPhoto(
    website,
    ownerUserId,
    bytes,
    {
      filename,
      title: typeof body.title === 'string' ? body.title : undefined,
      artist: typeof body.artist === 'string' ? body.artist : undefined,
      year: typeof body.year === 'string' ? body.year : undefined,
      folderId: folderId === undefined ? null : folderId,
    },
    albumKey
  )

  const fileKey = typeof body.fileKey === 'string' ? body.fileKey : null
  const fileSize = typeof body.size === 'number' ? body.size : bytes.length
  if (fileKey) addTempFile(fileKey, fileSize)
  const utToken = await loadUploadThingToken()
  void runCleanupIfNeeded(utToken).catch((e) => console.error('[uploadthing-cleanup]', e))

  json(res, 200, { ok: true, photo, adapterName: 'smugmug' })
}

async function handleMultipartUpload(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  const { fields, files } = await parseForm(res, req)
  const file = firstFile(files as Record<string, unknown>)
  if (!file) {
    json(res, 400, { ok: false, error: 'Missing fileToUpload' })
    return
  }
  const mime = (file.mimetype || '').toLowerCase()
  if (mime && !ALLOWED_MIME.has(mime)) {
    json(res, 400, { ok: false, error: 'Unsupported image type' })
    return
  }
  const bytes = await fsp.readFile(file.filepath)
  await fsp.unlink(file.filepath).catch(() => {})
  const filename = file.originalFilename || 'upload.jpg'
  const folderId = parseOptionalFolderId(fields.folderId)
  const meta = {
    title: fields.title || titleFromFilename(filename),
    artist: fields.artist,
    year: fields.year,
    filename,
    folderId: folderId === undefined ? null : folderId,
  }

  const creds = await loadSmugMugCreds()
  const adapter = resolveImageAdapter(Boolean(creds))

  if (adapter === 'smugmug' && creds) {
    const albumKey =
      (await loadDefaultAlbumKey()) ||
      creds.album?.trim() ||
      ''
    if (!albumKey) {
      json(res, 503, { ok: false, error: 'SmugMug album key not configured' })
      return
    }
    const photo = await persistSmugMugPhoto(website, ownerUserId, bytes, meta, albumKey)
    json(res, 200, { ok: true, photo, adapterName: 'smugmug' })
    return
  }

  const stored = await storeUploadFile(website.rootPath, bytes, filename)
  const photo = await insertPhotoRecord(website, ownerUserId, {
    title: meta.title,
    artist: meta.artist,
    year: meta.year,
    filename: stored.filename,
    url: stored.url,
    thumbnailUrl: stored.url,
    folderId: meta.folderId ?? null,
    adapterName: 'local-disk',
  })
  if (!photo) {
    json(res, 503, { ok: false, error: 'Database unavailable' })
    return
  }
  json(res, 200, { ok: true, photo, adapterName: 'local-disk' })
}

export async function handleUploadPhoto(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  try {
    const contentType = (req.headers['content-type'] ?? '').toLowerCase()
    if (contentType.includes('application/json')) {
      await handleJsonUpload(res, req, website, ownerUserId)
      return
    }
    await handleMultipartUpload(res, req, website, ownerUserId)
  } catch (err) {
    if (res.headersSent) return
    json(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    })
  }
}
