export type SoundConfig = {
  startFreq: number;
  endFreq: number;
  duration: number;
  volume: number;
  waveType?: OscillatorType;
  attackTime?: number;
  releaseTime?: number;
};

export type NoteSequence = [number, number][];
