/**
 * SmugMug CDN URL helpers for gallery photo display.
 * Upload ack `Image.URL` is often a gallery page, not a direct image file.
 */

export function isDirectImageUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u)) return true
  return u.includes('photos.smugmug.com/photos/')
}

/** Derive a large display URL from a SmugMug thumbnail CDN URL. */
export function smugMugLargeUrlFromThumbnail(thumbUrl: string): string {
  const t = thumbUrl.trim()
  if (!t) return ''
  if (t.includes('/Th/')) {
    return t.replace('/Th/', '/L/').replace(/-Th(\.(?:jpe?g|png|gif|webp))$/i, '-L$1')
  }
  return t
}

export function resolveSmugMugPhotoUrls(
  albumImage: Record<string, unknown>,
  ackPageUrl: string
): { url: string; thumbnailUrl: string } {
  const thumb =
    (typeof albumImage.ThumbnailUrl === 'string' && albumImage.ThumbnailUrl.trim()) || ''
  const thumbnailUrl = thumb || (isDirectImageUrl(ackPageUrl) ? ackPageUrl : '')
  const url =
    smugMugLargeUrlFromThumbnail(thumbnailUrl) ||
    thumbnailUrl ||
    (isDirectImageUrl(ackPageUrl) ? ackPageUrl : '')
  return { url, thumbnailUrl: thumbnailUrl || url }
}

export function resolvePhotoDisplaySrc(url: string, thumbnailUrl: string | null | undefined): string {
  const raw = url.trim()
  const thumb = thumbnailUrl?.trim() || ''
  if (isDirectImageUrl(raw)) return raw
  if (thumb) return smugMugLargeUrlFromThumbnail(thumb) || thumb
  return raw
}
