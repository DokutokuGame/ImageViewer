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
  return leaves.filter((leaf) => leaf.mediaFileCount > 0);
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
    const mediaFileCount = files.reduce((count, file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (MEDIA_EXTENSIONS.has(extension)) {
        return count + 1;
      }
      return count;
    }, 0);

    if (mediaFileCount > 0) {
      const relativePath = path.relative(rootPath, currentPath);
      const displayPath = relativePath === '' ? '.' : relativePath;
      result.push({
        path: currentPath,
        displayPath,
        mediaFileCount,
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

function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  const normalizedFallback = Number.isFinite(fallback)
    ? Math.max(Math.floor(fallback), 0)
    : 0;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return normalizedFallback;
  }
  return Math.floor(parsed);
}

async function listMediaFiles(directoryPath, options = {}) {
  if (!directoryPath) {
    return {
      files: [],
      total: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
    };
  }

  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    console.warn('Failed to read directory', directoryPath, error);
    return {
      files: [],
      total: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const mediaFiles = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(extension)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    const type = detectMediaType(extension);
    mediaFiles.push({
      name: entry.name,
      path: absolutePath,
      fileUrl: pathToFileURL(absolutePath).href,
      type,
    });
  }

  const total = mediaFiles.length;
  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit, total - offset);
  const start = Math.min(offset, total);
  const end = limit > 0 ? Math.min(start + limit, total) : total;
  const slice = mediaFiles.slice(start, end);

  return {
    files: slice,
    total,
    offset: start,
    nextOffset: end,
    hasMore: end < total,
  };
}

module.exports = {
  collectLeafDirectories,
  listMediaFiles,
};
