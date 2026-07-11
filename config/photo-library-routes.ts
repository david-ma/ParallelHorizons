/**
 * D4 library API — folders, photo filters, bulk actions.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import type { Website } from 'thalia/website'
import { readLimitedJsonObject } from 'thalia/controllers'
import {
  bulkSoftDeletePhotos,
  listPhotosForOwner,
  movePhotosToFolder,
  updatePhotoMetadata,
  type PhotoListOptions,
} from './photo-store.js'
import {
  createFolder,
  deleteFolder,
  listFoldersForOwner,
  updateFolder,
} from './folder-store.js'

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function parsePhotoIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => Number(v))
    .filter((id) => Number.isFinite(id) && id > 0)
}

export function parsePhotoListOptions(query: Record<string, string>): PhotoListOptions {
  const options: PhotoListOptions = {}
  const folderRaw = query.folderId ?? query.folder
  if (folderRaw === 'root') options.folderId = 'root'
  else if (folderRaw && folderRaw !== 'all') {
    const id = Number(folderRaw)
    if (Number.isFinite(id) && id > 0) options.folderId = id
  }
  if (query.q?.trim()) options.q = query.q.trim()
  if (query.unplaced === '1' || query.unplaced === 'true') options.unplaced = true
  return options
}

export async function handleListPhotosApi(
  res: ServerResponse,
  website: Website,
  ownerUserId: number,
  query: Record<string, string>
): Promise<void> {
  const photos = await listPhotosForOwner(website, ownerUserId, parsePhotoListOptions(query))
  json(res, 200, { ok: true, photos })
}

export async function handleListFoldersApi(
  res: ServerResponse,
  website: Website,
  ownerUserId: number
): Promise<void> {
  const folders = await listFoldersForOwner(website, ownerUserId)
  json(res, 200, { ok: true, folders })
}

export async function handleFolderCreate(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  const body = await readLimitedJsonObject(req)
  const name = typeof body.name === 'string' ? body.name : ''
  const parentRaw = body.parentId
  const parentId =
    parentRaw == null || parentRaw === ''
      ? null
      : Number(parentRaw)
  const folder = await createFolder(website, ownerUserId, {
    name,
    parentId: parentId != null && Number.isFinite(parentId) && parentId > 0 ? parentId : null,
  })
  if (!folder) {
    json(res, 400, { ok: false, error: 'Could not create folder' })
    return
  }
  json(res, 200, { ok: true, folder })
}

export async function handleFolderUpdate(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number,
  folderIdRaw: string | undefined
): Promise<void> {
  const folderId = Number(folderIdRaw)
  if (!Number.isFinite(folderId) || folderId <= 0) {
    json(res, 400, { ok: false, error: 'Invalid folder id' })
    return
  }
  const body = await readLimitedJsonObject(req)
  const input: { name?: string; parentId?: number | null } = {}
  if (typeof body.name === 'string') input.name = body.name
  if (body.parentId === null || body.parentId === '') input.parentId = null
  else if (body.parentId != null) {
    const pid = Number(body.parentId)
    if (Number.isFinite(pid) && pid > 0) input.parentId = pid
  }
  const folder = await updateFolder(website, ownerUserId, folderId, input)
  if (!folder) {
    json(res, 400, { ok: false, error: 'Could not update folder' })
    return
  }
  json(res, 200, { ok: true, folder })
}

export async function handleFolderDelete(
  res: ServerResponse,
  website: Website,
  ownerUserId: number,
  folderIdRaw: string | undefined
): Promise<void> {
  const folderId = Number(folderIdRaw)
  if (!Number.isFinite(folderId) || folderId <= 0) {
    json(res, 400, { ok: false, error: 'Invalid folder id' })
    return
  }
  const ok = await deleteFolder(website, ownerUserId, folderId)
  if (!ok) {
    json(res, 400, { ok: false, error: 'Folder not found or has subfolders' })
    return
  }
  json(res, 200, { ok: true })
}

export async function handlePhotosBulk(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
  ownerUserId: number
): Promise<void> {
  const body = await readLimitedJsonObject(req)
  const action = typeof body.action === 'string' ? body.action : ''
  const photoIds = parsePhotoIds(body.photoIds)
  if (photoIds.length === 0) {
    json(res, 400, { ok: false, error: 'photoIds required' })
    return
  }

  if (action === 'move') {
    let folderId: number | null = null
    if (body.folderId === null || body.folderId === '' || body.folderId === 'root') {
      folderId = null
    } else if (body.folderId != null) {
      const id = Number(body.folderId)
      if (!Number.isFinite(id) || id <= 0) {
        json(res, 400, { ok: false, error: 'Invalid folderId' })
        return
      }
      folderId = id
    }
    const moved = await movePhotosToFolder(website, ownerUserId, photoIds, folderId)
    json(res, 200, { ok: true, moved })
    return
  }

  if (action === 'delete') {
    const deleted = await bulkSoftDeletePhotos(website, ownerUserId, photoIds)
    json(res, 200, { ok: true, deleted })
    return
  }

  if (action === 'update') {
    const meta: { title?: string; artist?: string; year?: string } = {}
    if (typeof body.title === 'string') meta.title = body.title
    if (typeof body.artist === 'string') meta.artist = body.artist
    if (typeof body.year === 'string') meta.year = body.year
    const updated = await updatePhotoMetadata(website, ownerUserId, photoIds, meta)
    json(res, 200, { ok: true, updated })
    return
  }

  json(res, 400, { ok: false, error: 'Unknown action' })
}
