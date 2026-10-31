import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SoundSlot } from '@/types/soundPanel'

const playback = vi.hoisted(() => ({
  measureRepetition: vi.fn(),
  renderToWavBytes: vi.fn()
}))
const loadDefaultStrudelPlayback = vi.hoisted(() => vi.fn())
vi.mock('@/views/Tools/StrudelEditor/strudelPlayback', () => ({ loadDefaultStrudelPlayback }))

import {
  crossfadeLoopSeam,
  normalizeWavPeak,
  renderStrudelSound,
  PEAK_TARGET,
  SEAM_CROSSFADE_SECONDS
} from './soundRender'

const makeWav = (samples: number[], sampleRate = 44100): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true))
  return buffer
}

const readSamples = (wav: ArrayBuffer): number[] => [...new Int16Array(wav.slice(44))]

const loopSlot: SoundSlot = { id: 'theme', label: 'Theme', code: '', kind: 'loop', cycles: 32 }
const onceSlot: SoundSlot = { id: 'bump', label: 'Bump', code: '', kind: 'once' }

beforeEach(() => {
  playback.measureRepetition.mockReset().mockResolvedValue(0.5)
  playback.renderToWavBytes
    .mockReset()
    .mockResolvedValue({ success: true, file: makeWav([1000, -2000]) })
  loadDefaultStrudelPlayback.mockReset().mockResolvedValue(playback)
})

describe('normalizeWavPeak', () => {
  it('scales the loudest sample to the target and keeps the shape', () => {
    const wav = normalizeWavPeak(makeWav([1000, -2000, 500]))
    const peak = PEAK_TARGET * 32767

    expect(readSamples(wav)).toEqual([
      Math.round(peak / 2),
      -Math.round(peak),
      Math.round(peak / 4)
    ])
  })

  it('leaves a silent file alone instead of dividing by zero', () => {
    expect(readSamples(normalizeWavPeak(makeWav([0, 0])))).toEqual([0, 0])
  })
})

describe('renderStrudelSound', () => {
  it('renders a loop for its own number of cycles', async () => {
    await renderStrudelSound('s("bd")', loopSlot)

    expect(playback.measureRepetition).not.toHaveBeenCalled()
    expect(playback.renderToWavBytes).toHaveBeenCalledWith(
      's("bd")',
      expect.objectContaining({ startCycle: 0, endCycle: 32 })
    )
  })

  it('renders a one-shot for one measured repetition', async () => {
    await renderStrudelSound('s("bd")', onceSlot)

    expect(playback.renderToWavBytes).toHaveBeenCalledWith(
      's("bd")',
      expect.objectContaining({ startCycle: 0, endCycle: 0.5 })
    )
  })

  it('renders a one-shot for its own number of cycles instead of measuring, to keep a tail', async () => {
    await renderStrudelSound('s("bd")', { ...onceSlot, cycles: 2 })

    expect(playback.measureRepetition).not.toHaveBeenCalled()
    expect(playback.renderToWavBytes).toHaveBeenCalledWith(
      's("bd")',
      expect.objectContaining({ endCycle: 2 })
    )
  })

  it('returns the rendered file at a normal level', async () => {
    const wav = await renderStrudelSound('s("bd")', onceSlot)

    expect(Math.max(...readSamples(wav).map(Math.abs))).toBe(Math.round(PEAK_TARGET * 32767))
  })

  it('throws the Strudel error message when the code does not run', async () => {
    playback.renderToWavBytes.mockResolvedValue({
      success: false,
      errorMessage: 'bd is not defined'
    })

    await expect(renderStrudelSound('bd', onceSlot)).rejects.toThrow('bd is not defined')
  })

  it('loads the engine once and reuses it', async () => {
    vi.resetModules()
    const fresh = await import('./soundRender')

    await fresh.renderStrudelSound('a', onceSlot)
    await fresh.renderStrudelSound('b', onceSlot)

    expect(loadDefaultStrudelPlayback).toHaveBeenCalledTimes(1)
  })
})

describe('crossfadeLoopSeam', () => {
  const sampleRate = 1000
  const fade = Math.round(SEAM_CROSSFADE_SECONDS * sampleRate)
  const ramp = Array.from({ length: 200 }, (_, index) => index * 100)

  it('shortens the loop by the length of the crossfade', () => {
    const faded = crossfadeLoopSeam(makeWav(ramp, sampleRate))

    expect(readSamples(faded)).toHaveLength(ramp.length - fade)
  })

  it('leaves the middle of the sound untouched', () => {
    const samples = readSamples(crossfadeLoopSeam(makeWav(ramp, sampleRate)))

    expect(samples.slice(fade)).toEqual(ramp.slice(fade, ramp.length - fade))
  })

  it('starts on the old tail and ends on the old head, so the repeat has no step', () => {
    const samples = readSamples(crossfadeLoopSeam(makeWav(ramp, sampleRate)))

    expect(samples[0]).toBe(ramp[ramp.length - fade])
    expect(Math.abs(samples[fade - 1] - ramp[fade - 1])).toBeLessThan(150)
  })

  it('keeps the header consistent with the shorter data', () => {
    const faded = crossfadeLoopSeam(makeWav(ramp, sampleRate))
    const view = new DataView(faded)

    expect(view.getUint32(40, true)).toBe((ramp.length - fade) * 2)
    expect(view.getUint32(4, true)).toBe(36 + (ramp.length - fade) * 2)
  })

  it('returns a file too short to hold two fades unchanged', () => {
    const short = makeWav([1, 2, 3], sampleRate)

    expect(readSamples(crossfadeLoopSeam(short))).toEqual([1, 2, 3])
  })
})

describe('renderStrudelSound seam', () => {
  it('crossfades the seam of a loop that asks for it, and only that loop', async () => {
    const long = makeWav(
      Array.from({ length: 4000 }, (_, index) => (index % 50) * 100),
      44100
    )
    playback.renderToWavBytes.mockResolvedValue({ success: true, file: long })
    const plain = await renderStrudelSound('a', loopSlot)
    const seamless = await renderStrudelSound('a', { ...loopSlot, crossfadeSeam: true })

    expect(readSamples(seamless).length).toBeLessThan(readSamples(plain).length)
  })
})
