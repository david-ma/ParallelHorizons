/**
 * Spotlight rigs for artworks and dev-only slider controls.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface SpotlightRigOptions {
  lightOrigin: THREE.Vector3
  lightTarget: THREE.Vector3
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
  wallZ: number
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
    rig.fixture.position.copy(rig.spotlight.position)
    rig.fixture.scale.setScalar(options.fixtureScale)
    rig.fixture.lookAt(rig.spotlightTarget.position)
    const bbox = new THREE.Box3().setFromObject(rig.fixture)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    rig.fixture.position.z = options.wallZ + size.z * 0.5 + options.wallMountOffset
  }
  if (rig.fallback) {
    rig.fallback.position.copy(rig.spotlight.position)
    rig.fallback.lookAt(rig.spotlightTarget.position)
  }
}

const spotlightModelLoader = new GLTFLoader()

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

  spotlightModelLoader.load(
    options.modelUrl,
    (gltf) => {
      const fixture = gltf.scene.clone(true)
      rig.fixture = fixture
      applyArtworkSpotlightRigOptions(rig)
      scene.add(fixture)
    },
    undefined,
    (err) => {
      console.error('Failed to load spotlight model:', err)
      const fallback = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.25, 12),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
      )
      rig.fallback = fallback
      applyArtworkSpotlightRigOptions(rig)
      scene.add(fallback)
    }
  )

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
