import { describe, expect, test } from 'bun:test'
import { canViewDbGallery, slugifyTitle, type DbGalleryRow } from '../../config/gallery-store.js'

describe('slugifyTitle', () => {
  test('lowercases and hyphenates', () => {
    expect(slugifyTitle('My Gallery')).toBe('my-gallery')
  })

  test('falls back when empty', () => {
    expect(slugifyTitle('   !!! ')).toBe('gallery')
  })
})

describe('canViewDbGallery', () => {
  const row: DbGalleryRow = {
    id: 1,
    slug: 'test',
    ownerUserId: 42,
    title: 'Test',
    description: null,
    floorplanJson: '{}',
    isPublished: false,
  }

  test('published galleries are public', () => {
    expect(canViewDbGallery({ ...row, isPublished: true }, undefined)).toBe(true)
  })

  test('draft visible to owner only', () => {
    expect(canViewDbGallery(row, 42)).toBe(true)
    expect(canViewDbGallery(row, 99)).toBe(false)
    expect(canViewDbGallery(row, undefined)).toBe(false)
  })
})
