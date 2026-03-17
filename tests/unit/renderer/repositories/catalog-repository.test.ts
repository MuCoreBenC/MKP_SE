import { describe, expect, it, vi } from 'vitest';

import { CatalogRepository, type CatalogDataSource } from '../../../../src/renderer/app/repositories/catalog-repository';

function createSource(records: ReturnType<CatalogDataSource['read']>) {
  let state = records;

  return {
    source: {
      read: vi.fn(() => state),
      write: vi.fn((next) => {
        state = next;
      })
    } satisfies CatalogDataSource
  };
}

describe('CatalogRepository', () => {
  const now = '2026-03-15T00:00:00.000Z';

  it('merges builtin and user brands by id with user override precedence', () => {
    const builtin = createSource({
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
    });
    const user = createSource({
      brands: [
        {
          id: 'bambu',
          displayName: 'My Bambu',
          shortName: 'Bambu',
          subtitle: 'Custom',
          imageRef: 'user/bambu.webp',
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 5,
          createdAt: now,
          updatedAt: now
        }
      ],
      printers: []
    });
    const repository = new CatalogRepository(builtin.source, user.source);

    expect(repository.listBrands()[0]?.displayName).toBe('My Bambu');
  });

  it('resolves printers by brand with default and user layers separated', () => {
    const builtin = createSource({
      brands: [],
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
    });
    const user = createSource({
      brands: [],
      printers: [
        {
          id: 'custom-a1',
          brandId: 'bambu',
          displayName: 'Custom A1',
          shortName: 'CA1',
          subtitle: '',
          imageRef: 'user/custom-a1.webp',
          supportedVersionTypes: ['standard'],
          defaultPresetRefs: { standard: 'custom-a1.json' },
          favorite: false,
          pinned: false,
          disabled: false,
          builtin: false,
          canDelete: true,
          sortOrder: 20,
          createdAt: now,
          updatedAt: now
        }
      ]
    });
    const repository = new CatalogRepository(builtin.source, user.source);

    expect(repository.listPrintersByBrand('bambu').map((printer) => printer.id)).toEqual(['a1', 'custom-a1']);
  });

  it('writes only validated catalog records into the user layer', () => {
    const builtin = createSource({ brands: [], printers: [] });
    const user = createSource({ brands: [], printers: [] });
    const repository = new CatalogRepository(builtin.source, user.source);

    repository.saveUserCatalog({
      brands: [
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
      printers: [
        {
          id: 'custom-a1',
          brandId: 'custom',
          displayName: 'Custom A1',
          shortName: 'CA1',
          subtitle: '',
          imageRef: 'user/custom-a1.webp',
          supportedVersionTypes: ['lite'],
          defaultPresetRefs: { lite: 'custom-a1.json' },
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
    });

    expect(user.source.write).toHaveBeenCalledWith({
      brands: [
        expect.objectContaining({ id: 'custom' })
      ],
      printers: [
        expect.objectContaining({ id: 'custom-a1', supportedVersionTypes: ['lite'] })
      ]
    });
  });
});
