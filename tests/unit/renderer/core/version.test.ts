import { describe, expect, it } from 'vitest';

import { compareVersions } from '../../../../src/renderer/app/core/version';

describe('compareVersions', () => {
  it('compares semantic versions numerically', () => {
    expect(compareVersions('1.2.10', '1.2.2')).toBe(1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
  });

  it('supports leading v and release suffixes', () => {
    expect(compareVersions('v3.0.0-r2', '3.0.0-r1')).toBe(1);
    expect(compareVersions('3.0.0-beta', '3.0.0-r1')).toBe(-1);
  });
});
