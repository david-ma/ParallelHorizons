import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { addFrameToArtwork, countArtworkFrameMeshes, drawFrame } from '../../src/js/artwork'

describe('addFrameToArtwork', () => {
  test('uses two merged meshes instead of eight separate boxes', () => {
    const art = new THREE.Group()
    addFrameToArtwork(art, 1.2, 0.8)
    expect(countArtworkFrameMeshes(art)).toBe(2)
  })

  test('merged frame keeps same triangle count as eight boxes', () => {
    const art = new THREE.Group()
    addFrameToArtwork(art, 1.2, 0.8)
    let tris = 0
    art.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const g = (obj as THREE.Mesh).geometry
        tris += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
      }
    })
    expect(tris).toBe(96)
  })
})

describe('drawFrame', () => {
  test('legacy frame uses two meshes', () => {
    const frame = drawFrame({ x: -1, y: 1, z: 0 }, { x: 1, y: -1, z: 0 }, 0.06)
    expect(countArtworkFrameMeshes(frame)).toBe(2)
  })
})
