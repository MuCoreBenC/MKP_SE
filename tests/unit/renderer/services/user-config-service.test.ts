import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { StorageAdapter } from '../../../../src/renderer/app/adapters/storage-adapter';
import {
  BrowserUserConfigStorage,
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
          SYNC_KEYS.userConfig,
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
