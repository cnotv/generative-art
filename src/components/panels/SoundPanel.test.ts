import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import SoundPanel from './SoundPanel.vue'
import { useSoundPanelStore } from '@/stores/soundPanel'
import type { SoundSlot } from '@/types/soundPanel'

const renderStrudelSound = vi.hoisted(() => vi.fn())
const playPreview = vi.hoisted(() => vi.fn())
vi.mock('@/utils/soundRender', () => ({ renderStrudelSound }))
vi.mock('@/utils/soundPreview', () => ({ playPreview }))

const slots: SoundSlot[] = [
  { id: 'theme', label: 'Music', code: 'a', kind: 'loop', cycles: 4 },
  { id: 'bump', label: 'Bump', code: 'b', kind: 'once' }
]

const GenericPanelStub = defineComponent({ template: '<section><slot /></section>' })
const EditorStub = defineComponent({
  props: ['code'],
  emits: ['update:code', 'evaluate'],
  template: '<textarea :value="code" @input="$emit(\'update:code\', $event.target.value)" />'
})

const mountPanel = () =>
  mount(SoundPanel, {
    global: {
      stubs: { GenericPanel: GenericPanelStub, StrudelCodeEditor: EditorStub }
    }
  })

beforeEach(() => {
  setActivePinia(createPinia())
  renderStrudelSound.mockReset().mockResolvedValue(new ArrayBuffer(8))
  playPreview.mockReset().mockReturnValue(vi.fn())
})

describe('SoundPanel', () => {
  it('says so when the view registered no sounds', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('No sounds registered for this view.')
  })

  it('lists every sound and shows the code of the selected one', async () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Music')
    expect(wrapper.text()).toContain('Bump')
    expect(wrapper.find('textarea').element.value).toBe('a')

    store.select('bump')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('textarea').element.value).toBe('b')
  })

  it('marks an edited sound in the list and enables Reset', async () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    const wrapper = mountPanel()

    await wrapper.find('textarea').setValue('edited')

    expect(wrapper.text()).toContain('Music (edited)')
    const reset = wrapper.findAll('button').find((button) => button.text() === 'Reset')
    expect(reset?.attributes('disabled')).toBeUndefined()
  })

  it('applies the edited code when Apply is pressed', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('Game', slots, onApply)
    const wrapper = mountPanel()
    await wrapper.find('textarea').setValue('edited')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Apply')
      ?.trigger('click')
    await vi.waitFor(() => expect(onApply).toHaveBeenCalled())

    expect(renderStrudelSound).toHaveBeenCalledWith('edited', slots[0])
  })

  it('shows the error when the code does not render', async () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    renderStrudelSound.mockRejectedValue(new Error('bd is not defined'))
    const wrapper = mountPanel()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Apply')
      ?.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))

    expect(wrapper.find('[role="alert"]').text()).toBe('bd is not defined')
  })

  it('offers a code and flow switch, starting on code', () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    const wrapper = mountPanel()

    const modes = wrapper
      .findAll('button')
      .filter((button) => ['Code', 'Flow'].includes(button.text()))

    expect(modes.map((button) => button.text())).toEqual(['Code', 'Flow'])
    expect(wrapper.find('textarea').isVisible()).toBe(true)
  })

  it('stays on code and shows why when the code cannot open as a flow', async () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    const wrapper = mountPanel()
    await wrapper.find('textarea').setValue('nonsense(')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Flow')
      ?.trigger('click')

    expect(wrapper.find('[role="alert"]').text()).toContain('syntax error')
    expect(wrapper.find('textarea').isVisible()).toBe(true)
  })

  it('plays the sound without applying it, and offers Stop while it plays', async () => {
    const store = useSoundPanelStore()
    const onApply = vi.fn()
    store.register('Game', slots, onApply)
    const wrapper = mountPanel()
    const find = (label: string) =>
      wrapper.findAll('button').find((button) => button.text() === label)

    await find('Play')?.trigger('click')
    await vi.waitFor(() => expect(playPreview).toHaveBeenCalled())
    await wrapper.vm.$nextTick()

    expect(onApply).not.toHaveBeenCalled()
    expect(find('Stop')).toBeDefined()
    expect(find('Play')).toBeUndefined()
  })

  it('opens the sound in the full Strudel Editor from its own button', async () => {
    const store = useSoundPanelStore()
    store.register('Game', slots, vi.fn())
    const wrapper = mountPanel()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Open in Strudel Editor')
      ?.trigger('click')

    expect(store.editorSlotId).toBe('theme')
  })
})
