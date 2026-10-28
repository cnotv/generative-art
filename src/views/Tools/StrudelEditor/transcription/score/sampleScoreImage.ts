import sharp from 'sharp'
import type { TabImage } from '../../types'
import { buildTabImage } from '../tab/buildTabImage'

const SAMPLE_PATH =
  'src/views/Tools/StrudelEditor/transcription/score/__fixtures__/sample-piano-score.webp'

/**
 * Test support: the sample piano score decoded to an image. Node has no canvas, so sharp stands
 * in for the browser's decoder.
 * @returns the sample as a deviation map
 */
export const loadSampleScoreImage = async (): Promise<TabImage> => {
  const { data, info } = await sharp(SAMPLE_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return buildTabImage(info.width, info.height, new Uint8ClampedArray(data))
}
