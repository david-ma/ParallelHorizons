/**
 * Rapier physics for the gallery: floor, walls, and player body.
 * Keeps the camera from passing through walls and provides sliding.
 */
import type RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { Gal } from './types.js'

let RAPIER_MODULE: typeof RAPIER | null = null

/**
 * Initialize the Rapier WASM module. Call once before creating the world.
 */
export async function initRapier(): Promise<void> {
  if (RAPIER_MODULE) return
  RAPIER_MODULE = (await import('@dimforge/rapier3d-compat')).default
  await RAPIER_MODULE.init()
}

/**
 * Create the physics world, floor, wall colliders from g.wallGroup, and player rigid body.
 * Call after the scene (and wallGroup) has been built (e.g. after create()).
 */
export function createGalleryPhysics(g: Gal): {
  world: RAPIER.World
  playerBody: RAPIER.RigidBody
} {
  const R = RAPIER_MODULE!
  const world = new R.World(new R.Vector3(0, -9.81, 0))

  // Floor: cuboid so its top is at y=1.25 (player center 1.75, collider halfHeight 0.5)
  const floorHalfX = Math.max(25, (g.maxX - g.minX) / 2 + 2)
  const floorHalfZ = Math.max(25, (g.maxZ - g.minZ) / 2 + 2)
  const floorHalfY = 0.625
  const floorDesc = R.ColliderDesc.cuboid(floorHalfX, floorHalfY, floorHalfZ).setTranslation(0, 0.625, 0)
  world.createCollider(floorDesc)

  // Walls: one static cuboid per mesh in g.wallGroup (use world matrix + geometry size)
  g.wallGroup.updateMatrixWorld(true)
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  for (let i = 0; i < g.wallGroup.children.length; i++) {
    const mesh = g.wallGroup.children[i] as THREE.Mesh
    if (!mesh.geometry) continue
    const params = (mesh.geometry as THREE.BoxGeometry).parameters
    if (!params) continue
    const w = params.width ?? 1
    const h = params.height ?? 1
    const d = params.depth ?? 1
    mesh.getWorldPosition(pos)
    mesh.getWorldQuaternion(quat)
    mesh.getWorldScale(scale)
    const hx = (w * scale.x) / 2
    const hy = (h * scale.y) / 2
    const hz = (d * scale.z) / 2
    const rot: RAPIER.Rotation = { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
    const wallDesc = R.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(rot)
    world.createCollider(wallDesc)
  }

  // Player: dynamic cuboid, locked rotation, same size as the visual user box (1.2 x 1 x 1.2)
  const playerHalfX = 0.6
  const playerHalfY = 0.5
  const playerHalfZ = 0.6
  const bodyDesc = R.RigidBodyDesc.newDynamic()
    .setTranslation(g.camera.position.x, g.camera.position.y, g.camera.position.z)
    .lockRotations()
  const playerBody = world.createRigidBody(bodyDesc)
  const playerCollider = R.ColliderDesc.cuboid(playerHalfX, playerHalfY, playerHalfZ)
  world.createCollider(playerCollider, playerBody)

  return { world, playerBody }
}

/**
 * Step the physics world and sync the camera to the player body.
 * Call after updating g.moveVelocity from input; this applies velocity, steps, then copies body position back to camera and updates moveVelocity from body linvel.
 */
export function stepPhysics(
  world: RAPIER.World,
  playerBody: RAPIER.RigidBody,
  g: Gal,
  delta: number
): void {
  const dt = Math.min(delta, 1 / 30)
  playerBody.setLinvel(
    { x: g.moveVelocity.x, y: g.moveVelocity.y, z: g.moveVelocity.z },
    true
  )
  world.step()
  const t = playerBody.translation()
  g.camera.position.set(t.x, t.y, t.z)
  const v = playerBody.linvel()
  g.moveVelocity.set(v.x, v.y, v.z)
  if (t.y <= 1.76 && v.y <= 0.1) g.jump = true
  g.pastX = t.x
  g.pastZ = t.z
  g.user.BBox?.setFromObject(g.user)
}
