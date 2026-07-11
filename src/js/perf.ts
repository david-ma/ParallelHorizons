/**
 * Dev-only frame timing, slow-frame capture, and HUD.
 * See docs/2026-07-11_optimisations.md — Tier 1 HUD + Tier 2 JSONL ring buffer.
 */
import type * as THREE from 'three'
import type { Gal } from './types.js'
import { classifyBeamFadeVisual, getSpotlightCullDebug } from './spotlight.js'

export type FramePhases = {
  anim: number
  move: number
  spotCull: number
  minimap: number
  debug: number
  render: number
}

export type SlowFrameRecord = {
  ev: 'slow_frame'
  ts: number
  frameMs: number
  budgetMs: number
  phases: FramePhases
  render: { calls: number; tris: number; tex: number; geos: number }
  lights: { total: number; active: number; lit: number; hold: number }
  scene: { paintings: number; walls: number }
  cam: { x: number; y: number; z: number }
  dpr: number
  gallery: string
}

const SLOW_RING_MAX = 40
const ROLLING_SIZE = 120
const PROFILE_AUTO_STOP_MS = 60_000

const emptyPhases = (): FramePhases => ({
  anim: 0,
  move: 0,
  spotCull: 0,
  minimap: 0,
  debug: 0,
  render: 0,
})

let rollingFrameMs: number[] = []
let slowRing: SlowFrameRecord[] = []
let profileCaptureUntil = 0
let profileEndedLogged = false
let hudTick = 0
let totalSlowCount = 0
let phaseTotals = emptyPhases()
let phaseTotalFrames = 0

function isDevTools(): boolean {
  return !!(globalThis as { GALLERY_DEV_TOOLS?: boolean }).GALLERY_DEV_TOOLS
}

export function wantsProfileCapture(): boolean {
  if (typeof window === 'undefined') return false
  return isDevTools() && new URLSearchParams(window.location.search).get('profile') === '1'
}

export function rollingMedian(values: readonly number[]): number {
  if (values.length === 0) return 16.7
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]!
}

export function slowBudget(medianMs: number): number {
  return Math.max(20, medianMs * 1.75)
}

export function gallerySlug(): string {
  if (typeof window === 'undefined') return 'unknown'
  const m = window.location.pathname.match(/\/view(?:\/([^/?#]+))?/)
  return m?.[1] ?? 'default'
}

function collectLightStats(): { total: number; active: number; lit: number; hold: number } {
  const cull = getSpotlightCullDebug()
  let active = 0
  let lit = 0
  let hold = 0
  for (const e of cull) {
    if (e.active) active++
    if (e.beamFade > 0) lit++
    if (classifyBeamFadeVisual(e.active, e.beamFade, e.beamOffDelayElapsed) === 'holdOff') hold++
  }
  return { total: cull.length, active, lit, hold }
}

/** Elapsed ms since `startMs` (from performance.now()). */
export function markPhase(startMs: number): number {
  return performance.now() - startMs
}

export function initDevPerf(): void {
  if (!isDevTools()) return

  if (wantsProfileCapture()) {
    profileCaptureUntil = performance.now() + PROFILE_AUTO_STOP_MS
    profileEndedLogged = false
    console.info(
      '[gallery perf] ?profile=1 — capturing slow frames for 60s. Walk the laggy path, then galleryDumpPerf()'
    )
  }

  document.getElementById('perf-dump-btn')?.addEventListener('click', () => galleryDumpPerf())

  const g = globalThis as typeof globalThis & {
    galleryDumpPerf?: typeof galleryDumpPerf
    galleryPerfSummary?: typeof galleryPerfSummary
  }
  g.galleryDumpPerf = galleryDumpPerf
  g.galleryPerfSummary = galleryPerfSummary
}

function shouldRecordSlow(frameMs: number, budgetMs: number): boolean {
  if (frameMs <= budgetMs) return false
  if (wantsProfileCapture() && performance.now() < profileCaptureUntil) return true
  return isDevTools()
}

function buildSlowRecord(
  g: Gal,
  frameMs: number,
  budgetMs: number,
  phases: FramePhases
): SlowFrameRecord {
  const info = g.renderer.info
  const cam = g.camera.position
  return {
    ev: 'slow_frame',
    ts: Math.round(performance.now()),
    frameMs: Math.round(frameMs * 10) / 10,
    budgetMs: Math.round(budgetMs * 10) / 10,
    phases: roundPhases(phases),
    render: {
      calls: info.render.calls,
      tris: info.render.triangles,
      tex: info.memory.textures,
      geos: info.memory.geometries,
    },
    lights: collectLightStats(),
    scene: {
      paintings: g.num_of_paintings ?? g.paintings?.length ?? 0,
      walls: g.wallGroup?.children?.length ?? 0,
    },
    cam: {
      x: Math.round(cam.x * 10) / 10,
      y: Math.round(cam.y * 10) / 10,
      z: Math.round(cam.z * 10) / 10,
    },
    dpr: g.renderer.getPixelRatio(),
    gallery: gallerySlug(),
  }
}

function roundPhases(phases: FramePhases): FramePhases {
  return {
    anim: Math.round(phases.anim * 10) / 10,
    move: Math.round(phases.move * 10) / 10,
    spotCull: Math.round(phases.spotCull * 10) / 10,
    minimap: Math.round(phases.minimap * 10) / 10,
    debug: Math.round(phases.debug * 10) / 10,
    render: Math.round(phases.render * 10) / 10,
  }
}

function addPhaseTotals(phases: FramePhases): void {
  phaseTotals.anim += phases.anim
  phaseTotals.move += phases.move
  phaseTotals.spotCull += phases.spotCull
  phaseTotals.minimap += phases.minimap
  phaseTotals.debug += phases.debug
  phaseTotals.render += phases.render
  phaseTotalFrames++
}

function updateHud(frameMs: number, medianMs: number, budgetMs: number, phases: FramePhases, g: Gal): void {
  const fpsEl = document.getElementById('fps')
  const msEl = document.getElementById('perf-frame-ms')
  const detailEl = document.getElementById('perf-detail')
  const profileEl = document.getElementById('perf-profile-badge')
  if (!fpsEl && !msEl && !detailEl) return

  const fps = frameMs > 0 ? Math.round(1000 / frameMs) : 0
  const minMs = rollingFrameMs.length ? Math.min(...rollingFrameMs) : frameMs
  const minFps = minMs > 0 ? Math.floor(1000 / minMs) : 0

  if (fpsEl) fpsEl.textContent = `${fps} (${minFps} min)`
  if (msEl) msEl.textContent = String(Math.round(frameMs * 10) / 10)

  if (detailEl) {
    const info = g.renderer.info
    const lights = collectLightStats()
    const top = dominantPhase(phases)
    detailEl.textContent = [
      `calls ${info.render.calls}`,
      `tris ${info.render.triangles}`,
      `lit ${lights.lit}/${lights.total}`,
      `slow ${slowRing.length}`,
      `top ${top}`,
    ].join(' · ')
  }

  if (profileEl) {
    const profiling = wantsProfileCapture() && performance.now() < profileCaptureUntil
    profileEl.textContent = profiling ? 'REC' : ''
    profileEl.classList.toggle('active', profiling)
  }
}

function dominantPhase(phases: FramePhases): string {
  let best: keyof FramePhases = 'render'
  let bestMs = -1
  for (const key of Object.keys(phases) as (keyof FramePhases)[]) {
    if (phases[key] > bestMs) {
      bestMs = phases[key]
      best = key
    }
  }
  return `${best} ${Math.round(bestMs)}ms`
}

export function recordFrame(g: Gal, frameStartMs: number, phases: FramePhases): void {
  if (!isDevTools()) return

  const frameMs = performance.now() - frameStartMs
  rollingFrameMs.push(frameMs)
  if (rollingFrameMs.length > ROLLING_SIZE) rollingFrameMs.shift()

  const median = rollingMedian(rollingFrameMs)
  const budget = slowBudget(median)
  addPhaseTotals(phases)

  if (shouldRecordSlow(frameMs, budget)) {
    totalSlowCount++
    slowRing.push(buildSlowRecord(g, frameMs, budget, phases))
    if (slowRing.length > SLOW_RING_MAX) slowRing.shift()
  }

  if (wantsProfileCapture() && !profileEndedLogged && performance.now() >= profileCaptureUntil) {
    profileEndedLogged = true
    console.info('[gallery perf] profile window ended — galleryPerfSummary():', galleryPerfSummary())
  }

  if (hudTick++ % 6 === 0) updateHud(frameMs, median, budget, phases, g)
}

export function galleryPerfSummary(): Record<string, unknown> {
  const frames = rollingFrameMs
  const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0
  const phaseAvg =
    phaseTotalFrames > 0
      ? {
          anim: phaseTotals.anim / phaseTotalFrames,
          move: phaseTotals.move / phaseTotalFrames,
          spotCull: phaseTotals.spotCull / phaseTotalFrames,
          minimap: phaseTotals.minimap / phaseTotalFrames,
          debug: phaseTotals.debug / phaseTotalFrames,
          render: phaseTotals.render / phaseTotalFrames,
        }
      : emptyPhases()

  return {
    ev: 'gallery.perf_summary',
    ts: Math.round(performance.now()),
    gallery: gallerySlug(),
    framesSampled: frames.length,
    frameMs: {
      avg: Math.round(avg * 10) / 10,
      p50: Math.round(rollingMedian(frames) * 10) / 10,
      p95: Math.round(percentile(frames, 95) * 10) / 10,
      min: Math.round((frames.length ? Math.min(...frames) : 0) * 10) / 10,
      max: Math.round((frames.length ? Math.max(...frames) : 0) * 10) / 10,
    },
    slowCount: totalSlowCount,
    slowRingSize: slowRing.length,
    phaseAvgMs: Object.fromEntries(
      Object.entries(phaseAvg).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    profileActive: wantsProfileCapture() && performance.now() < profileCaptureUntil,
  }
}

export function galleryDumpPerf(): string {
  const summary = JSON.stringify(galleryPerfSummary())
  const lines = slowRing.map((r) => JSON.stringify(r))
  const text = [summary, ...lines].join('\n')
  if (lines.length === 0) {
    console.info('[gallery perf] no slow frames yet — walk until lag, or use ?profile=1')
    console.info('[gallery perf] summary:', summary)
  } else {
    console.info(`[gallery perf] ${lines.length} slow frame(s):\n${text}`)
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {})
  }
  return text
}

/** Reset stats (tests). */
export function resetPerfState(): void {
  rollingFrameMs = []
  slowRing = []
  profileCaptureUntil = 0
  profileEndedLogged = false
  hudTick = 0
  totalSlowCount = 0
  phaseTotals = emptyPhases()
  phaseTotalFrames = 0
}
