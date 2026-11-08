import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { INSTRUMENT_BUILT_IN_PRESETS, INSTRUMENT_NAME_ERRORS } from '../instruments/config'
import { useInstruments } from '../instruments/useInstruments'
import InstrumentsTab from './InstrumentsTab.vue'

const { mockPreviewPhrase, mockDownload } = vi.hoisted(() => ({
  mockPreviewPhrase: vi.fn(),
  mockDownload: vi.fn()
}))

vi.mock('../strudelPlayback', () => ({
  previewStrudelPhrase: mockPreviewPhrase,
  downloadStrudelCodeAsWav: mockDownload
}))
vi.mock('../instruments/registerInstrument', () => ({
  registerInstrument: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@strudel/webaudio', () => ({
  samples: vi.fn(),
  soundMap: { get: () => ({ sawtooth: { data: { type: 'synth' } } }) }
}))

type Wrapper = ReturnType<typeof mount>

const findButton = (wrapper: Wrapper, label: string) =>
  wrapper.findAllComponents(Button).find((button) => button.text() === label)

const mountReady = async (): Promise<Wrapper> => {
  const wrapper = mount(InstrumentsTab)
  await vi.waitFor(() => expect(useInstruments().statusByName.stoner).toBe('ready'))
  await flushPromises()
  return wrapper
}

const selectAndRender = async (presetName: string): Promise<void> => {
  useInstruments().selectPreset(presetName)
  await vi.waitFor(() => expect(useInstruments().statusByName[presetName]).toBe('ready'))
  await flushPromises()
}

describe('InstrumentsTab', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mockPreviewPhrase.mockReset().mockResolvedValue(undefined)
    mockDownload.mockReset().mockResolvedValue({ success: true })
  })

  it('renders the selected preset when the tab opens', async () => {
    // Arrange
    const wrapper = await mountReady()

    // Act
    const status = wrapper.find('[role="status"]').text()

    // Assert
    expect(status).toContain('Ready')
    expect(useInstruments().statusByName.stoner).toBe('ready')
  })

  it('offers every built-in preset with its kind', async () => {
    // Arrange
    const wrapper = await mountReady()

    // Act
    const options = wrapper.findComponent(Select).props('options')

    // Assert
    expect(options.map(({ value }: { value: string }) => value)).toEqual(
      INSTRUMENT_BUILT_IN_PRESETS.map(({ name }) => name)
    )
    expect(options[0].label).toBe('stoner (Electric guitar)')
  })

  it.each([
    ['stoner', ['Drive', 'Tone', 'Bass', 'Mids', 'Sustain']],
    ['fuzzbass', ['Drive', 'Tone', 'Attack', 'Mids', 'Sustain']],
    ['doomorgan', ['Body', 'Brightness', 'Percussion', 'Drive', 'Vibrato']],
    ['blastkit', ['Tune', 'Decay', 'Punch', 'Drive', 'Room']]
  ])('shows the sliders of the kind of %s', async (presetName, expectedLabels) => {
    // Arrange
    const wrapper = await mountReady()
    await selectAndRender(presetName)

    // Act
    const labels = wrapper.findAllComponents(Slider).map((slider) => slider.props('label'))

    // Assert
    expect(labels).toEqual(expectedLabels)
  })

  it('moves a tweak into the preset when a slider changes', async () => {
    // Arrange
    const wrapper = await mountReady()

    // Act
    wrapper.findAllComponents(Slider)[0]?.vm.$emit('update:modelValue', [0.12])
    await flushPromises()

    // Assert
    expect(useInstruments().selectedPreset?.knobs.drive).toBe(0.12)
  })

  describe('Play preview and Download WAV', () => {
    it.each([
      ['idle', true],
      ['rendering', true],
      ['error', true],
      ['ready', false]
    ] as const)('are disabled while the preset is %s: %s', async (status, expectedDisabled) => {
      // Arrange
      const wrapper = await mountReady()
      useInstruments().statusByName = { stoner: status }
      await wrapper.vm.$nextTick()

      // Act
      const play = findButton(wrapper, 'Play preview')
      const download = findButton(wrapper, 'Download WAV')

      // Assert
      expect(play?.attributes('disabled') !== undefined).toBe(expectedDisabled)
      expect(download?.attributes('disabled') !== undefined).toBe(expectedDisabled)
    })

    it('plays the preview of the selected preset', async () => {
      // Arrange
      const wrapper = await mountReady()
      await selectAndRender('blastkit')

      // Act
      await findButton(wrapper, 'Play preview')?.trigger('click')

      // Assert
      const [hits] = mockPreviewPhrase.mock.calls[0] ?? []
      expect(hits.length).toBeGreaterThan(3)
      expect(hits.every(({ sound }: { sound: string }) => sound.startsWith('blastkit_'))).toBe(true)
    })

    it('downloads the preview as a file named after the preset', async () => {
      // Arrange
      const wrapper = await mountReady()
      await selectAndRender('fuzzbass')

      // Act
      await findButton(wrapper, 'Download WAV')?.trigger('click')
      await flushPromises()

      // Assert
      const [code, fileName] = mockDownload.mock.calls[0] ?? []
      expect(fileName).toBe('fuzzbass-preview')
      expect(code).toContain('s("fuzzbass_note")')
    })

    it('shows why a download failed', async () => {
      // Arrange
      const wrapper = await mountReady()
      mockDownload.mockResolvedValue({ success: false, errorMessage: 'no audio' })

      // Act
      await findButton(wrapper, 'Download WAV')?.trigger('click')
      await flushPromises()

      // Assert
      expect(wrapper.text()).toContain('no audio')
    })
  })

  describe('managing presets', () => {
    it('keeps rename and delete away from a built-in preset', async () => {
      // Arrange
      const wrapper = await mountReady()

      // Act
      const deleteButton = findButton(wrapper, 'Delete')

      // Assert
      expect(deleteButton?.attributes('disabled')).toBeDefined()
      expect(wrapper.find('input[aria-label="Rename preset"]').exists()).toBe(false)
    })

    it.each([
      ['Riff', INSTRUMENT_NAME_ERRORS.shape],
      ['stoner', INSTRUMENT_NAME_ERRORS.taken],
      ['sawtooth', INSTRUMENT_NAME_ERRORS.soundTaken]
    ])('says what is wrong with the new name "%s"', async (name, message) => {
      // Arrange
      const wrapper = await mountReady()

      // Act
      await wrapper.find('input[aria-label="New preset name"]').setValue(name)

      // Assert
      expect(wrapper.find('[role="alert"]').text()).toBe(message)
      expect(findButton(wrapper, 'Create')?.attributes('disabled')).toBeDefined()
    })

    it('creates a preset, selects it and lets it be renamed and deleted', async () => {
      // Arrange
      const wrapper = await mountReady()
      await wrapper.find('input[aria-label="New preset name"]').setValue('mine')

      // Act
      await findButton(wrapper, 'Create')?.trigger('click')
      await flushPromises()

      // Assert
      expect(useInstruments().selectedPreset?.name).toBe('mine')
      expect(wrapper.find('input[aria-label="Rename preset"]').exists()).toBe(true)
      expect(findButton(wrapper, 'Delete')?.attributes('disabled')).toBeUndefined()
    })

    it('renames a user preset', async () => {
      // Arrange
      const wrapper = await mountReady()
      useInstruments().createPreset('mine', 'organ')
      await flushPromises()
      await wrapper.find('input[aria-label="Rename preset"]').setValue('yours')

      // Act
      await findButton(wrapper, 'Rename')?.trigger('click')
      await flushPromises()

      // Assert
      expect(useInstruments().selectedPreset?.name).toBe('yours')
    })

    it('duplicates the selected preset', async () => {
      // Arrange
      const wrapper = await mountReady()

      // Act
      await findButton(wrapper, 'Duplicate')?.trigger('click')
      await flushPromises()

      // Assert
      expect(useInstruments().selectedPreset?.name).toBe('stoner2')
    })
  })
})
