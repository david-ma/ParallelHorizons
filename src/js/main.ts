/**
 * 3D gallery viewer — scene, controls, paintings, movement.
 * Entry point for the /view page, served via Thalia’s on-the-fly TS handling.
 *
 * Request flow in dev:
 *   GET /js/main.js → Thalia maps to src/js/main.ts → Bun.build bundles this (including `three`) into /dist, then streams JS.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const PI_2 = Math.PI / 2
const speed = 38.0

let lastCalledTime: number | undefined
let fps = 0
let counter = 0

console.log("Starting gallery main.ts")
console.log("THREE version:", THREE.REVISION)

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

interface Gal {
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
  create: () => void
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
}

function drawFrame(
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

const Detector = typeof window !== 'undefined' ? (window as any).Detector : null

let gal: Gal | null = null

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
      // Use sRGB canvas output so colors are not rendered too dark.
      gal!.renderer.toneMapping = THREE.NoToneMapping
      gal!.renderer.toneMappingExposure = 1
      gal!.renderer.outputColorSpace = THREE.SRGBColorSpace
      document.body.appendChild(gal!.renderer.domElement)

      const userBoxGeo = new THREE.BoxGeometry(2, 1, 2)
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
          // Reset movement state and show intro menu so user can re-click PLAY after alt-tab/esc.
          g.moveForward = false
          g.moveBackward = false
          g.moveLeft = false
          g.moveRight = false
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
      const g = gal!
      document.addEventListener('keydown', (e) => {
        if (e.keyCode === 87 || e.keyCode === 38) g.moveForward = true
        else if (e.keyCode === 65 || e.keyCode === 37) g.moveLeft = true
        else if (e.keyCode === 83 || e.keyCode === 40) g.moveBackward = true
        else if (e.keyCode === 68 || e.keyCode === 39) g.moveRight = true
        else if (e.keyCode === 32 && g.jump) {
          g.moveVelocity.y += 0.2
          g.jump = false
        }
      })
      document.addEventListener('keyup', (e) => {
        if (e.keyCode === 87 || e.keyCode === 38) g.moveForward = false
        else if (e.keyCode === 65 || e.keyCode === 37) g.moveLeft = false
        else if (e.keyCode === 83 || e.keyCode === 40) g.moveBackward = false
        else if (e.keyCode === 68 || e.keyCode === 39) g.moveRight = false
      })
    },

    create() {
      const g = gal!
      g.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
      // Balanced room lighting (no front/back directional bias).
      g.scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 0.6))

      type FloorplanWallPlacements = {
        north?: string[]
        east?: string[]
        south?: string[]
        west?: string[]
      }
      type FloorplanBlob = {
        grid?: { rows?: number; cols?: number }
        activeCells?: string[]
        placements?: Record<string, string | FloorplanWallPlacements>
        photoCatalog?: Array<{ id: string; src: string; title?: string }>
      }

      const floorplanUrl = ((globalThis as any).GALLERY_FLOORPLAN_URL as string | undefined) ?? '/gallery-floorplan.json'
      let floorplanData: FloorplanBlob | null = null
      try {
        const req = new XMLHttpRequest()
        req.open('GET', floorplanUrl, false)
        req.send(null)
        if (req.status >= 200 && req.status < 300) {
          const parsed = JSON.parse(req.responseText) as FloorplanBlob
          if (Array.isArray(parsed.activeCells) && parsed.placements) floorplanData = parsed
        }
      } catch (_err) {
        floorplanData = null
      }

      if (floorplanData) {
        const rows = Math.max(1, Number(floorplanData.grid?.rows) || 5)
        const cols = Math.max(1, Number(floorplanData.grid?.cols) || 5)
        const cellWorld = 6
        const active = new Set((floorplanData.activeCells || []).map(String))
        const photoById = new Map((floorplanData.photoCatalog || []).map((p) => [p.id, p.src]))

        const floorText = new THREE.TextureLoader().load('/img/Textures/Floor.jpg')
        floorText.colorSpace = THREE.SRGBColorSpace
        floorText.wrapS = THREE.RepeatWrapping
        floorText.wrapT = THREE.RepeatWrapping
        floorText.repeat.set(cols * 2, rows * 2)
        const floorMaterial = new THREE.MeshPhongMaterial({ map: floorText })
        const floorWidth = cols * cellWorld + 8
        const floorDepth = rows * cellWorld + 8
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, floorDepth), floorMaterial)
        floor.rotation.x = Math.PI / 2
        floor.rotation.y = Math.PI
        g.scene.add(floor)

        g.wallGroup = new THREE.Group()
        g.scene.add(g.wallGroup)
        g.paintings = []
        g.num_of_paintings = 0
        g.minX = -floorWidth / 2 + 1.5
        g.maxX = floorWidth / 2 - 1.5
        g.minZ = -floorDepth / 2 + 1.5
        g.maxZ = floorDepth / 2 - 1.5

        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
        const addWall = (x: number, z: number, rotateY: number) => {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(cellWorld, 6, 0.001), wallMaterial) as THREE.Mesh & { BBox?: THREE.Box3 }
          wall.position.set(x, 3, z)
          wall.rotation.y = rotateY
          wall.BBox = new THREE.Box3().setFromObject(wall)
          g.wallGroup.add(wall)
        }
        const hasCell = (r: number, c: number) => active.has(`${r},${c}`)
        const cellCenter = (r: number, c: number) => ({
          x: (c - (cols - 1) / 2) * cellWorld,
          z: (r - (rows - 1) / 2) * cellWorld,
        })
        const placeOnWall = (wall: 'north' | 'south' | 'west' | 'east', cx: number, cz: number, offset: number) => {
          if (wall === 'north') return { x: cx + offset, y: 2, z: cz - cellWorld / 2 + 0.06, ry: 0 }
          if (wall === 'south') return { x: cx - offset, y: 2, z: cz + cellWorld / 2 - 0.06, ry: Math.PI }
          if (wall === 'west') return { x: cx - cellWorld / 2 + 0.06, y: 2, z: cz - offset, ry: Math.PI / 2 }
          return { x: cx + cellWorld / 2 - 0.06, y: 2, z: cz + offset, ry: -Math.PI / 2 }
        }
        const addFrameToArtwork = (parent: THREE.Group, artWidth: number, artHeight: number) => {
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

        active.forEach((key) => {
          const [rRaw, cRaw] = key.split(',')
          const r = Number(rRaw)
          const c = Number(cRaw)
          if (Number.isNaN(r) || Number.isNaN(c)) return
          const center = cellCenter(r, c)
          if (!hasCell(r - 1, c)) addWall(center.x, center.z - cellWorld / 2, 0) // north
          if (!hasCell(r + 1, c)) addWall(center.x, center.z + cellWorld / 2, Math.PI) // south
          if (!hasCell(r, c - 1)) addWall(center.x - cellWorld / 2, center.z, Math.PI / 2) // west
          if (!hasCell(r, c + 1)) addWall(center.x + cellWorld / 2, center.z, -Math.PI / 2) // east

          const placements = floorplanData!.placements?.[key]
          const normalized: FloorplanWallPlacements =
            typeof placements === 'string'
              ? { north: [placements] }
              : (placements as FloorplanWallPlacements) || {}

          ;(['north', 'east', 'south', 'west'] as const).forEach((wallName) => {
            const ids = Array.isArray(normalized[wallName]) ? normalized[wallName]! : []
            const step = Math.min(1.5, (cellWorld - 1) / Math.max(1, ids.length + 1))
            const start = -((ids.length - 1) * step) / 2
            ids.forEach((photoId, idx) => {
              const source = photoById.get(photoId) || `/img/Artworks/${idx % 30}.jpg`
              const tex = new THREE.TextureLoader().load(source)
              tex.colorSpace = THREE.SRGBColorSpace
              tex.minFilter = THREE.LinearFilter
              const mat = new THREE.MeshLambertMaterial({ map: tex })
              const art = new THREE.Group()
              const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat)
              plane.position.z = 0.005
              art.add(plane)
              addFrameToArtwork(art, 1.2, 0.8)
              const p = placeOnWall(wallName, center.x, center.z, start + idx * step)
              art.position.set(p.x, p.y, p.z)
              art.rotation.y = p.ry
              g.scene.add(art)
              g.paintings.push(art)
              g.num_of_paintings++
            })
          })
        })

        g.wallGroup.children.forEach((child) => {
          ;(child as THREE.Mesh & { BBox?: THREE.Box3 }).BBox = new THREE.Box3().setFromObject(child)
        })
        return
      }

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
      const featuredSpotlightIndex = Math.floor(half / 2) // center-ish on the front wall
      const spotlightModelLoader = new GLTFLoader()
      const isDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

      type SpotlightRigOptions = {
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

      type ArtworkSpotlightRig = {
        spotlight: THREE.SpotLight
        spotlightTarget: THREE.Object3D
        emitterDisc: THREE.Mesh
        fixture?: THREE.Object3D
        fallback?: THREE.Object3D
        options: SpotlightRigOptions
      }

      const applyArtworkSpotlightRigOptions = (rig: ArtworkSpotlightRig): void => {
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

      const addArtworkSpotlightRig = (options: SpotlightRigOptions): ArtworkSpotlightRig => {
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
        g.scene.add(spotlightTarget)
        g.scene.add(spotlight)

        const emitterDisc = new THREE.Mesh(
          new THREE.CircleGeometry(1, 16),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: options.emitterOpacity,
            side: THREE.DoubleSide,
          })
        )
        g.scene.add(emitterDisc)

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
            g.scene.add(fixture)
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
            g.scene.add(fallback)
          }
        )

        return rig
      }

      const bindSpotlightSliderControls = (
        tuning: Record<string, number>,
        onInputChange: () => void
      ): void => {
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
        window.addEventListener('spotlight-slider-ready', wireControls as EventListener)
      }

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

          // Add one "real gallery" spotlight fixture + light above a visible front-wall artwork.
          if (index === featuredSpotlightIndex) {
            // Spotlight tuning constants for quick iteration on one featured piece.
            const spotlightTuning = {
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
            const SPOTLIGHT_MODEL_URL = '/models/spotlight/Spotlight.glb'

            const spotlightRig = addArtworkSpotlightRig({
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
            })

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
              // Sliders are used while menu is open; force an immediate redraw.
              g.renderer.render(g.scene, g.camera)
            })
          }

          art.add(plane)
          g.scene.add(art)
          g.paintings.push(art)
        }
        ;(img.map as any).needsUpdate = true
      }
    },

    animatedObjects: [],

    render() {
      const g = gal!
      framerate()
      requestAnimationFrame(g.render.bind(g))
      g.animatedObjects.forEach((obj) => obj.render(obj))
      if (g.analogX || g.analogY) {
        g.euler.setFromQuaternion(g.camera.quaternion)
        g.euler.y -= g.analogY * 0.04
        g.euler.x -= g.analogX * 0.04
        g.euler.x = Math.max(-PI_2, Math.min(PI_2, g.euler.x))
        g.camera.quaternion.setFromEuler(g.euler)
      }
      if (g.screensaver || g.controls.enabled === true) {
        g.initialRender = false
        const currentTime = performance.now()
        const delta = (currentTime - g.prevTime) / 1000
        g.moveVelocity.x -= g.moveVelocity.x * 10.0 * delta
        g.moveVelocity.z -= g.moveVelocity.z * 10.0 * delta
        if (g.moveForward) g.moveVelocity.z -= speed * delta
        if (g.moveBackward) g.moveVelocity.z += speed * delta
        if (g.moveLeft) g.moveVelocity.x -= speed * delta
        if (g.moveRight) g.moveVelocity.x += speed * delta
        if (g.analogForward) g.moveVelocity.z -= speed * g.analogForward * delta
        if (g.analogBackward) g.moveVelocity.z += speed * g.analogBackward * delta
        if (g.analogLeft) g.moveVelocity.x -= speed * g.analogLeft * delta
        if (g.analogRight) g.moveVelocity.x += speed * g.analogRight * delta
        g.controls.moveForward(-g.moveVelocity.z * delta)
        g.controls.moveRight(g.moveVelocity.x * delta)

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
        const qTarget = (g.camera as any).quaternionTarget as THREE.Quaternion | undefined
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

        g.raycaster.setFromCamera(g.mouse.clone(), g.camera)
        g.intersects = g.raycaster.intersectObjects(g.paintings)

        for (let i = 0; i < g.wallGroup.children.length; i++) {
          const child = g.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
          if (child.BBox && g.user.BBox && g.user.BBox.intersectsBox(child.BBox)) {
            g.user.BBox.setFromObject(g.user)
          } else if (child.material && (child.material as THREE.MeshLambertMaterial).color) {
            ;(child.material as THREE.MeshLambertMaterial).color.set(0xffffff)
          }
        }
        g.pastX = g.camera.position.x
        g.pastZ = g.camera.position.z
        g.user.BBox?.setFromObject(g.user)
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
  gal!.create()
  gal!.render()
}

export { gal }

