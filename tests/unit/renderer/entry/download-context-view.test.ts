import { describe, expect, it, vi } from 'vitest';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [{ id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true }],
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
      ]
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

describe('download context view bridge', () => {
  it('exposes the selected printer and version state for download page linkage', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    const initialView = targetWindow.__getDownloadContextView__?.();
    expect(initialView).toMatchObject({
      printer: expect.objectContaining({ id: 'a1', shortName: 'A1' }),
      selectedVersionType: 'standard'
    });

    targetWindow.__syncLegacyContextToModern__?.({
      brandId: 'bambu',
      printerId: 'a1',
      versionType: 'quick'
    });

    const nextView = targetWindow.__getDownloadContextView__?.();
    expect(nextView).toMatchObject({
      printer: expect.objectContaining({ id: 'a1' }),
      selectedVersionType: 'quick'
    });
  });

  it('reflects version changes triggered through the download context sync path', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    targetWindow.__syncLegacyContextToModern__?.({ versionType: 'quick' });

    expect(targetWindow.__getDownloadContextView__?.()).toMatchObject({
      selectedVersionType: 'quick'
    });
  });

  it('keeps the same printer identity when only the selected version changes', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    const initialPrinter = targetWindow.__getDownloadContextView__?.().printer;
    targetWindow.__syncLegacyContextToModern__?.({ versionType: 'quick' });
    const nextPrinter = targetWindow.__getDownloadContextView__?.().printer;

    expect(initialPrinter).toMatchObject({ id: 'a1' });
    expect(nextPrinter).toMatchObject({ id: 'a1' });
  });

  it('stays aligned with active preset context when the selected version changes', () => {
    const targetWindow = createWindowStub();
    const runtime = mountModernRuntime(targetWindow);

    runtime.container.stores.userConfigStore.setAppliedPreset('a1', 'quick', 'a1_quick_v3.0.0-r1.json');
    targetWindow.__syncLegacyContextToModern__?.({ versionType: 'quick' });

    expect(targetWindow.__getDownloadContextView__?.()).toMatchObject({
      printer: expect.objectContaining({ id: 'a1' }),
      selectedVersionType: targetWindow.__getCalibrationContextView__?.()?.versionType
    });
  });

  it('keeps the same selected version in download and calibration views after clearing back to the default version', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    targetWindow.__syncLegacyContextToModern__?.({ versionType: 'quick' });
    targetWindow.__syncLegacyContextToModern__?.({ versionType: 'standard' });

    expect(targetWindow.__getDownloadContextView__?.()?.selectedVersionType).toBe(
      targetWindow.__getCalibrationContextView__?.()?.versionType
    );
    expect(targetWindow.__getDownloadContextView__?.()?.selectedVersionType).toBe('standard');
  });
});
