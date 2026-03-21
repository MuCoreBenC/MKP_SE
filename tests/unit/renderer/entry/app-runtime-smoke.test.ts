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

  it('uses the fixed-header page shell itself as the scroll container so side gutters and content share native scrolling', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(source).toContain('function resolveWheelDeltaReferenceLineHeight(referenceElement = null) {');
    expect(source).toContain('function normalizeWheelScrollDelta(event, referenceElement = null) {');
    expect(source).toContain("if (deltaMode === 0) {");
    expect(source).toContain("if (deltaMode === 1) {");
    expect(source).toContain('const lineHeight = resolveWheelDeltaReferenceLineHeight(referenceElement);');
    expect(source).toContain('top: event.deltaY * lineHeight');
    expect(source).toContain('left: event.deltaX * lineHeight');
    expect(source).toContain('function applyWheelScrollProxy(scrollContainer, event, referenceElement = null) {');
    expect(source).toContain('scrollContainer.scrollTop += delta.top;');
    expect(source).toContain('scrollContainer.scrollLeft += delta.left;');
    expect(source).toContain('window.normalizeWheelScrollDelta = normalizeWheelScrollDelta;');
    expect(source).toContain('window.applyWheelScrollProxy = applyWheelScrollProxy;');
    expect(source).toContain('function resolvePageScrollContainer(target = null) {');
    expect(source).toContain("if (page.dataset.fixedHeader === 'true') {");
    expect(source).toContain('return page;');
    expect(source).toContain('function getPageScrollHeaderOffset(scrollContainer = null) {');
    expect(source).toContain('window.resolvePageScrollContainer = resolvePageScrollContainer;');
    expect(source).toContain('window.getPageScrollHeaderOffset = getPageScrollHeaderOffset;');
    expect(source).not.toContain('function bindFixedHeaderPageWheelProxy() {');
    expect(source).not.toContain('bindFixedHeaderPageWheelProxy();');
    expect(styleSource).toMatch(/\.page:not\(\.hidden\)\[data-fixed-header="true"\] \{[\s\S]*overflow-y: auto !important;[\s\S]*overflow-x: hidden !important;[\s\S]*display: block;/);
    expect(styleSource).toMatch(/\.page:not\(\.hidden\)\[data-fixed-header="true"\] > \.page-header \{[\s\S]*position: sticky; top: 0;/);
    expect(styleSource).toMatch(/\.page:not\(\.hidden\)\[data-fixed-header="true"\] > \.page-content \{ overflow: visible; padding: 1\.5rem 2rem 0rem 2rem; \}/);
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

  it('builds the copied cli command from launch info so development mode prepends the app path before json and gcode args', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function updateScriptPathDisplay()'),
      source.lastIndexOf('function extractOffsetValues(')
    );

    expect(block).toContain('const cliLaunchInfo = window.mkpAPI?.getCliLaunchInfo');
    expect(block).toContain('? await window.mkpAPI.getCliLaunchInfo()');
    expect(block).toContain('exePath: await window.mkpAPI.getExePath(),');
    expect(block).toContain('if (cliLaunchInfo.defaultApp && cliLaunchInfo.appPath) {');
    expect(block).toContain('commandParts.push(`"${cliLaunchInfo.appPath}"`);');
    expect(block).toContain('commandParts.push(`--Json "${presetPath}" --Gcode`);');
    expect(block).toContain("const command = commandParts.join(' ');");
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

  it('loads the standalone God Mode layout editor and removes the old XY-only drag controls', () => {
    const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/god-mode-layout.css', 'utf8');
    const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
    const godModeSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/god-mode-layout.js', 'utf8');
    const preloadSource = readFileSync('D:/trae/MKP_SE/preload.js', 'utf8');
    const mainSource = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');
    const packageSource = readFileSync('D:/trae/MKP_SE/package.json', 'utf8');
    const layoutDefaultsRuntimeSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/layout-defaults-runtime.js', 'utf8');
    const layoutDefaultsGeneratedSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/layout-defaults.generated.js', 'utf8');

    expect(htmlSource).toMatch(/id="settingGodMode"/);
    expect(htmlSource).toMatch(/id="settingGodModeRow"/);
    expect(htmlSource).toMatch(/btnGodModeOpenFolder/);
    expect(htmlSource).toMatch(/btnGodModeRestorePrevious/);
    expect(htmlSource).toMatch(/btnGodModeRestoreInitial/);
    expect(htmlSource).toMatch(/btnGodModeFreezeFormal/);
    expect(htmlSource).toMatch(/assets\/js\/layout-defaults\.generated\.js/);
    expect(htmlSource).toMatch(/assets\/js\/layout-defaults-runtime\.js/);
    expect(htmlSource).toMatch(/function loadDeveloperOnlyGodModeAssets\(/);
    expect(htmlSource).toMatch(/window\.mkpAPI\.getGodModeRuntimeState/);
    expect(htmlSource).toMatch(/runtime\.isDeveloperMode/);
    expect(htmlSource).toMatch(/css\.href = 'assets\/css\/god-mode-layout\.css'/);
    expect(htmlSource).toMatch(/script\.src = 'assets\/js\/god-mode-layout\.js'/);
    expect(htmlSource).toMatch(/\[MKP Boot\] god mode asset bootstrap failed/);
    expect(htmlSource).not.toMatch(/xySummaryLayoutSaveBtn/);
    expect(htmlSource).not.toMatch(/data-xy-summary-drag-handle/);
    expect(styleSource).toMatch(/\.god-mode-offset/);
    expect(styleSource).toMatch(/\.god-mode-context-menu/);
    expect(styleSource).toMatch(/\.god-mode-snap-line-x/);
    expect(styleSource).toMatch(/\.god-mode-context-btn:disabled/);
    expect(styleSource).toMatch(/\.god-mode-selection-frame/);
    expect(styleSource).toMatch(/\.god-mode-selection-handle/);
    expect(styleSource).toMatch(/\.god-mode-selection-edge/);
    expect(styleSource).toMatch(/\.god-mode-sized/);
    expect(styleSource).toMatch(/translate: var\(--god-mode-offset-x, 0px\) var\(--god-mode-offset-y, 0px\);/);
    expect(godModeSource).toMatch(/const GOD_MODE_ENABLE_KEY = 'setting_god_mode_v1';/);
    expect(godModeSource).toMatch(/const GOD_MODE_LAYOUT_KEY = 'mkp_god_mode_layout_v1';/);
    expect(godModeSource).toMatch(/document\.addEventListener\('contextmenu', handleContextMenu, true\);/);
    expect(godModeSource).toMatch(/data-god-mode-action="parent"/);
    expect(godModeSource).toMatch(/data-god-mode-action="grandparent"/);
    expect(godModeSource).toMatch(/data-god-mode-action="edge-gap"/);
    expect(godModeSource).toMatch(/function armMoveMode\(/);
    expect(godModeSource).toMatch(/function startPointerMoveSession\(/);
    expect(godModeSource).toMatch(/function finishPointerMoveSession\(/);
    expect(godModeSource).toMatch(/function startResizeSession\(/);
    expect(godModeSource).toMatch(/function finishResizeSession\(/);
    expect(godModeSource).toMatch(/function openConstraintPanel\(/);
    expect(godModeSource).toMatch(/function applyConstraintOffsets\(/);
    expect(godModeSource).toMatch(/function normalizeConstraints\(/);
    expect(godModeSource).toMatch(/function hasActiveConstraints\(/);
    expect(godModeSource).toMatch(/function offsetLayoutByDelta\(/);
    expect(godModeSource).toMatch(/function resizeLayoutByDelta\(/);
    expect(godModeSource).toMatch(/function resolveEffectiveLayoutForElement\(/);
    expect(godModeSource).toMatch(/function syncConstraintSnapshotFromElement\(/);
    expect(godModeSource).toMatch(/function refreshConstraintObservers\(/);
    expect(godModeSource).toMatch(/function getSnappedResizeLayout\(/);
    expect(godModeSource).toMatch(/function nudgeResizeSession\(/);
    expect(godModeSource).toMatch(/function refreshResizeSessionAnchor\(/);
    expect(godModeSource).toMatch(/function ensureMoveShiftLock\(/);
    expect(godModeSource).toMatch(/function resolveMoveShiftAxis\(/);
    expect(godModeSource).toMatch(/function updateMoveSessionLayout\(/);
    expect(godModeSource).toMatch(/anchorPointer:/);
    expect(godModeSource).toMatch(/session\.shiftLock = \{/);
    expect(godModeSource).toMatch(/data-god-mode-resize-handle="e"/);
    expect(godModeSource).toMatch(/data-god-mode-selection-edge/);
    expect(godModeSource).toMatch(/function getAncestorRenderableTarget\(/);
    expect(godModeSource).toMatch(/function undoHistory\(/);
    expect(godModeSource).toMatch(/function redoHistory\(/);
    expect(godModeSource).toMatch(/function nudgeSelectedTarget\(/);
    expect(godModeSource).toMatch(/width: Number\.isFinite\(parsedWidth\)/);
    expect(godModeSource).toMatch(/height: Number\.isFinite\(parsedHeight\)/);
    expect(godModeSource).toMatch(/constraints: hasActiveConstraints\(constraints\) \? constraints : null/);
    expect(godModeSource).toMatch(/normalizedKey === 's'/);
    expect(godModeSource).toMatch(/normalizedKey === 'z'/);
    expect(godModeSource).toMatch(/normalizedKey === 'y'/);
    expect(godModeSource).toMatch(/normalizedKey\.startsWith\('arrow'\)/);
    expect(godModeSource).toMatch(/const snapDisabled = event\.ctrlKey \|\| event\.metaKey/);
    expect(godModeSource).toMatch(/function getSnappedDelta\(session, rawDx, rawDy, axisLock, snapDisabled = false\)/);
    expect(godModeSource).toMatch(/function getSnappedResizeLayout\(session, layout, snapDisabled = false\)/);
    expect(godModeSource).toMatch(/new ResizeObserver/);
    expect(godModeSource).toMatch(/if \(state\.dragSession\) \{[\s\S]*if \(acceleratorPressed\) \{[\s\S]*hideSnapLines\(\);/);
    expect(godModeSource).toMatch(/event\.shiftKey/);
    expect(godModeSource).toMatch(/function openInputPanel\(/);
    expect(godModeSource).toMatch(/window\.toggleGodMode = function toggleGodMode/);
    expect(godModeSource).toMatch(/function initializeRuntimeState\(/);
    expect(godModeSource).toMatch(/state\.developerMode = Boolean\(/);
    expect(godModeSource).toMatch(/localStorage\.removeItem\(GOD_MODE_LAYOUT_KEY\)/);
    expect(godModeSource).toMatch(/api\.saveGodModeLayoutSnapshot/);
    expect(godModeSource).toMatch(/api\.restoreGodModeLayoutSnapshot/);
    expect(godModeSource).toMatch(/api\.freezeGodModeLayoutAsFormal/);
    expect(godModeSource).toMatch(/api\.readGodModeLayoutState/);
    expect(godModeSource).toMatch(/state\.enabled = state\.developerMode && Boolean\(enabled\);/);
    expect(godModeSource).toMatch(/row\.hidden = !state\.developerMode;/);
    expect(godModeSource).toMatch(/window\.freezeGodModeAsFormalLayout = function freezeGodModeAsFormalLayout/);
    expect(godModeSource).toMatch(/state\.formalLayouts = loadFormalLayoutsFromWindow\(\);/);
    expect(godModeSource).toMatch(/btnGodModeFreezeFormal/);
    expect(preloadSource).toMatch(/getGodModeRuntimeState: \(\) => ipcRenderer\.invoke\('get-god-mode-runtime-state'\)/);
    expect(preloadSource).toMatch(/readGodModeLayoutState: \(\) => ipcRenderer\.invoke\('read-god-mode-layout-state'\)/);
    expect(preloadSource).toMatch(/saveGodModeLayoutSnapshot: \(payload\) => ipcRenderer\.invoke\('save-god-mode-layout-snapshot', payload\)/);
    expect(preloadSource).toMatch(/restoreGodModeLayoutSnapshot: \(target\) => ipcRenderer\.invoke\('restore-god-mode-layout-snapshot', target\)/);
    expect(preloadSource).toMatch(/openGodModeLayoutFolder: \(\) => ipcRenderer\.invoke\('open-god-mode-layout-folder'\)/);
    expect(preloadSource).toMatch(/freezeGodModeLayoutAsFormal: \(payload\) => ipcRenderer\.invoke\('freeze-god-mode-layout-as-formal', payload\)/);
    expect(mainSource).toMatch(/function isDeveloperLayoutModeAvailable\(\) \{/);
    expect(mainSource).toMatch(/return !app\.isPackaged;/);
    expect(mainSource).toMatch(/ipcMain\.handle\('get-god-mode-runtime-state'/);
    expect(mainSource).toMatch(/ipcMain\.handle\('read-god-mode-layout-state'/);
    expect(mainSource).toMatch(/ipcMain\.handle\('save-god-mode-layout-snapshot'/);
    expect(mainSource).toMatch(/ipcMain\.handle\('restore-god-mode-layout-snapshot'/);
    expect(mainSource).toMatch(/ipcMain\.handle\('open-god-mode-layout-folder'/);
    expect(mainSource).toMatch(/ipcMain\.handle\('freeze-god-mode-layout-as-formal'/);
    expect(layoutDefaultsRuntimeSource).toMatch(/window\.__MKP_LAYOUT_DEFAULTS__/);
    expect(layoutDefaultsRuntimeSource).toMatch(/window\.__MKP_LAYOUT_DEFAULTS_RUNTIME__/);
    expect(layoutDefaultsRuntimeSource).toMatch(/window\.mkpAPI\.getGodModeRuntimeState/);
    expect(layoutDefaultsRuntimeSource).toMatch(/function resolveEffectiveLayoutForElement\(/);
    expect(layoutDefaultsGeneratedSource).toMatch(/global\.__MKP_LAYOUT_DEFAULTS__ = \{/);
    expect(layoutDefaultsGeneratedSource).toMatch(/global\.__MKP_LAYOUT_DEFAULTS_META__ = \{/);
    expect(layoutDefaultsGeneratedSource).toMatch(/"layoutCount":/);
    expect(packageSource).toMatch(/"!src\/main\/god_mode_layout_store\.js"/);
    expect(packageSource).toMatch(/"!src\/renderer\/assets\/css\/god-mode-layout\.css"/);
    expect(packageSource).toMatch(/"!src\/renderer\/assets\/js\/god-mode-layout\.js"/);
    expect(appSource).not.toMatch(/XY_SUMMARY_LAYOUT_KEY/);
    expect(appSource).not.toMatch(/bindXYSummaryLayoutEditor/);
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
