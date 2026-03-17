import { describe, expect, it } from 'vitest';

import { hasModernActivePresetView } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('version restore state helpers', () => {
  it('treats modern active preset view as a valid restore signal', () => {
    expect(
      hasModernActivePresetView({
        __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
      } as unknown as Window)
    ).toBe(true);
  });
});
