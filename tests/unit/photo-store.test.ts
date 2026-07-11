/**
 * Unit tests for floorplan photo stripping on delete.
 */
import { describe, expect, test } from 'bun:test'
import { stripPhotoFromFloorplan } from '../../config/photo-store.js'

describe('stripPhotoFromFloorplan', () => {
  test('removes id from wall placements and catalog', () => {
    const floorplan = {
      placements: {
        '2,2': { north: '5', east: '6', south: '', west: '' },
      },
      photoCatalog: [
        { id: '5', src: '/uploads/a.jpg', title: 'A' },
        { id: '6', src: '/uploads/b.jpg', title: 'B' },
      ],
    }
    expect(stripPhotoFromFloorplan(floorplan, '5')).toBe(true)
    expect(floorplan.placements['2,2'].north).toBeUndefined()
    expect(floorplan.photoCatalog).toHaveLength(1)
    expect(floorplan.photoCatalog[0]?.id).toBe('6')
  })

  test('returns false when photo not referenced', () => {
    const floorplan = { placements: {}, photoCatalog: [{ id: '1', src: '/x.jpg', title: 'X' }] }
    expect(stripPhotoFromFloorplan(floorplan, '99')).toBe(false)
  })
})
