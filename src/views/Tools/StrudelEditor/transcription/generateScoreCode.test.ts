import { describe, it, expect } from 'vitest'
import type { ScoreTranscription } from '../types'
import { generateScoreCode } from './generateScoreCode'

const score = (overrides: Partial<ScoreTranscription> = {}): ScoreTranscription => ({
  kind: 'score',
  beatsPerMinute: 65,
  beatsPerBar: 4,
  bars: [
    {
      rightHand: [
        { notes: [], beats: 3.5 },
        { notes: ['a4'], beats: 0.25 },
        { notes: ['c#5'], beats: 0.25 }
      ],
      leftHand: [{ notes: [], beats: 4 }]
    },
    {
      rightHand: [{ notes: ['a5', 'e5'], beats: 4 }],
      leftHand: [
        { notes: ['f#3'], beats: 2 },
        { notes: ['c#4'], beats: 2 }
      ]
    }
  ],
  warnings: [],
  ...overrides
})

describe('generateScoreCode', () => {
  it('writes one bar per cycle at the read tempo', () => {
    // Arrange
    const transcription = score()

    // Act
    const code = generateScoreCode(transcription, 'river.png')

    // Assert
    expect(code).toContain('// Read from the piano score "river.png": 2 bars')
    expect(code).toContain('setcps(65/60/4)')
  })

  it('writes the right hand and the left hand as two labelled blocks on a piano', () => {
    // Arrange
    const transcription = score()

    // Act
    const lines = generateScoreCode(transcription, 'river.png').split('\n')

    // Assert
    expect(lines).toContain('$: note("<[~@14 a4 c#5] [a5,e5]>").s("gm_piano")')
    expect(lines).toContain('$: note("<~ [f#3 c#4]>").s("gm_piano")')
    expect(lines.indexOf('// right hand')).toBeLessThan(lines.indexOf('// left hand'))
  })

  it('counts a bar in the metre that was read, such as three beats', () => {
    // Arrange
    const transcription = score({ beatsPerBar: 3 })

    // Act
    const code = generateScoreCode(transcription, 'waltz.png')

    // Assert
    expect(code).toContain('setcps(65/60/3)')
  })

  it('leaves out a hand that only rests', () => {
    // Arrange
    const transcription = score({
      bars: [{ rightHand: [{ notes: ['a4'], beats: 4 }], leftHand: [{ notes: [], beats: 4 }] }]
    })

    // Act
    const code = generateScoreCode(transcription, 'melody.png')

    // Assert
    expect(code).not.toContain('// left hand')
  })
})
