/**
 * DB access for owner galleries (D1).
 */
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Website } from 'thalia/website'
import { galleries } from '../models/gallery-schema.js'
import { loadGalleryManifest, type GalleryEntry } from './galleries.js'

export type DbGalleryRow = {
  id: number
  slug: string
  ownerUserId: number
  title: string
  description: string | null
  floorplanJson: string | null
  isPublished: boolean
}

function drizzleOrNull(website: Website) {
  return website.db?.drizzle ?? null
}

export function staticGallerySlugs(rootPath: string): Set<string> {
  return new Set(loadGalleryManifest(rootPath).map((g) => g.slug))
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'gallery'
}

export async function slugTaken(website: Website, slug: string, exceptId?: number): Promise<boolean> {
  if (staticGallerySlugs(website.rootPath).has(slug)) return true
  const db = drizzleOrNull(website)
  if (!db) return false
  const rows = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt)))
    .limit(1)
  if (rows.length === 0) return false
  if (exceptId != null && rows[0]?.id === exceptId) return false
  return true
}

export async function makeUniqueSlug(website: Website, title: string, exceptId?: number): Promise<string> {
  const base = slugifyTitle(title)
  let candidate = base
  let n = 0
  while (await slugTaken(website, candidate, exceptId)) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

export async function listGalleriesForOwner(website: Website, ownerUserId: number): Promise<DbGalleryRow[]> {
  const db = drizzleOrNull(website)
  if (!db) return []
  return db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      ownerUserId: galleries.ownerUserId,
      title: galleries.title,
      description: galleries.description,
      floorplanJson: galleries.floorplanJson,
      isPublished: galleries.isPublished,
    })
    .from(galleries)
    .where(and(eq(galleries.ownerUserId, ownerUserId), isNull(galleries.deletedAt)))
    .orderBy(desc(galleries.updatedAt))
}

export async function listPublishedDbGalleries(website: Website): Promise<GalleryEntry[]> {
  const db = drizzleOrNull(website)
  if (!db) return []
  const rows = await db
    .select({
      slug: galleries.slug,
      title: galleries.title,
      description: galleries.description,
    })
    .from(galleries)
    .where(and(eq(galleries.isPublished, true), isNull(galleries.deletedAt)))
    .orderBy(desc(galleries.updatedAt))
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description?.trim() || 'A virtual 3D gallery.',
    floorplanPath: `/api/floorplan/${row.slug}`,
  }))
}

export async function getGalleryById(website: Website, id: number): Promise<DbGalleryRow | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const rows = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      ownerUserId: galleries.ownerUserId,
      title: galleries.title,
      description: galleries.description,
      floorplanJson: galleries.floorplanJson,
      isPublished: galleries.isPublished,
    })
    .from(galleries)
    .where(and(eq(galleries.id, id), isNull(galleries.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function getGalleryBySlug(website: Website, slug: string): Promise<DbGalleryRow | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const rows = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      ownerUserId: galleries.ownerUserId,
      title: galleries.title,
      description: galleries.description,
      floorplanJson: galleries.floorplanJson,
      isPublished: galleries.isPublished,
    })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function createGallery(
  website: Website,
  ownerUserId: number,
  title = 'Untitled gallery'
): Promise<DbGalleryRow | null> {
  const db = drizzleOrNull(website)
  if (!db) return null
  const slug = await makeUniqueSlug(website, title)
  const result = await db.insert(galleries).values({
    slug,
    ownerUserId,
    title,
    description: null,
    floorplanJson: null,
    isPublished: false,
  })
  const header = Array.isArray(result) ? result[0] : result
  const insertId =
    header && typeof header === 'object' && 'insertId' in header
      ? Number((header as { insertId: number | bigint }).insertId)
      : undefined
  if (!insertId) return null
  return getGalleryById(website, insertId)
}

export async function saveFloorplanJson(
  website: Website,
  id: number,
  ownerUserId: number,
  floorplan: Record<string, unknown>
): Promise<boolean> {
  const db = drizzleOrNull(website)
  if (!db) return false
  const json = JSON.stringify(floorplan)
  const result = await db
    .update(galleries)
    .set({ floorplanJson: json })
    .where(and(eq(galleries.id, id), eq(galleries.ownerUserId, ownerUserId), isNull(galleries.deletedAt)))
  const header = Array.isArray(result) ? result[0] : result
  const affected =
    header && typeof header === 'object' && 'affectedRows' in header
      ? Number((header as { affectedRows: number }).affectedRows)
      : 0
  return affected > 0
}

export async function setGalleryPublished(
  website: Website,
  id: number,
  ownerUserId: number,
  isPublished: boolean
): Promise<boolean> {
  const db = drizzleOrNull(website)
  if (!db) return false
  const result = await db
    .update(galleries)
    .set({ isPublished })
    .where(and(eq(galleries.id, id), eq(galleries.ownerUserId, ownerUserId), isNull(galleries.deletedAt)))
  const header = Array.isArray(result) ? result[0] : result
  const affected =
    header && typeof header === 'object' && 'affectedRows' in header
      ? Number((header as { affectedRows: number }).affectedRows)
      : 0
  return affected > 0
}

export function canViewDbGallery(
  row: DbGalleryRow,
  viewerUserId: number | undefined
): boolean {
  if (row.isPublished) return true
  return viewerUserId != null && viewerUserId === row.ownerUserId
}

export function parseFloorplanJson(row: DbGalleryRow): Record<string, unknown> | null {
  if (!row.floorplanJson?.trim()) return null
  try {
    return JSON.parse(row.floorplanJson) as Record<string, unknown>
  } catch {
    return null
  }
}
