import { describe, expect, it } from 'vitest';

import { resolveActivePresetFileName } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('active preset log state', () => {
  it('uses modern active preset file name for log-oriented reads', () => {
    const targetWindow = {
      __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
    } as unknown as Window;

    expect(resolveActivePresetFileName(targetWindow, 'legacy.json')).toBe('a1_standard_v3.0.0-r1.json');
  });
});
