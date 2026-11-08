import { describe, expect, it } from 'vitest'
import { INSTRUMENT_KINDS, INSTRUMENT_KIND_IDS } from './config'
import { buildInstrumentExample } from './instrumentExample'

const PRESET_NAME = 'mytone'

const readSoundNames = (code: string): string[] =>
  [...code.matchAll(/(?:s|note)\("[^"]*"\)/g)]
    .filter(([call]) => call.startsWith('s('))
    .flatMap(([call]) => call.slice(3, -2).split(/[\d\s*,[\]]+/))
    .filter((word) => word !== '' && word !== '~')

describe('buildInstrumentExample', () => {
  it.each(INSTRUMENT_KIND_IDS)('gives %s a complete example that sets its own tempo', (kind) => {
    // Arrange
    const preset = { name: PRESET_NAME, kind, knobs: {} }

    // Act
    const example = buildInstrumentExample(preset)

    // Assert
    expect(example).toMatch(/^setcpm\(\d+\/4\)\n/)
    expect(example).toContain('$: ')
    expect(example).not.toContain('{name}')
  })

  it.each(INSTRUMENT_KIND_IDS)('names only sounds that %s registers', (kind) => {
    // Arrange
    const { articulations, techniques } = INSTRUMENT_KINDS[kind]
    const registered = [
      PRESET_NAME,
      ...articulations.map(({ id }) => `${PRESET_NAME}_${id}`),
      ...techniques.map((id) => `${PRESET_NAME}:${id}`)
    ]

    // Act
    const named = readSoundNames(buildInstrumentExample({ name: PRESET_NAME, kind, knobs: {} }))

    // Assert
    expect(named.length).toBeGreaterThan(0)
    expect(named.every((sound) => registered.includes(sound))).toBe(true)
  })
})
