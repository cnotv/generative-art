import { encodeWav } from '../wavEncoding'
import { INSTRUMENT_SAMPLE_RATE } from './config'
import { buildInstrumentBank } from './renderInstrument'
import type { InstrumentWavFile, InstrumentWorkerMessage, InstrumentWorkerRequest } from './types'

const postToEditor = (message: InstrumentWorkerMessage, transfer: ArrayBuffer[] = []): void => {
  self.postMessage(message, { transfer })
}

self.addEventListener('message', (event: MessageEvent<InstrumentWorkerRequest>) => {
  try {
    const files: InstrumentWavFile[] = buildInstrumentBank(event.data.preset).map(
      ({ soundName, noteName, channels }) => ({
        soundName,
        noteName,
        wav: encodeWav(channels, INSTRUMENT_SAMPLE_RATE)
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
