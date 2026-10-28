import { describe, expect, it } from 'vitest'
import { readStrudelNoteBars } from './noteBars'

const rounded = (bars: Awaited<ReturnType<typeof readStrudelNoteBars>>) =>
  bars.map((bar) =>
    bar.map((event) => ({
      notes: event.notes,
      start: Math.round(event.start * 1000) / 1000,
      beats: Math.round(event.beats * 1000) / 1000
    }))
  )

describe('readStrudelNoteBars', () => {
  it('turns each step of <> into its own bar and weights steps with @', async () => {
    // Act
    const bars = await readStrudelNoteBars('<[e2@2 g2] [d2 a2]>', 4)

    // Assert
    expect(rounded(bars)).toEqual([
      [
        { notes: ['e2'], start: 0, beats: 2.667 },
        { notes: ['g2'], start: 2.667, beats: 1.333 }
      ],
      [
        { notes: ['d2'], start: 0, beats: 2 },
        { notes: ['a2'], start: 2, beats: 2 }
      ]
    ])
  })

  it('repeats a note with !', async () => {
    // Act
    const bars = await readStrudelNoteBars('c3!3 d3', 4)

    // Assert
    expect(bars[0].map((event) => event.notes[0])).toEqual(['c3', 'c3', 'c3', 'd3'])
  })

  it('fits three notes into the time of one step as a triplet', async () => {
    // Act
    const bars = await readStrudelNoteBars('[c3 d3 e3] f3', 4)

    // Assert
    expect(rounded(bars)[0].map((event) => event.beats)).toEqual([0.667, 0.667, 0.667, 2])
  })

  it('leaves a rest as a gap rather than an event', async () => {
    // Act
    const bars = await readStrudelNoteBars('c3 ~ e3 ~', 4)

    // Assert
    expect(bars[0].map((event) => event.start)).toEqual([0, 2])
  })

  it('stacks the notes of a chord into one event', async () => {
    // Act
    const bars = await readStrudelNoteBars('[c3,e3,g3] a3', 4)

    // Assert
    expect(bars[0][0].notes).toEqual(['c3', 'e3', 'g3'])
    expect(bars[0]).toHaveLength(2)
  })

  it('counts beats by the cycle length it is given', async () => {
    // Act
    const bars = await readStrudelNoteBars('c3 d3 e3', 3)

    // Assert
    expect(bars[0].map((event) => event.beats)).toEqual([1, 1, 1])
  })

  it('reads one bar for a pattern that is the same every cycle', async () => {
    // Act
    const bars = await readStrudelNoteBars('c3 e3', 4)

    // Assert
    expect(bars).toHaveLength(1)
  })

  it('keeps MIDI numbers as written', async () => {
    // Act
    const bars = await readStrudelNoteBars('40 42', 4)

    // Assert
    expect(bars[0].map((event) => event.notes)).toEqual([['40'], ['42']])
  })

  it('gives no bars for a pattern it cannot read', async () => {
    // Act
    const bars = await readStrudelNoteBars('[c3 e3', 4)

    // Assert
    expect(bars).toEqual([])
  })
})
