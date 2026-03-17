import { describe, expect, it } from 'vitest';

import { resolveActivePresetFileName } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('startup active preset state', () => {
  it('uses modern active preset view for startup active preset reads', () => {
    const targetWindow = {
      __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
    } as unknown as Window;

    expect(resolveActivePresetFileName(targetWindow, null)).toBe('a1_standard_v3.0.0-r1.json');
  });
});
