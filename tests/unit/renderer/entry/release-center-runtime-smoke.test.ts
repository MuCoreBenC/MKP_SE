import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/release_center.html', 'utf8');
const releaseSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/release.js', 'utf8');

describe('release center switch runtime smoke', () => {
  it('renders release-center toggles with the shared slider switch markup', () => {
    expect(htmlSource).toMatch(/id="releaseForceUpdateStatus"[\s\S]*class="mkp-switch"[\s\S]*id="releaseForceUpdateInput"[\s\S]*class="mkp-switch-input"[\s\S]*class="mkp-switch-track"/);
    expect(htmlSource).toMatch(/id="releaseCanRollbackStatus"[\s\S]*class="mkp-switch"[\s\S]*id="releaseCanRollbackInput"[\s\S]*class="mkp-switch-input"[\s\S]*class="mkp-switch-track"/);
    expect(htmlSource).not.toContain('class="h-4 w-4 rounded border-gray-300 text-blue-500"');
  });

  it('keeps the release-center toggle status copy synchronized with the checkbox state', () => {
    expect(releaseSource).toMatch(/function syncReleaseToggleStatus\(statusId, checked\) \{/);
    expect(releaseSource).toMatch(/function syncReleaseToggleStatuses\(\) \{/);
    expect(releaseSource).toMatch(/syncReleaseToggleStatus\('releaseForceUpdateStatus', !!\$\('releaseForceUpdateInput'\)\?\.checked\);/);
    expect(releaseSource).toMatch(/syncReleaseToggleStatus\('releaseCanRollbackStatus', !!\$\('releaseCanRollbackInput'\)\?\.checked\);/);
    expect(releaseSource).toMatch(/\['releaseForceUpdateInput', 'releaseCanRollbackInput'\]\.forEach\(\(id\) => \{/);
    expect(releaseSource).toMatch(/\$\(id\)\.addEventListener\('change', \(\) => syncReleaseToggleStatuses\(\)\);/);
  });
});
