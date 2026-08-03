const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scripts = [
  'scripts/build-windows.ps1',
  'scripts/verify-windows-package.ps1',
];

test('Windows release scripts avoid host-dependent PowerShell features', () => {
  for (const relativePath of scripts) {
    const contents = fs.readFileSync(path.resolve(relativePath));
    assert.equal(contents.toString('ascii'), contents.toString('utf8'), `${relativePath} must be ASCII`);
    assert.doesNotMatch(contents.toString('utf8'), /\bGet-FileHash\b/);
    assert.match(contents.toString('utf8'), /System\.Security\.Cryptography\.SHA256/);
  }
});

test('Windows package includes and verifies project and third-party notices', () => {
  const buildScript = fs.readFileSync(path.resolve('scripts/build-windows.ps1'), 'utf8');
  const verifyScript = fs.readFileSync(path.resolve('scripts/verify-windows-package.ps1'), 'utf8');

  assert.match(buildScript, /LICENSE\.ImageViewer\.txt/);
  assert.match(buildScript, /THIRD_PARTY_NOTICES\.txt/);
  assert.match(verifyScript, /LICENSES\.chromium\.html/);
  assert.match(verifyScript, /LICENSE\.ImageViewer\.txt/);
  assert.match(verifyScript, /THIRD_PARTY_NOTICES\.txt/);
});

test('BrowserWindow keeps renderer privileges isolated', () => {
  const mainProcess = fs.readFileSync(path.resolve('src/main/main.js'), 'utf8');

  assert.match(mainProcess, /contextIsolation:\s*true/);
  assert.match(mainProcess, /nodeIntegration:\s*false/);
  assert.match(mainProcess, /sandbox:\s*true/);
});
