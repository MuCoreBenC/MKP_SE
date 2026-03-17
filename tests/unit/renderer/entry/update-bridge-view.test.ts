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

describe('legacy update bridge view', () => {
  it('exposes a normalized manifest parser for legacy updates page code', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    expect(
      targetWindow.__parseUpdateManifestForLegacy__?.({
        latestVersion: '0.2.11',
        downloadUrl: 'https://example.com/patch.zip',
        releaseDate: '2026-03-16',
        shortDesc: 'Bug fixes'
      })
    ).toMatchObject({
      latestVersion: '0.2.11',
      updateType: 'hot_update',
      forceUpdate: false,
      canRollback: false,
      releaseNotes: []
    });
  });

  it('exposes update check results for legacy updates page code', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    const result = targetWindow.__checkAppUpdateForLegacy__?.('0.2.10', {
      latestVersion: '0.2.11',
      downloadUrl: 'https://example.com/patch.zip',
      releaseDate: '2026-03-16',
      shortDesc: 'Bug fixes'
    });

    expect(result).toMatchObject({
      currentVersion: '0.2.10',
      latestVersion: '0.2.11',
      hasUpdate: true
    });
    expect(runtime.container.stores.updateStore.getSnapshot()).toMatchObject({
      latestVersion: '0.2.11',
      hasUpdate: true
    });
  });

  it('keeps parsed legacy manifest shape readable through the cached update manifest view family', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    targetWindow.__checkAppUpdateForLegacy__?.('0.2.10', {
      latestVersion: '0.2.11',
      downloadUrl: 'https://example.com/patch.zip',
      releaseDate: '2026-03-16',
      shortDesc: 'Bug fixes'
    });

    expect(targetWindow.__getCachedUpdateManifestView__?.()).toMatchObject({
      latestVersion: '0.2.11',
      shortDesc: 'Bug fixes'
    });
  });
});
