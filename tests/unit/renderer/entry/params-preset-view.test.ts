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

describe('params preset view bridge', () => {
  it('exposes current preset info for the params page from modern state', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getParamsPresetView__?.()).toMatchObject({
      fileName: 'a1_standard_v3.0.0-r1.json',
      absolutePath: 'a1_standard_v3.0.0-r1.json'
    });
  });

  it('remains stable after preset cache-like updates because it resolves from active preset mapping', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getParamsPresetView__?.()?.fileName).toBe('a1_standard_v3.0.0-r1.json');
    expect(targetWindow.__getActivePresetView__?.()?.fileName).toBe('a1_standard_v3.0.0-r1.json');
  });

  it('keeps params preset view aligned with active preset view after version changes', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');
    runtime.container.stores.userConfigStore.selectContext('bambu', 'a1', 'standard');

    expect(targetWindow.__getParamsPresetView__?.()).toEqual(targetWindow.__getActivePresetView__?.());
  });

  it('keeps params preset file path aligned with calibration preset path for the same active preset', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json');

    expect(targetWindow.__getParamsPresetView__?.()?.absolutePath).toBe(
      targetWindow.__getCalibrationContextView__?.()?.presetPath
    );
  });
});
