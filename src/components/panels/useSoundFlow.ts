import { ref, watch, type Ref } from 'vue'
import { useStrudelFlow } from '@webgamekit/strudel-flow'
import { useStrudelSounds } from '@/views/Tools/StrudelEditor/useStrudelSounds'
import type { StrudelEditorMode } from '@/views/Tools/StrudelEditor/types'

export const UNPARSEABLE_FLOW_MESSAGE =
  'This code has a syntax error, so it cannot open as a flow. Fix it in the code view.'

/**
 * The Sound panel's code and flow switch. Code stays the source of truth: opening the flow
 * builds the graph from the code, and while the flow is open every change on the canvas writes
 * the compiled code back. Code with a syntax error never opens as a flow, since the canvas would
 * show a stale graph and the next edit would replace the sound with it. Valid but unfamiliar
 * code opens as generic nodes and compiles back without losing a sound.
 * @param code The Strudel code of the selected sound.
 * @param setCode Stores new code for the selected sound.
 * @returns The mode, the canvas state and the actions to drive it.
 */
export const useSoundFlow = (code: Ref<string>, setCode: (code: string) => void) => {
  const flow = useStrudelFlow()
  const { sampleGroups, voiceGroups, loadSounds } = useStrudelSounds()
  const mode = ref<StrudelEditorMode>('code')
  const flowError = ref('')
  // What the graph compiles to as soon as it is built from the code. Only a change after that is
  // an edit, so merely opening the flow does not rewrite the sound or mark it edited.
  const loadedCompilation = ref('')

  watch(
    () => flow.compilation.value.code,
    (compiledCode) => {
      if (
        mode.value === 'flow' &&
        compiledCode.length > 0 &&
        compiledCode !== loadedCompilation.value &&
        compiledCode !== code.value
      ) {
        setCode(compiledCode)
      }
    }
  )

  const openFlow = (): void => {
    if (!flow.loadCode(code.value)) {
      flowError.value = UNPARSEABLE_FLOW_MESSAGE
      mode.value = 'code'
      return
    }
    loadedCompilation.value = flow.compilation.value.code
    flowError.value = ''
    mode.value = 'flow'
    void loadSounds()
  }

  const setMode = (nextMode: StrudelEditorMode): void => {
    if (nextMode === 'flow') openFlow()
    else {
      flowError.value = ''
      mode.value = 'code'
    }
  }

  // Another sound was picked or reset: the graph has to follow its code, or stay out of the way.
  const reload = (): void => {
    if (mode.value === 'flow') openFlow()
  }

  return {
    mode,
    flowError,
    setMode,
    reload,
    sampleGroups,
    voiceGroups,
    nodes: flow.nodes,
    edges: flow.edges,
    beatsPerMinute: flow.beatsPerMinute,
    beatsPerCycle: flow.beatsPerCycle,
    addNode: flow.addNode,
    updateNodeData: flow.updateNodeData,
    removeNode: flow.removeNode,
    connectNodes: flow.connectNodes,
    setBeatsPerMinute: flow.setBeatsPerMinute,
    setBeatsPerCycle: flow.setBeatsPerCycle
  }
}
