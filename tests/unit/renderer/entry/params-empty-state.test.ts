import { describe, expect, it } from 'vitest';

import { hasParamsPresetView } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('hasParamsPresetView', () => {
  it('returns true when modern params preset view exists', () => {
    expect(
      hasParamsPresetView({
        __getParamsPresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
      } as unknown as Window)
    ).toBe(true);
  });

  it('returns false when modern params preset view is unavailable', () => {
    expect(hasParamsPresetView({} as Window)).toBe(false);
  });
});
