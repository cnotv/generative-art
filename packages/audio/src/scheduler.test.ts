import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { midiNoteToFreq } from './midiNote'
import { createNoteScheduler } from './scheduler'
import type { AudioContextFactory } from './scheduler'

describe('midiNoteToFreq', () => {
  it.each([
    [69, 440],
    [60, 261.63],
    [72, 523.25],
    [57, 220],
    [81, 880]
  ])('converts MIDI note %i to ~%i Hz', (midi, expectedHz) => {
    expect(midiNoteToFreq(midi)).toBeCloseTo(expectedHz, 0)
  })

  it('doubles frequency every 12 semitones (one octave)', () => {
    const c4 = midiNoteToFreq(60)
    const c5 = midiNoteToFreq(72)
    expect(c5 / c4).toBeCloseTo(2, 5)
  })

  it('returns a positive number for all valid MIDI notes', () => {
    Array.from({ length: 128 }, (_, i) => i).forEach((i) => {
      expect(midiNoteToFreq(i)).toBeGreaterThan(0)
    })
  })
})

describe('createNoteScheduler', () => {
  let mockFactory: AudioContextFactory

  beforeEach(() => {
    vi.useFakeTimers()

    const mockOscillator = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() }
    }
    const mockGain = {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      }
    }
    const mockContext = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain)
    }

    mockFactory = () => mockContext as unknown as AudioContext
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not playing', () => {
    const scheduler = createNoteScheduler(mockFactory)
    expect(scheduler.isPlaying).toBe(false)
    expect(scheduler.currentMs).toBe(0)
  })

  it('reports isPlaying after start', () => {
    const scheduler = createNoteScheduler(mockFactory)
    scheduler.start([], Date.now())
    expect(scheduler.isPlaying).toBe(true)
  })

  it('reports currentMs as elapsed wall-clock time after start', () => {
    const scheduler = createNoteScheduler(mockFactory)
    const startMs = Date.now()
    scheduler.start([], startMs)
    vi.advanceTimersByTime(500)
    expect(scheduler.currentMs).toBeCloseTo(500, -1)
  })

  it('stops and resets after stop()', () => {
    const scheduler = createNoteScheduler(mockFactory)
    scheduler.start([], Date.now())
    scheduler.stop()
    expect(scheduler.isPlaying).toBe(false)
    expect(scheduler.currentMs).toBe(0)
  })

  it('sorts notes by time before scheduling', () => {
    const scheduler = createNoteScheduler(mockFactory)
    const notes = [
      { time: 500, freq: 440, duration: 100 },
      { time: 100, freq: 220, duration: 100 },
      { time: 300, freq: 330, duration: 100 }
    ]
    expect(() => scheduler.start(notes, Date.now())).not.toThrow()
    scheduler.stop()
  })

  it('can restart after stop', () => {
    const scheduler = createNoteScheduler(mockFactory)
    scheduler.start([], Date.now())
    scheduler.stop()
    scheduler.start([], Date.now())
    expect(scheduler.isPlaying).toBe(true)
    scheduler.stop()
  })
})
