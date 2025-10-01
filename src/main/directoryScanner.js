const fs = require('fs').promises;
const path = require('path');
const { pathToFileURL } = require('url');

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.heic',
  '.heif',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.wmv',
  '.flv',
]);

const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

function detectMediaType(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }
  return 'other';
}

async function collectLeafDirectories(rootPath) {
  const normalizedRoot = path.resolve(rootPath);
  const leaves = await walkDirectory(normalizedRoot, normalizedRoot);
  return leaves.filter((leaf) => leaf.mediaFiles.length > 0);
}

async function walkDirectory(currentPath, rootPath) {
  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    console.warn('Failed to read directory', currentPath, error);
    return [];
  }

  const files = [];
  const subdirectories = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subdirectories.push(entry);
    } else if (entry.isFile()) {
      files.push(entry);
    }
  }

  if (files.length === 0 && subdirectories.length === 1) {
    const nextPath = path.join(currentPath, subdirectories[0].name);
    return walkDirectory(nextPath, rootPath);
  }

  const result = [];

  if (files.length > 0) {
    const mediaFiles = files
      .map((file) => {
        const absolutePath = path.join(currentPath, file.name);
        const extension = path.extname(file.name).toLowerCase();
        const type = detectMediaType(extension);
        return {
          name: file.name,
          path: absolutePath,
          fileUrl: pathToFileURL(absolutePath).href,
          type,
        };
      })
      .filter((file) => MEDIA_EXTENSIONS.has(path.extname(file.name).toLowerCase()));

    if (mediaFiles.length > 0) {
      const relativePath = path.relative(rootPath, currentPath);
      const displayPath = relativePath === '' ? '.' : relativePath;
      result.push({
        path: currentPath,
        displayPath,
        mediaFiles,
      });
    }
  }

  for (const subdirectory of subdirectories) {
    const childPath = path.join(currentPath, subdirectory.name);
    const childLeaves = await walkDirectory(childPath, rootPath);
    result.push(...childLeaves);
  }

  return result;
}

module.exports = {
  collectLeafDirectories,
};
