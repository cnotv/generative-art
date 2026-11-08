import { onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { downloadExportFile } from '../strudelOfflineRender'
import { playStrudelWavPreview, renderStrudelCodeToWav } from '../strudelPlayback'
import { buildInstrumentPreviewCode } from './previewPhrase'
import type { InstrumentPreset, InstrumentPreviewState } from './types'

const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not render the preview.'

/**
 * The Instruments tab's preview: one offline render of the preset's phrase, played as a single
 * buffer so it can be stopped, and the same file handed out by Download. A render is reused
 * until the preset or its knobs change.
 * @param selectedPreset - the preset the tab shows
 * @returns the preview's state and message, a play or stop toggle, and a download
 */
export const useInstrumentPreview = (selectedPreset: Ref<InstrumentPreset | undefined>) => {
  const previewState = ref<InstrumentPreviewState>('idle')
  const previewMessage = ref('')
  const renders = new Map<string, Promise<ArrayBuffer>>()
  const playing: { stop: (() => void) | null } = { stop: null }

  const loadPreviewWav = (preset: InstrumentPreset): Promise<ArrayBuffer> => {
    const key = JSON.stringify(preset)
    const cached = renders.get(key)
    if (cached !== undefined) {
      return cached
    }
    const render = renderStrudelCodeToWav(buildInstrumentPreviewCode(preset))
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

  // A preview of the old tone would mislead once the preset or a knob changes.
  watch(() => JSON.stringify(selectedPreset.value), stopPreview)
  onBeforeUnmount(stopPreview)

  return { previewState, previewMessage, togglePreview, downloadPreview }
}
