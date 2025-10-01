const directoryListEl = document.getElementById('directory-list');
const mediaGridEl = document.getElementById('media-grid');
const currentRootEl = document.getElementById('current-root');
const mediaHeadingEl = document.getElementById('media-heading');
const mediaCountEl = document.getElementById('media-count');
const selectRootButton = document.getElementById('select-root');
const tagListEl = document.getElementById('tag-list');
const mediaApi = window.mediaApi;

let currentState = {
  root: null,
  leaves: [],
  selectedIndex: null,
  tags: [],
};

render();

if (mediaApi?.getRootTags) {
  mediaApi
    .getRootTags()
    .then((tags) => {
      if (Array.isArray(tags)) {
        updateState({ tags });
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
      selectedIndex: result.leaves.length ? 0 : null,
      tags: Array.isArray(result.tags) ? result.tags : currentState.tags,
    });
  });
}

function updateState(patch) {
  currentState = { ...currentState, ...patch };
  render();
}

function render() {
  renderRoot();
  renderTags();
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

function renderTags() {
  if (!tagListEl) {
    return;
  }

  tagListEl.innerHTML = '';

  if (!currentState.tags.length) {
    const empty = document.createElement('span');
    empty.className = 'tag-empty';
    empty.textContent = mediaApi?.getRootTags
      ? '尚未保存任何目录。'
      : '无法获取已保存的目录。';
    tagListEl.appendChild(empty);
    return;
  }

  currentState.tags.forEach((tag) => {
    const label = formatTagLabel(tag);

    const listItem = document.createElement('li');
    listItem.className = 'tag-item';

    const tagButton = document.createElement('button');
    tagButton.className = 'tag-button';
    tagButton.type = 'button';
    tagButton.textContent = label;
    tagButton.title = tag.path;
    tagButton.addEventListener('click', () => handleTagSelection(tag));

    const removeButton = document.createElement('button');
    removeButton.className = 'tag-remove-button';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `移除 ${label}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', (event) =>
      handleTagRemoval(event, tag, label)
    );

    listItem.appendChild(tagButton);
    listItem.appendChild(removeButton);
    tagListEl.appendChild(listItem);
  });
}

function renderDirectoryList() {
  directoryListEl.innerHTML = '';
  if (!currentState.leaves.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = currentState.root
      ? '所选目录中没有媒体文件。'
      : '请选择一个目录开始。';
    directoryListEl.appendChild(emptyMessage);
    return;
  }

  currentState.leaves.forEach((leaf, index) => {
    const item = document.createElement('li');
    item.className = 'directory-item';
    if (index === currentState.selectedIndex) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      currentState.selectedIndex = index;
      renderMedia();
      document
        .querySelectorAll('.directory-item')
        .forEach((node, idx) => {
          node.classList.toggle('active', idx === currentState.selectedIndex);
        });
    });

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

function formatTagLabel(tag) {
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

async function handleTagSelection(tag) {
  if (!mediaApi?.scanDirectory) {
    return;
  }
  try {
    const leaves = await mediaApi.scanDirectory(tag.path);
    updateState({
      root: tag.path,
      leaves,
      selectedIndex: leaves.length ? 0 : null,
    });
  } catch (error) {
    console.error('Failed to load directory from tag', error);
  }
}

async function handleTagRemoval(event, tag, label) {
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
    updateState({ tags });
  } catch (error) {
    console.error('Failed to remove saved directory', error);
  }
}

function renderMedia() {
  mediaGridEl.innerHTML = '';

  if (
    currentState.selectedIndex == null ||
    !currentState.leaves[currentState.selectedIndex]
  ) {
    mediaHeadingEl.textContent = '媒体';
    mediaCountEl.textContent = '';
    return;
  }

  const leaf = currentState.leaves[currentState.selectedIndex];
  mediaHeadingEl.textContent = leaf.displayPath;
  mediaCountEl.textContent = `${leaf.mediaFiles.length} 个项目`;

  if (!leaf.mediaFiles.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = '该文件夹中没有媒体文件。';
    mediaGridEl.appendChild(emptyMessage);
    return;
  }

  leaf.mediaFiles.forEach((file) => {
    const card = document.createElement('article');
    card.className = 'media-card';
    card.addEventListener('click', () => window.mediaApi.openFile(file.path));

    let thumb;
    const resolvedUrl = file.fileUrl || `file://${encodeURI(file.path)}`;

    if (file.type === 'image') {
      thumb = document.createElement('img');
      thumb.src = resolvedUrl;
    } else {
      thumb = document.createElement('video');
      thumb.src = resolvedUrl;
      thumb.preload = 'metadata';
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.addEventListener('loadedmetadata', () => {
        try {
          thumb.currentTime = 0.1;
        } catch (error) {
          console.warn('Failed to set preview frame for video', file.path, error);
        }
      });
      thumb.addEventListener('seeked', () => {
        thumb.pause();
      });
    }
    thumb.className = 'media-thumb';

    const info = document.createElement('div');
    info.className = 'media-info';

    const name = document.createElement('span');
    name.className = 'media-name';
    name.textContent = file.name;

    const meta = document.createElement('span');
    meta.className = 'media-meta';
    meta.textContent = file.type.toUpperCase();

    info.appendChild(name);
    info.appendChild(meta);

    card.appendChild(thumb);
    card.appendChild(info);

    mediaGridEl.appendChild(card);
  });
}
