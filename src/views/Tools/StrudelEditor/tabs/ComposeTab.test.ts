import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAiSettings } from '../ai/useAiSettings'
import ComposeTab from './ComposeTab.vue'

const mountComposeTab = (code: string, editorError = '') =>
  mount(ComposeTab, { props: { code, editorError } })

const findButton = (wrapper: ReturnType<typeof mountComposeTab>, label: string) =>
  wrapper.findAll('button').find((button) => button.text() === label)

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
    expect(wrapper.text()).toContain('Add your OpenRouter key in the Settings tab')
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

    // Assert
    expect(wrapper.text()).toContain('A house loop.')
    expect(wrapper.find('pre').text()).toBe('$: s("bd*4")')
    expect(wrapper.emitted('apply')).toEqual([['$: s("bd*4")']])
    expect(findButton(wrapper, 'Apply')?.element.disabled).toBe(true)
  })
})
