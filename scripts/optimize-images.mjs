import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const roots = ["attached_assets", "public", "client/public"];
const supportedExtensions = new Set([".png", ".jpg", ".jpeg"]);
const maxWidth = 1200;
const quality = 78;

async function collectImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectImages(fullPath));
    } else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function optimizeImage(sourcePath) {
  const extension = path.extname(sourcePath);
  const outputPath = sourcePath.slice(0, -extension.length) + ".optimized.webp";
  const [sourceStats, outputStats] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(outputPath).catch(() => null),
  ]);

  if (outputStats && outputStats.mtimeMs >= sourceStats.mtimeMs) {
    return { skipped: true, sourceBytes: sourceStats.size, outputBytes: outputStats.size };
  }

  await sharp(sourcePath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(outputPath);

  const optimizedStats = await fs.stat(outputPath);
  return { skipped: false, sourceBytes: sourceStats.size, outputBytes: optimizedStats.size };
}

let sourceTotal = 0;
let outputTotal = 0;
let optimizedCount = 0;
let skippedCount = 0;

for (const root of roots) {
  const images = await collectImages(root);
  for (const image of images) {
    try {
      const result = await optimizeImage(image);
      sourceTotal += result.sourceBytes;
      outputTotal += result.outputBytes;
      if (result.skipped) skippedCount += 1;
      else optimizedCount += 1;
    } catch (error) {
      console.warn(`[image-optimization] Skipped ${image}: ${error.message}`);
    }
  }
}

const saved = sourceTotal > 0 ? Math.round((1 - outputTotal / sourceTotal) * 100) : 0;
console.log(
  `[image-optimization] ${optimizedCount} generated, ${skippedCount} reused; ` +
  `${(sourceTotal / 1024 / 1024).toFixed(1)}MB source → ` +
  `${(outputTotal / 1024 / 1024).toFixed(1)}MB WebP (${saved}% smaller)`,
);