/**
 * Secret loading and adapter resolution (D3).
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { resolveImageAdapter } from '../../config/load-secrets.js'

describe('resolveImageAdapter', () => {
  const saved = process.env.THALIA_IMAGE_ADAPTER

  afterEach(() => {
    if (saved === undefined) delete process.env.THALIA_IMAGE_ADAPTER
    else process.env.THALIA_IMAGE_ADAPTER = saved
  })

  test('defaults to smugmug when creds available', () => {
    delete process.env.THALIA_IMAGE_ADAPTER
    expect(resolveImageAdapter(true)).toBe('smugmug')
    expect(resolveImageAdapter(false)).toBe('local-disk')
  })

  test('THALIA_IMAGE_ADAPTER overrides', () => {
    process.env.THALIA_IMAGE_ADAPTER = 'local-disk'
    expect(resolveImageAdapter(true)).toBe('local-disk')
    process.env.THALIA_IMAGE_ADAPTER = 'smugmug'
    expect(resolveImageAdapter(false)).toBe('smugmug')
  })
})
