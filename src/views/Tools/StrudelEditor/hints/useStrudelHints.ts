import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { STRUDEL_MUSIC_STYLES } from '../config'
import type {
  StrudelHint,
  StrudelMusicStyle,
  StrudelMusicStyleId,
  StrudelStyleDetection
} from '../types'
import { applyStrudelHint } from './applyStrudelHint'
import { buildStrudelHints } from './buildStrudelHints'
import { detectMusicStyle } from './detectMusicStyle'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

type StrudelHintsState = {
  musicStyles: StrudelMusicStyle[]
  pickedStyleId: Ref<StrudelMusicStyleId | null>
  styleDetection: ComputedRef<StrudelStyleDetection | null>
  hints: ComputedRef<StrudelHint[]>
  /** Overrides the detected style; null goes back to detecting it. */
  pickStyle: (styleId: StrudelMusicStyleId | null) => void
  applyHint: (hintId: string) => void
}

/**
 * The hints tab's state: the pattern's style and what the code is missing for it, both
 * recomputed as the code changes, and a way to write a hint's snippet into the code.
 * @param patternCode - the code on screen
 * @param updatePatternCode - replaces the code on screen
 * @returns the detected style, the hints and their actions
 */
export const useStrudelHints = (
  patternCode: Ref<string>,
  updatePatternCode: (nextCode: string) => void
): StrudelHintsState => {
  const pickedStyleId = ref<StrudelMusicStyleId | null>(null)
  const codeFacts = computed(() => readStrudelCodeFacts(patternCode.value))
  const styleDetection = computed(() =>
    detectMusicStyle({
      styles: STRUDEL_MUSIC_STYLES,
      pickedStyleId: pickedStyleId.value,
      facts: codeFacts.value
    })
  )
  const hints = computed(() =>
    styleDetection.value === null
      ? []
      : buildStrudelHints({
          code: patternCode.value,
          facts: codeFacts.value,
          style: styleDetection.value.style
        })
  )

  const pickStyle = (styleId: StrudelMusicStyleId | null): void => {
    pickedStyleId.value = styleId
  }

  const applyHint = (hintId: string): void => {
    const hint = hints.value.find((offeredHint) => offeredHint.id === hintId)
    if (hint !== undefined) {
      updatePatternCode(applyStrudelHint(patternCode.value, hint))
    }
  }

  return {
    musicStyles: STRUDEL_MUSIC_STYLES,
    pickedStyleId,
    styleDetection,
    hints,
    pickStyle,
    applyHint
  }
}
