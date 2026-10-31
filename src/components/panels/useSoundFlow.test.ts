import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useSoundFlow, UNPARSEABLE_FLOW_MESSAGE } from './useSoundFlow'

vi.mock('@/views/Tools/StrudelEditor/useStrudelSounds', () => ({
  useStrudelSounds: () => ({
    sampleGroups: ref([]),
    voiceGroups: ref([]),
    loadSounds: vi.fn(async () => undefined)
  })
}))

const setup = (initialCode: string) => {
  const code = ref(initialCode)
  const setCode = vi.fn((next: string) => {
    code.value = next
  })
  const soundFlow = useSoundFlow(code, setCode)
  return { code, setCode, soundFlow }
}

describe('useSoundFlow', () => {
  it('starts in code mode and leaves the code alone', async () => {
    const { setCode, soundFlow } = setup('s("bd")')
    await nextTick()

    expect(soundFlow.mode.value).toBe('code')
    expect(setCode).not.toHaveBeenCalled()
  })

  it('builds the graph from the code when switched to flow', async () => {
    const { soundFlow } = setup('s("bd sd")')

    soundFlow.setMode('flow')
    await nextTick()

    expect(soundFlow.mode.value).toBe('flow')
    expect(soundFlow.nodes.value.length).toBeGreaterThan(0)
  })

  it('does not rewrite the code just because the flow was opened', async () => {
    const { setCode, soundFlow } = setup('s("bd sd").lpf(400)')

    soundFlow.setMode('flow')
    await nextTick()

    expect(setCode).not.toHaveBeenCalled()
  })

  it('writes what the canvas compiles back into the code once it is edited in flow', async () => {
    const { code, setCode, soundFlow } = setup('s("bd sd")')
    soundFlow.setMode('flow')
    await nextTick()

    soundFlow.addNode('beats')
    await nextTick()

    expect(setCode).toHaveBeenCalled()
    expect(code.value).not.toBe('s("bd sd")')
  })

  it('does not rewrite the code from the canvas while in code mode', async () => {
    const { setCode, soundFlow } = setup('s("bd sd")')
    await nextTick()

    soundFlow.addNode('beats')
    await nextTick()

    expect(setCode).not.toHaveBeenCalled()
  })

  it('rebuilds the graph when another sound is loaded while in flow', async () => {
    const { code, soundFlow } = setup('s("bd")')
    soundFlow.setMode('flow')
    await nextTick()
    const before = soundFlow.nodes.value.map((node) => node.id).join()

    code.value = 'note("c4 e4 g4").s("sine")'
    soundFlow.reload()
    await nextTick()

    expect(soundFlow.nodes.value.map((node) => node.id).join()).not.toBe(before)
  })

  it('stays in code mode and says why when the code has a syntax error', async () => {
    const { soundFlow } = setup('nonsense(')

    soundFlow.setMode('flow')
    await nextTick()

    expect(soundFlow.mode.value).toBe('code')
    expect(soundFlow.flowError.value).toBe(UNPARSEABLE_FLOW_MESSAGE)
  })

  it('clears the message when going back to code', async () => {
    const { soundFlow } = setup('nonsense(')
    soundFlow.setMode('flow')

    soundFlow.setMode('code')

    expect(soundFlow.flowError.value).toBe('')
  })
})
