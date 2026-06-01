import fs from 'fs/promises';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function timestamp() {
  return new Date().toISOString();
}

export function getImagesDir() {
  return process.env.IMAGES_DIR || 'D:\\job';
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectImages(dir, results = []) {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectImages(fullPath, results);
      continue;
    }

    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Load all product images from IMAGES_DIR (recursive).
 * @returns {Promise<string[]>}
 */
export async function getImagePool() {
  const imagesDir = getImagesDir();

  if (!(await pathExists(imagesDir))) {
    throw new Error(`Images directory not found: ${imagesDir}`);
  }

  const images = await collectImages(imagesDir);
  images.sort((a, b) => a.localeCompare(b));

  if (images.length === 0) {
    throw new Error(`No images found in ${imagesDir}`);
  }

  return images;
}

/**
 * Pick an image, avoiding recently used paths when possible.
 * @param {string[]} recentlyUsed - Image paths used in recent posts (newest first)
 * @returns {Promise<{ imagePath: string, poolSize: number }>}
 */
export async function selectImage(recentlyUsed = []) {
  const pool = await getImagePool();
  const usedSet = new Set(recentlyUsed.filter(Boolean));
  const available = pool.filter((imagePath) => !usedSet.has(imagePath));
  const candidates = available.length > 0 ? available : pool;
  const index = Math.floor(Math.random() * candidates.length);

  return {
    imagePath: candidates[index],
    poolSize: pool.length,
  };
}

export function logImageSelection(imagePath, poolSize, log = console.log) {
  log(`[${timestamp()}] Selected image: ${imagePath} (pool: ${poolSize})`);
}
