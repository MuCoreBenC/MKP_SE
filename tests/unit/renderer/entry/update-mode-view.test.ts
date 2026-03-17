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

describe('update mode bridge', () => {
  it('exposes current update mode for legacy updates page code', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setUpdateMode('auto');

    expect(targetWindow.__getUpdateModeView__?.()).toBe('auto');
  });

  it('lets legacy updates page code persist update mode through the modern user config service', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    targetWindow.__setUpdateModeForLegacy__?.('auto');

    expect(runtime.container.stores.userConfigStore.getSnapshot().updateMode).toBe('auto');
    expect(targetWindow.__getUpdateModeView__?.()).toBe('auto');
  });
});
