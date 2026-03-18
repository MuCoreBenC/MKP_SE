import { describe, expect, it } from 'vitest';

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
    expect(block).toMatch(/const printerData = context\?\.printerData \|\| \(typeof getPrinterObj === 'function' \? getPrinterObj\(printerId\) : null\);/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| versionType;/);
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
});
