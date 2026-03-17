import { describe, expect, it } from 'vitest';

import { resolveActivePresetFileName } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('active file resolution', () => {
  it('resolves a single active file name consistently for callers that still carry a legacy fallback', () => {
    const targetWindow = {
      __getActivePresetView__: () => ({ fileName: 'modern.json' })
    } as unknown as Window;

    expect(resolveActivePresetFileName(targetWindow, 'legacy.json')).toBe('modern.json');
  });
});
