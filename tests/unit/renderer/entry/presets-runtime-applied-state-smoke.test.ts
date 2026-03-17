import { describe, expect, it } from 'vitest';

import { getPresetsBlock } from './presets-runtime-smoke-helpers';

describe('presets.js applied-state smoke', () => {
  it('reuses shared active preset file resolution in getResolvedActiveFileName before legacy active-file fallback', () => {
    const block = getPresetsBlock('function getResolvedActiveFileName(', 'function escapeHtml(');

    expect(block).toMatch(/const legacyActiveFileName = localStorage\.getItem\(`mkp_current_script_\$\{printerId\}_\$\{versionType\}`\)/);
    expect(block).toMatch(/return typeof window\.resolveActivePresetFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveActivePresetFileName\(window, legacyActiveFileName\)/);
    expect(block).toMatch(/: legacyActiveFileName;/);
  });

  it('prefers shared active preset file resolution when clearing applied local presets', () => {
    const block = getPresetsBlock('function clearAppliedPresetSelection(', 'async function executeBatchDelete()');

    expect(block).toMatch(/const legacyActiveFile = localStorage\.getItem\(currentStorageKey\)/);
    expect(block).toMatch(/const activeFile = typeof window\.resolveActivePresetFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveActivePresetFileName\(window, legacyActiveFile\)/);
    expect(block).toMatch(/if \(activeFile && fileNames\.includes\(activeFile\)\)/);
  });

  it('reuses shared active preset file resolution in handleApplyLocal before deciding reapply state', () => {
    const block = getPresetsBlock('function handleApplyLocal(', 'async function handleDeleteLocal(');

    expect(block).toMatch(/const context = getCurrentPresetContext\(\);/);
    expect(block).toMatch(/const resolvedVersionType = versionType \|\| context\?\.versionType \|\| selectedVersion;/);
    expect(block).toMatch(/const legacyActiveFile = localStorage\.getItem\(`mkp_current_script_\$\{currentKey\}`\)/);
    expect(block).toMatch(/const previousActiveFile = typeof window\.resolveActivePresetFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveActivePresetFileName\(window, legacyActiveFile\)/);
    expect(block).toMatch(/const isReapply = previousActiveFile === fileName && button === clickedBtn;/);
  });

  it('reuses shared download applied-state resolution in renderPresetList before toggling download CTA', () => {
    const block = getPresetsBlock('async function renderPresetList(', 'function renderListItems(');

    expect(block).toMatch(/const activeFileName = getResolvedActiveFileName\(printerData\.id, versionType\)/);
    expect(block).toMatch(/const hasApplied = typeof window\.resolveDownloadAppliedState === 'function'/);
    expect(block).toMatch(/\? window\.resolveDownloadAppliedState\(window, localData\.map\(\(item\) => item\.fileName\), activeFileName\)/);
  });

  it('reuses shared download applied-state resolution in renderListItems before building local applied UI', () => {
    const block = getPresetsBlock('function renderListItems(', 'async function fetchCloudPresets(');

    expect(block).toMatch(/const activeFileName = getResolvedActiveFileName\(printerData\.id, versionType\)/);
    expect(block).toMatch(/const isApplied = isLocal && \(typeof window\.resolveDownloadAppliedState === 'function'/);
    expect(block).toMatch(/window\.resolveDownloadAppliedState\(window, \[release\.fileName\], activeFileName\)/);
    expect(block).toMatch(/const buttonText = isLocal \? \(isApplied \? '已应用' : '应用'\) : '下载';/);
  });

  it('keeps renderPresetList and renderListItems on the same shared applied-state helper family', () => {
    const listBlock = getPresetsBlock('async function renderPresetList(', 'function renderListItems(');
    const itemsBlock = getPresetsBlock('function renderListItems(', 'async function fetchCloudPresets(');

    expect(listBlock).toMatch(/window\.resolveDownloadAppliedState\(window, localData\.map\(\(item\) => item\.fileName\), activeFileName\)/);
    expect(itemsBlock).toMatch(/window\.resolveDownloadAppliedState\(window, \[release\.fileName\], activeFileName\)/);
  });
});
