import { describe, expect, it } from 'vitest';

import { resolveDownloadAppliedState } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveDownloadAppliedState', () => {
  it('prefers modern active preset file name for download applied state', () => {
    expect(
      resolveDownloadAppliedState(
        {
          __getActivePresetView__: () => ({ fileName: 'a1_standard_v3.0.0-r1.json' })
        } as unknown as Window,
        ['a1_standard_v3.0.0-r1.json', 'other.json'],
        'legacy.json'
      )
    ).toBe(true);
  });

  it('falls back to legacy active file name for download applied state', () => {
    expect(resolveDownloadAppliedState({} as Window, ['legacy.json'], 'legacy.json')).toBe(true);
    expect(resolveDownloadAppliedState({} as Window, ['other.json'], 'legacy.json')).toBe(false);
  });

  it('does not treat the legacy active file as applied when the modern active preset points elsewhere', () => {
    expect(
      resolveDownloadAppliedState(
        {
          __getActivePresetView__: () => ({ fileName: 'modern.json' })
        } as unknown as Window,
        ['legacy.json'],
        'legacy.json'
      )
    ).toBe(false);
  });
});
