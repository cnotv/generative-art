import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { downloadExportFile } from '../strudelOfflineRender'
import { playStrudelWavPreview, renderStrudelCodeToWav } from '../strudelPlayback'
import { buildInstrumentExample } from './instrumentExample'
import type { InstrumentPreset, InstrumentPreviewState } from './types'

const COPIED_MESSAGE_MILLISECONDS = 2000

const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not render the preview.'

/**
 * The Instruments tab's example and its preview: one offline render of the example code, played
 * as a single buffer so it can be stopped, and the same file handed out by Download. The code
 * shown, copied, played and downloaded is one string. A render is reused until the preset or its
 * knobs change.
 * @param selectedPreset - the preset the tab shows
 * @returns the example code, the preview's state and message, a play or stop toggle, a download
 * and a copy
 */
export const useInstrumentPreview = (selectedPreset: Ref<InstrumentPreset | undefined>) => {
  const previewState = ref<InstrumentPreviewState>('idle')
  const previewMessage = ref('')
  const copyMessage = ref('')
  const exampleCode = computed(() =>
    selectedPreset.value === undefined ? '' : buildInstrumentExample(selectedPreset.value)
  )
  const renders = new Map<string, Promise<ArrayBuffer>>()
  const playing: { stop: (() => void) | null } = { stop: null }

  const loadPreviewWav = (preset: InstrumentPreset): Promise<ArrayBuffer> => {
    const key = JSON.stringify(preset)
    const cached = renders.get(key)
    if (cached !== undefined) {
      return cached
    }
    const render = renderStrudelCodeToWav(buildInstrumentExample(preset))
    renders.set(key, render)
    render.catch(() => renders.delete(key))
    return render
  }

  const stopPreview = (): void => {
    playing.stop?.()
    playing.stop = null
    previewState.value = 'idle'
  }

  const startPreview = async (preset: InstrumentPreset): Promise<void> => {
    previewState.value = 'rendering'
    previewMessage.value = ''
    try {
      const stop = await playStrudelWavPreview(
        () => loadPreviewWav(preset),
        () => {
          playing.stop = null
          previewState.value = 'idle'
        }
      )
      playing.stop = stop
      previewState.value = 'playing'
    } catch (error) {
      previewState.value = 'idle'
      previewMessage.value = describeFailure(error)
    }
  }

  // Called straight from the click, so the audio unlock inside it still counts as the gesture.
  const togglePreview = (): void => {
    const preset = selectedPreset.value
    if (previewState.value !== 'idle' || preset === undefined) {
      stopPreview()
      return
    }
    void startPreview(preset)
  }

  const downloadPreview = async (): Promise<void> => {
    const preset = selectedPreset.value
    if (preset === undefined) {
      return
    }
    previewMessage.value = ''
    try {
      downloadExportFile(await loadPreviewWav(preset), `${preset.name}-preview`, 'wav')
    } catch (error) {
      previewMessage.value = describeFailure(error)
    }
  }

  const copyExample = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(exampleCode.value)
      copyMessage.value = 'Copied'
      setTimeout(() => {
        copyMessage.value = ''
      }, COPIED_MESSAGE_MILLISECONDS)
    } catch {
      copyMessage.value = 'Could not copy. Select the code and copy it by hand.'
    }
  }

  // A preview of the old tone would mislead once the preset or a knob changes.
  watch(() => JSON.stringify(selectedPreset.value), stopPreview)
  onBeforeUnmount(stopPreview)

  return {
    exampleCode,
    copyMessage,
    previewState,
    previewMessage,
    togglePreview,
    downloadPreview,
    copyExample
  }
}
