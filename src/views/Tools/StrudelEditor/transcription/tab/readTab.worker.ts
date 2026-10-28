import type {
  TabImage,
  TabImageRequest,
  TabOpenStrings,
  TranscriptionOutput,
  TranscriptionWorkerMessage
} from '../../types'
import { findGrandStaves } from '../score/grandStaves'
import { readScore } from '../score/readScore'
import { buildTabImage } from './buildTabImage'
import { readTab } from './readTab'

// Five line staves in pairs are a piano score; anything else is read as a tab.
const readSheet = (image: TabImage, openStrings: TabOpenStrings): TranscriptionOutput =>
  findGrandStaves(image).length > 0 ? readScore(image) : readTab(image, openStrings)

const postToEditor = (message: TranscriptionWorkerMessage): void => {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<TabImageRequest>) => {
  try {
    postToEditor({ kind: 'progress', progress: { stage: 'notes', fraction: 0 } })
    const { width, height, pixels, openStrings } = event.data
    postToEditor({
      kind: 'result',
      result: readSheet(buildTabImage(width, height, pixels), openStrings)
    })
  } catch (error) {
    postToEditor({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})
