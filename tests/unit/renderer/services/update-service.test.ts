import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { SchemaValidationService } from '../../../../src/renderer/app/services/schema-validation-service';
import { UpdateService } from '../../../../src/renderer/app/services/update-service';
import { VersionService } from '../../../../src/renderer/app/services/version-service';
import { UpdateStore } from '../../../../src/renderer/app/stores/update-store';
import { CrossWindowSyncService, SYNC_KEYS } from '../../../../src/renderer/app/sync/cross-window-sync-service';

describe('UpdateService', () => {
  it('parses remote manifest and reports available updates', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('update:state-changed', listener);
    const updateStore = new UpdateStore('0.2.10');
    const memory = { setItem: vi.fn() };
    const syncService = new CrossWindowSyncService(memory, bus, 'renderer_a');
    const service = new UpdateService(new VersionService(), new SchemaValidationService(), bus, updateStore, syncService);

    const result = service.checkForUpdates('0.2.10', {
      latestVersion: '0.2.11',
      updateType: 'hot_update',
      downloadUrl: 'https://example.com/patch.zip',
      forceUpdate: false,
      releaseDate: '2026-03-15',
      shortDesc: 'Bug fixes',
      canRollback: true,
      releaseNotes: ['Fix A'],
      releaseNotesMarkdown: '# 0.2.11',
      history: []
    });

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('0.2.11');
    expect(updateStore.getSnapshot().remoteManifest?.latestVersion).toBe('0.2.11');
    expect(memory.setItem).toHaveBeenCalledWith(SYNC_KEYS.updateState, expect.stringContaining('update-state-changed'));
    expect(listener).toHaveBeenCalledWith({
      currentVersion: '0.2.10',
      latestVersion: '0.2.11',
      hasUpdate: true
    });
  });

  it('rejects invalid remote manifests before update logic proceeds', () => {
    const service = new UpdateService(new VersionService(), new SchemaValidationService(), new AppEventBus());

    expect(() => service.checkForUpdates('0.2.10', { latestVersion: '0.2.11' })).toThrow(/Invalid app manifest/);
  });

  it('returns normalized manifest defaults and no update when remote version matches current', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('update:state-changed', listener);
    const updateStore = new UpdateStore('0.2.10');
    const memory = { setItem: vi.fn() };
    const syncService = new CrossWindowSyncService(memory, bus, 'renderer_a');
    const service = new UpdateService(new VersionService(), new SchemaValidationService(), bus, updateStore, syncService);

    const result = service.checkForUpdates('v0.2.10', {
      latestVersion: 'v0.2.10',
      downloadUrl: 'https://example.com/patch.zip',
      releaseDate: '2026-03-16',
      shortDesc: 'No-op release'
    });

    expect(result.currentVersion).toBe('0.2.10');
    expect(result.latestVersion).toBe('0.2.10');
    expect(result.hasUpdate).toBe(false);
    expect(result.manifest.updateType).toBe('hot_update');
    expect(result.manifest.forceUpdate).toBe(false);
    expect(result.manifest.canRollback).toBe(false);
    expect(result.manifest.releaseNotes).toEqual([]);
    expect(result.manifest.releaseNotesMarkdown).toBe('');
    expect(result.manifest.history).toEqual([]);
    expect(updateStore.getSnapshot().hasUpdate).toBe(false);
    expect(listener).toHaveBeenCalledWith({
      currentVersion: '0.2.10',
      latestVersion: '0.2.10',
      hasUpdate: false
    });
    expect(memory.setItem).toHaveBeenCalledWith(SYNC_KEYS.updateState, expect.stringContaining('"hasUpdate":false'));
  });
});
