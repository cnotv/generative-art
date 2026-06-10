export type SoundConfig = {
  startFreq: number
  endFreq: number
  duration: number
  volume: number
  waveType?: OscillatorType
  attackTime?: number
  releaseTime?: number
  reverbAmount?: number
}

export type NoteSequence = [number, number][]

export type ScheduledNote = {
  time: number
  freq: number
  duration: number
  volume?: number
  waveType?: OscillatorType
  attackTime?: number
}
