const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const STORE_FILE = () => path.join(app.getPath('userData'), 'directories.json');
const MIN_TAG_COUNT = 2;

/**
 * @returns {{directories: Array<{id: string; name: string; path: string; createdAt: string}>}}
 */
function loadStore() {
  const file = STORE_FILE();
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { directories: [] };
  }
}

/**
 * @param {{directories: Array}} data
 */
function saveStore(data) {
  const file = STORE_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * @param {string} name
 * @returns {Set<string>}
 */
function extractKeywords(name) {
  const keywordPattern = /[\p{Script=Han}\p{L}\p{N}]+/gu;
  const tokens = name.match(keywordPattern) || [];
  return new Set(
    tokens
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 1)
  );
}

/**
 * @param {ReturnType<typeof loadStore>['directories']} directories
 */
function buildTagIndex(directories) {
  /** @type {Map<string, {displayName: string; count: number; ids: string[]}>} */
  const index = new Map();

  for (const entry of directories) {
    for (const keyword of extractKeywords(entry.name)) {
      const bucket = index.get(keyword) ?? {
        displayName: humanizeKeyword(keyword),
        count: 0,
        ids: [],
      };
      if (!bucket.ids.includes(entry.id)) {
        bucket.ids.push(entry.id);
        bucket.count += 1;
      }
      index.set(keyword, bucket);
    }
  }

  for (const [key, bucket] of Array.from(index.entries())) {
    if (bucket.count < MIN_TAG_COUNT) {
      index.delete(key);
    }
  }

  return index;
}

/**
 * @param {string} keyword
 */
function humanizeKeyword(keyword) {
  if (/^[\p{Script=Han}]+$/u.test(keyword)) {
    return keyword;
  }
  return keyword.replace(/(^|\s|[-_])(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

/**
 * @param {ReturnType<typeof loadStore>} store
 * @param {string} directoryPath
 */
function upsertDirectory(store, directoryPath) {
  const normalizedPath = path.resolve(directoryPath);
  const name = path.basename(normalizedPath);
  const existingIndex = store.directories.findIndex((item) => item.path === normalizedPath);
  const entry = {
    id: normalizedPath,
    name,
    path: normalizedPath,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    store.directories[existingIndex] = entry;
  } else {
    store.directories.push(entry);
  }
}

function setupIpc(store) {
  ipcMain.handle('directories:list', async () => store.directories);

  ipcMain.handle('directories:select', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    upsertDirectory(store, filePaths[0]);
    saveStore(store);
    return { canceled: false, directories: store.directories };
  });

  ipcMain.handle('directories:remove', async (_event, directoryId) => {
    const index = store.directories.findIndex((item) => item.id === directoryId);
    if (index >= 0) {
      store.directories.splice(index, 1);
      saveStore(store);
    }
    return store.directories;
  });

  ipcMain.handle('tags:list', async () => {
    const index = buildTagIndex(store.directories);
    return Array.from(index.entries()).map(([key, value]) => ({
      id: key,
      displayName: value.displayName,
      count: value.count,
    }));
  });

  ipcMain.handle('tags:directories', async (_event, tagId) => {
    const index = buildTagIndex(store.directories);
    const bucket = index.get(tagId);
    if (!bucket) {
      return [];
    }
    return store.directories.filter((entry) => bucket.ids.includes(entry.id));
  });
}

function createWindow(store) {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(() => {
  const store = loadStore();
  setupIpc(store);
  createWindow(store);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(store);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
