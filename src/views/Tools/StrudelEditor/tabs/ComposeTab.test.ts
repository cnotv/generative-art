import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS } from '../ai/config'
import { useAiSettings } from '../ai/useAiSettings'
import { useStrudelComposer } from '../ai/useStrudelComposer'
import type { StrudelComposerInstrumentResult } from '../ai/types'
import ComposeTab from './ComposeTab.vue'

vi.mock('@strudel/webaudio', () => ({
  samples: vi.fn(),
  registerSound: vi.fn(),
  soundMap: { get: () => ({}) }
}))

const mountComposeTab = (code: string, editorError = '') =>
  mount(ComposeTab, { props: { code, editorError } })

const findButton = (wrapper: ReturnType<typeof mountComposeTab>, label: string) =>
  wrapper.findAll('button').find((button) => button.text() === label)

const openReport = async (wrapper: ReturnType<typeof mountComposeTab>): Promise<void> => {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Report')
    ?.trigger('click')
}

const stubOpenRouter = (answer: Record<string, unknown>): void => {
  const content = JSON.stringify(answer)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] })))
  )
}

describe('ComposeTab', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('points to Settings and keeps every action off without a key', async () => {
    // Arrange
    const wrapper = mountComposeTab('$: s("bd")')

    // Act
    await wrapper.find('input').setValue('house')

    // Assert
    expect(wrapper.text()).toContain('Add an OpenRouter key in Settings')
    expect(
      ['Compose', 'Revise', 'Review'].map((label) => findButton(wrapper, label)?.element.disabled)
    ).toEqual([true, true, true])
  })

  it.each([
    ['', [false, true, true]],
    ['$: s("bd")', [false, false, false]]
  ])('with code %j, only Compose works on an empty editor', async (code, expectedDisabled) => {
    // Arrange
    useAiSettings().apiKey = 'secret-key'
    const wrapper = mountComposeTab(code)

    // Act
    await wrapper.find('input').setValue('house')

    // Assert
    expect(
      ['Compose', 'Revise', 'Review'].map((label) => findButton(wrapper, label)?.element.disabled)
    ).toEqual(expectedDisabled)
  })

  it.each([
    ['', false],
    ['plan.rootNotes is not a function', true]
  ])('with the editor error %j, offers Fix error: %s', (errorMessage, expectedShown) => {
    // Arrange
    useAiSettings().apiKey = 'secret-key'

    // Act
    const wrapper = mountComposeTab('$: plan.rootNotes(2)', errorMessage)

    // Assert
    expect(findButton(wrapper, 'Fix error') !== undefined).toBe(expectedShown)
    expect(wrapper.text().includes(errorMessage)).toBe(true)
  })

  it('sends the editor error to the model on Fix error, with no request typed', async () => {
    // Arrange
    useAiSettings().apiKey = 'secret-key'
    stubOpenRouter({ explanation: 'Made the plan a pattern.', code: '$: s("bd")' })
    const wrapper = mountComposeTab('$: plan.rootNotes(2)', 'plan.rootNotes is not a function')

    // Act
    await findButton(wrapper, 'Fix error')?.trigger('click')
    await flushPromises()

    await openReport(wrapper)

    // Assert
    const fetchMock = vi.mocked(fetch)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.messages[1].content).toContain('plan.rootNotes is not a function')
    expect(wrapper.text()).toContain('Made the plan a pattern.')
  })

  it('shows the composed code and applies it on Apply', async () => {
    // Arrange
    useAiSettings().apiKey = 'secret-key'
    stubOpenRouter({ explanation: 'A house loop.', code: '$: s("bd*4")' })
    const wrapper = mountComposeTab('')
    await wrapper.find('input').setValue('house')

    // Act
    await findButton(wrapper, 'Compose')?.trigger('click')
    await flushPromises()
    await findButton(wrapper, 'Apply')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('apply')).toBeDefined())

    // Assert
    expect(wrapper.text()).not.toContain('A house loop.')
    await openReport(wrapper)
    expect(wrapper.text()).toContain('A house loop.')
    expect(wrapper.find('pre').text()).toBe('$: s("bd*4")')
    expect(wrapper.emitted('apply')).toEqual([['$: s("bd*4")']])
  })

  it('applies the answer again after an edit', async () => {
    // Arrange
    useAiSettings().apiKey = 'secret-key'
    stubOpenRouter({ explanation: 'A house loop.', code: '$: s("bd*4")' })
    const wrapper = mountComposeTab('')
    await wrapper.find('input').setValue('house')
    await findButton(wrapper, 'Compose')?.trigger('click')
    await flushPromises()

    // Act
    await findButton(wrapper, 'Apply')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('apply')).toHaveLength(1))
    await findButton(wrapper, 'Apply')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('apply')).toHaveLength(2))

    // Assert
    expect(findButton(wrapper, 'Apply')?.element.disabled).toBe(false)
  })

  it('keeps the checkbox labels short', () => {
    // Act
    const wrapper = mountComposeTab('')

    // Assert
    const labels = wrapper.findAll('.strudel-compose__checkbox label').map((label) => label.text())
    expect(labels).toEqual(['Auto apply', 'Instruments'])
    expect(labels.every((label) => label.length <= 12)).toBe(true)
  })
})

const ANSWER = {
  action: 'compose' as const,
  explanation: 'A bass groove.',
  code: '$: note("a1").s("grit")',
  instruments: [
    { name: 'grit', kind: 'bass-guitar' as const, description: 'A dirty pick bass' },
    { name: 'stoner', kind: 'electric-guitar' as const, description: 'Fuzz' }
  ]
}

const mountWithAnswer = (instrumentResults: StrudelComposerInstrumentResult[]) => {
  const composer = useStrudelComposer()
  composer.answer = ANSWER
  composer.instrumentResults = instrumentResults
  return mount(ComposeTab, { props: { code: '', editorError: '' } })
}

const rowTexts = async (wrapper: ReturnType<typeof mountWithAnswer>): Promise<string[]> => {
  await openReport(wrapper)
  return wrapper.findAll('.strudel-compose__instrument').map((row) => row.text())
}

describe('ComposeTab designed instruments', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('lists each designed instrument with its kind, sound and that it is made on Apply', async () => {
    // Act
    const wrapper = mountWithAnswer([])

    // Assert
    const rows = await rowTexts(wrapper)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('grit')
    expect(rows[0]).toContain('Bass guitar')
    expect(rows[0]).toContain('A dirty pick bass')
    expect(rows[0]).toContain(STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS.pending)
  })

  it.each([
    ['ready', '', STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS.ready],
    ['existed', '', STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS.existed],
    ['creating', '', STRUDEL_COMPOSER_INSTRUMENT_STATUS_LABELS.creating],
    ['failed', 'Strudel already has a sound with this name.', 'Strudel already has a sound']
  ] as const)(
    'shows the %s status of an applied instrument',
    async (status, message, expectedText) => {
      // Act
      const wrapper = mountWithAnswer([
        { status, message },
        { status: 'existed', message: '' }
      ])

      // Assert
      expect((await rowTexts(wrapper))[0]).toContain(expectedText)
    }
  )
})
