const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const i18n = require('../renderer/i18n');

test('English is the default locale and supports interpolation', () => {
  assert.equal(i18n.getLocale(), 'en');
  assert.equal(i18n.t('appTitle'), 'Local Media Browser');
  assert.equal(i18n.t('itemCount', { count: 12 }), '12 items');
});

test('English and Simplified Chinese dictionaries contain the same terms', () => {
  assert.deepEqual(
    Object.keys(i18n.translations.en).sort(),
    Object.keys(i18n.translations['zh-CN']).sort(),
  );
  assert.equal(i18n.setLocale('zh-CN'), 'zh-CN');
  assert.equal(i18n.t('appTitle'), '本地媒体浏览器');
  assert.equal(i18n.t('itemCount', { count: 12 }), '12 个项目');
});

test('main page declares English and loads translations before the renderer', () => {
  const html = fs.readFileSync(path.resolve('renderer/index.html'), 'utf8');

  assert.match(html, /<html lang="en">/);
  assert.match(html, /data-i18n="appTitle">Local Media Browser</);
  assert.ok(html.indexOf('src="i18n.js"') < html.indexOf('src="renderer.js"'));
});
