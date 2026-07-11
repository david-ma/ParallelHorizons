/**
 * Owner-scoped photo folder tree (D4).
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Website } from 'thalia/website'
import { photoFolders, photos } from '../models/gallery-schema.js'

export type FolderDto = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

function drizzleOrNull(website: Website) {
  return website.db?.drizzle ?? null
}

function rowToDto(row: {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}): FolderDto {
  return {
    id: String(row.id),
    name: row.name,
    parentId: row.parentId == null ? null : String(row.parentId),
    sortOrder: row.sortOrder,
  }
}

export async function listFoldersForOwner(website: Website, ownerUserId: number): Promise<FolderDto[]> {
  const db = drizzleOrNull(website)
  if (!db) return []
  const rows = await db
    .select({
      id: photoFolders.id,
      name: photoFolders.name,
      parentId: photoFolders.parentId,
      sortOrder: photoFolders.sortOrder,
    })
    .from(photoFolders)
    .where(and(eq(photoFolders.ownerUserId, ownerUserId), isNull(photoFolders.deletedAt)))
    .orderBy(asc(photoFolders.sortOrder), asc(photoFolders.name))
  return rows.map(rowToDto)
}

async function getFolderRow(website: Website, folderId: number, ownerUserId: number) {
  const db = drizzleOrNull(website)
  if (!db) return null
  const rows = await db
    .select({
      id: photoFolders.id,
      name: photoFolders.name,
      parentId: photoFolders.parentId,
      sortOrder: photoFolders.sortOrder,
    })
    .from(photoFolders)
    .where(
      and(
        eq(photoFolders.id, folderId),
        eq(photoFolders.ownerUserId, ownerUserId),
        isNull(photoFolders.deletedAt)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function createFolder(
  website: Website,
  ownerUserId: number,
  input: { name: string; parentId?: number | null }
): Promise<FolderDto | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const name = input.name.trim()
  if (!name) return null
  const parentId = input.parentId ?? null
  if (parentId != null) {
    const parent = await getFolderRow(website, parentId, ownerUserId)
    if (!parent) return null
  }
  const result = await db.insert(photoFolders).values({
    ownerUserId,
    parentId,
    name,
    sortOrder: 0,
  })
  const header = Array.isArray(result) ? result[0] : result
  const insertId =
    header && typeof header === 'object' && 'insertId' in header
      ? Number((header as { insertId: number | bigint }).insertId)
      : undefined
  if (insertId == null) return null
  const row = await getFolderRow(website, insertId, ownerUserId)
  return row ? rowToDto(row) : null
}

/** Returns false if target is self or a descendant of folderId. */
export function wouldCreateFolderCycle(
  folders: FolderDto[],
  folderId: string,
  newParentId: string | null
): boolean {
  if (newParentId == null || newParentId === folderId) return newParentId === folderId
  const byId = new Map(folders.map((f) => [f.id, f]))
  let cursor: string | null = newParentId
  while (cursor) {
    if (cursor === folderId) return true
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return false
}

export async function updateFolder(
  website: Website,
  ownerUserId: number,
  folderId: number,
  input: { name?: string; parentId?: number | null }
): Promise<FolderDto | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const existing = await getFolderRow(website, folderId, ownerUserId)
  if (!existing) return null

  const patch: { name?: string; parentId?: number | null } = {}
  if (typeof input.name === 'string') {
    const name = input.name.trim()
    if (!name) return null
    patch.name = name
  }
  if (input.parentId !== undefined) {
    const parentId = input.parentId
    if (parentId != null) {
      const parent = await getFolderRow(website, parentId, ownerUserId)
      if (!parent) return null
    }
    const all = await listFoldersForOwner(website, ownerUserId)
    if (wouldCreateFolderCycle(all, String(folderId), parentId == null ? null : String(parentId))) {
      return null
    }
    patch.parentId = parentId
  }

  if (Object.keys(patch).length === 0) return rowToDto(existing)

  await db.update(photoFolders).set(patch).where(eq(photoFolders.id, folderId))
  const row = await getFolderRow(website, folderId, ownerUserId)
  return row ? rowToDto(row) : null
}

export async function deleteFolder(website: Website, ownerUserId: number, folderId: number): Promise<boolean> {
  const db = drizzleOrNull(website)
  if (!db) return false
  const existing = await getFolderRow(website, folderId, ownerUserId)
  if (!existing) return false

  const children = await db
    .select({ id: photoFolders.id })
    .from(photoFolders)
    .where(
      and(
        eq(photoFolders.parentId, folderId),
        eq(photoFolders.ownerUserId, ownerUserId),
        isNull(photoFolders.deletedAt)
      )
    )
    .limit(1)
  if (children[0]) return false

  const result = await db
    .update(photoFolders)
    .set({ deletedAt: sql`NOW()` })
    .where(and(eq(photoFolders.id, folderId), eq(photoFolders.ownerUserId, ownerUserId)))
  const header = Array.isArray(result) ? result[0] : result
  const affected =
    header && typeof header === 'object' && 'affectedRows' in header
      ? Number((header as { affectedRows: number }).affectedRows)
      : 0
  if (affected === 0) return false

  await db
    .update(photos)
    .set({ folderId: null })
    .where(and(eq(photos.folderId, folderId), eq(photos.ownerUserId, ownerUserId)))
  return true
}
