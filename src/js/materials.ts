/**
 * Gallery surface materials: procedural wall/ceiling textures and floor helper.
 */
import * as THREE from 'three'

const TEX_SIZE = 512
const CEILING_TILE_PX = 64

let wallTextureSource: THREE.CanvasTexture | null = null
let ceilingTextureSource: THREE.CanvasTexture | null = null

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function hashNoise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function buildWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const [br, bg, bb] = parseHex('#f2f0eb')

  const image = ctx.createImageData(TEX_SIZE, TEX_SIZE)
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const i = (y * TEX_SIZE + x) * 4
      const n = hashNoise(x, y)
      const grain = (n - 0.5) * 14
      const roller = Math.sin((y / TEX_SIZE) * Math.PI * 24) * 2.5
      image.data[i] = clamp255(br + grain + roller)
      image.data[i + 1] = clamp255(bg + grain + roller)
      image.data[i + 2] = clamp255(bb + grain + roller)
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
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

function wallTexture(): THREE.CanvasTexture {
  if (!wallTextureSource) wallTextureSource = buildWallTexture()
  return wallTextureSource
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

/** ~3 m per texture repeat along each axis. */
export function createWallMaterial(width: number, height = 6): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    map: tiledMap(wallTexture(), width / 3, height / 3),
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
