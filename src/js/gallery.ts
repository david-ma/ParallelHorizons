/**
 * Default (hardcoded) gallery: floor, walls, ceiling, paintings and spotlights.
 */
import * as THREE from 'three'
import type { Gal } from './types.js'
import { drawFrame } from './artwork.js'
import { addGalleryCeiling, createFloorMaterial, createWallMaterial } from './materials.js'
import { addArtworkSpotlightRig, spotlightOptionsForArtwork } from './spotlight.js'

export function buildDefaultGallery(g: Gal): void {
  g.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  g.scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 0.6))

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), createFloorMaterial(24, 24))
  floor.rotation.x = Math.PI / 2
  floor.rotation.y = Math.PI
  g.scene.add(floor)
  addGalleryCeiling(g.scene, 45, 45)

  g.wallGroup = new THREE.Group()
  g.scene.add(g.wallGroup)
  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), createWallMaterial(40)) as THREE.Mesh & {
    BBox?: THREE.Box3
  }
  const wall2 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), createWallMaterial(6)) as THREE.Mesh & {
    BBox?: THREE.Box3
  }
  const wall3 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), createWallMaterial(6)) as THREE.Mesh & {
    BBox?: THREE.Box3
  }
  const wall4 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), createWallMaterial(40)) as THREE.Mesh & {
    BBox?: THREE.Box3
  }
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

  g.num_of_paintings = 30
  g.paintings = []
  const half = Math.floor(g.num_of_paintings / 2) - 1

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

      art.add(plane)
      g.scene.add(art)
      art.updateMatrixWorld(true)
      addArtworkSpotlightRig(g.scene, spotlightOptionsForArtwork(art), art)
      g.paintings.push(art)
    }
    ;(img.map as any).needsUpdate = true
  }
}
