import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPatchUrlCandidates,
  compareVersions,
  computeAppUpdateState,
  parseManifestToVersionEntries,
} from './versioning.js';

test('compareVersions handles semantic and suffix versions', () => {
  assert.equal(compareVersions('3.0.1', '3.0.0'), 1);
  assert.equal(compareVersions('v3.0.0-r2', '3.0.0-r1'), 1);
  assert.equal(compareVersions('3.0.0-alpha', '3.0.0'), 1);
  assert.equal(compareVersions('3.0.0', '3.0.0'), 0);
});

test('parseManifestToVersionEntries maps latest and history entries', () => {
  const manifest = {
    latestVersion: '0.3.0',
    releaseDate: '2024-06-20',
    shortDesc: 'latest',
    releaseNotes: ['a', 'b'],
    downloadUrl: 'https://example.com/app_v0.3.0.zip',
    history: [
      {
        version: '0.2.0',
        releaseDate: '2024-06-10',
        shortDesc: 'history',
        releaseNotes: ['c'],
      },
    ],
  };

  const entries = parseManifestToVersionEntries(manifest, '0.2.0');

  assert.deepEqual(entries[0], {
    version: '0.3.0',
    date: '2024-06-20',
    desc: 'latest',
    status: 'LATEST',
    current: false,
    canRollback: true,
    details: ['a', 'b'],
    downloadUrl: 'https://example.com/app_v0.3.0.zip',
  });
  assert.equal(entries[1].status, 'RUNNING');
  assert.equal(entries[1].current, true);
});

test('computeAppUpdateState flags updates correctly', () => {
  const state = computeAppUpdateState({ latestVersion: '0.3.0' }, '0.2.0');

  assert.equal(state.latestVersion, '0.3.0');
  assert.equal(state.hasUpdate, true);
  assert.equal(typeof state.checkedAt, 'number');
});

test('buildPatchUrlCandidates preserves download url and appends mirrors', () => {
  const urls = buildPatchUrlCandidates(
    'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main/cloud_data/app_v0.3.0.zip',
  );

  assert.equal(urls[0], 'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main/cloud_data/app_v0.3.0.zip');
  assert.equal(urls.length, 3);
  assert.match(urls[1], /gitee/);
  assert.match(urls[2], /jsdelivr/i);
});
