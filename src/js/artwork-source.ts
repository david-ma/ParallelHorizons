/**
 * Resolve floorplan artwork URLs for Three.js via Monetise /mirror/ (CORS-enabled passthrough).
 */

export function buildMirrorArtworkUrl(src: string, mirrorOrigin: string): string {
  const trimmed = src.trim()
  const base = mirrorOrigin.trim().replace(/\/$/, '')
  if (!trimmed || !base) return trimmed
  return `${base}/mirror/${trimmed}`
}

function readMirrorOrigin(): string {
  if (typeof globalThis === 'undefined') return ''
  const origin = (globalThis as { GALLERY_MIRROR_ORIGIN?: string }).GALLERY_MIRROR_ORIGIN
  return origin?.trim() ?? ''
}

export function artworkSourceUrl(
  entry: { id: string; src: string },
  pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
): string {
  const src = entry.src.trim()
  if (!src) return src
  if (src.startsWith('/')) return src
  try {
    const absolute = new URL(src, pageOrigin)
    if (absolute.origin === pageOrigin) return src
  } catch {
    return src
  }
  const mirrorOrigin = readMirrorOrigin()
  if (mirrorOrigin) return buildMirrorArtworkUrl(src, mirrorOrigin)
  return src
}
