import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { StrudelFlowSampleGroup } from '@webgamekit/strudel-flow'
import { INSTRUMENT_TAG_PREFIX } from './instruments/config'
import { buildInstrumentPickerGroups } from './instruments/instrumentPickerGroups'
import { useInstruments } from './instruments/useInstruments'
import {
  groupStrudelSoundEntries,
  matchesStrudelSoundFilter,
  readStrudelSoundEntries
} from './strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundsStatus } from './types'

// A preset is listed from the presets themselves, rendered or not, so its registered copy is skipped.
const isInstrumentPresetSound = (soundEntry: StrudelSoundEntry): boolean =>
  soundEntry.tag.startsWith(`${INSTRUMENT_TAG_PREFIX}:`)

const isSample = (soundEntry: StrudelSoundEntry): boolean =>
  !isInstrumentPresetSound(soundEntry) &&
  (matchesStrudelSoundFilter(soundEntry, 'samples') ||
    matchesStrudelSoundFilter(soundEntry, 'drum-machines'))

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
 * Instrument presets lead each picker, listed from the presets so an unrendered one is there too.
 * @returns the sound list, the samples and the synths and instruments grouped for the pickers, the
 * loading status, and the function that fills them
 */
export const useStrudelSounds = () => {
  const soundEntries = shallowRef<StrudelSoundEntry[]>([])
  const soundsStatus = ref<StrudelSoundsStatus>('idle')

  const loadSounds = async (): Promise<void> => {
    if (soundsStatus.value === 'loading') {
      return
    }
    // A reload keeps the list on screen, since instrument presets register their sounds when
    // they are first rendered and the list has to pick them up.
    const hadSounds = soundsStatus.value === 'ready'
    soundsStatus.value = hadSounds ? 'ready' : 'loading'
    try {
      soundEntries.value = await readStrudelSoundEntries()
      soundsStatus.value = 'ready'
    } catch {
      soundsStatus.value = 'error'
    }
  }

  const { presets } = storeToRefs(useInstruments())
  const presetGroups = computed(() => buildInstrumentPickerGroups(presets.value))
  const sampleGroups = computed(() => [
    ...presetGroups.value.sampleGroups,
    ...toPickerGroups(soundEntries.value.filter(isSample))
  ])
  const voiceGroups = computed(() => [
    ...presetGroups.value.voiceGroups,
    ...toPickerGroups(soundEntries.value.filter(isVoice))
  ])

  return { soundEntries, sampleGroups, voiceGroups, soundsStatus, loadSounds }
}
