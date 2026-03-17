import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [
      { id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true }
    ],
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

describe('legacy context sync bridge', () => {
  it('lets legacy page state push brand/printer/version back into the modern store', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    targetWindow.__syncLegacyContextToModern__?.({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick'
    });

    expect(runtime.container.stores.userConfigStore.getSnapshot()).toMatchObject({
      selectedBrandId: 'bambu',
      selectedPrinterId: 'a1',
      selectedVersionType: 'quick'
    });
    expect(targetWindow.selectedVersion).toBe('quick');
  });

  it('can hydrate the modern store from already loaded legacy page state', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    targetWindow.selectedBrand = 'bambu';
    targetWindow.selectedPrinter = 'a1';
    targetWindow.selectedVersion = 'quick';

    targetWindow.__hydrateModernContextFromLegacy__?.();

    expect(runtime.container.stores.userConfigStore.getSnapshot()).toMatchObject({
      selectedBrandId: 'bambu',
      selectedPrinterId: 'a1',
      selectedVersionType: 'quick'
    });
  });

  it('keeps download context view aligned after legacy state hydrates the modern store', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    targetWindow.selectedBrand = 'bambu';
    targetWindow.selectedPrinter = 'a1';
    targetWindow.selectedVersion = 'quick';

    targetWindow.__hydrateModernContextFromLegacy__?.();

    expect(targetWindow.__getDownloadContextView__?.()).toMatchObject({
      printer: expect.objectContaining({ id: 'a1' }),
      selectedVersionType: 'quick'
    });
  });
});
