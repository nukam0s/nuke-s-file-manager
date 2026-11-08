import { describe, expect, it } from 'vitest'

import { formatDate, formatSize } from './format'

describe('formatSize', () => {
  it('handles zero and negatives', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(-10)).toBe('0 B')
  })

  it('formats powers of 1024', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
  })
})

describe('formatDate', () => {
  it('renders a dash for missing or invalid input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })
})
