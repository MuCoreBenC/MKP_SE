import { describe, expect, it, vi } from 'vitest';

import { createAppContainer } from '../../../../src/renderer/app/core/app-container';
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

describe('createAppContainer', () => {
  it('wires core stores and services into a usable container', () => {
    const container = createAppContainer(createOptions());

    expect(container.services.versionService.getCurrentVersion('v0.2.10')).toBe('0.2.10');
    expect(container.stores.updateStore.getSnapshot().currentVersion).toBe('0.2.10');
    expect(container.services.catalogService.listBrands()[0]?.id).toBe('bambu');
  });

  it('uses the provided window id for cross-window sync', () => {
    const container = createAppContainer({
      ...createOptions(),
      windowId: 'renderer_test'
    });

    const message = container.syncService.createMessage('context-changed', { contextKey: 'a1_standard' });

    expect(message.sourceWindowId).toBe('renderer_test');
  });
});
