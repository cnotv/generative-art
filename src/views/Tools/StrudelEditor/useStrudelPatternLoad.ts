import { shallowRef } from 'vue'
import type { Ref } from 'vue'
import type { StrudelEditorStatus, StrudelExample } from './types'

type StrudelPatternLoadOptions = {
  patternCode: Ref<string>
  editorStatus: Ref<StrudelEditorStatus>
  errorMessage: Ref<string>
  selectedExampleId: Ref<string>
  stopPattern: () => Promise<void>
  playPattern: () => Promise<void>
  rewindTimeline: () => void
}

/**
 * Replaces the code on screen, stopping whatever it replaces, and plays what was loaded.
 * @param options - the editor state and playback actions it works on
 * @returns the loading and playing actions
 */
export const useStrudelPatternLoad = ({
  patternCode,
  editorStatus,
  errorMessage,
  selectedExampleId,
  stopPattern,
  playPattern,
  rewindTimeline
}: StrudelPatternLoadOptions) => {
  const pendingStop = shallowRef<Promise<void>>(Promise.resolve())

  // Loading another pattern over one that plays stops it, so only the code on screen sounds. The
  // anchor a click navigates to loads the same code a moment later, which must not stop it.
  const loadPatternCode = (nextCode: string): void => {
    if (nextCode === patternCode.value) {
      return
    }
    if (editorStatus.value === 'playing') {
      pendingStop.value = stopPattern()
    }
    patternCode.value = nextCode
    editorStatus.value = 'idle'
    errorMessage.value = ''
    rewindTimeline()
  }

  // Stopping takes a moment, and a stop that lands after the new pattern starts would silence it.
  const playLoadedPattern = async (): Promise<void> => {
    await pendingStop.value
    await playPattern()
  }

  const loadListedPattern = (pattern: StrudelExample | undefined): boolean => {
    if (pattern === undefined) {
      return false
    }
    selectedExampleId.value = pattern.id
    loadPatternCode(pattern.code)
    return true
  }

  return { loadPatternCode, playLoadedPattern, loadListedPattern }
}
