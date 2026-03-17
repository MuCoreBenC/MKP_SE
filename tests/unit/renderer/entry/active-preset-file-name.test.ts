import { describe, expect, it } from 'vitest';

import { resolveActivePresetFileName } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveActivePresetFileName', () => {
  it('prefers modern active preset view file name', () => {
    const result = resolveActivePresetFileName(
      {
        __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
      } as unknown as Window,
      'legacy.json'
    );

    expect(result).toBe('a1_standard_v3.0.0-r1.json');
  });

  it('falls back to legacy active file name', () => {
    expect(resolveActivePresetFileName({} as Window, 'legacy.json')).toBe('legacy.json');
  });
});
