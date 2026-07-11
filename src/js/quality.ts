/**
 * Browser-aware quality tiers — Safari WebGL is much slower on dynamic Lambert + spots.
 */

/** True for desktop/iOS Safari (not Chrome, Edge, Firefox, etc.). */
export function isSafariUserAgent(userAgent: string): boolean {
  return /Safari/i.test(userAgent) && !/Chrom|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent)
}

export function isSafariBrowser(): boolean {
  return typeof navigator !== 'undefined' && isSafariUserAgent(navigator.userAgent)
}

/** Spotlight cap when many rigs (Safari defaults lower). */
export const SAFARI_SPOTLIGHT_CAP = 4

/** DPR caps on Safari. */
export const SAFARI_DPR_CAP_HEAVY = 1
export const SAFARI_DPR_CAP_LIGHT = 1.25

export function resolveSpotlightCap(rigCount: number, safari = isSafariBrowser()): number {
  if (rigCount <= 0) return 0
  if (rigCount <= 8) return rigCount
  if (safari) return Math.min(SAFARI_SPOTLIGHT_CAP, rigCount)
  return 8
}

export function resolvePixelRatioCap(paintingCount: number, search = '', safari = isSafariBrowser()): number {
  const q = new URLSearchParams(search).get('quality')
  if (q === 'low') return 1
  if (q === 'high') return 2
  if (safari) return paintingCount >= 10 ? SAFARI_DPR_CAP_HEAVY : SAFARI_DPR_CAP_LIGHT
  return paintingCount >= 20 ? 1.25 : 2
}

export function clientBrowserLabel(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  if (isSafariBrowser()) return 'safari'
  const ua = navigator.userAgent
  if (/Chrom|CriOS|Edg/i.test(ua)) return 'chrome'
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox'
  return 'other'
}

export function preferNoAntialias(safari = isSafariBrowser()): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('quality') === 'high') {
    return false
  }
  return safari
}
