import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('app.js storage sync smoke', () => {
  it('does not repopulate cleared brand or printer selection from previous config during saveUserConfig', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function saveUserConfig()'),
      source.lastIndexOf('function loadUserConfig()')
    );

    expect(block).not.toMatch(/const resolvedPrinter = selectedPrinter \|\| previousConfig\.printer \|\| null;/);
    expect(block).not.toMatch(/const resolvedBrand = selectedBrand \|\| previousConfig\.brand \|\| null;/);
  });

  it('clears legacy brand and printer state when saved config omits them during loadUserConfig', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function loadUserConfig()'),
      source.lastIndexOf('function resolvePersistedVersionForPrinter(')
    );

    expect(block).not.toMatch(/if \(config\.brand\) selectedBrand = config\.brand;/);
    expect(block).not.toMatch(/if \(config\.printer\) selectedPrinter = config\.printer;/);
    expect(block).toMatch(/selectedBrand = config\.brand \|\| null;/);
    expect(block).toMatch(/selectedPrinter = config\.printer \|\| null;/);
  });

  it('does not re-render download versions a second time after selectPrinter during syncUserConfigFromStorage', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function syncUserConfigFromStorage()'),
      source.lastIndexOf('async function refreshDownloadSurfaceForCurrentSelection()')
    );

    expect(block).toMatch(/restoreHomeSelectionSurfaces\(\);/);
    expect(block).not.toMatch(/restoreHomeSelectionSurfaces\(\);[\s\S]*window\.renderDownloadVersions\(printer\);/);
  });

  it('does not refresh calibration availability a second time after renderDownloadVersions during syncActivePresetFromStorage', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function syncActivePresetFromStorage('),
      source.lastIndexOf('async function refreshCurrentPresetViews(')
    );

    expect(block).toMatch(/await refreshDownloadSurfaceForCurrentSelection\(\);/);
    expect(block).not.toMatch(/await refreshDownloadSurfaceForCurrentSelection\(\);[\s\S]*await refreshCalibrationAvailability\(\);/);
  });

  it('does not refresh calibration availability a second time after renderDownloadVersions during refreshCurrentPresetViews', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function refreshCurrentPresetViews('),
      source.lastIndexOf('async function maybePromptExternalPresetRefresh(')
    );

    expect(block).toMatch(/await refreshDownloadSurfaceForCurrentSelection\(\);/);
    expect(block).not.toMatch(/await refreshDownloadSurfaceForCurrentSelection\(\);[\s\S]*await refreshCalibrationAvailability\(\);/);
  });
});
