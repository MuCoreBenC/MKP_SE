import { describe, expect, it } from 'vitest';

import { buildContextKey, extractPresetMeta, extractPresetVersion } from '../../../../src/renderer/app/core/preset';

describe('preset core helpers', () => {
  it('extracts version from content before relying on manifest', () => {
    const version = extractPresetVersion(
      {
        printer: 'a1',
        type: 'standard',
        version: '3.0.0-r2'
      },
      {
        id: 'a1',
        type: 'standard',
        version: '3.0.0-r1',
        file: 'a1_standard_v3.0.0-r1.json'
      }
    );

    expect(version).toBe('3.0.0-r2');
  });

  it('extracts stable metadata independent of file name semantics', () => {
    const meta = extractPresetMeta(
      'renamed-anything.json',
      {
        printer: 'a1',
        type: 'quick',
        version: '3.0.0-r1',
        _custom_name: 'A1 我的快拆版'
      }
    );

    expect(meta).toEqual({
      fileName: 'renamed-anything.json',
      printerId: 'a1',
      versionType: 'quick',
      contentVersion: '3.0.0-r1',
      displayName: 'A1 我的快拆版'
    });
  });

  it('builds valid context keys and rejects null-like contexts', () => {
    expect(buildContextKey('a1', 'standard')).toBe('a1_standard');
    expect(() => buildContextKey('', 'standard')).toThrow(/Printer id is required/);
  });
});
