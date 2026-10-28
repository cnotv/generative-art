import { describe, it, expect } from 'vitest'
import type { ScoreTranscription, TabEvent, TabTranscription } from '../types'
import { generateScoreCode } from './generateScoreCode'
import { createImportedSong, generateSongBlocks, generateSongCode } from './generateSongCode'
import { generateTabCode } from './generateTabCode'

const BASS_BAR: TabEvent[] = [
  { notes: ['a2'], beats: 1 },
  { notes: ['a2', 'e3'], beats: 0.5 },
  { notes: [], beats: 0.5 },
  { notes: ['d3'], beats: 2 }
]

const BASS: TabTranscription = {
  kind: 'tab',
  beatsPerMinute: 96,
  instrument: 'bass',
  bars: [BASS_BAR, BASS_BAR],
  warnings: []
}

const GUITAR: TabTranscription = {
  ...BASS,
  instrument: 'guitar',
  bars: [[{ notes: ['e4', 'g4'], beats: 4 }]]
}

const SCORE: ScoreTranscription = {
  kind: 'score',
  beatsPerMinute: 96,
  beatsPerBar: 4,
  bars: [
    { rightHand: [{ notes: ['a5'], beats: 4 }], leftHand: [{ notes: ['f#3'], beats: 4 }] },
    { rightHand: [{ notes: ['e5'], beats: 4 }], leftHand: [{ notes: ['c#4'], beats: 4 }] }
  ],
  warnings: []
}

describe('createImportedSong', () => {
  it('names each instrument by its kind or hand and numbers a repeated one', () => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'river.png', transcription: SCORE },
      { sourceName: 'high.png', transcription: BASS }
    ]

    // Act
    const song = createImportedSong(sources)

    // Assert
    expect(song.instruments.map((instrument) => instrument.label)).toEqual([
      'bass',
      'right hand',
      'left hand',
      'bass 2'
    ])
    expect(song.instruments.map((instrument) => instrument.sourceIndex)).toEqual([0, 1, 1, 2])
  })

  it('leaves out a score hand that only rests', () => {
    // Arrange
    const melodyOnly: ScoreTranscription = {
      ...SCORE,
      bars: [{ rightHand: [{ notes: ['a4'], beats: 4 }], leftHand: [{ notes: [], beats: 4 }] }]
    }

    // Act
    const song = createImportedSong([{ sourceName: 'melody.png', transcription: melodyOnly }])

    // Assert
    expect(song.instruments.map((instrument) => instrument.label)).toEqual(['right hand'])
  })

  it('keeps the first tempo and warns about a file marked with another one', () => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'chords.png', transcription: { ...GUITAR, beatsPerMinute: 120 } }
    ]

    // Act
    const song = createImportedSong(sources)

    // Assert
    expect(song.beatsPerMinute).toBe(96)
    expect(song.warnings).toContain(
      'The guitar tab "chords.png" is marked 120 BPM; the song plays at 96 BPM, the first file\'s tempo'
    )
  })

  it('warns when a score counts another number of beats to the bar than the first file', () => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'waltz.png', transcription: { ...SCORE, beatsPerBar: 3 } }
    ]

    // Act
    const song = createImportedSong(sources)

    // Assert
    expect(song.beatsPerBar).toBe(4)
    expect(song.warnings).toContain(
      'The piano score "waltz.png" has 3 beats to the bar, but each bar fills a cycle of 4, so it plays slower than marked'
    )
  })

  it.each([
    [2, 1, 0],
    [4, 2, 0],
    [3, 2, 1]
  ])('warns %#: %i and %i bars give %i loop warnings', (bassBars, guitarBars, warningCount) => {
    // Arrange
    const sources = [
      { sourceName: 'low.png', transcription: { ...BASS, bars: Array(bassBars).fill(BASS_BAR) } },
      {
        sourceName: 'chords.png',
        transcription: { ...GUITAR, bars: Array(guitarBars).fill(BASS_BAR) }
      }
    ]

    // Act
    const song = createImportedSong(sources)

    // Assert
    expect(song.warnings.filter((warning) => warning.includes('loop'))).toHaveLength(warningCount)
  })
})

describe('generateSongCode', () => {
  it.each([false, true])(
    'writes a song of one tab exactly as a single tab import, visualizer %s',
    (addVisualizer) => {
      // Arrange
      const song = createImportedSong([{ sourceName: 'riff.png', transcription: BASS }])

      // Act
      const code = generateSongCode(song, { addVisualizer })

      // Assert
      expect(code).toBe(generateTabCode(BASS, 'riff.png', { addVisualizer }))
    }
  )

  it.each([false, true])(
    'writes a song of one score exactly as a single score import, visualizer %s',
    (addVisualizer) => {
      // Arrange
      const song = createImportedSong([{ sourceName: 'river.png', transcription: SCORE }])

      // Act
      const code = generateSongCode(song, { addVisualizer })

      // Assert
      expect(code).toBe(generateScoreCode(SCORE, 'river.png', { addVisualizer }))
    }
  )

  it('sets the tempo once and plays every instrument as its own labelled block', () => {
    // Arrange
    const song = createImportedSong([
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'chords.png', transcription: GUITAR }
    ])

    // Act
    const code = generateSongCode(song)

    // Assert
    expect(code).toBe(
      [
        '// Read from 2 images: bass "low.png", guitar "chords.png"',
        'setcps(96/60/4)',
        '// bass "low.png": 2 bars',
        '$: note("a2@2 [a2,e3] ~ d3@4").s("gm_electric_bass_finger")',
        '// guitar "chords.png": 1 bars',
        '$: note("[e4,g4]").s("gm_acoustic_guitar_nylon")'
      ].join('\n')
    )
  })

  it('plays a score next to a tab, one block per hand, with a pianoroll under each', () => {
    // Arrange
    const song = createImportedSong([
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'river.png', transcription: SCORE }
    ])

    // Act
    const code = generateSongCode(song, { addVisualizer: true })

    // Assert
    expect(code).toBe(
      [
        '// Read from 2 images: bass "low.png", piano score "river.png"',
        'setcps(96/60/4)',
        '// bass "low.png": 2 bars',
        '$: note("a2@2 [a2,e3] ~ d3@4").s("gm_electric_bass_finger")',
        '  ._pianoroll()',
        '// right hand "river.png": 2 bars',
        '$: note("<a5 e5>").s("gm_piano")',
        '  ._pianoroll()',
        '// left hand "river.png": 2 bars',
        '$: note("<f#3 c#4>").s("gm_piano")',
        '  ._pianoroll()'
      ].join('\n')
    )
  })

  it('keeps a silent tab as a silent block, with nothing drawn under it', () => {
    // Arrange
    const silent: TabTranscription = { ...GUITAR, bars: [[{ notes: [], beats: 4 }]] }
    const song = createImportedSong([
      { sourceName: 'low.png', transcription: BASS },
      { sourceName: 'blank.png', transcription: silent }
    ])

    // Act
    const code = generateSongCode(song, { addVisualizer: true })

    // Assert
    expect(code.endsWith('$: silence')).toBe(true)
  })
})

describe('generateSongBlocks', () => {
  it.each([
    [false, ''],
    [true, '\n  ._pianoroll()']
  ])(
    'writes only the labelled blocks, leaving the tempo to the code they join, visualizer %s',
    (addVisualizer, visual) => {
      // Arrange
      const lead: TabTranscription = { ...GUITAR, bars: [[{ notes: ['e4'], beats: 4 }]] }
      const song = createImportedSong([{ sourceName: 'lead.png', transcription: lead }])

      // Act
      const blocks = generateSongBlocks(song, { addVisualizer })

      // Assert
      expect(blocks).toBe(
        `// guitar "lead.png": 1 bars\n$: note("e4").s("gm_acoustic_guitar_nylon")${visual}`
      )
    }
  )
})
