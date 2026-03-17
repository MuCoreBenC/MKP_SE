import { describe, expect, it, vi } from 'vitest';

import { createRendererApp } from '../../../../src/renderer/app/entry/renderer-entry';
import type { PresetSchema } from '../../../../src/renderer/app/schemas/preset-schema';

const now = '2026-03-15T00:00:00.000Z';

function createOptions() {
  return {
    storage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    } as unknown as Storage,
    packageVersion: '0.2.10',
    presetSources: {
      builtin: { list: () => [], write: vi.fn() },
      user: { list: () => [], write: vi.fn() }
    },
    catalogSources: {
      builtin: {
        read: () => ({
          brands: [
            {
              id: 'bambu',
              displayName: 'Bambu Lab',
              shortName: 'Bambu',
              subtitle: '',
              imageRef: 'builtin/bambu.webp',
              favorite: true,
              pinned: true,
              disabled: false,
              builtin: true,
              canDelete: false,
              sortOrder: 10,
              createdAt: now,
              updatedAt: now
            }
          ],
          printers: []
        })
      },
      user: {
        read: () => ({ brands: [], printers: [] }),
        write: vi.fn()
      }
    },
    defaultResourceSource: {
      readPreset: () => ({
        fileName: 'a1_standard.json',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' } satisfies PresetSchema
      }),
      writePreset: vi.fn()
    },
    windowObject: {
      addEventListener: vi.fn()
    } as unknown as Window
  };
}

describe('createRendererApp', () => {
  it('creates the bootstrapped app and binds the storage listener', () => {
    const options = createOptions();
    const app = createRendererApp(options);

    expect(app.container.controllers.homeController.getHomeViewModel('bambu').brands[0]?.id).toBe('bambu');
    expect(options.windowObject.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(options.windowObject.mkpModernApp).toBe(app.container);
    expect(options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').brands[0]?.id).toBe('bambu');
    expect(options.windowObject.__MKP_MODERN_BRIDGE__?.getActivePreset('a1', 'standard')).toBeNull();
  });

  it('returns the same container instance through both window bridge entry points', () => {
    const options = createOptions();
    const app = createRendererApp(options);

    expect(options.windowObject.mkpModernApp).toBe(app.container);
    expect(options.windowObject.__MKP_MODERN_BRIDGE__).toBeDefined();
    expect(options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu')).toEqual(
      app.container.controllers.homeController.getHomeViewModel('bambu')
    );
  });

  it('exposes a home view model with display semantics for legacy home consumers', () => {
    const options = createOptions();

    createRendererApp(options);

    const viewModel = options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu');

    expect(viewModel?.brands[0]).toEqual(expect.objectContaining({
      id: 'bambu',
      displayName: 'Bambu Lab',
      shortName: 'Bambu',
      favorite: true,
      pinned: true
    }));
  });

  it('keeps bridge-selected context and controller home view model in sync', () => {
    const options = createOptions();
    const app = createRendererApp(options);

    options.windowObject.__MKP_MODERN_BRIDGE__?.selectPrinterContext('bambu', 'a1', 'standard');

    const viewModel = app.container.controllers.homeController.getHomeViewModel('bambu');

    expect(viewModel.brands).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'bambu' })]));
    expect(viewModel.printers).toEqual([]);
    expect(app.container.stores.userConfigStore.getSnapshot()).toEqual(expect.objectContaining({
      selectedBrandId: 'bambu',
      selectedPrinterId: 'a1',
      selectedVersionType: 'standard'
    }));
  });

  it('keeps legacy bridge home brands readable right after renderer entry bootstraps', () => {
    const options = createOptions();

    createRendererApp(options);

    const brands = options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').brands;

    expect(brands).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bambu', displayName: 'Bambu Lab', shortName: 'Bambu' })
    ]));
  });
});
