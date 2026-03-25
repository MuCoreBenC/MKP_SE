import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMergedHomeCatalog,
  createLetterAvatarDataUri,
  ensureValidSelection,
  sortCatalogItems,
  toCatalogFileUrl,
} from './homeCatalog.js';

test('buildMergedHomeCatalog merges saved custom entities with defaults', () => {
  const catalog = buildMergedHomeCatalog({
    brands: [
      { id: 'bambu', name: 'Bambu Lab Plus', shortName: 'Bambu+' },
      { id: 'custom', name: 'Custom Brand', shortName: 'Custom' },
    ],
    printersByBrand: {
      bambu: [{ id: 'a1', name: 'A1 Mod', shortName: 'A1M' }],
      custom: [{ id: 'custom-printer', name: 'Custom Printer', shortName: 'CP' }],
    },
  });

  assert.equal(catalog.brands.some((item) => item.id === 'bambu' && item.name === 'Bambu Lab Plus'), true);
  assert.equal(catalog.brands.some((item) => item.id === 'custom' && item.custom), true);
  assert.equal(catalog.printersByBrand.custom[0].id, 'custom-printer');
});

test('ensureValidSelection falls back to first selectable printer and clears invalid version', () => {
  const catalog = buildMergedHomeCatalog(null);
  const selection = ensureValidSelection(catalog, {
    brandId: 'creality',
    printerId: 'missing',
    versionType: 'quick',
  });

  assert.equal(selection.brandId, 'creality');
  assert.equal(selection.printerId, 'k1c');
  assert.equal(selection.versionType, null);
});

test('sortCatalogItems prefers pinned then favorite then name', () => {
  const sorted = sortCatalogItems([
    { id: 'b', name: 'B', pinned: false, favorite: true },
    { id: 'a', name: 'A', pinned: true, favorite: false },
    { id: 'c', name: 'C', pinned: false, favorite: false },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['a', 'b', 'c'],
  );
});

test('toCatalogFileUrl converts windows path to file url', () => {
  assert.equal(
    toCatalogFileUrl('C:\\data\\printer.webp'),
    'file:///C:/data/printer.webp',
  );
});

test('createLetterAvatarDataUri returns inline svg data uri', () => {
  const uri = createLetterAvatarDataUri('A1', 'bambu');

  assert.match(uri, /^data:image\/svg\+xml/);
});
