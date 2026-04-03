import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import process from 'node:process'

const DEFAULT_PATH = './assets/images'
const TARGET_WIDTH = 1000
const QUALITY = 80

const trimImage = (pipeline) => pipeline.trim()

const resizeImage = (pipeline, width) =>
  pipeline.resize({
    width,
    withoutEnlargement: true
  })

const buildActionLog = ({
  formatChanged,
  wasTrimmed,
  wasResized,
  isSmaller,
  metadata,
  info,
  extension
}) => {
  const actions = []
  if (formatChanged) actions.push(`converted ${extension.toUpperCase()}→WebP`)
  if (wasTrimmed) actions.push('trimmed')
  if (wasResized) actions.push(`resized (${metadata.width}px → ${info.width}px)`)
  if (!wasTrimmed && !wasResized && isSmaller) actions.push('optimized size')
  return actions.join(', ')
}

const saveProcessedImage = async (filePath, outputPath, isWebp, data) => {
  if (isWebp) {
    const tempPath = `${filePath}.tmp`
    await fs.writeFile(tempPath, data)
    await fs.rename(tempPath, filePath)
  } else {
    await fs.writeFile(outputPath, data)
    await fs.unlink(filePath)
  }
}

async function processAndSave(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  const isWebp = extension === '.webp'
  const outputPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '.webp')
  const stats = await fs.stat(filePath)
  const originalSize = stats.size

  try {
    const image = sharp(filePath)
    const metadata = await image.metadata()

    const pipeline = resizeImage(trimImage(image), TARGET_WIDTH)
    const { data, info } = await pipeline
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true })

    const wasTrimmed = info.trimOffsetLeft < 0 || info.trimOffsetTop < 0
    const wasResized = info.width !== metadata.width || info.height !== metadata.height
    const isSmaller = info.size < originalSize
    const formatChanged = !isWebp
    const shouldSave = formatChanged || wasTrimmed || wasResized || isSmaller

    if (!shouldSave) {
      console.warn(`No changes for: ${path.basename(filePath)} (Skipped)`)
      return { changed: false }
    }

    await saveProcessedImage(filePath, outputPath, isWebp, data)

    const actionLog = buildActionLog({
      formatChanged,
      wasTrimmed,
      wasResized,
      isSmaller,
      metadata,
      info,
      extension
    })
    console.warn(`${path.basename(filePath)}: ${actionLog} (${(info.size / 1024).toFixed(1)}kb)`)
    return { changed: true }
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}:`, error.message)
    return { changed: false }
  }
}

async function main() {
  const targetDirectory = process.argv[2] || DEFAULT_PATH

  try {
    const files = await fs.readdir(targetDirectory)
    const imageFiles = files.filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f))

    if (imageFiles.length === 0) {
      console.warn('No images found.')
      return
    }

    console.warn(`Scanning ${imageFiles.length} images...`)

    const results = await Promise.all(
      imageFiles.map((file) => processAndSave(path.join(targetDirectory, file)))
    )
    const totalChanged = results.filter((r) => r.changed).length

    console.warn(`Done. Optimized ${totalChanged} images.`)
  } catch (error) {
    console.error('Fatal Error:', error.message)
  }
}

main()
