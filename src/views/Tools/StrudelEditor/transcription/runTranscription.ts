import { STRUDEL_FLOW_OPEN_STRINGS } from '@webgamekit/strudel-flow'
import { TRANSCRIPTION_SAMPLE_RATE } from '../config'
import type {
  TabImageRequest,
  TranscriptionOutput,
  TranscriptionProgress,
  TranscriptionRunner,
  TranscriptionWorkerMessage
} from '../types'
import { decodeAudioFile } from './decodeAudioFile'

const resultFromWorker = (
  worker: Worker,
  onProgress: (progress: TranscriptionProgress) => void
): Promise<TranscriptionOutput> =>
  new Promise((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<TranscriptionWorkerMessage>) => {
      const message = event.data
      if (message.kind === 'progress') {
        onProgress(message.progress)
        return
      }
      worker.terminate()
      if (message.kind === 'result') {
        resolve(message.result)
      } else {
        reject(new Error(message.message))
      }
    })
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message))
    })
  })

/**
 * Decodes the file on the main thread, then analyses it in a worker so the page stays
 * responsive. The worker module is imported on demand, keeping it out of the view chunk.
 * @param audioFile - the uploaded file
 * @param onProgress - called as each stage finishes
 * @returns the transcription
 */
export const runTranscriptionInWorker: TranscriptionRunner = async (audioFile, onProgress) => {
  onProgress({ stage: 'decoding', fraction: 0 })
  const samples = await decodeAudioFile(audioFile)
  const { default: TranscriptionWorker } = await import('./transcribe.worker?worker')
  const worker = new TranscriptionWorker()
  const outcome = resultFromWorker(worker, onProgress)
  worker.postMessage({ samples, sampleRate: TRANSCRIPTION_SAMPLE_RATE }, [samples.buffer])
  return outcome
}

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp)$/i

/**
 * Whether a chosen file is a screenshot rather than audio or MIDI.
 * @param chosenFile - the uploaded file
 * @returns true for a PNG, JPEG or WebP image
 */
export const isImageFile = (chosenFile: File): boolean =>
  IMAGE_FILE_PATTERN.test(chosenFile.name) || chosenFile.type.startsWith('image/')

/**
 * Reads the notes off a tab or piano score screenshot. The decoder and the reader are imported on demand,
 * keeping them out of the view chunk, and the reading runs in a worker.
 * @param imageFile - the uploaded screenshot
 * @param onProgress - called as each stage finishes
 * @returns the tab or the score as bars of notes
 */
export const runTabTranscription: TranscriptionRunner = async (imageFile, onProgress) => {
  onProgress({ stage: 'decoding', fraction: 0 })
  const { decodeImageFile } = await import('./tab/decodeImageFile')
  const request: TabImageRequest = {
    ...(await decodeImageFile(imageFile)),
    openStrings: STRUDEL_FLOW_OPEN_STRINGS
  }
  const { default: TabWorker } = await import('./tab/readTab.worker?worker')
  const worker = new TabWorker()
  const outcome = resultFromWorker(worker, onProgress)
  worker.postMessage(request, [request.pixels.buffer])
  return outcome
}

const MIDI_FILE_PATTERN = /\.midi?$/i

/**
 * Whether a chosen file is a Standard MIDI File rather than recorded audio.
 * @param chosenFile - the uploaded file
 * @returns true for a .mid or .midi file
 */
export const isMidiFile = (chosenFile: File): boolean =>
  MIDI_FILE_PATTERN.test(chosenFile.name) || chosenFile.type.includes('midi')

/**
 * Reads a MIDI file's notes straight onto the grid. The parser is imported on demand, keeping
 * it out of the view chunk.
 * @param midiFile - the uploaded .mid file
 * @param onProgress - called as each stage finishes
 * @returns the transcription
 */
export const runMidiTranscription: TranscriptionRunner = async (midiFile, onProgress) => {
  onProgress({ stage: 'decoding', fraction: 0 })
  const [{ transcribeMidi }, buffer] = await Promise.all([import('./midi'), midiFile.arrayBuffer()])
  onProgress({ stage: 'done', fraction: 1 })
  return transcribeMidi(buffer)
}

/**
 * The editor's runner: a screenshot is read as a tab or a score, MIDI files note for note, anything else
 * is analysed as audio.
 * @param chosenFile - the uploaded file
 * @param onProgress - called as each stage finishes
 * @returns the transcription
 */
export const runTranscription: TranscriptionRunner = (chosenFile, onProgress) => {
  if (isImageFile(chosenFile)) {
    return runTabTranscription(chosenFile, onProgress)
  }
  return isMidiFile(chosenFile)
    ? runMidiTranscription(chosenFile, onProgress)
    : runTranscriptionInWorker(chosenFile, onProgress)
}
