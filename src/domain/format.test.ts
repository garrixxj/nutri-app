import { describe, expect, it } from 'vitest'
import { formatInt, parseDecimal, toInputString } from './format.ts'

describe('parseDecimal', () => {
  it('accepts comma and dot', () => {
    expect(parseDecimal('72,5')).toBe(72.5)
    expect(parseDecimal('72.5')).toBe(72.5)
    expect(parseDecimal(' 80 ')).toBe(80)
    expect(parseDecimal('80,')).toBe(80)
  })

  it('rejects empty, negative and garbage', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('-3')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })
})

describe('formatting', () => {
  it('uses Chilean thousands separator', () => {
    expect(formatInt(2933.4)).toBe('2.933')
  })

  it('round-trips to an input string with comma', () => {
    expect(toInputString(12.5)).toBe('12,5')
    expect(toInputString(null)).toBe('')
  })
})
