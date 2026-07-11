/**
 * Spotlight rigs for artworks and dev-only global tuning controls.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const SPOTLIGHT_MODEL_URL = '/models/spotlight/Spotlight.glb'

/** Pitch down from wall-normal toward artwork (~89° with default mount height). */
const DEFAULT_FIXTURE_PITCH = Math.atan2(5.35 - 2, 0.04)

/** GLB authored with mount opposite our wall basis — flip to face the wall. */
const FIXTURE_YAW_OFFSET = Math.PI

/** Global spotlight defaults — edit here or paste from dev panel “Copy as TypeScript”. */
export const SPOTLIGHT_TUNING = {
  mountY: 4.22,
  lightRoomOffset: 0.28,
  artworkWallStandoff: 0.06,
  targetYOffset: 0.98,
  intensity: 9.9,
  distance: 20.6,
  angle: 0.49,
  penumbra: 0.81,
  decay: 0.6,
  emitterRadius: 0.155,
  emitterOffsetX: 0,
  emitterOffsetY: -0.315,
  emitterOffsetZ: 0.295,
  emitterOpacity: 1,
  fixtureScale: 0.65,
  wallMountOffset: -0.055,
  fixturePitchOffset: -1.27,
} as const

export type SpotlightGlobalTuning = {
  mountY: number
  lightRoomOffset: number
  artworkWallStandoff: number
  targetYOffset: number
  intensity: number
  distance: number
  angle: number
  penumbra: number
  decay: number
  emitterRadius: number
  emitterOffsetX: number
  emitterOffsetY: number
  emitterOffsetZ: number
  emitterOpacity: number
  fixtureScale: number
  wallMountOffset: number
  fixturePitchOffset: number
}

type SliderDef = {
  key: keyof SpotlightGlobalTuning
  label: string
  group: 'mount' | 'beam' | 'emitter' | 'fixture'
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export const SPOTLIGHT_SLIDER_DEFS: SliderDef[] = [
  { key: 'mountY', label: 'Mount height (Y)', group: 'mount', min: 3.5, max: 6, step: 0.01, format: (v) => `${v.toFixed(2)} m` },
  { key: 'lightRoomOffset', label: 'Offset from wall', group: 'mount', min: -0.15, max: 0.75, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'wallMountOffset', label: 'Fixture wall flush', group: 'mount', min: -0.35, max: 0.45, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'targetYOffset', label: 'Aim Y offset', group: 'mount', min: -1.5, max: 1, step: 0.01, format: (v) => `${v.toFixed(2)} m` },
  { key: 'intensity', label: 'Intensity', group: 'beam', min: 0, max: 12, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'distance', label: 'Distance', group: 'beam', min: 0.5, max: 30, step: 0.1, format: (v) => `${v.toFixed(1)} m` },
  { key: 'angle', label: 'Cone angle', group: 'beam', min: 0.05, max: 1.55, step: 0.01, format: (v) => `${((v * 180) / Math.PI).toFixed(1)}°` },
  { key: 'penumbra', label: 'Penumbra', group: 'beam', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'decay', label: 'Decay', group: 'beam', min: 0, max: 6, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'emitterRadius', label: 'Disc radius', group: 'emitter', min: 0.01, max: 0.6, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'emitterOffsetX', label: 'Disc offset ↔', group: 'emitter', min: -0.75, max: 0.75, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'emitterOffsetY', label: 'Disc offset ↕', group: 'emitter', min: -0.75, max: 0.75, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'emitterOffsetZ', label: 'Disc offset from wall', group: 'emitter', min: -0.6, max: 0.75, step: 0.005, format: (v) => `${v.toFixed(3)} m` },
  { key: 'emitterOpacity', label: 'Disc opacity', group: 'emitter', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'fixtureScale', label: 'Model scale', group: 'fixture', min: 0.05, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
  {
    key: 'fixturePitchOffset',
    label: 'Pitch (from wall)',
    group: 'fixture',
    min: -2,
    max: 2.2,
    step: 0.01,
    format: (v) => `${((v * 180) / Math.PI).toFixed(1)}°`,
  },
]

const STORAGE_KEY = 'gallery-spotlight-tuning-v1'

const _forward = new THREE.Vector3()
const _wallAnchor = new THREE.Vector3()
const _mountedWorld = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _boxCorner = new THREE.Vector3()
const _corners: THREE.Vector3[] = []

let globalTuning: SpotlightGlobalTuning = { ...SPOTLIGHT_TUNING }
const registeredRigs: ArtworkSpotlightRig[] = []
let devPanelReady = false
let onTuningRender: (() => void) | null = null

export interface ArtworkSpotlightAnchor {
  artworkCenter: THREE.Vector3
  wallNormal: THREE.Vector3
}

export interface SpotlightRigOptions {
  lightOrigin: THREE.Vector3
  lightTarget: THREE.Vector3
  wallNormal: THREE.Vector3
  wallAnchor: THREE.Vector3
  modelUrl: string
  intensity: number
  distance: number
  angle: number
  penumbra: number
  decay: number
  emitterRadius: number
  emitterOffsetX: number
  emitterOffsetY: number
  emitterOffsetZ: number
  emitterOpacity: number
  fixtureScale: number
  wallMountOffset: number
  fixturePitchOffset: number
}

export interface ArtworkSpotlightRig {
  spotlight: THREE.SpotLight
  spotlightTarget: THREE.Object3D
  emitterDisc: THREE.Mesh
  /** Index into shared InstancedMesh fixture pool (-1 until pool ready). */
  fixtureInstanceIndex: number
  options: SpotlightRigOptions
  anchor: ArtworkSpotlightAnchor
  /** When set, anchor is refreshed from live artwork pose on each apply. */
  artwork?: THREE.Object3D
  /** 0–1 beam fade level (intensity + emitter opacity). */
  beamFade: number
  /** Seconds accumulated since rig became inactive (reset when active). */
  beamOffDelayElapsed: number
}

/** Spotlight LOD — keep nearest rigs lit; see docs/2026-07-11_optimisations.md */
export const SPOTLIGHT_CULL_DEFAULTS = {
  maxWhenFew: 8,
  maxWhenMany: 8,
  maxWhenHeavy: 8,
  heavyThreshold: 24,
  /** Beam + light stay on within this radius even behind the player (m). */
  nearActiveRadius: 4,
  /** Seconds to ramp beam intensity and emitter on or off. */
  beamFadeSeconds: 0.1,
  /** Hold beam level this long after out of view before fading off. */
  beamOffDelaySeconds: 2,
  /** Extra degrees added to camera FOV for artwork eligibility. */
  fovPaddingDegrees: 3,
  /** Walkable floor top — used for floor-pool hitbox radius (m). */
  floorY: 1.25,
} as const

export function maxActiveSpotlights(rigCount: number): number {
  if (rigCount <= 0) return 0
  if (rigCount <= SPOTLIGHT_CULL_DEFAULTS.maxWhenFew) return rigCount
  if (rigCount >= SPOTLIGHT_CULL_DEFAULTS.heavyThreshold) return SPOTLIGHT_CULL_DEFAULTS.maxWhenHeavy
  return SPOTLIGHT_CULL_DEFAULTS.maxWhenMany
}

/** Lower sortKey = lit first. In-view rigs sort by distance/centring; behind use 1e12 + dist². */
export function spotlightCullPriority(
  artworkCenter: THREE.Vector3,
  cameraPos: THREE.Vector3,
  cameraForward: THREE.Vector3
): { sortKey: number; inView: boolean; distance: number } {
  const toArtX = artworkCenter.x - cameraPos.x
  const toArtY = artworkCenter.y - cameraPos.y
  const toArtZ = artworkCenter.z - cameraPos.z
  const distSq = toArtX * toArtX + toArtY * toArtY + toArtZ * toArtZ
  const distance = Math.sqrt(distSq)
  if (distSq < 1e-8) return { sortKey: 0, inView: true, distance: 0 }
  const dot =
    (cameraForward.x * toArtX + cameraForward.y * toArtY + cameraForward.z * toArtZ) / distance
  const inView = dot > 0.08
  if (!inView) return { sortKey: 1e12 + distSq, inView: false, distance }
  return { sortKey: distSq / Math.max(dot, 0.2), inView: true, distance }
}

/** Pick active rigs by sortKey (in-view always before behind). */
export function selectActiveSpotlightFlagsInView(sortKeys: number[], maxActive: number): boolean[] {
  const n = sortKeys.length
  if (n === 0) return []
  if (maxActive >= n) return sortKeys.map(() => true)
  if (maxActive <= 0) return sortKeys.map(() => false)
  const order = sortKeys.map((k, i) => ({ k, i }))
  order.sort((a, b) => a.k - b.k)
  const active = new Set(order.slice(0, maxActive).map((x) => x.i))
  return sortKeys.map((_, i) => active.has(i))
}

/** Pick active rigs by squared distance (lowest = nearest player). */
export function selectActiveSpotlightFlagsByDistance(distancesSq: number[], maxActive: number): boolean[] {
  const n = distancesSq.length
  if (n === 0) return []
  if (maxActive >= n) return distancesSq.map(() => true)
  if (maxActive <= 0) return distancesSq.map(() => false)
  const order = distancesSq.map((d, i) => ({ d, i }))
  order.sort((a, b) => a.d - b.d)
  const active = new Set(order.slice(0, maxActive).map((x) => x.i))
  return distancesSq.map((_, i) => active.has(i))
}

/** Pick active rigs by priority score (lowest scores win). */
export function selectActiveSpotlightFlagsByScore(scores: number[], maxActive: number): boolean[] {
  return selectActiveSpotlightFlagsByDistance(scores, maxActive)
}

/** @deprecated Use selectActiveSpotlightFlagsByDistance */
export function selectActiveSpotlightFlags(distancesSq: number[], maxActive: number): boolean[] {
  return selectActiveSpotlightFlagsByDistance(distancesSq, maxActive)
}

const _cullCamPos = new THREE.Vector3()
const _cullForward = new THREE.Vector3()
const _cullPoint = new THREE.Vector3()
const _cullLightPos = new THREE.Vector3()
const _cullLightTarget = new THREE.Vector3()
const _cullRayDir = new THREE.Vector3()
const _cullProjScreen = new THREE.Matrix4()
const _cullFrustum = new THREE.Frustum()
const _cullRaycaster = new THREE.Raycaster()
const _paddedCullCam = new THREE.PerspectiveCamera()
const _hitboxSample = new THREE.Vector3()

/** Outer cone radius on the floor plane (m). */
export function spotlightFloorHitRadius(lightY: number, floorY: number, coneAngle: number): number {
  const drop = Math.max(0, lightY - floorY)
  return Math.tan(coneAngle) * drop
}

/** Where the spotlight beam axis meets the floor; null if parallel or floor is above the light. */
export function spotlightFloorPoolCenter(
  lightPos: THREE.Vector3,
  target: THREE.Vector3,
  floorY: number,
  out: THREE.Vector3
): THREE.Vector3 | null {
  _cullRayDir.copy(target).sub(lightPos)
  const dy = _cullRayDir.y
  if (Math.abs(dy) < 1e-6) return null
  const t = (floorY - lightPos.y) / dy
  if (t < 0) return null
  return out.copy(lightPos).addScaledVector(_cullRayDir, t)
}

/** Player standing inside the lit floor pool (XZ) — pre-warms activation around corners. */
export function isPlayerInSpotlightFloorHitbox(
  playerPos: THREE.Vector3,
  lightPos: THREE.Vector3,
  target: THREE.Vector3,
  floorY: number,
  coneAngle: number
): boolean {
  const center = spotlightFloorPoolCenter(lightPos, target, floorY, _cullPoint)
  if (!center) return false
  const radius = spotlightFloorHitRadius(lightPos.y, floorY, coneAngle)
  const dx = playerPos.x - center.x
  const dz = playerPos.z - center.z
  return dx * dx + dz * dz <= radius * radius
}

/** Floor beam pool visible to camera (center or rim), not blocked by walls. */
export function isSpotlightFloorHitboxInView(
  camera: THREE.Camera,
  cameraPos: THREE.Vector3,
  lightPos: THREE.Vector3,
  target: THREE.Vector3,
  floorY: number,
  coneAngle: number,
  wallMeshes: readonly THREE.Object3D[],
  fovPaddingDeg: number = SPOTLIGHT_CULL_DEFAULTS.fovPaddingDegrees
): boolean {
  const center = spotlightFloorPoolCenter(lightPos, target, floorY, _cullPoint)
  if (!center) return false
  const radius = spotlightFloorHitRadius(lightPos.y, floorY, coneAngle)
  const offsets: readonly [number, number][] = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [ox, oz] of offsets) {
    _hitboxSample.set(center.x + ox * radius, floorY, center.z + oz * radius)
    if (!isPointInViewFrustum(camera, _hitboxSample, fovPaddingDeg)) continue
    if (!isArtworkOccludedByWalls(cameraPos, _hitboxSample, wallMeshes)) return true
  }
  return false
}

/** True when a world point lies inside the camera frustum (optional FOV padding in degrees). */
export function isPointInViewFrustum(
  camera: THREE.Camera,
  point: THREE.Vector3,
  fovPaddingDeg: number = SPOTLIGHT_CULL_DEFAULTS.fovPaddingDegrees
): boolean {
  if (camera instanceof THREE.PerspectiveCamera && fovPaddingDeg > 0) {
    _paddedCullCam.fov = camera.fov + fovPaddingDeg
    _paddedCullCam.aspect = camera.aspect
    _paddedCullCam.near = camera.near
    _paddedCullCam.far = camera.far
    _paddedCullCam.updateProjectionMatrix()
    _cullProjScreen.multiplyMatrices(_paddedCullCam.projectionMatrix, camera.matrixWorldInverse)
  } else {
    _cullProjScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  }
  _cullFrustum.setFromProjectionMatrix(_cullProjScreen)
  return _cullFrustum.containsPoint(point)
}

/** Ray from camera to artwork blocked by a wall mesh before reaching the target. */
export function isArtworkOccludedByWalls(
  cameraPos: THREE.Vector3,
  artworkCenter: THREE.Vector3,
  wallMeshes: readonly THREE.Object3D[],
  raycaster: THREE.Raycaster = _cullRaycaster
): boolean {
  if (wallMeshes.length === 0) return false
  _cullRayDir.copy(artworkCenter).sub(cameraPos)
  const distToArt = _cullRayDir.length()
  if (distToArt < 0.05) return false
  _cullRayDir.multiplyScalar(1 / distToArt)
  raycaster.set(cameraPos, _cullRayDir)
  raycaster.far = distToArt - 0.08
  raycaster.near = 0.05
  return raycaster.intersectObjects(wallMeshes as THREE.Object3D[], false).length > 0
}

let lastCullDebug: SpotlightCullDebugEntry[] = []
let lastBeamFadeMs = 0

/** Advance off-delay timer while inactive; reset when active. */
export function advanceBeamOffDelay(
  active: boolean,
  offDelayElapsed: number,
  dtSec: number
): number {
  if (active) return 0
  return offDelayElapsed + dtSec
}

/** Fade target: on immediately when active; off after hold, then ramp down. */
export function computeBeamFadeTarget(
  active: boolean,
  offDelayElapsed: number,
  currentFade: number,
  offDelaySeconds: number = SPOTLIGHT_CULL_DEFAULTS.beamOffDelaySeconds
): number {
  if (active) return 1
  if (offDelayElapsed < offDelaySeconds) return currentFade
  return 0
}

/** Advance beam fade toward 0 or 1 over `fadeSeconds`. */
export function stepBeamFade(
  current: number,
  target: number,
  dtSec: number,
  fadeSeconds: number = SPOTLIGHT_CULL_DEFAULTS.beamFadeSeconds
): number {
  if (fadeSeconds <= 0) return target
  if (target > current) return Math.min(1, current + dtSec / fadeSeconds)
  if (target < current) return Math.max(0, current - dtSec / fadeSeconds)
  return current
}

/** Apply faded intensity and emitter opacity (fixtures stay visible). */
export function applyRigBeamFade(rig: ArtworkSpotlightRig, fade: number): void {
  const clamped = Math.max(0, Math.min(1, fade))
  rig.beamFade = clamped
  const { intensity, distance, angle, penumbra, decay, emitterOpacity } = rig.options
  const emitterMat = rig.emitterDisc.material as THREE.MeshBasicMaterial
  if (clamped <= 0) {
    rig.emitterDisc.visible = false
    rig.spotlight.visible = false
    rig.spotlight.intensity = 0
    return
  }
  rig.emitterDisc.visible = true
  rig.spotlight.visible = true
  rig.spotlight.intensity = intensity * clamped
  rig.spotlight.distance = distance
  rig.spotlight.angle = angle
  rig.spotlight.penumbra = penumbra
  rig.spotlight.decay = decay
  rig.spotlight.target = rig.spotlightTarget
  emitterMat.opacity = emitterOpacity * clamped
}

export type SpotlightCullDebugEntry = {
  x: number
  z: number
  distance: number
  inView: boolean
  occluded: boolean
  nearPlayer: boolean
  inHitbox: boolean
  hitboxInView: boolean
  /** Eligible for activation (view, prox, hitbox). */
  eligible: boolean
  /** Selected within max-active cap this frame. */
  active: boolean
  /** 0–1 beam brightness after fade step. */
  beamFade: number
  /** Seconds since rig became inactive (0 while active). */
  beamOffDelayElapsed: number
}

export type BeamFadeVisualState = 'off' | 'on' | 'fadeIn' | 'holdOff' | 'fadeOut'

/** Minimap / debug label for current beam fade phase. */
export function classifyBeamFadeVisual(
  active: boolean,
  beamFade: number,
  offDelayElapsed: number,
  offDelaySeconds: number = SPOTLIGHT_CULL_DEFAULTS.beamOffDelaySeconds
): BeamFadeVisualState {
  if (beamFade <= 0) return 'off'
  if (active) return beamFade >= 1 ? 'on' : 'fadeIn'
  if (offDelayElapsed < offDelaySeconds) return 'holdOff'
  return 'fadeOut'
}

export type SpotlightEligibility = {
  eligible: boolean
  sortKey: number
  inView: boolean
  occluded: boolean
  nearPlayer: boolean
  inHitbox: boolean
  hitboxInView: boolean
  distance: number
}

/** Score rig for activation: in-view first, then near-player, then floor hitbox. */
export function evaluateSpotlightEligibility(
  artworkCenter: THREE.Vector3,
  lightPos: THREE.Vector3,
  lightTarget: THREE.Vector3,
  coneAngle: number,
  camera: THREE.Camera,
  cameraPos: THREE.Vector3,
  cameraForward: THREE.Vector3,
  wallMeshes: readonly THREE.Object3D[],
  floorY: number = SPOTLIGHT_CULL_DEFAULTS.floorY,
  nearRadius: number = SPOTLIGHT_CULL_DEFAULTS.nearActiveRadius,
  fovPaddingDeg: number = SPOTLIGHT_CULL_DEFAULTS.fovPaddingDegrees
): SpotlightEligibility {
  const { sortKey: viewSort, distance } = spotlightCullPriority(artworkCenter, cameraPos, cameraForward)
  const distSq = distance * distance
  const inFrustum = isPointInViewFrustum(camera, artworkCenter, fovPaddingDeg)
  const occluded = inFrustum ? isArtworkOccludedByWalls(cameraPos, artworkCenter, wallMeshes) : false
  const inView = inFrustum && !occluded
  const nearPlayer = distance <= nearRadius
  const inHitbox = isPlayerInSpotlightFloorHitbox(cameraPos, lightPos, lightTarget, floorY, coneAngle)
  const hitboxInView = isSpotlightFloorHitboxInView(
    camera,
    cameraPos,
    lightPos,
    lightTarget,
    floorY,
    coneAngle,
    wallMeshes,
    fovPaddingDeg
  )
  const eligible = inView || nearPlayer || inHitbox || hitboxInView

  let sortKey: number
  if (inView) sortKey = viewSort
  else if (nearPlayer) sortKey = 1e8 + distSq
  else if (hitboxInView) sortKey = 1e9 + distSq
  else if (inHitbox) sortKey = 1e10 + distSq
  else sortKey = 1e12 + distSq

  return { eligible, sortKey, inView, occluded, nearPlayer, inHitbox, hitboxInView, distance }
}

export function getSpotlightCullDebug(): readonly SpotlightCullDebugEntry[] {
  return lastCullDebug
}

export function getRegisteredSpotlightRigs(): readonly ArtworkSpotlightRig[] {
  return registeredRigs
}

export type SpotlightRigSnapshot = {
  index: number
  intensity: number
  visible: boolean
  lightInScene: boolean
  fixtureLoaded: boolean
  emitterOpacity: number
  distanceToCamera: number
  inView: boolean
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

const _snapCam = new THREE.Vector3()
const _snapFwd = new THREE.Vector3()

/** Dev snapshot of every registered rig — use galleryDebugSpotlights() in console. */
export function snapshotSpotlightRigs(scene: THREE.Scene, camera: THREE.Camera): SpotlightRigSnapshot[] {
  camera.getWorldPosition(_snapCam)
  camera.getWorldDirection(_snapFwd)
  const debugByIndex = new Map(lastCullDebug.map((d, i) => [i, d]))
  return registeredRigs.map((rig, index) => {
    refreshRigCullPoint(rig, _cullPoint)
    const { inView, distance } = spotlightCullPriority(_cullPoint, _snapCam, _snapFwd)
    const dbg = debugByIndex.get(index)
    rig.spotlight.getWorldPosition(_cullPoint)
    const pos = { x: _cullPoint.x, y: _cullPoint.y, z: _cullPoint.z }
    rig.spotlightTarget.getWorldPosition(_cullPoint)
    const target = { x: _cullPoint.x, y: _cullPoint.y, z: _cullPoint.z }
    const emitterMat = rig.emitterDisc.material as THREE.MeshBasicMaterial
    let lightInScene = false
    scene.traverse((obj) => {
      if (obj === rig.spotlight) lightInScene = true
    })
    return {
      index,
      intensity: rig.spotlight.intensity,
      visible: rig.spotlight.visible,
      lightInScene,
      fixtureLoaded: rig.fixtureInstanceIndex >= 0 && fixturePool !== null,
      emitterOpacity: emitterMat.opacity,
      distanceToCamera: dbg?.distance ?? distance,
      inView: dbg?.inView ?? inView,
      position: pos,
      target,
    }
  })
}

function refreshRigCullPoint(rig: ArtworkSpotlightRig, out: THREE.Vector3): THREE.Vector3 {
  if (rig.artwork) {
    rig.artwork.updateMatrixWorld(true)
    rig.artwork.getWorldPosition(out)
    rig.anchor.artworkCenter.copy(out)
  } else {
    out.copy(rig.anchor.artworkCenter)
  }
  return out
}

/**
 * Cap active SpotLights by eligibility; fixtures always drawn; beams fade in 100ms, hold 2s off.
 */
export function updateSpotlightCulling(
  camera: THREE.Camera,
  wallMeshes: readonly THREE.Object3D[] = []
): void {
  const rigs = registeredRigs
  if (rigs.length === 0) {
    lastCullDebug = []
    lastBeamFadeMs = 0
    return
  }
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const dtSec = lastBeamFadeMs > 0 ? Math.min(0.25, (now - lastBeamFadeMs) / 1000) : 0
  lastBeamFadeMs = now
  camera.getWorldPosition(_cullCamPos)
  camera.getWorldDirection(_cullForward)
  const maxActive = maxActiveSpotlights(rigs.length)

  const sortKeys: number[] = []
  const eligible: boolean[] = []
  const meta: Omit<SpotlightEligibility, 'eligible' | 'sortKey'>[] = []

  for (let i = 0; i < rigs.length; i++) {
    const rig = rigs[i]!
    refreshRigCullPoint(rig, _cullPoint)
    rig.spotlight.getWorldPosition(_cullLightPos)
    rig.spotlightTarget.getWorldPosition(_cullLightTarget)
    const result = evaluateSpotlightEligibility(
      _cullPoint,
      _cullLightPos,
      _cullLightTarget,
      rig.options.angle,
      camera,
      _cullCamPos,
      _cullForward,
      wallMeshes
    )
    eligible.push(result.eligible)
    sortKeys.push(result.sortKey)
    meta.push({
      inView: result.inView,
      occluded: result.occluded,
      nearPlayer: result.nearPlayer,
      inHitbox: result.inHitbox,
      hitboxInView: result.hitboxInView,
      distance: result.distance,
    })
  }

  const activeFlags = selectActiveSpotlightFlagsInView(sortKeys, maxActive)
  const debug: SpotlightCullDebugEntry[] = []

  for (let i = 0; i < rigs.length; i++) {
    const rig = rigs[i]!
    const isEligible = eligible[i]!
    const active = isEligible && activeFlags[i]!
    const { distance, inView, occluded, nearPlayer, inHitbox, hitboxInView } = meta[i]!
    refreshRigCullPoint(rig, _cullPoint)

    rig.beamOffDelayElapsed = advanceBeamOffDelay(active, rig.beamOffDelayElapsed, dtSec)
    const fadeTarget = computeBeamFadeTarget(active, rig.beamOffDelayElapsed, rig.beamFade)
    rig.beamFade = stepBeamFade(rig.beamFade, fadeTarget, dtSec)
    applyRigBeamFade(rig, rig.beamFade)

    debug.push({
      x: _cullPoint.x,
      z: _cullPoint.z,
      distance,
      inView,
      occluded,
      nearPlayer,
      inHitbox,
      hitboxInView,
      eligible: isEligible,
      active,
      beamFade: rig.beamFade,
      beamOffDelayElapsed: rig.beamOffDelayElapsed,
    })
  }
  lastCullDebug = debug
}

export function resolveMaxPixelRatio(paintingCount: number, search = '', deviceRatio?: number): number {
  const q = new URLSearchParams(search).get('quality')
  if (q === 'low') return 1
  if (q === 'high') return 2
  const cap = paintingCount >= 20 ? 1.25 : 2
  const dpr = deviceRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  return Math.min(dpr, cap)
}

function artworkFacingIntoRoom(artwork: THREE.Object3D): THREE.Vector3 {
  artwork.updateMatrixWorld(true)
  artwork.getWorldQuaternion(_quat)
  return _forward.set(0, 0, 1).applyQuaternion(_quat).normalize()
}

function bboxCorners(box: THREE.Box3, target: THREE.Vector3[]): THREE.Vector3[] {
  const { min, max } = box
  const xs = [min.x, max.x]
  const ys = [min.y, max.y]
  const zs = [min.z, max.z]
  target.length = 0
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        target.push(_boxCorner.set(x, y, z).clone())
      }
    }
  }
  return target
}

function captureAnchor(artwork: THREE.Object3D): ArtworkSpotlightAnchor {
  artwork.updateMatrixWorld(true)
  const center = new THREE.Vector3()
  artwork.getWorldPosition(center)
  return { artworkCenter: center, wallNormal: artworkFacingIntoRoom(artwork) }
}

function captureAnchorFromOptions(options: SpotlightRigOptions): ArtworkSpotlightAnchor {
  return {
    artworkCenter: options.lightTarget.clone(),
    wallNormal: options.wallNormal.clone(),
  }
}

export function getSpotlightGlobalTuning(): Readonly<SpotlightGlobalTuning> {
  return globalTuning
}

export function setSpotlightGlobalTuning(partial: Partial<SpotlightGlobalTuning>): void {
  globalTuning = { ...globalTuning, ...partial }
  persistTuning()
  applyGlobalTuningToAllRigs()
}

export function resetSpotlightGlobalTuning(): void {
  globalTuning = { ...SPOTLIGHT_TUNING }
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  applyGlobalTuningToAllRigs()
  syncDevPanelValues()
}

function persistTuning(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalTuning))
  } catch (_err) {
    // ignore quota / private mode
  }
}

function loadPersistedTuning(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<SpotlightGlobalTuning>
    globalTuning = { ...SPOTLIGHT_TUNING, ...parsed }
    if (globalTuning.intensity <= 0) globalTuning.intensity = SPOTLIGHT_TUNING.intensity
  } catch (_err) {
    // ignore invalid cache
  }
}

export function buildSpotlightOptions(
  anchor: ArtworkSpotlightAnchor,
  tuning: SpotlightGlobalTuning = globalTuning,
  modelUrl: string = SPOTLIGHT_MODEL_URL
): SpotlightRigOptions {
  const { artworkCenter, wallNormal } = anchor
  _wallAnchor.copy(artworkCenter).addScaledVector(wallNormal, -tuning.artworkWallStandoff)
  _wallAnchor.y = tuning.mountY

  const lightOrigin = new THREE.Vector3(artworkCenter.x, tuning.mountY, artworkCenter.z).addScaledVector(
    wallNormal,
    tuning.lightRoomOffset
  )
  const lightTarget = artworkCenter.clone().add(new THREE.Vector3(0, tuning.targetYOffset, 0))

  return {
    lightOrigin,
    lightTarget,
    wallNormal: wallNormal.clone(),
    wallAnchor: _wallAnchor.clone(),
    modelUrl,
    intensity: tuning.intensity,
    distance: tuning.distance,
    angle: tuning.angle,
    penumbra: tuning.penumbra,
    decay: tuning.decay,
    emitterRadius: tuning.emitterRadius,
    emitterOffsetX: tuning.emitterOffsetX,
    emitterOffsetY: tuning.emitterOffsetY,
    emitterOffsetZ: tuning.emitterOffsetZ,
    emitterOpacity: tuning.emitterOpacity,
    fixtureScale: tuning.fixtureScale,
    wallMountOffset: tuning.wallMountOffset,
    fixturePitchOffset: tuning.fixturePitchOffset,
  }
}

/** Default options for an artwork — uses global SPOTLIGHT_TUNING. */
export function spotlightOptionsForArtwork(
  artwork: THREE.Object3D,
  modelUrl: string = SPOTLIGHT_MODEL_URL
): SpotlightRigOptions {
  return buildSpotlightOptions(captureAnchor(artwork), globalTuning, modelUrl)
}

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _basisMatrix = new THREE.Matrix4()
const _worldUp = new THREE.Vector3(0, 1, 0)

/** Orthonormal frame on a vertical wall: +Z into room, +Y vertical, +X along wall. */
function wallAlignedBasis(wallNormal: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3; normal: THREE.Vector3 } {
  _normal.copy(wallNormal).normalize()
  _right.crossVectors(_worldUp, _normal)
  if (_right.lengthSq() < 1e-8) {
    _right.set(1, 0, 0)
  } else {
    _right.normalize()
  }
  _up.crossVectors(_normal, _right).normalize()
  return { right: _right.clone(), up: _up.clone(), normal: _normal.clone() }
}

/** CircleGeometry faces +Z; align disc flat to wall (normal into room), then pitch toward floor. */
function orientWallMounted(
  object: THREE.Object3D,
  wallNormal: THREE.Vector3,
  pitchOffset: number
): void {
  const { right, up, normal } = wallAlignedBasis(wallNormal)
  _basisMatrix.makeBasis(right, up, normal)
  object.quaternion.setFromRotationMatrix(_basisMatrix)
  if (pitchOffset !== 0) {
    object.rotateX(pitchOffset)
  }
}

function orientFixture(fixture: THREE.Object3D, wallNormal: THREE.Vector3, fixturePitchOffset: number): void {
  orientWallMounted(fixture, wallNormal, fixturePitchOffset)
  fixture.rotateY(FIXTURE_YAW_OFFSET)
}

function mountFixtureOnWall(
  fixture: THREE.Object3D,
  lightOrigin: THREE.Vector3,
  lightTarget: THREE.Vector3,
  wallNormal: THREE.Vector3,
  wallAnchor: THREE.Vector3,
  fixtureScale: number,
  wallMountOffset: number,
  fixturePitchOffset: number
): void {
  fixture.position.copy(lightOrigin)
  fixture.scale.setScalar(fixtureScale)
  orientFixture(fixture, wallNormal, fixturePitchOffset)
  fixture.updateMatrixWorld(true)

  const wallPlaneD = wallAnchor.dot(wallNormal)
  const box = new THREE.Box3().setFromObject(fixture)
  if (box.isEmpty()) return

  let minProj = Infinity
  for (const corner of bboxCorners(box, _corners)) {
    minProj = Math.min(minProj, corner.dot(wallNormal))
  }
  if (!Number.isFinite(minProj)) return

  fixture.position.addScaledVector(wallNormal, wallPlaneD + wallMountOffset - minProj)
  orientFixture(fixture, wallNormal, fixturePitchOffset)
}

export function applyArtworkSpotlightRigOptions(rig: ArtworkSpotlightRig): void {
  const options = rig.options
  rig.spotlight.distance = options.distance
  rig.spotlight.angle = options.angle
  rig.spotlight.penumbra = options.penumbra
  rig.spotlight.decay = options.decay
  rig.spotlightTarget.position.copy(options.lightTarget)
  rig.spotlight.target = rig.spotlightTarget

  if (fixturePool && rig.fixtureInstanceIndex >= 0) {
    syncFixtureInstanceMatrix(rig)
    fixturePool.mountProxy.getWorldPosition(_mountedWorld)
    rig.spotlight.position.copy(_mountedWorld)
  } else {
    rig.spotlight.position.copy(options.lightOrigin)
  }

  const { right, up, normal } = wallAlignedBasis(options.wallNormal)
  rig.emitterDisc.position
    .copy(rig.spotlight.position)
    .add(right.multiplyScalar(options.emitterOffsetX))
    .add(up.multiplyScalar(options.emitterOffsetY))
    .add(normal.multiplyScalar(options.emitterOffsetZ))
  orientWallMounted(rig.emitterDisc, options.wallNormal, options.fixturePitchOffset)
  rig.emitterDisc.scale.setScalar(options.emitterRadius)

  // Lamp emits from the disc (lens), not the mount point.
  rig.spotlight.position.copy(rig.emitterDisc.position)
  applyRigBeamFade(rig, rig.beamFade)
}

export function applyGlobalTuningToAllRigs(): void {
  for (const rig of registeredRigs) {
    if (rig.artwork) {
      rig.anchor = captureAnchor(rig.artwork)
    }
    rig.options = buildSpotlightOptions(rig.anchor, globalTuning, rig.options.modelUrl)
    applyArtworkSpotlightRigOptions(rig)
  }
  updateRigCountLabel()
  onTuningRender?.()
}

const spotlightModelLoader = new GLTFLoader()
let spotlightTemplate: THREE.Object3D | null = null
let spotlightTemplatePromise: Promise<THREE.Object3D> | null = null

const FIXTURE_INSTANCE_CAPACITY = 64
const _fixtureInstanceMatrix = new THREE.Matrix4()
const _zeroInstanceMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

type FixtureInstancePool = {
  layers: THREE.InstancedMesh[]
  /** Mirror meshes in mountProxy — world matrices include GLB hierarchy (e.g. 100× scale). */
  proxyMeshes: THREE.Mesh[]
  mountProxy: THREE.Object3D
  scene: THREE.Scene
  count: number
}

let fixturePool: FixtureInstancePool | null = null
let fixturePoolInitPromise: Promise<void> | null = null

function collectTemplateMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh)
  })
  return meshes
}

/** Deep clone hierarchy; share mesh geometry/material buffers. */
function cloneFixtureWithSharedAssets(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(false)
  if ((clone as THREE.Mesh).isMesh && (source as THREE.Mesh).isMesh) {
    const mesh = clone as THREE.Mesh
    const src = source as THREE.Mesh
    mesh.geometry = src.geometry
    mesh.material = src.material
  }
  for (const child of source.children) {
    clone.add(cloneFixtureWithSharedAssets(child))
  }
  return clone
}

/** Bake mesh verts into mount-root local space so one instance matrix per rig suffices. */
function bakeMeshGeometryToRoot(mesh: THREE.Mesh, root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true)
  mesh.updateMatrixWorld(true)
  const rel = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(rel)
  return geometry
}

function initFixturePoolFromProxy(scene: THREE.Scene, mountProxy: THREE.Object3D): void {
  const sourceMeshes = collectTemplateMeshes(mountProxy)
  const layers: THREE.InstancedMesh[] = []
  for (const source of sourceMeshes) {
    const geometry = bakeMeshGeometryToRoot(source, mountProxy)
    const material = source.material as THREE.Material
    const instanced = new THREE.InstancedMesh(geometry, material, FIXTURE_INSTANCE_CAPACITY)
    instanced.count = 0
    instanced.frustumCulled = false
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    layers.push(instanced)
    scene.add(instanced)
  }
  fixturePool = { layers, proxyMeshes: sourceMeshes, mountProxy, scene, count: 0 }
}

function initFixturePoolFromTemplate(scene: THREE.Scene, template: THREE.Object3D): void {
  initFixturePoolFromProxy(scene, cloneFixtureWithSharedAssets(template))
}

function initFallbackFixturePool(scene: THREE.Scene): void {
  const mountProxy = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.25, 12),
    new THREE.MeshBasicMaterial({ color: 0x222222 })
  )
  mountProxy.add(mesh)
  initFixturePoolFromProxy(scene, mountProxy)
}

function syncFixturePoolCount(): void {
  if (!fixturePool) return
  for (const layer of fixturePool.layers) {
    layer.count = fixturePool.count
  }
}

function allocateFixtureInstance(rig: ArtworkSpotlightRig): void {
  if (!fixturePool) return
  if (rig.fixtureInstanceIndex >= 0) return
  if (fixturePool.count >= FIXTURE_INSTANCE_CAPACITY) {
    console.warn('Spotlight fixture instance pool full; increase FIXTURE_INSTANCE_CAPACITY')
    return
  }
  rig.fixtureInstanceIndex = fixturePool.count++
  syncFixturePoolCount()
}

function mountProxyMatrixForRig(rig: ArtworkSpotlightRig): void {
  if (!fixturePool) return
  const o = rig.options
  mountFixtureOnWall(
    fixturePool.mountProxy,
    o.lightOrigin,
    o.lightTarget,
    o.wallNormal,
    o.wallAnchor,
    o.fixtureScale,
    o.wallMountOffset,
    o.fixturePitchOffset
  )
  fixturePool.mountProxy.updateMatrixWorld(true)
}

function syncFixtureInstanceMatrix(rig: ArtworkSpotlightRig): void {
  if (!fixturePool || rig.fixtureInstanceIndex < 0) return
  mountProxyMatrixForRig(rig)
  fixturePool.mountProxy.updateMatrixWorld(true)
  _fixtureInstanceMatrix.copy(fixturePool.mountProxy.matrixWorld)
  for (const layer of fixturePool.layers) {
    layer.setMatrixAt(rig.fixtureInstanceIndex, _fixtureInstanceMatrix)
    layer.instanceMatrix.needsUpdate = true
  }
}

function setFixtureInstanceVisible(rig: ArtworkSpotlightRig, visible: boolean): void {
  if (!fixturePool || rig.fixtureInstanceIndex < 0) return
  if (visible) {
    syncFixtureInstanceMatrix(rig)
  } else {
    for (const layer of fixturePool.layers) {
      layer.setMatrixAt(rig.fixtureInstanceIndex, _zeroInstanceMatrix)
      layer.instanceMatrix.needsUpdate = true
    }
  }
}

function registerRigWithFixturePool(rig: ArtworkSpotlightRig): void {
  allocateFixtureInstance(rig)
  applyArtworkSpotlightRigOptions(rig)
}

function ensureFixturePool(scene: THREE.Scene, modelUrl: string): Promise<void> {
  if (fixturePool) return Promise.resolve()
  if (!fixturePoolInitPromise) {
    fixturePoolInitPromise = loadSpotlightTemplate(modelUrl)
      .then((template) => {
        initFixturePoolFromTemplate(scene, template)
        for (const rig of registeredRigs) registerRigWithFixturePool(rig)
      })
      .catch((err) => {
        console.error('Failed to load spotlight model; using instanced fallback cone:', err)
        initFallbackFixturePool(scene)
        for (const rig of registeredRigs) registerRigWithFixturePool(rig)
      })
  }
  return fixturePoolInitPromise
}

function loadSpotlightTemplate(modelUrl: string): Promise<THREE.Object3D> {
  if (spotlightTemplate && modelUrl === SPOTLIGHT_MODEL_URL) {
    return Promise.resolve(spotlightTemplate)
  }
  if (!spotlightTemplatePromise || modelUrl !== SPOTLIGHT_MODEL_URL) {
    spotlightTemplatePromise = new Promise((resolve, reject) => {
      spotlightModelLoader.load(
        modelUrl,
        (gltf) => {
          spotlightTemplate = gltf.scene
          resolve(gltf.scene)
        },
        undefined,
        reject
      )
    })
  }
  return spotlightTemplatePromise
}

export function addArtworkSpotlightRig(
  scene: THREE.Scene,
  options: SpotlightRigOptions,
  artwork?: THREE.Object3D
): ArtworkSpotlightRig {
  const anchor = artwork ? captureAnchor(artwork) : captureAnchorFromOptions(options)

  const spotlight = new THREE.SpotLight(
    0xffffff,
    options.intensity,
    options.distance,
    options.angle,
    options.penumbra,
    options.decay
  )
  const spotlightTarget = new THREE.Object3D()
  spotlight.position.copy(options.lightOrigin)
  spotlightTarget.position.copy(options.lightTarget)
  spotlight.target = spotlightTarget
  scene.add(spotlightTarget)
  scene.add(spotlight)

  const emitterDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: options.emitterOpacity,
      side: THREE.DoubleSide,
    })
  )
  scene.add(emitterDisc)

  const rig: ArtworkSpotlightRig = {
    spotlight,
    spotlightTarget,
    emitterDisc,
    fixtureInstanceIndex: -1,
    options,
    anchor,
    artwork,
    beamFade: 0,
    beamOffDelayElapsed: 0,
  }
  applyArtworkSpotlightRigOptions(rig)
  registeredRigs.push(rig)
  updateRigCountLabel()

  void ensureFixturePool(scene, options.modelUrl).then(() => {
    registerRigWithFixturePool(rig)
    onTuningRender?.()
  })

  return rig
}

export function formatSpotlightTuningAsCode(tuning: SpotlightGlobalTuning = globalTuning): string {
  return `/** Global spotlight defaults — paste over SPOTLIGHT_TUNING in src/js/spotlight.ts */
export const SPOTLIGHT_TUNING = {
  mountY: ${tuning.mountY},
  lightRoomOffset: ${tuning.lightRoomOffset},
  artworkWallStandoff: ${tuning.artworkWallStandoff},
  targetYOffset: ${tuning.targetYOffset},
  intensity: ${tuning.intensity},
  distance: ${tuning.distance},
  angle: ${tuning.angle},
  penumbra: ${tuning.penumbra},
  decay: ${tuning.decay},
  emitterRadius: ${tuning.emitterRadius},
  emitterOffsetX: ${tuning.emitterOffsetX},
  emitterOffsetY: ${tuning.emitterOffsetY},
  emitterOffsetZ: ${tuning.emitterOffsetZ},
  emitterOpacity: ${tuning.emitterOpacity},
  fixtureScale: ${tuning.fixtureScale},
  wallMountOffset: ${tuning.wallMountOffset},
  fixturePitchOffset: ${tuning.fixturePitchOffset},
} as const`
}

function updateRigCountLabel(): void {
  const el = document.getElementById('spotlight_rig_count')
  if (el) {
    const n = registeredRigs.length
    el.textContent = n === 1 ? '1 spotlight' : `${n} spotlights`
  }
}

function syncDevPanelValues(): void {
  for (const def of SPOTLIGHT_SLIDER_DEFS) {
    const input = document.getElementById(`spotlight_${def.key}`) as HTMLInputElement | null
    const output = document.getElementById(`spotlight_${def.key}_val`) as HTMLOutputElement | null
    const value = globalTuning[def.key]
    if (input) {
      input.min = String(def.min)
      input.max = String(def.max)
      input.value = String(Math.min(def.max, Math.max(def.min, value)))
    }
    if (output) output.textContent = def.format ? def.format(value) : String(value)
  }
  const preview = document.getElementById('spotlight_code_preview') as HTMLTextAreaElement | null
  if (preview) preview.value = formatSpotlightTuningAsCode()
}

function buildDevPanelSliders(): void {
  for (const def of SPOTLIGHT_SLIDER_DEFS) {
    const host = document.querySelector(`.spotlight-sliders[data-group="${def.group}"]`)
    if (!host || document.getElementById(`spotlight_${def.key}`)) continue

    const label = document.createElement('label')
    label.htmlFor = `spotlight_${def.key}`
    label.textContent = def.label

    const input = document.createElement('input')
    input.type = 'range'
    input.id = `spotlight_${def.key}`
    input.min = String(def.min)
    input.max = String(def.max)
    input.step = String(def.step)
    input.value = String(globalTuning[def.key])

    const output = document.createElement('output')
    output.id = `spotlight_${def.key}_val`
    output.htmlFor = `spotlight_${def.key}`
    output.textContent = def.format ? def.format(globalTuning[def.key]) : String(globalTuning[def.key])

    input.addEventListener('input', () => {
      const value = Number(input.value)
      globalTuning = { ...globalTuning, [def.key]: value }
      output.textContent = def.format ? def.format(value) : String(value)
      persistTuning()
      applyGlobalTuningToAllRigs()
      const preview = document.getElementById('spotlight_code_preview') as HTMLTextAreaElement | null
      if (preview) preview.value = formatSpotlightTuningAsCode()
    })

    host.appendChild(label)
    host.appendChild(input)
    host.appendChild(output)
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (_err) {
    // fall through
  }
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textArea)
  return ok
}

function setExportStatus(message: string): void {
  const el = document.getElementById('spotlight_export_status')
  if (el) el.textContent = message
}

/** Wire dev panel on localhost — call once after scene (and spotlights) are built. */
export function initSpotlightDevPanel(onRender?: () => void): void {
  if (!(globalThis as { GALLERY_DEV_TOOLS?: boolean }).GALLERY_DEV_TOOLS) return
  const isDevHost =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  if (!isDevHost) return

  loadPersistedTuning()
  onTuningRender = onRender ?? null

  const panel = document.getElementById('spotlight_slider_panel')
  const toggleBtn = document.getElementById('spotlight_tune_toggle') as HTMLButtonElement | null

  if (!devPanelReady) {
    devPanelReady = true
    buildDevPanelSliders()

    toggleBtn?.addEventListener('click', () => {
      if (!panel) return
      panel.hidden = !panel.hidden
      toggleBtn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true')
      if (!panel.hidden) syncDevPanelValues()
    })

    document.getElementById('spotlight_reset')?.addEventListener('click', () => {
      resetSpotlightGlobalTuning()
      setExportStatus('Reset to SPOTLIGHT_TUNING defaults.')
    })

    document.getElementById('spotlight_copy_json')?.addEventListener('click', async () => {
      const json = JSON.stringify(globalTuning, null, 2)
      const ok = await copyText(json)
      setExportStatus(ok ? 'JSON copied — use for localStorage backup.' : 'Copy failed.')
    })

    document.getElementById('spotlight_copy_code')?.addEventListener('click', async () => {
      const code = formatSpotlightTuningAsCode()
      const preview = document.getElementById('spotlight_code_preview') as HTMLTextAreaElement | null
      if (preview) {
        preview.hidden = false
        preview.value = code
      }
      const ok = await copyText(code)
      setExportStatus(
        ok
          ? 'TypeScript copied — paste over SPOTLIGHT_TUNING in spotlight.ts and commit.'
          : 'Copy failed — see preview below.'
      )
    })
  }

  syncDevPanelValues()
  applyGlobalTuningToAllRigs()
}

/** @deprecated Use initSpotlightDevPanel */
export function bindSpotlightSliderControls(_tuning: Record<string, number>, _onInputChange: () => void): void {
  // Legacy no-op — global panel replaces per-rig binding.
}
