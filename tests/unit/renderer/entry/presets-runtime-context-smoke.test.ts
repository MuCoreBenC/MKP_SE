import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import { getPresetsBlock } from './presets-runtime-smoke-helpers';

describe('presets.js context smoke', () => {
  it('prefers modern download context view in getCurrentPresetContext before legacy globals', () => {
    const block = getPresetsBlock('function getCurrentPresetContext(', 'function loadLocalSortMode(');

    expect(block).toMatch(/const modernView = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const printerData = modernView\?\.printer \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(selectedPrinter\) : null\)/);
    expect(block).toMatch(/const versionType = modernView\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(!printerData \|\| !versionType\)/);
    expect(block).toMatch(/return \{ printerData, versionType \};/);
  });

  it('prefers modern download context in checkOnlineUpdates before legacy selected globals', () => {
    const block = getPresetsBlock('async function checkOnlineUpdates(', 'function handleApplyLocal(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/if \(!context\)/);
    expect(block).toMatch(/const \{ printerData, versionType \} = context;/);
    expect(block).toMatch(/const cloudResult = await fetchCloudPresets\(printerData\.id, versionType\);/);
    expect(block).toMatch(/renderListItems\(onlineList, cloudResult\.data, printerData, versionType, false\);/);
  });

  it('prefers shared current preset context in handleDeleteLocal before legacy selected globals', () => {
    const block = getPresetsBlock('async function handleDeleteLocal(', 'async function handleDuplicateLocal(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const printerData = printerDataArg \|\| context\?\.printerData \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(selectedPrinter\) : null\);/);
    expect(block).toMatch(/const versionType = versionTypeArg \|\| context\?\.versionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(!printerData \|\| !versionType\) return;/);
  });

  it('prefers shared current preset context when re-rendering after handleDuplicateLocal succeeds', () => {
    const block = getPresetsBlock('async function handleDuplicateLocal(', 'async function handleRenameLocal(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| versionType \|\| null;/);
    expect(block).toMatch(/window\.mkpAPI\.duplicatePreset\(\{[\s\S]*versionType: resolvedVersionType,[\s\S]*\}\)/);
    expect(block).toMatch(/const printerData = context\?\.printerData \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(printerId\) : null\);/);
    expect(block).toMatch(/await renderPresetList\(printerData, resolvedVersionType\);/);
  });

  it('prefers shared current preset context in saveCustomOrder before legacy selected globals', () => {
    const block = getPresetsBlock('function saveCustomOrder(', 'function clearAppliedPresetSelection(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedPrinterId = printerId \|\| context\?\.printerData\?\.id \|\| selectedPrinter;/);
    expect(block).toMatch(/const resolvedVersionType = versionType \|\| context\?\.versionType \|\| selectedVersion;/);
    expect(block).toMatch(/if \(!resolvedPrinterId \|\| !resolvedVersionType\) return;/);
    expect(block).toMatch(/localStorage\.setItem\(getCustomOrderKey\(resolvedPrinterId, resolvedVersionType\), JSON\.stringify\(newOrder\)\);/);
  });

  it('prefers shared current preset context when re-rendering after handleDownloadOnline succeeds', () => {
    const block = getPresetsBlock('async function handleDownloadOnline(', 'function clearOnlineListUI(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const printerData = context\?\.printerData \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(selectedPrinter\) : null\);/);
    expect(block).toMatch(/const versionType = context\?\.versionType \|\| null;/);
    expect(block).toMatch(/await renderPresetList\(printerData, versionType\);/);
  });

  it('prefers shared current preset context when re-rendering after togglePinnedPreset', () => {
    const block = getPresetsBlock('function togglePinnedPreset(', 'function hidePresetContextMenu(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedPrinterData = context\?\.printerData \|\| printerData;/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| versionType;/);
    expect(block).toMatch(/const storagePrinterId = resolvedPrinterData\?\.id \|\| printerData\.id;/);
    expect(block).toMatch(/const storageVersionType = resolvedVersionType \|\| versionType;/);
    expect(block).toMatch(/savePinnedPresetSet\(storagePrinterId, storageVersionType, pinnedSet\);/);
    expect(block).toMatch(/renderPresetList\(resolvedPrinterData, resolvedVersionType\);/);
  });

  it('prefers shared current preset context when re-rendering after handleRenameLocal succeeds', () => {
    const block = getPresetsBlock('async function handleRenameLocal(', 'async function showLocalFileInFolder(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedPrinterData = context\?\.printerData \|\| target\.printerData;/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| null;/);
    expect(block).toMatch(/await renderPresetList\(resolvedPrinterData, resolvedVersionType\);/);
  });

  it('prefers shared current preset context in editAndApplyLocal before falling back to printerId and explicit version', () => {
    const block = getPresetsBlock('function editAndApplyLocal(', 'async function getManifestPresetsForPrinter(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const printerData = context\?\.printerData;/);
    expect(block).toMatch(/const resolvedPrinterData = printerData \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(printerId\) : null\);/);
    expect(block).toMatch(/const resolvedVersionType = versionType \|\| context\?\.versionType \|\| null;/);
    expect(block).toMatch(/if \(!resolvedPrinterData\) return;/);
    expect(block).toMatch(/handleApplyLocal\(fileName, fileName, resolvedPrinterData, resolvedVersionType, null\);/);
  });

  it('does not pass target.versionType from ctxBtnApply and lets handleApplyLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnApply: (target) => {', 'ctxBtnEdit: (target) => {');

    expect(block).toMatch(/handleApplyLocal\([\s\S]*target\.fileName,[\s\S]*target\.fileName,[\s\S]*target\.printerData,[\s\S]*null[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });

  it('does not pass target.versionType from ctxBtnEdit and lets editAndApplyLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnEdit: (target) => {', 'ctxBtnCopy: (target) => {');

    expect(block).toMatch(/editAndApplyLocal\([\s\S]*target\.fileName,[\s\S]*target\.printerData\.id,[\s\S]*null[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });

  it('does not pass target.versionType from ctxBtnDelete and lets handleDeleteLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnDelete: (target) => {', 'Object.entries(actionMap).forEach(');

    expect(block).toMatch(/handleDeleteLocal\([\s\S]*target\.fileName,[\s\S]*target\.fileName,[\s\S]*null,[\s\S]*target\.printerData,[\s\S]*null[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });

  it('does not pass target.versionType from ctxBtnCopy and lets handleDuplicateLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnCopy: (target) => {', 'ctxBtnPin: (target) => {');

    expect(block).toMatch(/handleDuplicateLocal\([\s\S]*target\.fileName,[\s\S]*target\.printerData\.id,[\s\S]*null,[\s\S]*target\.realVersion[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });

  it('does not pass context.versionType from bulk duplicate loop and lets handleDuplicateLocal resolve shared context itself', () => {
    const block = getPresetsBlock('async function executeBatchDuplicate(', 'function editAndApplyLocal(');

    expect(block).toMatch(/handleDuplicateLocal\([\s\S]*fileName,[\s\S]*context\.printerData\.id,[\s\S]*null,[\s\S]*meta\?\.realVersion \|\| '0\.0\.1'[\s\S]*\)/);
    expect(block).toContain('context.printerData.id,\n      null,');
  });

  it('keeps batch delete anchored on shared current preset context for clear-and-rerender flow', () => {
    const block = getPresetsBlock('async function executeBatchDelete(', 'async function executeBatchDuplicate(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/if \(context\) \{[\s\S]*clearAppliedPresetSelection\(context\.printerData, context\.versionType, result\.deleted \|\| \[\]\);[\s\S]*\}/);
    expect(block).toMatch(/selectedLocalFiles\.clear\(\);/);
    expect(block).toMatch(/toggleMultiSelectMode\(false\);/);
    expect(block).toMatch(/if \(context\) \{[\s\S]*await renderPresetList\(context\.printerData, context\.versionType\);[\s\S]*\}/);
  });

  it('keeps ctxBtn apply/edit/copy/delete on the shared version-resolution strategy', () => {
    const block = getPresetsBlock('ctxBtnApply: (target) => {', 'Object.entries(actionMap).forEach(');

    expect(block).toMatch(/handleApplyLocal\([\s\S]*null[\s\S]*\)/);
    expect(block).toMatch(/editAndApplyLocal\([\s\S]*null[\s\S]*\)/);
    expect(block).toMatch(/handleDuplicateLocal\([\s\S]*null,[\s\S]*target\.realVersion[\s\S]*\)/);
    expect(block).toMatch(/handleDeleteLocal\([\s\S]*target\.printerData,[\s\S]*null[\s\S]*\)/);
  });

  it('keeps local batch controls inline in the single-row header instead of reviving the old lower toolbar', () => {
    const block = getPresetsBlock('function updateLocalManagerUI(', 'function updateLocalSearchToggleButton(');

    expect(block).toMatch(/const batchControls = document\.getElementById\('localHeaderBatchControls'\);/);
    expect(block).toMatch(/const infoAnchor = document\.getElementById\('localPresetInfoAnchor'\);/);
    expect(block).toMatch(/const btnLocalToolbarMore = document\.getElementById\('btnLocalToolbarMore'\);/);
    expect(block).toMatch(/checkUpdateBtn\.classList\.toggle\('hidden', isMultiSelectMode\);/);
    expect(block).toMatch(/btnLocalToolbarMore\.classList\.toggle\('hidden', isMultiSelectMode\);/);
    expect(block).toMatch(/batchControls\.classList\.toggle\('is-visible', isMultiSelectMode\);/);
    expect(block).toMatch(/infoAnchor\.classList\.toggle\('is-hidden', isMultiSelectMode\);/);
    expect(block).toMatch(/batchSelectAllBtn\.textContent = '全选';/);
    expect(block).toMatch(/batchInvertBtn\.textContent = '反选';/);
    expect(block).toMatch(/batchDeleteBtn\.textContent = '删除';/);
    expect(block).not.toMatch(/localBatchSummary/);
    expect(block).not.toMatch(/localBatchToolbar/);
    expect(block).not.toMatch(/btnBatchDuplicate/);
  });

  it('moves local sort selection into the overflow menu instead of keeping an inline select in the toolbar', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/presets.js', 'utf8');
    const loadBlock = getPresetsBlock('function loadLocalSortMode(', 'function updateLocalManagerUI(');
    const syncBlock = getPresetsBlock('function syncLocalSortMenu(', 'function hideLocalToolbarMenu(');
    const toggleBlock = getPresetsBlock('function toggleLocalToolbarMenu(', 'function applyLocalSortMode(');
    const applyBlock = getPresetsBlock('function applyLocalSortMode(', 'function bindLocalToolbarOverlays(');

    expect(loadBlock).toMatch(/syncLocalSortMenu\(\);/);
    expect(syncBlock).toMatch(/document\.querySelectorAll\('\[data-local-sort-option\]'\)/);
    expect(syncBlock).toMatch(/button\.dataset\.localSortOption === localSortMode/);
    expect(toggleBlock).toMatch(/const menu = document\.getElementById\('localToolbarMenu'\);/);
    expect(toggleBlock).toMatch(/openLocalToolbarMenu\(event\);/);
    expect(toggleBlock).toMatch(/hideLocalToolbarMenu\(\);/);
    expect(applyBlock).toMatch(/setLocalSortMode\(mode\);/);
    expect(applyBlock).toMatch(/hideLocalToolbarMenu\(\{ immediate: true \}\);/);
    expect(source).toMatch(/window\.toggleLocalToolbarMenu = toggleLocalToolbarMenu;/);
    expect(source).toMatch(/window\.applyLocalSortMode = applyLocalSortMode;/);
    expect(source).not.toMatch(/document\.getElementById\('localSortSelect'\)/);
  });

  it('renders local preset cards with always-mounted selection and action shells so multi-select can animate in place', () => {
    const block = getPresetsBlock('function renderListItems(', 'function renderVersionCards(');

    expect(block).toMatch(/const multiSelectClass = isLocal && isMultiSelectMode \? 'multi-select-enabled' : '';/);
    expect(block).toMatch(/item\.className = `collapse-item local-preset-card/);
    expect(block).toMatch(/<div class="multi-checkbox-shell" aria-hidden="\$\{isMultiSelectMode \? 'false' : 'true'\}">/);
    expect(block).toMatch(/role="checkbox" aria-checked="\$\{isSelected \? 'true' : 'false'\}"/);
    expect(block).toMatch(/<div class="flex items-center gap-2 action-tools">/);
    expect(block).toMatch(/<span class="collapse-arrow-shell">/);
    expect(block).not.toMatch(/action-tools \$\{isMultiSelectMode \? 'hidden' : 'flex'\}/);
    expect(block).not.toMatch(/collapse-arrow[\s\S]*isMultiSelectMode \? 'hidden' : 'block'/);
  });

  it('switches the local preset search toggle between search and close states instead of leaving two search icons visible', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/presets.js', 'utf8');
    const block = getPresetsBlock('function updateLocalSearchToggleButton(', 'function handleLocalSearch(');

    expect(source).toMatch(/const LOCAL_SEARCH_OPEN_ICON = '<svg class="w-4 h-4"/);
    expect(source).toMatch(/const LOCAL_SEARCH_CLOSE_ICON = '<svg class="w-4 h-4"/);
    expect(block).toMatch(/const button = document\.getElementById\('btnLocalSearchToggle'\);/);
    expect(block).toMatch(/const iconHost = button\?\.querySelector\('\[data-local-search-toggle-icon\]'\);/);
    expect(block).toMatch(/button\.setAttribute\('aria-expanded', isExpanded \? 'true' : 'false'\);/);
    expect(block).toMatch(/button\.classList\.toggle\('text-blue-500', isExpanded\);/);
    expect(block).toMatch(/iconHost\.innerHTML = isExpanded \? LOCAL_SEARCH_CLOSE_ICON : LOCAL_SEARCH_OPEN_ICON;/);
    expect(block).toMatch(/hideLocalToolbarMenu\(\{ immediate: true \}\);/);
    expect(block).toMatch(/wrapper\.classList\.remove\('hidden'\);[\s\S]*updateLocalSearchToggleButton\(\);[\s\S]*input\.focus\(\);/);
    expect(block).toMatch(/wrapper\.classList\.add\('hidden'\);[\s\S]*localSearchQuery = '';[\s\S]*updateLocalSearchToggleButton\(\);/);
  });

  it('keeps applied badges on a single line in both initial render and post-apply refresh', () => {
    const renderBlock = getPresetsBlock('function renderListItems(', 'function renderVersionCards(');
    const applyBlock = getPresetsBlock('function handleApplyLocal(', 'async function handleDeleteLocal(');

    expect(renderBlock).toMatch(/applied-badge[\s\S]*whitespace-nowrap/);
    expect(applyBlock).toMatch(/applied-badge[\s\S]*whitespace-nowrap/);
  });

  it('keeps malformed legacy duplicate files visible by falling back to presetType when file name contains null or undefined', () => {
    const matcherBlock = getPresetsBlock('function collectLocalPresetMatchers(', 'async function fetchCloudPresetLogMap(');
    const renderBlock = getPresetsBlock('async function renderPresetList(', 'function renderListItems(');

    expect(matcherBlock).toMatch(/const malformedPrefixes = new Set\(\);/);
    expect(matcherBlock).toMatch(/malformedPrefixes\.add\(`\$\{normalizedPrinterId\}_null_`\);/);
    expect(matcherBlock).toMatch(/malformedPrefixes\.add\(`\$\{normalizedPrinterId\}_undefined_`\);/);
    expect(matcherBlock).toMatch(/normalizedVersionType/);
    expect(matcherBlock).toMatch(/function matchesLocalPresetForPrinter\(fileName, matcher, presetType = null\)/);
    expect(matcherBlock).toMatch(/const normalizedPresetType = String\(presetType \|\| ''\)\.trim\(\)\.toLowerCase\(\);/);
    expect(matcherBlock).toMatch(/normalizedPresetType !== matcher\.normalizedVersionType/);
    expect(matcherBlock).toMatch(/Array\.from\(matcher\.malformedPrefixes \|\| \[\]\)\.some/);
    expect(renderBlock).toMatch(/matchesLocalPresetForPrinter\(item\.fileName, localPresetMatcher, item\.presetType\)/);
  });
});
