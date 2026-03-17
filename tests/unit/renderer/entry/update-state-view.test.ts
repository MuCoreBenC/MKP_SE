import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [{ id: 'bambu', name: 'Bambu Lab', shortName: 'Bambu Lab', subtitle: 'Printer Gallery', favorite: true }],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: 'assets/images/a1.webp',
          favorite: true,
          supportedVersions: ['standard', 'quick'],
          defaultPresets: {
            standard: 'a1_standard_v3.0.0-r1.json',
            quick: 'a1_quick_v3.0.0-r1.json'
          }
        }
      ]
    },
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      })
    },
    addEventListener: vi.fn()
  } as unknown as Window & typeof globalThis;
}

describe('update state view bridge', () => {
  it('exposes update store state for legacy update badge and cooldown logic', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.updateStore.setRemoteState('0.2.11', true, {
      latestVersion: '0.2.11',
      updateType: 'hot_update',
      downloadUrl: 'https://example.com/patch.zip',
      forceUpdate: false,
      releaseDate: '2026-03-16',
      shortDesc: 'Bug fixes',
      canRollback: false,
      releaseNotes: [],
      releaseNotesMarkdown: '',
      history: []
    });

    expect(targetWindow.__getAppUpdateStateView__?.()).toMatchObject({
      currentVersion: '0.2.10',
      latestVersion: '0.2.11',
      hasUpdate: true
    });
    expect(targetWindow.__getAppUpdateStateView__?.()?.checkedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
