const test = require('node:test');
const assert = require('node:assert/strict');
const { validateVersions } = require('../scripts/check-environment');
const { actionableFileError } = require('../src/main/errors');

test('accepts supported runtime versions', () => {
  assert.deepEqual(validateVersions('v20.18.1', '3.10.0'), []);
  assert.deepEqual(validateVersions('v22.9.0', '3.13.2'), []);
});

test('rejects unsupported runtime versions with installation guidance', () => {
  assert.match(validateVersions('v18.20.0', '3.9.0').join(' '), /20.18.1 至 22.x/);
  assert.match(validateVersions('v20.18.1', '3.14.0').join(' '), /Python 3.10/);
});

test('turns filesystem errors into actionable Chinese messages', () => {
  assert.match(actionableFileError({ code: 'ENOENT' }, '/missing'), /重新选择/);
  assert.match(actionableFileError({ code: 'EACCES' }, '/private'), /授予访问权限/);
  assert.match(actionableFileError({ code: 'EROFS' }, '/readonly', '写入数据库'), /可写位置/);
});
