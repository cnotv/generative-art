import type { ScheduledNote } from './types'

const LOOKAHEAD_MS = 150
const TICK_INTERVAL_MS = 30
const AUDIBLE_SAMPLE_LEVEL = 0.02

type WaitingBacking = { buffer: AudioBuffer; volume: number }

export interface NoteScheduler {
  start(notes: ScheduledNote[], wallClockStartMs: number): void
  /**
   * Plays a recording in time with the notes. It must open on its first beat: the leading
   * silence is skipped, because decoders pad compressed audio by different amounts.
   * @param audioData - The encoded file, which decoding takes ownership of
   * @param volume - Playback volume, 1 for as recorded
   * @returns A promise that settles once the track is decoded and scheduled
   */
  startBacking(audioData: ArrayBuffer, volume?: number): Promise<void>
  stop(): void
  destroy(): void
  readonly currentMs: number
  readonly isPlaying: boolean
}

export type AudioContextFactory = () => AudioContext

const findFirstSoundSeconds = (buffer: AudioBuffer): number => {
  const firstSoundIndex = buffer
    .getChannelData(0)
    .findIndex((sample) => Math.abs(sample) >= AUDIBLE_SAMPLE_LEVEL)
  return Math.max(0, firstSoundIndex) / buffer.sampleRate
}

const scheduleNote = (ctx: AudioContext, note: ScheduledNote, startAtSec: number): void => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = note.waveType ?? 'sine'
  osc.frequency.setValueAtTime(note.freq, startAtSec)

  const vol = note.volume ?? 0.25
  const dur = note.duration / 1000
  const attack = note.attackTime ?? 0.005
  gain.gain.setValueAtTime(0, startAtSec)
  gain.gain.linearRampToValueAtTime(vol, startAtSec + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, startAtSec + dur - 0.01)

  osc.start(startAtSec)
  osc.stop(startAtSec + dur)
}

const playBacking = (
  ctx: AudioContext,
  { buffer, volume }: WaitingBacking,
  elapsedMs: number
): AudioBufferSourceNode => {
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(ctx.destination)
  const delayFromNowSec = Math.max(0, -elapsedMs / 1000)
  const lateSec = Math.max(0, elapsedMs / 1000)
  source.start(ctx.currentTime + delayFromNowSec, findFirstSoundSeconds(buffer) + lateSec)
  return source
}

/**
 * Creates a note scheduler that uses the Web Audio API lookahead pattern for
 * drift-free sound scheduling, while exposing wall-clock elapsed time for the
 * game loop. Both are kept in sync by scheduling audio events at precise
 * audioContext.currentTime offsets rather than relying on setTimeout alone.
 * @param audioContextFactory - Optional factory for creating the AudioContext (defaults to `new AudioContext()`)
 * @returns A NoteScheduler instance
 */
export const createNoteScheduler = (
  audioContextFactory: AudioContextFactory = () => new AudioContext()
): NoteScheduler => {
  let audioContext: AudioContext | null = null
  let startMs = 0
  let nextNoteIndex = 0
  let tickId: ReturnType<typeof setInterval> | null = null
  let playing = false
  let sortedNotes: ScheduledNote[] = []
  let waitingBacking: WaitingBacking | null = null
  let backingSource: AudioBufferSourceNode | null = null

  const getContext = (): AudioContext => {
    if (!audioContext) {
      audioContext = audioContextFactory()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => undefined)
    }
    return audioContext
  }

  const scheduleBacking = (ctx: AudioContext, elapsedMs: number): void => {
    if (waitingBacking === null || elapsedMs + LOOKAHEAD_MS < 0) return
    backingSource = playBacking(ctx, waitingBacking, elapsedMs)
    waitingBacking = null
  }

  const schedulePendingNotes = (ctx: AudioContext, elapsedMs: number): void => {
    scheduleBacking(ctx, elapsedMs)
    const scheduleUntilMs = elapsedMs + LOOKAHEAD_MS
    const toSchedule = sortedNotes
      .slice(nextNoteIndex)
      .filter((note) => note.time <= scheduleUntilMs)
    toSchedule.forEach((note) => {
      const delayFromNowSec = Math.max(0, (note.time - elapsedMs) / 1000)
      scheduleNote(ctx, note, ctx.currentTime + delayFromNowSec)
    })
    nextNoteIndex += toSchedule.length
  }

  const tick = (): void => {
    if (!playing || !audioContext) return
    schedulePendingNotes(audioContext, Date.now() - startMs)
  }

  const start = (notes: ScheduledNote[], wallClockStartMs: number): void => {
    stop()
    const ctx = getContext()
    sortedNotes = [...notes].sort((a, b) => a.time - b.time)
    startMs = wallClockStartMs
    nextNoteIndex = 0
    playing = true
    tickId = setInterval(tick, TICK_INTERVAL_MS)
    schedulePendingNotes(ctx, Date.now() - startMs)
  }

  const startBacking = async (audioData: ArrayBuffer, volume = 1): Promise<void> => {
    const ctx = getContext()
    const buffer = await ctx.decodeAudioData(audioData)
    if (!playing) return
    waitingBacking = { buffer, volume }
    scheduleBacking(ctx, Date.now() - startMs)
  }

  const stop = (): void => {
    playing = false
    if (tickId !== null) {
      clearInterval(tickId)
      tickId = null
    }
    nextNoteIndex = 0
    waitingBacking = null
    backingSource?.stop()
    backingSource = null
    if (audioContext?.state === 'running') {
      audioContext.suspend().catch(() => undefined)
    }
  }

  const destroy = (): void => {
    stop()
    if (audioContext) {
      audioContext.close().catch(() => undefined)
      audioContext = null
    }
  }

  return {
    start,
    startBacking,
    stop,
    destroy,
    get currentMs() {
      return playing ? Date.now() - startMs : 0
    },
    get isPlaying() {
      return playing
    }
  }
}
