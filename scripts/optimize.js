import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import process from 'node:process';

const DEFAULT_PATH = './assets/images';
const TARGET_WIDTH = 1000;

/**
 * 1. TRIMS whitespace/transparency from around the image
 */
const trimImage = (pipeline) => {
  return pipeline.trim();
};

/**
 * 2. RESIZES the image (handles any format supported by Sharp)
 */
const resizeImage = (pipeline, width) => {
  return pipeline.resize({
    width: width,
    withoutEnlargement: true 
  });
};

/**
 * 3. CONVERTS to WebP, handles overwrite protection, and cleans up
 */
async function convertImage(pipeline, originalPath) {
  const ext = path.extname(originalPath).toLowerCase();
  const isPng = ext === '.png';
  const isWebp = ext === '.webp';

  // If it's PNG, output is .webp. 
  // If it's WebP, we use a .tmp suffix to avoid "input and output same file" error.
  let outputPath = originalPath.replace(/\.png$/i, '.webp');
  const tempPath = isWebp ? `${originalPath}.tmp` : null;
  const finalSavePath = tempPath || outputPath;

  try {
    // Save the processed image
    await pipeline.webp({ quality: 80 }).toFile(finalSavePath);

    if (isWebp) {
      // For existing webp: Replace original with the optimized temp file
      await fs.rename(tempPath, originalPath);
      console.log(`✅ Optimized WebP: ${path.basename(originalPath)}`);
    } else {
      console.log(`✅ Converted to WebP: ${path.basename(outputPath)}`);
    }

    // If the original was a PNG, delete it
    if (isPng) {
      await fs.unlink(originalPath);
      console.log(`   🗑️  Removed original PNG: ${path.basename(originalPath)}`);
    }
  } catch (err) {
    // Clean up temp file if error occurs
    if (tempPath) {
      try { await fs.unlink(tempPath); } catch (e) {
        // Ignore cleanup errors   
      }
    }
    throw new Error(`Processing failed for ${path.basename(originalPath)}: ${err.message}`);
  }
}

/**
 * MAIN: Orchestrates the process
 */
async function main() {
  const targetDir = process.argv[2] || DEFAULT_PATH;

  try {
    const files = await fs.readdir(targetDir);
    
    const imageFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ext === '.png' || ext === '.webp';
    });

    if (imageFiles.length === 0) {
      console.log('No images found to process.');
      return;
    }

    console.log(`🚀 Processing ${imageFiles.length} images in ${targetDir}...\n`);

    for (const file of imageFiles) {
      const filePath = path.join(targetDir, file);

      // Create Sharp Pipeline
      let imagePipeline = sharp(filePath);

      // Step 1: Trim
      imagePipeline = trimImage(imagePipeline);

      // Step 2: Resize
      imagePipeline = resizeImage(imagePipeline, TARGET_WIDTH);

      // Step 3: Convert, Overwrite (if webp), and Cleanup
      await convertImage(imagePipeline, filePath);
    }

    console.log('\n✨ All images optimized.');
  } catch (err) {
    console.error('\nFatal Error:', err.message);
  }
}

main();
