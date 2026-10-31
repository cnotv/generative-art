import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { SoundSlot } from '@/types/soundPanel'

const renderStrudelSound = vi.hoisted(() => vi.fn())
const playPreview = vi.hoisted(() => vi.fn())
const storage = vi.hoisted(() => ({ readStorage: vi.fn(), writeStorage: vi.fn() }))
vi.mock('@/utils/storage', () => storage)
vi.mock('@/utils/soundRender', () => ({ renderStrudelSound }))
vi.mock('@/utils/soundPreview', () => ({ playPreview }))

import { useSoundPanelStore } from './soundPanel'

const slots: SoundSlot[] = [
  { id: 'theme', label: 'Theme', code: 'theme code', kind: 'loop', cycles: 8 },
  { id: 'bump', label: 'Bump', code: 'bump code', kind: 'once' }
]
const wav = new ArrayBuffer(8)

beforeEach(() => {
  setActivePinia(createPinia())
  renderStrudelSound.mockReset().mockResolvedValue(wav)
  playPreview.mockReset().mockReturnValue(vi.fn())
  storage.readStorage.mockReset()
  storage.writeStorage.mockReset()
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

describe('soundPanel store preview', () => {
  it('renders the code and plays it, a loop looping and a one-shot not', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())

    await store.togglePreview('theme')
    await store.togglePreview('bump')

    expect(playPreview).toHaveBeenNthCalledWith(1, wav, true, expect.any(Function))
    expect(playPreview).toHaveBeenNthCalledWith(2, wav, false, expect.any(Function))
  })

  it('does not touch the game while previewing', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('RockRunner', slots, onApply)

    await store.togglePreview('bump')

    expect(onApply).not.toHaveBeenCalled()
    expect(store.playingId).toBe('bump')
  })

  it('stops the preview when toggled again', async () => {
    const store = useSoundPanelStore()
    const stop = vi.fn()
    playPreview.mockReturnValue(stop)
    store.register('RockRunner', slots, vi.fn())

    await store.togglePreview('bump')
    await store.togglePreview('bump')

    expect(stop).toHaveBeenCalledTimes(1)
    expect(store.playingId).toBeNull()
  })

  it('stops one sound before playing another', async () => {
    const store = useSoundPanelStore()
    const stop = vi.fn()
    playPreview.mockReturnValue(stop)
    store.register('RockRunner', slots, vi.fn())

    await store.togglePreview('theme')
    await store.togglePreview('bump')

    expect(stop).toHaveBeenCalledTimes(1)
    expect(store.playingId).toBe('bump')
  })

  it('clears the playing state when a one-shot ends on its own', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    await store.togglePreview('bump')

    playPreview.mock.calls[0][2]()

    expect(store.playingId).toBeNull()
  })

  it('renders the same code only once across preview and apply', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())

    await store.togglePreview('bump')
    await store.apply('bump')

    expect(renderStrudelSound).toHaveBeenCalledTimes(1)
  })

  it('renders again once the code has changed', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    await store.apply('bump')

    store.setCode('bump', 'changed')
    await store.apply('bump')

    expect(renderStrudelSound).toHaveBeenCalledTimes(2)
  })

  it('shows the error and plays nothing when the code does not render', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    renderStrudelSound.mockRejectedValue(new Error('bd is not defined'))

    await store.togglePreview('bump')

    expect(playPreview).not.toHaveBeenCalled()
    expect(store.errorOf('bump')).toBe('bd is not defined')
  })

  it('keeps the applied status after a preview', async () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    await store.apply('bump')

    await store.togglePreview('bump')

    expect(store.statusOf('bump')).toBe('applied')
  })

  it('stops the preview when the game unregisters', async () => {
    const store = useSoundPanelStore()
    const stop = vi.fn()
    playPreview.mockReturnValue(stop)
    store.register('RockRunner', slots, vi.fn())
    await store.togglePreview('theme')

    store.unregister('RockRunner')

    expect(stop).toHaveBeenCalledTimes(1)
    expect(store.playingId).toBeNull()
  })
})

describe('soundPanel store full editor', () => {
  it('saves the sound code where the Strudel Editor reads it and marks the editor open', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    store.setCode('bump', 'edited')

    store.openEditor('bump')

    expect(storage.writeStorage).toHaveBeenCalledWith('strudel-editor-code', 'edited')
    expect(store.editorSlotId).toBe('bump')
  })

  it('takes the code from the editor back into the sound when asked', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    store.openEditor('bump')
    storage.readStorage.mockReturnValue('from the editor')

    store.closeEditor(true)

    expect(store.codeOf('bump')).toBe('from the editor')
    expect(store.editorSlotId).toBeNull()
  })

  it('leaves the sound as it was when the editor is closed without taking the code', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    store.openEditor('bump')
    storage.readStorage.mockReturnValue('from the editor')

    store.closeEditor(false)

    expect(store.codeOf('bump')).toBe('bump code')
    expect(store.editorSlotId).toBeNull()
  })

  it('keeps the sound code when the editor saved nothing', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    store.openEditor('bump')
    storage.readStorage.mockReturnValue(null)

    store.closeEditor(true)

    expect(store.codeOf('bump')).toBe('bump code')
  })

  it('stops a preview before opening the editor, so two sounds never play at once', async () => {
    const store = useSoundPanelStore()
    const stop = vi.fn()
    playPreview.mockReturnValue(stop)
    store.register('RockRunner', slots, vi.fn())
    await store.togglePreview('theme')

    store.openEditor('theme')

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('closes the editor when the game unregisters', () => {
    const store = useSoundPanelStore()
    store.register('RockRunner', slots, vi.fn())
    store.openEditor('bump')

    store.unregister('RockRunner')

    expect(store.editorSlotId).toBeNull()
  })
})
