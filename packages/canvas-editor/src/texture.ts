const OPTIMIZE_MAX_WIDTH = 1000

/**
 * Load an image from a URL or data URL into an HTMLImageElement.
 * @param src - Image URL or data URL
 * @returns Promise resolving to the loaded image element
 */
export const textureLoadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/**
 * Compute display dimensions capped at OPTIMIZE_MAX_WIDTH.
 * @param img - Source image element
 * @returns Object with width and height in pixels
 */
export const textureResizeToMaxWidth = (
  img: HTMLImageElement
): { width: number; height: number } => {
  const scale = img.width > OPTIMIZE_MAX_WIDTH ? OPTIMIZE_MAX_WIDTH / img.width : 1
  return { width: Math.round(img.width * scale), height: Math.round(img.height * scale) }
}

/**
 * Build a combined front/back texture atlas on a single canvas.
 * The front image occupies the left half, the back (mirror-flipped) the right half.
 * @param frontUrl - URL or data URL for the front-facing texture
 * @param backUrl - URL or data URL for the back-facing texture, or null to mirror the front
 * @returns Promise resolving to the composite canvas element
 */
export const textureBuildCombined = async (
  frontUrl: string,
  backUrl: string | null
): Promise<HTMLCanvasElement> => {
  const frontImg = await textureLoadImage(frontUrl)
  const backImg = backUrl ? await textureLoadImage(backUrl) : frontImg

  const frontSize = textureResizeToMaxWidth(frontImg)
  const backSize = textureResizeToMaxWidth(backImg)
  const halfWidth = Math.max(frontSize.width, backSize.width)
  const height = Math.max(frontSize.height, backSize.height)

  const canvas = document.createElement('canvas')
  canvas.width = halfWidth * 2
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(frontImg, 0, 0, halfWidth, height)

  ctx.save()
  ctx.translate(halfWidth * 2, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(backImg, 0, 0, halfWidth, height)
  ctx.restore()

  return canvas
}

/**
 * Convert a canvas element to a data URL.
 * @param canvas - Source canvas
 * @param type - MIME type (default: image/png)
 * @returns Data URL string
 */
export const textureToDataUrl = (canvas: HTMLCanvasElement, type = 'image/png'): string =>
  canvas.toDataURL(type)
