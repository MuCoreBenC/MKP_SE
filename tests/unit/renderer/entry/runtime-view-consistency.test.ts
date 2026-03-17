import { describe, expect, it } from 'vitest';

import {
  resolveActivePresetFileName,
  resolveParamsPresetPath,
  resolveCalibrationPresetPath,
  resolveDownloadContext,
  resolveParamsDisplayFileName
} from '../../../../src/renderer/app/entry/renderer-runtime';

describe('runtime view consistency helpers', () => {
  it('resolve from the same modern preset view family consistently', () => {
    const targetWindow = {
      __getActivePresetView__: () => ({ fileName: 'active.json', absolutePath: 'C:\\data\\active.json' }),
      __getParamsPresetView__: () => ({ fileName: 'params.json', absolutePath: 'C:\\data\\params.json' }),
      __getCalibrationContextView__: () => ({ printerId: 'a1', versionType: 'standard', presetPath: 'C:\\data\\calibration.json' })
    } as unknown as Window;

    expect(resolveActivePresetFileName(targetWindow, 'legacy.json')).toBe('active.json');
    expect(resolveParamsPresetPath(targetWindow, 'C:\\legacy\\params.json')).toBe('C:\\data\\params.json');
    expect(resolveCalibrationPresetPath(targetWindow, 'C:\\legacy\\calibration.json')).toBe('C:\\data\\calibration.json');
  });

  it('resolves download context from the same modern runtime view family consistently', () => {
    const printer = { id: 'a1', shortName: 'A1' };
    const targetWindow = {
      __getDownloadContextView__: () => ({ printer, selectedVersionType: 'quick' })
    } as unknown as Window;

    expect(resolveDownloadContext(targetWindow, { id: 'legacy' }, 'standard')).toEqual({
      printer,
      selectedVersionType: 'quick'
    });
  });

  it('resolves params display file name from the same params preset view family consistently', () => {
    const targetWindow = {
      __getParamsPresetView__: () => ({ fileName: 'params.json', absolutePath: 'C:\\data\\params.json' })
    } as unknown as Window;

    expect(resolveParamsDisplayFileName(targetWindow, 'C:\\legacy\\fallback.json')).toBe('params.json');
  });

  it('resolves active, params and calibration helpers from the same preset-view family consistently', () => {
    const targetWindow = {
      __getActivePresetView__: () => ({ fileName: 'active.json', absolutePath: 'C:\\data\\active.json' }),
      __getParamsPresetView__: () => ({ fileName: 'active.json', absolutePath: 'C:\\data\\active.json' }),
      __getCalibrationContextView__: () => ({ printerId: 'a1', versionType: 'standard', presetPath: 'C:\\data\\active.json' })
    } as unknown as Window;

    expect(resolveActivePresetFileName(targetWindow, null)).toBe('active.json');
    expect(resolveParamsPresetPath(targetWindow, null)).toBe('C:\\data\\active.json');
    expect(resolveCalibrationPresetPath(targetWindow, null)).toBe('C:\\data\\active.json');
  });
});
