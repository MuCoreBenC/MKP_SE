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
    expect(block).toMatch(/if\s*\(modernPath\)\s*\{[\s\S]*ACTIVE_PRESET_LOG_STATE\.storageKey = null;[\s\S]*ACTIVE_PRESET_LOG_STATE\.fileName = null;[\s\S]*ACTIVE_PRESET_LOG_STATE\.path = modernPath;[\s\S]*return modernPath;\s*\}/);
    expect(block).toMatch(/const storageKey = `mkp_current_script_\$\{currentKey\}`;/);
    expect(block).toMatch(/localStorage\.getItem\(storageKey\)/);
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
    expect(block).toMatch(/msg: `[\s\S]*\$\{escapeParamHtml\(fileName\)\}[\s\S]*`/);
  });

  it('removes the legacy params save entry so runtime behavior only has one real save path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    expect(source).not.toContain('async function legacySaveAllDynamicParams(');
  });

  it('renders the params save button as an idle disabled control until the active store becomes dirty', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toMatch(/<button id="saveParamsBtn"[^>]*class="[^"]*params-save-button[^"]*params-save-idle[^"]*"[^>]*disabled[^>]*aria-disabled="true"/);
    expect(html).toMatch(/<span class="params-save-label">[\s\S]*<\/span>[\s\S]*<span class="params-save-indicator" aria-hidden="true"><\/span>/);
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
    expect(block).toMatch(/replaceActiveParamStoreWithPersistedState\(\s*presetPath,\s*flattenObject\(defaultData\),\s*\{ applyDom: isParamsVisible \}\s*\)/);
    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)/);
    expect(block).toMatch(/window\.broadcastPresetMutation\(\{ reason: 'params-restore-defaults', path: presetPath \}\)/);
    expect(block).toMatch(/window\.updatePresetCacheSnapshot\(presetPath, defaultData\)|window\.presetCache = \{[\s\S]*path: presetPath,/);
    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)[\s\S]*await renderDynamicParamsPage\(\);/);
    expect(block).toMatch(/msg: `[\s\S]*\$\{sourceLabel\}[\s\S]*\$\{restoredFileName\}[\s\S]*`/);
  });

  it('re-renders params page after restore-defaults only after broadcasting the shared preset mutation signals', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/window\.emitActivePresetUpdated\(\{ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false \}\)[\s\S]*window\.broadcastPresetMutation\(\{ reason: 'params-restore-defaults', path: presetPath \}\)[\s\S]*await renderDynamicParamsPage\(\);/);
  });

  it('rebuilds the active params store from the persisted preset state during restore-defaults so the save button can return to idle immediately', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const helperBlock = source.slice(
      source.lastIndexOf('function replaceActiveParamStoreWithPersistedState('),
      source.lastIndexOf('function escapeParamHtml(')
    );
    const restoreBlock = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(helperBlock).toMatch(/const persistedFlatState = buildRenderableParamState\(normalizeFlatState\(flatState\)\)\.flat;/);
    expect(helperBlock).toMatch(/store\.history = \[nextSnapshot\];/);
    expect(helperBlock).toMatch(/markParamStoreSnapshotSaved\(store, nextSnapshot\);/);
    expect(helperBlock).toMatch(/updateParamDirtyState\(store\);/);
    expect(restoreBlock).not.toMatch(/pushParamSnapshotToHistory\(restoredSnapshot, \{ replaceHistory: true, markSaved: true, skipDirtySync: true \}\)/);
    expect(restoreBlock).toMatch(/clearParamsSaveButtonFeedback\(saveBtn\);[\s\S]*delete saveBtn\.dataset\.isSaving;[\s\S]*updateParamDirtyUI\(restoredStore\);/);
  });

  it('drives save button dirty, idle, and disabled states directly from the shared dirty store and busy flags', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function updateParamDirtyUI('),
      source.lastIndexOf('function collectParamFullStateFromDom(')
    );

    expect(block).toMatch(/const isDirty = !!store\?\.dirty;/);
    expect(block).toMatch(/const isBusy = saveBtn\.dataset\.isSaving === 'true' \|\| saveBtn\.dataset\.isAnimating === 'true';/);
    expect(block).toMatch(/const canSave = isDirty && !isBusy;/);
    expect(block).toMatch(/saveBtn\.classList\.toggle\('params-save-dirty', canSave\);/);
    expect(block).toMatch(/saveBtn\.classList\.toggle\('params-save-ripple', canSave\);/);
    expect(block).toMatch(/saveBtn\.classList\.toggle\('params-save-idle', !isDirty && !isBusy\);/);
    expect(block).toMatch(/saveBtn\.disabled = !canSave;/);
    expect(block).toMatch(/saveBtn\.setAttribute\('aria-disabled', saveBtn\.disabled \? 'true' : 'false'\);/);
  });

  it('resolves the save target path before any overwrite or cache update in saveAllDynamicParams', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/const presetPath = typeof window\.resolveParamsPresetPath === 'function'[\s\S]*const fileName = typeof window\.resolveParamsDisplayFileName === 'function'/);
    expect(block).toMatch(/result = await window\.mkpAPI\.overwritePreset\(presetPath, unflattenObject\(flatUpdates\)\);/);
    expect(block).toMatch(/window\.updatePresetCacheSnapshot\(presetPath, nextPresetData\);|window\.presetCache = \{[\s\S]*path: presetPath,/);
  });

  it('short-circuits save when nothing is dirty and re-syncs the button UI before and after save animations', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function saveAllDynamicParams('),
      source.lastIndexOf('async function demoRestoreDefaults()')
    );

    expect(block).toMatch(/const store = getActiveParamStore\(\);[\s\S]*if \(!store\?\.dirty\) \{[\s\S]*updateParamDirtyUI\(store\);[\s\S]*return false;[\s\S]*\}/);
    expect(block).toMatch(/if \(!saveBtn \|\| saveBtn\.disabled \|\| saveBtn\.dataset\.isSaving === 'true'\) return false;/);
    expect(block).toMatch(/saveBtn\.dataset\.isSaving = 'true';[\s\S]*setParamsSaveButtonWorking\(saveBtn\);[\s\S]*updateParamDirtyUI\(store\);/);
    expect(block).toMatch(/clearParamsSaveButtonFeedback\(saveBtn\);[\s\S]*delete saveBtn\.dataset\.isSaving;[\s\S]*updateParamDirtyUI\(store\);/);
    expect(block).toMatch(/flashParamsSaveButtonSuccess\(saveBtn, 1800, \(\) => \{[\s\S]*delete saveBtn\.dataset\.isSaving;[\s\S]*\}\);/);
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

  it('renders one advanced template editor section after the main param groups and nests the experimental tools inside it', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/const diskRenderState = buildRenderableParamState\(diskFlat\);/);
    expect(block).toMatch(/const renderState = buildRenderableParamState\(activeSnapshot\.flat\);/);
    expect(block).toMatch(/const groups = buildParamGroupSections\(renderState\.flat\);/);
    expect(block).toMatch(/const advancedTemplateEditorMarkup = renderAdvancedTemplateEditorSection\(renderState\.flat, presetPath, fileName\);/);
    expect(block).toMatch(/\$\{advancedSectionMarkup\}[\s\S]*\$\{advancedTemplateEditorMarkup\}/);
  });

  it('coerces advanced template fields through keyed editor helpers so line-array templates round-trip to JSON', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const collectBlock = source.slice(
      source.lastIndexOf('function getParamFullStateBaseline('),
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

  it('preserves hidden internal param fields when collecting DOM state so initial render does not become dirty by omission', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const collectBlock = source.slice(
      source.lastIndexOf('function getParamFullStateBaseline('),
      source.lastIndexOf('function updateParamDirtyState(')
    );

    expect(collectBlock).toMatch(/function getParamFullStateBaseline\(store = getActiveParamStore\(\)\) \{/);
    expect(collectBlock).toMatch(/if \(store\?\.history\?\.\[store\.index\]\?\.flat\) \{/);
    expect(collectBlock).toMatch(/if \(store\?\.savedFullSerialized\) \{/);
    expect(collectBlock).toMatch(/function collectParamFullStateFromDom\(store = getActiveParamStore\(\)\) \{/);
    expect(collectBlock).toMatch(/const flatUpdates = \{ \.\.\.getParamFullStateBaseline\(store\) \};/);
  });

  it('applies checkbox snapshot values and switch labels when replaying params snapshots back into the DOM', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const applyBlock = source.slice(
      source.lastIndexOf('function applyParamSnapshotToDom('),
      source.lastIndexOf('function applyFullParamStateToDom(')
    );

    expect(applyBlock).toMatch(/if \(input\.type === 'checkbox'\) \{[\s\S]*input\.checked = Boolean\(value\);[\s\S]*return;[\s\S]*\}/);
    expect(applyBlock).toMatch(/document\.querySelectorAll\('\.param-row-toggle'\)\.forEach\(\(row\) => \{/);
    expect(applyBlock).toMatch(/status\.textContent = checkbox\.checked \? '已开启' : '已关闭';/);
  });

  it('defines shared compact disclosure helpers and template defaults for the advanced editor section', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const PARAM_TEMPLATE_FIELD_ORDER = \[/);
    expect(source).toMatch(/function buildRenderableParamState\(flatData = \{\}\) \{/);
    expect(source).toMatch(/function renderCompactParamToolDisclosure\(section, options = \{\}\) \{/);
    expect(source).toMatch(/function renderAdvancedTemplateEditorSection\(flatData, presetPath, fileName\) \{/);
    expect(source).toMatch(/<details class="params-disclosure params-disclosure-subtle params-tool-disclosure" data-disclosure-id="/);
  });

  it('keeps tower-only compatibility fields internal and does not expose a public lollipop selector', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const PARAM_HIDDEN_PUBLIC_FIELDS = new Set\(\[/);
    expect(source).toMatch(/'wiping\.have_wiping_components'/);
    expect(source).toMatch(/'wiping\.switch_tower_type'/);
    expect(source).toMatch(/if \(PARAM_HIDDEN_PUBLIC_FIELDS\.has\(key\)\) return;/);
    expect(source).not.toMatch(/'wiping\.switch_tower_type': \{/);
    expect(source).not.toMatch(/'wiping\.have_wiping_components': \{/);
  });

  it('defines a bottom wipe-tower position editor disclosure and binds its drag helpers after params render', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/function buildTowerPositionDisclosure\(flatData\) \{/);
    expect(source).toMatch(/data-tower-editor/);
    expect(source).toMatch(/data-tower-canvas/);
    expect(source).toMatch(/data-tower-handle/);
    expect(source).toMatch(/function initTowerPositionEditors\(\) \{/);
    expect(source).toMatch(/initTowerPositionEditors\(\);/);
  });

  it('stores safe wipe-tower drag bounds in the renderer so visual dragging matches engine-side tower footprint clamping', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/function getTowerEditorSafeRange\(editor\) \{/);
    expect(source).toMatch(/data-tower-min-x/);
    expect(source).toMatch(/data-tower-max-x/);
    expect(source).toMatch(/data-tower-min-y/);
    expect(source).toMatch(/data-tower-max-y/);
    expect(source).toMatch(/const placement = resolveTowerEditorPlacement\(editor, editor\.dataset\.towerX, editor\.dataset\.towerY\);/);
    expect(source).toMatch(/const previewFootprint = getTowerPreviewFootprintFromEditor\(editor\);/);
    expect(source).toMatch(/const centerOffsetX = getTowerPreviewCenterOffset\(previewFootprint, 'x'\);/);
    expect(source).toMatch(/const centerOffsetY = getTowerPreviewCenterOffset\(previewFootprint, 'y'\);/);
    expect(source).toMatch(/const percentLeft = \(\(clientX - rect\.left\) \/ rect\.width\) \* 100;/);
    expect(source).toMatch(/const percentTop = \(\(clientY - rect\.top\) \/ rect\.height\) \* 100;/);
    expect(source).toMatch(/const normalizedLeft = denormalizeTowerCanvasAxisPercent\(percentLeft\);/);
    expect(source).toMatch(/const normalizedTop = denormalizeTowerCanvasAxisPercent\(percentTop\);/);
    expect(source).toMatch(/const nextCenterX = bedMinX \+ \(normalizedLeft \* bedWidth\);/);
    expect(source).toMatch(/const nextCenterY = bedMinY \+ \(\(1 - normalizedTop\) \* bedDepth\);/);
    expect(source).toMatch(/const nextX = snapTowerAnchorCoordinate\(nextCenterX - centerOffsetX\);/);
    expect(source).toMatch(/const nextY = snapTowerAnchorCoordinate\(nextCenterY - centerOffsetY\);/);
  });

  it('derives tower bounds from printer-aware profiles and reuses them for numeric input clamps', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const TOWER_EDITOR_PRINTER_PROFILES = \{/);
    expect(source).toMatch(/a1mini: \{ bounds: \{ minX: 0, maxX: 180, minY: 0, maxY: 180 \} \}/);
    expect(source).toMatch(/function resolveTowerEditorBounds\(flatData = \{\}\) \{/);
    expect(source).toMatch(/function buildParamNumericConstraints\(flatData = \{\}\) \{/);
    expect(source).toMatch(/activeParamNumericConstraints = buildParamNumericConstraints\(renderState\.flat\);/);
    expect(source).toMatch(/min="\$\{escapeParamHtml\(numericConstraint\.min\)\}" max="\$\{escapeParamHtml\(numericConstraint\.max\)\}"/);
    expect(source).toMatch(/function normalizeNumericInputElement\(input\) \{/);
  });

  it('adds P1/X1 dead-zone tower profiles and renders them on the bed preview', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const BAMBU_X1_P1_FRONT_DEAD_ZONES = Object\.freeze\(\[/);
    expect(source).toMatch(/id: 'mkp-safety'/);
    expect(source).toMatch(/id: 'official-front-strip'/);
    expect(source).toMatch(/id: 'official-front-hook'/);
    expect(source).toMatch(/data-tower-dead-zones="/);
    expect(source).toMatch(/<div class="tower-position-canvas" data-tower-canvas>/);
    expect(source).toMatch(/const visualDeadZones = \[\.\.\.metrics\.deadZones\]\.sort\(\(left, right\) => getTowerDeadZoneRenderPriority\(left\) - getTowerDeadZoneRenderPriority\(right\)\);/);
    expect(source).toMatch(/tower-dead-zone tower-dead-zone--\$\{escapeParamHtml\(zone\.kind \|\| 'safety'\)\}/);
    expect(source).toMatch(/tower-position-legend/);
  });

  it('normalizes P1/X1 tower coordinates through dead-zone aware placement helpers before drag and numeric commits', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/function resolveTowerPlacement\(rawX, rawY, flatData = \{\}\) \{/);
    expect(source).toMatch(/function resolveTowerEditorPlacement\(editor, nextX, nextY\) \{/);
    expect(source).toMatch(/const placement = resolveTowerEditorPlacement\(editor, nextX, nextY\);/);
    expect(source).toMatch(/const normalizedTower = normalizeTowerInputValue\(input, towerNumeric \?\? numeric\);/);
    expect(source).toMatch(/if \(normalizedTower\) \{/);
  });

  it('maps the tower preview directly to the bottom-left bed origin without a hidden inset that distorts edge spacing', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const TOWER_CANVAS_EDGE_INSET_PERCENT = 0;/);
    expect(source).not.toMatch(/const TOWER_CANVAS_EDGE_INSET_PERCENT = 5;/);
    expect(source).toMatch(/function normalizeTowerCanvasAxisPercent\(normalized\) \{/);
    expect(source).toMatch(/function denormalizeTowerCanvasAxisPercent\(percent\) \{/);
    expect(source).toMatch(/function getTowerCanvasTopPercent\(y, metrics\) \{/);
    expect(source).toMatch(/return normalizeTowerCanvasAxisPercent\(1 - \(\(y - metrics\.bedMinY\) \/ metrics\.bedDepth\)\);/);
    expect(source).toMatch(/const top = getTowerCanvasTopPercent\(placement\.y, metrics\);/);
    expect(source).toMatch(/const percentLeft = \(\(clientX - rect\.left\) \/ rect\.width\) \* 100;/);
    expect(source).toMatch(/const percentTop = \(\(clientY - rect\.top\) \/ rect\.height\) \* 100;/);
    expect(source).toMatch(/const normalizedLeft = denormalizeTowerCanvasAxisPercent\(percentLeft\);/);
    expect(source).toMatch(/const normalizedTop = denormalizeTowerCanvasAxisPercent\(percentTop\);/);
    expect(source).toMatch(/const nextCenterY = bedMinY \+ \(\(1 - normalizedTop\) \* bedDepth\);/);
    expect(source).toMatch(/const nextY = snapTowerAnchorCoordinate\(nextCenterY - centerOffsetY\);/);
  });

  it('renders footprint-based tower occupancy so edge placement reflects the actual tower size instead of only the anchor point', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/const previewFootprint = resolveTowerPreviewFootprint\(flatData\);/);
    expect(source).toMatch(/const footprintBounds = buildTowerPreviewVisualBounds\(/);
    expect(source).toMatch(/const footprintStyle = getTowerCanvasRectPercent\(footprintBounds, metrics\);/);
    expect(source).not.toMatch(/const safeAreaBounds = buildTowerPreviewBounds\(/);
    expect(source).toMatch(/const TOWER_EDITOR_VISUAL_SCALE = 1;/);
    expect(source).toMatch(/const TOWER_EDITOR_VISUAL_MIN_SIZE = 20;/);
    expect(source).toMatch(/displayWidth: roundTowerEditorCoordinate\(displayWidth\),/);
    expect(source).toMatch(/minXOffset: roundTowerEditorCoordinate\(0\),/);
    expect(source).toMatch(/maxXOffset: roundTowerEditorCoordinate\(width\),/);
    expect(source).toMatch(/minYOffset: roundTowerEditorCoordinate\(0\),/);
    expect(source).toMatch(/maxYOffset: roundTowerEditorCoordinate\(depth\),/);
    expect(source).not.toMatch(/anchorCenterOffsetX/);
    expect(source).toMatch(/displayMinXOffset:/);
    expect(source).toMatch(/function shiftTowerPreviewAxisIntoBounds\(min, max, boundsMin, boundsMax\) \{/);
    expect(source).toMatch(/function buildTowerPreviewVisualBounds\(minX, maxX, minY, maxY, metrics = null\) \{/);
    expect(source).toMatch(/const shiftedX = shiftTowerPreviewAxisIntoBounds\(rawBounds\.minX, rawBounds\.maxX, metrics\.bedMinX, metrics\.bedMaxX\);/);
    expect(source).toMatch(/const footprintBounds = buildTowerPreviewVisualBounds\(/);
    expect(source).toMatch(/clampedWiperX \+ previewFootprint\.displayMaxXOffset/);
    expect(source).toMatch(/clampedWiperY \+ previewFootprint\.displayMaxYOffset,\s*metrics/);
    expect(source).toMatch(/class="tower-footprint"/);
    expect(source).toMatch(/data-tower-footprint/);
    expect(source).toMatch(/data-tower-footprint-geometry="/);
    expect(source).toMatch(/data-tower-handle/);
    expect(source).toMatch(/data-tooltip-anchor-align="center"/);
    expect(source).toMatch(/<span class="tower-footprint-label">塔<\/span>/);
    expect(source).not.toMatch(/class="tower-position-handle"/);
  });

  it('snaps tower placement editing to integer coordinates while still allowing geometry-driven footprint growth', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/function snapTowerAnchorCoordinate\(value, min = Number\.NEGATIVE_INFINITY, max = Number\.POSITIVE_INFINITY\) \{/);
    expect(source).toMatch(/Math\.round\(numeric\)/);
    expect(source).toMatch(/step="\$\{numericConstraint\?\.integer \? '1' : 'any'\}"/);
    expect(source).toMatch(/'wiping\.tower_brim_width'/);
    expect(source).toMatch(/'wiping\.tower_slanted_outer_wall_width'/);
  });

  it('lets the tower toolbar X and Y fields sanitize to integers, show inline range feedback, and reuse the floating tooltip while dragging', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/data-tower-coordinate-input="x"/);
    expect(source).toMatch(/data-tower-coordinate-input="y"/);
    expect(source).toMatch(/data-tower-feedback/);
    expect(source).toMatch(/function sanitizeTowerCoordinateInputValue\(value\) \{/);
    expect(source).toMatch(/const towerNumeric = sanitizeTowerCoordinateInputValue\(rawValue\);/);
    expect(source).toMatch(/function showTowerDragTooltip\(editor, placement\) \{/);
    expect(source).toMatch(/window\.showFloatingTooltip\?\.\(footprint\);/);
    expect(source).toMatch(/function hideTowerDragTooltip\(editor, options = \{\}\) \{/);
    expect(source).toMatch(/window\.hideFloatingTooltip\?\.\(options\);/);
    expect(source).toMatch(/function applyTowerCoordinateInput\(editor, axis, rawValue\) \{/);
    expect(source).toMatch(/input\.dataset\.towerCoordinateInput === 'y' \? editor\.dataset\.towerY : editor\.dataset\.towerX/);
  });

  it('describes tower X and Y as the visible lower-left corner so preview math matches the user-facing coordinates', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).toMatch(/'wiping\.wiper_x': \{ label: '擦料塔左下角 X'/);
    expect(source).toMatch(/'wiping\.wiper_y': \{ label: '擦料塔左下角 Y'/);
    expect(source).toMatch(/擦料塔左下角的 X 坐标/);
    expect(source).toMatch(/擦料塔左下角的 Y 坐标/);
  });

  it('keeps restore-defaults on the shared saved-state path before re-rendering the params page', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const restoredState = replaceActiveParamStoreWithPersistedState\(\s*presetPath,\s*flattenObject\(defaultData\),\s*\{ applyDom: isParamsVisible \}\s*\);/);
    expect(block).toMatch(/const restoredStore = restoredState\.store;/);
    expect(block).not.toMatch(/pushParamSnapshotToHistory\(restoredSnapshot, \{ replaceHistory: true, markSaved: true, skipDirtySync: true \}\);/);
    expect(block).toMatch(/replaceActiveParamStoreWithPersistedState\([\s\S]*if \(isParamsVisible\) \{[\s\S]*await renderDynamicParamsPage\(\);/);
  });

  it('treats restore-defaults as a new persisted baseline by resetting local param history and clearing the dirty UI before any visible rerender', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const historyBlock = source.slice(
      source.lastIndexOf('function replaceActiveParamStoreWithPersistedState('),
      source.lastIndexOf('function escapeParamHtml(')
    );
    const restoreBlock = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(historyBlock).toMatch(/store\.history = \[nextSnapshot\];[\s\S]*store\.index = 0;/);
    expect(historyBlock).toMatch(/markParamStoreSnapshotSaved\(store, nextSnapshot\);[\s\S]*updateParamDirtyState\(store\);/);
    expect(restoreBlock).toMatch(/const restoredStore = restoredState\.store;/);
    expect(restoreBlock).toMatch(/clearParamsSaveButtonFeedback\(saveBtn\);[\s\S]*delete saveBtn\.dataset\.isSaving;[\s\S]*updateParamDirtyUI\(restoredStore\);/);
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
    expect(block).toMatch(/replaceActiveParamStoreWithPersistedState\(\s*presetPath,\s*flattenObject\(defaultData\),\s*\{ applyDom: isParamsVisible \}\s*\)/);
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
    expect(block).toMatch(/await MKPModal\.alert\(\{ title: '[^']+', msg: `[\s\S]*\$\{sourceLabel\}[\s\S]*\$\{restoredFileName\}[\s\S]*`, type: 'success' \}\);/);
  });

  it('keeps restore-defaults dirty-label cleanup on the shared saved snapshot and visible-page rerender path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function demoRestoreDefaults()'),
      source.lastIndexOf('function ensureParamContextMenu()')
    );

    expect(block).toMatch(/const restoredState = replaceActiveParamStoreWithPersistedState\(\s*presetPath,\s*flattenObject\(defaultData\),\s*\{ applyDom: isParamsVisible \}\s*\);/);
    expect(block).toMatch(/clearParamsSaveButtonFeedback\(saveBtn\);[\s\S]*delete saveBtn\.dataset\.isSaving;[\s\S]*updateParamDirtyUI\(restoredStore\);/);
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

  it('styles the params save button with a flat soft-blue disabled state and a larger outline ripple for dirty changes', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.params-save-button \{/);
    expect(styleSource).toMatch(/--params-save-radius: 0\.75rem;/);
    expect(styleSource).toMatch(/button\.params-save-button\.params-save-idle,\s*button\.params-save-button\.params-save-idle:disabled \{/);
    expect(styleSource).toMatch(/background: rgba\(var\(--primary-rgb\), 0\.12\) !important;/);
    expect(styleSource).toMatch(/\.params-save-button\.params-save-ripple::before \{/);
    expect(styleSource).toMatch(/\.params-save-button\.params-save-ripple \.params-save-indicator \{/);
    expect(styleSource).toMatch(/\.params-save-button\.params-save-ripple::after \{/);
    expect(styleSource).toMatch(/border-radius: inherit;/);
    expect(styleSource).toMatch(/@keyframes params-save-outline-wave \{/);
    expect(styleSource).toMatch(/@keyframes params-save-outline-spread \{/);
  });

  it('keeps the tower preview canvas small enough for the default app window while clipping any residual spill outside the bed panel', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.tower-position-canvas \{[\s\S]*width: min\(100%, clamp\(300px, 56vh, 520px\)\);/);
    expect(styleSource).toMatch(/\.tower-position-canvas \{[\s\S]*overflow: hidden;/);
    expect(styleSource).toMatch(/\.tower-position-canvas \{[\s\S]*margin: 0 auto;/);
    expect(styleSource).toMatch(/\.tower-position-canvas \{[\s\S]*border: 1\.5px dashed rgba\(34, 197, 94, 0\.72\);/);
    expect(styleSource).toMatch(/\.tower-position-canvas \{[\s\S]*box-shadow: none;/);
  });

  it('centers the tower preview block label while keeping the tower body itself visually prominent', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.tower-footprint \{[\s\S]*display: grid;[\s\S]*place-items: center;[\s\S]*border-radius: 12px;[\s\S]*border: 2\.5px solid rgba\(59, 130, 246, 0\.92\);/);
    expect(styleSource).toMatch(/\.tower-footprint-label \{[\s\S]*padding: 0;[\s\S]*background: transparent;[\s\S]*font-size: 14px;[\s\S]*text-align: center;[\s\S]*pointer-events: none;/);
    expect(styleSource).not.toMatch(/\.tower-position-handle \{/);
  });

  it('styles the tower coordinate toolbar as editable integer chips with inline warning feedback and floating drag tooltip text', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.app-floating-tooltip \{[\s\S]*width: fit-content;[\s\S]*max-width: min\(240px, calc\(100vw - 24px\)\);/);
    expect(styleSource).toMatch(/\.tower-position-coordinate \{/);
    expect(styleSource).toMatch(/\.tower-position-coordinate:focus-within \{/);
    expect(styleSource).toMatch(/\.tower-position-coordinate-input \{/);
    expect(styleSource).toMatch(/\.tower-position-coordinate-input\.is-invalid \{/);
    expect(styleSource).toMatch(/\.tower-position-feedback \{/);
    expect(styleSource).toMatch(/\.tower-position-feedback\.is-visible \{/);
    expect(styleSource).toMatch(/\.tower-drag-tooltip \{[\s\S]*justify-items: center;[\s\S]*text-align: center;/);
    expect(styleSource).toMatch(/\.tower-drag-tooltip-title \{/);
    expect(styleSource).toMatch(/\.tower-drag-tooltip-value \{[\s\S]*text-align: center;[\s\S]*white-space: nowrap;/);
  });

  it('rebuilds the params page into at most six settings-style sections with a sticky category nav tied to the params scroll container', () => {
    const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(htmlSource).toMatch(/id="paramsPageContent"/);
    expect(htmlSource).toMatch(/id="paramsSectionNav"/);
    expect(source).toMatch(/const PARAM_SECTION_ORDER = \['meta', 'toolhead', 'wiping', 'mount', 'unmount', 'advanced'\];/);
    expect(source).toMatch(/function buildParamsSectionNavMarkup\(groups = \{\}\) \{/);
    expect(source).toMatch(/const sectionKeys = PARAM_SECTION_ORDER[\s\S]*\.filter\(\(groupKey\) => Array\.isArray\(groups\[groupKey\]\) && groups\[groupKey\]\.length > 0\)[\s\S]*\.slice\(0, 6\);/);
    expect(source).toMatch(/function renderParamsSectionNav\(groups = \{\}\) \{/);
    expect(source).toMatch(/function scrollToParamsSection\(sectionId\) \{/);
    expect(source).toMatch(/const container = document\.getElementById\('paramsPageContent'\);/);
    expect(source).toMatch(/function syncParamsSectionNavState\(\) \{/);
    expect(source).toMatch(/const nav = document\.getElementById\('paramsSectionNav'\);/);
    expect(source).toMatch(/const navItems = nav\?\.querySelectorAll\('\.params-nav-item'\) \|\| \[\];/);
    expect(source).toMatch(/function initParamsSectionNav\(\) \{/);
    expect(source).toMatch(/renderParamsSectionNav\(groups\);[\s\S]*initParamsSectionNav\(\);/);
    expect(source).toMatch(/<section id="params-section-\$\{escapeParamHtml\(groupKey\)\}" class="params-section params-group-preview-section">/);
    expect(styleSource).toMatch(/\.params-section-nav \{/);
    expect(styleSource).toMatch(/\.params-nav-item \{/);
    expect(styleSource).toMatch(/\.params-nav-item\.active \{/);
  });

  it('uses one shared preview-group renderer across the main params sections and a single advanced editor section below them', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(source).toMatch(/function renderPreviewParamGroup\(groupKey, cards, options = \{\}\) \{/);
    expect(source).toMatch(/<section id="params-section-\$\{escapeParamHtml\(groupKey\)\}" class="params-section params-group-preview-section">/);
    expect(source).toMatch(/<div class="params-group-preview-head">/);
    expect(source).toMatch(/<div class="params-settings-panel">/);
    expect(source).toMatch(/const metaSectionMarkup = renderPreviewParamGroup\('meta', groups\.meta\);/);
    expect(source).toMatch(/const toolheadSectionMarkup = renderPreviewParamGroup\('toolhead', groups\.toolhead\);/);
    expect(source).toMatch(/const wipingSectionMarkup = renderPreviewParamGroup\('wiping', groups\.wiping\);/);
    expect(source).toMatch(/const mountSectionMarkup = renderPreviewParamGroup\('mount', groups\.mount\);/);
    expect(source).toMatch(/const unmountSectionMarkup = renderPreviewParamGroup\('unmount', groups\.unmount\);/);
    expect(source).toMatch(/const advancedSectionMarkup = renderPreviewParamGroup\('advanced', groups\.advanced\);/);
    expect(source).toMatch(/const advancedTemplateEditorMarkup = renderAdvancedTemplateEditorSection\(renderState\.flat, presetPath, fileName\);/);
    expect(styleSource).toMatch(/\.params-group-preview-section \{/);
    expect(styleSource).toMatch(/\.params-group-preview-title \{/);
    expect(styleSource).toMatch(/\.params-settings-panel \{/);
    expect(styleSource).toMatch(/\.params-settings-panel > \.param-row \{/);
    expect(styleSource).toMatch(/\.params-group-preview-extra \{/);
  });

  it('moves wipe tower geometry into the unified advanced editor experimental tools and reveals slanted controls only when enabled', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(source).toMatch(/function isTowerGeometryField\(key\) \{/);
    expect(source).toMatch(/'wiping\.tower_width'/);
    expect(source).toMatch(/'wiping\.tower_depth'/);
    expect(source).toMatch(/'wiping\.tower_brim_width'/);
    expect(source).toMatch(/'wiping\.tower_outer_wall_width'/);
    expect(source).toMatch(/'wiping\.tower_outer_wall_depth'/);
    expect(source).toMatch(/'wiping\.tower_slanted_outer_wall_enabled'/);
    expect(source).toMatch(/'wiping\.tower_slanted_outer_wall_width'/);
    expect(source).toMatch(/'wiping\.tower_slanted_outer_wall_depth'/);
    expect(source).toMatch(/function buildPreviewWipeTowerGeometryTool\(flatData = \{\}\) \{/);
    expect(source).toMatch(/data-tower-advanced-toggle="slanted-outer-wall"/);
    expect(source).toMatch(/data-tower-advanced-panel="slanted-outer-wall"/);
    expect(source).toMatch(/function syncTowerAdvancedPanels\(scope = document\) \{/);
    expect(source).toMatch(/syncTowerAdvancedPanels\(container\);/);
    expect(source).toMatch(/const towerGeometryTool = buildPreviewWipeTowerGeometryTool\(flatData\);/);
    expect(source).toMatch(/renderCompactParamToolDisclosure\(towerGeometryTool\)/);
    expect(styleSource).toMatch(/\.params-inline-preview \{/);
    expect(styleSource).toMatch(/\.params-tool-disclosure \{/);
    expect(styleSource).toMatch(/\.params-inline-subpanel \{/);
    expect(styleSource).toMatch(/\.params-inline-subpanel\.hidden \{/);
  });

  it('keeps a dedicated current draft baseline in the params store so restore-defaults can atomically return to clean', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function getCurrentParamStoreSnapshot('),
      source.lastIndexOf('function getParamsSaveButtonLabel(')
    );
    const ensureBlock = source.slice(
      source.lastIndexOf('function ensureParamStore('),
      source.lastIndexOf('function collectParamModesFromDom(')
    );

    expect(block).toMatch(/function getCurrentParamStoreSnapshot\(store = getActiveParamStore\(\)\) \{/);
    expect(block).toMatch(/function replaceCurrentParamStoreSnapshot\(store, snapshot\) \{/);
    expect(block).toMatch(/store\.currentFullSerialized = serializeParamFullState\(nextSnapshot\.flat\);/);
    expect(block).toMatch(/function markParamStoreSnapshotSaved\(store, snapshot = getCurrentParamStoreSnapshot\(store\)\) \{/);
    expect(block).toMatch(/store\.savedFullSerialized = serializeParamFullState\(nextSnapshot\.flat\);/);
    expect(block).toMatch(/store\.currentFullSerialized = store\.savedFullSerialized;/);
    expect(block).toMatch(/function refreshParamStoreDirtyFlag\(store = getActiveParamStore\(\)\) \{/);
    expect(ensureBlock).toMatch(/currentFullSerialized: serializeParamFullState\(flatState\),/);
  });

  it('computes params dirty state from the active store snapshot instead of DOM readback drift', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function updateParamDirtyState('),
      source.lastIndexOf('function hasUnsavedParamChanges(')
    );

    expect(block).toMatch(/refreshParamStoreDirtyFlag\(store\);/);
    expect(block).not.toMatch(/collectParamFullStateFromDom\(\)/);
    expect(block).not.toMatch(/const currentSerialized = canReadDom/);
  });

  it('re-baselines clean params renders to the canonical active snapshot before the final dirty refresh', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renderDynamicParamsPage()'),
      source.lastIndexOf('function coerceParamValue(')
    );

    expect(block).toMatch(/markParamStoreSnapshotSaved\(store, diskSnapshot\);/);
    expect(block).toMatch(/replaceCurrentParamStoreSnapshot\(store, activeSnapshot\);/);
    expect(block).toMatch(/if \(!store\.dirty\) \{[\s\S]*markParamStoreSnapshotSaved\(store, activeSnapshot\);[\s\S]*\}/);
  });

  it('marks saved params from the tracked snapshot flat state instead of re-reading DOM during save completion', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function markActiveParamSnapshotSaved('),
      source.lastIndexOf('function replaceActiveParamStoreWithPersistedState(')
    );

    expect(block).toMatch(/const targetSnapshot = snapshot \|\| getCurrentParamStoreSnapshot\(store\);/);
    expect(block).toMatch(/markParamStoreSnapshotSaved\(store, targetSnapshot\);/);
    expect(block).not.toMatch(/collectParamFullStateFromDom\(store\)/);
  });

  it('removes dead params-page history preview helpers that no longer have any runtime callers', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(source).not.toContain('async function legacySaveAllDynamicParams(');
    expect(source).not.toContain('function applySnapshotModePreview(');
    expect(source).not.toContain('function isFocusVisibleForPreview(');
    expect(source).not.toContain('function restoreParamFocus(');
    expect(source).not.toContain('function stepGcodeHistory(');
    expect(source).not.toContain('function pushParamSnapshotToHistory(');
  });

  it('re-syncs checkbox and gcode-mode interactions through shared snapshot capture before dirty UI updates', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');
    const modeBlock = source.slice(
      source.lastIndexOf('function toggleGcodeMode('),
      source.lastIndexOf('async function renderDynamicParamsPage()')
    );
    const bindBlock = source.slice(
      source.lastIndexOf('function bindParamEditors()'),
      source.lastIndexOf('window.renderDynamicParamsPage = renderDynamicParamsPage;')
    );

    expect(modeBlock).toMatch(/rememberParamSnapshot\(\);[\s\S]*updateParamDirtyState\(\);/);
    expect(bindBlock).toMatch(/if \(checkbox\) \{[\s\S]*rememberParamSnapshot\(\);[\s\S]*updateParamDirtyState\(\);[\s\S]*\}/);
  });
});

