import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { StorageAdapter } from '../../../../src/renderer/app/adapters/storage-adapter';
import {
  BrowserUserConfigStorage,
  USER_CONFIG_STORAGE_KEY,
  UserConfigService
} from '../../../../src/renderer/app/services/user-config-service';
import { PresetSessionStore } from '../../../../src/renderer/app/stores/preset-session-store';
import { UserConfigStore } from '../../../../src/renderer/app/stores/user-config-store';
import { CrossWindowSyncService, SYNC_KEYS } from '../../../../src/renderer/app/sync/cross-window-sync-service';

function createMemoryStorage(initial = new Map<string, string>()) {
  return {
    getItem: vi.fn((key: string) => initial.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      initial.set(key, value);
    })
  };
}

describe('UserConfigService', () => {
  it('loads persisted user config through BrowserUserConfigStorage', () => {
    const memory = createMemoryStorage(
      new Map([
        [
          USER_CONFIG_STORAGE_KEY,
          JSON.stringify({
            selectedBrandId: 'anycubic',
            selectedPrinterId: 's1c',
            selectedVersionType: 'lite',
            appliedPresetByContext: {},
            onboardingEnabled: false,
            updateMode: 'manual',
            themeMode: 'dark',
            dockAnimationEnabled: true,
            dockBaseSize: 38,
            dockMaxScale: 1.5,
            updatedAt: '2026-03-15T00:00:00.000Z'
          })
        ]
      ])
    );
    const storage = new BrowserUserConfigStorage(new StorageAdapter(memory));
    const store = new UserConfigStore(storage);

    expect(store.getSnapshot().selectedPrinterId).toBe('s1c');
    expect(store.getSnapshot().themeMode).toBe('dark');
  });

  it('migrates a sync-envelope user config payload instead of crashing on startup', () => {
    const memory = createMemoryStorage(
      new Map([
        [
          SYNC_KEYS.userConfig,
          JSON.stringify({
            type: 'user-config-updated',
            sourceWindowId: 'renderer_a',
            timestamp: 1742083200000,
            payload: {
              selectedBrandId: 'bambu',
              selectedPrinterId: 'a1mini',
              selectedVersionType: 'quick',
              appliedPresetByContext: { a1mini_quick: 'a1mini_quick_v3.0.0-r1.json' },
              onboardingEnabled: false,
              updateMode: 'auto',
              themeMode: 'dark',
              dockAnimationEnabled: true,
              dockBaseSize: 40,
              dockMaxScale: 1.6,
              updatedAt: '2026-03-15T00:00:00.000Z'
            }
          })
        ]
      ])
    );
    const storage = new BrowserUserConfigStorage(new StorageAdapter(memory));
    const store = new UserConfigStore(storage);

    expect(store.getSnapshot().selectedPrinterId).toBe('a1mini');
    expect(store.getSnapshot().selectedVersionType).toBe('quick');
    expect(memory.setItem).toHaveBeenCalledWith(
      USER_CONFIG_STORAGE_KEY,
      expect.stringContaining('"selectedPrinterId":"a1mini"')
    );
  });

  it('migrates the legacy mkp_user_config shape and legacy setting keys into the modern config store', () => {
    const memory = createMemoryStorage(
      new Map([
        [
          'mkp_user_config',
          JSON.stringify({
            brand: 'x1',
            printer: 'x1c',
            version: 'lite',
            appliedReleases: { x1c_lite: 'x1_lite_v2.4.2-r1.json' }
          })
        ],
        ['showOnboarding', 'false'],
        ['update_mode', 'auto'],
        ['themeMode', 'dark'],
        ['setting_dock_anim', 'false'],
        ['setting_dock_size', '44'],
        ['setting_dock_scale', '1.75']
      ])
    );
    const storage = new BrowserUserConfigStorage(new StorageAdapter(memory));
    const store = new UserConfigStore(storage);

    expect(store.getSnapshot()).toMatchObject({
      selectedBrandId: 'x1',
      selectedPrinterId: 'x1c',
      selectedVersionType: 'lite',
      onboardingEnabled: false,
      updateMode: 'auto',
      themeMode: 'dark',
      dockAnimationEnabled: false,
      dockBaseSize: 44,
      dockMaxScale: 1.75
    });
    expect(memory.setItem).toHaveBeenCalledWith(
      USER_CONFIG_STORAGE_KEY,
      expect.stringContaining('"selectedPrinterId":"x1c"')
    );
  });

  it('falls back to a default config when persisted data is corrupt instead of throwing and white-screening', () => {
    const memory = createMemoryStorage(
      new Map([
        [USER_CONFIG_STORAGE_KEY, JSON.stringify({ broken: true })],
        [SYNC_KEYS.userConfig, JSON.stringify({ bad: 'payload' })]
      ])
    );
    const storage = new BrowserUserConfigStorage(new StorageAdapter(memory));
    const store = new UserConfigStore(storage);

    expect(store.getSnapshot()).toMatchObject({
      selectedBrandId: 'bambu',
      selectedPrinterId: 'a1',
      selectedVersionType: 'standard'
    });
    expect(memory.setItem).toHaveBeenCalledWith(
      USER_CONFIG_STORAGE_KEY,
      expect.stringContaining('"selectedPrinterId":"a1"')
    );
  });

  it('emits and broadcasts context changes through the sync layer', () => {
    const memory = createMemoryStorage();
    const adapter = new StorageAdapter(memory);
    const storage = new BrowserUserConfigStorage(adapter);
    const userConfigStore = new UserConfigStore(storage);
    const presetSessionStore = new PresetSessionStore(userConfigStore);
    const eventBus = new AppEventBus();
    const syncService = new CrossWindowSyncService(memory, eventBus, 'renderer_a');
    const service = new UserConfigService(userConfigStore, presetSessionStore, eventBus, syncService);
    const listener = vi.fn();

    eventBus.on('context:changed', listener);

    service.selectContext('bambu', 'a1', 'quick');

    expect(presetSessionStore.getSnapshot().contextKey).toBe('a1_quick');
    expect(listener).toHaveBeenCalledWith({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick',
      contextKey: 'a1_quick'
    });
    expect(memory.setItem).toHaveBeenCalledWith(
      SYNC_KEYS.activeContext,
      expect.stringContaining('context-changed')
    );
    expect(memory.setItem).toHaveBeenCalledWith(
      SYNC_KEYS.userConfig,
      expect.stringContaining('"selectedVersionType":"quick"')
    );
  });

  it('persists and broadcasts update mode changes through the sync layer', () => {
    const memory = createMemoryStorage();
    const adapter = new StorageAdapter(memory);
    const storage = new BrowserUserConfigStorage(adapter);
    const userConfigStore = new UserConfigStore(storage);
    const presetSessionStore = new PresetSessionStore(userConfigStore);
    const eventBus = new AppEventBus();
    const syncService = new CrossWindowSyncService(memory, eventBus, 'renderer_a');
    const service = new UserConfigService(userConfigStore, presetSessionStore, eventBus, syncService);

    service.setUpdateMode('auto');

    expect(userConfigStore.getSnapshot().updateMode).toBe('auto');
    expect(memory.setItem).toHaveBeenCalledWith(
      SYNC_KEYS.userConfig,
      expect.stringContaining('"updateMode":"auto"')
    );
  });
});
