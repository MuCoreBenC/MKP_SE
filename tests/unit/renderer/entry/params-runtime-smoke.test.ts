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
    expect(block).toMatch(/const diskRenderState = buildRenderableParamState\(diskFlat\);/);
    expect(block).toMatch(/store = ensureParamStore\(presetPath, diskRenderState\.flat\)/);
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

  it('marks the active params snapshot saved before broadcasting params-save mutations', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/markActiveParamSnapshotSaved\(snapshot\);[\s\S]*window\.emitActivePresetUpdated\(\{ reason: 'params-save', path: presetPath, forceRefresh: false \}\)/);
    expect(block).toMatch(/markActiveParamSnapshotSaved\(snapshot\);[\s\S]*window\.broadcastPresetMutation\(\{ reason: 'params-save', path: presetPath \}\)/);
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

  it('re-renders params page after restore-defaults only after broadcasting the shared preset mutation signals', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)[\s\S]*window\.broadcastPresetMutation\(\{ reason: 'params-restore-defaults', path: presetPath \}\)[\s\S]*await renderDynamicParamsPage\(\);/);
  });

  it('resolves the save target path before any overwrite or cache update in saveAllDynamicParams', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/const presetPath = typeof window\.resolveParamsPresetPath === 'function'[\s\S]*const fileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/const result = await window\.mkpAPI\.overwritePreset\(presetPath, unflattenObject\(flatUpdates\)\);/);
    expect(block).toMatch(/window\.updatePresetCacheSnapshot\(presetPath, nextPresetData\);|window\.presetCache = \{[\s\S]*path: presetPath,/);
  });

  it('rebuilds currentEditingFile base name from the resolved params display name during renderDynamicParamsPage before later dirty-state decoration', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/const fileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/currentEditingFile\.dataset\.baseName = fileName;[\s\S]*currentEditingFile\.textContent = fileName;/);
    expect(block).toMatch(/applyParamSnapshotToDom\(activeSnapshot, \{ restoreFocus: false \}\);[\s\S]*updateParamDirtyState\(store\);/);
  });

  it('renders low-emphasis advanced template and diagnostics disclosures after the main param groups', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/const diskRenderState = buildRenderableParamState\(diskFlat\);/);
    expect(block).toMatch(/const renderState = buildRenderableParamState\(activeSnapshot\.flat\);/);
    expect(block).toMatch(/const groups = buildParamGroupSections\(renderState\.flat\);/);
    expect(block).toMatch(/\$\{renderParamGroup\('advanced', groups\.advanced\)\}[\s\S]*\$\{renderParamDisclosureSection\(buildAdvancedTemplateDisclosure\(renderState\.flat\)\)\}[\s\S]*\$\{renderParamDisclosureSection\(buildDiagnosticsDisclosure\(renderState\.flat, presetPath, fileName\)\)\}/);
  });

  it('coerces advanced template fields through keyed editor helpers so line-array templates round-trip to JSON', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const collectBlock = source.slice(
      source.lastIndexOf('function collectParamFullStateFromDom()'),
      source.lastIndexOf('function updateParamDirtyState(')
    );
    const applyBlock = source.slice(
      source.lastIndexOf('function applyParamSnapshotToDom('),
      source.lastIndexOf('function applyFullParamStateToDom(')
    );

    expect(collectBlock).toMatch(/flatUpdates\[key\] = coerceParamValue\(input\.value, input, key\);/);
    expect(collectBlock).toMatch(/flatUpdates\[key\] = coerceParamValue\(rawInput \? rawInput\.value : '', rawInput, key\);/);
    expect(applyBlock).toMatch(/input\.value = getParamEditorTextValue\(key, value\);/);
    expect(applyBlock).toMatch(/rawInput\.value = getParamEditorTextValue\(key, snapshot\.flat\[key\]\);/);
  });

  it('defines shared disclosure helpers and template defaults for the bottom params tools', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const PARAM_TEMPLATE_FIELD_ORDER = \[/);
    expect(source).toMatch(/function buildRenderableParamState\(flatData = \{\}\) \{/);
    expect(source).toMatch(/function renderParamDisclosureSection\(section\) \{/);
    expect(source).toMatch(/<details class="params-disclosure params-disclosure-subtle" data-disclosure-id="/);
  });

  it('exposes switch_tower_type as a params selector with slow-line tower default and fast-line lollipop override', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const PARAM_VALUE_DEFAULTS = \{\s*'wiping\.switch_tower_type': 1\s*\};/);
    expect(source).toMatch(/'wiping\.switch_tower_type': \{[\s\S]*type: 'select'[\s\S]*options: \[/);
    expect(source).toMatch(/value: 1, label: '擦料塔（慢线，默认）'/);
    expect(source).toMatch(/value: 2, label: '棒棒糖（快线）'/);
    expect(source).toMatch(/function createStandardField\(key, value, meta, inputType\) \{[\s\S]*if \(inputType === 'select' && Array\.isArray\(meta\.options\)\) \{/);
    expect(source).toMatch(/<select data-json-key="\$\{escapeParamHtml\(key\)\}" class="dynamic-param-input param-editable param-input">/);
    expect(source).toMatch(/switchTowerType: presetData\.wiping\?\.switch_tower_type \?\? 1/);
  });

  it('keeps restore-defaults on the shared saved-state path before re-rendering the params page', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const restoredSnapshot = createParamSnapshot\(flattenObject\(defaultData\), collectParamModesFromDom\(\)\);/);
    expect(block).toMatch(/pushParamSnapshotToHistory\(restoredSnapshot, \{ markSaved: true \}\);/);
    expect(block).toMatch(/pushParamSnapshotToHistory\(restoredSnapshot, \{ markSaved: true \}\);[\s\S]*await renderDynamicParamsPage\(\);/);
  });

  it('clears dirty UI only after rebuilding the empty currentEditingFile label in the no-preset branch', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/if \(!preset\) \{[\s\S]*currentEditingFile\.dataset\.baseName = emptyLabel;[\s\S]*currentEditingFile\.textContent = emptyLabel;[\s\S]*updateParamDirtyUI\(null\);[\s\S]*return;[\s\S]*\}/);
  });

  it('does not rewrite currentEditingFile base name again during saveAllDynamicParams and leaves label refresh to the shared dirty/render path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).not.toMatch(/currentEditingFile\.dataset\.baseName|currentEditingFile\.textContent/);
    expect(block).toMatch(/markActiveParamSnapshotSaved\(snapshot\);/);
  });

  it('clears params dirty UI through the shared saved-snapshot path before broadcasting params-save mutations', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/markActiveParamSnapshotSaved\(snapshot\);[\s\S]*window\.emitActivePresetUpdated\(\{ reason: 'params-save', path: presetPath, forceRefresh: false \}\)/);
    expect(block).not.toMatch(/window\.emitActivePresetUpdated\([\s\S]*markActiveParamSnapshotSaved\(snapshot\);/);
  });

  it('only re-renders the params page after restore-defaults when the params page is actually visible', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const isParamsVisible = !document\.getElementById\('page-params'\)\?\.classList\.contains\('hidden'\);/);
    expect(block).toMatch(/if \(isParamsVisible\) \{[\s\S]*applyParamSnapshotToDom\([\s\S]*\);[\s\S]*\}/);
    expect(block).toMatch(/if \(isParamsVisible\) \{[\s\S]*await renderDynamicParamsPage\(\);[\s\S]*\}/);
  });

  it('keeps restore-defaults success messaging on the resolved restoredFileName contract even when page re-render is visibility-gated', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const restoredFileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/if \(isParamsVisible\) \{[\s\S]*await renderDynamicParamsPage\(\);[\s\S]*\}/);
    expect(block).toMatch(/await MKPModal\.alert\(\{ title: '已恢复', msg: `已按\$\{sourceLabel\}恢复为 \$\{restoredFileName\} 的初始内容。`, type: 'success' \}\);/);
  });

  it('keeps restore-defaults dirty-label cleanup on the shared saved snapshot and visible-page rerender path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/pushParamSnapshotToHistory\(restoredSnapshot, \{ markSaved: true \}\);/);
    expect(block).toMatch(/if \(isParamsVisible\) \{[\s\S]*applyParamSnapshotToDom\([\s\S]*\);[\s\S]*\}/);
    expect(block).toMatch(/if \(isParamsVisible\) \{[\s\S]*await renderDynamicParamsPage\(\);[\s\S]*\}/);
    expect(block).not.toMatch(/currentEditingFile\.textContent = .*\*/);
  });

  it('keeps leave-page dirty handling on the shared confirm-save or discard path in canNavigateAwayFromParams', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function canNavigateAwayFromParams('),
      source.lastIndexOf('function bindParamEditors(')
    );

    expect(block).toMatch(/if \(!paramsPage \|\| paramsPage\.classList\.contains\('hidden'\) \|\| nextPage === 'params' \|\| !store\?\.dirty\) \{/);
    expect(block).toMatch(/const confirmedSave = await MKPModal\.confirm\(/);
    expect(block).toMatch(/if \(!confirmedSave\) \{[\s\S]*discardActiveParamChanges\(\);[\s\S]*return true;[\s\S]*\}/);
    expect(block).toMatch(/return await saveAllDynamicParams\(\{ skipConfirm: true \}\);/);
  });

  it('keeps keyboard save on the same skipConfirm save path used by leave-page handling', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function bindParamEditors()'),
      source.lastIndexOf('window.renderDynamicParamsPage = renderDynamicParamsPage;')
    );

    expect(block).toMatch(/const isSave = \(event\.ctrlKey \|\| event\.metaKey\) && !event\.shiftKey && event\.key\.toLowerCase\(\) === 's';/);
    expect(block).toMatch(/if \(!isParamsVisible \|\| modalVisible\) return;/);
    expect(block).toMatch(/if \(isSave\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*saveAllDynamicParams\(\{ skipConfirm: true \}\);[\s\S]*return;[\s\S]*\}/);
  });

  it('keeps undo redo behind the same visible-page and modal gate before stepping param history', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function bindParamEditors()'),
      source.lastIndexOf('window.renderDynamicParamsPage = renderDynamicParamsPage;')
    );

    expect(block).toMatch(/const isUndo = \(event\.ctrlKey \|\| event\.metaKey\) && !event\.shiftKey && event\.key\.toLowerCase\(\) === 'z';/);
    expect(block).toMatch(/const isRedo = \(event\.ctrlKey \|\| event\.metaKey\) && \(event\.key\.toLowerCase\(\) === 'y' \|\| \(event\.shiftKey && event\.key\.toLowerCase\(\) === 'z'\)\);/);
    expect(block).toMatch(/if \(!isParamsVisible \|\| modalVisible\) return;/);
    expect(block).toMatch(/if \(!isUndo && !isRedo\) return;/);
    expect(block).toMatch(/event\.preventDefault\(\);[\s\S]*void stepParamHistory\(isUndo \? -1 : 1, \{ restoreFocus: false \}\);/);
  });

  it('keeps escape context-menu dismissal outside the visible-page and modal shortcut gate', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function bindParamEditors()'),
      source.lastIndexOf('window.renderDynamicParamsPage = renderDynamicParamsPage;')
    );

    expect(block).toMatch(/if \(event\.key === 'Escape'\) hideContextMenus\(\);/);
    expect(block).toMatch(/if \(event\.key === 'Escape'\) hideContextMenus\(\);[\s\S]*if \(!isParamsVisible \|\| modalVisible\) return;/);
  });

  it('does not allow hidden-page or modal-gated keyboard branch to fall through into save or history side effects', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function bindParamEditors()'),
      source.lastIndexOf('window.renderDynamicParamsPage = renderDynamicParamsPage;')
    );

    expect(block).toMatch(/if \(!isParamsVisible \|\| modalVisible\) return;[\s\S]*if \(isSave\) \{/);
    expect(block).toMatch(/if \(!isParamsVisible \|\| modalVisible\) return;[\s\S]*if \(!isUndo && !isRedo\) return;/);
  });

  it('keeps the params page denser while styling the new bottom disclosures in the existing card language', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.params-shell \{\s*display: flex;\s*flex-direction: column;\s*gap: 16px;\s*\}/);
    expect(styleSource).toMatch(/\.param-row \{[\s\S]*padding: 12px 14px;[\s\S]*margin: 6px;/);
    expect(styleSource).toMatch(/\.params-disclosure \{/);
    expect(styleSource).toMatch(/\.params-disclosure-summary \{/);
    expect(styleSource).toMatch(/\.params-diagnostics-code \{/);
  });
});
