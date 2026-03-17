import { describe, expect, it } from 'vitest';

import { resolveDownloadContext } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('resolveDownloadContext', () => {
  it('prefers modern download view over legacy arguments', () => {
    const result = resolveDownloadContext(
      {
        __getDownloadContextView__: () => ({
          printer: { id: 'a1', shortName: 'A1', supportedVersionTypes: ['standard', 'quick'] },
          selectedVersionType: 'quick'
        })
      } as unknown as Window,
      { id: 'legacy', shortName: 'Legacy' },
      'standard'
    );

    expect(result).toEqual({
      printer: { id: 'a1', shortName: 'A1', supportedVersionTypes: ['standard', 'quick'] },
      selectedVersionType: 'quick'
    });
  });

  it('falls back to legacy arguments when modern download view is unavailable', () => {
    const printer = { id: 'legacy', shortName: 'Legacy' };

    expect(resolveDownloadContext({} as Window, printer, 'standard')).toEqual({
      printer,
      selectedVersionType: 'standard'
    });
  });

  it('uses the modern selected version even when only the legacy version argument differs', () => {
    const printer = { id: 'legacy', shortName: 'Legacy' };

    expect(resolveDownloadContext(
      {
        __getDownloadContextView__: () => ({
          printer,
          selectedVersionType: 'quick'
        })
      } as unknown as Window,
      printer,
      'standard'
    )).toEqual({
      printer,
      selectedVersionType: 'quick'
    });
  });
});
