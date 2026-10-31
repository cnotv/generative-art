import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const AUDIO_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/audio/rockrunner'
)
const STEREO_16_BIT_FRAME_BYTES = 4
const FULL_SCALE = 32768
const AUDIBLE_LEVEL = 0.001

const readLeftChannel = (fileName: string): number[] => {
  const wav = readFileSync(resolve(AUDIO_DIRECTORY, fileName))
  const samplesStart = wav.indexOf('data') + 8
  const frameCount = Math.floor((wav.length - samplesStart) / STEREO_16_BIT_FRAME_BYTES)
  return Array.from(
    { length: frameCount },
    (_, frame) => wav.readInt16LE(samplesStart + frame * STEREO_16_BIT_FRAME_BYTES) / FULL_SCALE
  )
}

describe('RockRunner audio files', () => {
  it('roll.wav repeats without a step larger than any inside the file', () => {
    const samples = readLeftChannel('roll.wav')

    const seamStep = Math.abs(samples[0] - samples[samples.length - 1])
    const largestInnerStep = samples
      .slice(1)
      .reduce((largest, sample, index) => Math.max(largest, Math.abs(sample - samples[index])), 0)

    expect(seamStep).toBeLessThanOrEqual(largestInnerStep)
  })

  it('finish.wav decays to silence instead of stopping', () => {
    const samples = readLeftChannel('finish.wav')

    const lastSample = Math.abs(samples[samples.length - 1])

    expect(lastSample).toBeLessThan(AUDIBLE_LEVEL)
  })
})
