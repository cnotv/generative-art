import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import process from 'node:process';

const DEFAULT_PATH = './assets/images';
const TARGET_WIDTH = 1000;
const QUALITY = 80;

/**
 * 1. TRIMS whitespace/transparency
 */
const trimImage = (pipeline) => pipeline.trim();

/**
 * 2. RESIZES the image (maintains aspect ratio)
 */
const resizeImage = (pipeline, width) => pipeline.resize({
  width,
  withoutEnlargement: true,
});

/**
 * 3. PROCESS & SAVE: Checks if changes occurred before overriding
 */
async function processAndSave(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const isWebp = ext === '.webp';

  const outputPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Setup pipeline
    let pipeline = image;
    pipeline = trimImage(pipeline);
    pipeline = resizeImage(pipeline, TARGET_WIDTH);

    // Get processed data without saving yet to check for changes
    const { data, info } = await pipeline
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true });

    // --- CHANGE TRACKING LOGIC ---
    const wasTrimmed = info.trimOffsetLeft < 0 || info.trimOffsetTop < 0;
    const wasResized = info.width !== metadata.width || info.height !== metadata.height;
    const isSmaller = info.size < originalSize;
    const formatChanged = !isWebp;

    // Decision: Should we save?
    // 1. Format changed (PNG/JPG -> WebP)
    // 2. Visual change occurred (Trimmed or Resized)
    // 3. It's already WebP but we managed to make the file size smaller
    const shouldSave = formatChanged || wasTrimmed || wasResized || isSmaller;

    if (!shouldSave) {
      console.log(`➖ No changes for: ${path.basename(filePath)} (Skipped)`);
      return { changed: false };
    }

    // Save to final path
    // If it's an existing WebP, Sharp can't write to same file, so we overwrite manually
    if (isWebp) {
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, data);
      await fs.rename(tempPath, filePath);
    } else {
      await fs.writeFile(outputPath, data);
      await fs.unlink(filePath); // Remove original PNG/JPG
    }

    // Log details
    const actions = [];
    if (formatChanged) actions.push(`converted ${ext.toUpperCase()}→WebP`);
    if (wasTrimmed) actions.push('trimmed');
    if (wasResized) actions.push(`resized (${metadata.width}px → ${info.width}px)`);
    if (!wasTrimmed && !wasResized && isSmaller) actions.push('optimized size');

    console.log(`✅ ${path.basename(filePath)}: ${actions.join(', ')} (${(info.size / 1024).toFixed(1)}kb)`);
    return { changed: true };

  } catch (err) {
    console.error(`❌ Error processing ${path.basename(filePath)}:`, err.message);
    return { changed: false };
  }
}

async function main() {
  const targetDir = process.argv[2] || DEFAULT_PATH;

  try {
    const files = await fs.readdir(targetDir);
    const imageFiles = files.filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f));

    if (imageFiles.length === 0) {
      console.log('No images found.');
      return;
    }

    console.log(`🚀 Scanning ${imageFiles.length} images...\n`);

    let totalChanged = 0;
    for (const file of imageFiles) {
      const result = await processAndSave(path.join(targetDir, file));
      if (result.changed) totalChanged++;
    }

    console.log(`\n✨ Done. Optimized ${totalChanged} images.`);
  } catch (err) {
    console.error('\nFatal Error:', err.message);
  }
}

main();
