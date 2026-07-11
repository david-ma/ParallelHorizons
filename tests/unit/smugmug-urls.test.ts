import { describe, expect, test } from 'bun:test'
import {
  isDirectImageUrl,
  resolvePhotoDisplaySrc,
  resolveSmugMugPhotoUrls,
  smugMugLargeUrlFromThumbnail,
} from '../../config/smugmug-urls.js'

describe('smugmug-urls', () => {
  test('isDirectImageUrl rejects gallery page URLs', () => {
    expect(isDirectImageUrl('https://photos.david-ma.net/Bingo/n-fHrzGJ/i-pWgmKpR')).toBe(false)
  })

  test('isDirectImageUrl accepts SmugMug CDN paths', () => {
    expect(
      isDirectImageUrl(
        'https://photos.smugmug.com/photos/i-pWgmKpR/0/hash/Th/i-pWgmKpR-Th.jpg'
      )
    ).toBe(true)
  })

  test('smugMugLargeUrlFromThumbnail upgrades Th to L', () => {
    expect(
      smugMugLargeUrlFromThumbnail(
        'https://photos.smugmug.com/photos/i-pWgmKpR/0/hash/Th/i-pWgmKpR-Th.jpg'
      )
    ).toBe('https://photos.smugmug.com/photos/i-pWgmKpR/0/hash/L/i-pWgmKpR-L.jpg')
  })

  test('resolveSmugMugPhotoUrls uses thumbnail not page URL', () => {
    const { url, thumbnailUrl } = resolveSmugMugPhotoUrls(
      { ThumbnailUrl: 'https://photos.smugmug.com/photos/i-k/0/h/Th/i-k-Th.jpg' },
      'https://photos.example.com/gallery/page'
    )
    expect(thumbnailUrl).toContain('/Th/')
    expect(url).toContain('/L/')
    expect(url).not.toContain('/Th/')
  })

  test('resolvePhotoDisplaySrc fixes stored page URL using thumbnail', () => {
    const src = resolvePhotoDisplaySrc(
      'https://photos.david-ma.net/Bingo/n-fHrzGJ/i-pWgmKpR',
      'https://photos.smugmug.com/photos/i-pWgmKpR/0/hash/Th/i-pWgmKpR-Th.jpg'
    )
    expect(src).toContain('/L/i-pWgmKpR-L.jpg')
  })
})
