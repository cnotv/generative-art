import { computed, ref, shallowRef } from 'vue'
import type { StrudelFlowSampleGroup } from '@webgamekit/strudel-flow'
import {
  groupStrudelSoundEntries,
  matchesStrudelSoundFilter,
  readStrudelSoundEntries
} from './strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundsStatus } from './types'

const isSample = (soundEntry: StrudelSoundEntry): boolean =>
  matchesStrudelSoundFilter(soundEntry, 'samples') ||
  matchesStrudelSoundFilter(soundEntry, 'drum-machines')

const isVoice = (soundEntry: StrudelSoundEntry): boolean =>
  matchesStrudelSoundFilter(soundEntry, 'synths')

const toPickerGroups = (soundEntries: StrudelSoundEntry[]): StrudelFlowSampleGroup[] =>
  groupStrudelSoundEntries(soundEntries).map((soundGroup) => ({
    label: soundGroup.label,
    samples: soundGroup.sounds.map((soundEntry) => ({
      value: soundEntry.name,
      label: soundEntry.label
    }))
  }))

/**
 * The sounds Strudel can play, for the sounds tab and the flow editor's sample pickers. Loading
 * registers the library without starting audio, so the list is there before the first Play.
 * @returns the sound list, the samples and the synths and instruments grouped for the pickers, the
 * loading status, and the function that fills them
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
      soundEntries.value = await readStrudelSoundEntries()
      soundsStatus.value = 'ready'
    } catch {
      soundsStatus.value = 'error'
    }
  }

  const sampleGroups = computed(() => toPickerGroups(soundEntries.value.filter(isSample)))
  const voiceGroups = computed(() => toPickerGroups(soundEntries.value.filter(isVoice)))

  return { soundEntries, sampleGroups, voiceGroups, soundsStatus, loadSounds }
}
