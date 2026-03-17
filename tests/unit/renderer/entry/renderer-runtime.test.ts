import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [
      { id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true },
      { id: 'creality', name: '创想三维', shortName: 'Creality' }
    ],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: 'assets/images/a1.webp',
          favorite: true,
          supportedVersions: ['standard', 'quick'],
          defaultPresets: {
            standard: 'a1_standard_v3.0.0-r1.json',
            quick: 'a1_quick_v3.0.0-r1.json'
          }
        }
      ],
      creality: []
    },
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      })
    },
    addEventListener: vi.fn()
  } as unknown as Window & typeof globalThis;
}

describe('mountModernRuntime', () => {
  it('mounts the modern runtime and exposes bridge objects on the window', () => {
    const targetWindow = createWindowStub();

    const runtime = mountModernRuntime(targetWindow);

    expect(targetWindow.__MKP_MODERN_RUNTIME__).toBe(runtime);
    expect(targetWindow.mkpModernApp).toBe(runtime.container);
    const viewModel = targetWindow.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu');

    expect(viewModel?.brands).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'bambu' })]));
    expect(viewModel?.printers).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'a1', brandId: 'bambu' })]));
  });

  it('keeps home view semantics available through the runtime bridge for legacy rendering', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    const viewModel = targetWindow.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu');
    const activeBrand = viewModel?.brands.find((brand) => brand.id === 'bambu');
    const activePrinter = viewModel?.printers.find((printer) => printer.id === 'a1');

    expect(activeBrand).toEqual(expect.objectContaining({
      id: 'bambu',
      displayName: '拓竹',
      shortName: 'Bambu Lab',
      favorite: true
    }));
    expect(activePrinter).toEqual(expect.objectContaining({
      id: 'a1',
      brandId: 'bambu',
      displayName: 'Bambu Lab A1',
      shortName: 'A1',
      favorite: true
    }));
  });

  it('hydrates home context from the modern store snapshot for legacy pages', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    expect(targetWindow.selectedBrand).toBe('bambu');
    expect(targetWindow.selectedPrinter).toBe('a1');
    expect(targetWindow.selectedVersion).toBe('standard');
  });

  it('keeps legacy selection globals in sync when bridge updates the modern context', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    targetWindow.__MKP_MODERN_BRIDGE__?.selectPrinterContext('bambu', 'a1', 'quick');

    expect(targetWindow.selectedBrand).toBe('bambu');
    expect(targetWindow.selectedPrinter).toBe('a1');
    expect(targetWindow.selectedVersion).toBe('quick');
  });

  it('keeps legacy selection globals in sync when the modern store updates directly', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.selectContext('bambu', 'a1', 'quick');

    expect(targetWindow.selectedBrand).toBe('bambu');
    expect(targetWindow.selectedPrinter).toBe('a1');
    expect(targetWindow.selectedVersion).toBe('quick');
  });

  it('keeps bridge home view model aligned after modern context updates', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.selectContext('bambu', 'a1', 'quick');

    const viewModel = targetWindow.__MKP_MODERN_BRIDGE__?.getHomeViewModel(targetWindow.selectedBrand || '');

    expect(targetWindow.selectedBrand).toBe('bambu');
    expect(targetWindow.selectedPrinter).toBe('a1');
    expect(targetWindow.selectedVersion).toBe('quick');
    expect(viewModel?.printers).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'a1', brandId: 'bambu' })]));
  });

  it('keeps bridge home brand list readable to legacy consumers after mount', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    const brands = targetWindow.__MKP_MODERN_BRIDGE__?.getHomeViewModel('bambu').brands;

    expect(brands).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bambu', displayName: '拓竹', shortName: 'Bambu Lab' }),
      expect.objectContaining({ id: 'creality', displayName: '创想三维', shortName: 'Creality' })
    ]));
  });
});
