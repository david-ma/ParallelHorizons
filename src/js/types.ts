/**
 * Shared types for the 3D gallery viewer.
 */
import type * as THREE from 'three'
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

/** Editor exports one id per wall (string); viewer accepts string or string[] for backward compat. */
export interface FloorplanWallPlacements {
  north?: string | string[]
  east?: string | string[]
  south?: string | string[]
  west?: string | string[]
}

export interface FloorplanBlob {
  grid?: { rows?: number; cols?: number }
  activeCells?: string[]
  placements?: Record<string, string | FloorplanWallPlacements>
  photoCatalog?: Array<{ id: string; src: string; title?: string; artist?: string; year?: string | number }>
}

export interface Gal {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: PointerLockControls
  canvas: HTMLCanvasElement | null
  menu: HTMLElement | null
  bgMenu: HTMLElement | null
  play: HTMLElement | null
  user: THREE.Mesh & { BBox?: THREE.Box3 }
  wallGroup: THREE.Group
  paintings: THREE.Object3D[]
  num_of_paintings: number
  moveVelocity: THREE.Vector3
  jump: boolean
  moveForward: boolean
  moveBackward: boolean
  moveLeft: boolean
  moveRight: boolean
  run: boolean
  analogForward: number
  analogBackward: number
  analogLeft: number
  analogRight: number
  analogX: number
  analogY: number
  prevTime: number
  initialRender: boolean
  screensaver?: boolean
  queue: Array<() => void>
  axis: THREE.Vector3
  euler: THREE.Euler
  raycaster: THREE.Raycaster
  mouse: THREE.Vector2
  raycastSetUp: () => void
  boot: () => void
  pointerControls: () => void
  changeCallback: (event: Event) => void
  errorCallback: (event: Event) => void
  moveCallback: (event: MouseEvent) => void
  toggleFullscreen: () => void
  movement: () => void
  create: () => Promise<void>
  render: () => void
  animatedObjects: Array<{ render: (obj: unknown) => void }>
  pastX: number
  pastZ: number
  targetPosition?: { x: number; y: number; z: number }
  intersects: THREE.Intersection[]
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Set after create() when Rapier is used for collision. */
  physicsWorld?: import('@dimforge/rapier3d-compat').World
  playerBody?: import('@dimforge/rapier3d-compat').RigidBody
}
