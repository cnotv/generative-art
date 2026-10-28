import sharp from 'sharp'
import type { TabImage } from '../../types'
import { buildTabImage } from './buildTabImage'

const SAMPLE_PATH =
  'src/views/Tools/StrudelEditor/transcription/tab/__fixtures__/sample-bass-tab.webp'

/**
 * Test support: the sample bass tab screenshot decoded to a tab image. Node has no canvas, so
 * sharp stands in for the browser's decoder.
 * @returns the sample as a deviation map
 */
export const loadSampleTabImage = async (): Promise<TabImage> => {
  const { data, info } = await sharp(SAMPLE_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return buildTabImage(info.width, info.height, new Uint8ClampedArray(data))
}
