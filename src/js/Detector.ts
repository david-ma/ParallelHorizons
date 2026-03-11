/**
 * WebGL / capability detection (legacy Three.js-style).
 * Used by the gallery before the main module runs.
 */

function getWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      typeof window !== 'undefined' &&
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

const Detector = {
  canvas: typeof window !== 'undefined' && !!window.CanvasRenderingContext2D,
  webgl: typeof window !== 'undefined' && getWebGLSupport(),
  workers: typeof window !== 'undefined' && 'Worker' in window,
  fileapi:
    typeof window !== 'undefined' &&
    !!window.File &&
    !!window.FileReader &&
    !!window.FileList &&
    !!window.Blob,

  getWebGLErrorMessage(): HTMLDivElement {
    const element = document.createElement('div')
    element.id = 'webgl-error-message'
    element.style.fontFamily = 'monospace'
    element.style.fontSize = '13px'
    element.style.fontWeight = 'normal'
    element.style.textAlign = 'center'
    element.style.background = '#fff'
    element.style.color = '#000'
    element.style.padding = '1.5em'
    element.style.width = '400px'
    element.style.margin = '5em auto 0'

    if (!this.webgl) {
      element.innerHTML = (
        window.WebGLRenderingContext
          ? [
              'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
              'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.',
            ]
          : [
              'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
              'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.',
            ]
      ).join('\n')
    }

    return element
  },

  addGetWebGLMessage(parameters?: { parent?: HTMLElement; id?: string }): void {
    const params = parameters ?? {}
    const parent = params.parent ?? document.body
    const id = params.id ?? 'oldie'
    const element = this.getWebGLErrorMessage()
    element.id = id
    parent.appendChild(element)
  },
}

declare global {
  interface Window {
    Detector: typeof Detector
  }
}

;(window as Window & { Detector: typeof Detector }).Detector = Detector
export {}
