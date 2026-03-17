import { describe, expect, it } from 'vitest';

import { resolveParamsDisplayFileName, resolveParamsPresetPath } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveParamsDisplayFileName', () => {
  it('prefers params preset view file name over path-derived legacy name', () => {
    const result = resolveParamsDisplayFileName(
      {
        __getParamsPresetView__: () => ({
          fileName: 'a1_standard_v3.0.0-r1.json',
          absolutePath: 'C:\\legacy\\other-name.json'
        })
      } as unknown as Window,
      'C:\\legacy\\other-name.json'
    );

    expect(result).toBe('a1_standard_v3.0.0-r1.json');
  });

  it('falls back to path-derived file name when params preset view is unavailable', () => {
    expect(resolveParamsDisplayFileName({} as Window, 'C:\\legacy\\other-name.json')).toBe('other-name.json');
  });

  it('derives display file name from the resolved modern preset path helper fallback', () => {
    const fallbackPath = resolveParamsPresetPath({} as Window, 'C:\\legacy\\other-name.json');

    expect(resolveParamsDisplayFileName({} as Window, fallbackPath)).toBe('other-name.json');
  });
});
