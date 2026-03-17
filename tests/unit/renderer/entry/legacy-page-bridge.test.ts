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
      builtin: {
        list: () => [
          {
            fileName: 'a1_standard.json',
            absolutePath: 'C:\\presets\\a1_standard.json',
            storageLayer: 'builtin' as const,
            content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' } satisfies PresetSchema,
            updatedAt: now
          }
        ],
        write: vi.fn()
      },
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
              subtitle: 'Printer Gallery',
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
          printers: [
            {
              id: 'a1',
              brandId: 'bambu',
              displayName: 'A1',
              shortName: 'A1',
              subtitle: '',
              imageRef: 'builtin/a1.webp',
              supportedVersionTypes: ['standard' as const],
              defaultPresetRefs: { standard: 'a1_standard.json' },
              favorite: true,
              pinned: true,
              disabled: false,
              builtin: true,
              canDelete: false,
              sortOrder: 10,
              createdAt: now,
              updatedAt: now
            }
          ]
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

describe('legacy page bridge compatibility', () => {
  it('provides home bridge APIs expected by legacy home page scripts', () => {
    const options = createOptions();
    const app = createRendererApp(options);
    const bridge = options.windowObject.__MKP_MODERN_BRIDGE__;

    expect(bridge).toBeDefined();
    expect(bridge?.getHomeViewModel('bambu')).toMatchObject({
      brands: [expect.objectContaining({ id: 'bambu' })],
      printers: [expect.objectContaining({ id: 'a1', brandId: 'bambu' })]
    });

    bridge?.selectPrinterContext('bambu', 'a1', 'standard');

    expect(app.container.stores.userConfigStore.getSnapshot()).toMatchObject({
      selectedBrandId: 'bambu',
      selectedPrinterId: 'a1',
      selectedVersionType: 'standard'
    });
  });

  it('provides preset bridge APIs expected by legacy presets page scripts', () => {
    const options = createOptions();
    createRendererApp(options);
    const bridge = options.windowObject.__MKP_MODERN_BRIDGE__;

    expect(bridge?.getPresetList('a1', 'standard')).toEqual([
      expect.objectContaining({
        fileName: 'a1_standard.json',
        absolutePath: 'C:\\presets\\a1_standard.json',
        storageLayer: 'builtin'
      })
    ]);
    expect(bridge?.getActivePreset('a1', 'standard')).toBeNull();
  });

  it('provides updates bridge APIs expected by legacy updates page scripts', () => {
    const options = createOptions();
    createRendererApp(options);
    const bridge = options.windowObject.__MKP_MODERN_BRIDGE__;
    const manifest = {
      latestVersion: '0.2.11',
      releaseDate: '2026-03-16',
      shortDesc: 'Bug fixes',
      releaseNotes: ['Fix bridge compatibility'],
      downloadUrl: 'https://example.com/patch.zip'
    };

    expect(bridge?.parseUpdateManifest(manifest)).toMatchObject({
      latestVersion: '0.2.11'
    });
    expect(bridge?.checkUpdates('0.2.10', manifest)).toMatchObject({
      hasUpdate: true,
      latestVersion: '0.2.11'
    });
  });

  it('keeps home bridge display semantics stable for legacy brand rendering', () => {
    const options = createOptions();
    createRendererApp(options);

    const brand = options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').brands[0];

    expect(brand).toEqual(expect.objectContaining({
      id: 'bambu',
      displayName: 'Bambu Lab',
      shortName: 'Bambu',
      subtitle: 'Printer Gallery',
      favorite: true,
      pinned: true
    }));
  });

  it('keeps home bridge printer semantics stable for legacy printer rendering', () => {
    const options = createOptions();
    createRendererApp(options);

    const printer = options.windowObject.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').printers[0];

    expect(printer).toEqual(expect.objectContaining({
      id: 'a1',
      brandId: 'bambu',
      displayName: 'A1',
      shortName: 'A1',
      favorite: true,
      pinned: true,
      supportedVersionTypes: ['standard']
    }));
  });
});
