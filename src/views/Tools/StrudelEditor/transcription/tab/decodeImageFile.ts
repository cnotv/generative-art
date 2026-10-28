import { TAB_IMAGE_MAX_PIXELS } from '../../config'
import type { TabImageRequest } from '../../types'

/**
 * Decodes a screenshot to RGBA pixels on the main thread, where the browser's image decoder and
 * canvas live, so the analysis in the worker only ever sees plain numbers.
 * @param imageFile - the uploaded PNG, JPEG or WebP
 * @returns the width, height and pixels
 */
export const decodeImageFile = async (
  imageFile: File
): Promise<Omit<TabImageRequest, 'openStrings'>> => {
  const bitmap = await createImageBitmap(imageFile)
  const { width, height } = bitmap
  if (width * height > TAB_IMAGE_MAX_PIXELS) {
    bitmap.close()
    throw new Error('The image is too large to read; crop it to the tab')
  }
  const context = new OffscreenCanvas(width, height).getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new Error('The image could not be read in this browser')
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { width, height, pixels: context.getImageData(0, 0, width, height).data }
}
