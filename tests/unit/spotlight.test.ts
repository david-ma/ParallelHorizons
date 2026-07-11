import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import {
  buildSpotlightOptions,
  evaluateSpotlightEligibility,
  formatSpotlightTuningAsCode,
  isArtworkOccludedByWalls,
  isPlayerInSpotlightFloorHitbox,
  isPointInViewFrustum,
  isSpotlightFloorHitboxInView,
  maxActiveSpotlights,
  resolveMaxPixelRatio,
  selectActiveSpotlightFlags,
  selectActiveSpotlightFlagsByDistance,
  selectActiveSpotlightFlagsByScore,
  selectActiveSpotlightFlagsInView,
  advanceBeamOffDelay,
  classifyBeamFadeVisual,
  computeBeamFadeTarget,
  computeGpuShadeFade,
  stepBeamFade,
  spotlightCullPriority,
  spotlightFloorHitRadius,
  type SpotlightGlobalTuning,
} from '../../src/js/spotlight'

const SAMPLE_TUNING: SpotlightGlobalTuning = {
  mountY: 4.5,
  lightRoomOffset: 0.12,
  artworkWallStandoff: 0.06,
  targetYOffset: 0,
  intensity: 6,
  distance: 8,
  angle: 0.45,
  penumbra: 0.35,
  decay: 1.2,
  emitterRadius: 0.08,
  emitterOffsetX: 0,
  emitterOffsetY: 0,
  emitterOffsetZ: 0.02,
  emitterOpacity: 0.85,
  fixtureScale: 1,
  wallMountOffset: -0.055,
  fixturePitchOffset: 1.6,
}

describe('formatSpotlightTuningAsCode', () => {
  test('emits TypeScript object with tuning values', () => {
    const code = formatSpotlightTuningAsCode(SAMPLE_TUNING)
    expect(code).toContain('export const SPOTLIGHT_TUNING')
    expect(code).toContain('mountY: 4.5')
    expect(code).toContain('fixturePitchOffset: 1.6')
  })
})

describe('buildSpotlightOptions', () => {
  test('places light origin into the room along wall normal', () => {
    const anchor = {
      artworkCenter: new THREE.Vector3(0, 2, -3),
      wallNormal: new THREE.Vector3(0, 0, 1),
    }
    const opts = buildSpotlightOptions(anchor, SAMPLE_TUNING)
    expect(opts.lightOrigin.y).toBe(SAMPLE_TUNING.mountY)
    expect(opts.lightOrigin.z).toBeGreaterThan(anchor.artworkCenter.z)
    expect(opts.wallNormal.z).toBe(1)
  })

  test('offsets target vertically from artwork centre', () => {
    const anchor = {
      artworkCenter: new THREE.Vector3(1, 2, 0),
      wallNormal: new THREE.Vector3(-1, 0, 0),
    }
    const tuning = { ...SAMPLE_TUNING, targetYOffset: 0.25 }
    const opts = buildSpotlightOptions(anchor, tuning)
    expect(opts.lightTarget.y).toBe(2.25)
    expect(opts.lightTarget.x).toBe(1)
  })
})

describe('maxActiveSpotlights', () => {
  test('enables all when count is small', () => {
    expect(maxActiveSpotlights(0)).toBe(0)
    expect(maxActiveSpotlights(5)).toBe(5)
    expect(maxActiveSpotlights(8)).toBe(8)
  })

  test('caps at 8 for medium galleries', () => {
    expect(maxActiveSpotlights(9)).toBe(8)
    expect(maxActiveSpotlights(20)).toBe(8)
  })

  test('caps at 8 for heavy galleries', () => {
    expect(maxActiveSpotlights(24)).toBe(8)
    expect(maxActiveSpotlights(30)).toBe(8)
  })
})

describe('stepBeamFade', () => {
  test('ramps up over fade duration', () => {
    expect(stepBeamFade(0, 1, 0.05, 0.1)).toBe(0.5)
    expect(stepBeamFade(0.5, 1, 0.05, 0.1)).toBe(1)
  })

  test('ramps down over fade duration', () => {
    expect(stepBeamFade(1, 0, 0.1, 0.1)).toBe(0)
  })
})

describe('computeBeamFadeTarget', () => {
  test('holds brightness during off-delay', () => {
    expect(computeBeamFadeTarget(false, 1, 1, 2)).toBe(1)
    expect(computeBeamFadeTarget(false, 2, 0.8, 2)).toBe(0)
  })

  test('ramps on immediately when active', () => {
    expect(computeBeamFadeTarget(true, 1.5, 0.4, 2)).toBe(1)
  })
})

describe('advanceBeamOffDelay', () => {
  test('resets when active', () => {
    expect(advanceBeamOffDelay(true, 1.5, 0.1)).toBe(0)
  })

  test('accumulates while inactive', () => {
    expect(advanceBeamOffDelay(false, 1, 0.5)).toBe(1.5)
  })
})

describe('computeGpuShadeFade', () => {
  test('only active rigs shade the scene', () => {
    expect(computeGpuShadeFade(true, 1)).toBe(1)
    expect(computeGpuShadeFade(true, 0.4)).toBe(0.4)
    expect(computeGpuShadeFade(false, 1)).toBe(0)
  })
})

describe('classifyBeamFadeVisual', () => {
  test('labels hold and fade phases', () => {
    expect(classifyBeamFadeVisual(false, 1, 0.5, 2)).toBe('holdOff')
    expect(classifyBeamFadeVisual(false, 0.4, 2.1, 2)).toBe('fadeOut')
    expect(classifyBeamFadeVisual(true, 0.4, 0, 2)).toBe('fadeIn')
    expect(classifyBeamFadeVisual(true, 1, 0, 2)).toBe('on')
    expect(classifyBeamFadeVisual(false, 0, 1, 2)).toBe('off')
  })
})

describe('spotlightCullPriority', () => {
  test('ranks in-view ahead of closer behind-camera', () => {
    const cam = new THREE.Vector3(0, 1.75, 0)
    const forward = new THREE.Vector3(0, 0, -1)
    const ahead = new THREE.Vector3(0, 2, -8)
    const behind = new THREE.Vector3(0, 2, 2)
    const aheadP = spotlightCullPriority(ahead, cam, forward)
    const behindP = spotlightCullPriority(behind, cam, forward)
    expect(aheadP.inView).toBe(true)
    expect(behindP.inView).toBe(false)
    expect(aheadP.sortKey).toBeLessThan(behindP.sortKey)
  })
})

describe('selectActiveSpotlightFlagsInView', () => {
  test('prefers in-view over nearer behind', () => {
    const keys = [
      1e12 + 4, // behind, very close
      50, // in view, farther
      1e12 + 100,
      80,
    ]
    const flags = selectActiveSpotlightFlagsInView(keys, 2)
    expect(flags).toEqual([false, true, false, true])
  })
})

describe('selectActiveSpotlightFlagsByDistance', () => {
  test('picks nearest rigs by squared distance', () => {
    const flags = selectActiveSpotlightFlagsByDistance([100, 1, 50, 4], 2)
    expect(flags).toEqual([false, true, false, true])
  })

  test('enables all when under cap', () => {
    expect(selectActiveSpotlightFlagsByDistance([9, 1, 4], 5)).toEqual([true, true, true])
  })
})

describe('selectActiveSpotlightFlagsByScore', () => {
  test('delegates to distance sort for numeric scores', () => {
    const flags = selectActiveSpotlightFlagsByScore([100, 1, 50, 4], 2)
    expect(flags).toEqual([false, true, false, true])
  })
})

describe('selectActiveSpotlightFlags', () => {
  test('picks nearest rigs by squared distance', () => {
    const flags = selectActiveSpotlightFlags([100, 1, 50, 4], 2)
    expect(flags).toEqual([false, true, false, true])
  })

  test('enables all when under cap', () => {
    expect(selectActiveSpotlightFlags([9, 1, 4], 5)).toEqual([true, true, true])
  })
})

describe('resolveMaxPixelRatio', () => {
  test('lowers cap for large galleries', () => {
    expect(resolveMaxPixelRatio(30, '', 2)).toBe(1.25)
    expect(resolveMaxPixelRatio(9, '', 2)).toBe(2)
  })

  test('honours quality query param', () => {
    expect(resolveMaxPixelRatio(30, '?quality=low')).toBe(1)
    expect(resolveMaxPixelRatio(30, '?quality=high')).toBe(2)
  })
})

describe('isPointInViewFrustum', () => {
  test('includes points ahead of camera inside FOV', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(0, 2, -10)
    cam.updateMatrixWorld(true)
    expect(isPointInViewFrustum(cam, new THREE.Vector3(0, 2, -8), 0)).toBe(true)
  })

  test('excludes points behind the camera', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(0, 2, -10)
    cam.updateMatrixWorld(true)
    expect(isPointInViewFrustum(cam, new THREE.Vector3(0, 2, 5), 0)).toBe(false)
  })

  test('FOV padding includes points just outside strict frustum', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(0, 2, -10)
    cam.updateMatrixWorld(true)
    const edge = new THREE.Vector3(6.2, 2, -8)
    expect(isPointInViewFrustum(cam, edge, 0)).toBe(false)
    expect(isPointInViewFrustum(cam, edge, 3)).toBe(true)
  })
})

describe('spotlightFloorHitRadius', () => {
  test('scales with drop height and cone angle', () => {
    const r = spotlightFloorHitRadius(4.2, 1.25, 0.49)
    expect(r).toBeCloseTo(Math.tan(0.49) * (4.2 - 1.25), 5)
  })
})

describe('isPlayerInSpotlightFloorHitbox', () => {
  test('true when player stands in floor pool', () => {
    const light = new THREE.Vector3(0, 4, 0)
    const target = new THREE.Vector3(0, 2, 0)
    const player = new THREE.Vector3(0.5, 1.75, 0)
    expect(isPlayerInSpotlightFloorHitbox(player, light, target, 1.25, 0.49)).toBe(true)
  })

  test('false when player is outside pool radius', () => {
    const light = new THREE.Vector3(0, 4, 0)
    const target = new THREE.Vector3(0, 2, 0)
    const player = new THREE.Vector3(8, 1.75, 0)
    expect(isPlayerInSpotlightFloorHitbox(player, light, target, 1.25, 0.49)).toBe(false)
  })
})

describe('isSpotlightFloorHitboxInView', () => {
  test('true when floor pool center is in frustum', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(0, 1.25, -6)
    cam.updateMatrixWorld(true)
    const light = new THREE.Vector3(0, 4, -6)
    const target = new THREE.Vector3(0, 2, -6)
    expect(
      isSpotlightFloorHitboxInView(cam, cam.position, light, target, 1.25, 0.49, [], 0)
    ).toBe(true)
  })
})

describe('evaluateSpotlightEligibility', () => {
  test('near player is eligible even behind camera', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(0, 2, -10)
    cam.updateMatrixWorld(true)
    const forward = new THREE.Vector3(0, 0, -1)
    const art = new THREE.Vector3(0, 2, 2)
    const light = new THREE.Vector3(0, 4, 2.2)
    const target = new THREE.Vector3(0, 2, 2)
    const result = evaluateSpotlightEligibility(
      art,
      light,
      target,
      0.49,
      cam,
      cam.position,
      forward,
      []
    )
    expect(result.nearPlayer).toBe(true)
    expect(result.eligible).toBe(true)
    expect(result.inView).toBe(false)
  })

  test('floor hitbox in view is eligible before painting enters frustum', () => {
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    cam.position.set(0, 1.75, 0)
    cam.lookAt(6, 1.25, -8)
    cam.updateMatrixWorld(true)
    const forward = new THREE.Vector3()
    cam.getWorldDirection(forward)
    const art = new THREE.Vector3(0, 2, 5)
    const light = new THREE.Vector3(6, 4, -8)
    const target = new THREE.Vector3(6, 2, -8)
    const result = evaluateSpotlightEligibility(
      art,
      light,
      target,
      0.49,
      cam,
      cam.position,
      forward,
      []
    )
    expect(result.hitboxInView).toBe(true)
    expect(result.eligible).toBe(true)
    expect(result.inView).toBe(false)
  })
})

describe('isArtworkOccludedByWalls', () => {
  test('detects wall between camera and artwork', () => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.2))
    wall.position.set(0, 3, -5)
    wall.updateMatrixWorld(true)
    const cam = new THREE.Vector3(0, 1.75, 0)
    const art = new THREE.Vector3(0, 2, -10)
    expect(isArtworkOccludedByWalls(cam, art, [wall])).toBe(true)
  })

  test('clear line of sight when no wall in path', () => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 10))
    sideWall.position.set(8, 3, -5)
    sideWall.updateMatrixWorld(true)
    const cam = new THREE.Vector3(0, 1.75, 0)
    const art = new THREE.Vector3(0, 2, -8)
    expect(isArtworkOccludedByWalls(cam, art, [sideWall])).toBe(false)
  })
})
