import { describe, expect, test, afterEach } from 'bun:test'
import { resolveWallTextureStyle, wallTextureMetersPerRepeat } from '../../src/js/materials'

describe('wallTextureMetersPerRepeat', () => {
  test('concrete tiles tighter than other finishes', () => {
    expect(wallTextureMetersPerRepeat('concrete')).toBe(0.65)
    expect(wallTextureMetersPerRepeat('plaster')).toBe(3)
    expect(wallTextureMetersPerRepeat('linen')).toBe(3)
    expect(wallTextureMetersPerRepeat('silk')).toBe(3)
  })
})

describe('resolveWallTextureStyle', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
  })

  test('prefers floorplan wallStyle', () => {
    expect(
      resolveWallTextureStyle({
        activeCells: [],
        placements: {},
        wallStyle: 'concrete',
      })
    ).toBe('concrete')
  })

  test('reads ?wallStyle= query param when floorplan omits style', () => {
    // @ts-expect-error partial window mock for resolveWallTextureStyle
    globalThis.window = {
      location: { search: '?wallStyle=silk', hostname: 'localhost' },
    }
    expect(resolveWallTextureStyle({ activeCells: [], placements: {} })).toBe('silk')
  })

  test('floorplan overrides query param', () => {
    // @ts-expect-error partial window mock for resolveWallTextureStyle
    globalThis.window = {
      location: { search: '?wallStyle=silk', hostname: 'localhost' },
    } as Window
    expect(
      resolveWallTextureStyle({
        activeCells: [],
        placements: {},
        wallStyle: 'linen',
      })
    ).toBe('linen')
  })

  test('defaults to plaster', () => {
    expect(resolveWallTextureStyle(null)).toBe('plaster')
    expect(resolveWallTextureStyle({ activeCells: [], placements: {} })).toBe('plaster')
  })

  test('ignores invalid wallStyle values', () => {
    expect(
      resolveWallTextureStyle({
        activeCells: [],
        placements: {},
        // @ts-expect-error intentional bad payload
        wallStyle: 'brick',
      })
    ).toBe('plaster')
  })
})
