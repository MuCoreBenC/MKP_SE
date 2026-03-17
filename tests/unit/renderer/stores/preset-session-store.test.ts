import { describe, expect, it } from 'vitest';

import { PresetSessionStore } from '../../../../src/renderer/app/stores/preset-session-store';
import { UserConfigStore, type UserConfigStorage } from '../../../../src/renderer/app/stores/user-config-store';

function createStore(): PresetSessionStore {
  const storage: UserConfigStorage = {
    read: () => null,
    write: () => undefined
  };

  return new PresetSessionStore(new UserConfigStore(storage));
}

describe('PresetSessionStore', () => {
  it('keeps a valid context snapshot without null version types', () => {
    const store = createStore();

    store.selectContext('bambu', 'a1', 'quick');

    expect(store.getSnapshot()).toEqual({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick',
      contextKey: 'a1_quick',
      activeFileName: null
    });
  });

  it('tracks active preset within the current context', () => {
    const store = createStore();

    store.selectContext('bambu', 'a1', 'standard');
    store.setAppliedPreset('a1_standard_v3.0.0-r2.json');

    expect(store.getSnapshot().activeFileName).toBe('a1_standard_v3.0.0-r2.json');
  });

  it('switches active preset lookup when the context changes', () => {
    const store = createStore();

    store.selectContext('bambu', 'a1', 'standard');
    store.setAppliedPreset('a1_standard_v3.0.0-r2.json');
    store.selectContext('bambu', 'a1', 'quick');

    expect(store.getSnapshot()).toEqual({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick',
      contextKey: 'a1_quick',
      activeFileName: null
    });
  });
});
