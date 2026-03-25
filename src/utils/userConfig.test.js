import test from 'node:test';
import assert from 'node:assert/strict';

import {
  USER_CONFIG_KEY,
  readUserConfig,
  resolvePersistedVersionForPrinter,
  writeUserConfig,
} from './userConfig.js';

function installLocalStorageMock(initialState = {}) {
  const store = new Map(Object.entries(initialState));

  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  return store;
}

test('readUserConfig falls back to empty object', () => {
  installLocalStorageMock();
  assert.deepEqual(readUserConfig(), {});
});

test('resolvePersistedVersionForPrinter prefers supported version from local storage', () => {
  installLocalStorageMock({
    mkp_current_script_a1_quick: 'a1_quick_v3.0.0.json',
  });

  const resolved = resolvePersistedVersionForPrinter(
    'a1',
    null,
    {
      bambu: [{ id: 'a1', supportedVersions: ['standard', 'quick'] }],
    },
    {},
  );

  assert.equal(resolved, 'quick');
});

test('writeUserConfig merges applied releases and stores config', () => {
  const store = installLocalStorageMock({
    [USER_CONFIG_KEY]: JSON.stringify({
      appliedReleases: {
        a1_standard: 'old',
      },
    }),
    mkp_current_script_a1_quick: 'a1_quick_v3.0.0.json',
  });

  const config = writeUserConfig({
    brandId: 'bambu',
    printerId: 'a1',
    versionType: null,
    appliedReleases: { a1_quick: 'new' },
    printersByBrand: {
      bambu: [{ id: 'a1', supportedVersions: ['standard', 'quick'] }],
    },
  });

  assert.equal(config.version, 'standard');
  assert.deepEqual(config.appliedReleases, {
    a1_standard: 'old',
    a1_quick: 'new',
  });
  assert.ok(store.get(USER_CONFIG_KEY));
});
