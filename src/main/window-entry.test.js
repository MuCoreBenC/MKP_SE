const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDevServerPageUrl,
  resolveWindowEntryTarget,
} = require('./window-entry.cjs');

test('buildDevServerPageUrl keeps main window root url', () => {
  assert.equal(
    buildDevServerPageUrl('http://127.0.0.1:5173', 'index.html'),
    'http://127.0.0.1:5173',
  );
  assert.equal(
    buildDevServerPageUrl('http://127.0.0.1:5173/', 'index.html'),
    'http://127.0.0.1:5173',
  );
});

test('buildDevServerPageUrl appends standalone pages', () => {
  assert.equal(
    buildDevServerPageUrl('http://127.0.0.1:5173', 'release_center.html'),
    'http://127.0.0.1:5173/release_center.html',
  );
});

test('resolveWindowEntryTarget prefers dev server when available', () => {
  assert.deepEqual(
    resolveWindowEntryTarget({
      devServerUrl: 'http://127.0.0.1:5173',
      distHtmlPath: 'dist/release_center.html',
      legacyHtmlPath: 'src/renderer/release_center.html',
      pageName: 'release_center.html',
      fsExistsSync: () => true,
    }),
    {
      kind: 'url',
      target: 'http://127.0.0.1:5173/release_center.html',
    },
  );
});

test('resolveWindowEntryTarget falls back to dist file before legacy file', () => {
  assert.deepEqual(
    resolveWindowEntryTarget({
      devServerUrl: '',
      distHtmlPath: 'dist/release_center.html',
      legacyHtmlPath: 'src/renderer/release_center.html',
      pageName: 'release_center.html',
      fsExistsSync: (filePath) => filePath === 'dist/release_center.html',
    }),
    {
      kind: 'file',
      target: 'dist/release_center.html',
    },
  );
});

test('resolveWindowEntryTarget falls back to legacy file when dist is missing', () => {
  assert.deepEqual(
    resolveWindowEntryTarget({
      devServerUrl: '',
      distHtmlPath: 'dist/release_center.html',
      legacyHtmlPath: 'src/renderer/release_center.html',
      pageName: 'release_center.html',
      fsExistsSync: () => false,
    }),
    {
      kind: 'file',
      target: 'src/renderer/release_center.html',
    },
  );
});
