import { computed, ref, shallowRef } from 'vue'
import type { StrudelFlowSoundGroup } from '@webgamekit/strudel-flow'
import {
  loadStrudelSoundLibrary,
  matchesStrudelSoundFilter,
  readStrudelSoundEntries
} from './strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundFilter, StrudelSoundsStatus } from './types'

const SAMPLE_PICKER_GROUPS: { label: string; soundFilter: StrudelSoundFilter }[] = [
  { label: 'Samples', soundFilter: 'samples' },
  { label: 'Drum machines', soundFilter: 'drum-machines' }
]

/**
 * The sounds Strudel can play, for the sounds tab and the flow editor's sample picker. Loading
 * registers the library without starting audio, so the list is there before the first Play.
 * @returns the sound list, the samples grouped for the picker, the loading status, and the
 * function that fills them
 */
export const useStrudelSounds = () => {
  const soundEntries = shallowRef<StrudelSoundEntry[]>([])
  const soundsStatus = ref<StrudelSoundsStatus>('idle')

  const loadSounds = async (): Promise<void> => {
    if (soundsStatus.value === 'loading' || soundsStatus.value === 'ready') {
      return
    }
    soundsStatus.value = 'loading'
    try {
      await loadStrudelSoundLibrary()
      soundEntries.value = await readStrudelSoundEntries()
      soundsStatus.value = 'ready'
    } catch {
      soundsStatus.value = 'error'
    }
  }

  const sampleGroups = computed<StrudelFlowSoundGroup[]>(() =>
    SAMPLE_PICKER_GROUPS.map(({ label, soundFilter }) => ({
      label,
      sounds: soundEntries.value
        .filter((soundEntry) => matchesStrudelSoundFilter(soundEntry, soundFilter))
        .map((soundEntry) => soundEntry.name)
    }))
  )

  return { soundEntries, sampleGroups, soundsStatus, loadSounds }
}
