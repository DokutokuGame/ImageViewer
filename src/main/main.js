const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { collectLeafDirectories, listMediaFiles } = require('./directoryScanner');
const {
  initPreferences,
  getRootTags,
  recordRootTag,
  removeRootTag,
} = require('./preferences');

let mainWindow;
const demoMode = process.env.IMAGEVIEWER_DEMO === '1';
const DEMO_LEAVES = [
  { path: 'demo://旅行/海边', displayPath: '旅行/海边', mediaFileCount: 12 },
  { path: 'demo://旅行/城市', displayPath: '旅行/城市', mediaFileCount: 8 },
  { path: 'demo://家庭/周末', displayPath: '家庭/周末', mediaFileCount: 5 },
];

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
}

app.whenReady().then(async () => {
  try {
    await initPreferences(app);
    await createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Electron 启动失败', error);
    dialog.showErrorBox(
      'ImageViewer 启动失败',
      `${message}\n\n请确认用户数据目录可写，并运行 \`npm run check:env\` 检查环境。`,
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-root', async (event) => {
  const requestWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;

  if (!requestWindow) {
    return null;
  }

  let result;
  try {
    result = await dialog.showOpenDialog(requestWindow, {
      properties: ['openDirectory'],
      title: 'Select media directory',
    });
  } catch (error) {
    console.error('Failed to show open dialog', error);
    return null;
  }

  if (!result || result.canceled || !result.filePaths.length) {
    return null;
  }

  const root = result.filePaths[0];
  try {
    const leaves = await collectLeafDirectories(root);
    const tags = await recordRootTag(root);
    return { root, leaves, tags };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('get-demo-data', () => demoMode ? {
  root: '演示资料库（仅虚拟元数据）',
  leaves: DEMO_LEAVES,
} : null);

ipcMain.handle('scan-directory', async (_event, rootPath) => {
  if (!rootPath) {
    return [];
  }

  try {
    return { leaves: await collectLeafDirectories(rootPath) };
  } catch (error) {
    return { leaves: [], error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('list-media-files', async (_event, directoryPath, options = {}) => {
  if (!directoryPath) {
    return {
      files: [],
      total: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      error: 'Missing directory path',
    };
  }

  if (demoMode && directoryPath.startsWith('demo://')) {
    const leaf = DEMO_LEAVES.find((item) => item.path === directoryPath);
    return { files: [], total: leaf?.mediaFileCount || 0, offset: 0, nextOffset: 0, hasMore: false };
  }

  try {
    return await listMediaFiles(directoryPath, options);
  } catch (error) {
    console.error('Failed to list media files', error);
    return {
      files: [],
      total: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMain.handle('get-root-tags', async () => {
  return getRootTags();
});

ipcMain.handle('remove-root-tag', async (_event, rootPath) => {
  return removeRootTag(rootPath);
});

ipcMain.handle('open-file', async (_event, filePath) => {
  if (!filePath) {
    return;
  }
  await shell.openPath(filePath);
});

ipcMain.handle('open-directory', async (_event, directoryPath) => {
  if (!directoryPath) {
    return { success: false, error: 'Missing directory path' };
  }

  try {
    const result = await shell.openPath(directoryPath);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to open directory', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
