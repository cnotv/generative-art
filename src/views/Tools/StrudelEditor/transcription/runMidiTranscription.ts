import type { TranscriptionResult, TranscriptionRunner } from './types'
import { transcribeMidi } from './midi'

/** MIDI transcription runner using @tonejs/midi. */
export const runMidiTranscription: TranscriptionRunner = async (midiFile, onProgress) => {
  onProgress({ stage: 'decoding', fraction: 0 })
  const arrayBuffer = await midiFile.arrayBuffer()
  onProgress({ stage: 'done', fraction: 1 })
  return transcribeMidi(arrayBuffer)
}
