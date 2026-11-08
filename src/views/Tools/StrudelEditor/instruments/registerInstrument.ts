import { INSTRUMENT_KINDS, INSTRUMENT_TAG_PREFIX } from './config'
import type {
  InstrumentPreset,
  InstrumentSampleMap,
  InstrumentSampleRegistrar,
  InstrumentWavFile,
  InstrumentWorkerMessage
} from './types'

// Blob urls are kept per preset, so re-rendering one preset never frees another's audio.
const blobUrlsByPreset: Record<string, string[]> = {}

/**
 * Renders a preset's bank in a worker, so a few seconds of synthesis never block the page.
 * @param preset - the preset and its knobs
 * @returns each sound as an encoded WAV file
 */
export const renderInstrumentFiles = async (
  preset: InstrumentPreset
): Promise<InstrumentWavFile[]> => {
  const { default: InstrumentWorker } = await import('./instrumentRender.worker?worker')
  const worker = new InstrumentWorker()
  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<InstrumentWorkerMessage>) => {
      worker.terminate()
      if (event.data.kind === 'result') {
        resolve(event.data.files)
      } else {
        reject(new Error(event.data.message))
      }
    })
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message))
    })
    worker.postMessage({ preset })
  })
}

/**
 * The tag a preset's sounds are registered under; the sounds tab reads the kind and name from it.
 * @param preset - a preset
 * @returns `instrument:<kind>:<name>`
 */
export const buildInstrumentTag = (preset: InstrumentPreset): string =>
  `${INSTRUMENT_TAG_PREFIX}:${preset.kind}:${preset.name}`

/**
 * Lays rendered files out the way superdough's sampler reads a map: a pitched sound is its note
 * names with a list of urls under each; an unpitched one is a plain list.
 * @param files - the rendered files
 * @param urlsByFile - a url for each file, in the same order
 * @returns the sample map
 */
export const buildInstrumentSampleMap = (
  files: InstrumentWavFile[],
  urlsByFile: string[]
): InstrumentSampleMap =>
  files.reduce<InstrumentSampleMap>((sampleMap, { soundName, noteName }, fileIndex) => {
    const url = urlsByFile[fileIndex] ?? ''
    if (noteName === null) {
      return { ...sampleMap, [soundName]: [url] }
    }
    const notes = sampleMap[soundName]
    return {
      ...sampleMap,
      [soundName]: { ...(Array.isArray(notes) ? {} : notes), [noteName]: [url] }
    }
  }, {})

const readNoteUrls = (
  sampleMap: InstrumentSampleMap,
  soundName: string
): Record<string, string[]> => {
  const notes = sampleMap[soundName]
  return notes === undefined || Array.isArray(notes) ? {} : notes
}

/**
 * Folds a preset's techniques into the one sound named after the preset. Each sampled note holds
 * one url per technique in the kind's technique order, so Strudel's sample index (`name:1`)
 * picks the technique. A technique with no sample at a note takes the first technique's url, which
 * keeps every index stable across the whole range.
 * @param preset - the preset
 * @param sampleMap - the preset's `<name>_<articulation>` sounds
 * @returns `{ [name]: notes }`, or an empty map for a kind with no techniques such as a drum kit
 */
export const buildCombinedSampleMap = (
  preset: InstrumentPreset,
  sampleMap: InstrumentSampleMap
): InstrumentSampleMap => {
  const { techniques } = INSTRUMENT_KINDS[preset.kind]
  if (techniques.length === 0) {
    return {}
  }
  const urlsByTechnique = techniques.map((id) => readNoteUrls(sampleMap, `${preset.name}_${id}`))
  const noteNames = [...new Set(urlsByTechnique.flatMap((urls) => Object.keys(urls)))]
  const combinedNotes = Object.fromEntries(
    noteNames.map((noteName) => {
      const fallbackUrl = urlsByTechnique.map((urls) => urls[noteName]?.[0]).find(Boolean) ?? ''
      return [noteName, urlsByTechnique.map((urls) => urls[noteName]?.[0] ?? fallbackUrl)]
    })
  )
  return { [preset.name]: combinedNotes }
}

/**
 * Renders a preset and registers its sounds with superdough as `<name>_<articulation>` and, for a pitched kind, as `<name>` holding every technique. New blob
 * urls skip the sampler's url cache, and the preset's old ones are released once the new ones
 * are registered.
 * @param options - the sampler's `samples` function, the preset, and for tests a renderer
 * @returns once the sounds are registered
 */
export const registerInstrument = async ({
  samples,
  preset,
  renderFiles = renderInstrumentFiles
}: {
  samples: InstrumentSampleRegistrar
  preset: InstrumentPreset
  renderFiles?: (preset: InstrumentPreset) => Promise<InstrumentWavFile[]>
}): Promise<void> => {
  const files = await renderFiles(preset)
  const urls = files.map(({ wav }) => URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })))
  const articulationMap = buildInstrumentSampleMap(files, urls)
  const sampleMap = { ...articulationMap, ...buildCombinedSampleMap(preset, articulationMap) }
  await samples(sampleMap, '', { tag: buildInstrumentTag(preset) })
  blobUrlsByPreset[preset.name]?.forEach((url) => URL.revokeObjectURL(url))
  blobUrlsByPreset[preset.name] = urls
}
