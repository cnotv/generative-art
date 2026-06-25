import { describe, it, expect } from 'vitest'
import { musicEventsFromHaps } from './events'
import type { MusicHap } from './types'

describe('musicEventsFromHaps', () => {
  it('maps haps to a seconds timeline, labels them, and sorts by start time', () => {
    const haps: MusicHap[] = [
      { whole: { begin: 0.5, end: 1 }, value: 'hh' },
      { whole: { begin: 0, end: 0.5 }, value: { s: 'bd' } },
      { whole: { begin: 0.25, end: 0.5 }, value: { note: 'c4' } }
    ]

    const events = musicEventsFromHaps(haps, 2)

    expect(events).toEqual([
      { time: 0, duration: 1, value: 'bd' },
      { time: 0.5, duration: 0.5, value: 'c4' },
      { time: 1, duration: 1, value: 'hh' }
    ])
  })

  it('drops haps without a whole span', () => {
    const haps: MusicHap[] = [{ value: 'ghost' }, { whole: { begin: 0, end: 1 }, value: 'bd' }]

    expect(musicEventsFromHaps(haps, 1)).toEqual([{ time: 0, duration: 1, value: 'bd' }])
  })
})
