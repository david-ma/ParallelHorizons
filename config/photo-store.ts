/**
 * Owner-scoped photo library (D2).
 */
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, inArray, isNull, or, sql, like } from 'drizzle-orm'
import type { Website } from 'thalia/website'
import { photos, galleries, photoFolders } from '../models/gallery-schema.js'
import { resolvePhotoDisplaySrc } from './smugmug-urls.js'

export type PhotoDto = {
  id: string
  title: string
  src: string
  thumbnailUrl: string
  folderId?: string | null
  artist?: string
  year?: string
  filename?: string
}

export type PhotoListOptions = {
  /** `root` = folder_id IS NULL; number = folder; omit = all */
  folderId?: 'root' | number
  q?: string
  unplaced?: boolean
}

export type StoredUpload = {
  url: string
  filepath: string
  filename: string
}

function drizzleOrNull(website: Website) {
  return website.db?.drizzle ?? null
}

export function uploadsDirectory(rootPath: string): string {
  return path.join(rootPath, 'public', 'uploads')
}

export function uploadsBaseUrl(): string {
  return '/uploads'
}

export async function storeUploadFile(
  rootPath: string,
  bytes: Buffer,
  originalFilename: string
): Promise<StoredUpload> {
  const ext = path.extname(originalFilename) || '.jpg'
  const md5 = crypto.createHash('md5').update(bytes).digest('hex')
  const diskName = `${md5}${ext}`
  const dir = uploadsDirectory(rootPath)
  await fsp.mkdir(dir, { recursive: true })
  const filepath = path.join(dir, diskName)
  await fsp.writeFile(filepath, bytes)
  const url = `${uploadsBaseUrl()}/${diskName}`
  return { url, filepath, filename: originalFilename || diskName }
}

function rowToDto(row: {
  id: number
  title: string | null
  url: string
  thumbnailUrl: string | null
  folderId: number | null
  artist: string | null
  year: string | null
  filename: string | null
}): PhotoDto {
  const title = row.title?.trim() || row.filename?.trim() || `Photo ${row.id}`
  const src = resolvePhotoDisplaySrc(row.url, row.thumbnailUrl)
  const thumbnailUrl = row.thumbnailUrl?.trim() || src
  return {
    id: String(row.id),
    title,
    src,
    thumbnailUrl,
    folderId: row.folderId == null ? null : String(row.folderId),
    artist: row.artist?.trim() || undefined,
    year: row.year?.trim() || undefined,
    filename: row.filename?.trim() || undefined,
  }
}

const photoSelect = {
  id: photos.id,
  title: photos.title,
  url: photos.url,
  thumbnailUrl: photos.thumbnailUrl,
  folderId: photos.folderId,
  artist: photos.artist,
  year: photos.year,
  filename: photos.filename,
}

/** Photo ids referenced on any owner floorplan wall or catalog. */
export async function collectPlacedPhotoIds(website: Website, ownerUserId: number): Promise<Set<string>> {
  const db = drizzleOrNull(website)
  const placed = new Set<string>()
  if (!db) return placed
  const rows = await db
    .select({ floorplanJson: galleries.floorplanJson })
    .from(galleries)
    .where(and(eq(galleries.ownerUserId, ownerUserId), isNull(galleries.deletedAt)))
  for (const row of rows) {
    if (!row.floorplanJson?.trim()) continue
    try {
      const fp = JSON.parse(row.floorplanJson) as FloorplanLike
      if (Array.isArray(fp.photoCatalog)) {
        for (const p of fp.photoCatalog) {
          if (p.id) placed.add(String(p.id))
        }
      }
      const placements = fp.placements
      if (!placements) continue
      for (const cell of Object.values(placements)) {
        if (!cell || typeof cell !== 'object') continue
        for (const val of Object.values(cell)) {
          if (typeof val === 'string' && val) placed.add(val)
          else if (Array.isArray(val)) val.forEach((id) => id && placed.add(String(id)))
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return placed
}

export async function listPhotosForOwner(
  website: Website,
  ownerUserId: number,
  options: PhotoListOptions = {}
): Promise<PhotoDto[]> {
  const db = drizzleOrNull(website)
  if (!db) return []

  const conditions = [eq(photos.ownerUserId, ownerUserId), isNull(photos.deletedAt)]

  if (options.folderId === 'root') {
    conditions.push(isNull(photos.folderId))
  } else if (typeof options.folderId === 'number') {
    conditions.push(eq(photos.folderId, options.folderId))
  }

  const q = options.q?.trim()
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`
    conditions.push(
      or(
        like(photos.title, pattern),
        like(photos.artist, pattern),
        like(photos.filename, pattern)
      )!
    )
  }

  const rows = await db
    .select(photoSelect)
    .from(photos)
    .where(and(...conditions))
    .orderBy(desc(photos.createdAt))

  let dtos = rows.map(rowToDto)
  if (options.unplaced) {
    const placed = await collectPlacedPhotoIds(website, ownerUserId)
    dtos = dtos.filter((p) => !placed.has(p.id))
  }
  return dtos
}

export async function getPhotoForOwner(
  website: Website,
  photoId: number,
  ownerUserId: number
): Promise<PhotoDto | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const rows = await db
    .select(photoSelect)
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.ownerUserId, ownerUserId), isNull(photos.deletedAt)))
    .limit(1)
  const row = rows[0]
  return row ? rowToDto(row) : null
}

export type PhotoInsertPayload = {
  title?: string
  artist?: string
  year?: string
  filename: string
  url: string
  thumbnailUrl: string
  folderId?: number | null
  adapterName?: string
  smugmugAlbumKey?: string
  smugmugImageKey?: string
  archivedMd5?: string
}

export async function insertPhotoRecord(
  website: Website,
  ownerUserId: number,
  payload: PhotoInsertPayload
): Promise<PhotoDto | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const title = payload.title?.trim() || payload.filename
  const result = await db.insert(photos).values({
    ownerUserId,
    folderId: payload.folderId ?? null,
    title,
    artist: payload.artist?.trim() || null,
    year: payload.year?.trim() || null,
    caption: null,
    filename: payload.filename,
    url: payload.url,
    thumbnailUrl: payload.thumbnailUrl,
    adapterName: payload.adapterName ?? 'local-disk',
    smugmugAlbumKey: payload.smugmugAlbumKey ?? null,
    smugmugImageKey: payload.smugmugImageKey ?? null,
    archivedMd5: payload.archivedMd5 ?? null,
  })
  const header = Array.isArray(result) ? result[0] : result
  const insertId =
    header && typeof header === 'object' && 'insertId' in header
      ? Number((header as { insertId: number | bigint }).insertId)
      : undefined
  if (insertId == null) return null
  return getPhotoForOwner(website, insertId, ownerUserId)
}

export async function insertPhoto(
  website: Website,
  ownerUserId: number,
  stored: StoredUpload,
  meta: { title?: string; artist?: string; year?: string }
): Promise<PhotoDto | null> {
  return insertPhotoRecord(website, ownerUserId, {
    title: meta.title,
    artist: meta.artist,
    year: meta.year,
    filename: stored.filename,
    url: stored.url,
    thumbnailUrl: stored.url,
    adapterName: 'local-disk',
  })
}

type FloorplanLike = {
  placements?: Record<string, Record<string, string | string[] | undefined>>
  photoCatalog?: Array<{ id?: string; src?: string; title?: string; artist?: string; year?: string | number }>
}

export function stripPhotoFromFloorplan(floorplan: FloorplanLike, photoId: string): boolean {
  let changed = false
  const placements = floorplan.placements
  if (placements && typeof placements === 'object') {
    for (const cellKey of Object.keys(placements)) {
      const walls = placements[cellKey]
      if (!walls || typeof walls !== 'object') continue
      for (const wall of Object.keys(walls)) {
        const val = walls[wall]
        if (val === photoId) {
          delete walls[wall]
          changed = true
        } else if (Array.isArray(val)) {
          const next = val.filter((id) => id !== photoId)
          if (next.length !== val.length) {
            changed = true
            if (next.length === 0) delete walls[wall]
            else walls[wall] = next
          }
        }
      }
    }
  }
  if (Array.isArray(floorplan.photoCatalog)) {
    const before = floorplan.photoCatalog.length
    floorplan.photoCatalog = floorplan.photoCatalog.filter((p) => String(p.id) !== photoId)
    if (floorplan.photoCatalog.length !== before) changed = true
  }
  return changed
}

export async function stripPhotoFromAllOwnerGalleries(
  website: Website,
  ownerUserId: number,
  photoId: string
): Promise<number> {
  const db = drizzleOrNull(website)
  if (!db) return 0
  const rows = await db
    .select({ id: galleries.id, floorplanJson: galleries.floorplanJson })
    .from(galleries)
    .where(and(eq(galleries.ownerUserId, ownerUserId), isNull(galleries.deletedAt)))
  let updated = 0
  for (const row of rows) {
    if (!row.floorplanJson?.trim()) continue
    try {
      const floorplan = JSON.parse(row.floorplanJson) as FloorplanLike
      if (!stripPhotoFromFloorplan(floorplan, photoId)) continue
      await db
        .update(galleries)
        .set({ floorplanJson: JSON.stringify(floorplan) })
        .where(eq(galleries.id, row.id))
      updated += 1
    } catch {
      // skip invalid JSON
    }
  }
  return updated
}

export async function softDeletePhoto(
  website: Website,
  photoId: number,
  ownerUserId: number
): Promise<boolean> {
  const db = drizzleOrNull(website)
  if (!db) return false
  const result = await db
    .update(photos)
    .set({ deletedAt: sql`NOW()` })
    .where(and(eq(photos.id, photoId), eq(photos.ownerUserId, ownerUserId), isNull(photos.deletedAt)))
  const header = Array.isArray(result) ? result[0] : result
  const affected =
    header && typeof header === 'object' && 'affectedRows' in header
      ? Number((header as { affectedRows: number }).affectedRows)
      : 0
  if (affected === 0) return false
  await stripPhotoFromAllOwnerGalleries(website, ownerUserId, String(photoId))
  return true
}

export async function movePhotosToFolder(
  website: Website,
  ownerUserId: number,
  photoIds: number[],
  folderId: number | null
): Promise<number> {
  const db = drizzleOrNull(website)
  if (!db || photoIds.length === 0) return 0
  const unique = [...new Set(photoIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return 0

  if (folderId != null) {
    const folderRows = await db
      .select({ id: photoFolders.id })
      .from(photoFolders)
      .where(
        and(eq(photoFolders.id, folderId), eq(photoFolders.ownerUserId, ownerUserId), isNull(photoFolders.deletedAt))
      )
      .limit(1)
    if (!folderRows[0]) return 0
  }

  const result = await db
    .update(photos)
    .set({ folderId })
    .where(and(eq(photos.ownerUserId, ownerUserId), inArray(photos.id, unique), isNull(photos.deletedAt)))
  const header = Array.isArray(result) ? result[0] : result
  return header && typeof header === 'object' && 'affectedRows' in header
    ? Number((header as { affectedRows: number }).affectedRows)
    : 0
}

export async function updatePhotoMetadata(
  website: Website,
  ownerUserId: number,
  photoIds: number[],
  meta: { title?: string; artist?: string; year?: string }
): Promise<number> {
  const db = drizzleOrNull(website)
  if (!db || photoIds.length === 0) return 0
  const unique = [...new Set(photoIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return 0
  const patch: Record<string, string | null> = {}
  if (meta.title !== undefined) patch.title = meta.title.trim() || null
  if (meta.artist !== undefined) patch.artist = meta.artist.trim() || null
  if (meta.year !== undefined) patch.year = meta.year.trim() || null
  if (Object.keys(patch).length === 0) return 0
  const result = await db
    .update(photos)
    .set(patch)
    .where(
      and(eq(photos.ownerUserId, ownerUserId), inArray(photos.id, unique), isNull(photos.deletedAt))
    )
  const header = Array.isArray(result) ? result[0] : result
  return header && typeof header === 'object' && 'affectedRows' in header
    ? Number((header as { affectedRows: number }).affectedRows)
    : 0
}

export async function bulkSoftDeletePhotos(
  website: Website,
  ownerUserId: number,
  photoIds: number[]
): Promise<number> {
  let deleted = 0
  for (const id of photoIds) {
    if (await softDeletePhoto(website, id, ownerUserId)) deleted++
  }
  return deleted
}
