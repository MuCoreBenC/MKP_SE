import { describe, expect, it, vi } from 'vitest';

import { bootstrapApp } from '../../../../src/renderer/app/bootstrap/app-bootstrap';
import type { PresetSchema } from '../../../../src/renderer/app/schemas/preset-schema';

const now = '2026-03-15T00:00:00.000Z';

function createOptions() {
  return {
    storage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    },
    packageVersion: '0.2.10',
    presetSources: {
      builtin: {
        list: () => [],
        write: vi.fn()
      },
      user: {
        list: () => [],
        write: vi.fn()
      }
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
    }
  };
}

describe('bootstrapApp', () => {
  it('creates container and binds storage sync listener', () => {
    const app = bootstrapApp(createOptions());
    const addEventListener = vi.fn();

    app.bindStorageSync({ addEventListener });

    expect(app.container.services.versionService.getCurrentVersion('0.2.10')).toBe('0.2.10');
    expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('forwards storage events into the sync service payload format', () => {
    const app = bootstrapApp(createOptions());
    const handleStorageEvent = vi.spyOn(app.container.syncService, 'handleStorageEvent');
    const addEventListener = vi.fn((_type, handler: (event: StorageEvent) => void) => {
      handler({ key: 'mkp:test', newValue: '{"x":1}' } as StorageEvent);
    });

    app.bindStorageSync({ addEventListener });

    expect(handleStorageEvent).toHaveBeenCalledWith({
      key: 'mkp:test',
      newValue: '{"x":1}'
    });
  });
});
