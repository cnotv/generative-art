import { describe, expect, it, vi } from 'vitest'
import {
  endNoteAtEvent,
  makeNotesEndAtEvent,
  readPitchedSoundNames,
  readTechniqueIndex
} from './eventLengthNotes'

describe('endNoteAtEvent', () => {
  it('ends a note with its event when the pattern says nothing about its length', () => {
    // Arrange
    const hapValue = { s: 'chainsaw_note', note: 'e2' }

    // Act
    const played = endNoteAtEvent(hapValue)

    // Assert
    expect(played).toEqual({ s: 'chainsaw_note', note: 'e2', clip: 1 })
  })

  it.each([
    ['clip', { clip: 2 }],
    ['legato', { legato: 0.5 }],
    ['release', { release: 1.5 }],
    ['loop', { loop: 1 }],
    ['cut', { cut: 1 }]
  ])('leaves the length to the pattern when it sets %s', (_control, lengthControl) => {
    // Arrange
    const hapValue = { s: 'chainsaw_note', note: 'e2', ...lengthControl }

    // Act
    const played = endNoteAtEvent(hapValue)

    // Assert
    expect(played).toEqual(hapValue)
  })
})

describe('readPitchedSoundNames', () => {
  it.each([
    [
      { name: 'chainsaw', kind: 'electric-guitar' as const, knobs: {} },
      ['chainsaw', 'chainsaw_chord', 'chainsaw_mute', 'chainsaw_note']
    ],
    [
      { name: 'deathbass', kind: 'bass-guitar' as const, knobs: {} },
      ['deathbass', 'deathbass_note', 'deathbass_mute']
    ],
    [{ name: 'blastkit', kind: 'drum-kit' as const, knobs: {} }, []]
  ])('names the sounds of %o that play notes, never a drum', (preset, expectedNames) => {
    // Arrange, Act
    const soundNames = readPitchedSoundNames(preset)

    // Assert
    expect(soundNames).toEqual(expectedNames)
  })
})

describe('readTechniqueIndex', () => {
  it.each([
    ['note', 0],
    ['mute', 1],
    ['chord', 2],
    ['banjo', 0],
    [2, 2],
    [undefined, undefined]
  ])('turns the technique %s into the sample index %s', (technique, expectedIndex) => {
    // Arrange
    const hapValue = { s: 'chainsaw', note: 'a1', n: technique }

    // Act
    const played = readTechniqueIndex(hapValue, ['note', 'mute', 'chord'])

    // Assert
    expect(played.n).toBe(expectedIndex)
  })
})

describe('makeNotesEndAtEvent', () => {
  it('lets the combined sound take a technique by name', () => {
    // Arrange
    const originalTrigger = vi.fn()
    const registerSound = vi.fn()
    const webaudioModule = {
      registerSound,
      soundMap: { get: () => ({ chainsaw: { onTrigger: originalTrigger, data: {} } }) }
    }

    // Act
    makeNotesEndAtEvent(webaudioModule, { name: 'chainsaw', kind: 'electric-guitar', knobs: {} })
    registerSound.mock.calls[0]?.[1](1, { s: 'chainsaw', n: 'chord' }, 'onEnded')

    // Assert
    expect(originalTrigger).toHaveBeenCalledWith(1, { s: 'chainsaw', n: 2, clip: 1 }, 'onEnded')
  })

  it('registers each sound again with a trigger that ends its notes at their event', () => {
    // Arrange
    const originalTrigger = vi.fn()
    const registerSound = vi.fn()
    const soundData = { type: 'sample', tag: 'instrument:electric-guitar:chainsaw' }
    const webaudioModule = {
      registerSound,
      soundMap: { get: () => ({ chainsaw_note: { onTrigger: originalTrigger, data: soundData } }) }
    }

    // Act
    makeNotesEndAtEvent(webaudioModule, { name: 'chainsaw', kind: 'electric-guitar', knobs: {} })
    const [name, wrappedTrigger, data] = registerSound.mock.calls[0] ?? []
    wrappedTrigger(1.5, { s: 'chainsaw_note', note: 'a1' }, 'onEnded')

    // Assert
    expect(registerSound).toHaveBeenCalledOnce()
    expect(name).toBe('chainsaw_note')
    expect(data).toBe(soundData)
    expect(originalTrigger).toHaveBeenCalledWith(
      1.5,
      { s: 'chainsaw_note', note: 'a1', clip: 1 },
      'onEnded'
    )
  })
})
