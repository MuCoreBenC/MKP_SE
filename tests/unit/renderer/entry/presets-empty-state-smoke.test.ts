import { describe, expect, it } from 'vitest';

import { getPresetsBlock } from './presets-runtime-smoke-helpers';

describe('presets.js empty-state smoke', () => {
  it('shows a printer-first empty-state message when no printer is selected', () => {
    const block = getPresetsBlock('async function renderPresetList(', 'function renderListItems(');

    expect(block).toMatch(/if \(!printerData\) \{/);
    expect(block).toMatch(/renderLocalEmptyState\('请先选择机型。'\);/);
  });

  it('shows a version-selection empty-state message when printer is selected but version is not', () => {
    const block = getPresetsBlock('async function renderPresetList(', 'function renderListItems(');

    expect(block).toMatch(/if \(!versionType\) \{/);
    expect(block).toMatch(/renderLocalEmptyState\('请先在上方选择版本类型。'\);/);
  });
});
