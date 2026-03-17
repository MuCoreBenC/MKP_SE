import { describe, expect, it } from 'vitest';

import { resolveParamsPresetPath } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveParamsPresetPath', () => {
  it('prefers params preset view absolute path from modern runtime', () => {
    const result = resolveParamsPresetPath(
      {
        __getParamsPresetView__: () => ({
          fileName: 'a1_standard_v3.0.0-r1.json',
          absolutePath: 'C:\\users\\data\\a1_standard_v3.0.0-r1.json'
        })
      } as unknown as Window,
      'C:\\legacy\\preset.json'
    );

    expect(result).toBe('C:\\users\\data\\a1_standard_v3.0.0-r1.json');
  });

  it('falls back to legacy path when modern params preset view is unavailable', () => {
    expect(resolveParamsPresetPath({} as Window, 'C:\\legacy\\preset.json')).toBe('C:\\legacy\\preset.json');
  });
});
