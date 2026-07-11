/**
 * Spotlight rigs for artworks and dev-only slider controls.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const SPOTLIGHT_MODEL_URL = '/models/spotlight/Spotlight.glb'

/** Track-light mount height — tuned default from demo gallery. */
const MOUNT_Y = 5.35
/** Artwork group standoff from wall plane (matches layout.ts placeOnWall). */
const ARTWORK_WALL_STANDOFF = 0.06
/** Light/fixture offset toward room from wall plane at mount height. */
const LIGHT_ROOM_OFFSET = 0.04

const DEFAULT_RIG = {
  intensity: 1.9,
  distance: 8,
  angle: Math.PI / 7,
  penumbra: 0.45,
  decay: 1.2,
  emitterRadius: 0.1,
  emitterOffsetX: 0,
  emitterOffsetY: 0,
  emitterOffsetZ: 0.17,
  emitterOpacity: 0.95,
  fixtureScale: 0.35,
  wallMountOffset: 0.02,
} as const

const _forward = new THREE.Vector3()
const _wallAnchor = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _boxCorner = new THREE.Vector3()

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

const _corners: THREE.Vector3[] = []

/** Snap fixture so its back face sits on the wall plane defined by wallAnchor + wallNormal. */
function mountFixtureOnWall(
  fixture: THREE.Object3D,
  lightOrigin: THREE.Vector3,
  lightTarget: THREE.Vector3,
  wallNormal: THREE.Vector3,
  wallAnchor: THREE.Vector3,
  fixtureScale: number,
  wallMountOffset: number
): void {
  fixture.position.copy(lightOrigin)
  fixture.scale.setScalar(fixtureScale)
  fixture.lookAt(lightTarget)
  fixture.updateMatrixWorld(true)

  const wallPlaneD = wallAnchor.dot(wallNormal)
  const box = new THREE.Box3().setFromObject(fixture)
  let minProj = Infinity
  for (const corner of bboxCorners(box, _corners)) {
    minProj = Math.min(minProj, corner.dot(wallNormal))
  }
  fixture.position.addScaledVector(wallNormal, wallPlaneD + wallMountOffset - minProj)
}

/** Default tuning derived from artwork pose — works on all four wall orientations. */
export function spotlightOptionsForArtwork(
  artwork: THREE.Object3D,
  modelUrl: string = SPOTLIGHT_MODEL_URL
): SpotlightRigOptions {
  artwork.updateMatrixWorld(true)
  const center = new THREE.Vector3()
  artwork.getWorldPosition(center)
  const wallNormal = artworkFacingIntoRoom(artwork)

  _wallAnchor.copy(center).addScaledVector(wallNormal, -ARTWORK_WALL_STANDOFF)
  _wallAnchor.y = MOUNT_Y

  const lightOrigin = new THREE.Vector3(center.x, MOUNT_Y, center.z).addScaledVector(
    wallNormal,
    LIGHT_ROOM_OFFSET
  )

  return {
    lightOrigin,
    lightTarget: center.clone(),
    wallNormal: wallNormal.clone(),
    wallAnchor: _wallAnchor.clone(),
    modelUrl,
    ...DEFAULT_RIG,
  }
}

export interface SpotlightRigOptions {
  lightOrigin: THREE.Vector3
  lightTarget: THREE.Vector3
  /** Unit vector from wall into room (same direction artwork faces). */
  wallNormal: THREE.Vector3
  /** A point on the wall surface at mount height, used to flush-mount the fixture. */
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
}

export interface ArtworkSpotlightRig {
  spotlight: THREE.SpotLight
  spotlightTarget: THREE.Object3D
  emitterDisc: THREE.Mesh
  fixture?: THREE.Object3D
  fallback?: THREE.Object3D
  options: SpotlightRigOptions
}

export function applyArtworkSpotlightRigOptions(rig: ArtworkSpotlightRig): void {
  const options = rig.options
  rig.spotlight.intensity = options.intensity
  rig.spotlight.distance = options.distance
  rig.spotlight.angle = options.angle
  rig.spotlight.penumbra = options.penumbra
  rig.spotlight.decay = options.decay
  rig.spotlight.position.copy(options.lightOrigin)
  rig.spotlightTarget.position.copy(options.lightTarget)
  rig.spotlight.target = rig.spotlightTarget

  const beamDir = new THREE.Vector3().subVectors(rig.spotlightTarget.position, rig.spotlight.position).normalize()
  const upReference = Math.abs(beamDir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const rightDir = new THREE.Vector3().crossVectors(beamDir, upReference).normalize()
  const upDir = new THREE.Vector3().crossVectors(rightDir, beamDir).normalize()
  const emitterMat = rig.emitterDisc.material as THREE.MeshBasicMaterial
  emitterMat.opacity = options.emitterOpacity
  rig.emitterDisc.position
    .copy(rig.spotlight.position)
    .add(rightDir.multiplyScalar(options.emitterOffsetX))
    .add(upDir.multiplyScalar(options.emitterOffsetY))
    .add(beamDir.multiplyScalar(options.emitterOffsetZ))
  rig.emitterDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), beamDir)
  rig.emitterDisc.scale.setScalar(options.emitterRadius)

  if (rig.fixture) {
    mountFixtureOnWall(
      rig.fixture,
      options.lightOrigin,
      options.lightTarget,
      options.wallNormal,
      options.wallAnchor,
      options.fixtureScale,
      options.wallMountOffset
    )
  }
  if (rig.fallback) {
    mountFixtureOnWall(
      rig.fallback,
      options.lightOrigin,
      options.lightTarget,
      options.wallNormal,
      options.wallAnchor,
      options.fixtureScale,
      options.wallMountOffset
    )
  }
}

const spotlightModelLoader = new GLTFLoader()
let spotlightTemplate: THREE.Object3D | null = null
let spotlightTemplatePromise: Promise<THREE.Object3D> | null = null

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

export function addArtworkSpotlightRig(scene: THREE.Scene, options: SpotlightRigOptions): ArtworkSpotlightRig {
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
    options,
  }
  applyArtworkSpotlightRigOptions(rig)

  void loadSpotlightTemplate(options.modelUrl)
    .then((template) => {
      const fixture = template.clone(true)
      rig.fixture = fixture
      applyArtworkSpotlightRigOptions(rig)
      scene.add(fixture)
    })
    .catch((err) => {
      console.error('Failed to load spotlight model:', err)
      const fallback = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.25, 12),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
      )
      rig.fallback = fallback
      applyArtworkSpotlightRigOptions(rig)
      scene.add(fallback)
    })

  return rig
}

/**
 * Binds dev-only spotlight tuning sliders (localhost/127.0.0.1). onInputChange is called when any slider changes.
 */
export function bindSpotlightSliderControls(
  tuning: Record<string, number>,
  onInputChange: () => void
): void {
  const isDevHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  if (!isDevHost) return

  const sliderMap: Record<string, string> = {
    spotlight_intensity: 'SPOTLIGHT_INTENSITY',
    spotlight_distance: 'SPOTLIGHT_DISTANCE',
    spotlight_angle: 'SPOTLIGHT_ANGLE',
    spotlight_penumbra: 'SPOTLIGHT_PENUMBRA',
    spotlight_decay: 'SPOTLIGHT_DECAY',
    spotlight_x: 'SPOTLIGHT_X',
    spotlight_y: 'SPOTLIGHT_Y',
    spotlight_z: 'SPOTLIGHT_Z',
    target_y: 'TARGET_Y',
    target_z: 'TARGET_Z',
    emitter_disc_radius: 'EMITTER_DISC_RADIUS',
    emitter_disc_x: 'EMITTER_DISC_X',
    emitter_disc_y: 'EMITTER_DISC_Y',
    emitter_disc_z: 'EMITTER_DISC_Z',
    emitter_disc_opacity: 'EMITTER_DISC_OPACITY',
    fixture_scale: 'FIXTURE_SCALE',
    wall_mount_offset: 'WALL_MOUNT_OFFSET',
  }

  const wireControls = () => {
    const firstControl = document.getElementById('spotlight_intensity') as HTMLInputElement | null
    if (!firstControl) return
    const panel = document.getElementById('spotlight_slider_panel')
    if (panel?.dataset.wired === 'true') return
    if (panel) panel.dataset.wired = 'true'

    Object.entries(sliderMap).forEach(([id, key]) => {
      const input = document.getElementById(id) as HTMLInputElement | null
      if (!input) return
      input.value = String(tuning[key] ?? 0)
      input.addEventListener('input', () => {
        tuning[key] = Number(input.value)
        onInputChange()
      })
    })

    const exportButton = document.getElementById('export_button') as HTMLButtonElement | null
    const exportStatus = document.getElementById('export_status') as HTMLElement | null
    exportButton?.addEventListener('click', async () => {
      const json = JSON.stringify(tuning, null, 2)
      let copied = false
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(json)
          copied = true
        }
      } catch (_err) {
        copied = false
      }

      if (!copied) {
        const textArea = document.createElement('textarea')
        textArea.value = json
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        copied = document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      if (copied) {
        if (exportStatus) exportStatus.textContent = 'Copied.'
        console.debug('Spotlight tuning JSON copied:', json)
      } else {
        if (exportStatus) exportStatus.textContent = 'Copy failed.'
        console.debug('Spotlight tuning JSON:', json)
      }
    })
  }

  wireControls()
  if (typeof window !== 'undefined') {
    window.addEventListener('spotlight-slider-ready', wireControls as EventListener)
  }
}
