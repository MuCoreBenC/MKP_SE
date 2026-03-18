import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [{ id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true }],
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

describe('active preset view bridge', () => {
  it('exposes the active preset resolved from the modern preset store', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getActivePresetView__?.()).toMatchObject({
      fileName: 'a1_standard_v3.0.0-r1.json'
    });
  });

  it('refreshes active preset view after the selected applied preset mapping changes', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');
    expect(targetWindow.__getActivePresetView__?.()?.fileName).toBe('a1_standard_v3.0.0-r1.json');

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');
    expect(targetWindow.__getActivePresetView__?.()?.absolutePath).toBe('a1_standard_v3.0.0-r1.json');
  });

  it('stays aligned with params preset view for the same selected context', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getActivePresetView__?.()).toEqual(targetWindow.__getParamsPresetView__?.());
  });

  it('switches active preset view with the selected version context instead of holding the previous mapping', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');
    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'quick', 'a1_quick_v3.0.0-r1.json');

    expect(targetWindow.__getActivePresetView__?.()?.fileName).toBe('a1_standard_v3.0.0-r1.json');

    targetWindow.__syncLegacyContextToModern__?.({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick'
    });

    expect(targetWindow.__getDownloadContextView__?.()?.selectedVersionType).toBe('quick');
    expect(targetWindow.__getActivePresetView__?.()?.fileName).toBe('a1_quick_v3.0.0-r1.json');
    expect(targetWindow.__getParamsPresetView__?.()?.fileName).toBe('a1_quick_v3.0.0-r1.json');
  });
});
