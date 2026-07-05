import { describe, it, expect, beforeEach } from 'vitest'
import {
  serializePreset,
  parsePreset,
  savePresets,
  loadPresets,
  saveMapping,
  loadMapping,
  PRESETS_STORAGE_KEY
} from './presets'
import type { ControlMapping, ControlPreset } from './types'

const preset: ControlPreset = {
  name: 'My layout',
  mapping: { keyboard: { w: 'move-forward' } },
  skin: 'default'
}

describe('serializePreset / parsePreset', () => {
  it('round-trips a preset through JSON', () => {
    expect(parsePreset(serializePreset(preset))).toEqual(preset)
  })

  it('throws on malformed JSON', () => {
    expect(() => parsePreset('{ not json')).toThrow()
  })

  it('throws when required fields are missing or of the wrong type', () => {
    expect(() => parsePreset(JSON.stringify({ name: 'x', skin: 'default' }))).toThrow()
    expect(() => parsePreset(JSON.stringify({ name: 1, mapping: {}, skin: 'default' }))).toThrow()
  })
})

describe('savePresets / loadPresets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty list when nothing is stored', () => {
    expect(loadPresets()).toEqual([])
  })

  it('round-trips presets through localStorage', () => {
    savePresets([preset])
    expect(loadPresets()).toEqual([preset])
  })

  it('returns an empty list when the stored value is corrupt', () => {
    localStorage.setItem(PRESETS_STORAGE_KEY, '{ not json')
    expect(loadPresets()).toEqual([])
  })

  it('isolates presets stored under different keys', () => {
    savePresets([preset], 'game-a')
    expect(loadPresets('game-a')).toEqual([preset])
    expect(loadPresets('game-b')).toEqual([])
    expect(loadPresets()).toEqual([])
  })
})

describe('saveMapping / loadMapping', () => {
  const mapping: ControlMapping = { keyboard: { w: 'move-forward' }, gamepad: { cross: 'jump' } }

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored for the key', () => {
    expect(loadMapping('game-a')).toBeNull()
  })

  it('round-trips a mapping through localStorage per key', () => {
    saveMapping('game-a', mapping)
    expect(loadMapping('game-a')).toEqual(mapping)
    expect(loadMapping('game-b')).toBeNull()
  })

  it('returns null when the stored value is corrupt', () => {
    localStorage.setItem(`${PRESETS_STORAGE_KEY}:mapping:game-a`, '{ not json')
    expect(loadMapping('game-a')).toBeNull()
  })
})
