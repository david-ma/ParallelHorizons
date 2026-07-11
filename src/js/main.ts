/**
 * 3D gallery viewer — entry point for the /view page.
 * Scene, pointer lock, and render loop; layout/gallery/artwork/spotlight/movement are in separate modules.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { Gal } from './types.js'
import { loadFloorplanAsync, buildSceneFromFloorplan, buildMinimalGallery, applySpawnPosition, preloadFloorplanTextures } from './layout.js'
import { attachMovementKeys, clearMovementState, updateMovement, updateVelocityOnly } from './movement.js'
import { initRapier, createGalleryPhysics, stepPhysics } from './physics.js'
import { initSpotlightDevPanel, updateSpotlightCulling, resolveMaxPixelRatio } from './spotlight.js'
import { initDevMinimap, updateDevMinimap } from './minimap.js'
import { initSpotlightDebug, updateSpotlightDebug } from './spotlight-debug.js'
import { initDevPerf, markPhase, recordFrame, type FramePhases } from './perf.js'

/** When the pause menu is up, refresh the frozen scene at 1 FPS instead of display rate. */
const PAUSED_FRAME_MS = 1000

let animationFrameId: number | null = null
let pauseTimeoutId: ReturnType<typeof setTimeout> | null = null

const emptyPhases = (): FramePhases => ({
  anim: 0,
  move: 0,
  spotCull: 0,
  minimap: 0,
  debug: 0,
  render: 0,
})

function isGameplayActive(g: Gal): boolean {
  return !!g.screensaver || g.controls.enabled === true
}

function clearFrameSchedule(): void {
  if (animationFrameId != null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (pauseTimeoutId != null) {
    clearTimeout(pauseTimeoutId)
    pauseTimeoutId = null
  }
}

function scheduleNextRender(g: Gal): void {
  clearFrameSchedule()
  if (isGameplayActive(g)) {
    animationFrameId = requestAnimationFrame(g.render.bind(g))
  } else {
    pauseTimeoutId = setTimeout(() => g.render(), PAUSED_FRAME_MS)
  }
}

function applyViewportSize(g: Gal): void {
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1)
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1)
  g.renderer.setPixelRatio(resolveMaxPixelRatio(g.num_of_paintings, window.location.search))
  g.renderer.setSize(width, height)
  g.camera.aspect = width / height
  g.camera.updateProjectionMatrix()
}

function freezeWorld(g: Gal): void {
  clearMovementState(g)
  if (g.playerBody) g.playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
}

function pointerEl(g: Gal): HTMLCanvasElement {
  return g.renderer.domElement
}

function isPointerLocked(g: Gal): boolean {
  const doc = pointerEl(g).ownerDocument
  const el = pointerEl(g)
  return (
    doc.pointerLockElement === el ||
    (doc as Document & { mozPointerLockElement?: Element }).mozPointerLockElement === el ||
    (doc as Document & { webkitPointerLockElement?: Element }).webkitPointerLockElement === el
  )
}

function initWallBoundingBoxes(g: Gal): void {
  for (let i = 0; i < g.wallGroup.children.length; i++) {
    const child = g.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
    child.BBox?.setFromObject(child)
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

      const resizeViewport = () => applyViewportSize(gal!)

      applyViewportSize(gal!)
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
      gal!.canvas = gal!.renderer.domElement
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
      const doc = pointerEl(g).ownerDocument
      if ('pointerLockElement' in doc || 'mozPointerLockElement' in doc || 'webkitPointerLockElement' in doc) {
        function releaseToMenu() {
          clearMovementState(g)
          if (isPointerLocked(g)) {
            g.controls.unlock()
          } else {
            g.controls.enabled = false
            g.menu?.classList.remove('hide')
            g.bgMenu?.classList.remove('hide')
            freezeWorld(g)
            g.prevTime = performance.now()
            clearFrameSchedule()
            scheduleNextRender(g)
          }
          console.debug('Pointer lock released; showing menu for re-entry.')
        }

        document.addEventListener('keydown', (e) => {
          if (e.keyCode === 102 || e.keyCode === 70) {
            g.toggleFullscreen()
            g.controls.lock()
          } else if (e.key === 'Escape' || e.keyCode === 27) {
            releaseToMenu()
          }
        })

        g.bgMenu?.addEventListener('click', () => {
          g.controls.lock()
        })
        g.play?.addEventListener('click', () => {
          g.controls.lock()
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
      if (isPointerLocked(g)) {
        g.controls.enabled = true
        g.menu?.classList.add('hide')
        g.bgMenu?.classList.add('hide')
        g.prevTime = performance.now()
        clearFrameSchedule()
        g.render()
      } else {
        g.controls.enabled = false
        g.menu?.classList.remove('hide')
        g.bgMenu?.classList.remove('hide')
        freezeWorld(g)
        g.prevTime = performance.now()
        clearFrameSchedule()
        scheduleNextRender(g)
      }
    },

    errorCallback() {
      console.error('Pointer Lock Failed')
    },

    moveCallback(_event: MouseEvent) {
      // PointerLockControls handles mouse-look on the WebGL canvas (see r183 connect()).
    },

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
          const textures = await preloadFloorplanTextures(data, (loaded, total) => {
            setLayoutLoading(true, `Loading artwork textures… ${loaded}/${total}`)
          })
          setLayoutLoading(true, 'Building gallery…')
          buildSceneFromFloorplan(gal!, data, textures)
          applySpawnPosition(gal!, data)
        } else {
          buildMinimalGallery(gal!)
        }
      } finally {
        setLayoutLoading(false)
        applyViewportSize(gal!)
        initDevMinimap()
        initDevPerf()
        initSpotlightDebug(gal!)
        initSpotlightDevPanel(() => {
          gal!.renderer.render(gal!.scene, gal!.camera)
        })
      }
    },

    animatedObjects: [],

    render() {
      const g = gal!
      const frameStart = performance.now()
      let phaseStart = frameStart
      const phases = emptyPhases()

      if (isGameplayActive(g)) {
        g.initialRender = false
        g.animatedObjects.forEach((obj) => obj.render(obj))
        phases.anim = markPhase(phaseStart)
        phaseStart = performance.now()

        const currentTime = performance.now()
        const delta = (currentTime - g.prevTime) / 1000
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
        phases.move = markPhase(phaseStart)
        phaseStart = performance.now()

        updateSpotlightCulling(g.camera, g.wallGroup.children)
        phases.spotCull = markPhase(phaseStart)
        phaseStart = performance.now()

        updateDevMinimap(g)
        phases.minimap = markPhase(phaseStart)
        phaseStart = performance.now()

        updateSpotlightDebug(g)
        phases.debug = markPhase(phaseStart)
        phaseStart = performance.now()

        g.renderer.render(g.scene, g.camera)
        phases.render = markPhase(phaseStart)
      } else {
        g.prevTime = performance.now()
        if (g.initialRender) {
          initWallBoundingBoxes(g)
          g.initialRender = false
        }
        updateSpotlightCulling(g.camera, g.wallGroup.children)
        phases.spotCull = markPhase(phaseStart)
        phaseStart = performance.now()

        updateDevMinimap(g)
        phases.minimap = markPhase(phaseStart)
        phaseStart = performance.now()

        updateSpotlightDebug(g)
        phases.debug = markPhase(phaseStart)
        phaseStart = performance.now()

        g.renderer.render(g.scene, g.camera)
        phases.render = markPhase(phaseStart)
      }

      recordFrame(g, frameStart, phases)
      scheduleNextRender(g)
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
