/**
 * Gallery surface materials: procedural wall/ceiling textures and floor helper.
 */
import * as THREE from 'three'
import type { FloorplanBlob, WallTextureStyle } from './types.js'

const TEX_SIZE = 512
const CEILING_TILE_PX = 64

const WALL_TEXTURE_STYLES: WallTextureStyle[] = ['plaster', 'linen', 'concrete', 'silk']

const wallTextureCache = new Map<WallTextureStyle, THREE.CanvasTexture>()
let ceilingTextureSource: THREE.CanvasTexture | null = null

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function hashNoise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const a = hashNoise(ix, iy)
  const b = hashNoise(ix + 1, iy)
  const c = hashNoise(ix, iy + 1)
  const d = hashNoise(ix + 1, iy + 1)
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  return a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uy
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function setPixel(image: ImageData, x: number, y: number, r: number, g: number, b: number): void {
  const i = (y * TEX_SIZE + x) * 4
  image.data[i] = clamp255(r)
  image.data[i + 1] = clamp255(g)
  image.data[i + 2] = clamp255(b)
  image.data[i + 3] = 255
}

function canvasTextureFromImage(image: ImageData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(image, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Warm off-white with roller lap marks — original gallery finish. */
function buildPlasterWallTexture(): THREE.CanvasTexture {
  const image = new ImageData(TEX_SIZE, TEX_SIZE)
  const [br, bg, bb] = parseHex('#f2f0eb')

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const n = hashNoise(x, y)
      const grain = (n - 0.5) * 14
      const roller = Math.sin((y / TEX_SIZE) * Math.PI * 24) * 2.5
      setPixel(image, x, y, br + grain + roller, bg + grain + roller, bb + grain + roller)
    }
  }
  return canvasTextureFromImage(image)
}

/** Fine basket-weave linen — common neutral gallery wrap. */
function buildLinenWallTexture(): THREE.CanvasTexture {
  const image = new ImageData(TEX_SIZE, TEX_SIZE)
  const [br, bg, bb] = parseHex('#ebe8e0')
  const thread = 6

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const warp = Math.sin((x / thread) * Math.PI) * 0.5 + 0.5
      const weft = Math.sin((y / thread) * Math.PI) * 0.5 + 0.5
      const basket = ((Math.floor(x / thread) + Math.floor(y / thread)) % 2 === 0 ? warp : weft) * 10 - 5
      const fiber = (hashNoise(x * 1.7, y * 1.7) - 0.5) * 8
      const soft = (smoothNoise(x / 48, y / 48) - 0.5) * 6
      setPixel(image, x, y, br + basket + fiber + soft, bg + basket + fiber + soft, bb + basket + fiber + soft - 1)
    }
  }
  return canvasTextureFromImage(image)
}

/** Cool micro-cement with aggregate specks and trowel mottling. */
function buildConcreteWallTexture(): THREE.CanvasTexture {
  const image = new ImageData(TEX_SIZE, TEX_SIZE)
  const [br, bg, bb] = parseHex('#d4d2cf')

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const fine = (hashNoise(x, y) - 0.5) * 18
      const blot = (smoothNoise(x / 12, y / 12) - 0.5) * 16
      const trowel = Math.sin((x / TEX_SIZE) * Math.PI * 22 + smoothNoise(x / 32, y / 32) * 2) * 2.5
      let r = br + fine + blot + trowel
      let g = bg + fine + blot + trowel
      let b = bb + fine + blot + trowel
      if (hashNoise(x + 91, y + 47) > 0.988) {
        const speck = -18 - hashNoise(x, y) * 20
        r += speck
        g += speck
        b += speck - 2
      }
      setPixel(image, x, y, r, g, b)
    }
  }
  return canvasTextureFromImage(image)
}

/** Soft vertical brush bands — satin lime-wash / silk finish. */
function buildSilkWallTexture(): THREE.CanvasTexture {
  const image = new ImageData(TEX_SIZE, TEX_SIZE)
  const [br, bg, bb] = parseHex('#f5f3ef')

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const band = Math.sin((x / TEX_SIZE) * Math.PI * 18 + smoothNoise(x / 80, y / 80) * 0.6) * 4
      const sheen = Math.sin((y / TEX_SIZE) * Math.PI * 3) * 1.2
      const grain = (hashNoise(x, y) - 0.5) * 5
      const wash = (smoothNoise(x / 36, y / 36) - 0.5) * 4
      setPixel(image, x, y, br + band + sheen + grain + wash, bg + band + sheen + grain + wash, bb + band + sheen + grain + wash - 1)
    }
  }
  return canvasTextureFromImage(image)
}

function buildWallTexture(style: WallTextureStyle): THREE.CanvasTexture {
  switch (style) {
    case 'linen':
      return buildLinenWallTexture()
    case 'concrete':
      return buildConcreteWallTexture()
    case 'silk':
      return buildSilkWallTexture()
    default:
      return buildPlasterWallTexture()
  }
}

function buildCeilingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const tiles = TEX_SIZE / CEILING_TILE_PX

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x = tx * CEILING_TILE_PX
      const y = ty * CEILING_TILE_PX
      const n = hashNoise(tx + 17, ty + 31)
      const shade = 248 + Math.floor((n - 0.5) * 10)
      ctx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade - 1})`
      ctx.fillRect(x + 1, y + 1, CEILING_TILE_PX - 2, CEILING_TILE_PX - 2)

      const speckles = 3 + Math.floor(n * 4)
      for (let s = 0; s < speckles; s++) {
        const sx = x + 4 + Math.floor(hashNoise(tx, ty + s * 3) * (CEILING_TILE_PX - 8))
        const sy = y + 4 + Math.floor(hashNoise(ty, tx + s * 5) * (CEILING_TILE_PX - 8))
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + hashNoise(sx, sy) * 0.12})`
        ctx.fillRect(sx, sy, 1, 1)
      }
    }
  }

  ctx.strokeStyle = 'rgba(180, 178, 172, 0.55)'
  ctx.lineWidth = 1
  for (let i = 0; i <= tiles; i++) {
    const p = i * CEILING_TILE_PX + 0.5
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, TEX_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(TEX_SIZE, p)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

function wallTexture(style: WallTextureStyle): THREE.CanvasTexture {
  let tex = wallTextureCache.get(style)
  if (!tex) {
    tex = buildWallTexture(style)
    wallTextureCache.set(style, tex)
  }
  return tex
}

function ceilingTexture(): THREE.CanvasTexture {
  if (!ceilingTextureSource) ceilingTextureSource = buildCeilingTexture()
  return ceilingTextureSource
}

function tiledMap(source: THREE.CanvasTexture, repeatU: number, repeatV: number): THREE.CanvasTexture {
  const map = source.clone()
  map.repeat.set(repeatU, repeatV)
  map.needsUpdate = true
  return map
}

function isWallTextureStyle(value: string): value is WallTextureStyle {
  return (WALL_TEXTURE_STYLES as string[]).includes(value)
}

/** Resolve style from floorplan field, then `?wallStyle=` query param, else plaster. */
export function resolveWallTextureStyle(floorplan?: FloorplanBlob | null): WallTextureStyle {
  const fromPlan = floorplan?.wallStyle
  if (typeof fromPlan === 'string' && isWallTextureStyle(fromPlan)) return fromPlan

  if (typeof window !== 'undefined') {
    const fromQuery = new URLSearchParams(window.location.search).get('wallStyle')
    if (fromQuery && isWallTextureStyle(fromQuery)) return fromQuery
  }

  return 'plaster'
}

/** World-space metres covered by one texture repeat (~3 m for paint finishes; tighter for concrete). */
function wallTextureMetersPerRepeat(style: WallTextureStyle): number {
  return style === 'concrete' ? 0.65 : 3
}

/** Tile texture to wall dimensions using style-specific world scale. */
export function createWallMaterial(width: number, height = 6, style: WallTextureStyle = 'plaster'): THREE.MeshLambertMaterial {
  const metres = wallTextureMetersPerRepeat(style)
  return new THREE.MeshLambertMaterial({
    map: tiledMap(wallTexture(style), width / metres, height / metres),
  })
}

export function createCeilingMaterial(width: number, depth: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    map: tiledMap(ceilingTexture(), width / 3, depth / 3),
  })
}

export function createFloorMaterial(repeatU: number, repeatV: number): THREE.MeshPhongMaterial {
  const floorText = new THREE.TextureLoader().load('/img/Textures/Floor.jpg')
  floorText.colorSpace = THREE.SRGBColorSpace
  floorText.wrapS = THREE.RepeatWrapping
  floorText.wrapT = THREE.RepeatWrapping
  floorText.repeat.set(repeatU, repeatV)
  return new THREE.MeshPhongMaterial({ map: floorText })
}

export function addGalleryCeiling(
  scene: THREE.Scene,
  width: number,
  depth: number,
  height = 6
): THREE.Mesh {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), createCeilingMaterial(width, depth))
  ceil.position.y = height
  ceil.rotation.x = Math.PI / 2
  scene.add(ceil)
  return ceil
}
