import {
  ONSET_FRAME_SIZE,
  ONSET_HOP_SIZE,
  PITCH_FRAME_SIZE,
  STEPS_PER_BAR,
  STEPS_PER_BEAT,
  TRANSCRIPTION_MAX_BARS,
  TRANSCRIPTION_MAX_SECONDS
} from '../config'
import type {
  DrumSound,
  TempoEstimate,
  TranscriptionBar,
  TranscriptionProgress,
  TranscriptionRequest,
  TranscriptionResult
} from '../types'
import { createFourierTransform, magnitudeSpectrum } from './fft'
import { computeSpectrogram, extractFrame, hannWindow } from './spectrogram'
import { computeSpectralFlux, pickOnsetPeaks } from './onsets'
import { estimateTempo } from './tempo'
import { quantizeToSteps, stepDurationSeconds, stepStartSeconds } from './grid'
import { classifyDrumHit } from './drums'
import { dominantBassNote } from './pitch'
import { computeChroma, matchTriad } from './chords'

const ONSETS_DONE_FRACTION = 0.4
const TEMPO_DONE_FRACTION = 0.5
const NOTES_DONE_FRACTION = 0.9
const BAR_START_KICK_BONUS = 0.5
const PITCH_CLASS_COUNT = 12
const BEATS_PER_BAR = STEPS_PER_BAR / STEPS_PER_BEAT

type DrumStep = {
  stepIndex: number
  drums: DrumSound[]
}

type PitchAnalyser = {
  spectrumAt: (startSeconds: number) => Float64Array
  binWidthHz: number
}

const createPitchAnalyser = (samples: Float32Array, sampleRate: number): PitchAnalyser => {
  const window = hannWindow(PITCH_FRAME_SIZE)
  const transform = createFourierTransform(PITCH_FRAME_SIZE)
  return {
    spectrumAt: (startSeconds) =>
      magnitudeSpectrum(
        extractFrame(samples, Math.max(0, Math.round(startSeconds * sampleRate)), window),
        transform
      ),
    binWidthHz: sampleRate / PITCH_FRAME_SIZE
  }
}

const detectDrumSteps = (
  spectrogram: Float64Array[],
  onsetFrames: number[],
  tempo: TempoEstimate,
  framesPerSecond: number,
  binWidthHz: number
): DrumStep[] => {
  const frameByOnsetSeconds = new Map(
    onsetFrames.map((frameIndex) => [frameIndex / framesPerSecond, frameIndex])
  )
  return quantizeToSteps([...frameByOnsetSeconds.keys()], tempo)
    .map((stepHit) => {
      const frameIndex = frameByOnsetSeconds.get(stepHit.onsetSeconds) ?? 0
      return {
        stepIndex: stepHit.stepIndex,
        drums: classifyDrumHit(spectrogram[frameIndex], binWidthHz, spectrogram[frameIndex - 1])
      }
    })
    .filter((drumStep) => drumStep.drums.length > 0)
}

const positiveModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor

/**
 * Kicks landing on beats and on bar starts if bars begin at this offset. Positions wrap
 * rather than skip the steps before the offset, or every later offset loses the kicks
 * ahead of it and offset zero wins regardless of the music.
 * @param kickSteps - step index of every kick
 * @param offset - candidate step for the first bar start
 * @returns kicks on beats, plus a bonus for each on a bar start
 */
const kickAlignmentScore = (kickSteps: number[], offset: number): number =>
  kickSteps.reduce((score, stepIndex) => {
    const relativeStep = stepIndex - offset
    const onBeat = positiveModulo(relativeStep, STEPS_PER_BEAT) === 0 ? 1 : 0
    const onBarStart = positiveModulo(relativeStep, STEPS_PER_BAR) === 0 ? BAR_START_KICK_BONUS : 0
    return score + onBeat + onBarStart
  }, 0)

/**
 * Offsets that put the most kicks on the beat, and on the first beat of the bar. The
 * tempo comb can lock onto off-beat hi-hats, which this shifts back onto the kick. A kick
 * on every beat ties all four rotations, which the harmony then has to settle; so does a
 * lead of a single bar-start kick, which one missed or extra hit at the edge can decide.
 * @param drumSteps - classified drum hits per step
 * @returns the bar-start offsets worth comparing, all on the same beat phase
 */
const bestKickOffsets = (drumSteps: DrumStep[]): number[] => {
  const kickSteps = drumSteps
    .filter((drumStep) => drumStep.drums.includes('bd'))
    .map((drumStep) => drumStep.stepIndex)
  const scores = Array.from({ length: STEPS_PER_BAR }, (_, offset) =>
    kickAlignmentScore(kickSteps, offset)
  )
  const bestScore = Math.max(...scores)
  const winners = scores.flatMap((score, offset) =>
    score >= bestScore - BAR_START_KICK_BONUS ? [offset] : []
  )
  return winners.filter((offset) => offset % STEPS_PER_BEAT === winners[0] % STEPS_PER_BEAT)
}

const sumChroma = (chromas: Float64Array[]): Float64Array =>
  chromas.reduce(
    (sum, chroma) => sum.map((energy, classIndex) => energy + chroma[classIndex]),
    new Float64Array(PITCH_CLASS_COUNT)
  )

const chromaDistance = (first: Float64Array, second: Float64Array): number => {
  const lengths = Math.hypot(...first) * Math.hypot(...second)
  if (lengths === 0) {
    return 0
  }
  const overlap = first.reduce((sum, energy, classIndex) => sum + energy * second[classIndex], 0)
  return 1 - overlap / lengths
}

/**
 * How much the harmony changes across each bar line if bars start on this beat.
 * @param beatChromas - chroma per beat
 * @param barStartBeat - beat the first bar starts on
 * @returns summed chroma change across every bar line
 */
const harmonicChangeScore = (beatChromas: Float64Array[], barStartBeat: number): number =>
  beatChromas.reduce(
    (score, chroma, beatIndex) =>
      beatIndex > barStartBeat && (beatIndex - barStartBeat) % BEATS_PER_BAR === 0
        ? score + chromaDistance(beatChromas[beatIndex - 1], chroma)
        : score,
    0
  )

const computeBeatChromas = (
  analyser: PitchAnalyser,
  tempo: TempoEstimate,
  beatPhaseStep: number,
  beatCount: number
): Float64Array[] =>
  Array.from({ length: beatCount }, (_, beatIndex) =>
    computeChroma(
      analyser.spectrumAt(stepStartSeconds(beatPhaseStep + beatIndex * STEPS_PER_BEAT, tempo)),
      analyser.binWidthHz
    )
  )

const countSteps = (durationSeconds: number, tempo: TempoEstimate): number =>
  Math.floor((durationSeconds - tempo.phaseSeconds) / stepDurationSeconds(tempo.beatsPerMinute))

type BarContext = {
  analyser: PitchAnalyser
  tempo: TempoEstimate
  drumsByStep: Map<number, DrumSound[]>
  beatChromas: Float64Array[]
  offset: number
  firstBarBeat: number
}

const buildBar = (barIndex: number, context: BarContext): TranscriptionBar => {
  const firstStep = context.offset + barIndex * STEPS_PER_BAR
  const firstBeat = context.firstBarBeat + barIndex * BEATS_PER_BAR
  return {
    steps: Array.from({ length: STEPS_PER_BAR }, (_, stepInBar) => {
      const stepIndex = firstStep + stepInBar
      const drums = context.drumsByStep.get(stepIndex) ?? []
      const bassNote =
        drums.length === 0
          ? null
          : dominantBassNote(
              context.analyser.spectrumAt(stepStartSeconds(stepIndex, context.tempo)),
              context.analyser.binWidthHz
            )
      return { drums, bassNote }
    }),
    chord: matchTriad(sumChroma(context.beatChromas.slice(firstBeat, firstBeat + BEATS_PER_BAR)))
  }
}

const buildBarContext = (
  samples: Float32Array,
  sampleRate: number,
  tempo: TempoEstimate,
  drumSteps: DrumStep[]
): BarContext => {
  const analyser = createPitchAnalyser(samples, sampleRate)
  const candidateOffsets = bestKickOffsets(drumSteps)
  const beatPhaseStep = candidateOffsets[0] % STEPS_PER_BEAT
  const beatCount = Math.min(
    (TRANSCRIPTION_MAX_BARS + 1) * BEATS_PER_BAR,
    Math.max(
      0,
      Math.ceil((countSteps(samples.length / sampleRate, tempo) - beatPhaseStep) / STEPS_PER_BEAT)
    )
  )
  const beatChromas = computeBeatChromas(analyser, tempo, beatPhaseStep, beatCount)
  const offset = candidateOffsets.reduce((bestOffset, candidate) =>
    harmonicChangeScore(beatChromas, (candidate - beatPhaseStep) / STEPS_PER_BEAT) >
    harmonicChangeScore(beatChromas, (bestOffset - beatPhaseStep) / STEPS_PER_BEAT)
      ? candidate
      : bestOffset
  )
  return {
    analyser,
    tempo,
    drumsByStep: new Map(drumSteps.map((drumStep) => [drumStep.stepIndex, drumStep.drums])),
    beatChromas,
    offset,
    firstBarBeat: (offset - beatPhaseStep) / STEPS_PER_BEAT
  }
}

/**
 * Turns mono audio into bars of drums, bass notes and chords on a sixteenth-note grid.
 * Pure and synchronous, so it runs the same in the worker and in tests.
 * @param request - mono samples and their rate
 * @param onProgress - called as each stage finishes
 * @returns the tempo and the analysed bars
 */
export const transcribeSamples = (
  request: TranscriptionRequest,
  onProgress: (progress: TranscriptionProgress) => void = () => undefined
): TranscriptionResult => {
  const samples = request.samples.subarray(0, TRANSCRIPTION_MAX_SECONDS * request.sampleRate)
  const spectrogram = computeSpectrogram(samples, ONSET_FRAME_SIZE, ONSET_HOP_SIZE)
  const flux = computeSpectralFlux(spectrogram, request.sampleRate / ONSET_FRAME_SIZE)
  const onsetFrames = pickOnsetPeaks(flux)
  onProgress({ stage: 'onsets', fraction: ONSETS_DONE_FRACTION })

  const framesPerSecond = request.sampleRate / ONSET_HOP_SIZE
  const tempo = estimateTempo(flux, framesPerSecond)
  onProgress({ stage: 'tempo', fraction: TEMPO_DONE_FRACTION })

  const drumSteps = detectDrumSteps(
    spectrogram,
    onsetFrames,
    tempo,
    framesPerSecond,
    request.sampleRate / ONSET_FRAME_SIZE
  )
  const context = buildBarContext(samples, request.sampleRate, tempo, drumSteps)
  const barCount = Math.min(
    TRANSCRIPTION_MAX_BARS,
    Math.max(
      0,
      Math.ceil(
        (countSteps(samples.length / request.sampleRate, tempo) - context.offset) / STEPS_PER_BAR
      )
    )
  )
  const bars = Array.from({ length: barCount }, (_, barIndex) => buildBar(barIndex, context))
  onProgress({ stage: 'notes', fraction: NOTES_DONE_FRACTION })

  onProgress({ stage: 'done', fraction: 1 })
  return { kind: 'grid', beatsPerMinute: tempo.beatsPerMinute, bars }
}
