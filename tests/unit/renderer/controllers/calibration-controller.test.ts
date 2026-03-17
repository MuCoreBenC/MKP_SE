import { describe, expect, it, vi } from 'vitest';

import { CalibrationController } from '../../../../src/renderer/app/controllers/calibration-controller';

describe('CalibrationController', () => {
  it('builds calibration view model from calibration service', () => {
    const controller = new CalibrationController({
      isAvailable: () => true,
      extractOffsets: () => ({ z: 3.8 })
    } as never);

    expect(
      controller.getCalibrationViewModel(
        { printerId: 'a1', versionType: 'standard', presetPath: 'C:\\preset.json' },
        { toolhead: { offset: { z: 3.8 } } }
      )
    ).toEqual({
      enabled: true,
      offsets: { z: 3.8 }
    });
  });

  it('skips offset extraction when preset path is missing', () => {
    const extractOffsets = vi.fn();
    const controller = new CalibrationController({
      isAvailable: () => false,
      extractOffsets
    } as never);

    expect(
      controller.getCalibrationViewModel(
        { printerId: 'a1', versionType: 'standard', presetPath: null },
        { toolhead: { offset: { z: 3.8 } } }
      )
    ).toEqual({
      enabled: false,
      offsets: null
    });
    expect(extractOffsets).not.toHaveBeenCalled();
  });
});
