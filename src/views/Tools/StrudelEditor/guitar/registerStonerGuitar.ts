import { STONER_GUITAR_TAG } from './config'
import type {
  StonerGuitarSampleMap,
  StonerGuitarSampleRegistrar,
  StonerGuitarTone,
  StonerGuitarWavFile,
  StonerGuitarWorkerMessage
} from './types'

const previousBlobUrls: { urls: string[] } = { urls: [] }

/**
 * Renders the bank in a worker, so about 80 seconds of audio never blocks the page.
 * @param tone - the five knobs
 * @returns each sound as an encoded WAV file
 */
export const renderStonerGuitarFiles = async (
  tone: StonerGuitarTone
): Promise<StonerGuitarWavFile[]> => {
  const { default: GuitarWorker } = await import('./stonerGuitar.worker?worker')
  const worker = new GuitarWorker()
  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<StonerGuitarWorkerMessage>) => {
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
    worker.postMessage({ tone })
  })
}

/**
 * Lays rendered files out the way superdough's sampler reads a map: sound name, then note name,
 * then the list of urls under that note.
 * @param files - the rendered files
 * @param urlsByFile - a url for each file, in the same order
 * @returns the sample map
 */
export const buildStonerGuitarSampleMap = (
  files: StonerGuitarWavFile[],
  urlsByFile: string[]
): StonerGuitarSampleMap =>
  files.reduce<StonerGuitarSampleMap>(
    (sampleMap, { soundName, noteName }, fileIndex) => ({
      ...sampleMap,
      [soundName]: { ...sampleMap[soundName], [noteName]: [urlsByFile[fileIndex] ?? ''] }
    }),
    {}
  )

/**
 * Renders the guitar sounds and registers them with superdough under `stoner_chord`,
 * `stoner_mute` and `stoner_note`. New blob urls skip the sampler's url cache, and the old
 * ones are released once the new ones are registered.
 * @param options - the sampler's `samples` function, the tone, and for tests a renderer
 * @returns once the sounds are registered
 */
export const registerStonerGuitar = async ({
  samples,
  tone,
  renderFiles = renderStonerGuitarFiles
}: {
  samples: StonerGuitarSampleRegistrar
  tone: StonerGuitarTone
  renderFiles?: (tone: StonerGuitarTone) => Promise<StonerGuitarWavFile[]>
}): Promise<void> => {
  const files = await renderFiles(tone)
  const urls = files.map(({ wav }) => URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })))
  await samples(buildStonerGuitarSampleMap(files, urls), '', { tag: STONER_GUITAR_TAG })
  previousBlobUrls.urls.forEach((url) => URL.revokeObjectURL(url))
  previousBlobUrls.urls = urls
}
