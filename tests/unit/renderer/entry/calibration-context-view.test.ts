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
          supportedVersions: ['standard'],
          defaultPresets: {
            standard: 'a1_standard_v3.0.0-r1.json'
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

describe('calibration context view bridge', () => {
  it('exposes printer, version and active preset path for calibration pages', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getCalibrationContextView__?.()).toMatchObject({
      printerId: 'a1',
      versionType: 'standard',
      presetPath: 'a1_standard_v3.0.0-r1.json'
    });
  });

  it('stays aligned with the active preset view family for the same selected context', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getCalibrationContextView__?.()).toMatchObject({
      printerId: 'a1',
      versionType: 'standard',
      presetPath: targetWindow.__getActivePresetView__?.()?.absolutePath
    });
  });
});
