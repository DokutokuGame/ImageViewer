const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { collectLeafDirectories } = require('./directoryScanner');
const {
  initPreferences,
  getRootTags,
  recordRootTag,
  removeRootTag,
} = require('./preferences');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
}

app.whenReady().then(async () => {
  await initPreferences(app);

  createWindow();

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
  const leaves = await collectLeafDirectories(root);
  const tags = await recordRootTag(root);
  return { root, leaves, tags };
});

ipcMain.handle('scan-directory', async (_event, rootPath) => {
  if (!rootPath) {
    return [];
  }

  const leaves = await collectLeafDirectories(rootPath);
  return leaves;
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
