const storageKey = 'local-media-explorer.directories';

const state = {
  directories: [],
  tags: [],
  activeDirectoryId: null,
  activeTagId: null,
};

const directoryListEl = document.getElementById('directory-list');
const tagListEl = document.getElementById('tag-list');
const tagSummaryEl = document.getElementById('tag-summary');
const contentTitleEl = document.getElementById('content-title');
const contentMetaEl = document.getElementById('content-meta');
const directoryDetailEl = document.getElementById('directory-detail');
const clearSelectionBtn = document.getElementById('clear-selection');

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.warn('读取本地目录缓存失败', error);
    return [];
  }
}

function persistToLocalStorage() {
  if (window.mediaAPI?.listDirectories) {
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(state.directories));
}

function extractKeywords(name) {
  const pattern = /[\p{Script=Han}\p{L}\p{N}]+/gu;
  const matches = name.match(pattern) || [];
  return Array.from(
    new Set(
      matches
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 1)
    )
  );
}

function humanizeKeyword(keyword) {
  if (/^[\p{Script=Han}]+$/u.test(keyword)) {
    return keyword;
  }
  return keyword.replace(/(^|\s|[-_])(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function buildLocalTags() {
  const buckets = new Map();
  for (const directory of state.directories) {
    for (const keyword of extractKeywords(directory.name)) {
      const bucket = buckets.get(keyword) ?? { id: keyword, displayName: humanizeKeyword(keyword), count: 0 };
      bucket.count += 1;
      buckets.set(keyword, bucket);
    }
  }
  return Array.from(buckets.values()).filter((item) => item.count >= 2);
}

function renderDirectories() {
  directoryListEl.innerHTML = '';
  if (state.directories.length === 0) {
    directoryListEl.innerHTML = '<li class="empty-hint">暂无目录，请先选择一个文件夹。</li>';
    return;
  }

  for (const entry of state.directories) {
    const listItem = document.createElement('li');
    listItem.className = 'directory-item';
    if (state.activeDirectoryId === entry.id) {
      listItem.classList.add('active');
    }

    const title = document.createElement('h4');
    title.textContent = entry.name;

    const subtitle = document.createElement('span');
    subtitle.textContent = entry.path;

    listItem.appendChild(title);
    listItem.appendChild(subtitle);

    listItem.addEventListener('click', () => {
      state.activeDirectoryId = entry.id;
      state.activeTagId = null;
      renderDirectories();
      renderTags();
      void renderDetail();
    });

    directoryListEl.appendChild(listItem);
  }
}

function renderTags() {
  tagListEl.innerHTML = '';
  tagSummaryEl.textContent = state.tags.length > 0 ? `共 ${state.tags.length} 个标签` : '暂无标签';

  if (state.tags.length === 0) {
    const emptyHint = document.createElement('span');
    emptyHint.className = 'empty-hint';
    emptyHint.textContent = '当多个目录名称包含相同关键词时，这里会自动生成标签。';
    tagListEl.appendChild(emptyHint);
    return;
  }

  for (const tag of state.tags) {
    const pill = document.createElement('button');
    pill.className = 'tag-pill btn-invisible';
    pill.type = 'button';
    if (state.activeTagId === tag.id) {
      pill.classList.add('active');
    }
    pill.textContent = `${tag.displayName} (${tag.count})`;
    pill.addEventListener('click', () => {
      state.activeTagId = tag.id;
      state.activeDirectoryId = null;
      renderDirectories();
      renderTags();
      void renderDetail();
    });
    tagListEl.appendChild(pill);
  }
}

function formatDate(value) {
  if (!value) {
    return '未知时间';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function renderDetail() {
  const hasSelection = Boolean(state.activeDirectoryId || state.activeTagId);
  directoryDetailEl.classList.toggle('empty', !hasSelection);

  if (!hasSelection) {
    contentTitleEl.textContent = '媒体';
    contentMetaEl.textContent = '请选择标签或目录开始浏览';
    directoryDetailEl.innerHTML = `
      <div class="empty-state">
        <h3>尚未选择目录</h3>
        <p>左侧列表会显示已保存的目录，并自动按标签分类。</p>
      </div>
    `;
    return;
  }

  if (state.activeDirectoryId) {
    const entry = state.directories.find((item) => item.id === state.activeDirectoryId);
    if (!entry) {
      state.activeDirectoryId = null;
      await renderDetail();
      return;
    }
    contentTitleEl.textContent = entry.name;
    contentMetaEl.textContent = `路径：${entry.path}`;
    directoryDetailEl.innerHTML = `
      <div class="entry-card">
        <div class="path">${entry.path}</div>
        <div class="meta">
          <span>加入时间：${formatDate(entry.createdAt)}</span>
        </div>
        <div class="meta">
          <span>自动标签：${extractKeywords(entry.name).map(humanizeKeyword).join('、') || '无'}</span>
        </div>
      </div>
    `;
    return;
  }

  if (state.activeTagId) {
    const tag = state.tags.find((item) => item.id === state.activeTagId);
    contentTitleEl.textContent = `标签：${tag ? tag.displayName : state.activeTagId}`;
    const directories = await getDirectoriesByTag(state.activeTagId);
    contentMetaEl.textContent = `共 ${directories.length} 个目录匹配`;
    if (directories.length === 0) {
      directoryDetailEl.innerHTML = `
        <div class="empty-state">
          <h3>暂无匹配目录</h3>
          <p>尝试选择其他标签，或添加更多包含该关键词的目录。</p>
        </div>
      `;
      return;
    }

    const container = document.createElement('div');
    container.className = 'entry-grid';

    for (const directory of directories) {
      const card = document.createElement('div');
      card.className = 'entry-card';

      const name = document.createElement('h4');
      name.textContent = directory.name;

      const pathLabel = document.createElement('div');
      pathLabel.className = 'path';
      pathLabel.textContent = directory.path;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<span>加入时间：${formatDate(directory.createdAt)}</span>`;

      card.appendChild(name);
      card.appendChild(pathLabel);
      card.appendChild(meta);
      container.appendChild(card);
    }

    directoryDetailEl.innerHTML = '';
    directoryDetailEl.appendChild(container);
  }
}

async function getDirectoriesByTag(tagId) {
  if (window.mediaAPI?.filterByTag) {
    try {
      const result = await window.mediaAPI.filterByTag(tagId);
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn('读取标签关联目录失败，改用本地计算', error);
    }
  }
  return state.directories.filter((entry) => extractKeywords(entry.name).includes(tagId));
}

async function refreshState() {
  if (window.mediaAPI?.listDirectories) {
    state.directories = await window.mediaAPI.listDirectories();
  } else {
    state.directories = loadFromLocalStorage();
  }
  if (window.mediaAPI?.listTags) {
    state.tags = await window.mediaAPI.listTags();
  } else {
    state.tags = buildLocalTags();
  }
  renderDirectories();
  renderTags();
  void renderDetail();
}

async function handleSelectDirectory() {
  if (window.mediaAPI?.selectDirectory) {
    const result = await window.mediaAPI.selectDirectory();
    if (result && !result.canceled) {
      state.directories = result.directories ?? (await window.mediaAPI.listDirectories());
      persistToLocalStorage();
      state.tags = window.mediaAPI.listTags ? await window.mediaAPI.listTags() : buildLocalTags();
      renderDirectories();
      renderTags();
      void renderDetail();
    }
    return;
  }

  const manualPath = window.prompt('请输入要添加的目录路径：');
  if (!manualPath) {
    return;
  }
  const normalized = manualPath.trim();
  if (!normalized) {
    return;
  }
  const entry = {
    id: normalized,
    name: normalized.split(/[/\\]/).filter(Boolean).pop() || normalized,
    path: normalized,
    createdAt: new Date().toISOString(),
  };
  const existingIndex = state.directories.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    state.directories[existingIndex] = entry;
  } else {
    state.directories.push(entry);
  }
  state.tags = buildLocalTags();
  persistToLocalStorage();
  renderDirectories();
  renderTags();
  void renderDetail();
}

clearSelectionBtn.addEventListener('click', () => {
  state.activeDirectoryId = null;
  state.activeTagId = null;
  renderDirectories();
  renderTags();
  void renderDetail();
});

document.getElementById('select-directory').addEventListener('click', handleSelectDirectory);

refreshState();
