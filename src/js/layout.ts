/**
 * Layout loading and scene building from floorplan JSON.
 */
import * as THREE from 'three'
import type { Gal } from './types.js'
import type { FloorplanBlob, FloorplanWallPlacements } from './types.js'
import { addFrameToArtwork } from './artwork.js'

const DEFAULT_FLOORPLAN_URL = '/gallery-floorplan.json'

/**
 * Loads floorplan JSON from the given URL (sync XHR). Returns null on failure or invalid data.
 */
export function loadFloorplan(url?: string): FloorplanBlob | null {
  const globalUrl = typeof globalThis !== 'undefined' ? (globalThis as any).GALLERY_FLOORPLAN_URL : undefined
  const u: string = (typeof globalUrl === 'string' ? globalUrl : url) ?? DEFAULT_FLOORPLAN_URL
  try {
    const req = new XMLHttpRequest()
    req.open('GET', u, false)
    req.send(null)
    if (req.status >= 200 && req.status < 300) {
      const parsed = JSON.parse(req.responseText) as FloorplanBlob
      if (Array.isArray(parsed.activeCells) && parsed.placements) return parsed
    }
  } catch (_err) {
    // ignore
  }
  return null
}

/**
 * Builds scene (floor, walls, artworks) from a floorplan blob and attaches to g.
 */
export function buildSceneFromFloorplan(g: Gal, data: FloorplanBlob): void {
  const rows = Math.max(1, Number(data.grid?.rows) || 5)
  const cols = Math.max(1, Number(data.grid?.cols) || 5)
  const cellWorld = 6
  const active = new Set((data.activeCells || []).map(String))
  const photoById = new Map((data.photoCatalog || []).map((p) => [p.id, p.src]))

  g.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  g.scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 0.6))

  const floorText = new THREE.TextureLoader().load('/img/Textures/Floor.jpg')
  floorText.colorSpace = THREE.SRGBColorSpace
  floorText.wrapS = THREE.RepeatWrapping
  floorText.wrapT = THREE.RepeatWrapping
  floorText.repeat.set(cols * 2, rows * 2)
  const floorMaterial = new THREE.MeshPhongMaterial({ map: floorText })
  const floorWidth = cols * cellWorld + 8
  const floorDepth = rows * cellWorld + 8
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, floorDepth), floorMaterial)
  floor.rotation.x = Math.PI / 2
  floor.rotation.y = Math.PI
  g.scene.add(floor)

  g.wallGroup = new THREE.Group()
  g.scene.add(g.wallGroup)
  g.paintings = []
  g.num_of_paintings = 0
  g.minX = -floorWidth / 2 + 1.5
  g.maxX = floorWidth / 2 - 1.5
  g.minZ = -floorDepth / 2 + 1.5
  g.maxZ = floorDepth / 2 - 1.5

  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const addWall = (x: number, z: number, rotateY: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(cellWorld, 6, 0.001), wallMaterial) as THREE.Mesh & { BBox?: THREE.Box3 }
    wall.position.set(x, 3, z)
    wall.rotation.y = rotateY
    wall.BBox = new THREE.Box3().setFromObject(wall)
    g.wallGroup.add(wall)
  }
  const hasCell = (r: number, c: number) => active.has(`${r},${c}`)
  const cellCenter = (r: number, c: number) => ({
    x: (c - (cols - 1) / 2) * cellWorld,
    z: (r - (rows - 1) / 2) * cellWorld,
  })
  const placeOnWall = (wall: 'north' | 'south' | 'west' | 'east', cx: number, cz: number, offset: number) => {
    if (wall === 'north') return { x: cx + offset, y: 2, z: cz - cellWorld / 2 + 0.06, ry: 0 }
    if (wall === 'south') return { x: cx - offset, y: 2, z: cz + cellWorld / 2 - 0.06, ry: Math.PI }
    if (wall === 'west') return { x: cx - cellWorld / 2 + 0.06, y: 2, z: cz - offset, ry: Math.PI / 2 }
    return { x: cx + cellWorld / 2 - 0.06, y: 2, z: cz + offset, ry: -Math.PI / 2 }
  }

  active.forEach((key) => {
    const [rRaw, cRaw] = key.split(',')
    const r = Number(rRaw)
    const c = Number(cRaw)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    const center = cellCenter(r, c)
    if (!hasCell(r - 1, c)) addWall(center.x, center.z - cellWorld / 2, 0)
    if (!hasCell(r + 1, c)) addWall(center.x, center.z + cellWorld / 2, Math.PI)
    if (!hasCell(r, c - 1)) addWall(center.x - cellWorld / 2, center.z, Math.PI / 2)
    if (!hasCell(r, c + 1)) addWall(center.x + cellWorld / 2, center.z, -Math.PI / 2)

    const placements = data.placements?.[key]
    const normalized: FloorplanWallPlacements =
      typeof placements === 'string'
        ? { north: [placements] }
        : (placements as FloorplanWallPlacements) || {}

    ;(['north', 'east', 'south', 'west'] as const).forEach((wallName) => {
      const raw = normalized[wallName]
      const ids = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : []
      const step = Math.min(1.5, (cellWorld - 1) / Math.max(1, ids.length + 1))
      const start = -((ids.length - 1) * step) / 2
      ids.forEach((photoId, idx) => {
        const source = photoById.get(photoId) || `/img/Artworks/${idx % 30}.jpg`
        const tex = new THREE.TextureLoader().load(source)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        const mat = new THREE.MeshLambertMaterial({ map: tex })
        const art = new THREE.Group()
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat)
        plane.position.z = 0.005
        art.add(plane)
        addFrameToArtwork(art, 1.2, 0.8)
        const p = placeOnWall(wallName, center.x, center.z, start + idx * step)
        art.position.set(p.x, p.y, p.z)
        art.rotation.y = p.ry
        g.scene.add(art)
        g.paintings.push(art)
        g.num_of_paintings++
      })
    })
  })

  g.wallGroup.children.forEach((child) => {
    ;(child as THREE.Mesh & { BBox?: THREE.Box3 }).BBox = new THREE.Box3().setFromObject(child)
  })
}
