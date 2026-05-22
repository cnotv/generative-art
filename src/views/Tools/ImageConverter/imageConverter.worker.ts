import type { ConvertRequest, ConvertResult, ConvertError } from './config'

const convertImage = async (request: ConvertRequest): Promise<void> => {
  const { id, buffer, mimeType, format, quality, maxWidth, maxHeight } = request

  const blob = new Blob([buffer], { type: mimeType })
  const bitmap = await createImageBitmap(blob)

  const scale =
    maxWidth > 0 || maxHeight > 0
      ? Math.min(
          maxWidth > 0 ? maxWidth / bitmap.width : 1,
          maxHeight > 0 ? maxHeight / bitmap.height : 1,
          1
        )
      : 1

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
    convertedSize: outputBuffer.byteLength
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
