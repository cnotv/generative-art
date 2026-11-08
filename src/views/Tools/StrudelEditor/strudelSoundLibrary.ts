import {
  STRUDEL_BANK_ALIASES_URL,
  STRUDEL_DRUM_MACHINES_TAG,
  STRUDEL_SAMPLE_BANKS,
  STRUDEL_SOUND_FILTERS
} from './config'
import { isRecordModule, requireCallable, requireRecordModule } from './strudelModules'
import { describeStrudelSound } from './strudelSoundNames'
import type {
  StrudelDrumMachine,
  StrudelSoundEntry,
  StrudelSoundFilter,
  StrudelSoundGroup,
  StrudelSoundLibrary
} from './types'

const SYNTH_SOUND_TYPES = new Set(['synth', 'soundfont'])

// superdough also registers inputs, such as the orbit `bus`, which route audio and play nothing.
const LISTED_SOUND_TYPES = new Set(['sample', 'synth', 'soundfont', 'wavetable'])

const isListedSound = (registration: Record<string, unknown>): boolean => {
  const data = isRecordModule(registration.data) ? registration.data : {}
  return typeof data.type !== 'string' || LISTED_SOUND_TYPES.has(data.type)
}

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`error loading "${url}"`)
  }
  return response.json()
}

/**
 * The drum machines' own spellings and short names, from the alias list
 * (`{ "RolandTR909": "TR909" }`), keyed by the lower-case id their sounds start with.
 * @param aliasList - the alias list as downloaded
 * @returns each machine's spelling and short bank name
 */
export const readStrudelDrumMachines = (aliasList: unknown): Record<string, StrudelDrumMachine> =>
  isRecordModule(aliasList)
    ? Object.fromEntries(
        Object.entries(aliasList).map(([machineName, aliases]) => {
          const firstAlias = Array.isArray(aliases) ? aliases[0] : aliases
          const alias = typeof firstAlias === 'string' ? firstAlias : machineName
          return [machineName.toLowerCase(), { name: machineName, alias }]
        })
      )
    : {}

/**
 * Registers every sound strudel.cc preloads: the synths, the General MIDI soundfonts, each
 * sample bank and, once the banks are in, the drum machine aliases, which only rename banks
 * already registered. The bank lists download together but register in their configured order,
 * so the bank that wins a shared name is always the same one. Nothing here touches audio, so it
 * can run before the first Play. A bank that fails to load is left out rather than keeping the
 * rest silent.
 * @returns the drum machines' spellings, for naming their sounds
 */
export const registerStrudelSoundLibrary = async (): Promise<StrudelSoundLibrary> => {
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
  const [bankLists, aliasList] = await Promise.all([
    Promise.allSettled(STRUDEL_SAMPLE_BANKS.map(({ manifestUrl }) => fetchJson(manifestUrl))),
    fetchJson(STRUDEL_BANK_ALIASES_URL).catch(() => ({}))
  ])
  await STRUDEL_SAMPLE_BANKS.reduce(async (previousBank, { baseUrl, tag }, bankIndex) => {
    await previousBank
    const bankList = bankLists[bankIndex]
    if (bankList?.status === 'fulfilled' && isRecordModule(bankList.value)) {
      await sampleBankLoader(bankList.value, baseUrl, { prebake: true, tag })
    }
  }, Promise.resolve())
  // superdough adds lower-case keys to the list it is given, so it gets its own copy.
  await bankAliasLoader(isRecordModule(aliasList) ? { ...aliasList } : {})
  return { drumMachines: readStrudelDrumMachines(aliasList) }
}

// One load for the page: the sounds tab, the flow editor and Play all wait on the same one.
const soundLibrary: { loading: Promise<StrudelSoundLibrary> | null } = { loading: null }

/**
 * The sound library, registered once and shared; a failed load is forgotten so the next
 * caller tries again.
 * @returns a promise of what naming the sounds needs, settled once every sound is registered
 */
export const loadStrudelSoundLibrary = (): Promise<StrudelSoundLibrary> => {
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
 * Whether a sound belongs under one of the sounds tab's filters, split as strudel.cc splits them.
 * @param soundEntry - the sound to test
 * @param soundFilter - the selected filter
 * @returns true when the sound is listed under the filter
 */
export const matchesStrudelSoundFilter = (
  soundEntry: Pick<StrudelSoundEntry, 'type' | 'tag'>,
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

// The filters' own order, so the full list reads samples, drum machines, synths, wavetables.
const CATEGORY_FILTERS = STRUDEL_SOUND_FILTERS.map(({ id }) => id).filter(
  (filterId) => filterId !== 'all'
)

const readCategoryPosition = (soundEntry: Pick<StrudelSoundEntry, 'type' | 'tag'>): number =>
  CATEGORY_FILTERS.findIndex((filterId) => matchesStrudelSoundFilter(soundEntry, filterId))

/**
 * The registered sounds, named and grouped, in the order the sounds tab lists them. An alias
 * shares its bank's registration, so only the first name for each is kept; a list's `_base`
 * folder key, which superdough registers like a sound, and the routing inputs are dropped.
 * @param soundDictionary - superdough's sound map, name to `{ onTrigger, data }`
 * @param soundLibrary - the drum machines' own spellings
 * @returns one entry per distinct sound, grouped and sorted
 */
export const toStrudelSoundEntries = (
  soundDictionary: unknown,
  soundLibrary: StrudelSoundLibrary
): StrudelSoundEntry[] => {
  if (!isRecordModule(soundDictionary)) {
    return []
  }
  const registrations = Object.entries(soundDictionary).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      !entry[0].startsWith('_') && isRecordModule(entry[1]) && isListedSound(entry[1])
  )
  // ponytail: quadratic over about 1200 sounds, a few milliseconds; index by registration if it grows.
  const distinctRegistrations = registrations.filter(
    ([, registration], index) =>
      registrations.findIndex(([, candidate]) => candidate === registration) === index
  )
  return distinctRegistrations
    .map(([name, registration]) => {
      const data = isRecordModule(registration.data) ? registration.data : {}
      const { label, group, groupPosition } = describeStrudelSound(name, data, soundLibrary)
      const soundEntry = {
        name,
        label,
        group,
        type: typeof data.type === 'string' ? data.type : 'sample',
        tag: typeof data.tag === 'string' ? data.tag : '',
        sampleCount: countSounds(data)
      }
      return { soundEntry, categoryPosition: readCategoryPosition(soundEntry), groupPosition }
    })
    .sort(
      (first, second) =>
        first.categoryPosition - second.categoryPosition ||
        first.groupPosition - second.groupPosition ||
        first.soundEntry.group.localeCompare(second.soundEntry.group) ||
        first.soundEntry.label.localeCompare(second.soundEntry.label, undefined, { numeric: true })
    )
    .map(({ soundEntry }) => soundEntry)
}

/**
 * Every registered sound, read from superdough's sound map once the library has loaded.
 * @returns the sounds, named, grouped and sorted
 */
export const readStrudelSoundEntries = async (): Promise<StrudelSoundEntry[]> => {
  const soundLibraryNames = await loadStrudelSoundLibrary()
  const webaudioModule = requireRecordModule(await import('@strudel/webaudio'))
  const soundMap = requireRecordModule(webaudioModule.soundMap)
  return toStrudelSoundEntries(requireCallable(soundMap.get).call(soundMap), soundLibraryNames)
}

/**
 * Sounds already in list order, gathered under their group headings in that same order.
 * @param soundEntries - sounds as `toStrudelSoundEntries` orders them
 * @returns one group per heading, each with its sounds
 */
export const groupStrudelSoundEntries = (soundEntries: StrudelSoundEntry[]): StrudelSoundGroup[] =>
  soundEntries.reduce<StrudelSoundGroup[]>((soundGroups, soundEntry) => {
    const lastGroup = soundGroups.at(-1)
    return lastGroup?.label === soundEntry.group
      ? [...soundGroups.slice(0, -1), { ...lastGroup, sounds: [...lastGroup.sounds, soundEntry] }]
      : [...soundGroups, { label: soundEntry.group, sounds: [soundEntry] }]
  }, [])
