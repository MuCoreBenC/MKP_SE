import { describe, expect, it, vi } from 'vitest';

import { UserConfigStore, type UserConfig, type UserConfigStorage } from '../../../../src/renderer/app/stores/user-config-store';

function createStorage(initial: UserConfig | null = null): UserConfigStorage & { writes: UserConfig[] } {
  const writes: UserConfig[] = [];

  return {
    writes,
    read: vi.fn(() => initial),
    write: vi.fn((config: UserConfig) => {
      writes.push(config);
    })
  };
}

describe('UserConfigStore', () => {
  it('hydrates defaults with a valid version type', () => {
    const storage = createStorage();
    const store = new UserConfigStore(storage);

    expect(store.getSnapshot().selectedVersionType).toBe('standard');
  });

  it('persists selected context and applied preset by context key', () => {
    const storage = createStorage();
    const store = new UserConfigStore(storage);

    store.selectContext('bambu', 'a1', 'quick');
    store.setAppliedPreset('a1', 'quick', 'a1_quick_v3.0.0-r1.json');

    const snapshot = store.getSnapshot();
    expect(snapshot.selectedPrinterId).toBe('a1');
    expect(snapshot.selectedVersionType).toBe('quick');
    expect(snapshot.appliedPresetByContext.a1_quick).toBe('a1_quick_v3.0.0-r1.json');
    expect(storage.writes).toHaveLength(2);
  });

  it('returns a defensive copy of applied preset mappings', () => {
    const store = new UserConfigStore(
      createStorage({
        ...structuredClone({
          selectedBrandId: 'bambu',
          selectedPrinterId: 'a1',
          selectedVersionType: 'standard',
          appliedPresetByContext: { a1_standard: 'a1_standard.json' },
          onboardingEnabled: true,
          updateMode: 'manual',
          themeMode: 'system',
          dockAnimationEnabled: true,
          dockBaseSize: 38,
          dockMaxScale: 1.5,
          updatedAt: '2026-03-15T00:00:00.000Z'
        })
      })
    );

    const snapshot = store.getSnapshot();
    snapshot.appliedPresetByContext.a1_standard = 'changed.json';

    expect(store.getSnapshot().appliedPresetByContext.a1_standard).toBe('a1_standard.json');
  });

  it('notifies subscribers when selected context changes and supports unsubscribe', () => {
    const storage = createStorage();
    const store = new UserConfigStore(storage);
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    store.selectContext('bambu', 'a1', 'quick');

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedBrandId: 'bambu',
        selectedPrinterId: 'a1',
        selectedVersionType: 'quick'
      })
    );

    unsubscribe();
    store.selectContext('bambu', 'a1', 'standard');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists update mode changes', () => {
    const storage = createStorage();
    const store = new UserConfigStore(storage);

    store.setUpdateMode('auto');

    expect(store.getSnapshot().updateMode).toBe('auto');
    expect(storage.writes.at(-1)?.updateMode).toBe('auto');
  });
});
