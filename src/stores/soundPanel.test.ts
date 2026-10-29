import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { SoundSlot } from '@/types/soundPanel'

const renderStrudelSound = vi.hoisted(() => vi.fn())
vi.mock('@/utils/soundRender', () => ({ renderStrudelSound }))

import { useSoundPanelStore } from './soundPanel'

const slots: SoundSlot[] = [
  { id: 'theme', label: 'Theme', code: 'theme code', kind: 'loop', loopCycles: 8 },
  { id: 'bump', label: 'Bump', code: 'bump code', kind: 'once' }
]
const wav = new ArrayBuffer(8)

beforeEach(() => {
  setActivePinia(createPinia())
  renderStrudelSound.mockReset().mockResolvedValue(wav)
})

describe('soundPanel store registration', () => {
  it('is unavailable until a game registers sounds', () => {
    expect(useSoundPanelStore().isAvailable).toBe(false)
  })

  it('offers each slot with its shipped code and selects the first', () => {
    const store = useSoundPanelStore()

    store.register('RockRunner', slots, vi.fn())

    expect(store.isAvailable).toBe(true)
    expect(store.selectedId).toBe('theme')
    expect(store.codeOf('bump')).toBe('bump code')
    expect(store.isModified('bump')).toBe(false)
  })

  it('forgets everything when the game unregisters', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())

    store.unregister('RockRunner')

    expect(store.isAvailable).toBe(false)
  })

  it('ignores an unregister from a game that is not the registered one', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())

    store.unregister('OtherGame')

    expect(store.isAvailable).toBe(true)
  })
})

describe('soundPanel store editing', () => {
  it('marks a slot modified once its code differs from the shipped one', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())

    store.setCode('bump', 'new code')

    expect(store.isModified('bump')).toBe(true)
    expect(store.codeOf('bump')).toBe('new code')
  })

  it('renders the edited code and hands the file to the game on apply', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('RockRunner', slots, onApply)
    store.setCode('bump', 'new code')

    await store.apply('bump')

    expect(renderStrudelSound).toHaveBeenCalledWith('new code', slots[1])
    expect(onApply).toHaveBeenCalledWith('bump', wav)
    expect(store.statusOf('bump')).toBe('applied')
  })

  it('reports a rendering state while it works', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    let finish: (value: ArrayBuffer) => void = () => undefined
    renderStrudelSound.mockReturnValue(new Promise<ArrayBuffer>((resolve) => (finish = resolve)))

    const applying = store.apply('bump')

    expect(store.statusOf('bump')).toBe('rendering')
    finish(wav)
    await applying
    expect(store.statusOf('bump')).toBe('applied')
  })

  it('shows the error and leaves the game alone when the code fails', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('RockRunner', slots, onApply)
    renderStrudelSound.mockRejectedValue(new Error('bd is not defined'))

    await store.apply('bump')

    expect(onApply).not.toHaveBeenCalled()
    expect(store.statusOf('bump')).toBe('error')
    expect(store.errorOf('bump')).toBe('bd is not defined')
  })

  it('ignores a second apply while the same slot is rendering', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    renderStrudelSound.mockReturnValue(new Promise(() => undefined))

    void store.apply('bump')
    await store.apply('bump')

    expect(renderStrudelSound).toHaveBeenCalledTimes(1)
  })

  it('restores the shipped code and tells the game to use its own file on reset', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('RockRunner', slots, onApply)
    store.setCode('bump', 'new code')
    await store.apply('bump')

    await store.reset('bump')

    expect(store.codeOf('bump')).toBe('bump code')
    expect(store.isModified('bump')).toBe(false)
    expect(onApply).toHaveBeenLastCalledWith('bump', null)
    expect(store.statusOf('bump')).toBe('idle')
  })
})
