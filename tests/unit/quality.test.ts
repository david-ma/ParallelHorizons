import { describe, expect, test } from 'bun:test'
import {
  clientBrowserLabel,
  isSafariUserAgent,
  resolvePixelRatioCap,
  resolveSpotlightCap,
} from '../../src/js/quality'

describe('isSafariUserAgent', () => {
  test('detects Safari', () => {
    expect(
      isSafariUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
      )
    ).toBe(true)
  })

  test('excludes Chrome', () => {
    expect(isSafariUserAgent('Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36')).toBe(false)
  })
})

describe('resolveSpotlightCap', () => {
  test('Safari caps heavy galleries at 4', () => {
    expect(resolveSpotlightCap(25, true)).toBe(4)
  })

  test('desktop keeps cap at 8 for heavy galleries', () => {
    expect(resolveSpotlightCap(25, false)).toBe(8)
  })
})

describe('resolvePixelRatioCap', () => {
  test('Safari lowers DPR on heavy galleries', () => {
    expect(resolvePixelRatioCap(25, '', true)).toBe(1)
  })

  test('quality=high overrides Safari cap', () => {
    expect(resolvePixelRatioCap(25, '?quality=high', true)).toBe(2)
  })
})

describe('clientBrowserLabel', () => {
  test('returns a string', () => {
    expect(typeof clientBrowserLabel()).toBe('string')
  })
})
