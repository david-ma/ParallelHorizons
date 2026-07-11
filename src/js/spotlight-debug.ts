/**
 * Dev-only spotlight diagnostics: live stats, cone helpers, solo-spotlight mode.
 */
import * as THREE from 'three'
import { SpotLightHelper } from 'three/src/helpers/SpotLightHelper.js'
import type { Gal } from './types.js'
import { getRegisteredSpotlightRigs, snapshotSpotlightRigs, type SpotlightRigSnapshot } from './spotlight.js'

type HelperEntry = { helper: SpotLightHelper; light: THREE.SpotLight }

let helpers: HelperEntry[] = []
let helpersVisible = false
let soloFill = false
let savedFill: { ambient: number; hemi: number } | null = null
let lastSummaryMs = 0
let panelEl: HTMLElement | null = null
let summaryEl: HTMLElement | null = null
let helpersBtn: HTMLButtonElement | null = null
let soloBtn: HTMLButtonElement | null = null
let copyBtn: HTMLButtonElement | null = null
let sceneRef: THREE.Scene | null = null

function isDevToolsEnabled(): boolean {
  return !!(globalThis as { GALLERY_DEV_TOOLS?: boolean }).GALLERY_DEV_TOOLS
}

function wantsAutoHelpers(): boolean {
  return new URLSearchParams(window.location.search).get('debugLights') === '1'
}

function countSceneLights(scene: THREE.Scene): { spot: number; ambient: number; hemi: number; other: number } {
  let spot = 0
  let ambient = 0
  let hemi = 0
  let other = 0
  scene.traverse((obj) => {
    if ((obj as THREE.SpotLight).isSpotLight) spot++
    else if ((obj as THREE.AmbientLight).isAmbientLight) ambient++
    else if ((obj as THREE.HemisphereLight).isHemisphereLight) hemi++
    else if ((obj as THREE.Light).isLight) other++
  })
  return { spot, ambient, hemi, other }
}

function setFillLights(scene: THREE.Scene, ambient: number, hemi: number): void {
  scene.traverse((obj) => {
    if ((obj as THREE.AmbientLight).isAmbientLight) (obj as THREE.AmbientLight).intensity = ambient
    if ((obj as THREE.HemisphereLight).isHemisphereLight) (obj as THREE.HemisphereLight).intensity = hemi
  })
}

function readFillLights(scene: THREE.Scene): { ambient: number; hemi: number } {
  let ambient = 0
  let hemi = 0
  scene.traverse((obj) => {
    if ((obj as THREE.AmbientLight).isAmbientLight) ambient = (obj as THREE.AmbientLight).intensity
    if ((obj as THREE.HemisphereLight).isHemisphereLight) hemi = (obj as THREE.HemisphereLight).intensity
  })
  return { ambient, hemi }
}

function rebuildHelpers(scene: THREE.Scene): void {
  clearHelpers(scene)
  for (const rig of getRegisteredSpotlightRigs()) {
    const helper = new SpotLightHelper(rig.spotlight, '#ffcc00')
    helper.visible = helpersVisible
    scene.add(helper)
    helpers.push({ helper, light: rig.spotlight })
  }
}

function clearHelpers(scene: THREE.Scene): void {
  for (const { helper } of helpers) {
    scene.remove(helper)
  }
  helpers = []
}

function formatSummary(g: Gal, snaps: SpotlightRigSnapshot[]): string {
  const lights = sceneRef ? countSceneLights(sceneRef) : { spot: 0, ambient: 0, hemi: 0, other: 0 }
  const rigs = snaps.length
  const lit = snaps.filter((s) => s.intensity > 0 && s.visible).length
  const inScene = snaps.filter((s) => s.lightInScene).length
  const fixtures = snaps.filter((s) => s.fixtureLoaded).length
  const nearest = snaps
    .filter((s) => s.inView)
    .sort((a, b) => a.distanceToCamera - b.distanceToCamera)[0]
  const lines = [
    `Rigs ${rigs} · lights in scene ${lights.spot} · active ${lit}`,
    `Fixtures loaded ${fixtures}/${rigs} · fill amb ${lights.ambient.toFixed(2)} hemi ${lights.hemi.toFixed(2)}`,
    `Solo spotlights: ${soloFill ? 'ON' : 'off'} · cones: ${helpersVisible ? 'ON' : 'off'}`,
  ]
  if (nearest) {
    lines.push(
      `Nearest in view #${nearest.index}: i=${nearest.intensity.toFixed(1)} d=${nearest.distanceToCamera.toFixed(1)}m`
    )
    lines.push(
      `  pos (${nearest.position.x.toFixed(1)}, ${nearest.position.y.toFixed(1)}, ${nearest.position.z.toFixed(1)}) → target (${nearest.target.x.toFixed(1)}, ${nearest.target.y.toFixed(1)}, ${nearest.target.z.toFixed(1)})`
    )
  }
  if (rigs > 0 && lit === 0) lines.push('⚠ All rig intensities are 0 — try Reset in Spotlight tuning')
  if (rigs > 0 && inScene < rigs) lines.push(`⚠ ${rigs - inScene} SpotLight(s) missing from scene graph`)
  if (lights.spot !== rigs) lines.push(`⚠ Scene spot count (${lights.spot}) ≠ rig count (${rigs})`)
  return lines.join('\n')
}

function dumpSpotlightDiagnostics(g: Gal): SpotlightRigSnapshot[] {
  const snaps = snapshotSpotlightRigs(g.scene, g.camera)
  const lights = countSceneLights(g.scene)
  console.group('Gallery spotlight diagnostics')
  console.log('Scene lights', lights)
  console.log('Fill solo mode', soloFill)
  console.table(
    snaps.map((s) => ({
      '#': s.index,
      inView: s.inView,
      intensity: s.intensity,
      visible: s.visible,
      inScene: s.lightInScene,
      fixture: s.fixtureLoaded,
      dist: s.distanceToCamera.toFixed(1),
      px: s.position.x.toFixed(1),
      py: s.position.y.toFixed(1),
      pz: s.position.z.toFixed(1),
    }))
  )
  console.groupEnd()
  return snaps
}

function toggleHelpers(scene: THREE.Scene): void {
  helpersVisible = !helpersVisible
  if (helpersVisible && helpers.length === 0) rebuildHelpers(scene)
  for (const { helper } of helpers) helper.visible = helpersVisible
  if (helpersBtn) helpersBtn.textContent = helpersVisible ? 'Hide light cones' : 'Show light cones'
}

function toggleSoloFill(scene: THREE.Scene): void {
  soloFill = !soloFill
  if (soloFill) {
    savedFill = readFillLights(scene)
    setFillLights(scene, 0.04, 0.02)
  } else if (savedFill) {
    setFillLights(scene, savedFill.ambient, savedFill.hemi)
    savedFill = null
  }
  if (soloBtn) soloBtn.textContent = soloFill ? 'Restore fill lights' : 'Solo spotlights (dim fill)'
}

export function initSpotlightDebug(g: Gal): void {
  if (!isDevToolsEnabled()) return

  sceneRef = g.scene
  panelEl = document.getElementById('spotlight_debug_panel')
  summaryEl = document.getElementById('spotlight_debug_summary')
  helpersBtn = document.getElementById('spotlight_debug_helpers') as HTMLButtonElement | null
  soloBtn = document.getElementById('spotlight_debug_solo') as HTMLButtonElement | null
  copyBtn = document.getElementById('spotlight_debug_copy') as HTMLButtonElement | null

  helpersBtn?.addEventListener('click', () => toggleHelpers(g.scene))
  soloBtn?.addEventListener('click', () => toggleSoloFill(g.scene))
  copyBtn?.addEventListener('click', async () => {
    const snaps = snapshotSpotlightRigs(g.scene, g.camera)
    const text = JSON.stringify(snaps, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      if (copyBtn) copyBtn.textContent = 'Copied!'
      setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy JSON snapshot'
      }, 1500)
    } catch {
      console.log(text)
    }
  })

  ;(globalThis as { galleryDebugSpotlights?: () => SpotlightRigSnapshot[] }).galleryDebugSpotlights = () =>
    dumpSpotlightDiagnostics(g)

  if (wantsAutoHelpers()) toggleHelpers(g.scene)
  if (wantsAutoHelpers()) toggleSoloFill(g.scene)

  rebuildHelpers(g.scene)
  lastSummaryMs = 0
  updateSpotlightDebug(g)
}

export function updateSpotlightDebug(g: Gal): void {
  if (!isDevToolsEnabled() || !sceneRef) return

  for (const { helper, light } of helpers) {
    const lit = light.visible && light.intensity > 0
    helper.visible = helpersVisible && lit
    if (helper.visible) helper.update()
  }

  const now = performance.now()
  if (now - lastSummaryMs < 400) return
  lastSummaryMs = now

  const snaps = snapshotSpotlightRigs(g.scene, g.camera)
  if (summaryEl) summaryEl.textContent = formatSummary(g, snaps)

  if (helpersVisible && helpers.length !== getRegisteredSpotlightRigs().length) {
    rebuildHelpers(g.scene)
  }
}

export function disposeSpotlightDebug(scene: THREE.Scene): void {
  clearHelpers(scene)
  if (soloFill && savedFill) setFillLights(scene, savedFill.ambient, savedFill.hemi)
  soloFill = false
  savedFill = null
}
