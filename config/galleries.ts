/**
 * Static gallery registry — floorplan JSON files under public/galleries/.
 */
import fs from 'fs'
import path from 'path'

export type GalleryEntry = {
  slug: string
  title: string
  description: string
  floorplanPath: string
  default?: boolean
  credit?: string
}

type Manifest = { galleries: GalleryEntry[] }

export function loadGalleryManifest(rootPath: string): GalleryEntry[] {
  const manifestPath = path.join(rootPath, 'public/galleries/manifest.json')
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest
    return Array.isArray(raw.galleries) ? raw.galleries : []
  } catch {
    return []
  }
}

export function defaultGallerySlug(galleries: GalleryEntry[]): string | null {
  return galleries.find((g) => g.default)?.slug ?? galleries[0]?.slug ?? null
}

/** Resolve gallery by slug; falls back to default entry. */
export function resolveGallery(rootPath: string, slug?: string | null): GalleryEntry | null {
  const galleries = loadGalleryManifest(rootPath)
  if (galleries.length === 0) return null
  const key = slug?.trim() || defaultGallerySlug(galleries)
  if (!key) return null
  return galleries.find((g) => g.slug === key) ?? null
}

export function floorplanFilePath(rootPath: string, entry: GalleryEntry): string {
  const rel = entry.floorplanPath.replace(/^\//, '')
  return path.join(rootPath, 'public', rel)
}

export function galleryFloorplanExists(rootPath: string, entry: GalleryEntry): boolean {
  return fs.existsSync(floorplanFilePath(rootPath, entry))
}
