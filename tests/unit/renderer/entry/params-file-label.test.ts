import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime, resolveParamsDisplayFileName, resolveParamsPresetPath } from '../../../../src/renderer/app/entry/renderer-runtime';

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

describe('resolveParamsDisplayFileName', () => {
  it('prefers params preset view file name over path-derived legacy name', () => {
    const result = resolveParamsDisplayFileName(
      {
        __getParamsPresetView__: () => ({
          fileName: 'a1_standard_v3.0.0-r1.json',
          absolutePath: 'C:\\legacy\\other-name.json'
        })
      } as unknown as Window,
      'C:\\legacy\\other-name.json'
    );

    expect(result).toBe('a1_standard_v3.0.0-r1.json');
  });

  it('falls back to path-derived file name when params preset view is unavailable', () => {
    expect(resolveParamsDisplayFileName({} as Window, 'C:\\legacy\\other-name.json')).toBe('other-name.json');
  });

  it('derives display file name from the resolved modern preset path helper fallback', () => {
    const fallbackPath = resolveParamsPresetPath({} as Window, 'C:\\legacy\\other-name.json');

    expect(resolveParamsDisplayFileName({} as Window, fallbackPath)).toBe('other-name.json');
  });

  it('switches resolved params path and display file name with the selected version context', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');
    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'quick', 'a1_quick_v3.0.0-r1.json');

    expect(resolveParamsPresetPath(targetWindow, 'C:\\legacy\\fallback.json')).toBe('a1_standard_v3.0.0-r1.json');
    expect(resolveParamsDisplayFileName(targetWindow, 'C:\\legacy\\fallback.json')).toBe('a1_standard_v3.0.0-r1.json');

    targetWindow.__syncLegacyContextToModern__?.({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick'
    });

    expect(resolveParamsPresetPath(targetWindow, 'C:\\legacy\\fallback.json')).toBe('a1_quick_v3.0.0-r1.json');
    expect(resolveParamsDisplayFileName(targetWindow, 'C:\\legacy\\fallback.json')).toBe('a1_quick_v3.0.0-r1.json');
  });
});
