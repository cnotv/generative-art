import type { ScheduledNote } from './types'

const LOOKAHEAD_MS = 150
const TICK_INTERVAL_MS = 30

export interface NoteScheduler {
  start(notes: ScheduledNote[], wallClockStartMs: number): void
  stop(): void
  readonly currentMs: number
  readonly isPlaying: boolean
}

export type AudioContextFactory = () => AudioContext

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

  const getContext = (): AudioContext => {
    if (!audioContext) {
      audioContext = audioContextFactory()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => undefined)
    }
    return audioContext
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
    gain.gain.setValueAtTime(0, startAtSec)
    gain.gain.linearRampToValueAtTime(vol, startAtSec + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, startAtSec + dur - 0.01)

    osc.start(startAtSec)
    osc.stop(startAtSec + dur)
  }

  const schedulePendingNotes = (ctx: AudioContext, elapsedMs: number): void => {
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

  const stop = (): void => {
    playing = false
    if (tickId !== null) {
      clearInterval(tickId)
      tickId = null
    }
    nextNoteIndex = 0
    if (audioContext?.state === 'running') {
      audioContext.suspend().catch(() => undefined)
    }
  }

  return {
    start,
    stop,
    get currentMs() {
      return playing ? Date.now() - startMs : 0
    },
    get isPlaying() {
      return playing
    }
  }
}
