import { describe, expect, it, vi } from 'vitest';

import { HomeController } from '../../../../src/renderer/app/controllers/home-controller';

describe('HomeController', () => {
  it('composes home view model from catalog service', () => {
    const controller = new HomeController(
      {
        listBrands: () => [{ id: 'bambu' }],
        listPrintersByBrand: () => [{ id: 'a1' }]
      } as never,
      { selectContext: vi.fn() } as never
    );

    expect(controller.getHomeViewModel('bambu')).toEqual({
      brands: [{ id: 'bambu' }],
      printers: [{ id: 'a1' }]
    });
  });

  it('delegates printer context selection to user config service', () => {
    const selectContext = vi.fn();
    const controller = new HomeController(
      { listBrands: () => [], listPrintersByBrand: () => [] } as never,
      { selectContext } as never
    );

    controller.selectPrinterContext('bambu', 'a1', 'standard');

    expect(selectContext).toHaveBeenCalledWith('bambu', 'a1', 'standard');
  });

  it('returns an empty printer list when the selected brand has no printers', () => {
    const controller = new HomeController(
      {
        listBrands: () => [{ id: 'bambu' }, { id: 'custom' }],
        listPrintersByBrand: (brandId: string) => (brandId === 'custom' ? [] : [{ id: 'a1' }])
      } as never,
      { selectContext: vi.fn() } as never
    );

    expect(controller.getHomeViewModel('custom')).toEqual({
      brands: [{ id: 'bambu' }, { id: 'custom' }],
      printers: []
    });
  });
});
