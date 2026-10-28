import { describe, it, expect } from 'vitest'
import {
  createTabSong,
  formatTabBar,
  generateTabCode,
  generateTabSongBlocks,
  generateTabSongCode
} from './generateTabCode'
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

describe('createTabSong', () => {
  const bass: TabTranscription = {
    kind: 'tab',
    beatsPerMinute: 96,
    instrument: 'bass',
    bars: [BASS_BAR, BASS_BAR],
    warnings: []
  }
  const guitar: TabTranscription = { ...bass, instrument: 'guitar', bars: [BASS_BAR] }

  it('names each instrument by its kind and numbers a repeated one', () => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: bass },
      { sourceName: 'chords.png', transcription: guitar },
      { sourceName: 'high.png', transcription: bass }
    ]

    // Act
    const song = createTabSong(sources)

    // Assert
    expect(song.instruments.map((instrument) => instrument.label)).toEqual([
      'bass',
      'guitar',
      'bass 2'
    ])
  })

  it('keeps the first tempo and warns about a tab marked with another one', () => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: bass },
      { sourceName: 'chords.png', transcription: { ...guitar, beatsPerMinute: 120 } }
    ]

    // Act
    const song = createTabSong(sources)

    // Assert
    expect(song.beatsPerMinute).toBe(96)
    expect(song.warnings).toContain(
      'The guitar tab "chords.png" is marked 120 BPM; the song plays at 96 BPM, the first tab\'s tempo'
    )
  })

  it.each([
    [2, 1, 0],
    [4, 2, 0],
    [3, 2, 1]
  ])(
    'warns %#: %i and %i bars give %i loop warnings',
    (bassBarCount, guitarBarCount, warningCount) => {
      // Arrange
      const sources = [
        {
          sourceName: 'low.png',
          transcription: { ...bass, bars: Array(bassBarCount).fill(BASS_BAR) }
        },
        {
          sourceName: 'chords.png',
          transcription: { ...guitar, bars: Array(guitarBarCount).fill(BASS_BAR) }
        }
      ]

      // Act
      const song = createTabSong(sources)

      // Assert
      expect(song.warnings.filter((warning) => warning.includes('loop'))).toHaveLength(warningCount)
    }
  )
})

describe('generateTabSongCode', () => {
  const bass: TabTranscription = {
    kind: 'tab',
    beatsPerMinute: 96,
    instrument: 'bass',
    bars: [BASS_BAR, BASS_BAR],
    warnings: []
  }
  const guitar: TabTranscription = {
    ...bass,
    instrument: 'guitar',
    bars: [[{ notes: ['e4', 'g4'], beats: 4 }]]
  }

  it('writes a song of one tab exactly as a single import does', () => {
    // Arrange
    const song = createTabSong([{ sourceName: 'riff.png', transcription: bass }])

    // Act
    const code = generateTabSongCode(song)

    // Assert
    expect(code).toBe(generateTabCode(bass, 'riff.png'))
  })

  it('sets the tempo once and plays every tab as its own labelled block', () => {
    // Arrange
    const song = createTabSong([
      { sourceName: 'low.png', transcription: bass },
      { sourceName: 'chords.png', transcription: guitar }
    ])

    // Act
    const code = generateTabSongCode(song)

    // Assert
    expect(code).toBe(
      [
        '// Read from 2 tabs: bass "low.png", guitar "chords.png"',
        'setcps(96/60/4)',
        '// bass "low.png": 2 bars',
        '$: note("a2@2 [a2,e3] ~ d3@4").s("gm_electric_bass_finger")',
        '// guitar "chords.png": 1 bars',
        '$: note("[e4,g4]").s("gm_acoustic_guitar_nylon")'
      ].join('\n')
    )
  })

  it('keeps a silent tab as a silent block', () => {
    // Arrange
    const silent: TabTranscription = { ...guitar, bars: [[{ notes: [], beats: 4 }]] }
    const song = createTabSong([
      { sourceName: 'low.png', transcription: bass },
      { sourceName: 'blank.png', transcription: silent }
    ])

    // Act
    const code = generateTabSongCode(song)

    // Assert
    expect(code.endsWith('$: silence')).toBe(true)
  })
})

describe('generateTabSongBlocks', () => {
  it('writes only the labelled blocks, leaving the tempo to the code they join', () => {
    // Arrange
    const guitar: TabTranscription = {
      kind: 'tab',
      beatsPerMinute: 96,
      instrument: 'guitar',
      bars: [[{ notes: ['e4'], beats: 4 }]],
      warnings: []
    }
    const song = createTabSong([{ sourceName: 'lead.png', transcription: guitar }])

    // Act
    const blocks = generateTabSongBlocks(song)

    // Assert
    expect(blocks).toBe(
      ['// guitar "lead.png": 1 bars', '$: note("e4").s("gm_acoustic_guitar_nylon")'].join('\n')
    )
  })
})
