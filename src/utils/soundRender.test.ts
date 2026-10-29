import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SoundSlot } from '@/types/soundPanel'

const playback = vi.hoisted(() => ({
  measureRepetition: vi.fn(),
  renderToWavBytes: vi.fn()
}))
const loadDefaultStrudelPlayback = vi.hoisted(() => vi.fn())
vi.mock('@/views/Tools/StrudelEditor/strudelPlayback', () => ({ loadDefaultStrudelPlayback }))

import { normalizeWavPeak, renderStrudelSound, PEAK_TARGET } from './soundRender'

const makeWav = (samples: number[]): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true))
  return buffer
}

const readSamples = (wav: ArrayBuffer): number[] => [...new Int16Array(wav.slice(44))]

const loopSlot: SoundSlot = { id: 'theme', label: 'Theme', code: '', kind: 'loop', loopCycles: 32 }
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
