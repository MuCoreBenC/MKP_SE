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
    expect(block).toMatch(/const versionType = context\?\.versionType \|\| selectedVersion;/);
    expect(block).toMatch(/await renderPresetList\(printerData, versionType\);/);
  });

  it('prefers shared current preset context when re-rendering after togglePinnedPreset', () => {
    const block = getPresetsBlock('function togglePinnedPreset(', 'function hidePresetContextMenu(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedPrinterData = context\?\.printerData \|\| printerData;/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| versionType;/);
    expect(block).toMatch(/savePinnedPresetSet\(printerData\.id, versionType, pinnedSet\);/);
    expect(block).toMatch(/renderPresetList\(resolvedPrinterData, resolvedVersionType\);/);
  });

  it('prefers shared current preset context when re-rendering after handleRenameLocal succeeds', () => {
    const block = getPresetsBlock('async function handleRenameLocal(', 'async function showLocalFileInFolder(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedPrinterData = context\?\.printerData \|\| target\.printerData;/);
    expect(block).toMatch(/const resolvedVersionType = context\?\.versionType \|\| target\.versionType;/);
    expect(block).toMatch(/await renderPresetList\(resolvedPrinterData, resolvedVersionType\);/);
  });

  it('does not pass target.versionType from ctxBtnApply and lets handleApplyLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnApply: (target) => {', 'ctxBtnEdit: (target) => {');

    expect(block).toMatch(/handleApplyLocal\([\s\S]*target\.fileName,[\s\S]*target\.fileName,[\s\S]*target\.printerData,[\s\S]*null[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });

  it('does not pass target.versionType from ctxBtnDelete and lets handleDeleteLocal resolve shared context itself', () => {
    const block = getPresetsBlock('ctxBtnDelete: (target) => {', 'Object.entries(actionMap).forEach(');

    expect(block).toMatch(/handleDeleteLocal\([\s\S]*target\.fileName,[\s\S]*target\.fileName,[\s\S]*null,[\s\S]*target\.printerData,[\s\S]*null[\s\S]*\)/);
    expect(block).not.toMatch(/target\.versionType/);
  });
});
