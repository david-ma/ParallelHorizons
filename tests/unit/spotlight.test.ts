import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import {
  buildSpotlightOptions,
  formatSpotlightTuningAsCode,
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
