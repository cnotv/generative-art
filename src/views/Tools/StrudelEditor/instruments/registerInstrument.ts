import { INSTRUMENT_TAG_PREFIX } from './config'
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

/**
 * Renders a preset and registers its sounds with superdough as `<name>_<articulation>`. New blob
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
  await samples(buildInstrumentSampleMap(files, urls), '', { tag: buildInstrumentTag(preset) })
  blobUrlsByPreset[preset.name]?.forEach((url) => URL.revokeObjectURL(url))
  blobUrlsByPreset[preset.name] = urls
}
