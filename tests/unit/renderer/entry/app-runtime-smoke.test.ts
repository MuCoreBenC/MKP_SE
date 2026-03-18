import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('app.js modern runtime smoke', () => {
  it('reuses shared active preset file resolution in getResolvedActiveFileName before legacy fallback', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function getResolvedActiveFileName('),
      source.lastIndexOf('async function withSuspendedUserConfigPersistence(')
    );

    expect(block).toMatch(/const legacyActiveFileName = localStorage\.getItem\(`mkp_current_script_\$\{currentKey\}`\)/);
    expect(block).toMatch(/return typeof window\.resolveActivePresetFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveActivePresetFileName\(window, legacyActiveFileName\)/);
    expect(block).toMatch(/: legacyActiveFileName;/);
  });

  it('prefers modern download context when re-rendering local presets after handleDownloadOnline succeeds', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function handleDownloadOnline('),
      source.lastIndexOf('async function fetchCloudPresets(')
    );

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/await renderPresetList\(printerData, versionType\);/);
  });

  it('prefers modern download context when fetchCloudPresets refreshes the local preset list cache', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function fetchCloudPresets('),
      source.lastIndexOf('async function checkUpdateEngine(')
    );

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(printerData\) renderPresetList\(printerData, versionType\);/);
  });

  it('prefers modern download context in safeRefreshLocalList before legacy selected globals', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function safeRefreshLocalList('),
      source.lastIndexOf('function renderVersionCards(')
    );

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/await renderPresetList\(printerData, versionType\);/);
  });

  it('prefers modern download context in checkOnlineUpdates before legacy selected globals', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function checkOnlineUpdates('),
      source.lastIndexOf('function clearOnlineListUI(')
    );

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(!printerData \|\| !versionType\)/);
    expect(block).toMatch(/fetchCloudPresets\(printerData\.id, versionType\)/);
    expect(block).toMatch(/renderListItems\(onlineList, releases, printerData, versionType, false\);/);
  });

  it('prefers modern download context in handleDeleteLocal before legacy selected globals', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function handleDeleteLocal('),
      source.lastIndexOf('function generateFaqItemHtml(')
    );

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(!printerData \|\| !versionType\)/);
    expect(block).toMatch(/const currentKey = `\$\{printerData\.id\}_\$\{versionType\}`;/);
    expect(block).toMatch(/renderPresetList\(printerData, versionType\);/);
  });

  it('continues preferring modern download context in renderVersionCards-adjacent refresh flows', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function safeRefreshLocalList('),
      source.lastIndexOf('function renderVersionCards(')
    );

    expect(block).toMatch(/window\.__getDownloadContextView__/);
    expect(block).toMatch(/modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\)/);
    expect(block).toMatch(/modernView\?\.selectedVersionType \|\| selectedVersion/);
  });

  it('keeps delete-local refresh logic on the same modern download view family as online refresh flows', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function handleDeleteLocal('),
      source.lastIndexOf('function generateFaqItemHtml(')
    );

    expect(block).toMatch(/window\.__getDownloadContextView__/);
    expect(block).toMatch(/modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\)/);
    expect(block).toMatch(/modernView\?\.selectedVersionType \|\| selectedVersion/);
  });

  it('keeps online-update refresh logic on the same modern download view family as local refresh flows', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function checkOnlineUpdates('),
      source.lastIndexOf('function clearOnlineListUI(')
    );

    expect(block).toMatch(/window\.__getDownloadContextView__/);
    expect(block).toMatch(/modernView\?\.printer \|\| getPrinterObj\(selectedPrinter\)/);
    expect(block).toMatch(/modernView\?\.selectedVersionType \|\| selectedVersion/);
  });

  it('keeps active-file resolution on the same modern preset-view family as params and presets pages', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function getResolvedActiveFileName('),
      source.lastIndexOf('async function withSuspendedUserConfigPersistence(')
    );

    expect(block).toMatch(/window\.resolveActivePresetFileName\(window, legacyActiveFileName\)/);
  });

  it('re-syncs sidebar brand and model labels after startup restore even when no printer is selected', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function init() {'),
      source.lastIndexOf('Logger.info("[O102] App init done");')
    );

    expect(block).toMatch(/restoreHomeSelectionSurfaces\(\);/);
  });

  it('renders the selected brand printer gallery on startup even when restore state has no selected printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function restoreHomeSelectionSurfaces() {'),
      source.lastIndexOf('async function syncUserConfigFromStorage() {')
    );

    expect(block).toMatch(/const printer = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/if \(printer\) \{[\s\S]*selectPrinter\(selectedPrinter, true\);[\s\S]*\} else \{[\s\S]*renderBrands\(\);[\s\S]*renderPrinters\(selectedBrand\);[\s\S]*\}/);
  });

  it('keeps sidebar summary sync inside the shared home-selection restore helper', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function restoreHomeSelectionSurfaces() {'),
      source.lastIndexOf('async function syncUserConfigFromStorage() {')
    );

    expect(block).toMatch(/if \(typeof syncSidebarSelectionState === 'function'\) \{[\s\S]*syncSidebarSelectionState\(\);[\s\S]*\} else if \(typeof updateSidebarVersionBadge === 'function'\)/);
  });

  it('keeps selected-download refresh behind a shared suspended-persistence helper', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function refreshDownloadSurfaceForCurrentSelection() {'),
      source.lastIndexOf('async function syncActivePresetFromStorage(')
    );

    expect(block).toMatch(/const printer = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/if \(printer && typeof window\.renderDownloadVersions === 'function'\) \{[\s\S]*await withSuspendedUserConfigPersistence\(async \(\) => \{[\s\S]*window\.renderDownloadVersions\(printer\);[\s\S]*\}\);[\s\S]*\}/);
  });

  it('re-syncs sidebar selection summary when user config is restored from storage events', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function syncUserConfigFromStorage() {'),
      source.lastIndexOf('function bindCrossWindowSync() {')
    );

    expect(block).toMatch(/restoreHomeSelectionSurfaces\(\);/);
  });
});
