import { describe, expect, it, vi } from 'vitest';

import { ReleaseController } from '../../../../src/renderer/app/controllers/release-controller';

describe('ReleaseController', () => {
  it('prepares release config through release service', () => {
    const prepareReleaseConfig = vi.fn(() => ({ version: '0.2.10' }));
    const controller = new ReleaseController(
      { prepareReleaseConfig } as never,
      { readDefaultPreset: vi.fn() } as never
    );

    expect(controller.prepareRelease({ version: '0.2.10' })).toEqual({ version: '0.2.10' });
    expect(prepareReleaseConfig).toHaveBeenCalledWith({ version: '0.2.10' });
  });

  it('reads default preset through default resource service', () => {
    const readDefaultPreset = vi.fn(() => ({ fileName: 'a1_standard.json' }));
    const controller = new ReleaseController(
      { prepareReleaseConfig: vi.fn() } as never,
      { readDefaultPreset } as never
    );

    expect(controller.getDefaultPreset('a1_standard.json')).toEqual({ fileName: 'a1_standard.json' });
    expect(readDefaultPreset).toHaveBeenCalledWith('a1_standard.json');
  });

  it('preserves release service errors during preparation', () => {
    const error = new Error('invalid config');
    const controller = new ReleaseController(
      {
        prepareReleaseConfig: vi.fn(() => {
          throw error;
        })
      } as never,
      { readDefaultPreset: vi.fn() } as never
    );

    expect(() => controller.prepareRelease({ version: '0.2.10' })).toThrow(error);
  });
});
