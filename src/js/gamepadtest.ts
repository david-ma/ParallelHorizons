/**
 * Gamepad API test / integration for gallery controls.
 * Loaded after the main gallery module; uses global gal and jQuery ($).
 */
/* global gal, $ */

declare const gal: {
  moveForward: boolean
  moveBackward: boolean
  moveLeft: boolean
  moveRight: boolean
  moveVelocity: { y: number }
  jump: boolean
  analogForward: number
  analogBackward: number
  analogLeft: number
  analogRight: number
  analogX: number
  analogY: number
}

const haveEvents = 'GamepadEvent' in window
const haveWebkitEvents = 'WebKitGamepadEvent' in window
const controllers: Record<number, Gamepad> = {}
const rAF = requestAnimationFrame

function connecthandler(e: GamepadEvent): void {
  addgamepad(e.gamepad)
}

function addgamepad(gamepad: Gamepad): void {
  controllers[gamepad.index] = gamepad
  const d = document.createElement('div')
  d.setAttribute('id', 'controller' + gamepad.index)
  const t = document.createElement('h1')
  t.appendChild(document.createTextNode('gamepad: ' + gamepad.id))
  d.appendChild(t)
  const b = document.createElement('div')
  b.className = 'buttons'
  for (let i = 0; i < gamepad.buttons.length; i++) {
    const e = document.createElement('span')
    e.className = 'button'
    e.innerHTML = String(i)
    b.appendChild(e)
  }
  d.appendChild(b)
  const a = document.createElement('div')
  a.className = 'axes'
  for (let i = 0; i < gamepad.axes.length; i++) {
    const e = document.createElement('meter')
    e.className = 'axis'
    e.setAttribute('min', '-1')
    e.setAttribute('max', '1')
    e.setAttribute('value', '0')
    e.innerHTML = String(i)
    a.appendChild(e)
  }
  d.appendChild(a)
  document.getElementById('gamepadtest')!.appendChild(d)
  rAF(updateStatus)
}

function disconnecthandler(e: GamepadEvent): void {
  removegamepad(e.gamepad)
}

function removegamepad(gamepad: Gamepad): void {
  const d = document.getElementById('controller' + gamepad.index)
  if (d && d.parentNode) d.parentNode.removeChild(d)
  delete controllers[gamepad.index]
}

let lastCalledTime: number | undefined
let delta = 0

function framerate(): void {
  if (!lastCalledTime) {
    lastCalledTime = performance.now()
    return
  }
  delta = (performance.now() - lastCalledTime) / 1000
  lastCalledTime = performance.now()
  const fps = 1 / delta
  if (typeof $ !== 'undefined' && (window as any).counter === undefined) (window as any).counter = 0
  const counter = ((window as any).counter = ((window as any).counter || 0) + 1)
  if (counter % 30 === 0 && typeof $ !== 'undefined') $('#fps').text(Math.floor(fps))
}

const buttonActions: Record<number, (action: 'on' | 'off') => void> = {
  1: (action) => {
    if (action === 'on' && gal?.jump) {
      gal.moveVelocity.y += 0.2
      gal.jump = false
    }
  },
  12: (action) => {
    if (gal) gal.moveForward = action === 'on'
  },
  13: (action) => {
    if (gal) gal.moveBackward = action === 'on'
  },
  14: (action) => {
    if (gal) gal.moveLeft = action === 'on'
  },
  15: (action) => {
    if (gal) gal.moveRight = action === 'on'
  },
}

function updateStatus(): void {
  framerate()
  scangamepads()
  for (const j in controllers) {
    const controller = controllers[j]
    const d = document.getElementById('controller' + j)
    if (!d) continue
    const buttons = d.getElementsByClassName('button')
    for (let i = 0; i < controller.buttons.length; i++) {
      const b = buttons[i] as HTMLElement
      const val = controller.buttons[i]
      let pressed = val === 1.0
      let value = val as number
      if (typeof val === 'object') {
        pressed = (val as GamepadButton).pressed
        value = (val as GamepadButton).value
      }
      const pct = Math.round(value * 100) + '%'
      ;(b.style as any).backgroundSize = pct + ' ' + pct
      if (pressed) {
        b.className = 'button pressed'
        if (buttonActions[i]) buttonActions[i]('on')
      } else {
        b.className = 'button'
        if (buttonActions[i]) buttonActions[i]('off')
      }
    }
    const axes = d.getElementsByClassName('axis')
    for (let i = 0; i < controller.axes.length; i++) {
      const a = axes[i] as HTMLElement
      a.innerHTML = i + ': ' + controller.axes[i].toFixed(4)
      a.setAttribute('value', String(controller.axes[i]))
      if (!gal) continue
      if (i === 0) {
        if (controller.axes[i] < -0.1) gal.analogLeft = controller.axes[i] * -1
        else if (controller.axes[i] > 0.1) gal.analogRight = controller.axes[i]
        else {
          gal.analogRight = 0
          gal.analogLeft = 0
        }
      }
      if (i === 1) {
        if (controller.axes[i] < -0.1) gal.analogForward = controller.axes[i] * -1
        else if (controller.axes[i] > 0.1) gal.analogBackward = controller.axes[i]
        else {
          gal.analogForward = 0
          gal.analogBackward = 0
        }
      }
      if (i === 2) {
        if (controller.axes[i] < -0.1) gal.analogY = controller.axes[i]
        else if (controller.axes[i] > 0.1) gal.analogY = controller.axes[i]
        else gal.analogY = 0
      }
      if (i === 3) {
        if (controller.axes[i] < -0.1) gal.analogX = controller.axes[i]
        else if (controller.axes[i] > 0.1) gal.analogX = controller.axes[i]
        else gal.analogX = 0
      }
    }
  }
  rAF(updateStatus)
}

function scangamepads(): void {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator as any).webkitGetGamepads ? (navigator as any).webkitGetGamepads() : []
  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i]
    if (gp) {
      if (!(gp.index in controllers)) addgamepad(gp)
      else controllers[gp.index] = gp
    }
  }
}

if (haveEvents) {
  window.addEventListener('gamepadconnected', connecthandler)
  window.addEventListener('gamepaddisconnected', disconnecthandler)
} else if (haveWebkitEvents) {
  window.addEventListener('webkitgamepadconnected', connecthandler)
  window.addEventListener('webkitgamepaddisconnected', disconnecthandler)
} else {
  setInterval(scangamepads, 500)
}
