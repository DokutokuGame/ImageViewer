import { createMediaViewer } from './media-viewer.js';

const directoryListEl = document.getElementById('directory-list');
const mediaGridEl = document.getElementById('media-grid');
const mediaScrollContainer = document.querySelector('.media-panel-content');
const currentRootEl = document.getElementById('current-root');
const mediaHeadingEl = document.getElementById('media-heading');
const mediaCountEl = document.getElementById('media-count');
const selectRootButton = document.getElementById('select-root');
const openDirectoryButton = document.getElementById('open-directory');
const tagListEl = document.getElementById('tag-list');
const filterTagListEl = document.getElementById('filter-tag-list');
const mediaProgressEl = document.getElementById('media-progress');
const mediaProgressBarEl = document.getElementById('media-progress-bar');
const mediaProgressLabelEl = document.getElementById('media-progress-label');
const mediaViewerEl = document.getElementById('media-viewer');
const mediaViewerBackdropEl = document.getElementById('media-viewer-backdrop');
const mediaViewerCloseButton = document.getElementById('media-viewer-close');
const mediaViewerPrevButton = document.getElementById('media-viewer-prev');
const mediaViewerNextButton = document.getElementById('media-viewer-next');
const mediaViewerImageEl = document.getElementById('media-viewer-image');
const mediaViewerVideoEl = document.getElementById('media-viewer-video');
const mediaViewerLoadingEl = document.getElementById('media-viewer-loading');
const mediaViewerFilenameEl = document.getElementById('media-viewer-filename');
const mediaViewerCounterEl = document.getElementById('media-viewer-counter');
const mediaViewerOpenExternalButton = document.getElementById(
  'media-viewer-open-external'
);
const mediaApi = window.mediaApi;

const MIN_TAG_OCCURRENCE = 2;
const EXCLUDED_TAGS_STORAGE_KEY = 'media-excluded-tags';
const TAG_SORT_MODES = {
  ALPHABETICAL: 'alphabetical',
  FREQUENCY: 'frequency',
};
const NUMBERED_KEYWORD_PATTERN = /^(?:vol|part|no)[0-9]*$/u;
const STAR_KEYWORD_PATTERN = /^⭐+$/u;
const alphabeticalCollator = new Intl.Collator(['en', 'zh-Hans'], {
  sensitivity: 'base',
  numeric: true,
});
const MEDIA_RENDER_BATCH_SIZE = 12;
const MEDIA_PROGRESS_MIN_ITEMS = MEDIA_RENDER_BATCH_SIZE * 2;

let currentState = {
  root: null,
  leaves: [],
  selectedPath: null,
  savedTags: [],
  derivedTags: [],
  activeTag: null,
  keywordIndex: {},
  tagSortMode: TAG_SORT_MODES.ALPHABETICAL,
  tagSearchQuery: '',
  excludedTags: loadExcludedTags(),
  excludedTagPanelExpanded: false,
};

let mediaRenderAbortController = null;
const imageLoader = createImageLoader();
const lazyThumbnailLoader = createLazyThumbnailLoader();
let mediaProgressHideTimer = null;
let mediaProgressTotalCount = 0;
let tagSearchDraft = currentState.tagSearchQuery || '';
let mediaSessionSequence = 0;
let mediaSession = createEmptyMediaSession();
const mediaViewer = createMediaViewer({
  elements: {
    container: mediaViewerEl,
    backdrop: mediaViewerBackdropEl,
    closeButton: mediaViewerCloseButton,
    prevButton: mediaViewerPrevButton,
    nextButton: mediaViewerNextButton,
    imageEl: mediaViewerImageEl,
    videoEl: mediaViewerVideoEl,
    loadingEl: mediaViewerLoadingEl,
    filenameEl: mediaViewerFilenameEl,
    counterEl: mediaViewerCounterEl,
    openExternalButton: mediaViewerOpenExternalButton,
  },
  mediaApi,
  getSession: () => mediaSession,
  getSessionTotal: (session) => getMediaSessionTotal(session),
  setPendingIndex: (value) => {
    if (mediaSession) {
      mediaSession.pendingIndex = value;
    }
  },
  fetchMore: (session) => fetchNextMediaChunk(session),
});

if (imageLoader?.dispose) {
  window.addEventListener('beforeunload', () => {
    imageLoader.dispose();
  });
}

if (lazyThumbnailLoader?.reset) {
  window.addEventListener('beforeunload', () => {
    lazyThumbnailLoader.reset();
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

  if ('excludedTags' in patch) {
    nextState.excludedTags = normalizeExcludedTags(nextState.excludedTags);
    if (
      nextState.activeTag &&
      nextState.excludedTags.includes(nextState.activeTag)
    ) {
      nextState.activeTag = null;
    }
    saveExcludedTags(nextState.excludedTags);
  }

  if ('leaves' in patch || 'excludedTags' in patch) {
    const { tags, keywordIndex } = buildDerivedTags(
      nextState.leaves,
      nextState.excludedTags
    );
    nextState.derivedTags = tags;
    nextState.keywordIndex = keywordIndex;
  }

  if ('savedTags' in patch && !Array.isArray(nextState.savedTags)) {
    nextState.savedTags = [];
  }

  if ('tagSortMode' in patch) {
    nextState.tagSortMode = normalizeTagSortMode(nextState.tagSortMode);
  }

  if ('tagSearchQuery' in patch && typeof nextState.tagSearchQuery !== 'string') {
    nextState.tagSearchQuery = '';
  }

  if ('excludedTagPanelExpanded' in patch) {
    nextState.excludedTagPanelExpanded = Boolean(
      nextState.excludedTagPanelExpanded
    );
  }

  if ('tagSearchQuery' in patch) {
    tagSearchDraft = nextState.tagSearchQuery || '';
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

  const previousScrollTop = filterTagListEl.scrollTop;
  filterTagListEl.innerHTML = '';

  if (!currentState.leaves.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-tag-empty';
    empty.textContent = '选择目录后会自动生成标签。';
    filterTagListEl.appendChild(empty);
    restoreFilterTagScroll(previousScrollTop);
    return;
  }

  const controls = createTagFilterControls();
  if (controls) {
    filterTagListEl.appendChild(controls);
  }

  const excludedSettings = createExcludedTagSettings();
  if (excludedSettings) {
    filterTagListEl.appendChild(excludedSettings);
  }

  if (!currentState.derivedTags.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-tag-empty';
    empty.textContent = '未发现重复关键词，暂无生成标签。';
    filterTagListEl.appendChild(empty);
    restoreFilterTagScroll(previousScrollTop);
    return;
  }

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'filter-tag-button-group';

  const allButton = createFilterButton('全部', null, currentState.activeTag == null);
  const allEntry = document.createElement('div');
  allEntry.className = 'filter-tag-entry';
  allEntry.appendChild(allButton);
  buttonsContainer.appendChild(allEntry);

  const filteredTags = getRenderableTags();

  filteredTags.forEach((tag) => {
    const entry = createFilterTagEntry(tag);
    buttonsContainer.appendChild(entry);
  });

  filterTagListEl.appendChild(buttonsContainer);

  if (!filteredTags.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-tag-empty';
    empty.textContent = '没有找到匹配的标签。';
    filterTagListEl.appendChild(empty);
  }

  restoreFilterTagScroll(previousScrollTop);
}

function restoreFilterTagScroll(previousScrollTop) {
  if (!filterTagListEl) {
    return;
  }

  const maxScrollTop = Math.max(
    0,
    filterTagListEl.scrollHeight - filterTagListEl.clientHeight
  );
  const nextScrollTop = Math.max(
    0,
    Math.min(
      typeof previousScrollTop === 'number' ? previousScrollTop : 0,
      maxScrollTop
    )
  );

  if (filterTagListEl.scrollTop !== nextScrollTop) {
    filterTagListEl.scrollTop = nextScrollTop;
  }
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

function createFilterTagEntry(tag) {
  const entry = document.createElement('div');
  entry.className = 'filter-tag-entry';

  const button = createFilterButton(
    `${tag.label} (${tag.count})`,
    tag.id,
    currentState.activeTag === tag.id
  );
  entry.appendChild(button);

  const excludeButton = document.createElement('button');
  excludeButton.type = 'button';
  excludeButton.className = 'filter-tag-exclude-button';
  excludeButton.setAttribute('aria-label', `排除标签 ${tag.label}`);
  excludeButton.title = '从标签列表中排除此标签';
  excludeButton.textContent = '×';
  excludeButton.addEventListener('click', (event) =>
    handleExcludeTag(event, tag)
  );
  entry.appendChild(excludeButton);

  return entry;
}

function handleExcludeTag(event, tag) {
  event.preventDefault();
  event.stopPropagation();

  if (!tag?.id) {
    return;
  }

  const next = new Set(Array.isArray(currentState.excludedTags)
    ? currentState.excludedTags
    : []);
  const previousSize = next.size;
  next.add(tag.id);

  if (next.size === previousSize) {
    if (currentState.activeTag === tag.id) {
      updateState({ activeTag: null });
    }
    return;
  }

  const patch = { excludedTags: Array.from(next) };
  if (currentState.activeTag === tag.id) {
    patch.activeTag = null;
  }
  updateState(patch);
}

function handleRestoreExcludedTag(tagId) {
  if (!tagId) {
    return;
  }

  const current = Array.isArray(currentState.excludedTags)
    ? currentState.excludedTags
    : [];
  if (!current.includes(tagId)) {
    return;
  }

  const next = current.filter((item) => item !== tagId);
  updateState({ excludedTags: next });
}

function handleExcludedTagFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const input = form.querySelector('.excluded-tag-input');
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const tokens = extractKeywords(input.value || '');
  if (!tokens.length) {
    input.value = '';
    input.focus?.();
    return;
  }

  const next = new Set(Array.isArray(currentState.excludedTags)
    ? currentState.excludedTags
    : []);
  let added = false;
  for (const token of tokens) {
    const previousSize = next.size;
    next.add(token);
    if (next.size !== previousSize) {
      added = true;
    }
  }

  if (added) {
    const patch = { excludedTags: Array.from(next) };
    if (currentState.activeTag && next.has(currentState.activeTag)) {
      patch.activeTag = null;
    }
    updateState(patch);
  }

  input.value = '';
  input.focus?.();
}

function createExcludedTagSettings() {
  const container = document.createElement('div');
  container.className = 'excluded-tag-settings';

  const header = document.createElement('div');
  header.className = 'excluded-tag-header';

  const title = document.createElement('h4');
  title.className = 'excluded-tag-title';
  title.textContent = '标签排除';
  header.appendChild(title);

  const excluded = Array.isArray(currentState.excludedTags)
    ? currentState.excludedTags
    : [];

  const count = document.createElement('span');
  count.className = 'excluded-tag-count';
  count.textContent = `(${excluded.length})`;
  header.appendChild(count);

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'excluded-tag-toggle-button';
  toggleButton.setAttribute(
    'aria-expanded',
    String(Boolean(currentState.excludedTagPanelExpanded))
  );
  toggleButton.textContent = currentState.excludedTagPanelExpanded
    ? '收起'
    : '展开';
  toggleButton.setAttribute(
    'aria-label',
    currentState.excludedTagPanelExpanded ? '收起标签排除设置' : '展开标签排除设置'
  );
  toggleButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextOpen = !currentState.excludedTagPanelExpanded;
    updateState({ excludedTagPanelExpanded: nextOpen });
  });
  header.appendChild(toggleButton);

  header.addEventListener('click', (event) => {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }
    const nextOpen = !currentState.excludedTagPanelExpanded;
    updateState({ excludedTagPanelExpanded: nextOpen });
  });

  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'excluded-tag-body';
  if (!currentState.excludedTagPanelExpanded) {
    body.hidden = true;
  }

  const help = document.createElement('p');
  help.className = 'excluded-tag-help';
  help.textContent = '被排除的标签不会在筛选列表中显示，子文件夹也不会按照这些标签分组。';
  body.appendChild(help);

  const form = document.createElement('form');
  form.className = 'excluded-tag-form';
  form.addEventListener('submit', handleExcludedTagFormSubmit);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'excluded-tag-input';
  input.placeholder = '输入要排除的标签';
  input.setAttribute('aria-label', '输入要排除的标签');
  form.appendChild(input);

  const addButton = document.createElement('button');
  addButton.type = 'submit';
  addButton.className = 'excluded-tag-add-button';
  addButton.textContent = '添加';
  form.appendChild(addButton);

  body.appendChild(form);

  if (!excluded.length) {
    const empty = document.createElement('span');
    empty.className = 'excluded-tag-empty';
    empty.textContent = '尚未排除任何标签。';
    body.appendChild(empty);
    container.appendChild(body);
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'excluded-tag-list';

  const items = excluded
    .map((id) => ({ id, label: humanizeKeyword(id) }))
    .sort((a, b) => {
      const starCompare = compareStarPriority(a, b);
      if (starCompare !== 0) {
        return starCompare;
      }
      return compareTagsAlphabetically(a, b);
    });

  items.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.className = 'excluded-tag-item';

    const label = document.createElement('span');
    label.className = 'excluded-tag-label';
    label.textContent = item.label;
    listItem.appendChild(label);

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'excluded-tag-restore-button';
    restoreButton.textContent = '恢复';
    restoreButton.addEventListener('click', () =>
      handleRestoreExcludedTag(item.id)
    );
    listItem.appendChild(restoreButton);

    list.appendChild(listItem);
  });

  body.appendChild(list);

  container.appendChild(body);

  return container;
}

function renderDirectoryList() {
  const previousScrollTop = directoryListEl.scrollTop;
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
    directoryListEl.scrollTop = 0;
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

  const maxScrollTop = Math.max(
    0,
    directoryListEl.scrollHeight - directoryListEl.clientHeight
  );
  directoryListEl.scrollTop = Math.max(
    0,
    Math.min(previousScrollTop, maxScrollTop)
  );
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
  showMediaPendingProgress('正在加载已保存的目录…');

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
    resetMediaProgress();
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
  resetMediaView();
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

  const initialFiles = Array.isArray(leaf.mediaFiles) ? leaf.mediaFiles : [];
  const totalFromLeaf = getLeafMediaTotal(leaf);
  const displayTotal =
    typeof totalFromLeaf === 'number'
      ? Math.max(totalFromLeaf, initialFiles.length)
      : initialFiles.length;

  mediaHeadingEl.textContent = leaf.displayPath;
  mediaCountEl.textContent = `${displayTotal} 个项目`;

  const canLoadMore =
    typeof totalFromLeaf === 'number'
      ? totalFromLeaf > 0
      : Boolean(mediaApi?.fetchNextMediaChunk);

  if (!initialFiles.length && !canLoadMore) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = '该文件夹中没有媒体文件。';
    mediaGridEl.appendChild(emptyMessage);
    return;
  }

  startMediaLoadingForLeaf(leaf);
}

function resetMediaView() {
  if (mediaRenderAbortController) {
    mediaRenderAbortController.abort();
  }
  mediaRenderAbortController = null;

  if (mediaGridEl) {
    delete mediaGridEl.dataset.loading;
    mediaGridEl.innerHTML = '';
  }

  lazyThumbnailLoader.reset?.();
  resetMediaProgress();
  mediaSession = createEmptyMediaSession();
  mediaViewer.reset();
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
      if (isStarKeyword(token)) {
        return token;
      }
      return token.toLowerCase();
    })
    .filter((token) => {
      if (isStarKeyword(token)) {
        return true;
      }
      if (/^\d+$/u.test(token)) {
        return false;
      }
      if (NUMBERED_KEYWORD_PATTERN.test(token)) {
        return false;
      }
      return token.length > 1;
    });

  return Array.from(new Set(normalized));
}

function humanizeKeyword(keyword) {
  if (isStarKeyword(keyword)) {
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

function buildDerivedTags(leaves, excludedTags) {
  const keywordIndex = {};
  const buckets = new Map();
  const excluded = new Set(Array.isArray(excludedTags) ? excludedTags : []);

  const safeLeaves = Array.isArray(leaves) ? leaves : [];

  for (const leaf of safeLeaves) {
    const name = getLeafName(leaf);
    const keywords = extractKeywords(name);
    keywordIndex[leaf.path] = keywords;

    for (const keyword of keywords) {
      if (excluded.has(keyword)) {
        continue;
      }
      const bucket = buckets.get(keyword) ?? {
        id: keyword,
        label: humanizeKeyword(keyword),
        count: 0,
      };
      bucket.count += 1;
      buckets.set(keyword, bucket);
    }
  }

  const tags = Array.from(buckets.values()).filter(
    (bucket) => bucket.count >= MIN_TAG_OCCURRENCE
  );

  return { tags, keywordIndex };
}

function getRenderableTags() {
  const sortMode = normalizeTagSortMode(currentState.tagSortMode);
  const query = currentState.tagSearchQuery.trim().toLowerCase();

  const filtered = currentState.derivedTags.filter((tag) => {
    if (!query) {
      return true;
    }
    const label = `${tag.label || ''}`.toLowerCase();
    return label.includes(query) || tag.id.includes(query);
  });

  return filtered.sort((a, b) => compareTags(a, b, sortMode));
}

function compareTags(a, b, mode) {
  const starComparison = compareStarPriority(a, b);
  if (starComparison !== 0) {
    return starComparison;
  }

  if (mode === TAG_SORT_MODES.FREQUENCY) {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return compareTagsAlphabetically(a, b);
  }

  return compareTagsAlphabetically(a, b);
}

function compareTagsAlphabetically(a, b) {
  const groupA = getAlphabeticalGroup(a.label);
  const groupB = getAlphabeticalGroup(b.label);

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  return alphabeticalCollator.compare(a.label, b.label);
}

function normalizeExcludedTags(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  const normalized = new Set();

  for (const item of list) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    if (isStarKeyword(trimmed)) {
      normalized.add(trimmed);
    } else {
      normalized.add(trimmed.toLowerCase());
    }
  }

  return Array.from(normalized);
}

function loadExcludedTags() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storage = window.localStorage;
    if (!storage) {
      return [];
    }
    const raw = storage.getItem(EXCLUDED_TAGS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return normalizeExcludedTags(parsed);
  } catch (error) {
    console.warn('Failed to load excluded tags', error);
    return [];
  }
}

function saveExcludedTags(tags) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const storage = window.localStorage;
    if (!storage) {
      return;
    }
    const normalized = normalizeExcludedTags(tags);
    storage.setItem(EXCLUDED_TAGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn('Failed to save excluded tags', error);
  }
}

function getAlphabeticalGroup(label) {
  if (isStarLabel(label)) {
    return -1;
  }

  if (!label) {
    return 1;
  }

  const firstChar = label.trim().charAt(0);
  if (/^[A-Za-z]$/.test(firstChar)) {
    return 0;
  }
  return 1;
}

function normalizeTagSortMode(mode) {
  return mode === TAG_SORT_MODES.FREQUENCY
    ? TAG_SORT_MODES.FREQUENCY
    : TAG_SORT_MODES.ALPHABETICAL;
}

function handleTagSearchInput(event) {
  const target = event?.currentTarget;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  tagSearchDraft = target.value ?? '';
}

function handleTagSearchFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (form instanceof HTMLFormElement) {
    const input = form.querySelector('.filter-tag-search-input');
    if (input instanceof HTMLInputElement) {
      tagSearchDraft = input.value ?? '';
    }
  }

  if (tagSearchDraft === currentState.tagSearchQuery) {
    return;
  }

  updateState({ tagSearchQuery: tagSearchDraft });

  const restoreFocus = () => {
    const nextInput = document.getElementById('tag-search-input');
    if (nextInput instanceof HTMLInputElement) {
      if (typeof nextInput.focus === 'function') {
        try {
          nextInput.focus({ preventScroll: true });
        } catch (error) {
          try {
            nextInput.focus();
          } catch (focusError) {
            // Ignore focus errors in unsupported environments.
          }
        }
      }
      try {
        const position = typeof tagSearchDraft === 'string'
          ? tagSearchDraft.length
          : nextInput.value.length;
        nextInput.setSelectionRange(position, position);
      } catch (error) {
        // Ignore selection errors in unsupported environments.
      }
    }
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(restoreFocus);
  } else {
    window.setTimeout(restoreFocus, 0);
  }
}

function createTagFilterControls() {
  const container = document.createElement('div');
  container.className = 'filter-tag-controls';

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'filter-tag-search';

  const searchForm = document.createElement('form');
  searchForm.className = 'filter-tag-search-form';
  searchForm.addEventListener('submit', handleTagSearchFormSubmit);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'tag-search-input';
  searchInput.className = 'filter-tag-search-input';
  searchInput.placeholder = '搜索标签';
  searchInput.setAttribute('aria-label', '搜索标签');
  const searchValue =
    typeof tagSearchDraft === 'string'
      ? tagSearchDraft
      : currentState.tagSearchQuery || '';
  searchInput.value = searchValue;
  if (searchValue !== tagSearchDraft) {
    tagSearchDraft = searchValue;
  }
  searchInput.addEventListener('input', handleTagSearchInput);

  const confirmButton = document.createElement('button');
  confirmButton.type = 'submit';
  confirmButton.className = 'filter-tag-search-submit';
  confirmButton.textContent = '确认';

  searchForm.appendChild(searchInput);
  searchForm.appendChild(confirmButton);
  searchWrapper.appendChild(searchForm);
  container.appendChild(searchWrapper);

  const sortWrapper = document.createElement('div');
  sortWrapper.className = 'filter-tag-sort';

  const sortSelect = document.createElement('select');
  sortSelect.id = 'tag-sort-select';
  sortSelect.className = 'filter-tag-sort-select';
  sortSelect.setAttribute('aria-label', '标签排序');

  const options = [
    { value: TAG_SORT_MODES.ALPHABETICAL, label: '按首字母' },
    { value: TAG_SORT_MODES.FREQUENCY, label: '按数量' },
  ];

  options.forEach((option) => {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    sortSelect.appendChild(node);
  });

  sortSelect.value = normalizeTagSortMode(currentState.tagSortMode);
  sortSelect.addEventListener('change', (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const value = normalizeTagSortMode(target.value);
    if (value === currentState.tagSortMode) {
      return;
    }
    updateState({ tagSortMode: value });
  });

  sortWrapper.appendChild(sortSelect);
  container.appendChild(sortWrapper);

  return container;
}

function getVisibleLeaves() {
  const baseLeaves = !currentState.activeTag
    ? currentState.leaves
    : currentState.leaves.filter((leaf) => {
        const keywords = currentState.keywordIndex[leaf.path] || [];
        return keywords.includes(currentState.activeTag);
      });

  const visibleLeaves = Array.isArray(baseLeaves) ? baseLeaves.slice() : [];
  visibleLeaves.sort(compareLeavesByStarPriority);
  return visibleLeaves;
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

function getLeafMediaTotal(leaf) {
  if (!leaf || typeof leaf !== 'object') {
    return null;
  }

  const candidates = [
    leaf.totalMediaCount,
    leaf.totalCount,
    leaf.mediaCount,
    leaf.count,
    leaf.total,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }
  }

  return null;
}

function startMediaLoadingForLeaf(leaf) {
  const controller = new AbortController();
  mediaRenderAbortController = controller;
  if (mediaGridEl) {
    mediaGridEl.dataset.loading = 'true';
  }

  const files = Array.isArray(leaf?.mediaFiles) ? leaf.mediaFiles.slice() : [];
  const totalHint = getLeafMediaTotal(leaf);
  const initialTotal = Math.max(
    files.length,
    typeof totalHint === 'number' ? totalHint : 0
  );
  const session = createEmptyMediaSession();
  mediaSessionSequence += 1;
  session.requestId = mediaSessionSequence;
  session.totalCount = initialTotal;
  session.items = [];
  session.pendingIndex = null;
  session.leafPath = leaf?.path ?? null;
  mediaSession = session;

  beginMediaProgress(session.totalCount);

  let renderFailed = false;

  const renderPromise = renderMediaIncrementally(session, files, controller.signal);

  session.loadingPromise = renderPromise;

  renderPromise
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        renderFailed = true;
        console.error('Failed to render media items', error);
        failMediaProgress();
      }
    })
    .finally(() => {
      if (mediaSession === session) {
        session.loadingPromise = null;
      }

      if (mediaRenderAbortController === controller) {
        if (mediaGridEl) {
          delete mediaGridEl.dataset.loading;
        }
        mediaRenderAbortController = null;
        if (!renderFailed) {
          finishMediaProgress();
        }
      }

      mediaViewer.handleItemsAppended(session);

      if (
        mediaSession === session &&
        files.length === 0 &&
        session.totalCount > 0 &&
        mediaApi?.fetchNextMediaChunk &&
        !controller.signal.aborted
      ) {
        void fetchNextMediaChunk(session);
      }
    });
}

async function renderMediaIncrementally(mediaSessionRef, files, signal) {
  const queue = Array.isArray(files) ? files.slice() : [];

  while (queue.length && !signal.aborted) {
    const chunk = queue.splice(0, MEDIA_RENDER_BATCH_SIZE);
    renderMediaChunk(mediaSessionRef, chunk, signal);

    if (queue.length && !signal.aborted) {
      await waitForNextFrame();
    }
  }
}

function renderMediaChunk(mediaSessionRef, chunk, signal) {
  if (!Array.isArray(chunk) || !chunk.length || signal?.aborted) {
    return;
  }

  const fragment = document.createDocumentFragment();
  let appended = 0;

  for (const file of chunk) {
    const index = mediaSessionRef.items.length;
    mediaSessionRef.items.push(file);
    fragment.appendChild(createMediaCard(file, signal, index));
    appended += 1;
    updateMediaProgress(mediaSessionRef.items.length);
  }

  if (!appended) {
    return;
  }

  if (!mediaGridEl) {
    return;
  }

  mediaGridEl.appendChild(fragment);
  mediaViewer.handleItemsAppended(mediaSessionRef);
}

function createEmptyMediaSession() {
  return {
    requestId: 0,
    totalCount: 0,
    items: [],
    pendingIndex: null,
    loadingPromise: null,
    leafPath: null,
  };
}

function getMediaSessionTotal(session) {
  if (!session) {
    return 0;
  }

  if (typeof session.totalCount === 'number' && session.totalCount > 0) {
    return session.totalCount;
  }

  return Array.isArray(session.items) ? session.items.length : 0;
}

function fetchNextMediaChunk(session) {
  if (!session) {
    return Promise.resolve();
  }

  if (session.loadingPromise) {
    return session.loadingPromise;
  }

  if (!mediaApi?.fetchNextMediaChunk || !session.leafPath) {
    return Promise.resolve();
  }

  const offset = Array.isArray(session.items) ? session.items.length : 0;
  const requestId = session.requestId;

  const promise = Promise.resolve(
    mediaApi.fetchNextMediaChunk(session.leafPath, offset)
  )
    .then((result) => {
      if (session !== mediaSession || requestId !== session.requestId) {
        return;
      }

      const { files, totalCount } = normalizeMediaChunkResult(result);

      if (typeof totalCount === 'number' && totalCount >= 0) {
        const normalizedTotal = Math.max(totalCount, session.items.length);
        if (normalizedTotal > session.totalCount) {
          session.totalCount = normalizedTotal;
        }
        ensureMediaProgressTracking(normalizedTotal);
      }

      if (!Array.isArray(files) || !files.length) {
        return;
      }

      const signal = mediaRenderAbortController?.signal;
      if (signal?.aborted) {
        return;
      }

      renderMediaChunk(session, files, signal);
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch next media chunk', error);
    })
    .finally(() => {
      if (session.loadingPromise === promise) {
        session.loadingPromise = null;
      }
    });

  session.loadingPromise = promise;
  return promise;
}

function normalizeMediaChunkResult(result) {
  if (!result) {
    return { files: [] };
  }

  if (Array.isArray(result)) {
    return { files: result };
  }

  const files = Array.isArray(result.files) ? result.files : [];

  const totalCandidate = [
    result.totalCount,
    result.total,
    result.count,
    result.totalItems,
  ].find((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);

  const totalCount = typeof totalCandidate === 'number' ? totalCandidate : undefined;

  return { files, totalCount };
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

function beginMediaProgress(total) {
  if (!mediaProgressEl) {
    return;
  }

  if (mediaProgressHideTimer) {
    window.clearTimeout(mediaProgressHideTimer);
    mediaProgressHideTimer = null;
  }

  if (!total || total < MEDIA_PROGRESS_MIN_ITEMS) {
    resetMediaProgress();
    return;
  }

  mediaProgressTotalCount = total;
  mediaProgressEl.hidden = false;
  mediaProgressEl.dataset.state = 'loading';
  updateMediaProgress(0);
}

function ensureMediaProgressTracking(total) {
  if (!mediaProgressEl) {
    return;
  }

  if (typeof total !== 'number' || Number.isNaN(total) || total <= 0) {
    return;
  }

  const normalizedTotal = Math.max(total, mediaSession?.items?.length ?? 0);

  if (normalizedTotal < MEDIA_PROGRESS_MIN_ITEMS) {
    return;
  }

  if (mediaProgressTotalCount === 0) {
    beginMediaProgress(normalizedTotal);
    updateMediaProgress(mediaSession?.items?.length ?? 0);
    return;
  }

  if (normalizedTotal > mediaProgressTotalCount) {
    mediaProgressTotalCount = normalizedTotal;
    updateMediaProgress(mediaSession?.items?.length ?? 0);
  }
}

function showMediaPendingProgress(message) {
  if (!mediaProgressEl) {
    return;
  }

  if (mediaProgressHideTimer) {
    window.clearTimeout(mediaProgressHideTimer);
    mediaProgressHideTimer = null;
  }

  mediaProgressTotalCount = 0;
  mediaProgressEl.hidden = false;
  mediaProgressEl.dataset.state = 'pending';

  if (mediaProgressBarEl) {
    mediaProgressBarEl.style.width = '0%';
  }

  if (mediaProgressLabelEl) {
    mediaProgressLabelEl.textContent = message || '正在加载…';
  }
}

function updateMediaProgress(loaded) {
  if (!mediaProgressEl || mediaProgressTotalCount <= 0) {
    return;
  }

  const total = mediaProgressTotalCount;
  const clampedLoaded = Math.max(0, Math.min(loaded, total));
  const percent = total > 0 ? (clampedLoaded / total) * 100 : 0;

  if (mediaProgressBarEl) {
    mediaProgressBarEl.style.width = `${percent}%`;
  }

  if (mediaProgressLabelEl) {
    mediaProgressLabelEl.textContent = `加载中 ${clampedLoaded} / ${total}`;
  }
}

function finishMediaProgress() {
  if (!mediaProgressEl || mediaProgressTotalCount <= 0) {
    resetMediaProgress();
    return;
  }

  updateMediaProgress(mediaProgressTotalCount);

  if (mediaProgressLabelEl) {
    mediaProgressLabelEl.textContent = '加载完成';
  }

  mediaProgressEl.dataset.state = 'complete';

  if (mediaProgressHideTimer) {
    window.clearTimeout(mediaProgressHideTimer);
  }

  mediaProgressHideTimer = window.setTimeout(() => {
    resetMediaProgress();
  }, 800);
}

function failMediaProgress() {
  if (!mediaProgressEl) {
    return;
  }

  if (mediaProgressTotalCount > 0) {
    updateMediaProgress(mediaProgressTotalCount);
    if (mediaProgressLabelEl) {
      mediaProgressLabelEl.textContent = '加载失败';
    }
    mediaProgressEl.dataset.state = 'error';
    if (mediaProgressHideTimer) {
      window.clearTimeout(mediaProgressHideTimer);
    }
    mediaProgressHideTimer = window.setTimeout(() => {
      resetMediaProgress();
    }, 1200);
    return;
  }

  resetMediaProgress();
}

function resetMediaProgress() {
  if (mediaProgressHideTimer) {
    window.clearTimeout(mediaProgressHideTimer);
    mediaProgressHideTimer = null;
  }

  mediaProgressTotalCount = 0;

  if (!mediaProgressEl) {
    return;
  }

  mediaProgressEl.hidden = true;
  mediaProgressEl.removeAttribute('data-state');

  if (mediaProgressBarEl) {
    mediaProgressBarEl.style.width = '0%';
  }

  if (mediaProgressLabelEl) {
    mediaProgressLabelEl.textContent = '';
  }
}

function compareLeavesByStarPriority(a, b) {
  const aStar = isStarLeaf(a);
  const bStar = isStarLeaf(b);

  if (aStar === bStar) {
    return 0;
  }

  return aStar ? -1 : 1;
}

function isStarKeyword(keyword) {
  return typeof keyword === 'string' && STAR_KEYWORD_PATTERN.test(keyword);
}

function isStarLabel(label) {
  return typeof label === 'string' && STAR_KEYWORD_PATTERN.test(label.trim());
}

function isStarTag(tag) {
  if (!tag) {
    return false;
  }

  if (isStarKeyword(tag.id)) {
    return true;
  }

  if (isStarLabel(tag.label)) {
    return true;
  }

  return false;
}

function isStarLeaf(leaf) {
  if (!leaf) {
    return false;
  }

  if (leaf.path) {
    const keywords = currentState.keywordIndex?.[leaf.path];
    if (Array.isArray(keywords) && keywords.some(isStarKeyword)) {
      return true;
    }
  }

  if (typeof leaf.displayPath === 'string' && leaf.displayPath.includes('⭐')) {
    return true;
  }

  return false;
}

function compareStarPriority(a, b) {
  const aStar = isStarTag(a);
  const bStar = isStarTag(b);

  if (aStar === bStar) {
    return 0;
  }

  return aStar ? -1 : 1;
}

function createMediaCard(file, signal, index) {
  const card = document.createElement('article');
  card.className = 'media-card';

  if (typeof index === 'number' && Number.isFinite(index)) {
    card.dataset.index = String(index);
  }

  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const activate = (event) => {
    if (typeof index !== 'number' || !Number.isFinite(index)) {
      return;
    }

    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
    }

    mediaViewer.openAtIndex(index);
  };

  card.addEventListener('click', activate);
  card.addEventListener('keydown', activate);

  const resolvedUrl = file?.fileUrl || (file?.path ? `file://${encodeURI(file.path)}` : '');

  let thumb;
  if (file?.type === 'image') {
    thumb = document.createElement('canvas');
    thumb.className = 'media-thumb media-thumb-image';
    thumb.style.aspectRatio = '4 / 3';
    thumb.style.width = '100%';
    registerLazyThumbnail(thumb, resolvedUrl, signal);
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

function registerLazyThumbnail(canvas, url, signal) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  if (!url) {
    return;
  }

  lazyThumbnailLoader.observe?.(canvas, url, signal);
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

function createLazyThumbnailLoader() {
  const immediateLoader = {
    observe: (canvas, url, signal) => {
      if (signal?.aborted) {
        return;
      }
      loadImageThumbnail(canvas, url, signal);
    },
    reset: () => {},
  };

  if (typeof window === 'undefined') {
    return immediateLoader;
  }

  if (typeof window.IntersectionObserver !== 'function') {
    return immediateLoader;
  }

  const targets = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const element = entry.target;
        const payload = targets.get(element);
        if (!payload) {
          continue;
        }

        observer.unobserve(element);
        targets.delete(element);

        if (payload.signal && payload.abortHandler) {
          payload.signal.removeEventListener('abort', payload.abortHandler);
        }

        if (payload.signal?.aborted) {
          continue;
        }

        loadImageThumbnail(element, payload.url, payload.signal);
      }
    },
    {
      root: mediaScrollContainer || null,
      rootMargin: '400px 0px',
      threshold: 0.01,
    }
  );

  const observe = (canvas, url, signal) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    if (!url) {
      return;
    }

    if (signal?.aborted) {
      return;
    }

    if (targets.has(canvas)) {
      const existing = targets.get(canvas);
      if (existing?.signal && existing.abortHandler) {
        existing.signal.removeEventListener('abort', existing.abortHandler);
      }
      targets.delete(canvas);
    }

    const payload = { url, signal };

    if (signal) {
      const abortHandler = () => {
        observer.unobserve(canvas);
        const current = targets.get(canvas);
        if (current?.signal && current.abortHandler) {
          current.signal.removeEventListener('abort', current.abortHandler);
        }
        targets.delete(canvas);
      };
      signal.addEventListener('abort', abortHandler, { once: true });
      payload.abortHandler = abortHandler;
    }

    targets.set(canvas, payload);
    observer.observe(canvas);
  };

  const reset = () => {
    targets.forEach((payload, canvas) => {
      if (payload.signal && payload.abortHandler) {
        payload.signal.removeEventListener('abort', payload.abortHandler);
      }
      observer.unobserve(canvas);
    });
    targets.clear();
    observer.disconnect();
  };

  return { observe, reset };
}
