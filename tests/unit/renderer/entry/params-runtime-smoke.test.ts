import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('params.js modern runtime smoke', () => {
  it('short-circuits getActivePresetPath to the modern params preset view before legacy storage work', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function getActivePresetPath()'),
      source.lastIndexOf('async function loadActivePreset(')
    );

    expect(block).toMatch(/const downloadContext = typeof window\.__getDownloadContextView__ === 'function'/);
    expect(block).toMatch(/const resolvedPrinterId = downloadContext\?\.printer\?\.id \|\| selectedPrinter;/);
    expect(block).toMatch(/const resolvedVersionType = downloadContext\?\.selectedVersionType \|\| selectedVersion;/);
    expect(block).toMatch(/const currentKey = `\$\{resolvedPrinterId\}_\$\{resolvedVersionType\}`;/);
    expect(block).toMatch(/const modernPath = typeof window\.__getParamsPresetView__ === 'function'/);
    expect(block).toMatch(/if\s*\(modernPath\)\s*\{\s*return modernPath;\s*\}/);
    expect(block).toMatch(/localStorage\.getItem\(`mkp_current_script_\$\{currentKey\}`\)/);
    expect(block).toMatch(/window\.mkpAPI\.getUserDataPath\(\)/);
  });

  it('guards renderDynamicParamsPage against null presets before any preset.path access', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/const modernPresetView = typeof window\.__getParamsPresetView__ === 'function'/);
    expect(block).toMatch(/if\s*\(!preset\)\s*\{/);
    expect(block).toMatch(/const emptyLabel = modernPresetView\?\.fileName \|\| '.*?'/);
    expect(block).not.toMatch(/currentEditingFile\.dataset\.baseName = '未选择';\s*currentEditingFile\.textContent = '未选择';/);
    expect(block).toMatch(/const fileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/const presetPath = typeof window\.resolveParamsPresetPath === 'function'/);
    expect(block).toMatch(/\? window\.resolveParamsPresetPath\(window, preset\.path\) \|\| preset\.path/);
    expect(block).toMatch(/\? window\.resolveParamsDisplayFileName\(window, presetPath\)/);
    expect(block).not.toMatch(/: modernPresetView\?\.fileName \|\| presetPath\.split\\\('\\\\'\\\)\.pop\(\)/);
    expect(block).toMatch(/ensurePresetBackup\(presetPath\)/);
    expect(block).toMatch(/let store = getParamStore\(presetPath\)/);
    expect(block).toMatch(/store = ensureParamStore\(presetPath, diskFlat\)/);
    expect(block).toMatch(/paramEditorSession\.activePath = presetPath;/);
    expect(block).toMatch(/updateParamDirtyUI\(null\);\s*return;/);
  });

  it('reuses the resolved active preset path as the single cache and disk anchor in loadActivePreset', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function loadActivePreset('),
      source.lastIndexOf('function getEmptyParamsState(')
    );

    expect(block).toMatch(/const path = await getActivePresetPath\(\);/);
    expect(block).toMatch(/if \(!forceRefresh && window\.presetCache\.path === path/);
    expect(block).toMatch(/const result = await window\.mkpAPI\.readPreset\(path\);/);
    expect(block).toMatch(/if \(typeof window\.updatePresetCacheSnapshot === 'function'\) \{/);
    expect(block).toMatch(/window\.updatePresetCacheSnapshot\(path, result\.data\);/);
    expect(block).toMatch(/else \{\s*window\.presetCache = \{ path, data: result\.data, timestamp: now \};\s*\}/);
    expect(block).toMatch(/return \{ path, data: result\.data \};/);
  });

  it('prefers modern params preset file name in save confirmation before legacy path-derived name', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/const presetPath = typeof window\.resolveParamsPresetPath === 'function'/);
    expect(block).toMatch(/const fileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveParamsPresetPath\(window, preset\.path\) \|\| preset\.path/);
    expect(block).toMatch(/\? window\.resolveParamsDisplayFileName\(window, presetPath\)/);
    expect(block).toMatch(/overwritePreset\(presetPath, unflattenObject\(flatUpdates\)\)/);
    expect(block).toMatch(/updatePresetCacheSnapshot\(presetPath, nextPresetData\)/);
    expect(block).toMatch(/if \(typeof window\.updatePresetCacheSnapshot === 'function'\) \{/);
    expect(block).toMatch(/else \{\s*window\.presetCache = \{/);
    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-save', path: presetPath, forceRefresh: false \}\)/);
    expect(block).toMatch(/window\.broadcastPresetMutation\(\{ reason: 'params-save', path: presetPath \}\)/);
    expect(block).toMatch(/msg: `将把当前参数写回到 <span class="font-mono text-xs">\$\{escapeParamHtml\(fileName\)\}<\/span>。`/);
  });

  it('prefers modern params preset file name in restore success feedback before legacy default file name', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const presetPath = typeof window\.resolveParamsPresetPath === 'function'/);
    expect(block).toMatch(/const restoredFileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/\? window\.resolveParamsPresetPath\(window, preset\.path\) \|\| preset\.path/);
    expect(block).not.toMatch(/modernPresetView\?\.fileName/);
    expect(block).toMatch(/\? window\.resolveParamsDisplayFileName\(window, presetPath\) \|\| defaultFileName/);
    expect(block).toMatch(/readPresetBackup\(presetPath\)/);
    expect(block).toMatch(/overwritePreset\(presetPath, defaultData\)/);
    expect(block).toMatch(/updatePresetCacheSnapshot\(presetPath, defaultData\)/);
    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)/);
    expect(block).toMatch(/window\.broadcastPresetMutation\(\{ reason: 'params-restore-defaults', path: presetPath \}\)/);
    expect(block).toMatch(/window\.updatePresetCacheSnapshot\(presetPath, defaultData\)|window\.presetCache = \{[\s\S]*path: presetPath,/);
    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)[\s\S]*await renderDynamicParamsPage\(\);/);
    expect(block).toMatch(/msg: `已按\$\{sourceLabel\}恢复为 \$\{restoredFileName\} 的初始内容。`/);
  });
});
