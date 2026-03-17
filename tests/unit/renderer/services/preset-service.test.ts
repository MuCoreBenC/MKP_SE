import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import {
  PresetRepository,
  type PresetDataSource,
  type PresetRecord
} from '../../../../src/renderer/app/repositories/preset-repository';
import { PresetService } from '../../../../src/renderer/app/services/preset-service';
import { PresetSessionStore } from '../../../../src/renderer/app/stores/preset-session-store';
import { UserConfigStore, type UserConfigStorage } from '../../../../src/renderer/app/stores/user-config-store';

function createStore(): UserConfigStore {
  const storage: UserConfigStorage = {
    read: () => null,
    write: () => undefined
  };

  return new UserConfigStore(storage);
}

function createServiceWithSession() {
  const store = createStore();
  const sessionStore = new PresetSessionStore(store);
  const eventBus = new AppEventBus();

  return {
    service: new PresetService(store, undefined, sessionStore, eventBus),
    sessionStore,
    eventBus
  };
}

function createRepository(records: Array<{ layer: 'builtin' | 'user'; fileName: string; absolutePath: string; version: string }>) {
  const builtinRecords: PresetRecord[] = records
    .filter((record) => record.layer === 'builtin')
    .map((record) => ({
      fileName: record.fileName,
      absolutePath: record.absolutePath,
      storageLayer: 'builtin' as const,
      content: { printer: 'a1', type: 'standard', version: record.version }
    }));
  const userRecords: PresetRecord[] = records
    .filter((record) => record.layer === 'user')
    .map((record) => ({
      fileName: record.fileName,
      absolutePath: record.absolutePath,
      storageLayer: 'user' as const,
      content: { printer: 'a1', type: 'standard', version: record.version }
    }));

  const builtinSource: PresetDataSource = {
    list: () => builtinRecords,
    write: () => undefined
  };
  const userSource: PresetDataSource = {
    list: () => userRecords,
    write: (record) => {
      userRecords.push({ ...record, storageLayer: 'user' });
    }
  };

  return new PresetRepository(builtinSource, userSource);
}

describe('PresetService', () => {
  it('picks latest preset by resolved content version instead of file name', () => {
    const service = new PresetService(createStore());

    const latest = service.pickLatestPreset([
      {
        fileName: 'z-any-name.json',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
      },
      {
        fileName: 'a-older-name.json',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r2' }
      }
    ]);

    expect(latest.fileName).toBe('a-older-name.json');
    expect(latest.contentVersion).toBe('3.0.0-r2');
  });

  it('applies preset into active context mapping', () => {
    const store = createStore();
    const service = new PresetService(store);

    const session = service.applyPreset(
      'a1',
      'standard',
      'a1_standard_v3.0.0-r2.json',
      { printer: 'a1', type: 'standard', version: '3.0.0-r2' }
    );

    expect(session.contextKey).toBe('a1_standard');
    expect(service.getActivePreset('a1', 'standard')).toBe('a1_standard_v3.0.0-r2.json');
  });

  it('rejects applying preset that mismatches current context', () => {
    const service = new PresetService(createStore());

    expect(() =>
      service.applyPreset('a1', 'standard', 'wrong.json', {
        printer: 'a1',
        type: 'quick',
        version: '3.0.0-r1'
      })
    ).toThrow(/does not match the active context/);
  });

  it('emits preset applied events and updates session store', () => {
    const { service, sessionStore, eventBus } = createServiceWithSession();
    const listener = vi.fn();
    eventBus.on('preset:applied', listener);

    service.applyPreset(
      'a1',
      'standard',
      'a1_standard_v3.0.0-r2.json',
      { printer: 'a1', type: 'standard', version: '3.0.0-r2' }
    );

    expect(sessionStore.getSnapshot().activeFileName).toBe('a1_standard_v3.0.0-r2.json');
    expect(listener).toHaveBeenCalledWith({
      contextKey: 'a1_standard',
      activeFileName: 'a1_standard_v3.0.0-r2.json',
      resolvedVersion: '3.0.0-r2'
    });
  });

  it('lists and resolves presets through the repository layers', () => {
    const store = createStore();
    store.setAppliedPreset('a1', 'standard', 'a1_standard_v3.0.0-r2.json');
    const repository = createRepository([
      {
        layer: 'builtin',
        fileName: 'a1_standard_v3.0.0-r1.json',
        absolutePath: 'builtin/a1_standard_v3.0.0-r1.json',
        version: '3.0.0-r1'
      },
      {
        layer: 'user',
        fileName: 'a1_standard_v3.0.0-r2.json',
        absolutePath: 'user/a1_standard_v3.0.0-r2.json',
        version: '3.0.0-r2'
      }
    ]);
    const service = new PresetService(store, repository);

    expect(service.listAvailablePresets('a1', 'standard')[0]?.fileName).toBe('a1_standard_v3.0.0-r2.json');
    expect(service.getResolvedActivePreset('a1', 'standard')?.absolutePath).toBe('user/a1_standard_v3.0.0-r2.json');
  });

  it('saves presets into the repository and emits content updates', () => {
    const store = createStore();
    const repository = createRepository([]);
    const eventBus = new AppEventBus();
    const listener = vi.fn();
    eventBus.on('preset:content-updated', listener);
    const service = new PresetService(store, repository, undefined, eventBus);

    const saved = service.savePreset({
      fileName: 'custom.json',
      absolutePath: 'user/custom.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r3' }
    });

    expect(saved.storageLayer).toBe('user');
    expect(listener).toHaveBeenCalledWith({
      contextKey: 'user/custom.json',
      reason: 'preset-saved'
    });
  });
});
