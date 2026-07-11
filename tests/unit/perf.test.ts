import { describe, expect, test } from 'bun:test'
import { percentile, rollingMedian, slowBudget } from '../../src/js/perf'

describe('rollingMedian', () => {
  test('returns median of odd count', () => {
    expect(rollingMedian([10, 20, 30])).toBe(20)
  })

  test('returns median of even count', () => {
    expect(rollingMedian([10, 20, 30, 40])).toBe(25)
  })

  test('defaults when empty', () => {
    expect(rollingMedian([])).toBe(16.7)
  })
})

describe('percentile', () => {
  test('p95 of sample', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 95)).toBe(10)
  })
})

describe('slowBudget', () => {
  test('floor at 20ms', () => {
    expect(slowBudget(8)).toBe(20)
  })

  test('scales with median', () => {
    expect(slowBudget(16)).toBe(28)
  })
})
