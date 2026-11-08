import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BUILT_IN_PRESETS, INSTRUMENT_PREVIEW_PHRASES } from './config'
import { buildInstrumentPreviewCode, buildInstrumentPreviewHits } from './previewPhrase'

const findPreset = (name: string) => {
  const preset = INSTRUMENT_BUILT_IN_PRESETS.find((candidate) => candidate.name === name)
  if (preset === undefined) {
    throw new Error(`no preset ${name}`)
  }
  return preset
}

describe('buildInstrumentPreviewHits', () => {
  it('spells each articulation as the preset sound', () => {
    // Arrange
    const preset = findPreset('chainsaw')

    // Act
    const hits = buildInstrumentPreviewHits(preset)

    // Assert
    expect(hits).toHaveLength(INSTRUMENT_PREVIEW_PHRASES['electric-guitar'].length)
    expect(hits.every(({ sound }) => sound.startsWith('chainsaw_'))).toBe(true)
  })
})

describe('buildInstrumentPreviewCode', () => {
  it('writes one cycle that plays every hit of the phrase', () => {
    // Arrange
    const preset = findPreset('fuzzbass')

    // Act
    const code = buildInstrumentPreviewCode(preset)

    // Assert
    expect(code).toContain('setcps(')
    expect(code.match(/\.s\("fuzzbass_/g)).toHaveLength(
      INSTRUMENT_PREVIEW_PHRASES['bass-guitar'].length
    )
    expect(code.match(/\.clip\(1\)/g)).toHaveLength(
      INSTRUMENT_PREVIEW_PHRASES['bass-guitar'].length
    )
  })

  it('squeezes each hit into the span it sounds in', () => {
    // Arrange
    const preset = findPreset('fuzzbass')
    const [first] = INSTRUMENT_PREVIEW_PHRASES['bass-guitar']
    const lastHit = INSTRUMENT_PREVIEW_PHRASES['bass-guitar'].at(-1)
    const cycleSeconds = (lastHit?.offsetSeconds ?? 0) + (lastHit?.durationSeconds ?? 0) + 0.5

    // Act
    const code = buildInstrumentPreviewCode(preset)

    // Assert
    const expectedEnd = Number(((first?.durationSeconds ?? 0) / cycleSeconds).toFixed(6))
    expect(code).toContain(`.compress(0, ${expectedEnd})`)
    const cps = Number(/setcps\(([\d.]+)\)/.exec(code)?.[1])
    expect(1 / cps).toBeCloseTo(cycleSeconds, 3)
  })

  it('leaves the note call out for an unpitched drum', () => {
    // Arrange
    const preset = findPreset('blastkit')

    // Act
    const code = buildInstrumentPreviewCode(preset)

    // Assert
    expect(code).toContain('s("blastkit_kick")')
    expect(code).not.toContain('note(')
  })
})
