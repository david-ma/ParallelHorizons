/**
 * Layout loading and scene building from floorplan JSON.
 */
import * as THREE from 'three'
import type { Gal } from './types.js'
import type { FloorplanBlob, FloorplanWallPlacements } from './types.js'
import { addFrameToArtwork, addPlacardToArtwork } from './artwork.js'
import { addGalleryCeiling, createFloorMaterial, createWallMaterial, resolveWallTextureStyle } from './materials.js'
import { addArtworkSpotlightRig, spotlightOptionsForArtwork } from './spotlight.js'
import { isValidFloorplan } from './floorplan.js'

export { isValidFloorplan } from './floorplan.js'

const DEFAULT_FLOORPLAN_URL = '/gallery-floorplan.json'
const CELL_WORLD = 6
const DEFAULT_GRID_ROWS = 5
const DEFAULT_GRID_COLS = 5
const DEFAULT_EYE_Y = 1.75

/** World XZ for a grid cell centre (matches buildSceneFromFloorplan). */
export function cellWorldCenter(
  row: number,
  col: number,
  rows = DEFAULT_GRID_ROWS,
  cols = DEFAULT_GRID_COLS
): { x: number; z: number } {
  return {
    x: (col - (cols - 1) / 2) * CELL_WORLD,
    z: (row - (rows - 1) / 2) * CELL_WORLD,
  }
}

/** Resolve spawn position from floorplan JSON. */
export function getSpawnPosition(
  data: FloorplanBlob | null | undefined,
  rows = DEFAULT_GRID_ROWS,
  cols = DEFAULT_GRID_COLS
): { x: number; y: number; z: number } {
  const y = typeof data?.spawn?.y === 'number' ? data.spawn.y : DEFAULT_EYE_Y
  if (typeof data?.spawn?.x === 'number' && typeof data?.spawn?.z === 'number') {
    return { x: data.spawn.x, y, z: data.spawn.z }
  }
  const cell = data?.spawn?.cell
  if (cell) {
    const [rRaw, cRaw] = cell.split(',')
    const r = Number(rRaw)
    const c = Number(cRaw)
    if (!Number.isNaN(r) && !Number.isNaN(c)) {
      const center = cellWorldCenter(r, c, rows, cols)
      return { x: center.x, y, z: center.z }
    }
  }
  return { x: 0, y: DEFAULT_EYE_Y, z: 0 }
}

/** Move camera (and past XZ) to floorplan spawn before physics init. */
export function applySpawnPosition(g: Gal, data: FloorplanBlob | null | undefined): void {
  const rows = Math.max(1, Number(data?.grid?.rows) || DEFAULT_GRID_ROWS)
  const cols = Math.max(1, Number(data?.grid?.cols) || DEFAULT_GRID_COLS)
  const pos = getSpawnPosition(data, rows, cols)
  g.camera.position.set(pos.x, pos.y, pos.z)
  g.pastX = pos.x
  g.pastZ = pos.z
}

function floorplanUrl(url?: string): string {
  const globalUrl = typeof globalThis !== 'undefined' ? (globalThis as { GALLERY_FLOORPLAN_URL?: string }).GALLERY_FLOORPLAN_URL : undefined
  return (typeof globalUrl === 'string' ? globalUrl : url) ?? DEFAULT_FLOORPLAN_URL
}

/** Returns true when parsed JSON has the minimum fields required to build a layout. */
export async function loadFloorplanAsync(url?: string): Promise<FloorplanBlob | null> {
  const u = floorplanUrl(url)
  try {
    const res = await fetch(u, { credentials: 'same-origin' })
    if (!res.ok) return null
    const parsed = (await res.json()) as unknown
    return isValidFloorplan(parsed) ? parsed : null
  } catch (_err) {
    return null
  }
}

function addFloor(
  g: Gal,
  rows: number,
  cols: number
): { floorWidth: number; floorDepth: number } {
  const floorWidth = cols * CELL_WORLD + 8
  const floorDepth = rows * CELL_WORLD + 8
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth, floorDepth),
    createFloorMaterial(cols * 2, rows * 2)
  )
  floor.rotation.x = Math.PI / 2
  floor.rotation.y = Math.PI
  g.scene.add(floor)
  addGalleryCeiling(g.scene, floorWidth, floorDepth)
  return { floorWidth, floorDepth }
}

function initGalleryBounds(g: Gal, floorWidth: number, floorDepth: number): void {
  g.wallGroup = new THREE.Group()
  g.scene.add(g.wallGroup)
  g.paintings = []
  g.num_of_paintings = 0
  g.minX = -floorWidth / 2 + 1.5
  g.maxX = floorWidth / 2 - 1.5
  g.minZ = -floorDepth / 2 + 1.5
  g.maxZ = floorDepth / 2 - 1.5
}

function addBaseLighting(g: Gal): void {
  g.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  g.scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 0.6))
}

/**
 * Empty walkable room: floor and lighting only. Used when floorplan JSON is missing or invalid.
 */
export function buildMinimalGallery(g: Gal, rows = DEFAULT_GRID_ROWS, cols = DEFAULT_GRID_COLS): void {
  addBaseLighting(g)
  const { floorWidth, floorDepth } = addFloor(g, rows, cols)
  initGalleryBounds(g, floorWidth, floorDepth)
}

/**
 * Builds scene (floor, walls, artworks, spotlights) from a floorplan blob and attaches to g.
 */
export function buildSceneFromFloorplan(g: Gal, data: FloorplanBlob): void {
  const rows = Math.max(1, Number(data.grid?.rows) || DEFAULT_GRID_ROWS)
  const cols = Math.max(1, Number(data.grid?.cols) || DEFAULT_GRID_COLS)
  const active = new Set((data.activeCells || []).map(String))
  const catalogById = new Map((data.photoCatalog || []).map((p) => [p.id, p]))

  addBaseLighting(g)
  const { floorWidth, floorDepth } = addFloor(g, rows, cols)
  initGalleryBounds(g, floorWidth, floorDepth)

  const wallMaterial = createWallMaterial(CELL_WORLD, 6, resolveWallTextureStyle(data))
  const addWall = (x: number, z: number, rotateY: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(CELL_WORLD, 6, 0.001), wallMaterial) as THREE.Mesh & {
      BBox?: THREE.Box3
    }
    wall.position.set(x, 3, z)
    wall.rotation.y = rotateY
    wall.BBox = new THREE.Box3().setFromObject(wall)
    g.wallGroup.add(wall)
  }
  const hasCell = (r: number, c: number) => active.has(`${r},${c}`)
  const cellCenter = (r: number, c: number) => cellWorldCenter(r, c, rows, cols)
  const placeOnWall = (wall: 'north' | 'south' | 'west' | 'east', cx: number, cz: number, offset: number) => {
    if (wall === 'north') return { x: cx + offset, y: 2, z: cz - CELL_WORLD / 2 + 0.06, ry: 0 }
    if (wall === 'south') return { x: cx - offset, y: 2, z: cz + CELL_WORLD / 2 - 0.06, ry: Math.PI }
    if (wall === 'west') return { x: cx - CELL_WORLD / 2 + 0.06, y: 2, z: cz - offset, ry: Math.PI / 2 }
    return { x: cx + CELL_WORLD / 2 - 0.06, y: 2, z: cz + offset, ry: -Math.PI / 2 }
  }

  active.forEach((key) => {
    const [rRaw, cRaw] = key.split(',')
    const r = Number(rRaw)
    const c = Number(cRaw)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    const center = cellCenter(r, c)
    if (!hasCell(r - 1, c)) addWall(center.x, center.z - CELL_WORLD / 2, 0)
    if (!hasCell(r + 1, c)) addWall(center.x, center.z + CELL_WORLD / 2, Math.PI)
    if (!hasCell(r, c - 1)) addWall(center.x - CELL_WORLD / 2, center.z, Math.PI / 2)
    if (!hasCell(r, c + 1)) addWall(center.x + CELL_WORLD / 2, center.z, -Math.PI / 2)

    const placements = data.placements?.[key]
    const normalized: FloorplanWallPlacements =
      typeof placements === 'string' ? { north: [placements] } : (placements as FloorplanWallPlacements) || {}

    ;(['north', 'east', 'south', 'west'] as const).forEach((wallName) => {
      const raw = normalized[wallName]
      const ids = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : []
      const step = Math.min(1.5, (CELL_WORLD - 1) / Math.max(1, ids.length + 1))
      const start = -((ids.length - 1) * step) / 2
      ids.forEach((photoId, idx) => {
        const entry = catalogById.get(photoId)
        const source = entry?.src || `/img/Artworks/${idx % 30}.jpg`
        const tex = new THREE.TextureLoader().load(source)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        const mat = new THREE.MeshLambertMaterial({ map: tex })
        const art = new THREE.Group()
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat)
        plane.position.z = 0.005
        art.add(plane)
        addFrameToArtwork(art, 1.2, 0.8)
        addPlacardToArtwork(art, 1.2, 0.8, {
          title: entry?.title,
          artist: entry?.artist,
          year: entry?.year,
        })
        const p = placeOnWall(wallName, center.x, center.z, start + idx * step)
        art.position.set(p.x, p.y, p.z)
        art.rotation.y = p.ry
        g.scene.add(art)
        g.paintings.push(art)
        g.num_of_paintings++

        addArtworkSpotlightRig(g.scene, spotlightOptionsForArtwork(art), art)
      })
    })
  })

  g.wallGroup.children.forEach((child) => {
    ;(child as THREE.Mesh & { BBox?: THREE.Box3 }).BBox = new THREE.Box3().setFromObject(child)
  })
}
