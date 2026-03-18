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
    expect(block).toMatch(/selectedVersion = versionType;[\s\S]*__syncLegacyContextToModern__[\s\S]*renderDownloadVersions\(resolvedPrinter\);[\s\S]*updateSidebarVersionBadge\(versionType\);[\s\S]*clearOnlineListUI\(\);/);
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

  it('clears newly downloaded highlight state when renderDownloadVersions switches to a different version context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*window\.newlyDownloadedFile = null;[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*window\.newlyDownloadedFile = null;[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('clears batch-selected local files when renderDownloadVersions switches the local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*selectedLocalFiles\.clear\(\);[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*selectedLocalFiles\.clear\(\);[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('clears local search state when renderDownloadVersions switches the local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*localSearchQuery = '';[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*localSearchQuery = '';[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('resets local sort mode before renderDownloadVersions re-renders a different local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*localSortMode = 'custom';[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*localSortMode = 'custom';[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('turns off batch mode before renderDownloadVersions re-renders a different local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*toggleMultiSelectMode\(false\);[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*toggleMultiSelectMode\(false\);[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('resets selection state in a stable order before either version-switch render branch', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*selectedLocalFiles\.clear\(\);[\s\S]*localSearchQuery = '';[\s\S]*localSortMode = 'custom';[\s\S]*draggedCard = null;[\s\S]*toggleMultiSelectMode\(false\);[\s\S]*hidePresetContextMenu\(\{ immediate: true \}\);[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*selectedLocalFiles\.clear\(\);[\s\S]*localSearchQuery = '';[\s\S]*localSortMode = 'custom';[\s\S]*draggedCard = null;[\s\S]*toggleMultiSelectMode\(false\);[\s\S]*hidePresetContextMenu\(\{ immediate: true \}\);[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('hides stale preset context-menu state before renderDownloadVersions re-renders a different local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*hidePresetContextMenu\(\{ immediate: true \}\);[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*hidePresetContextMenu\(\{ immediate: true \}\);[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });

  it('clears stale drag state before renderDownloadVersions re-renders a different local preset context', () => {
    const block = getPresetsBlock('function renderDownloadVersions(printerData) {', 'async function fetchCloudPresets(');

    expect(block).toMatch(/if \(!resolvedVersionType\) \{[\s\S]*draggedCard = null;[\s\S]*renderPresetList\(resolvedPrinter, null\);[\s\S]*\}/);
    expect(block).toMatch(/else \{[\s\S]*draggedCard = null;[\s\S]*renderPresetList\(resolvedPrinter, resolvedVersionType\);[\s\S]*\}/);
  });
});
