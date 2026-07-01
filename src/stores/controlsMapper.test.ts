import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { PRESETS_STORAGE_KEY } from '@webgamekit/controls'
import { useControlsMapperStore } from './controlsMapper'

describe('useControlsMapperStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts from the default mapping and default skin', () => {
    const store = useControlsMapperStore()
    expect(Object.values(store.mapping.keyboard ?? {})).toContain('move-forward')
    expect(store.selectedSkin).toBe('default')
  })

  it('bindTrigger reassigns an action to a new trigger on a device', () => {
    const store = useControlsMapperStore()
    store.bindTrigger('keyboard', 'ArrowUp', 'jump')
    expect(store.mapping.keyboard?.ArrowUp).toBe('jump')
  })

  it('clearTrigger removes a trigger', () => {
    const store = useControlsMapperStore()
    store.bindTrigger('keyboard', 'ArrowUp', 'jump')
    store.clearTrigger('keyboard', 'ArrowUp')
    expect(store.mapping.keyboard?.ArrowUp).toBeUndefined()
  })

  it('savePreset persists the current mapping and skin', () => {
    const store = useControlsMapperStore()
    store.selectSkin('neon')
    store.bindTrigger('keyboard', 'ArrowUp', 'jump')
    store.savePreset('My layout')

    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    expect(raw).toContain('My layout')

    setActivePinia(createPinia())
    const reloaded = useControlsMapperStore()
    expect(reloaded.presets.map((preset) => preset.name)).toContain('My layout')
  })

  it('applyPreset restores a stored mapping and skin', () => {
    const store = useControlsMapperStore()
    store.selectSkin('neon')
    store.bindTrigger('keyboard', 'ArrowUp', 'jump')
    store.savePreset('My layout')

    store.resetToDefaults()
    store.applyPreset('My layout')

    expect(store.mapping.keyboard?.ArrowUp).toBe('jump')
    expect(store.selectedSkin).toBe('neon')
  })

  it('deletePreset removes a stored preset', () => {
    const store = useControlsMapperStore()
    store.savePreset('A')
    store.deletePreset('A')
    expect(store.presets.map((preset) => preset.name)).not.toContain('A')
  })

  it('importPreset applies a valid JSON preset', () => {
    const store = useControlsMapperStore()
    const json = JSON.stringify({
      name: 'Imported',
      mapping: { keyboard: { z: 'jump' } },
      skin: 'minimal'
    })
    store.importPreset(json)
    expect(store.mapping.keyboard?.z).toBe('jump')
    expect(store.selectedSkin).toBe('minimal')
  })

  it('importPreset throws on invalid JSON', () => {
    const store = useControlsMapperStore()
    expect(() => store.importPreset('{ bad')).toThrow()
  })

  it('resetToDefaults restores the default mapping and skin', () => {
    const store = useControlsMapperStore()
    store.selectSkin('neon')
    store.bindTrigger('keyboard', 'z', 'jump')

    store.resetToDefaults()

    expect(store.selectedSkin).toBe('default')
    expect(store.mapping.keyboard?.z).toBeUndefined()
    expect(Object.values(store.mapping.keyboard ?? {})).toContain('move-forward')
  })

  it('records and clears live actions', () => {
    const store = useControlsMapperStore()
    store.recordAction('jump', ' ', 'keyboard')
    expect(store.liveActions).toContain('jump')
    store.recordRelease('jump')
    expect(store.liveActions).not.toContain('jump')
  })
})
