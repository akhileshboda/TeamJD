import { describe, expect, it } from 'vitest'
import { filterEntries, formatChangelogDate, orderEntries } from './changelog'

const entries = [
  { date: '2026-10-27', text: 'Added a booking button to the Services page.' },
  { date: '2026-10-24', text: 'Fixed result cards on the About page.' },
  { date: '2026-09-18', text: 'Jake can now replace photos and videos.' },
]

describe('changelog helpers', () => {
  it('formats a calendar day without drifting across time zones', () => {
    expect(formatChangelogDate('2026-10-27')).toBe('27 Oct 2026')
    expect(formatChangelogDate('2026-01-01')).toBe('1 Jan 2026')
  })

  it('searches the update text and its date, requiring every word', () => {
    expect(filterEntries(entries, '')).toBe(entries)
    expect(filterEntries(entries, '  ')).toBe(entries)
    expect(filterEntries(entries, 'PHOTOS').map((e) => e.date)).toEqual(['2026-09-18'])
    expect(filterEntries(entries, 'oct').map((e) => e.date)).toEqual(['2026-10-27', '2026-10-24'])
    expect(filterEntries(entries, 'oct about').map((e) => e.date)).toEqual(['2026-10-24'])
    expect(filterEntries(entries, 'nothing like this')).toEqual([])
  })

  it('orders newest first by default and reverses for oldest first', () => {
    expect(orderEntries(entries, 'newest')).toBe(entries)
    expect(orderEntries(entries, 'oldest').map((e) => e.date)).toEqual(['2026-09-18', '2026-10-24', '2026-10-27'])
    expect(entries[0].date).toBe('2026-10-27')
  })
})
