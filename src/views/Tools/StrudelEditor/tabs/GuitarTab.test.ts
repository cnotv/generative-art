import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Button } from '@/components/ui/button'
import { STONER_GUITAR_PREVIEW_PHRASE, STONER_GUITAR_SOUND_NAMES } from '../guitar/config'
import { useStonerGuitar } from '../guitar/useStonerGuitar'
import GuitarTab from './GuitarTab.vue'

const { mockPreviewPhrase } = vi.hoisted(() => ({ mockPreviewPhrase: vi.fn() }))

vi.mock('../strudelPlayback', () => ({ previewStrudelPhrase: mockPreviewPhrase }))
vi.mock('../strudelSoundLibrary', () => ({
  loadStrudelSoundLibrary: vi.fn().mockResolvedValue({ drumMachines: {} })
}))

const findPlayRiffButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAllComponents(Button).find((button) => button.text() === 'Play riff')

describe('GuitarTab Play riff', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPreviewPhrase.mockReset().mockResolvedValue(undefined)
  })

  it.each([
    ['idle', true],
    ['rendering', true],
    ['error', true],
    ['ready', false]
  ] as const)('is disabled while the guitar is %s: %s', async (status, expectedDisabled) => {
    // Arrange
    const wrapper = mount(GuitarTab)
    useStonerGuitar().status = status
    await wrapper.vm.$nextTick()

    // Act
    const playRiffButton = findPlayRiffButton(wrapper)

    // Assert
    expect(playRiffButton?.attributes('disabled') !== undefined).toBe(expectedDisabled)
  })

  it('plays the preview phrase once the guitar is ready', async () => {
    // Arrange
    const wrapper = mount(GuitarTab)
    useStonerGuitar().status = 'ready'
    await wrapper.vm.$nextTick()

    // Act
    await findPlayRiffButton(wrapper)?.trigger('click')

    // Assert
    expect(mockPreviewPhrase).toHaveBeenCalledWith(STONER_GUITAR_PREVIEW_PHRASE)
  })
})

describe('STONER_GUITAR_PREVIEW_PHRASE', () => {
  it('sounds every guitar sound, in time order', () => {
    // Arrange
    const offsets = STONER_GUITAR_PREVIEW_PHRASE.map(({ offsetSeconds }) => offsetSeconds)

    // Act
    const soundsPlayed = new Set(STONER_GUITAR_PREVIEW_PHRASE.map(({ sound }) => sound))

    // Assert
    expect([...soundsPlayed].sort()).toEqual(Object.values(STONER_GUITAR_SOUND_NAMES).sort())
    expect(offsets).toEqual([...offsets].sort((first, second) => first - second))
  })
})
