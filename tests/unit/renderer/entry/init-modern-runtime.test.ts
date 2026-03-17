import { describe, expect, it, vi } from 'vitest';

import { initModernRuntime } from '../../../../src/renderer/app/entry/init-modern-runtime';

const now = '2026-03-15T00:00:00.000Z';

describe('initModernRuntime', () => {
  it('creates renderer app using browser globals by default', () => {
    const addEventListener = vi.fn();
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() } as unknown as Storage;
    const defaultResourceSource = {
      readPreset: vi.fn(() => ({ fileName: 'a1_standard.json', content: { version: '3.0.0-r1' } })),
      writePreset: vi.fn()
    };

    const originalWindow = globalThis.window;
    const fakeWindow = { addEventListener, localStorage: storage } as unknown as Window & typeof globalThis;
    globalThis.window = fakeWindow;

    try {
      const app = initModernRuntime({
        packageVersion: '0.2.10',
        presetSources: {
          builtin: { list: () => [], write: vi.fn() },
          user: { list: () => [], write: vi.fn() }
        },
        catalogSources: {
          builtin: { read: () => ({ brands: [], printers: [] }) },
          user: { read: () => ({ brands: [], printers: [] }), write: vi.fn() }
        },
        defaultResourceSource
      });

      expect(app.container.services.versionService.getCurrentVersion('0.2.10')).toBe('0.2.10');
      expect(fakeWindow.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(fakeWindow.mkpModernApp).toBe(app.container);
    } finally {
      globalThis.window = originalWindow as Window & typeof globalThis;
    }
  });

  it('prefers explicit storage and window overrides when provided', () => {
    const overrideStorage = { getItem: vi.fn(() => null), setItem: vi.fn() } as unknown as Storage;
    const windowStorage = { getItem: vi.fn(() => 'wrong'), setItem: vi.fn() } as unknown as Storage;
    const overrideWindow = {
      addEventListener: vi.fn(),
      localStorage: windowStorage
    } as unknown as Window;

    const app = initModernRuntime({
      storage: overrideStorage,
      windowObject: overrideWindow,
      packageVersion: '0.2.10',
      presetSources: {
        builtin: { list: () => [], write: vi.fn() },
        user: { list: () => [], write: vi.fn() }
      },
      catalogSources: {
        builtin: { read: () => ({ brands: [], printers: [] }) },
        user: { read: () => ({ brands: [], printers: [] }), write: vi.fn() }
      },
      defaultResourceSource: {
        readPreset: vi.fn(() => ({ fileName: 'a1_standard.json', content: { version: '3.0.0-r1' } })),
        writePreset: vi.fn()
      }
    });

    app.container.syncService.broadcast('mkp:test', app.container.syncService.createMessage('x', { ok: true }));

    expect(overrideStorage.setItem).toHaveBeenCalled();
    expect(windowStorage.setItem).not.toHaveBeenCalled();
    expect(overrideWindow.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    expect((overrideWindow as Window & typeof globalThis).mkpModernApp).toBe(app.container);
  });

  it('exposes a bridge home view model immediately after initialization', () => {
    const overrideWindow = {
      addEventListener: vi.fn(),
      localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() }
    } as unknown as Window;

    initModernRuntime({
      windowObject: overrideWindow,
      packageVersion: '0.2.10',
      presetSources: {
        builtin: { list: () => [], write: vi.fn() },
        user: { list: () => [], write: vi.fn() }
      },
      catalogSources: {
        builtin: {
          read: () => ({
            brands: [{
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
            }],
            printers: []
          })
        },
        user: { read: () => ({ brands: [], printers: [] }), write: vi.fn() }
      },
      defaultResourceSource: {
        readPreset: vi.fn(() => ({ fileName: 'a1_standard.json', content: { version: '3.0.0-r1' } })),
        writePreset: vi.fn()
      }
    });

    expect((overrideWindow as Window & typeof globalThis).__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').brands[0]).toEqual(
      expect.objectContaining({ id: 'bambu', displayName: 'Bambu Lab', shortName: 'Bambu' })
    );
  });
});
