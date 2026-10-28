import { STRUDEL_BANK_ALIASES_URL, STRUDEL_DRUM_MACHINES_TAG, STRUDEL_SAMPLE_BANKS } from './config'
import { isRecordModule, requireCallable, requireRecordModule } from './strudelModules'
import type { StrudelSoundEntry, StrudelSoundFilter } from './types'

const SYNTH_SOUND_TYPES = new Set(['synth', 'soundfont'])

/**
 * Registers every sound strudel.cc preloads: the synths, the General MIDI soundfonts, each
 * sample bank and, once the banks are in, the drum machine aliases, which only rename banks
 * already registered. Nothing here touches audio, so it can run before the first Play. A bank
 * that fails to load is left out rather than keeping the rest silent.
 */
export const registerStrudelSoundLibrary = async (): Promise<void> => {
  const [webaudioImport, soundfontsImport]: unknown[] = await Promise.all([
    import('@strudel/webaudio'),
    // Pinned to the release built on the same webaudio: a mismatch installs a second copy,
    // and the fonts register in a sound map playback never reads, failing silently.
    import('@strudel/soundfonts')
  ])
  const webaudioModule = requireRecordModule(webaudioImport)
  const soundfontsModule = requireRecordModule(soundfontsImport)
  const sampleBankLoader = requireCallable(webaudioModule.samples)
  const bankAliasLoader = requireCallable(webaudioModule.aliasBank)
  requireCallable(webaudioModule.registerSynthSounds)()
  requireCallable(soundfontsModule.registerSoundfonts)()
  await Promise.allSettled(
    STRUDEL_SAMPLE_BANKS.map(({ manifestUrl, baseUrl, tag }) =>
      sampleBankLoader(manifestUrl, baseUrl, { prebake: true, tag })
    )
  )
  await Promise.allSettled([bankAliasLoader(STRUDEL_BANK_ALIASES_URL)])
}

// One load for the page: the sounds tab, the flow editor and Play all wait on the same one.
const soundLibrary: { loading: Promise<void> | null } = { loading: null }

/**
 * The sound library, registered once and shared; a failed load is forgotten so the next
 * caller tries again.
 * @returns a promise that settles when every sound is registered
 */
export const loadStrudelSoundLibrary = (): Promise<void> => {
  soundLibrary.loading ??= registerStrudelSoundLibrary().catch((error: unknown) => {
    soundLibrary.loading = null
    throw error
  })
  return soundLibrary.loading
}

const countSounds = (data: Record<string, unknown>): number => {
  const sounds = data.samples ?? data.fonts ?? data.tables
  if (Array.isArray(sounds)) {
    return sounds.length
  }
  return isRecordModule(sounds) ? Object.keys(sounds).length : 0
}

/**
 * The registered sounds as a sorted list. An alias shares its bank's registration, so only the
 * first name for each is kept: the list shows `RolandTR909_bd`, not that and `tr909_bd` too.
 * @param soundDictionary - superdough's sound map, name to `{ onTrigger, data }`
 * @returns one entry per distinct sound, sorted by name
 */
export const toStrudelSoundEntries = (soundDictionary: unknown): StrudelSoundEntry[] => {
  if (!isRecordModule(soundDictionary)) {
    return []
  }
  // A manifest's `_base` folder key gets registered like a sound; it is not one.
  const registrations = Object.entries(soundDictionary).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      !entry[0].startsWith('_') && isRecordModule(entry[1])
  )
  const distinctRegistrations = registrations.filter(
    ([, registration], index) =>
      registrations.findIndex(([, candidate]) => candidate === registration) === index
  )
  return distinctRegistrations
    .map(([name, registration]) => {
      const data = isRecordModule(registration.data) ? registration.data : {}
      return {
        name,
        type: typeof data.type === 'string' ? data.type : 'sample',
        tag: typeof data.tag === 'string' ? data.tag : '',
        sampleCount: countSounds(data)
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name))
}

/**
 * Whether a sound belongs under one of the sounds tab's filters, split as strudel.cc splits them.
 * @param soundEntry - the sound to test
 * @param soundFilter - the selected filter
 * @returns true when the sound is listed under the filter
 */
export const matchesStrudelSoundFilter = (
  soundEntry: StrudelSoundEntry,
  soundFilter: StrudelSoundFilter
): boolean => {
  const isDrumMachine = soundEntry.tag === STRUDEL_DRUM_MACHINES_TAG
  const filterMatches: Record<StrudelSoundFilter, boolean> = {
    all: true,
    samples: soundEntry.type === 'sample' && !isDrumMachine,
    'drum-machines': isDrumMachine,
    synths: SYNTH_SOUND_TYPES.has(soundEntry.type),
    wavetables: soundEntry.type === 'wavetable'
  }
  return filterMatches[soundFilter]
}

/**
 * Every sound registered so far, read from superdough's sound map.
 * @returns the sounds, sorted by name
 */
export const readStrudelSoundEntries = async (): Promise<StrudelSoundEntry[]> => {
  const webaudioModule = requireRecordModule(await import('@strudel/webaudio'))
  const soundMap = requireRecordModule(webaudioModule.soundMap)
  return toStrudelSoundEntries(requireCallable(soundMap.get).call(soundMap))
}
