import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isValidFloorplan, parseWallStyle } from '../../src/js/floorplan'
import { cellWorldCenter, getSpawnPosition } from '../../src/js/layout'

describe('isValidFloorplan', () => {
  test('accepts minimal valid document', () => {
    expect(isValidFloorplan({ activeCells: [], placements: {} })).toBe(true)
  })

  test('accepts repo sample floorplan', () => {
    const sample = JSON.parse(
      readFileSync(join(import.meta.dir, '../../public/gallery-floorplan.json'), 'utf8')
    ) as unknown
    expect(isValidFloorplan(sample)).toBe(true)
  })

  test('rejects missing activeCells', () => {
    expect(isValidFloorplan({ placements: {} })).toBe(false)
  })

  test('rejects missing placements', () => {
    expect(isValidFloorplan({ activeCells: [] })).toBe(false)
  })

  test('rejects non-objects', () => {
    expect(isValidFloorplan(null)).toBe(false)
    expect(isValidFloorplan('x')).toBe(false)
  })
})

describe('parseWallStyle', () => {
  test('returns known styles', () => {
    expect(parseWallStyle('concrete')).toBe('concrete')
    expect(parseWallStyle('linen')).toBe('linen')
    expect(parseWallStyle('silk')).toBe('silk')
    expect(parseWallStyle('plaster')).toBe('plaster')
  })

  test('defaults to plaster for unknown or missing', () => {
    expect(parseWallStyle(undefined)).toBe('plaster')
    expect(parseWallStyle('brick')).toBe('plaster')
    expect(parseWallStyle(42)).toBe('plaster')
  })
})

describe('cellWorldCenter', () => {
  test('centres grid on origin for 5×5', () => {
    expect(cellWorldCenter(2, 2, 5, 5)).toEqual({ x: 0, z: 0 })
  })

  test('offsets by 6 m per cell', () => {
    expect(cellWorldCenter(2, 3, 5, 5)).toEqual({ x: 6, z: 0 })
    expect(cellWorldCenter(3, 2, 5, 5)).toEqual({ x: 0, z: 6 })
  })
})

describe('getSpawnPosition', () => {
  test('uses spawn.cell when present', () => {
    const pos = getSpawnPosition({ activeCells: [], placements: {}, spawn: { cell: '2,2' } })
    expect(pos).toEqual({ x: 0, y: 1.75, z: 0 })
  })

  test('uses explicit x/z override', () => {
    const pos = getSpawnPosition({
      activeCells: [],
      placements: {},
      spawn: { cell: '0,0', x: 3, y: 2, z: -4 },
    })
    expect(pos).toEqual({ x: 3, y: 2, z: -4 })
  })

  test('defaults to origin at eye height', () => {
    expect(getSpawnPosition(null)).toEqual({ x: 0, y: 1.75, z: 0 })
  })
})
