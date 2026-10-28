import { TRANSCRIPTION_SAMPLE_RATE } from '../config'
import type { TranscriptionResult, TranscriptionRunner, TranscriptionWorkerMessage } from '../types'
import { decodeAudioFile } from './decodeAudioFile'

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
  return new Promise<TranscriptionResult>((resolve, reject) => {
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
    worker.postMessage({ samples, sampleRate: TRANSCRIPTION_SAMPLE_RATE }, [samples.buffer])
  })
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
 * The editor's runner: MIDI files are read note for note, anything else is analysed as audio.
 * @param chosenFile - the uploaded file
 * @param onProgress - called as each stage finishes
 * @returns the transcription
 */
export const runTranscription: TranscriptionRunner = (chosenFile, onProgress) =>
  isMidiFile(chosenFile)
    ? runMidiTranscription(chosenFile, onProgress)
    : runTranscriptionInWorker(chosenFile, onProgress)
