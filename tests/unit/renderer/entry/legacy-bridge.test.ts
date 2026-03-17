import { describe, expect, it, vi } from 'vitest';

import { installLegacyBridge, installLegacyBridgeOn } from '../../../../src/renderer/app/entry/legacy-bridge';

type LegacyBridgeContainer = Parameters<typeof installLegacyBridgeOn>[1];

describe('installLegacyBridge', () => {
  it('exposes container-backed legacy bridge methods on target window', () => {
    const fakeWindow = {} as Window & typeof globalThis;
    const container = {
      controllers: {
        homeController: {
          getHomeViewModel: vi.fn(() => ({ brands: [{ id: 'bambu' }], printers: [] })),
          selectPrinterContext: vi.fn()
        },
        presetsController: {
          getPresetList: vi.fn(() => [{ fileName: 'a1_standard.json' }]),
          getActivePreset: vi.fn(() => ({ fileName: 'a1_standard.json' }))
        },
        updatesController: {
          check: vi.fn(() => ({ hasUpdate: true })),
          parseManifest: vi.fn(() => ({ latestVersion: '0.2.11' }))
        }
      }
    } as unknown as LegacyBridgeContainer;

    installLegacyBridgeOn(fakeWindow, container);

    expect(fakeWindow.mkpModernApp).toBe(container);
    expect(fakeWindow.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu')).toEqual({
      brands: [{ id: 'bambu' }],
      printers: []
    });
    expect(fakeWindow.__MKP_MODERN_BRIDGE__?.getPresetList('a1', 'standard')).toEqual([
      { fileName: 'a1_standard.json' }
    ]);
    expect(fakeWindow.__MKP_MODERN_BRIDGE__?.getActivePreset('a1', 'standard')).toEqual({
      fileName: 'a1_standard.json'
    });
    expect(fakeWindow.__MKP_MODERN_BRIDGE__?.checkUpdates('0.2.10', { latestVersion: '0.2.11' })).toEqual({
      hasUpdate: true
    });
    expect(fakeWindow.__MKP_MODERN_BRIDGE__?.parseUpdateManifest({ latestVersion: '0.2.11' })).toEqual({
      latestVersion: '0.2.11'
    });
    expect(container.controllers.homeController.getHomeViewModel).toHaveBeenCalledWith('bambu');
    expect(container.controllers.presetsController.getPresetList).toHaveBeenCalledWith('a1', 'standard');
    expect(container.controllers.presetsController.getActivePreset).toHaveBeenCalledWith('a1', 'standard');
    expect(container.controllers.updatesController.check).toHaveBeenCalledWith('0.2.10', {
      latestVersion: '0.2.11'
    });
    expect(container.controllers.updatesController.parseManifest).toHaveBeenCalledWith({ latestVersion: '0.2.11' });

    fakeWindow.__MKP_MODERN_BRIDGE__?.selectPrinterContext('bambu', 'a1', 'standard');
    expect(container.controllers.homeController.selectPrinterContext).toHaveBeenCalledWith('bambu', 'a1', 'standard');
  });

  it('does nothing when global window is unavailable', () => {
    expect(() => installLegacyBridge({} as LegacyBridgeContainer)).not.toThrow();
  });
});
