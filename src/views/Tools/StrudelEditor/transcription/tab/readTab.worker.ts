import type { TabImageRequest, TranscriptionWorkerMessage } from '../../types'
import { buildTabImage } from './buildTabImage'
import { readTab } from './readTab'

const postToEditor = (message: TranscriptionWorkerMessage): void => {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<TabImageRequest>) => {
  try {
    postToEditor({ kind: 'progress', progress: { stage: 'notes', fraction: 0 } })
    const { width, height, pixels } = event.data
    postToEditor({ kind: 'result', result: readTab(buildTabImage(width, height, pixels)) })
  } catch (error) {
    postToEditor({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})
