import { encodeWav } from '../wavEncoding'
import { STONER_GUITAR_SAMPLE_RATE } from './config'
import { buildStonerGuitarBank } from './stonerGuitar'
import type {
  StonerGuitarWavFile,
  StonerGuitarWorkerMessage,
  StonerGuitarWorkerRequest
} from './types'

const postToEditor = (message: StonerGuitarWorkerMessage, transfer: ArrayBuffer[] = []): void => {
  self.postMessage(message, { transfer })
}

self.addEventListener('message', (event: MessageEvent<StonerGuitarWorkerRequest>) => {
  try {
    const files: StonerGuitarWavFile[] = buildStonerGuitarBank(event.data.tone).map(
      ({ soundName, noteName, channels }) => ({
        soundName,
        noteName,
        wav: encodeWav(channels, STONER_GUITAR_SAMPLE_RATE)
      })
    )
    postToEditor(
      { kind: 'result', files },
      files.map(({ wav }) => wav)
    )
  } catch (error) {
    postToEditor({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})
