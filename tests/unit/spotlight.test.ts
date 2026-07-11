import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import {
  buildSpotlightOptions,
  formatSpotlightTuningAsCode,
  maxActiveSpotlights,
  resolveMaxPixelRatio,
  selectActiveSpotlightFlags,
  selectActiveSpotlightFlagsByDistance,
  selectActiveSpotlightFlagsByScore,
  selectActiveSpotlightFlagsInView,
  spotlightCullPriority,
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
