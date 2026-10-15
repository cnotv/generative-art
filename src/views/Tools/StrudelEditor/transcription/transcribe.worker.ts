import type { TranscriptionRequest, TranscriptionWorkerMessage } from '../types'
import { transcribeSamples } from './transcribe'

const postToEditor = (message: TranscriptionWorkerMessage): void => {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<TranscriptionRequest>) => {
  try {
    const result = transcribeSamples(event.data, (progress) =>
      postToEditor({ kind: 'progress', progress })
    )
    postToEditor({ kind: 'result', result })
  } catch (error) {
    postToEditor({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})
