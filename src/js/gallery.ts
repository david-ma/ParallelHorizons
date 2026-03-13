/**
 * Default (hardcoded) gallery: floor, walls, ceiling, paintings and one featured spotlight.
 */
import * as THREE from 'three'
import type { Gal } from './types.js'
import { drawFrame } from './artwork.js'
import {
  addArtworkSpotlightRig,
  applyArtworkSpotlightRigOptions,
  bindSpotlightSliderControls,
  type SpotlightRigOptions,
} from './spotlight.js'

const SPOTLIGHT_MODEL_URL = '/models/spotlight/Spotlight.glb'

export function buildDefaultGallery(g: Gal): void {
  g.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  g.scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 0.6))

  const floorText = new THREE.TextureLoader().load('/img/Textures/Floor.jpg')
  floorText.colorSpace = THREE.SRGBColorSpace
  floorText.wrapS = THREE.RepeatWrapping
  floorText.wrapT = THREE.RepeatWrapping
  floorText.repeat.set(24, 24)
  const floorMaterial = new THREE.MeshPhongMaterial({ map: floorText })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), floorMaterial)
  floor.rotation.x = Math.PI / 2
  floor.rotation.y = Math.PI
  g.scene.add(floor)

  g.wallGroup = new THREE.Group()
  g.scene.add(g.wallGroup)
  const wall1 = new THREE.Mesh(
    new THREE.BoxGeometry(40, 6, 0.001),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  ) as THREE.Mesh & { BBox?: THREE.Box3 }
  const wall2 = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 0.001),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  ) as THREE.Mesh & { BBox?: THREE.Box3 }
  const wall3 = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 0.001),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  ) as THREE.Mesh & { BBox?: THREE.Box3 }
  const wall4 = new THREE.Mesh(
    new THREE.BoxGeometry(40, 6, 0.001),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  ) as THREE.Mesh & { BBox?: THREE.Box3 }
  g.wallGroup.add(wall1, wall2, wall3, wall4)
  g.wallGroup.position.y = 3
  wall1.position.z = -3
  wall2.position.x = -20
  wall2.rotation.y = Math.PI / 2
  wall3.position.x = 20
  wall3.rotation.y = -Math.PI / 2
  wall4.position.z = 3
  wall4.rotation.y = Math.PI
  ;[wall1, wall2, wall3, wall4].forEach((w) => {
    w.BBox = new THREE.Box3().setFromObject(w)
  })

  const ceilMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee })
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), ceilMaterial)
  ceil.position.y = 6
  ceil.rotation.x = Math.PI / 2
  g.scene.add(ceil)

  g.num_of_paintings = 30
  g.paintings = []
  const half = Math.floor(g.num_of_paintings / 2) - 1
  const featuredSpotlightIndex = Math.floor(half / 2)

  for (let i = 0; i < g.num_of_paintings; i++) {
    const index = i
    const source = '/img/Artworks/' + index + '.jpg'
    const texture = new THREE.TextureLoader().load(source)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    const img = new THREE.MeshLambertMaterial({ map: texture })
    const artwork = new Image()
    artwork.src = source
    artwork.onload = () => {
      if (artwork.width <= 100) return
      const ratiow = artwork.width / 1700
      const ratioh = artwork.height / 1700
      const art = new THREE.Group()
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(ratiow, ratioh), img)
      ;(plane as any).overdraw = true
      if (index <= half) {
        plane.position.set(2.5 * index - 17.5, 2, -2.96)
        const mesh = drawFrame(
          { x: 2.5 * index - 17.5 - ratiow / 2 - 0.3, y: 2 + ratioh / 2 + 0.3, z: -3 },
          { x: 2.5 * index - 17.5 + ratiow / 2 + 0.3, y: 2 - ratioh / 2 - 0.3, z: -3 },
          0.03
        )
        art.add(mesh)
      } else {
        plane.position.set(2.5 * index - 55, 2, 2.96)
        plane.rotation.y = Math.PI
        const mesh = drawFrame(
          { x: 2.5 * index - 55 - ratiow / 2 - 0.3, y: 2 + ratioh / 2 + 0.3, z: -3 },
          { x: 2.5 * index - 55 + ratiow / 2 + 0.3, y: 2 - ratioh / 2 - 0.3, z: -3 },
          0.03
        )
        mesh.rotation.y = Math.PI
        art.add(mesh)
      }

      if (index === featuredSpotlightIndex) {
        const spotlightTuning: Record<string, number> = {
          SPOTLIGHT_INTENSITY: 1.9,
          SPOTLIGHT_DISTANCE: 8,
          SPOTLIGHT_ANGLE: Math.PI / 7,
          SPOTLIGHT_PENUMBRA: 0.45,
          SPOTLIGHT_DECAY: 1.2,
          SPOTLIGHT_X: plane.position.x,
          SPOTLIGHT_Y: 5.35,
          SPOTLIGHT_Z: -2.95,
          TARGET_Y: 2,
          TARGET_Z: -2.96,
          EMITTER_DISC_RADIUS: 0.1,
          EMITTER_DISC_X: 0,
          EMITTER_DISC_Y: 0,
          EMITTER_DISC_Z: 0.17,
          EMITTER_DISC_OPACITY: 0.95,
          FIXTURE_SCALE: 0.35,
          WALL_Z: -2.96,
          WALL_MOUNT_OFFSET: 0.02,
        }

        const options: SpotlightRigOptions = {
          lightOrigin: new THREE.Vector3(
            spotlightTuning.SPOTLIGHT_X,
            spotlightTuning.SPOTLIGHT_Y,
            spotlightTuning.SPOTLIGHT_Z
          ),
          lightTarget: new THREE.Vector3(plane.position.x, spotlightTuning.TARGET_Y, spotlightTuning.TARGET_Z),
          modelUrl: SPOTLIGHT_MODEL_URL,
          intensity: spotlightTuning.SPOTLIGHT_INTENSITY,
          distance: spotlightTuning.SPOTLIGHT_DISTANCE,
          angle: spotlightTuning.SPOTLIGHT_ANGLE,
          penumbra: spotlightTuning.SPOTLIGHT_PENUMBRA,
          decay: spotlightTuning.SPOTLIGHT_DECAY,
          emitterRadius: spotlightTuning.EMITTER_DISC_RADIUS,
          emitterOffsetX: spotlightTuning.EMITTER_DISC_X,
          emitterOffsetY: spotlightTuning.EMITTER_DISC_Y,
          emitterOffsetZ: spotlightTuning.EMITTER_DISC_Z,
          emitterOpacity: spotlightTuning.EMITTER_DISC_OPACITY,
          fixtureScale: spotlightTuning.FIXTURE_SCALE,
          wallZ: spotlightTuning.WALL_Z,
          wallMountOffset: spotlightTuning.WALL_MOUNT_OFFSET,
        }

        const spotlightRig = addArtworkSpotlightRig(g.scene, options)

        bindSpotlightSliderControls(spotlightTuning, () => {
          spotlightRig.options.lightOrigin.set(
            spotlightTuning.SPOTLIGHT_X,
            spotlightTuning.SPOTLIGHT_Y,
            spotlightTuning.SPOTLIGHT_Z
          )
          spotlightRig.options.lightTarget.set(plane.position.x, spotlightTuning.TARGET_Y, spotlightTuning.TARGET_Z)
          spotlightRig.options.intensity = spotlightTuning.SPOTLIGHT_INTENSITY
          spotlightRig.options.distance = spotlightTuning.SPOTLIGHT_DISTANCE
          spotlightRig.options.angle = spotlightTuning.SPOTLIGHT_ANGLE
          spotlightRig.options.penumbra = spotlightTuning.SPOTLIGHT_PENUMBRA
          spotlightRig.options.decay = spotlightTuning.SPOTLIGHT_DECAY
          spotlightRig.options.emitterRadius = spotlightTuning.EMITTER_DISC_RADIUS
          spotlightRig.options.emitterOffsetX = spotlightTuning.EMITTER_DISC_X
          spotlightRig.options.emitterOffsetY = spotlightTuning.EMITTER_DISC_Y
          spotlightRig.options.emitterOffsetZ = spotlightTuning.EMITTER_DISC_Z
          spotlightRig.options.emitterOpacity = spotlightTuning.EMITTER_DISC_OPACITY
          spotlightRig.options.fixtureScale = spotlightTuning.FIXTURE_SCALE
          spotlightRig.options.wallZ = spotlightTuning.WALL_Z
          spotlightRig.options.wallMountOffset = spotlightTuning.WALL_MOUNT_OFFSET
          applyArtworkSpotlightRigOptions(spotlightRig)
          g.renderer.render(g.scene, g.camera)
        })
      }

      art.add(plane)
      g.scene.add(art)
      g.paintings.push(art)
    }
    ;(img.map as any).needsUpdate = true
  }
}
