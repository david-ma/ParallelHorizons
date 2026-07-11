import { describe, expect, test } from 'bun:test'
import { artworkSourceUrl, buildMirrorArtworkUrl } from '../../src/js/artwork-source.js'

describe('buildMirrorArtworkUrl', () => {
  test('wraps upstream URL under /mirror/', () => {
    expect(
      buildMirrorArtworkUrl(
        'https://photos.smugmug.com/photos/i-k/0/h/L/i-k-L.jpg',
        'http://localhost:3000'
      )
    ).toBe('http://localhost:3000/mirror/https://photos.smugmug.com/photos/i-k/0/h/L/i-k-L.jpg')
  })
})

describe('artworkSourceUrl', () => {
  test('keeps same-origin relative paths', () => {
    expect(artworkSourceUrl({ id: '1', src: '/uploads/a.jpg' })).toBe('/uploads/a.jpg')
  })

  test('proxies cross-origin SmugMug URLs via Monetise mirror when configured', () => {
    ;(globalThis as { GALLERY_MIRROR_ORIGIN?: string }).GALLERY_MIRROR_ORIGIN =
      'http://localhost:3000'
    expect(
      artworkSourceUrl(
        { id: '1', src: 'https://photos.smugmug.com/photos/i-k/0/h/L/i-k-L.jpg' },
        'http://localhost:1337'
      )
    ).toBe(
      'http://localhost:3000/mirror/https://photos.smugmug.com/photos/i-k/0/h/L/i-k-L.jpg'
    )
    delete (globalThis as { GALLERY_MIRROR_ORIGIN?: string }).GALLERY_MIRROR_ORIGIN
  })

  test('returns raw src when mirror origin is unset', () => {
    const src = 'https://photos.smugmug.com/photos/i-k/0/h/L/i-k-L.jpg'
    expect(artworkSourceUrl({ id: '1', src }, 'http://localhost:1337')).toBe(src)
  })
})
