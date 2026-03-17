import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { CatalogRepository, type CatalogDataSource } from '../../../../src/renderer/app/repositories/catalog-repository';
import { CatalogService } from '../../../../src/renderer/app/services/catalog-service';

const now = '2026-03-15T00:00:00.000Z';

function createRepository() {
  const builtin: CatalogDataSource = {
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
      printers: [
        {
          id: 'a1',
          brandId: 'bambu',
          displayName: 'Bambu A1',
          shortName: 'A1',
          subtitle: '',
          imageRef: 'builtin/a1.webp',
          supportedVersionTypes: ['standard', 'quick'],
          defaultPresetRefs: { standard: 'a1_standard.json', quick: 'a1_quick.json' },
          favorite: true,
          pinned: false,
          disabled: false,
          builtin: true,
          canDelete: false,
          sortOrder: 10,
          createdAt: now,
          updatedAt: now
        }
      ]
    })
  };
  const user: CatalogDataSource = {
    read: () => ({ brands: [], printers: [] }),
    write: vi.fn()
  };

  return {
    repository: new CatalogRepository(builtin, user),
    userWrite: user.write as ReturnType<typeof vi.fn>
  };
}

describe('CatalogService', () => {
  it('lists brands and printers from the repository', () => {
    const { repository } = createRepository();
    const service = new CatalogService(repository, new AppEventBus());

    expect(service.listBrands()[0]?.id).toBe('bambu');
    expect(service.listPrintersByBrand('bambu')[0]?.id).toBe('a1');
  });

  it('writes user catalog overrides and emits a catalog refresh signal', () => {
    const { repository, userWrite } = createRepository();
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('context:changed', listener);
    const service = new CatalogService(repository, bus);

    service.saveUserCatalog(
      [
        {
          id: 'custom',
          displayName: 'Custom',
          shortName: 'Custom',
          subtitle: '',
          imageRef: 'user/custom.webp',
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now
        }
      ],
      [
        {
          id: 'custom-printer',
          brandId: 'custom',
          displayName: 'Custom Printer',
          shortName: 'CP',
          subtitle: '',
          imageRef: 'user/custom-printer.webp',
          supportedVersionTypes: ['standard'],
          defaultPresetRefs: { standard: 'custom.json' },
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now
        }
      ]
    );

    expect(userWrite).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({
      brandId: 'custom',
      printerId: 'custom-printer',
      versionType: 'standard',
      contextKey: 'catalog-updated'
    });
  });

  it('emits fallback refresh payload when saved catalog is empty', () => {
    const { repository, userWrite } = createRepository();
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('context:changed', listener);
    const service = new CatalogService(repository, bus);

    service.saveUserCatalog([], []);

    expect(userWrite).toHaveBeenCalledWith({ brands: [], printers: [] });
    expect(listener).toHaveBeenCalledWith({
      brandId: 'unknown',
      printerId: 'unknown',
      versionType: 'standard',
      contextKey: 'catalog-updated'
    });
  });

  it('ignores orphan printers and falls back when no brand-aligned printer exists', () => {
    const { repository } = createRepository();
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('context:changed', listener);
    const service = new CatalogService(repository, bus);

    service.saveUserCatalog(
      [
        {
          id: 'voron',
          displayName: 'Voron',
          shortName: 'Voron',
          subtitle: '',
          imageRef: 'user/voron.webp',
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now
        }
      ],
      [
        {
          id: 'voron-24',
          brandId: 'other-brand',
          displayName: 'Voron 2.4',
          shortName: '2.4',
          subtitle: '',
          imageRef: 'user/voron24.webp',
          supportedVersionTypes: ['lite', 'quick'],
          defaultPresetRefs: { lite: 'voron_lite.json', quick: 'voron_quick.json' },
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 1,
          createdAt: now,
          updatedAt: now
        }
      ]
    );

    expect(listener).toHaveBeenCalledWith({
      brandId: 'voron',
      printerId: 'unknown',
      versionType: 'standard',
      contextKey: 'catalog-updated'
    });
  });
});
