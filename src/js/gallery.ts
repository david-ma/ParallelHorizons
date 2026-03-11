/**
 * 3D gallery viewer — scene, controls, paintings, movement.
 * Bundled with Three.js; entry point for the /view page.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

const PI_2 = Math.PI / 2
const speed = 38.0

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

interface Gal {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: InstanceType<typeof PointerLockControls>
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

    raycastSetUp() {
      gal.mouse.x = 0
      gal.mouse.y = 0
      gal.mouse.z = 0.0001
    },

    boot() {
      gal.prevTime = performance.now()
      gal.initialRender = true
      ;(gal.scene as any).fog = new THREE.FogExp2(0x666666, 0.05)

      gal.renderer.setSize(window.innerWidth, window.innerHeight)
      gal.renderer.setClearColor(0xffffff, 1)
      document.body.appendChild(gal.renderer.domElement)

      const userBoxGeo = new THREE.BoxGeometry(2, 1, 2)
      const userBoxMat = new THREE.MeshBasicMaterial({ color: 0xeeee99, wireframe: true })
      gal.user = new THREE.Mesh(userBoxGeo, userBoxMat) as THREE.Mesh & { BBox?: THREE.Box3 }
      gal.user.visible = false
      gal.user.BBox = new THREE.Box3()
      gal.camera.add(gal.user)
      gal.camera.position.y = 1.75

      gal.controls = new PointerLockControls(gal.camera, gal.renderer.domElement)
      gal.scene.add(gal.camera)
      gal.pastX = gal.camera.position.x
      gal.pastZ = gal.camera.position.z
      gal.canvas = document.querySelector('canvas')
      if (gal.canvas) gal.canvas.className = 'gallery'
      gal.bgMenu = document.querySelector('#background_menu')
      gal.play = document.querySelector('#play_button')
      gal.menu = document.getElementById('menu')

      gal.moveVelocity = new THREE.Vector3()
      gal.jump = true
      gal.moveForward = false
      gal.moveBackward = false
      gal.moveLeft = false
      gal.moveRight = false
      gal.analogForward = 0
      gal.analogBackward = 0
      gal.analogLeft = 0
      gal.analogRight = 0
      gal.analogX = 0
      gal.analogY = 0

      window.addEventListener('resize', () => {
        gal.renderer.setSize(window.innerWidth, window.innerHeight)
        gal.camera.aspect = window.innerWidth / window.innerHeight
        gal.camera.updateProjectionMatrix()
      })
    },

    pointerControls() {
      const doc = gal.canvas?.ownerDocument ?? document
      if ('pointerLockElement' in doc || 'mozPointerLockElement' in doc || 'webkitPointerLockElement' in doc) {
        ;(gal.canvas as any).requestPointerLock = (gal.canvas as any).requestPointerLock || (gal.canvas as any).mozRequestPointerLock || (gal.canvas as any).webkitRequestPointerLock
        ;(gal.canvas as any).exitPointerLock = (gal.canvas as any).exitPointerLock || (gal.canvas as any).mozExitPointerLock || (gal.canvas as any).webkitExitPointerLock

        document.addEventListener('keydown', (e) => {
          if (e.keyCode === 102 || e.keyCode === 70) {
            gal.toggleFullscreen()
            ;(gal.canvas as any).requestPointerLock?.()
          }
        })

        gal.bgMenu?.addEventListener('click', () => (gal.canvas as any).requestPointerLock?.())
        gal.play?.addEventListener('click', () => (gal.canvas as any).requestPointerLock?.())
        document.addEventListener('pointerlockchange', gal.changeCallback, false)
        document.addEventListener('mozpointerlockchange', gal.changeCallback, false)
        document.addEventListener('webkitpointerlockchange', gal.changeCallback, false)
        document.addEventListener('pointerlockerror', gal.errorCallback, false)
        document.addEventListener('mozpointerlockerror', gal.errorCallback, false)
        document.addEventListener('webkitpointerlockerror', gal.errorCallback, false)
      } else {
        gal.screensaver = true
        const positions: { z: number; x: number }[] = []
        ;[1, -1].forEach((z) => {
          for (let i = 0; i < 9; i++) positions.push({ z, x: -10 + 2.5 * i })
        })
        gal.play?.addEventListener('click', () => {
          if (gal.menu) gal.menu.className += ' hide'
          if (gal.bgMenu) gal.bgMenu.className += ' hide'
          const moveToTarget = (target: { z: number; x: number }) => {
            const targetPos = new THREE.Vector2(target.z, target.x)
            const currentPos = new THREE.Vector2(gal.camera.position.z, gal.camera.position.x)
            const angle = currentPos.sub(targetPos).angle()
            gal.queue = []
            gal.queue.push(() => {
              ;(gal.camera as any).quaternionTarget = new THREE.Quaternion().setFromAxisAngle(gal.axis, angle)
            })
            gal.queue.push(() => {
              gal.targetPosition = { x: target.x, y: 1.75, z: target.z }
            })
            gal.queue.push(() => {
              const a = new THREE.Vector2(-1 * target.z, 0).angle()
              ;(gal.camera as any).quaternionTarget = new THREE.Quaternion().setFromAxisAngle(gal.axis, a)
            })
            gal.queue.shift()!()
          }
          moveToTarget(positions[Math.floor(Math.random() * positions.length)]!)
          setInterval(() => moveToTarget(positions[Math.floor(Math.random() * positions.length)]!), 6500)
        })
      }
    },

    changeCallback() {
      const doc = gal.canvas?.ownerDocument ?? document
      const locked = doc.pointerLockElement === gal.canvas || (doc as any).mozPointerLockElement === gal.canvas || (doc as any).webkitPointerLockElement === gal.canvas
      if (locked) {
        gal.controls.enabled = true
        if (gal.menu) gal.menu.className += ' hide'
        if (gal.bgMenu) gal.bgMenu.className += ' hide'
        document.addEventListener('mousemove', gal.moveCallback as any, false)
      } else {
        gal.controls.enabled = false
        if (gal.menu) gal.menu.className = gal.menu.className.replace(/(?:^|\s)hide(?!\S)/g, '')
        if (gal.bgMenu) gal.bgMenu.className = gal.bgMenu.className.replace(/(?:^|\s)hide(?!\S)/g, '')
        document.removeEventListener('mousemove', gal.moveCallback as any, false)
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
        else if ((document.documentElement as any).webkitRequestFullscreen) (document.documentElement as any).webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
      } else {
        if (document.exitFullscreen) document.exitFullscreen()
        else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen()
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
      }
    },

    movement() {
      document.addEventListener('keydown', (e) => {
        if (e.keyCode === 87 || e.keyCode === 38) gal.moveForward = true
        else if (e.keyCode === 65 || e.keyCode === 37) gal.moveLeft = true
        else if (e.keyCode === 83 || e.keyCode === 40) gal.moveBackward = true
        else if (e.keyCode === 68 || e.keyCode === 39) gal.moveRight = true
        else if (e.keyCode === 32 && gal.jump) {
          gal.moveVelocity.y += 0.2
          gal.jump = false
        }
      })
      document.addEventListener('keyup', (e) => {
        if (e.keyCode === 87 || e.keyCode === 38) gal.moveForward = false
        else if (e.keyCode === 65 || e.keyCode === 37) gal.moveLeft = false
        else if (e.keyCode === 83 || e.keyCode === 40) gal.moveBackward = false
        else if (e.keyCode === 68 || e.keyCode === 39) gal.moveRight = false
      })
    },

    create() {
      gal.scene.add(new THREE.AmbientLight(0xffffff))

      const floorText = new THREE.TextureLoader().load('/img/Textures/Floor.jpg')
      floorText.wrapS = THREE.RepeatWrapping
      floorText.wrapT = THREE.RepeatWrapping
      floorText.repeat.set(24, 24)
      const floorMaterial = new THREE.MeshPhongMaterial({ map: floorText })
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), floorMaterial)
      floor.rotation.x = Math.PI / 2
      floor.rotation.y = Math.PI
      gal.scene.add(floor)

      gal.wallGroup = new THREE.Group()
      gal.scene.add(gal.wallGroup)
      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }))
      const wall2 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }))
      const wall3 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }))
      const wall4 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }))
      gal.wallGroup.add(wall1, wall2, wall3, wall4)
      gal.wallGroup.position.y = 3
      wall1.position.z = -3
      wall2.position.x = -20
      wall2.rotation.y = Math.PI / 2
      wall3.position.x = 20
      wall3.rotation.y = -Math.PI / 2
      wall4.position.z = 3
      wall4.rotation.y = Math.PI
      for (let i = 0; i < gal.wallGroup.children.length; i++) {
        const child = gal.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
        child.BBox = new THREE.Box3()
        child.BBox.setFromObject(child)
      }

      const ceilMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee })
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), ceilMaterial)
      ceil.position.y = 6
      ceil.rotation.x = Math.PI / 2
      gal.scene.add(ceil)

      gal.num_of_paintings = 30
      gal.paintings = []
      const half = Math.floor(gal.num_of_paintings / 2) - 1
      for (let i = 0; i < gal.num_of_paintings; i++) {
        const index = i
        const source = '/img/Artworks/' + index + '.jpg'
        const texture = new THREE.TextureLoader().load(source)
        texture.minFilter = THREE.LinearFilter
        const img = new THREE.MeshBasicMaterial({ map: texture })
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
          gal.scene.add(art)
          gal.paintings.push(art)
        }
        ;(img.map as any).needsUpdate = true
      }
    },

    animatedObjects: [],

    render() {
      framerate()
      requestAnimationFrame(gal.render.bind(gal))
      gal.animatedObjects.forEach((obj) => obj.render(obj))
      if ((gal as any).analogX || (gal as any).analogY) {
        gal.euler.setFromQuaternion(gal.camera.quaternion)
        gal.euler.y -= gal.analogY * 0.04
        gal.euler.x -= gal.analogX * 0.04
        gal.euler.x = Math.max(-PI_2, Math.min(PI_2, gal.euler.x))
        gal.camera.quaternion.setFromEuler(gal.euler)
      }
      if (gal.screensaver || gal.controls.enabled === true) {
        gal.initialRender = false
        const currentTime = performance.now()
        const delta = (currentTime - gal.prevTime) / 1000
        gal.moveVelocity.x -= gal.moveVelocity.x * 10.0 * delta
        gal.moveVelocity.z -= gal.moveVelocity.z * 10.0 * delta
        if (gal.moveForward) gal.moveVelocity.z -= speed * delta
        if (gal.moveBackward) gal.moveVelocity.z += speed * delta
        if (gal.moveLeft) gal.moveVelocity.x -= speed * delta
        if (gal.moveRight) gal.moveVelocity.x += speed * delta
        if (gal.analogForward) gal.moveVelocity.z -= speed * gal.analogForward * delta
        if (gal.analogBackward) gal.moveVelocity.z += speed * gal.analogBackward * delta
        if (gal.analogLeft) gal.moveVelocity.x -= speed * gal.analogLeft * delta
        if (gal.analogRight) gal.moveVelocity.x += speed * gal.analogRight * delta
        gal.controls.moveForward(-gal.moveVelocity.z * delta)
        gal.controls.moveRight(gal.moveVelocity.x * delta)

        if (gal.targetPosition) {
          let deltaX = gal.camera.position.x - gal.targetPosition.x
          const deltaZ = gal.camera.position.z - gal.targetPosition.z
          gal.camera.position.x -= (speed * Math.cbrt(deltaX) * delta) / 12
          gal.camera.position.z -= (speed * Math.cbrt(deltaZ) * delta) / 12
          if (deltaX * deltaX < 0.001 && deltaZ * deltaZ < 0.001) {
            delete (gal as any).targetPosition
            if (gal.queue.length !== 0) gal.queue.shift()!()
          }
        }
        const qTarget = (gal.camera as any).quaternionTarget as THREE.Quaternion | undefined
        if (qTarget) {
          gal.camera.quaternion.rotateTowards(qTarget, 0.03)
          if (gal.camera.quaternion.equals(qTarget)) {
            delete (gal.camera as any).quaternionTarget
            if (gal.queue.length !== 0) gal.queue.shift()!()
          }
        }

        gal.camera.position.z = Math.max(-2, Math.min(2, gal.camera.position.z))
        gal.camera.position.x = Math.max(-18, Math.min(18, gal.camera.position.x))
        gal.moveVelocity.y -= 0.6 * delta
        gal.camera.position.y += gal.moveVelocity.y
        if (gal.camera.position.y < 1.75) {
          gal.jump = true
          gal.moveVelocity.y = 0
          gal.camera.position.y = 1.75
        }
        if (gal.camera.position.y > 5) {
          gal.moveVelocity.y = 0
          gal.camera.position.y = 5
        }

        gal.raycaster.setFromCamera(gal.mouse.clone(), gal.camera)
        gal.intersects = gal.raycaster.intersectObjects(gal.paintings)

        for (let i = 0; i < gal.wallGroup.children.length; i++) {
          const child = gal.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
          if (child.BBox && gal.user.BBox && gal.user.BBox.intersectsBox(child.BBox)) {
            gal.user.BBox.setFromObject(gal.user)
          } else if (child.material && (child.material as THREE.MeshLambertMaterial).color) {
            ;(child.material as THREE.MeshLambertMaterial).color.set(0xffffff)
          }
        }
        gal.pastX = gal.camera.position.x
        gal.pastZ = gal.camera.position.z
        gal.user.BBox?.setFromObject(gal.user)
        gal.prevTime = currentTime
        gal.renderer.render(gal.scene, gal.camera)
      } else {
        gal.prevTime = performance.now()
      }
      if (gal.initialRender === true) {
        for (let i = 0; i < gal.wallGroup.children.length; i++) {
          const child = gal.wallGroup.children[i] as THREE.Mesh & { BBox?: THREE.Box3 }
          child.BBox?.setFromObject(child)
        }
        gal.renderer.render(gal.scene, gal.camera)
      }
    },
  }

  ;(globalThis as any).gal = gal
  gal.raycastSetUp()
  gal.boot()
  gal.pointerControls()
  gal.movement()
  gal.create()
  gal.render()
}

export { gal }
