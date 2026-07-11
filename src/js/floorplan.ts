/**
 * Shared floorplan validation and field parsing (editor, viewer, server, tests).
 */
import { WALL_TEXTURE_OPTIONS, type FloorplanBlob, type WallTextureStyle } from './types.js'

const VALID_WALL_STYLES = new Set(WALL_TEXTURE_OPTIONS.map((o) => o.value))

/** Minimum fields required to build a layout in the viewer. */
export function isValidFloorplan(data: unknown): data is FloorplanBlob {
  if (!data || typeof data !== 'object') return false
  const blob = data as FloorplanBlob
  return Array.isArray(blob.activeCells) && blob.placements != null && typeof blob.placements === 'object'
}

/** Parse gallery-wide wall style; unknown values fall back to plaster. */
export function parseWallStyle(value: unknown): WallTextureStyle {
  if (typeof value === 'string' && VALID_WALL_STYLES.has(value as WallTextureStyle)) {
    return value as WallTextureStyle
  }
  return 'plaster'
}
