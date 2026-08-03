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
