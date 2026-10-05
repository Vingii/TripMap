import { describe, expect, it } from 'vitest'
import { formatAlbumDate } from '../albumDate'

describe('formatAlbumDate', () => {
  it('shows the full date at day precision', () => {
    expect(formatAlbumDate('2024-07-14', 'day')).toBe('14 Jul 2024')
  })

  it('drops the day at month precision', () => {
    expect(formatAlbumDate('2024-07-01', 'month')).toBe('Jul 2024')
  })

  it('shows only the year at year precision', () => {
    expect(formatAlbumDate('2024-01-01', 'year')).toBe('2024')
  })

  it('does not zero-pad the day', () => {
    expect(formatAlbumDate('2024-12-05', 'day')).toBe('5 Dec 2024')
  })
})
