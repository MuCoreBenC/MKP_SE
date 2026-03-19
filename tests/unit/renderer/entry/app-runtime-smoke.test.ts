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

  it('does not leave empty catch blocks in startup and download bootstrap code', () => {
    const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(appSource).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
    expect(htmlSource).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
  });

  it('reuses one shared fixed-header shell across the fixed-header pages without adding extra section-nav markup outside params/settings', () => {
    const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.page-header-fixed-shell \{\s*padding-bottom: 0 !important;\s*border-bottom-color: var\(--border\) !important;\s*\}/);
    expect((htmlSource.match(/page-header-fixed-shell/g) || []).length).toBe(8);
    expect(htmlSource).toMatch(/<div id="page-home"[\s\S]*?<div class="page-header page-header-fixed-shell w-full">/);
    expect(htmlSource).toMatch(/<div id="page-download"[\s\S]*?<div class="page-header page-header-fixed-shell w-full">/);
    expect(htmlSource).toMatch(/<div id="page-calibrate"[\s\S]*?<div class="page-header page-header-fixed-shell w-full">/);
    expect(htmlSource).toMatch(/<div id="page-versions"[\s\S]*?<div class="page-header page-header-fixed-shell w-full">/);
    expect(htmlSource).toMatch(/<div id="page-faq"[\s\S]*?<div class="page-header page-header-fixed-shell w-full">/);
    expect(htmlSource).toMatch(/<div id="page-about"[\s\S]*?<div class="page-header page-header-fixed-shell w-full relative">/);
    expect(htmlSource).not.toMatch(/id="versionsSectionNav"|id="faqSectionNav"|id="aboutSectionNav"/);
  });

  it('can center floating tooltips over explicit center-aligned anchors such as the wipe-tower preview block', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function positionFloatingTooltip('),
      source.lastIndexOf('function showFloatingTooltip(')
    );

    expect(block).toMatch(/const tooltipAlign = String\(/);
    expect(block).toMatch(/anchor\.dataset\.tooltipAnchorAlign/);
    expect(block).toMatch(/anchor\.dataset\.tooltipAlign/);
    expect(block).toMatch(/let left = tooltipAlign === 'center'/);
    expect(block).toMatch(/anchorRect\.left \+ \(\(anchorRect\.width - tooltipWidth\) \/ 2\)/);
  });

  it('logs failed preset-manifest fetch candidates instead of silently swallowing them', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function fetchCloudPresets('),
      source.lastIndexOf('async function checkUpdateEngine(')
    );

    expect(block).toMatch(/Logger\.warn\(`\[O401\] Manifest candidate fetch failed:/);
  });

  it('logs startup bootstrap failures in index.html instead of silently swallowing them', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(source).toMatch(/\[MKP Boot\] theme mode bootstrap failed/);
    expect(source).toMatch(/\[MKP Boot\] theme color bootstrap failed/);
    expect(source).toMatch(/\[MKP Boot\] version theme bootstrap failed/);
    expect(source).toMatch(/\[MKP Boot\] onboarding bootstrap failed/);
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

  it('supports a draggable saved XY summary-card layout editor in calibration view', () => {
    const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');
    const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');

    expect(htmlSource).toMatch(/data-xy-summary-layout-card/);
    expect(htmlSource).toMatch(/data-xy-summary-drag-handle/);
    expect(htmlSource).toMatch(/id="xySummaryLayoutSaveBtn"/);
    expect(styleSource).toMatch(/--xy-summary-base-shift-x: calc\(var\(--xy-stage-center-offset\) \* -1\);/);
    expect(styleSource).toMatch(/--xy-summary-offset-x: 30px;/);
    expect(styleSource).toMatch(/transform: translate\(calc\(var\(--xy-summary-base-shift-x\) \+ var\(--xy-summary-offset-x\)\), var\(--xy-summary-offset-y\)\);/);
    expect(styleSource).toMatch(/\.xy-summary-layout-toolbar/);
    expect(styleSource).toMatch(/\.xy-summary-drag-handle/);
    expect(styleSource).toMatch(/\.xy-summary-layout-save\.is-dirty/);
    expect(appSource).toMatch(/const XY_SUMMARY_LAYOUT_KEY = 'mkp_xy_summary_layout_v1';/);
    expect(appSource).toMatch(/function bindXYSummaryLayoutEditor\(/);
    expect(appSource).toMatch(/document\.addEventListener\('pointermove', \(event\) => \{/);
    expect(appSource).toMatch(/localStorage\.setItem\(XY_SUMMARY_LAYOUT_KEY, JSON\.stringify\(nextLayout\)\);/);
    expect(appSource).toMatch(/window\.saveXYSummaryLayout = saveXYSummaryLayout;/);
    expect(appSource).toMatch(/bindXYSummaryLayoutEditor\(\);/);
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

  it('clears stale version cards and disables download actions when no printer is selected', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function renderDownloadVersions(printerData) {'),
      source.lastIndexOf('async function renderPresetList(')
    );

    expect(block).toMatch(/const container = document\.getElementById\('downloadVersionList'\);/);
    expect(block).toMatch(/if \(!printerData\) \{[\s\S]*container\.innerHTML = '';/);
    expect(block).toMatch(/if \(!printerData\) \{[\s\S]*clearOnlineListUI\(\);/);
    expect(block).toMatch(/if \(!printerData\) \{[\s\S]*renderPresetList\(null, null\);/);
    expect(block).toMatch(/if \(!printerData\) \{[\s\S]*if \(dlBtn\) dlBtn\.disabled = true;[\s\S]*if \(dlHint\) dlHint\.style\.opacity = '1';[\s\S]*return;[\s\S]*\}/);
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
