/**
 * Dev-only top-down minimap: floorplan, paintings, player, active spotlights.
 */
import * as THREE from 'three'
import type { Gal } from './types.js'
import { cellWorldCenter, FLOORPLAN_CELL_WORLD } from './layout.js'
import { getSpotlightCullDebug } from './spotlight.js'

const SIZE = 220
const PAD = 14

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let legendEl: HTMLElement | null = null

function isDevToolsEnabled(): boolean {
  return !!(globalThis as { GALLERY_DEV_TOOLS?: boolean }).GALLERY_DEV_TOOLS
}

function worldToMap(
  x: number,
  z: number,
  minX: number,
  minZ: number,
  span: number
): { px: number; py: number } {
  const inner = SIZE - PAD * 2
  return {
    px: PAD + ((x - minX) / span) * inner,
    py: PAD + ((z - minZ) / span) * inner,
  }
}

function drawWallSegments(g: Gal, minX: number, minZ: number, span: number): void {
  const draw = ctx
  if (!draw) return
  const fp = g.floorplan
  const rows = g.floorplanRows ?? 5
  const cols = g.floorplanCols ?? 5
  const active = new Set((fp?.activeCells || []).map(String))
  if (active.size === 0) return

  const half = FLOORPLAN_CELL_WORLD / 2
  const hasCell = (r: number, col: number) => active.has(`${r},${col}`)

  draw.strokeStyle = 'rgba(255,255,255,0.55)'
  draw.lineWidth = 2
  draw.beginPath()

  active.forEach((key) => {
    const [rRaw, cRaw] = key.split(',')
    const r = Number(rRaw)
    const col = Number(cRaw)
    if (Number.isNaN(r) || Number.isNaN(col)) return
    const { x: cx, z: cz } = cellWorldCenter(r, col, rows, cols)
    const west = cx - half
    const east = cx + half
    const north = cz - half
    const south = cz + half

    if (!hasCell(r - 1, col)) {
      const a = worldToMap(west, north, minX, minZ, span)
      const b = worldToMap(east, north, minX, minZ, span)
      draw.moveTo(a.px, a.py)
      draw.lineTo(b.px, b.py)
    }
    if (!hasCell(r + 1, col)) {
      const a = worldToMap(west, south, minX, minZ, span)
      const b = worldToMap(east, south, minX, minZ, span)
      draw.moveTo(a.px, a.py)
      draw.lineTo(b.px, b.py)
    }
    if (!hasCell(r, col - 1)) {
      const a = worldToMap(west, north, minX, minZ, span)
      const b = worldToMap(west, south, minX, minZ, span)
      draw.moveTo(a.px, a.py)
      draw.lineTo(b.px, b.py)
    }
    if (!hasCell(r, col + 1)) {
      const a = worldToMap(east, north, minX, minZ, span)
      const b = worldToMap(east, south, minX, minZ, span)
      draw.moveTo(a.px, a.py)
      draw.lineTo(b.px, b.py)
    }
  })
  draw.stroke()
}

function drawActiveCells(g: Gal, minX: number, minZ: number, span: number): void {
  const draw = ctx
  if (!draw) return
  const fp = g.floorplan
  const rows = g.floorplanRows ?? 5
  const cols = g.floorplanCols ?? 5
  const active = fp?.activeCells || []
  const half = FLOORPLAN_CELL_WORLD / 2

  draw.fillStyle = 'rgba(80, 80, 90, 0.45)'
  for (const key of active) {
    const [rRaw, cRaw] = key.split(',')
    const r = Number(rRaw)
    const col = Number(cRaw)
    if (Number.isNaN(r) || Number.isNaN(col)) continue
    const { x: cx, z: cz } = cellWorldCenter(r, col, rows, cols)
    const tl = worldToMap(cx - half, cz - half, minX, minZ, span)
    const br = worldToMap(cx + half, cz + half, minX, minZ, span)
    draw.fillRect(tl.px, tl.py, br.px - tl.px, br.py - tl.py)
  }
}

export function initDevMinimap(): void {
  if (!isDevToolsEnabled()) return
  canvas = document.getElementById('gallery-minimap') as HTMLCanvasElement | null
  legendEl = document.getElementById('gallery-minimap-legend')
  if (!canvas) return
  ctx = canvas.getContext('2d')
  canvas.width = SIZE
  canvas.height = SIZE
}

export function updateDevMinimap(g: Gal): void {
  const draw = ctx
  if (!isDevToolsEnabled() || !draw || !canvas) return

  const minX = g.minX - 2
  const maxX = g.maxX + 2
  const minZ = g.minZ - 2
  const maxZ = g.maxZ + 2
  const span = Math.max(maxX - minX, maxZ - minZ, 1)

  draw.fillStyle = 'rgba(18, 18, 20, 0.92)'
  draw.fillRect(0, 0, SIZE, SIZE)

  drawActiveCells(g, minX, minZ, span)
  drawWallSegments(g, minX, minZ, span)

  const cam = g.camera
  const { px: cpx, py: cpz } = worldToMap(cam.position.x, cam.position.z, minX, minZ, span)
  const fwd = new THREE.Vector3()
  cam.getWorldDirection(fwd)
  const viewAngle = Math.atan2(fwd.x, fwd.z)
  const fovRad = ((cam.fov * Math.PI) / 180) * 0.85
  const viewLen = 22
  draw.beginPath()
  draw.moveTo(cpx, cpz)
  draw.lineTo(cpx + Math.sin(viewAngle - fovRad) * viewLen, cpz + Math.cos(viewAngle - fovRad) * viewLen)
  draw.lineTo(cpx + Math.sin(viewAngle + fovRad) * viewLen, cpz + Math.cos(viewAngle + fovRad) * viewLen)
  draw.closePath()
  draw.fillStyle = 'rgba(100, 210, 255, 0.08)'
  draw.fill()
  draw.strokeStyle = 'rgba(100, 210, 255, 0.35)'
  draw.lineWidth = 1
  draw.stroke()

  const cull = getSpotlightCullDebug()
  let activeCount = 0
  for (const entry of cull) {
    const { px, py } = worldToMap(entry.x, entry.z, minX, minZ, span)
    let fill = '#48484a'
    if (entry.active && entry.inView) fill = '#ffd60a'
    else if (entry.inView) fill = '#8e8e93'
    draw.beginPath()
    draw.arc(px, py, entry.active ? 4 : 3, 0, Math.PI * 2)
    draw.fillStyle = fill
    draw.fill()
    if (entry.inView && !entry.active) {
      draw.strokeStyle = 'rgba(100, 210, 255, 0.6)'
      draw.lineWidth = 1
      draw.stroke()
    }
    if (entry.active) activeCount++
  }

  const angle = viewAngle
  const tip = 7
  const wing = 4

  draw.fillStyle = '#64d2ff'
  draw.beginPath()
  draw.moveTo(cpx + Math.sin(angle) * tip, cpz + Math.cos(angle) * tip)
  draw.lineTo(cpx + Math.sin(angle + 2.4) * wing, cpz + Math.cos(angle + 2.4) * wing)
  draw.lineTo(cpx + Math.sin(angle - 2.4) * wing, cpz + Math.cos(angle - 2.4) * wing)
  draw.closePath()
  draw.fill()

  if (legendEl) {
    legendEl.textContent = `Player · ${activeCount}/${cull.length} active · ${cull.filter((e) => e.inView).length} in view`
  }
}
