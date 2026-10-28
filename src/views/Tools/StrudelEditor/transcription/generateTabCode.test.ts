import { describe, it, expect } from 'vitest'
import { formatTabBar, generateTabCode } from './generateTabCode'
import type { TabTranscription } from '../types'

const BASS_BAR = [
  { notes: ['a2'], beats: 1 },
  { notes: ['a2', 'e3'], beats: 0.5 },
  { notes: [], beats: 0.5 },
  { notes: ['d3'], beats: 2 }
]

describe('formatTabBar', () => {
  it('writes lengths as weights, chords in brackets and rests as tildes', () => {
    // Arrange
    const bar = BASS_BAR

    // Act
    const written = formatTabBar(bar)

    // Assert
    expect(written).toBe('a2@2 [a2,e3] ~ d3@4')
  })

  it('keeps triplets whole by counting in twenty-fourths of a beat', () => {
    // Arrange
    const bar = [
      { notes: ['d3'], beats: 1 / 6 },
      { notes: ['e3'], beats: 1 / 6 },
      { notes: ['d3'], beats: 1 / 6 },
      { notes: ['c3'], beats: 3.5 }
    ]

    // Act
    const written = formatTabBar(bar)

    // Assert
    expect(written).toBe('d3 e3 d3 c3@21')
  })
})

describe('generateTabCode', () => {
  const transcription: TabTranscription = {
    kind: 'tab',
    beatsPerMinute: 96,
    instrument: 'bass',
    bars: [BASS_BAR, BASS_BAR],
    warnings: []
  }

  it('sets the tempo and plays the bars on the bass sound', () => {
    // Arrange
    const result = transcription

    // Act
    const code = generateTabCode(result, 'riff.png')

    // Assert
    expect(code).toBe(
      [
        '// Read from the bass tab "riff.png": 2 bars',
        'setcps(96/60/4)',
        'note("a2@2 [a2,e3] ~ d3@4").s("gm_electric_bass_finger")'
      ].join('\n')
    )
  })

  it('writes silence when no note was read', () => {
    // Arrange
    const empty: TabTranscription = { ...transcription, bars: [[{ notes: [], beats: 4 }]] }

    // Act
    const code = generateTabCode(empty, 'blank.png')

    // Assert
    expect(code.endsWith('silence')).toBe(true)
  })

  it('puts a guitar tab on a guitar sound', () => {
    // Arrange
    const guitar: TabTranscription = { ...transcription, instrument: 'guitar' }

    // Act
    const code = generateTabCode(guitar, 'riff.png')

    // Assert
    expect(code).toContain('.s("gm_acoustic_guitar_nylon")')
  })
})
