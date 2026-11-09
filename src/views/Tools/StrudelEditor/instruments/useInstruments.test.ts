import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  INSTRUMENT_BUILT_IN_PRESETS,
  INSTRUMENT_REGENERATE_DELAY_MS,
  INSTRUMENT_STORAGE_KEY
} from './config'
import { useAiSettings } from '../ai/useAiSettings'
import { useInstruments } from './useInstruments'

const { mockRegister, mockSamples } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockSamples: vi.fn()
}))

vi.mock('./registerInstrument', () => ({ registerInstrument: mockRegister }))
vi.mock('@strudel/webaudio', () => ({
  samples: mockSamples,
  registerSound: vi.fn(),
  soundMap: {
    get: () => ({
      sawtooth: { data: { type: 'synth' } },
      rolandtr909_bd: { data: { type: 'sample' } },
      stoner_chord: { data: { tag: 'instrument:electric-guitar:stoner' } }
    })
  }
}))

const renderedNames = (): string[] =>
  mockRegister.mock.calls.map(([options]) => options.preset.name)

describe('useInstruments', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mockRegister.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => vi.useRealTimers())

  it('starts with the built-in presets and renders nothing', () => {
    // Arrange
    const store = useInstruments()

    // Act
    const names = store.presets.map(({ name }) => name)

    // Assert
    expect(names).toEqual(INSTRUMENT_BUILT_IN_PRESETS.map(({ name }) => name))
    expect(store.selectedPreset?.name).toBe('stoner')
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('renders a preset once when it is selected, and not again until its knobs change', async () => {
    // Arrange
    const store = useInstruments()

    // Act
    store.selectPreset('blastkit')
    await store.ensureRendered('blastkit')
    await store.ensureRendered('blastkit')
    const renderedBeforeEdit = renderedNames()
    store.setKnob('punch', 0.1)
    await store.ensureRendered('blastkit')

    // Assert
    expect(renderedBeforeEdit).toEqual(['blastkit'])
    expect(renderedNames()).toEqual(['blastkit', 'blastkit'])
    expect(store.statusByName.blastkit).toBe('ready')
  })

  it('renders only the presets the code names, and waits for them', async () => {
    // Arrange
    const store = useInstruments()
    const order: string[] = []
    mockRegister.mockImplementation(async ({ preset }) => {
      await Promise.resolve()
      order.push(preset.name)
    })

    // Act
    await store.ensureRenderedForCode('note("a1").s("chainsaw_chord")\ns("blastkit_kick")')

    // Assert
    expect(order.sort()).toEqual(['blastkit', 'chainsaw'])
    expect(store.statusByName.chainsaw).toBe('ready')
    expect(store.statusByName.stoner).toBeUndefined()
  })

  it('records a failed render without throwing, and retries it next time', async () => {
    // Arrange
    const store = useInstruments()
    mockRegister.mockRejectedValueOnce(new Error('worker crashed'))

    // Act
    await store.ensureRendered('campfire')
    const failedStatus = store.statusByName.campfire
    await store.ensureRendered('campfire')

    // Assert
    expect(failedStatus).toBe('error')
    expect(store.errorByName.campfire).toBe('')
    expect(store.statusByName.campfire).toBe('ready')
  })

  it('re-renders only the selected preset after its knobs settle', async () => {
    // Arrange
    vi.useFakeTimers()
    const store = useInstruments()
    store.selectPreset('garagekit')
    await vi.advanceTimersByTimeAsync(INSTRUMENT_REGENERATE_DELAY_MS + 10)
    mockRegister.mockClear()

    // Act
    store.setKnob('room', 0.9)
    store.setKnob('room', 0.95)
    await vi.advanceTimersByTimeAsync(INSTRUMENT_REGENERATE_DELAY_MS + 10)

    // Assert
    expect(renderedNames()).toEqual(['garagekit'])
  })

  describe('tweaks and presets of the user', () => {
    it('saves a tweak to a built-in preset and resets it to the shipped values', async () => {
      // Arrange
      const store = useInstruments()
      const shippedDrive = INSTRUMENT_BUILT_IN_PRESETS[0]?.knobs.drive

      // Act
      store.setKnob('drive', 0.1)
      const tweaked = store.selectedPreset?.knobs.drive
      store.resetPreset()

      // Assert
      expect(tweaked).toBe(0.1)
      expect(store.selectedPreset?.knobs.drive).toBe(shippedDrive)
    })

    it('keeps tweaks and user presets in local storage and reads them back', async () => {
      // Arrange
      const store = useInstruments()
      await store.refreshForeignSoundNames()
      store.createPreset('mine', 'organ')
      store.selectPreset('stoner')
      store.setKnob('drive', 0.2)
      await Promise.resolve()

      // Act
      setActivePinia(createPinia())
      const reloaded = useInstruments()

      // Assert
      expect(localStorage.getItem(INSTRUMENT_STORAGE_KEY)).toContain('mine')
      expect(reloaded.presets.map(({ name }) => name)).toContain('mine')
      expect(reloaded.presets.find(({ name }) => name === 'stoner')?.knobs.drive).toBe(0.2)
    })

    it('creates a preset of a kind with that kind knobs, selecting it', async () => {
      // Arrange
      const store = useInstruments()

      // Act
      const check = store.createPreset('kit1', 'drum-kit')

      // Assert
      expect(check.valid).toBe(true)
      expect(store.selectedPreset).toMatchObject({ name: 'kit1', kind: 'drum-kit' })
      expect(Object.keys(store.selectedPreset?.knobs ?? {})).toEqual([
        'tune',
        'decay',
        'punch',
        'drive',
        'room'
      ])
    })

    it.each([
      ['a name already used by a preset', 'stoner'],
      ['an unreadable name', 'My Riff'],
      ['a sound Strudel already has', 'sawtooth'],
      ['the front of a registered bank', 'rolandtr909']
    ])('refuses %s with a message', async (_case, name) => {
      // Arrange
      const store = useInstruments()
      await store.refreshForeignSoundNames()

      // Act
      const check = store.createPreset(name, 'organ')

      // Assert
      expect(check.valid).toBe(false)
      expect(store.presets).toHaveLength(INSTRUMENT_BUILT_IN_PRESETS.length)
    })

    it('does not count its own rendered sounds as taken names', async () => {
      // Arrange
      const store = useInstruments()
      await store.refreshForeignSoundNames()
      store.createPreset('mine', 'organ')

      // Act
      const deleteCheck = (): void => store.deletePreset()
      deleteCheck()
      const recreated = store.createPreset('mine', 'organ')

      // Assert
      expect(recreated.valid).toBe(true)
    })

    it('renames and deletes only the user presets', async () => {
      // Arrange
      const store = useInstruments()
      store.selectPreset('chainsaw')

      // Act
      const builtInRename = store.renamePreset('other')
      store.deletePreset()
      const stillThere = store.presets.some(({ name }) => name === 'chainsaw')
      store.createPreset('mine', 'organ')
      const rename = store.renamePreset('yours')
      store.deletePreset()

      // Assert
      expect(builtInRename.valid).toBe(false)
      expect(stillThere).toBe(true)
      expect(rename.valid).toBe(true)
      expect(store.presets.map(({ name }) => name)).not.toContain('yours')
      expect(store.selectedPreset?.name).toBe('stoner')
    })

    it('duplicates the selected preset under a free name with the same knobs', () => {
      // Arrange
      const store = useInstruments()
      store.selectPreset('campfire')
      store.setKnob('body', 0.9)

      // Act
      store.duplicatePreset()
      store.selectPreset('campfire')
      store.duplicatePreset()

      // Assert
      const copies = store.presets.filter(
        ({ name }) => name.startsWith('campfire') && name !== 'campfire'
      )
      expect(copies.map(({ name }) => name)).toEqual(['campfire2', 'campfire3'])
      expect(copies[0]?.knobs.body).toBe(0.9)
      expect(copies[0]?.kind).toBe('acoustic-guitar')
    })

    it('resets a user preset to the starting values of its kind', () => {
      // Arrange
      const store = useInstruments()
      store.createPreset('mine', 'organ')
      store.setKnob('drive', 0.99)

      // Act
      store.resetPreset()

      // Assert
      expect(store.selectedPreset?.knobs.drive).toBe(0.3)
    })
  })

  describe('presets designed by the composer', () => {
    const DESIGN = { name: 'grit', kind: 'bass-guitar' as const, description: 'A dirty pick bass' }
    const KNOBS = { drive: 0.9, tone: 0.2, attack: 0.7, mids: 0.6, sustain: 0.4 }

    const stubToneAnswer = (answer: Record<string, unknown>) => {
      const content = JSON.stringify(answer)
      const mockFetch = vi.fn<typeof fetch>(
        async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
      )
      vi.stubGlobal('fetch', mockFetch)
      return mockFetch
    }

    beforeEach(() => {
      useAiSettings().apiKey = 'secret-key'
      useAiSettings().soundModel = 'google/gemini-3.8-flash'
    })

    afterEach(() => vi.unstubAllGlobals())

    it('creates the preset and sets its knobs from the sound model', async () => {
      // Arrange
      const mockFetch = stubToneAnswer({ ...KNOBS, explanation: 'Gritty.' })
      const store = useInstruments()

      // Act
      const result = await store.designPreset(DESIGN)

      // Assert
      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))
      expect(result).toEqual({ status: 'ready', message: '' })
      expect(body.model).toBe('google/gemini-3.8-flash')
      expect(body.messages[1].content).toContain('A dirty pick bass')
      expect(store.presets.find(({ name }) => name === 'grit')).toMatchObject({
        kind: 'bass-guitar',
        knobs: KNOBS
      })
    })

    it('sets the knobs of the designed preset even when the selection moved meanwhile', async () => {
      // Arrange
      stubToneAnswer({ ...KNOBS, explanation: '' })
      const store = useInstruments()

      // Act
      const pending = store.designPreset(DESIGN)
      store.selectPreset('stoner')
      await pending

      // Assert
      expect(store.presets.find(({ name }) => name === 'grit')?.knobs).toEqual(KNOBS)
      expect(store.presets.find(({ name }) => name === 'stoner')?.knobs).toEqual(
        INSTRUMENT_BUILT_IN_PRESETS.find(({ name }) => name === 'stoner')?.knobs
      )
    })

    it('keeps a preset that already exists as it is, without asking the model', async () => {
      // Arrange
      const mockFetch = stubToneAnswer({ ...KNOBS, explanation: '' })
      const store = useInstruments()

      // Act
      const result = await store.designPreset({ ...DESIGN, name: 'stoner' })

      // Assert
      expect(result.status).toBe('existed')
      expect(mockFetch).not.toHaveBeenCalled()
      expect(store.presets).toHaveLength(INSTRUMENT_BUILT_IN_PRESETS.length)
    })

    it('fails a name that hides a Strudel sound, with the reason', async () => {
      // Arrange
      const mockFetch = stubToneAnswer({ ...KNOBS, explanation: '' })
      const store = useInstruments()
      await store.refreshForeignSoundNames()

      // Act
      const result = await store.designPreset({ ...DESIGN, name: 'sawtooth' })

      // Assert
      expect(result).toEqual({
        status: 'failed',
        message: 'Strudel already has a sound with this name.'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('keeps the new preset at its starting knobs when the sound model fails', async () => {
      // Arrange
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () => new Response('', { status: 402 }))
      )
      const store = useInstruments()

      // Act
      const result = await store.designPreset(DESIGN)

      // Assert
      expect(result.status).toBe('failed')
      expect(result.message).toContain('credit')
      expect(store.presets.map(({ name }) => name)).toContain('grit')
    })
  })
})
