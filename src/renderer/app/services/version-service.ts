import { compareVersions } from '../core/version';

export class VersionService {
  public getCurrentVersion(packageVersion: string): string {
    const normalized = String(packageVersion || '').trim().replace(/^v/i, '');
    if (!normalized) {
      throw new Error('Current version is missing.');
    }

    return normalized;
  }

  public hasNewerVersion(currentVersion: string, latestVersion: string): boolean {
    return compareVersions(latestVersion, currentVersion) > 0;
  }
}
