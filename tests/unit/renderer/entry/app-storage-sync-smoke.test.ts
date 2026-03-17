import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('app.js storage sync smoke', () => {
  it('does not re-render download versions a second time after selectPrinter during syncUserConfigFromStorage', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function syncUserConfigFromStorage()'),
      source.lastIndexOf('async function syncActivePresetFromStorage(')
    );

    expect(block).toMatch(/selectPrinter\(selectedPrinter, true\);/);
    expect(block).not.toMatch(/selectPrinter\(selectedPrinter, true\);[\s\S]*window\.renderDownloadVersions\(printer\);/);
  });

  it('does not refresh calibration availability a second time after renderDownloadVersions during syncActivePresetFromStorage', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function syncActivePresetFromStorage('),
      source.lastIndexOf('async function refreshCurrentPresetViews(')
    );

    expect(block).toMatch(/window\.renderDownloadVersions\(printer\);/);
    expect(block).not.toMatch(/window\.renderDownloadVersions\(printer\);[\s\S]*await refreshCalibrationAvailability\(\);/);
  });

  it('does not refresh calibration availability a second time after renderDownloadVersions during refreshCurrentPresetViews', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function refreshCurrentPresetViews('),
      source.lastIndexOf('async function maybePromptExternalPresetRefresh(')
    );

    expect(block).toMatch(/window\.renderDownloadVersions\(printer\);/);
    expect(block).not.toMatch(/window\.renderDownloadVersions\(printer\);[\s\S]*await refreshCalibrationAvailability\(\);/);
  });
});
