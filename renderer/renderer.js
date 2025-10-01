const directoryListEl = document.getElementById('directory-list');
const mediaGridEl = document.getElementById('media-grid');
const currentRootEl = document.getElementById('current-root');
const mediaHeadingEl = document.getElementById('media-heading');
const mediaCountEl = document.getElementById('media-count');
const selectRootButton = document.getElementById('select-root');
const openDirectoryButton = document.getElementById('open-directory');
const tagListEl = document.getElementById('tag-list');
const filterTagListEl = document.getElementById('filter-tag-list');
const mediaApi = window.mediaApi;

const MIN_TAG_OCCURRENCE = 2;
const MEDIA_RENDER_BATCH_SIZE = 12;

let currentState = {
  root: null,
  leaves: [],
  selectedPath: null,
  savedTags: [],
  derivedTags: [],
  activeTag: null,
  keywordIndex: {},
};

let mediaRenderAbortController = null;
const imageLoader = createImageLoader();

if (imageLoader?.dispose) {
  window.addEventListener('beforeunload', () => {
    imageLoader.dispose();
  });
}

render();

if (openDirectoryButton) {
  openDirectoryButton.addEventListener('click', () => {
    const path = openDirectoryButton.dataset.path;
    if (path) {
      void openDirectoryInExplorer(path);
    }
  });
  updateOpenDirectoryButton(null);
}

if (mediaApi?.getRootTags) {
  mediaApi
    .getRootTags()
    .then((tags) => {
      if (Array.isArray(tags)) {
        updateState({ savedTags: tags });
      }
    })
    .catch((error) => {
      console.error('Failed to load saved directories', error);
    });
}

if (!mediaApi?.selectRoot) {
  selectRootButton.disabled = true;
  selectRootButton.textContent = '选择目录（不可用）';
  console.warn('mediaApi.selectRoot is unavailable.');
} else {
  selectRootButton.addEventListener('click', async () => {
    const result = await mediaApi.selectRoot();
    if (!result) {
      return;
    }
    updateState({
      root: result.root,
      leaves: result.leaves,
      selectedPath: result.leaves?.[0]?.path ?? null,
      savedTags: Array.isArray(result.tags) ? result.tags : currentState.savedTags,
      activeTag: null,
    });
  });
}

function updateState(patch) {
  const nextState = { ...currentState, ...patch };

  if ('leaves' in patch && !Array.isArray(nextState.leaves)) {
    nextState.leaves = [];
  }

  if ('leaves' in patch) {
    const { tags, keywordIndex } = buildDerivedTags(nextState.leaves);
    nextState.derivedTags = tags;
    nextState.keywordIndex = keywordIndex;
  }

  if ('savedTags' in patch && !Array.isArray(nextState.savedTags)) {
    nextState.savedTags = [];
  }

  currentState = nextState;
  ensureSelection();
  render();
}

function render() {
  renderRoot();
  renderSavedTags();
  renderTagFilters();
  renderDirectoryList();
  renderMedia();
}

function renderRoot() {
  if (!currentState.root) {
    currentRootEl.textContent = '尚未选择目录';
  } else {
    currentRootEl.textContent = currentState.root;
  }
}

function renderSavedTags() {
  if (!tagListEl) {
    return;
  }

  tagListEl.innerHTML = '';

  if (!currentState.savedTags.length) {
    const empty = document.createElement('span');
    empty.className = 'tag-empty';
    empty.textContent = mediaApi?.getRootTags
      ? '尚未保存任何目录。'
      : '无法获取已保存的目录。';
    tagListEl.appendChild(empty);
    return;
  }

  currentState.savedTags.forEach((tag) => {
    const label = formatSavedTagLabel(tag);

    const listItem = document.createElement('li');
    listItem.className = 'tag-item';

    const tagButton = document.createElement('button');
    tagButton.className = 'tag-button';
    tagButton.type = 'button';
    tagButton.textContent = label;
    tagButton.title = tag.path;
    tagButton.addEventListener('click', () => handleSavedTagSelection(tag));

    const removeButton = document.createElement('button');
    removeButton.className = 'tag-remove-button';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `移除 ${label}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', (event) =>
      handleSavedTagRemoval(event, tag, label)
    );

    listItem.appendChild(tagButton);
    listItem.appendChild(removeButton);
    tagListEl.appendChild(listItem);
  });
}

function renderTagFilters() {
  if (!filterTagListEl) {
    return;
  }

  filterTagListEl.innerHTML = '';

  if (!currentState.leaves.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-tag-empty';
    empty.textContent = '选择目录后会自动生成标签。';
    filterTagListEl.appendChild(empty);
    return;
  }

  if (!currentState.derivedTags.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-tag-empty';
    empty.textContent = '未发现重复关键词，暂无法生成标签。';
    filterTagListEl.appendChild(empty);
    return;
  }

  const allButton = createFilterButton('全部', null, currentState.activeTag == null);
  filterTagListEl.appendChild(allButton);

  currentState.derivedTags.forEach((tag) => {
    const button = createFilterButton(
      `${tag.label} (${tag.count})`,
      tag.id,
      currentState.activeTag === tag.id
    );
    filterTagListEl.appendChild(button);
  });
}

function createFilterButton(label, tagId, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-tag-button';
  if (isActive) {
    button.classList.add('active');
  }
  button.textContent = label;
  button.addEventListener('click', () => {
    if (tagId == null) {
      updateState({ activeTag: null });
      return;
    }
    if (currentState.activeTag === tagId) {
      updateState({ activeTag: null });
    } else {
      updateState({ activeTag: tagId });
    }
  });
  return button;
}

function renderDirectoryList() {
  directoryListEl.innerHTML = '';
  const visibleLeaves = getVisibleLeaves();

  if (!visibleLeaves.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    if (currentState.activeTag) {
      const label = getActiveTagLabel();
      emptyMessage.textContent = label
        ? `没有找到与标签“${label}”匹配的文件夹。`
        : '没有找到匹配所选标签的文件夹。';
    } else {
      emptyMessage.textContent = currentState.root
        ? '所选目录中没有媒体文件。'
        : '请选择一个目录开始。';
    }
    directoryListEl.appendChild(emptyMessage);
    return;
  }

  visibleLeaves.forEach((leaf) => {
    const item = document.createElement('li');
    item.className = 'directory-item';
    if (leaf.path === currentState.selectedPath) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      updateState({ selectedPath: leaf.path });
    });

    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      void openDirectoryInExplorer(leaf.path);
    });

    item.title = '右键可在系统文件管理器中打开该目录';

    const name = document.createElement('span');
    name.className = 'directory-name';
    name.textContent = leaf.displayPath;

    const count = document.createElement('span');
    count.className = 'media-meta';
    count.textContent = `${leaf.mediaFiles.length}`;

    item.appendChild(name);
    item.appendChild(count);

    directoryListEl.appendChild(item);
  });
}

function updateOpenDirectoryButton(leaf) {
  if (!openDirectoryButton) {
    return;
  }

  if (leaf?.path) {
    openDirectoryButton.disabled = false;
    openDirectoryButton.dataset.path = leaf.path;
    openDirectoryButton.title = leaf.path;
    openDirectoryButton.setAttribute(
      'aria-label',
      `在资源管理器中打开 ${leaf.displayPath || leaf.path}`
    );
  } else {
    openDirectoryButton.disabled = true;
    delete openDirectoryButton.dataset.path;
    openDirectoryButton.removeAttribute('aria-label');
    openDirectoryButton.removeAttribute('title');
  }
}

async function openDirectoryInExplorer(directoryPath) {
  if (!directoryPath) {
    return;
  }

  if (mediaApi?.openDirectory) {
    try {
      const result = await mediaApi.openDirectory(directoryPath);
      if (result && result.success === false) {
        throw new Error(result.error || '无法打开目录');
      }
      return;
    } catch (error) {
      console.error('Failed to open directory', error);
      window.alert('无法在系统文件管理器中打开该目录，请确认路径是否存在。');
      return;
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(directoryPath);
      window.alert(`已复制目录路径：\n${directoryPath}`);
    } else {
      window.prompt('请复制目录路径：', directoryPath);
    }
  } catch (error) {
    console.error('Failed to copy directory path', error);
    window.prompt('请复制目录路径：', directoryPath);
  }
}

function formatSavedTagLabel(tag) {
  if (tag?.label && typeof tag.label === 'string' && tag.label.trim()) {
    return tag.label.trim();
  }
  if (tag?.path && typeof tag.path === 'string') {
    const segments = tag.path.split(/[\\/]+/).filter(Boolean);
    const lastSegment = segments.length ? segments[segments.length - 1] : '';
    return lastSegment || tag.path;
  }
  return '已保存的目录';
}

async function handleSavedTagSelection(tag) {
  if (!mediaApi?.scanDirectory) {
    return;
  }
  try {
    const leaves = await mediaApi.scanDirectory(tag.path);
    updateState({
      root: tag.path,
      leaves,
      selectedPath: leaves?.[0]?.path ?? null,
      activeTag: null,
    });
  } catch (error) {
    console.error('Failed to load directory from tag', error);
  }
}

async function handleSavedTagRemoval(event, tag, label) {
  event.preventDefault();
  event.stopPropagation();
  if (!mediaApi?.removeRootTag) {
    return;
  }

  const confirmed = window.confirm(`要移除已保存的目录“${label}”吗？`);
  if (!confirmed) {
    return;
  }

  try {
    const tags = await mediaApi.removeRootTag(tag.path);
    updateState({ savedTags: tags });
  } catch (error) {
    console.error('Failed to remove saved directory', error);
  }
}

function renderMedia() {
  if (mediaRenderAbortController) {
    mediaRenderAbortController.abort();
  }
  mediaRenderAbortController = null;
  delete mediaGridEl.dataset.loading;
  mediaGridEl.innerHTML = '';

  updateOpenDirectoryButton(null);

  if (!currentState.selectedPath) {
    mediaHeadingEl.textContent = '媒体';
    mediaCountEl.textContent = '';
    return;
  }

  const leaf = currentState.leaves.find((item) => item.path === currentState.selectedPath);
  if (!leaf) {
    mediaHeadingEl.textContent = '媒体';
    mediaCountEl.textContent = '';
    return;
  }

  updateOpenDirectoryButton(leaf);

  mediaHeadingEl.textContent = leaf.displayPath;
  mediaCountEl.textContent = `${leaf.mediaFiles.length} 个项目`;

  if (!leaf.mediaFiles.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = '该文件夹中没有媒体文件。';
    mediaGridEl.appendChild(emptyMessage);
    return;
  }

  startMediaRender(leaf.mediaFiles);
}

function extractKeywords(name) {
  if (!name) {
    return [];
  }

  const pattern = /(?:[⭐]+|[\p{Script=Han}\p{L}\p{N}]+)/gu;
  const matches = name.match(pattern) || [];

  const normalized = matches
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^⭐+$/u.test(token)) {
        return token;
      }
      return token.toLowerCase();
    })
    .filter((token) => {
      if (/^⭐+$/u.test(token)) {
        return true;
      }
      return token.length > 1;
    });

  return Array.from(new Set(normalized));
}

function humanizeKeyword(keyword) {
  if (/^⭐+$/u.test(keyword)) {
    return keyword;
  }
  if (/^[\p{Script=Han}]+$/u.test(keyword)) {
    return keyword;
  }
  return keyword.replace(/(^|\s|[-_])(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function getLeafName(leaf) {
  if (!leaf || typeof leaf.displayPath !== 'string') {
    return '';
  }
  const segments = leaf.displayPath.split(/[\\/]+/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : leaf.displayPath;
}

function buildDerivedTags(leaves) {
  const keywordIndex = {};
  const buckets = new Map();

  const safeLeaves = Array.isArray(leaves) ? leaves : [];

  for (const leaf of safeLeaves) {
    const name = getLeafName(leaf);
    const keywords = extractKeywords(name);
    keywordIndex[leaf.path] = keywords;

    for (const keyword of keywords) {
      const bucket = buckets.get(keyword) ?? {
        id: keyword,
        label: humanizeKeyword(keyword),
        count: 0,
      };
      bucket.count += 1;
      buckets.set(keyword, bucket);
    }
  }

  const tags = Array.from(buckets.values())
    .filter((bucket) => bucket.count >= MIN_TAG_OCCURRENCE)
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, 'zh-Hans');
    });

  return { tags, keywordIndex };
}

function getVisibleLeaves() {
  if (!currentState.activeTag) {
    return currentState.leaves;
  }
  return currentState.leaves.filter((leaf) => {
    const keywords = currentState.keywordIndex[leaf.path] || [];
    return keywords.includes(currentState.activeTag);
  });
}

function ensureSelection() {
  const visibleLeaves = getVisibleLeaves();
  if (!visibleLeaves.length) {
    currentState.selectedPath = null;
    return;
  }
  if (!currentState.selectedPath) {
    currentState.selectedPath = visibleLeaves[0].path;
    return;
  }
  const exists = visibleLeaves.some((leaf) => leaf.path === currentState.selectedPath);
  if (!exists) {
    currentState.selectedPath = visibleLeaves[0].path;
  }
}

function getActiveTagLabel() {
  if (!currentState.activeTag) {
    return '';
  }
  const tag = currentState.derivedTags.find((item) => item.id === currentState.activeTag);
  return tag ? tag.label : currentState.activeTag;
}

function startMediaRender(files) {
  const controller = new AbortController();
  mediaRenderAbortController = controller;
  mediaGridEl.dataset.loading = 'true';

  renderMediaIncrementally(files, controller.signal)
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.error('Failed to render media items', error);
      }
    })
    .finally(() => {
      if (mediaRenderAbortController === controller) {
        delete mediaGridEl.dataset.loading;
        mediaRenderAbortController = null;
      }
    });
}

async function renderMediaIncrementally(files, signal) {
  const queue = Array.isArray(files) ? files.slice() : [];

  while (queue.length && !signal.aborted) {
    const fragment = document.createDocumentFragment();
    let count = 0;

    while (queue.length && count < MEDIA_RENDER_BATCH_SIZE && !signal.aborted) {
      const file = queue.shift();
      fragment.appendChild(createMediaCard(file, signal));
      count += 1;
    }

    mediaGridEl.appendChild(fragment);

    if (queue.length && !signal.aborted) {
      await waitForNextFrame();
    }
  }
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve());
      return;
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 16);
  });
}

function createMediaCard(file, signal) {
  const card = document.createElement('article');
  card.className = 'media-card';
  if (file?.path) {
    card.addEventListener('click', () => mediaApi?.openFile?.(file.path));
  }

  const resolvedUrl = file?.fileUrl || (file?.path ? `file://${encodeURI(file.path)}` : '');

  let thumb;
  if (file?.type === 'image') {
    thumb = document.createElement('canvas');
    thumb.className = 'media-thumb media-thumb-image';
    thumb.style.aspectRatio = '4 / 3';
    thumb.style.width = '100%';
    if (resolvedUrl) {
      loadImageThumbnail(thumb, resolvedUrl, signal);
    }
  } else {
    thumb = document.createElement('video');
    if (resolvedUrl) {
      thumb.src = resolvedUrl;
    }
    thumb.preload = 'metadata';
    thumb.muted = true;
    thumb.playsInline = true;
    thumb.addEventListener('loadedmetadata', () => {
      try {
        thumb.currentTime = 0.1;
      } catch (error) {
        if (file?.path) {
          console.warn('Failed to set preview frame for video', file.path, error);
        }
      }
    });
    thumb.addEventListener('seeked', () => {
      thumb.pause();
    });
  }
  if (!thumb.className) {
    thumb.className = 'media-thumb';
  }

  if (file?.type === 'video') {
    const badge = document.createElement('span');
    badge.className = 'media-badge media-badge-video';
    badge.textContent = '🎬';
    badge.title = '视频';
    badge.setAttribute('aria-hidden', 'true');
    card.appendChild(badge);
  }

  const info = document.createElement('div');
  info.className = 'media-info';

  const name = document.createElement('span');
  name.className = 'media-name';
  name.textContent = file?.name ?? '';

  const meta = document.createElement('span');
  meta.className = 'media-meta';
  if (file?.type === 'video') {
    meta.textContent = '视频';
  } else if (file?.type === 'image') {
    meta.textContent = '图片';
  } else {
    meta.textContent = String(file?.type ?? '').toUpperCase() || '媒体';
  }

  info.appendChild(name);
  info.appendChild(meta);

  const ratingValue = file?.rating ?? file?.score;
  if (ratingValue !== undefined && ratingValue !== null && ratingValue !== '') {
    const rating = document.createElement('span');
    rating.className = 'media-rating';
    rating.textContent = `评分：${ratingValue}`;
    info.appendChild(rating);
  }

  card.appendChild(thumb);
  card.appendChild(info);

  return card;
}

function loadImageThumbnail(canvas, url, signal) {
  if (!(canvas instanceof HTMLCanvasElement) || !url) {
    return;
  }

  canvas.dataset.loading = 'true';

  imageLoader
    .load(url, signal)
    .then((result) => {
      if (signal?.aborted) {
        disposeImageResult(result);
        return;
      }

      delete canvas.dataset.error;

      if (result?.kind === 'bitmap' && result.bitmap) {
        drawBitmapToCanvas(canvas, result.bitmap);
        result.bitmap.close();
      } else if (result?.kind === 'blob' && result.blob) {
        drawBlobToCanvas(canvas, result.blob, signal);
      } else if (result?.kind === 'image' && result.image) {
        drawImageToCanvas(canvas, result.image, signal);
      }
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return;
      }
      console.warn('Failed to load thumbnail', url, error);
      canvas.dataset.error = 'true';
    })
    .finally(() => {
      delete canvas.dataset.loading;
    });
}

function drawBitmapToCanvas(canvas, bitmap) {
  if (!canvas || !bitmap) {
    return;
  }

  canvas.width = bitmap.width || canvas.width || 1;
  canvas.height = bitmap.height || canvas.height || 1;
  if (bitmap.width && bitmap.height) {
    canvas.style.aspectRatio = `${bitmap.width} / ${bitmap.height}`;
  }

  const bitmapCtx = canvas.getContext('bitmaprenderer');
  if (bitmapCtx && typeof bitmapCtx.transferFromImageBitmap === 'function') {
    bitmapCtx.transferFromImageBitmap(bitmap);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
}

function drawBlobToCanvas(canvas, blob, signal) {
  const blobUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    try {
      if (!signal?.aborted) {
        drawImageToCanvas(canvas, image, signal);
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(blobUrl);
    canvas.dataset.error = 'true';
  };
  image.src = blobUrl;
}

function drawImageToCanvas(canvas, image, signal) {
  if (!canvas || !image) {
    return;
  }

  if (signal?.aborted) {
    return;
  }

  const width = image.naturalWidth || image.width || canvas.width || 1;
  const height = image.naturalHeight || image.height || canvas.height || 1;
  canvas.width = width;
  canvas.height = height;
  if (width && height) {
    canvas.style.aspectRatio = `${width} / ${height}`;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, width, height);
}

function disposeImageResult(result) {
  if (!result) {
    return;
  }
  if (result.kind === 'bitmap' && result.bitmap) {
    result.bitmap.close?.();
  }
  if (result.kind === 'image' && result.image) {
    result.image.src = '';
  }
  if (result.kind === 'blob' && result.blob) {
    // Nothing to dispose immediately; caller handles URL revocation.
  }
}

function createImageLoader() {
  if (typeof window === 'undefined') {
    return createFallbackImageLoader();
  }

  if (typeof window.Worker !== 'function') {
    return createFallbackImageLoader();
  }

  try {
    return createWorkerImageLoader();
  } catch (error) {
    console.warn('Failed to initialise worker image loader', error);
    return createFallbackImageLoader();
  }
}

function createWorkerImageLoader() {
  const worker = new Worker('image-loader.js');
  let sequence = 0;
  const pending = new Map();

  worker.addEventListener('message', (event) => {
    const data = event.data || {};
    const id = data.id;
    if (!id || !pending.has(id)) {
      if (data.bitmap) {
        data.bitmap.close?.();
      }
      return;
    }

    const { resolve, reject, signal, abortHandler } = pending.get(id);
    pending.delete(id);

    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    if (data.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    if (data.error) {
      reject(new Error(data.error));
      return;
    }

    if (data.bitmap) {
      resolve({ kind: 'bitmap', bitmap: data.bitmap });
      return;
    }

    if (data.buffer) {
      const blob = new Blob([data.buffer], { type: data.type || 'image/*' });
      resolve({ kind: 'blob', blob });
      return;
    }

    reject(new Error('未知的图片加载结果'));
  });

  worker.addEventListener('error', (event) => {
    console.error('Image worker error', event);
  });

  const load = (url, signal) => {
    if (!url) {
      return Promise.reject(new Error('缺少图片地址'));
    }

    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const id = ++sequence;

    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        worker.postMessage({ id, type: 'cancel' });
        pending.delete(id);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      pending.set(id, { resolve, reject, signal, abortHandler });
      worker.postMessage({ id, url });
    });
  };

  const dispose = () => {
    pending.forEach(({ reject, signal, abortHandler }) => {
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      reject(new DOMException('Disposed', 'AbortError'));
    });
    pending.clear();
    worker.terminate();
  };

  return { load, dispose };
}

function createFallbackImageLoader() {
  const load = (url, signal) => {
    if (!url) {
      return Promise.reject(new Error('缺少图片地址'));
    }

    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'lazy';

      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };

      image.onload = () => {
        cleanup();
        resolve({ kind: 'image', image });
      };

      image.onerror = (error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error('图片加载失败'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      image.src = url;
    });
  };

  const dispose = () => {};

  return { load, dispose };
}
