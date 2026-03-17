import { describe, expect, it } from 'vitest';

import { VersionService } from '../../../../src/renderer/app/services/version-service';

describe('VersionService', () => {
  it('normalizes the current local version source', () => {
    const service = new VersionService();

    expect(service.getCurrentVersion('v0.2.10')).toBe('0.2.10');
  });

  it('detects when a newer version exists remotely', () => {
    const service = new VersionService();

    expect(service.hasNewerVersion('0.2.10', '0.2.11')).toBe(true);
    expect(service.hasNewerVersion('0.2.10', '0.2.10')).toBe(false);
  });

  it('rejects blank current version sources', () => {
    const service = new VersionService();

    expect(() => service.getCurrentVersion('   ')).toThrow(/Current version is missing/);
  });
});
