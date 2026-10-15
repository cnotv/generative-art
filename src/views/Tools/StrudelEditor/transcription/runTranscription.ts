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
