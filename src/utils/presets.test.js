import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPresetDownloadUrls,
  collectLocalPresetMatchers,
  mapLocalPresetRecords,
  mapManifestPresetsToOnlineList,
  mapManifestToMatchedPresets,
  matchesLocalPresetForPrinter,
  sortLocalPresets,
} from './presets.js';

test('collectLocalPresetMatchers accepts manifest and version prefixes', () => {
  const matcher = collectLocalPresetMatchers(
    { id: 'a1', defaultPresets: { standard: 'a1_standard_v3.0.0.json' } },
    'standard',
    [{ file: 'a1_standard_v3.1.0.json' }],
  );

  assert.equal(matchesLocalPresetForPrinter('a1_standard_v3.0.0.json', matcher), true);
  assert.equal(matchesLocalPresetForPrinter('a1_standard_v3.1.0_copy.json', matcher), true);
  assert.equal(matchesLocalPresetForPrinter('p1s_lite_v1.0.0.json', matcher), false);
});

test('mapManifestToMatchedPresets filters by printer and version type', () => {
  const manifest = {
    presets: [
      { id: 'a1', file: 'a1_standard_v3.1.0.json', version: '3.1.0' },
      { id: 'a1', file: 'a1_quick_v3.1.0.json', version: '3.1.0' },
      { id: 'p1s', file: 'p1s_lite_v2.0.0.json', version: '2.0.0' },
    ],
  };

  const matched = mapManifestToMatchedPresets(manifest, 'a1', 'standard');

  assert.equal(matched.length, 1);
  assert.equal(matched[0].file, 'a1_standard_v3.1.0.json');
});

test('mapManifestPresetsToOnlineList creates current page list structure', () => {
  const list = mapManifestPresetsToOnlineList([
    {
      file: 'a1_standard_v3.1.0.json',
      version: '3.1.0',
      releaseNotes: ['fix'],
      lastModified: '2024-06-20',
    },
  ]);

  assert.deepEqual(list[0], {
    id: 'v3.1.0',
    version: '3.1.0',
    realVersion: '3.1.0',
    date: '2024-06-20',
    isLatest: true,
    fileName: 'a1_standard_v3.1.0.json',
    displayTitle: 'a1_standard_v3.1.0 v3.1.0',
    changes: ['fix'],
  });
});

test('mapLocalPresetRecords prefers custom name and exact manifest release notes', () => {
  const list = mapLocalPresetRecords(
    [
      {
        fileName: 'a1_standard_v3.1.0.json',
        customName: '我的常用配置',
        displayName: 'A1 Standard',
        realVersion: '3.1.0',
        modifiedAt: 200,
        createdAt: 100,
        size: 5120,
      },
    ],
    {
      id: 'a1',
    },
    'standard',
    [
      {
        file: 'a1_standard_v3.1.0.json',
        releaseNotes: ['修复风扇参数'],
      },
    ],
  );

  assert.deepEqual(list, [
    {
      id: 'a1_standard_v3.1.0.json',
      fileName: 'a1_standard_v3.1.0.json',
      displayTitle: '我的常用配置',
      realVersion: '3.1.0',
      modifiedAt: 200,
      createdAt: 100,
      size: 5120,
      changes: ['修复风扇参数'],
    },
  ]);
});

test('mapLocalPresetRecords falls back to original base version notes for renamed copies', () => {
  const list = mapLocalPresetRecords(
    [
      {
        fileName: 'a1_standard_my_copy.json',
        customName: null,
        displayName: 'A1 Profile Copy',
        realVersion: '3.0.0',
        modifiedAt: 300,
        createdAt: 120,
        size: 4096,
      },
    ],
    {
      id: 'a1',
    },
    'standard',
    [
      {
        file: 'a1_standard_v3.0.0.json',
        releaseNotes: ['同步到原始版本说明'],
      },
    ],
  );

  assert.equal(list[0].displayTitle, 'A1 Profile Copy');
  assert.deepEqual(list[0].changes, ['同步到原始版本说明']);
});

test('buildPresetDownloadUrls keeps mirror fallback order', () => {
  const urls = buildPresetDownloadUrls('a1_standard_v3.1.0.json');

  assert.equal(urls.length, 3);
  assert.match(urls[0], /gitee/);
  assert.match(urls[1], /jsdelivr/i);
  assert.match(urls[2], /github/);
  assert.match(urls[0], /a1_standard_v3\.1\.0\.json$/);
});

test('sortLocalPresets keeps pinned items first and respects updated-desc', () => {
  const items = [
    { fileName: 'b.json', displayTitle: 'B', modifiedAt: 100, realVersion: '1.0.0' },
    { fileName: 'a.json', displayTitle: 'A', modifiedAt: 200, realVersion: '1.0.0' },
  ];

  const sorted = sortLocalPresets(items, {
    pinnedSet: new Set(['b.json']),
    sortMode: 'updated-desc',
  });

  assert.deepEqual(
    sorted.map((item) => item.fileName),
    ['b.json', 'a.json'],
  );
});
