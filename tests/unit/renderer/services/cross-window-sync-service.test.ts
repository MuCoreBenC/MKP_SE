import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import {
  CrossWindowSyncService,
  SYNC_KEYS,
  type StorageLike
} from '../../../../src/renderer/app/sync/cross-window-sync-service';

describe('CrossWindowSyncService', () => {
  it('broadcasts serialized sync messages', () => {
    const storage: StorageLike = { setItem: vi.fn() };
    const service = new CrossWindowSyncService(storage, new AppEventBus(), 'renderer_a');

    service.broadcast(
      SYNC_KEYS.activeContext,
      service.createMessage('context-changed', { contextKey: 'a1_standard' })
    );

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      SYNC_KEYS.activeContext,
      expect.stringContaining('context-changed')
    );
  });

  it('ignores self-originated storage events', () => {
    const service = new CrossWindowSyncService({ setItem: () => undefined }, new AppEventBus(), 'renderer_a');

    const handled = service.handleStorageEvent({
      key: SYNC_KEYS.presetMutationSignal,
      newValue: JSON.stringify({
        type: 'preset-content-mutated',
        sourceWindowId: 'renderer_a',
        timestamp: Date.now(),
        payload: { contextKey: 'a1_standard', reason: 'params-save' }
      })
    });

    expect(handled).toBeNull();
  });

  it('translates external preset mutation events into bus events', () => {
    const bus = new AppEventBus();
    const syncListener = vi.fn();
    const mutationListener = vi.fn();
    bus.on('sync:message-received', syncListener);
    bus.on('preset:content-updated', mutationListener);

    const service = new CrossWindowSyncService({ setItem: () => undefined }, bus, 'renderer_a');

    const handled = service.handleStorageEvent({
      key: SYNC_KEYS.presetMutationSignal,
      newValue: JSON.stringify({
        type: 'preset-content-mutated',
        sourceWindowId: 'renderer_b',
        timestamp: Date.now(),
        payload: { contextKey: 'a1_standard', reason: 'params-save' }
      })
    });

    expect(handled?.type).toBe('preset-content-mutated');
    expect(syncListener).toHaveBeenCalledWith({
      type: 'preset-content-mutated',
      sourceWindowId: 'renderer_b'
    });
    expect(mutationListener).toHaveBeenCalledWith({
      contextKey: 'a1_standard',
      sourceWindowId: 'renderer_b',
      reason: 'params-save'
    });
  });

  it('translates external update state events into bus events', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('update:state-changed', listener);

    const service = new CrossWindowSyncService({ setItem: () => undefined }, bus, 'renderer_a');

    service.handleStorageEvent({
      key: SYNC_KEYS.updateState,
      newValue: JSON.stringify({
        type: 'update-state-changed',
        sourceWindowId: 'renderer_b',
        timestamp: Date.now(),
        payload: { currentVersion: '0.2.10', latestVersion: '0.2.11', hasUpdate: true }
      })
    });

    expect(listener).toHaveBeenCalledWith({
      currentVersion: '0.2.10',
      latestVersion: '0.2.11',
      hasUpdate: true
    });
  });

  it('translates external active context events into bus events', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('context:changed', listener);

    const service = new CrossWindowSyncService({ setItem: () => undefined }, bus, 'renderer_a');

    service.handleStorageEvent({
      key: SYNC_KEYS.activeContext,
      newValue: JSON.stringify({
        type: 'context-changed',
        sourceWindowId: 'renderer_b',
        timestamp: Date.now(),
        payload: {
          brandId: 'bambu',
          printerId: 'a1',
          versionType: 'quick',
          contextKey: 'a1_quick'
        }
      })
    });

    expect(listener).toHaveBeenCalledWith({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick',
      contextKey: 'a1_quick'
    });
  });

  it('ignores malformed sync messages without emitting events', () => {
    const bus = new AppEventBus();
    const syncListener = vi.fn();
    const contextListener = vi.fn();
    bus.on('sync:message-received', syncListener);
    bus.on('context:changed', contextListener);

    const service = new CrossWindowSyncService({ setItem: () => undefined }, bus, 'renderer_a');

    const handled = service.handleStorageEvent({
      key: SYNC_KEYS.activeContext,
      newValue: JSON.stringify({
        sourceWindowId: 'renderer_b',
        timestamp: Date.now(),
        payload: {
          brandId: 'bambu',
          printerId: 'a1',
          versionType: 'quick',
          contextKey: 'a1_quick'
        }
      })
    });

    expect(handled).toBeNull();
    expect(syncListener).not.toHaveBeenCalled();
    expect(contextListener).not.toHaveBeenCalled();
  });
});
