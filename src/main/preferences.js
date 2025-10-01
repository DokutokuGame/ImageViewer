const fs = require('fs');
const path = require('path');

let storePath;
let state = { rootTags: [] };
let initialised = false;

function sanitiseState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { rootTags: [] };
  }
  const tags = Array.isArray(raw.rootTags) ? raw.rootTags : [];
  const seen = new Set();
  const normalised = [];
  for (const tag of tags) {
    if (!tag || typeof tag.path !== 'string') {
      continue;
    }
    const trimmedPath = tag.path.trim();
    if (!trimmedPath || seen.has(trimmedPath)) {
      continue;
    }
    seen.add(trimmedPath);
    normalised.push({
      path: trimmedPath,
      addedAt: typeof tag.addedAt === 'string' ? tag.addedAt : new Date().toISOString(),
    });
  }
  return { rootTags: normalised };
}

async function initPreferences(app) {
  if (initialised) {
    return;
  }

  storePath = path.join(app.getPath('userData'), 'preferences.json');

  try {
    const raw = await fs.promises.readFile(storePath, 'utf8');
    state = sanitiseState(JSON.parse(raw));
  } catch (error) {
    state = { rootTags: [] };
    if (error.code !== 'ENOENT') {
      console.warn('Failed to read preferences file', error);
    }
  }

  initialised = true;
}

function ensureInitialised() {
  if (!initialised) {
    throw new Error('Preferences have not been initialised');
  }
}

async function persist() {
  ensureInitialised();
  const directory = path.dirname(storePath);
  await fs.promises.mkdir(directory, { recursive: true });
  const payload = JSON.stringify(state, null, 2);
  await fs.promises.writeFile(storePath, payload, 'utf8');
}

function getRootTags() {
  ensureInitialised();
  return state.rootTags.map((tag) => ({ ...tag }));
}

async function recordRootTag(rootPath) {
  ensureInitialised();
  if (!rootPath || typeof rootPath !== 'string') {
    return getRootTags();
  }

  const existing = state.rootTags.find((tag) => tag.path === rootPath);
  if (!existing) {
    state.rootTags.push({ path: rootPath, addedAt: new Date().toISOString() });
    await persist();
  }

  return getRootTags();
}

async function removeRootTag(rootPath) {
  ensureInitialised();
  if (!rootPath || typeof rootPath !== 'string') {
    return getRootTags();
  }

  const beforeLength = state.rootTags.length;
  state.rootTags = state.rootTags.filter((tag) => tag.path !== rootPath);

  if (state.rootTags.length !== beforeLength) {
    await persist();
  }

  return getRootTags();
}

module.exports = {
  initPreferences,
  getRootTags,
  recordRootTag,
  removeRootTag,
};
