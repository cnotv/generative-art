import { TAB_BACKGROUND_SAMPLE_STRIDE, TAB_LUMINANCE_WEIGHTS } from '../../config'
import type { TabImage } from '../../types'
import { medianOf } from './imageProbes'

const CHANNELS_PER_PIXEL = 4

const luminanceAt = (pixels: Uint8ClampedArray, pixelIndex: number): number =>
  TAB_LUMINANCE_WEIGHTS.red * pixels[pixelIndex * CHANNELS_PER_PIXEL] +
  TAB_LUMINANCE_WEIGHTS.green * pixels[pixelIndex * CHANNELS_PER_PIXEL + 1] +
  TAB_LUMINANCE_WEIGHTS.blue * pixels[pixelIndex * CHANNELS_PER_PIXEL + 2]

/**
 * Turns RGBA pixels into distance from the page colour, taken as the median luminance. A dark
 * theme with light ink and a light theme with dark ink then look the same to every detector.
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @param pixels - RGBA bytes, row by row
 * @returns the deviation map
 */
export const buildTabImage = (
  width: number,
  height: number,
  pixels: Uint8ClampedArray
): TabImage => {
  const luminance = Float32Array.from({ length: width * height }, (_, pixelIndex) =>
    luminanceAt(pixels, pixelIndex)
  )
  const background = medianOf([
    ...luminance.filter((_, pixelIndex) => pixelIndex % TAB_BACKGROUND_SAMPLE_STRIDE === 0)
  ])
  return {
    width,
    height,
    deviation: Uint8Array.from(luminance, (value) => Math.min(255, Math.abs(value - background)))
  }
}
