/**
 * 3D gallery viewer — entry point for the /view page.
 * Scene, pointer lock, and render loop; layout/gallery/artwork/spotlight/movement are in separate modules.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { Gal } from './types.js'
import { loadFloorplanAsync, buildSceneFromFloorplan, buildMinimalGallery } from './layout.js'
import { attachMovementKeys, updateMovement, updateVelocityOnly } from './movement.js'
import { initRapier, createGalleryPhysics, stepPhysics } from './physics.js'

let lastCalledTime: number | undefined
let fps = 0
let counter = 0

function framerate(): void {
  if (!lastCalledTime) {
    lastCalledTime = performance.now()
    fps = 0
    return
  }
  const delta = (performance.now() - lastCalledTime) / 1000
  lastCalledTime = performance.now()
  fps = 1 / delta
  if (counter++ % 15 === 0) {
    const el = document.getElementById('fps')
    if (el) el.textContent = String(Math.floor(fps))
  }
}

const Detector = typeof window !== 'undefined' ? (window as any).Detector : null
let gal: Gal | null = null

console.log('Starting gallery main.ts')
console.log('THREE version:', THREE.REVISION)

function setLayoutLoading(visible: boolean, message?: string): void {
  const el = document.getElementById('gallery-loading')
  if (!el) return
  el.classList.toggle('hide', !visible)
  const text = el.querySelector('.gallery-loading-text')
  if (text && message) text.textContent = message
}

async function runGallery(): Promise<void> {
  await initRapier()
  if (!gal) return
  const { world, playerBody } = createGalleryPhysics(gal)
  gal.physicsWorld = world
  gal.playerBody = playerBody
  gal.render()
}

if (Detector && !Detector.webgl) {
  alert('Your browser does not support WebGL!')
} else {
  gal = {
    queue: [],
    axis: new THREE.Vector3(0, 1, 0),
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
    renderer: new THREE.WebGLRenderer({ antialias: true }),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(0, 0),
    pastX: 0,
    pastZ: 0,
    intersects: [],
    minX: -18,
    maxX: 18,
    minZ: -2,
    maxZ: 2,

    raycastSetUp() {
      gal!.mouse.x = 0
      gal!.mouse.y = 0
      ;(gal!.mouse as any).z = 0.0001
    },

    boot() {
      gal!.prevTime = performance.now()
      gal!.initialRender = true
      ;(gal!.scene as any).fog = new THREE.FogExp2(0x666666, 0.05)

      const resizeViewport = () => {
        const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1)
        const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1)
        gal!.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        gal!.renderer.setSize(width, height)
        gal!.camera.aspect = width / height
        gal!.camera.updateProjectionMatrix()
      }

      resizeViewport()
      gal!.renderer.setClearColor(0xffffff, 1)
      gal!.renderer.toneMapping = THREE.NoToneMapping
      gal!.renderer.toneMappingExposure = 1
      gal!.renderer.outputColorSpace = THREE.SRGBColorSpace
      document.body.appendChild(gal!.renderer.domElement)

      // Player collision box (width, height, depth). Slightly smaller than original 2×1×2
      // so the camera can get closer to the walls without feeling bulky.
      const userBoxGeo = new THREE.BoxGeometry(1.2, 1, 1.2)
      const userBoxMat = new THREE.MeshBasicMaterial({ color: 0xeeee99, wireframe: true })
      gal!.user = new THREE.Mesh(userBoxGeo, userBoxMat) as THREE.Mesh & { BBox?: THREE.Box3 }
      gal!.user.visible = false
      gal!.user.BBox = new THREE.Box3()
      gal!.camera.add(gal!.user)
      gal!.camera.position.y = 1.75

      gal!.controls = new PointerLockControls(gal!.camera, gal!.renderer.domElement)
      gal!.scene.add(gal!.camera)
      gal!.pastX = gal!.camera.position.x
      gal!.pastZ = gal!.camera.position.z
      gal!.canvas = document.querySelector('canvas')
      if (gal!.canvas) gal!.canvas.className = 'gallery'
      gal!.bgMenu = document.querySelector('#background_menu')
      gal!.play = document.querySelector('#play_button')
      gal!.menu = document.getElementById('menu')

      gal!.moveVelocity = new THREE.Vector3()
      gal!.jump = true
      gal!.moveForward = false
      gal!.moveBackward = false
      gal!.moveLeft = false
      gal!.moveRight = false
      gal!.run = false
      gal!.analogForward = 0
      gal!.analogBackward = 0
      gal!.analogLeft = 0
      gal!.analogRight = 0
      gal!.analogX = 0
      gal!.analogY = 0

      window.addEventListener('resize', resizeViewport)
      window.addEventListener('orientationchange', resizeViewport)
      window.visualViewport?.addEventListener('resize', resizeViewport)
    },

    pointerControls() {
      const g = gal!
      const doc = g.canvas?.ownerDocument ?? document
      if ('pointerLockElement' in doc || 'mozPointerLockElement' in doc || 'webkitPointerLockElement' in doc) {
        function releaseToMenu() {
          g.moveForward = false
          g.moveBackward = false
          g.moveLeft = false
          g.moveRight = false
          g.run = false
          g.analogForward = 0
          g.analogBackward = 0
          g.analogLeft = 0
          g.analogRight = 0
          g.analogX = 0
          g.analogY = 0
          const d = g.canvas?.ownerDocument ?? document
          const hasLock =
            d.pointerLockElement === g.canvas ||
            (d as any).mozPointerLockElement === g.canvas ||
            (d as any).webkitPointerLockElement === g.canvas
          if (hasLock) {
            d.exitPointerLock?.()
            ;(d as any).mozExitPointerLock?.()
            ;(d as any).webkitExitPointerLock?.()
          } else {
            g.controls.enabled = false
            g.menu?.classList.remove('hide')
            g.bgMenu?.classList.remove('hide')
          }
          console.debug('Pointer lock released; showing menu for re-entry.')
        }

        ;(g.canvas as any).requestPointerLock =
          (g.canvas as any).requestPointerLock ||
          (g.canvas as any).mozRequestPointerLock ||
          (g.canvas as any).webkitRequestPointerLock
        ;(g.canvas as any).exitPointerLock =
          (g.canvas as any).exitPointerLock ||
          (g.canvas as any).mozExitPointerLock ||
          (g.canvas as any).webkitExitPointerLock

        document.addEventListener('keydown', (e) => {
          if (e.keyCode === 102 || e.keyCode === 70) {
            g.toggleFullscreen()
            ;(g.canvas as any).requestPointerLock?.()
          } else if (e.key === 'Escape' || e.keyCode === 27) {
            releaseToMenu()
          }
        })

        g.bgMenu?.addEventListener('click', () => {
          ;(g.canvas as any).requestPointerLock?.()
        })
        g.play?.addEventListener('click', () => {
          ;(g.canvas as any).requestPointerLock?.()
        })
        document.addEventListener('pointerlockchange', g.changeCallback, false)
        document.addEventListener('mozpointerlockchange', g.changeCallback, false)
        document.addEventListener('webkitpointerlockchange', g.changeCallback, false)
        document.addEventListener('pointerlockerror', g.errorCallback, false)
        document.addEventListener('mozpointerlockerror', g.errorCallback, false)
        document.addEventListener('webkitpointerlockerror', g.errorCallback, false)

        window.addEventListener('blur', releaseToMenu)
        window.addEventListener('pagehide', releaseToMenu)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') releaseToMenu()
        })
      } else {
        g.screensaver = true
        const positions: { z: number; x: number }[] = []
        ;[1, -1].forEach((z) => {
          for (let i = 0; i < 9; i++) positions.push({ z, x: -10 + 2.5 * i })
        })
        g.play?.addEventListener('click', () => {
          g.menu?.classList.add('hide')
          g.bgMenu?.classList.add('hide')
          const moveToTarget = (target: { z: number; x: number }) => {
            const targetPos = new THREE.Vector2(target.z, target.x)
            const currentPos = new THREE.Vector2(g.camera.position.z, g.camera.position.x)
            const angle = currentPos.sub(targetPos).angle()
            g.queue = []
            g.queue.push(() => {
              ;(g.camera as any).quaternionTarget = new THREE.Quaternion().setFromAxisAngle(g.axis, angle)
            })
            g.queue.push(() => {
              g.targetPosition = { x: target.x, y: 1.75, z: target.z }
            })
            g.queue.push(() => {
              const a = new THREE.Vector2(-1 * target.z, 0).angle()
              ;(g.camera as any).quaternionTarget = new THREE.Quaternion().setFromAxisAngle(g.axis, a)
            })
            g.queue.shift()!()
          }
          moveToTarget(positions[Math.floor(Math.random() * positions.length)]!)
          setInterval(() => moveToTarget(positions[Math.floor(Math.random() * positions.length)]!), 6500)
        })
      }
    },

    changeCallback() {
      const g = gal!
      const doc = g.canvas?.ownerDocument ?? document
      const locked =
        doc.pointerLockElement === g.canvas ||
        (doc as any).mozPointerLockElement === g.canvas ||
        (doc as any).webkitPointerLockElement === g.canvas
      if (locked) {
        g.controls.enabled = true
        g.menu?.classList.add('hide')
        g.bgMenu?.classList.add('hide')
        document.addEventListener('mousemove', g.moveCallback as any, false)
      } else {
        g.controls.enabled = false
        g.menu?.classList.remove('hide')
        g.bgMenu?.classList.remove('hide')
        document.removeEventListener('mousemove', g.moveCallback as any, false)
      }
    },

    errorCallback() {
      console.error('Pointer Lock Failed')
    },

    moveCallback(_event: MouseEvent) {},

    toggleFullscreen() {
      const doc = document as any
      if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen()
        else if ((document.documentElement as any).mozRequestFullScreen) (document.documentElement as any).mozRequestFullScreen()
        else if ((document.documentElement as any).webkitRequestFullscreen)
          (document.documentElement as any).webkitRequestFullscreen(1)
      } else {
        if (document.exitFullscreen) document.exitFullscreen()
        else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen()
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
      }
    },

    movement() {
      attachMovementKeys(gal!)
    },

    async create() {
      setLayoutLoading(true, 'Loading gallery layout…')
      try {
        const data = await loadFloorplanAsync()
        if (data) {
          buildSceneFromFloorplan(gal!, data)
        } else {
          buildMinimalGallery(gal!)
        }
      } finally {
        setLayoutLoading(false)
      }
    },

    animatedObjects: [],

    render() {
      const g = gal!
      framerate()
      requestAnimationFrame(g.render.bind(g))
      g.animatedObjects.forEach((obj) => obj.render(obj))
      if (g.screensaver || g.controls.enabled === true) {
        g.initialRender = false
        const currentTime = performance.now()
        const delta = (currentTime - g.prevTime) / 1000
        // Physics path when Rapier is set up and we have pointer lock (not screensaver)
        const usePhysics = g.physicsWorld && g.playerBody && !g.screensaver
        if (usePhysics) {
          updateVelocityOnly(g, delta)
          stepPhysics(g.physicsWorld!, g.playerBody!, g, delta)
          const clampedY = Math.max(1.75, Math.min(5, g.camera.position.y))
          if (g.camera.position.y !== clampedY) {
            g.camera.position.y = clampedY
            g.playerBody!.setTranslation({ x: g.camera.position.x, y: clampedY, z: g.camera.position.z }, true)
            if (clampedY >= 4.99) {
              const v = g.playerBody!.linvel()
              g.playerBody!.setLinvel({ x: v.x, y: 0, z: v.z }, true)
              g.moveVelocity.y = 0
            }
          }
        } else {
          // Legacy path: updateMovement (camera-relative velocity + manual collision) and wall color reset
          updateMovement(g, delta)
          g.raycaster.setFromCamera(g.mouse.clone(), g.camera)
          g.intersects = g.raycaster.intersectObjects(g.paintings)
          const desiredX = g.camera.position.x
          const desiredZ = g.camera.position.z
          const prevX = g.pastX
          const prevZ = g.pastZ
          const hasCollision = (): boolean => {
            g.user.BBox?.setFromObject(g.user)
            for (let i = 0; i < g.wallGroup.children.length; i++) {
              const child = g.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
              if (child.BBox && g.user.BBox && g.user.BBox.intersectsBox(child.BBox)) return true
            }
            return false
          }
          for (let i = 0; i < g.wallGroup.children.length; i++) {
            const child = g.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
            if (child.material && (child.material as THREE.MeshLambertMaterial).color) {
              ;(child.material as THREE.MeshLambertMaterial).color.set(0xffffff)
            }
          }
          if (hasCollision()) {
            g.camera.position.set(desiredX, g.camera.position.y, prevZ)
            if (hasCollision()) {
              g.camera.position.set(prevX, g.camera.position.y, desiredZ)
              if (hasCollision()) {
                g.camera.position.set(prevX, g.camera.position.y, prevZ)
                g.moveVelocity.x = 0
                g.moveVelocity.z = 0
              } else {
                g.moveVelocity.x = 0
              }
            } else {
              g.moveVelocity.z = 0
            }
            g.user.BBox?.setFromObject(g.user)
          }
        }
        g.prevTime = currentTime
        g.renderer.render(g.scene, g.camera)
      } else {
        g.prevTime = performance.now()
      }
      if (g.initialRender === true) {
        for (let i = 0; i < g.wallGroup.children.length; i++) {
          const child = g.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
          child.BBox?.setFromObject(child)
        }
        g.renderer.render(g.scene, g.camera)
      }
    },
  } as unknown as Gal

  ;(globalThis as any).gal = gal
  gal!.raycastSetUp()
  gal!.boot()
  gal!.pointerControls()
  gal!.movement()
  void gal!.create().then(() => runGallery())
}

export { gal }
