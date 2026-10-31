import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import SoundEditorOverlay from './SoundEditorOverlay.vue'
import { usePanelsStore } from '@/stores/panels'
import { useSoundPanelStore } from '@/stores/soundPanel'
import type { SoundSlot } from '@/types/soundPanel'

vi.mock('@/utils/soundRender', () => ({ renderStrudelSound: vi.fn() }))
vi.mock('@/views/Tools/StrudelEditor/StrudelEditor.vue', () => ({
  __esModule: true,
  default: defineComponent({ template: '<div data-testid="editor"><slot name="actions" /></div>' })
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} })
}))

const slots: SoundSlot[] = [{ id: 'bump', label: 'Bump', code: 'b', kind: 'once' }]

const setup = () => {
  const soundStore = useSoundPanelStore()
  soundStore.register('Game', slots, vi.fn())
  const panelsStore = usePanelsStore()
  vi.spyOn(panelsStore, 'closePanel').mockImplementation(() => undefined)
  vi.spyOn(panelsStore, 'openPanel').mockImplementation(() => undefined)
  const wrapper = mount(SoundEditorOverlay)
  return { soundStore, panelsStore, wrapper }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => 'from the editor'),
    setItem: vi.fn()
  })
})

describe('SoundEditorOverlay', () => {
  it('shows nothing while no sound is open in the editor', () => {
    const { wrapper } = setup()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('covers the page with the full editor and steps the Sound panel aside', async () => {
    const { soundStore, panelsStore, wrapper } = setup()

    soundStore.openEditor('bump')
    await nextTick()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="editor"]').exists()).toBe(true))

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(panelsStore.closePanel).toHaveBeenCalledWith('sound')
  })

  it('takes the code back into the sound and reopens the panel on Use code in sound', async () => {
    const { soundStore, panelsStore, wrapper } = setup()
    soundStore.openEditor('bump')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="editor"]').exists()).toBe(true))

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Use code in sound')
      ?.trigger('click')
    await nextTick()

    expect(soundStore.codeOf('bump')).toBe('from the editor')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(panelsStore.openPanel).toHaveBeenCalledWith('sound')
  })

  it('discards the editor and reopens the panel on Close', async () => {
    const { soundStore, panelsStore, wrapper } = setup()
    soundStore.openEditor('bump')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="editor"]').exists()).toBe(true))

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Close')
      ?.trigger('click')
    await nextTick()

    expect(soundStore.codeOf('bump')).toBe('b')
    expect(panelsStore.openPanel).toHaveBeenCalledWith('sound')
  })
})
