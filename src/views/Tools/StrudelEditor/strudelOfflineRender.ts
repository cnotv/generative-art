import { encodeWav } from './wavEncoding'
import type { StrudelExportFormat, StrudelExportOptions, StrudelScheduledHap } from './types'

type UnknownCallable = (...callArguments: unknown[]) => unknown

const EXPORT_CHANNEL_COUNT = 2

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readFunction = (owner: unknown, name: string): UnknownCallable => {
  const candidate = isRecord(owner) ? owner[name] : undefined
  if (typeof candidate !== 'function') {
    throw new TypeError(`Strudel is missing ${name}`)
  }
  // Strudel ships untyped JS, so the shape is checked before calling.
  return (...callArguments: unknown[]) => Reflect.apply(candidate, owner, callArguments)
}

const readCycle = (value: unknown): number => {
  const cycle = isRecord(value) ? readFunction(value, 'valueOf')() : value
  return typeof cycle === 'number' ? cycle : Number.NaN
}

/**
 * The haps that start inside the range, in onset order: controls such as `cut` depend on the
 * order superdough sees them in, and the MIDI export writes the same events the WAV plays.
 * @param pattern - the evaluated pattern
 * @param exportOptions - the cycle range
 * @param cyclesPerSecond - the tempo the pattern set
 * @returns each event's value, start and length in cycles
 */
export const readScheduledHaps = (
  pattern: unknown,
  exportOptions: StrudelExportOptions,
  cyclesPerSecond: number
): StrudelScheduledHap[] => {
  const haps = readFunction(pattern, 'queryArc')(exportOptions.startCycle, exportOptions.endCycle, {
    _cps: cyclesPerSecond
  })
  return (Array.isArray(haps) ? haps : [])
    .filter((hap) => readFunction(hap, 'hasOnset')() === true)
    .map((hap) => {
      readFunction(hap, 'ensureObjectValue')()
      return {
        value: isRecord(hap) ? hap.value : undefined,
        beginCycle: readCycle(isRecord(hap) && isRecord(hap.whole) ? hap.whole.begin : undefined),
        durationCycles: readCycle(isRecord(hap) ? hap.duration : undefined)
      }
    })
    .filter((hap) => Number.isFinite(hap.beginCycle) && Number.isFinite(hap.durationCycles))
    .sort((left, right) => left.beginCycle - right.beginCycle)
}

/**
 * Renders a pattern offline, faster than real time, into a WAV file. It swaps superdough's
 * shared audio context for an offline one and puts the live context back afterwards, rather
 * than using `renderPatternAudio`, whose published build mixes two superdough copies so every
 * reverb and delay send fails, and closes the context the editor plays on.
 * @param audioModule - the loaded `@strudel/webaudio` module, which re-exports superdough
 * @param pattern - the evaluated pattern
 * @param cyclesPerSecond - the tempo the pattern set
 * @param exportOptions - the cycle range and sample rate
 * @returns the WAV file
 */
export const renderStrudelPatternToWav = async (
  audioModule: Record<string, unknown>,
  pattern: unknown,
  cyclesPerSecond: number,
  exportOptions: StrudelExportOptions
): Promise<ArrayBuffer> => {
  const getAudioContext = readFunction(audioModule, 'getAudioContext')
  const setAudioContext = readFunction(audioModule, 'setAudioContext')
  const getController = readFunction(audioModule, 'getSuperdoughAudioController')
  const setController = readFunction(audioModule, 'setSuperdoughAudioController')
  const playHap = readFunction(audioModule, 'superdough')
  const liveContext = getAudioContext()
  const liveController = getController()
  const durationSeconds = (exportOptions.endCycle - exportOptions.startCycle) / cyclesPerSecond
  const offlineContext = new OfflineAudioContext(
    EXPORT_CHANNEL_COUNT,
    Math.ceil(durationSeconds * exportOptions.sampleRate),
    exportOptions.sampleRate
  )
  try {
    setAudioContext(offlineContext)
    setController(null)
    await readFunction(audioModule, 'initAudio')({})
    await readScheduledHaps(pattern, exportOptions, cyclesPerSecond).reduce(
      async (previous, hap) => {
        await previous
        const startSeconds = (hap.beginCycle - exportOptions.startCycle) / cyclesPerSecond
        await playHap(
          hap.value,
          startSeconds,
          hap.durationCycles / cyclesPerSecond,
          cyclesPerSecond,
          startSeconds
        )
      },
      Promise.resolve()
    )
    const rendered = await offlineContext.startRendering()
    return encodeWav(
      Array.from({ length: rendered.numberOfChannels }, (_, channel) =>
        rendered.getChannelData(channel)
      ),
      rendered.sampleRate
    )
  } finally {
    setAudioContext(liveContext)
    setController(liveController)
  }
}

const EXPORT_FILE_TYPES: Record<StrudelExportFormat, { extension: string; mimeType: string }> = {
  wav: { extension: 'wav', mimeType: 'audio/wav' },
  midi: { extension: 'mid', mimeType: 'audio/midi' }
}

/**
 * Hands a finished file to the browser as a download.
 * @param fileContent - the file
 * @param fileName - the name to save it under, without the extension
 * @param format - which kind of file it is, for its extension and type
 */
export const downloadExportFile = (
  fileContent: ArrayBuffer | Uint8Array<ArrayBuffer>,
  fileName: string,
  format: StrudelExportFormat
): void => {
  const { extension, mimeType } = EXPORT_FILE_TYPES[format]
  const url = URL.createObjectURL(new Blob([fileContent], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName.trim() || new Date().toISOString()}.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}
