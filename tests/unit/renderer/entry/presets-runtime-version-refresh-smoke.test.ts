import { describe, expect, it } from 'vitest';

import { getPresetsBlock } from './presets-runtime-smoke-helpers';

describe('presets.js version refresh smoke', () => {
  it('does not immediately recurse renderDownloadVersions after saveUserConfig in the final active implementation', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'function clearOnlineListUI(');

    expect(block).not.toMatch(/saveUserConfig\(\);[\s\S]*renderDownloadVersions\(resolvedPrinter\);/);
  });

  it('does not refresh calibration availability twice inside the final version-card selection flow', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'function clearOnlineListUI(');

    expect(block).not.toMatch(/clearOnlineListUI\(\);[\s\S]*window\.refreshCalibrationAvailability\(\);[\s\S]*if \(typeof window\.refreshCalibrationAvailability === 'function'\) \{[\s\S]*window\.refreshCalibrationAvailability\(\);/);
  });

  it('keeps calibration refresh outside the version-card callback and calls it only once per renderDownloadVersions body', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/renderVersionCards\('downloadVersionList', resolvedPrinter, resolvedVersionType, \(versionType\) => \{[\s\S]*clearOnlineListUI\(\);[\s\S]*\}\);/);
    expect(block).toMatch(/selectedVersion = versionType;[\s\S]*updateSidebarVersionBadge\(versionType\);[\s\S]*clearOnlineListUI\(\);/);
    expect(block).not.toMatch(/renderVersionCards\([\s\S]*window\.refreshCalibrationAvailability\(\);[\s\S]*\}\);/);
    expect((block.match(/window\.refreshCalibrationAvailability\(\);/g) || []).length).toBe(1);
  });

  it('still keeps a single unified calibration refresh when renderDownloadVersions clears the preset list for empty version selection', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\} else \{[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*if \(dlBtn\) dlBtn\.disabled = true;[\s\S]*if \(dlHint\) dlHint\.style\.opacity = '1';[\s\S]*\}/);
    expect(block).toMatch(/if \(typeof window\.refreshCalibrationAvailability === 'function'\) \{[\s\S]*window\.refreshCalibrationAvailability\(\);[\s\S]*\}/);
    expect((block.match(/window\.refreshCalibrationAvailability\(\);/g) || []).length).toBe(1);
  });
});
