import type { ConvertRequest, ConvertResult, ConvertError } from './config'
import { isHeicBuffer } from './heic'

/**
 * `heic-to` is imported only once a HEIF brand is seen, and its `bitmap` target is the only
 * one that works here: the blob and canvas targets reach for `document`, which a worker does
 * not have, and they would re-encode the image on the way past for nothing. Keeping this in
 * the worker rather than beside `isHeicBuffer` also keeps the decoder out of the main bundle,
 * which would otherwise carry a second copy it never loads.
 */
const decodeBitmap = async (buffer: ArrayBuffer, mimeType: string): Promise<ImageBitmap> => {
  const blob = new Blob([buffer], { type: mimeType })
  if (!isHeicBuffer(buffer)) return createImageBitmap(blob)

  const { heicTo } = await import('heic-to')
  return heicTo({ blob, type: 'bitmap' })
}

const convertImage = async (request: ConvertRequest): Promise<void> => {
  const { id, buffer, mimeType, format, quality, maxWidth, maxHeight, scalePct } = request

  const bitmap = await decodeBitmap(buffer, mimeType)
  const sourceWidth = bitmap.width
  const sourceHeight = bitmap.height

  const pctScale = scalePct > 0 ? scalePct / 100 : 1
  const dimScale =
    maxWidth > 0 || maxHeight > 0
      ? Math.min(
          maxWidth > 0 ? maxWidth / bitmap.width : 1,
          maxHeight > 0 ? maxHeight / bitmap.height : 1,
          1
        )
      : 1
  const scale = pctScale * dimScale

  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2D context')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const outputBlob = await canvas.convertToBlob({
    type: format,
    quality: quality / 100
  })

  const outputBuffer = await outputBlob.arrayBuffer()

  const result: ConvertResult = {
    id,
    buffer: outputBuffer,
    format,
    originalSize: buffer.byteLength,
    convertedSize: outputBuffer.byteLength,
    sourceWidth,
    sourceHeight,
    width,
    height
  }

  self.postMessage(result, [outputBuffer])
}

self.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  try {
    await convertImage(event.data)
  } catch (error_) {
    const error: ConvertError = {
      id: event.data.id,
      error: error_ instanceof Error ? error_.message : String(error_)
    }
    self.postMessage(error)
  }
}
