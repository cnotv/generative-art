import { SECONDS_PER_MINUTE } from '../config'

/**
 * Deterministic test signals for the transcription pipeline. A hash replaces
 * Math.random so every run analyses the exact same noise.
 */

const NOISE_HASH_MULTIPLIER = 12.9898
const NOISE_HASH_SCALE = 43758.5453
const KICK_FREQUENCY_HZ = 60
const KICK_DURATION_SECONDS = 0.15
const KICK_DECAY_PER_SECOND = 25
const HAT_DURATION_SECONDS = 0.03
const HAT_AMPLITUDE = 0.4
const CLICK_DURATION_SECONDS = 0.01

type SignalSpan = {
  durationSeconds: number
  sampleRate: number
}

type BeatSignalOptions = SignalSpan & {
  beatsPerMinute: number
  offsetSeconds?: number
}

type DrumLoopOptions = {
  beatsPerMinute: number
  bars: number
  sampleRate: number
}

const sampleCountFor = (durationSeconds: number, sampleRate: number): number =>
  Math.round(durationSeconds * sampleRate)

/**
 * Pseudo-random value in [-1, 1] derived from the sample index.
 * @param sampleIndex - position of the sample
 * @returns deterministic noise sample
 */
export const hashedNoise = (sampleIndex: number): number => {
  const hashed = Math.sin((sampleIndex + 1) * NOISE_HASH_MULTIPLIER) * NOISE_HASH_SCALE
  return (hashed - Math.floor(hashed)) * 2 - 1
}

/**
 * A pure sine tone.
 * @param frequencyHz - tone frequency
 * @param span - duration and sample rate
 * @param amplitude - peak level
 * @returns the generated samples
 */
export const createSine = (frequencyHz: number, span: SignalSpan, amplitude = 0.5): Float32Array =>
  Float32Array.from(
    { length: sampleCountFor(span.durationSeconds, span.sampleRate) },
    (_, sampleIndex) =>
      amplitude * Math.sin((2 * Math.PI * frequencyHz * sampleIndex) / span.sampleRate)
  )

/**
 * Deterministic white noise.
 * @param span - duration and sample rate
 * @param amplitude - peak level
 * @returns the generated samples
 */
export const createNoise = (span: SignalSpan, amplitude = 0.5): Float32Array =>
  Float32Array.from(
    { length: sampleCountFor(span.durationSeconds, span.sampleRate) },
    (_, sampleIndex) => amplitude * hashedNoise(sampleIndex)
  )

/**
 * Sums signals sample by sample; the result is as long as the longest input.
 * @param signals - signals to mix
 * @returns the mixed samples
 */
export const mixSignals = (...signals: Float32Array[]): Float32Array =>
  Float32Array.from(
    { length: Math.max(0, ...signals.map((signal) => signal.length)) },
    (_, sampleIndex) => signals.reduce((sum, signal) => sum + (signal[sampleIndex] ?? 0), 0)
  )

/**
 * Places a short sound at each start time inside a silent buffer.
 * @param span - total duration and sample rate
 * @param startTimes - start of each event in seconds
 * @param renderEvent - sample value at a given offset (seconds) into the event
 * @param eventDurationSeconds - how long each event lasts
 * @returns the rendered samples
 */
export const renderEvents = (
  span: SignalSpan,
  startTimes: number[],
  renderEvent: (offsetSeconds: number, sampleIndex: number) => number,
  eventDurationSeconds: number
): Float32Array =>
  Float32Array.from(
    { length: sampleCountFor(span.durationSeconds, span.sampleRate) },
    (_, sampleIndex) => {
      const timeSeconds = sampleIndex / span.sampleRate
      const activeStart = startTimes.find(
        (startTime) => timeSeconds >= startTime && timeSeconds < startTime + eventDurationSeconds
      )
      return activeStart === undefined ? 0 : renderEvent(timeSeconds - activeStart, sampleIndex)
    }
  )

const beatTimes = (options: BeatSignalOptions, subdivision = 1): number[] => {
  const intervalSeconds = SECONDS_PER_MINUTE / options.beatsPerMinute / subdivision
  const offsetSeconds = options.offsetSeconds ?? 0
  const eventCount = Math.floor((options.durationSeconds - offsetSeconds) / intervalSeconds)
  return Array.from(
    { length: Math.max(0, eventCount) },
    (_, eventIndex) => offsetSeconds + eventIndex * intervalSeconds
  )
}

/**
 * A noise click on every beat, the simplest signal with an unambiguous tempo.
 * @param options - tempo, offset, duration and sample rate
 * @returns the rendered samples
 */
export const createClickTrack = (options: BeatSignalOptions): Float32Array =>
  renderEvents(
    options,
    beatTimes(options),
    (_, sampleIndex) => hashedNoise(sampleIndex),
    CLICK_DURATION_SECONDS
  )

const kickSample = (offsetSeconds: number): number =>
  Math.exp(-KICK_DECAY_PER_SECOND * offsetSeconds) *
  Math.sin(2 * Math.PI * KICK_FREQUENCY_HZ * offsetSeconds)

const hatSample = (_: number, sampleIndex: number): number =>
  HAT_AMPLITUDE * hashedNoise(sampleIndex)

/**
 * Kick drum on every beat and a hi-hat on every off-beat eighth note.
 * @param options - tempo, bar count and sample rate
 * @returns the rendered samples
 */
export const createDrumLoop = (options: DrumLoopOptions): Float32Array => {
  const beatSeconds = SECONDS_PER_MINUTE / options.beatsPerMinute
  const span = { durationSeconds: options.bars * 4 * beatSeconds, sampleRate: options.sampleRate }
  const kickTimes = beatTimes({ ...span, beatsPerMinute: options.beatsPerMinute })
  const hatTimes = kickTimes.map((kickTime) => kickTime + beatSeconds / 2)
  return mixSignals(
    renderEvents(span, kickTimes, kickSample, KICK_DURATION_SECONDS),
    renderEvents(span, hatTimes, hatSample, HAT_DURATION_SECONDS)
  )
}
