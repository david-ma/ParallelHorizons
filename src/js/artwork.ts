/**
 * Artwork helpers: frames and moulding for paintings.
 */
import * as THREE from 'three'

/**
 * Builds a 3D frame group between two corners with given thickness (legacy style).
 */
export function drawFrame(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number
): THREE.Group {
  const frame = new THREE.Group()
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []

  vertices.push(a.x - t, a.y + t, a.z + t, b.x + t, a.y + t, a.z + t, b.x + t, b.y - t, a.z + t, a.x - t, b.y - t, a.z + t)
  vertices.push(a.x + t, a.y - t, a.z + t, b.x - t, a.y - t, a.z + t, b.x - t, b.y + t, a.z + t, a.x + t, b.y + t, a.z + t)
  indices.push(0, 5, 1, 0, 4, 5, 0, 3, 7, 0, 7, 4, 3, 6, 7, 3, 2, 6, 2, 5, 6, 2, 1, 5)

  vertices.push(a.x - t, a.y + t, a.z - t, b.x + t, a.y + t, a.z - t, b.x + t, b.y - t, a.z - t, a.x - t, b.y - t, a.z - t)
  vertices.push(a.x + t, a.y - t, a.z - t, b.x - t, a.y - t, a.z - t, b.x - t, b.y + t, a.z - t, a.x + t, b.y + t, a.z - t)
  indices.push(0, 9, 8, 0, 1, 9, 9, 1, 2, 9, 2, 10, 2, 3, 11, 2, 11, 10, 8, 11, 3, 8, 3, 0)
  indices.push(4, 12, 13, 4, 13, 5, 5, 13, 14, 5, 14, 6, 14, 15, 7, 14, 7, 6, 4, 7, 15, 4, 15, 12)
  indices.push(8, 10, 11, 8, 9, 10)

  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
  geometry.setIndex(indices)
  const colors = new Float32Array(indices.length * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.MeshBasicMaterial({ color: 0x111111 })
  const blackBorders = new THREE.Mesh(geometry, material)
  frame.add(blackBorders)

  const backingGeometry = new THREE.BufferGeometry()
  backingGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
  backingGeometry.setIndex([12, 14, 13, 12, 15, 14])
  const backingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const backing = new THREE.Mesh(backingGeometry, backingMaterial)
  frame.add(backing)

  return frame
}

/**
 * Adds black outer frame and white inner moulding to an artwork group (plane assumed at z = 0.005).
 */
export function addFrameToArtwork(parent: THREE.Group, artWidth: number, artHeight: number): void {
  const frameThickness = 0.06
  const frameDepth = 0.03
  const frameColor = 0x111111
  const matThickness = 0.045
  const matDepth = 0.012
  const matColor = 0xffffff
  const mat = new THREE.MeshBasicMaterial({ color: frameColor })
  const mouldingMat = new THREE.MeshBasicMaterial({ color: matColor })

  // White inner moulding/mat between image and outer frame.
  const matTop = new THREE.Mesh(new THREE.BoxGeometry(artWidth + matThickness * 2, matThickness, matDepth), mouldingMat)
  matTop.position.set(0, artHeight / 2 + matThickness / 2, -matDepth / 2)
  parent.add(matTop)

  const matBottom = new THREE.Mesh(new THREE.BoxGeometry(artWidth + matThickness * 2, matThickness, matDepth), mouldingMat)
  matBottom.position.set(0, -artHeight / 2 - matThickness / 2, -matDepth / 2)
  parent.add(matBottom)

  const matLeft = new THREE.Mesh(new THREE.BoxGeometry(matThickness, artHeight, matDepth), mouldingMat)
  matLeft.position.set(-artWidth / 2 - matThickness / 2, 0, -matDepth / 2)
  parent.add(matLeft)

  const matRight = new THREE.Mesh(new THREE.BoxGeometry(matThickness, artHeight, matDepth), mouldingMat)
  matRight.position.set(artWidth / 2 + matThickness / 2, 0, -matDepth / 2)
  parent.add(matRight)

  // Outer black frame sits outside the white moulding (no overlap).
  const outerWidth = artWidth + (matThickness + frameThickness) * 2
  const outerHeight = artHeight + (matThickness + frameThickness) * 2

  const top = new THREE.Mesh(new THREE.BoxGeometry(outerWidth, frameThickness, frameDepth), mat)
  top.position.set(0, artHeight / 2 + matThickness + frameThickness / 2, -frameDepth / 2)
  parent.add(top)

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(outerWidth, frameThickness, frameDepth), mat)
  bottom.position.set(0, -artHeight / 2 - matThickness - frameThickness / 2, -frameDepth / 2)
  parent.add(bottom)

  const left = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, outerHeight, frameDepth), mat)
  left.position.set(-artWidth / 2 - matThickness - frameThickness / 2, 0, -frameDepth / 2)
  parent.add(left)

  const right = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, outerHeight, frameDepth), mat)
  right.position.set(artWidth / 2 + matThickness + frameThickness / 2, 0, -frameDepth / 2)
  parent.add(right)
}
