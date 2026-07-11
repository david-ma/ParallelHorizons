import { describe, expect, test } from 'bun:test'
import { wouldCreateFolderCycle } from '../../config/folder-store.js'
import { parsePhotoListOptions } from '../../config/photo-library-routes.js'

describe('wouldCreateFolderCycle', () => {
  const folders = [
    { id: '1', name: 'A', parentId: null, sortOrder: 0 },
    { id: '2', name: 'B', parentId: '1', sortOrder: 0 },
    { id: '3', name: 'C', parentId: '2', sortOrder: 0 },
  ]

  test('detects moving folder under its descendant', () => {
    expect(wouldCreateFolderCycle(folders, '1', '3')).toBe(true)
  })

  test('allows valid reparent', () => {
    expect(wouldCreateFolderCycle(folders, '3', '1')).toBe(false)
  })
})

describe('parsePhotoListOptions', () => {
  test('parses folder and search filters', () => {
    expect(parsePhotoListOptions({ folderId: '5', q: 'sunset', unplaced: '1' })).toEqual({
      folderId: 5,
      q: 'sunset',
      unplaced: true,
    })
  })

  test('root folder filter', () => {
    expect(parsePhotoListOptions({ folderId: 'root' })).toEqual({ folderId: 'root' })
  })
})
