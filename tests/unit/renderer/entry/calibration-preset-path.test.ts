import { describe, expect, it } from 'vitest';

import { resolveCalibrationPresetPath } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveCalibrationPresetPath', () => {
  it('prefers modern calibration context preset path', () => {
    const result = resolveCalibrationPresetPath(
      {
        __getCalibrationContextView__: () => ({ presetPath: 'C:\\data\\a1_standard.json' })
      } as unknown as Window,
      'C:\\legacy\\preset.json'
    );

    expect(result).toBe('C:\\data\\a1_standard.json');
  });

  it('falls back to legacy preset path when calibration context view is unavailable', () => {
    expect(resolveCalibrationPresetPath({} as Window, 'C:\\legacy\\preset.json')).toBe('C:\\legacy\\preset.json');
  });
});
