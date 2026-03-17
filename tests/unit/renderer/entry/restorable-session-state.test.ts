import { describe, expect, it } from 'vitest';

import { hasModernActivePresetView } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('hasModernActivePresetView', () => {
  it('returns true when modern active preset view exists', () => {
    expect(
      hasModernActivePresetView({
        __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
      } as unknown as Window)
    ).toBe(true);
  });

  it('returns false when modern active preset view is unavailable', () => {
    expect(hasModernActivePresetView({} as Window)).toBe(false);
  });
});
