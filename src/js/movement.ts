/**
 * Movement: keyboard input and camera/velocity updates.
 * WASD / arrows are relative to the camera’s facing direction (forward/right in XZ).
 */
import * as THREE from 'three'
import type { Gal } from './types.js'

const speed = 38.0
const PI_2 = Math.PI / 2

const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()

/**
 * Camera’s forward and right in the XZ plane (Y up). Used so WASD move relative to view.
 * Right = dir × up (right-hand rule). Use dir×up not up×dir so A/D map to left/right correctly.
 */
function getCameraForwardRight(g: Gal): { dir: THREE.Vector3; right: THREE.Vector3 } {
  _dir.set(0, 0, -1).applyQuaternion(g.camera.quaternion)
  _dir.y = 0
  _dir.normalize()
  _right.crossVectors(_dir, new THREE.Vector3(0, 1, 0)).normalize()
  return { dir: _dir, right: _right }
}

/**
 * Attaches keydown/keyup listeners for WASD, arrows, and space (jump).
 */
export function attachMovementKeys(g: Gal): void {
  document.addEventListener('keydown', (e) => {
    if (e.keyCode === 87 || e.keyCode === 38) g.moveForward = true
    else if (e.keyCode === 65 || e.keyCode === 37) g.moveLeft = true
    else if (e.keyCode === 83 || e.keyCode === 40) g.moveBackward = true
    else if (e.keyCode === 68 || e.keyCode === 39) g.moveRight = true
    else if (e.keyCode === 32 && g.jump) {
      if ((g as { physicsWorld?: unknown }).physicsWorld) {
        g.moveVelocity.y = 5.5
      } else {
        g.moveVelocity.y += 0.2
      }
      g.jump = false
    }
  })
  document.addEventListener('keyup', (e) => {
    if (e.keyCode === 87 || e.keyCode === 38) g.moveForward = false
    else if (e.keyCode === 65 || e.keyCode === 37) g.moveLeft = false
    else if (e.keyCode === 83 || e.keyCode === 40) g.moveBackward = false
    else if (e.keyCode === 68 || e.keyCode === 39) g.moveRight = false
  })
}

/**
 * Updates only velocity (and look) from input. Use with physics: call this then stepPhysics.
 * Does not move the camera or apply gravity (physics handles that).
 * Velocity is built in world space from camera-relative dir/right so Rapier gets correct sliding.
 */
export function updateVelocityOnly(g: Gal, delta: number): void {
  // Analog/gamepad look
  if (g.analogX || g.analogY) {
    g.euler.setFromQuaternion(g.camera.quaternion)
    g.euler.y -= g.analogY * 0.04
    g.euler.x -= g.analogX * 0.04
    g.euler.x = Math.max(-PI_2, Math.min(PI_2, g.euler.x))
    g.camera.quaternion.setFromEuler(g.euler)
  }
  const { dir, right } = getCameraForwardRight(g)
  g.moveVelocity.x -= g.moveVelocity.x * 10.0 * delta
  g.moveVelocity.z -= g.moveVelocity.z * 10.0 * delta
  if (g.moveForward) g.moveVelocity.addScaledVector(dir, speed * delta)
  if (g.moveBackward) g.moveVelocity.addScaledVector(dir, -speed * delta)
  if (g.moveLeft) g.moveVelocity.addScaledVector(right, -speed * delta)
  if (g.moveRight) g.moveVelocity.addScaledVector(right, speed * delta)
  if (g.analogForward) g.moveVelocity.addScaledVector(dir, speed * g.analogForward * delta)
  if (g.analogBackward) g.moveVelocity.addScaledVector(dir, -speed * g.analogBackward * delta)
  if (g.analogLeft) g.moveVelocity.addScaledVector(right, -speed * g.analogLeft * delta)
  if (g.analogRight) g.moveVelocity.addScaledVector(right, speed * g.analogRight * delta)
}

/**
 * Updates velocity, position, and camera bounds for one frame. Call from render loop when controls are active (non-physics path).
 */
export function updateMovement(g: Gal, delta: number): void {
  const prevX = g.camera.position.x
  const prevZ = g.camera.position.z

  // Analog/gamepad look
  if (g.analogX || g.analogY) {
    g.euler.setFromQuaternion(g.camera.quaternion)
    g.euler.y -= g.analogY * 0.04
    g.euler.x -= g.analogX * 0.04
    g.euler.x = Math.max(-PI_2, Math.min(PI_2, g.euler.x))
    g.camera.quaternion.setFromEuler(g.euler)
  }

  const { dir, right } = getCameraForwardRight(g)
  g.moveVelocity.x -= g.moveVelocity.x * 10.0 * delta
  g.moveVelocity.z -= g.moveVelocity.z * 10.0 * delta
  if (g.moveForward) g.moveVelocity.addScaledVector(dir, speed * delta)
  if (g.moveBackward) g.moveVelocity.addScaledVector(dir, -speed * delta)
  if (g.moveLeft) g.moveVelocity.addScaledVector(right, -speed * delta)
  if (g.moveRight) g.moveVelocity.addScaledVector(right, speed * delta)
  if (g.analogForward) g.moveVelocity.addScaledVector(dir, speed * g.analogForward * delta)
  if (g.analogBackward) g.moveVelocity.addScaledVector(dir, -speed * g.analogBackward * delta)
  if (g.analogLeft) g.moveVelocity.addScaledVector(right, -speed * g.analogLeft * delta)
  if (g.analogRight) g.moveVelocity.addScaledVector(right, speed * g.analogRight * delta)
  // Apply horizontal velocity: project world (v.x,v.z) onto camera forward/right for PointerLockControls
  const forwardDist = (g.moveVelocity.x * dir.x + g.moveVelocity.z * dir.z) * delta
  const rightDist = (g.moveVelocity.x * right.x + g.moveVelocity.z * right.z) * delta
  g.controls.moveForward(-forwardDist)
  g.controls.moveRight(rightDist)

  if (g.targetPosition) {
    const deltaX = g.camera.position.x - g.targetPosition.x
    const deltaZ = g.camera.position.z - g.targetPosition.z
    g.camera.position.x -= (speed * Math.cbrt(deltaX) * delta) / 12
    g.camera.position.z -= (speed * Math.cbrt(deltaZ) * delta) / 12
    if (deltaX * deltaX < 0.001 && deltaZ * deltaZ < 0.001) {
      delete (g as any).targetPosition
      if (g.queue.length !== 0) g.queue.shift()!()
    }
  }
  const qTarget = (g.camera as any).quaternionTarget as import('three').Quaternion | undefined
  if (qTarget) {
    g.camera.quaternion.rotateTowards(qTarget, 0.03)
    if (g.camera.quaternion.equals(qTarget)) {
      delete (g.camera as any).quaternionTarget
      if (g.queue.length !== 0) g.queue.shift()!()
    }
  }

  g.camera.position.z = Math.max(g.minZ, Math.min(g.maxZ, g.camera.position.z))
  g.camera.position.x = Math.max(g.minX, Math.min(g.maxX, g.camera.position.x))
  g.moveVelocity.y -= 0.6 * delta
  g.camera.position.y += g.moveVelocity.y
  if (g.camera.position.y < 1.75) {
    g.jump = true
    g.moveVelocity.y = 0
    g.camera.position.y = 1.75
  }
  if (g.camera.position.y > 5) {
    g.moveVelocity.y = 0
    g.camera.position.y = 5
  }

  g.pastX = prevX
  g.pastZ = prevZ
  g.user.BBox?.setFromObject(g.user)
}
