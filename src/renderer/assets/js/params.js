window.presetCache = window.presetCache || { path: null, data: null, timestamp: 0 };

const PARAM_GROUP_META = {
  meta: { title: '预设信息', desc: '识别当前预设的版本、机型和显示名。', icon: 'info' },
  toolhead: { title: '工具头参数', desc: '控制胶笔速度、三轴补偿和工具头动作。', icon: 'toolhead' },
  wiping: { title: '擦料塔策略', desc: '控制擦料塔、工具头收放以及支撑相关策略。', icon: 'wiping' },
  mount: { title: '工具头展开 G-code', desc: '默认展示完整文本，支持切换到逐行精修模式。', icon: 'mount' },
  unmount: { title: '工具头收起 G-code', desc: '默认展示完整文本，支持切换到逐行精修模式。', icon: 'unmount' },
  advanced: { title: '扩展参数', desc: '当前 JSON 中存在但未分类的高级字段。', icon: 'advanced' }
};

const PARAM_SECTION_ORDER = ['meta', 'toolhead', 'wiping', 'mount', 'unmount', 'advanced'];

const PARAM_TEMPLATE_FIELD_ORDER = [
  'templates.wipingGcode',
  'templates.towerBaseLayerGcode'
];

const PARAM_TEMPLATE_DEFAULTS = {
  'templates.wipingGcode': [
    '; MKP wiping tower template',
    'G92 E0',
    'G1 X20 Y20 E0.8',
    'G1 X24 Y20 E0.4',
    'G92 E0'
  ],
  'templates.towerBaseLayerGcode': [
    '; MKP tower base template',
    'G92 E0',
    'G1 X20 Y20 E1.0',
    'G1 X25 Y20 E0.5',
    'G92 E0'
  ]
};

const PARAM_VALUE_DEFAULTS = {
  'wiping.have_wiping_components': true,
  'wiping.switch_tower_type': 1
};

const PARAM_HIDDEN_PUBLIC_FIELDS = new Set([
  'wiping.have_wiping_components',
  'wiping.switch_tower_type',
  'wiping.use_wiping_towers',
  'wiping.useWipingTowers',
  'wiping.enable_wiping_tower',
  'wiping.enableWipingTower'
]);

const TOWER_GEOMETRY_FIELD_KEYS = new Set([
  'wiping.tower_width',
  'wiping.tower_depth',
  'wiping.tower_brim_width',
  'wiping.tower_outer_wall_width',
  'wiping.tower_outer_wall_depth',
  'wiping.tower_slanted_outer_wall_enabled',
  'wiping.tower_slanted_outer_wall_width',
  'wiping.tower_slanted_outer_wall_depth'
]);

const TOWER_EDITOR_DEFAULTS = {
  bedWidth: 256,
  bedDepth: 256,
  safeMinX: 5,
  safeMinY: 5,
  safeMaxXOffset: 28,
  safeMaxYOffset: 28,
  towerWidth: 28,
  towerDepth: 28
};

const TOWER_EDITOR_FOOTPRINT = {
  minXOffset: -5,
  maxXOffset: 28,
  minYOffset: -5,
  maxYOffset: 28
};

const TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS = {
  width: 20,
  depth: 20
};

const TOWER_EDITOR_VISUAL_SCALE = 1;
const TOWER_EDITOR_VISUAL_MIN_SIZE = 20;
const TOWER_CANVAS_EDGE_INSET_PERCENT = 0;

const BAMBU_X1_P1_FRONT_DEAD_ZONES = Object.freeze([
  Object.freeze({ id: 'mkp-safety', label: 'MKP 安全限制', kind: 'safety', minX: 6, maxX: 41, minY: 6, maxY: 52 }),
  Object.freeze({ id: 'official-front-strip', label: '官方前沿排料线', kind: 'official', minX: 18, maxX: 240, minY: 6, maxY: 12 }),
  Object.freeze({ id: 'official-front-hook', label: '官方前沿 L 回折', kind: 'official', minX: 231, maxX: 240, minY: 6, maxY: 18 })
]);

const TOWER_DEAD_ZONE_CLEARANCE = 1;

const BAMBU_X1_P1_TOWER_PROFILE = {
  bounds: { minX: 0, maxX: 256, minY: 0, maxY: 256 },
  manualSafeRange: { minX: 6, maxX: 250, minY: 6, maxY: 250 },
  boardStyle: 'bambu-x1',
  deadZones: [
    { id: 'mkp-safety', label: 'MKP 安全限制', kind: 'safety', minX: 6, maxX: 41, minY: 6, maxY: 52 },
    { id: 'official-left-l', label: '官方 L 形左侧禁区', kind: 'official', minX: 6, maxX: 18, minY: 6, maxY: 250 },
    { id: 'official-bottom-l', label: '官方 L 形底边禁区', kind: 'official', minX: 6, maxX: 28, minY: 6, maxY: 28 }
  ]
};

const TOWER_EDITOR_PRINTER_PROFILES = {
  a1: { bounds: { minX: 0, maxX: 256, minY: 0, maxY: 256 } },
  a1mini: { bounds: { minX: 0, maxX: 180, minY: 0, maxY: 180 } },
  p1: BAMBU_X1_P1_TOWER_PROFILE,
  p1s: BAMBU_X1_P1_TOWER_PROFILE,
  x1: BAMBU_X1_P1_TOWER_PROFILE,
  s1c: { bounds: { minX: 0, maxX: 256, minY: 0, maxY: 256 } }
};

let activeParamNumericConstraints = {};

const PARAM_FIELD_META = {
  version: { label: '预设版本', desc: '当前预设的真实版本号，下载页“最新”也会依赖它。', group: 'meta' },
  printer: { label: '适用机型', desc: '当前预设绑定的机型标识。', group: 'meta' },
  type: { label: '版本类型', desc: '标准版、快拆版或 Lite 版等预设分支。', group: 'meta' },
  _custom_name: { label: '显示名称', desc: '本地列表里看到的自定义名称，不影响底层参数逻辑。', group: 'meta' },
  _comment: { label: '发布时间备注', desc: '预设文件里的额外说明，通常记录发布时间或维护备注。', group: 'meta', multiline: true },
  'toolhead.speed_limit': { label: '涂胶速度限制', desc: '限制工具头相关动作的速度上限，过高可能导致动作不稳定。', unit: 'mm/s', group: 'toolhead' },
  'toolhead.offset.x': { label: 'X 轴补偿', desc: '笔尖相对喷嘴的 X 偏移，影响左右方向对位。', unit: 'mm', group: 'toolhead' },
  'toolhead.offset.y': { label: 'Y 轴补偿', desc: '笔尖相对喷嘴的 Y 偏移，影响前后方向对位。', unit: 'mm', group: 'toolhead' },
  'toolhead.offset.z': { label: 'Z 轴高度差', desc: '笔尖高度差，直接影响涂胶高度和碰撞风险。', unit: 'mm', group: 'toolhead' },
  'toolhead.custom_mount_gcode': { label: '展开动作文本', desc: '控制工具头弹出、锁定或准备动作。', type: 'gcode', group: 'mount' },
  'toolhead.custom_unmount_gcode': { label: '收起动作文本', desc: '控制工具头收回、擦料收尾和退出动作。', type: 'gcode', group: 'unmount' },
  ['wiping.have_wiping_components']: { label: '使用擦料塔', desc: '开启后改为打印擦料塔；关闭时按旧字段兼容路径处理。字段名虽然叫 components，但当前逻辑实际控制的是擦料塔方案。', type: 'boolean', group: 'wiping' },
  ['wiping.switch_tower_type']: {
    label: '擦料塔模式',
    desc: '对应 Python 的 Switch_Tower_Type。默认使用擦料塔慢线；切到棒棒糖时改为快线恢复模式。',
    type: 'select',
    group: 'wiping',
    options: [
      { value: 1, label: '擦料塔（慢线，默认）' },
      { value: 2, label: '棒棒糖（快线）' }
    ]
  },
  'wiping.wiper_x': { label: '擦料塔左下角 X', desc: '擦料塔左下角的 X 坐标，需要避开模型区域。', unit: 'mm', group: 'wiping' },
  'wiping.wiper_y': { label: '擦料塔左下角 Y', desc: '擦料塔左下角的 Y 坐标，需要避开模型区域。', unit: 'mm', group: 'wiping' },
  'wiping.wipetower_speed': { label: '擦料塔速度', desc: '擦料塔打印速度，过快可能影响稳定性。', unit: 'mm/s', group: 'wiping' },
  'wiping.nozzle_cooling_flag': { label: '涂胶时降温', desc: '控制涂胶期间是否额外执行喷嘴降温逻辑。', type: 'boolean', group: 'wiping' },
  'wiping.iron_apply_flag': { label: '缩小涂胶区域', desc: '原版注释为最小化涂胶区域，通常用于配合熨烫表面优化支撑面表现。', type: 'boolean', group: 'wiping' },
  'wiping.user_dry_time': { label: '额外干燥时间', desc: '在流程里增加等待干燥时间，单位为秒。', unit: '秒', group: 'wiping' },
  'wiping.force_thick_bridge_flag': { label: '强制厚桥', desc: '原版注释为 Force Thick Bridge，常用于桥接厚度相关兼容策略。', type: 'boolean', group: 'wiping' },
  'wiping.support_extrusion_multiplier': { label: '支撑挤出倍率', desc: '调整支撑相关挤出倍率，影响支撑密度和表面表现。', group: 'wiping' },
  'wiping.tower_width': { label: '擦料塔宽度', desc: '控制擦料塔主体的 X 向宽度。默认保持旧版 Python 的 20mm。', unit: 'mm', group: 'wiping' },
  'wiping.tower_depth': { label: '擦料塔深度', desc: '控制擦料塔主体的 Y 向深度。默认保持旧版 Python 的 20mm。', unit: 'mm', group: 'wiping' },
  'wiping.tower_brim_width': { label: '首层 Brim 扩展', desc: '只扩大首层底座占地，用于增加附着。不会改变后续层主体宽度。', unit: 'mm', group: 'wiping' },
  'wiping.tower_outer_wall_width': { label: '外墙扩展宽度', desc: '对所有层的擦料塔轮廓做 X 向额外扩展。', unit: 'mm', group: 'wiping' },
  'wiping.tower_outer_wall_depth': { label: '外墙扩展深度', desc: '对所有层的擦料塔轮廓做 Y 向额外扩展。', unit: 'mm', group: 'wiping' },
  'wiping.tower_slanted_outer_wall_enabled': { label: '启用斜肋外墙', desc: '开启后再展开下面的斜肋外墙参数，预览占地、坐标限制和 CLI 生成会一起生效。', type: 'boolean', group: 'wiping' },
  'wiping.tower_slanted_outer_wall_width': { label: '斜肋外墙宽度', desc: '在外墙基础上继续增加 X 向的斜肋外扩。关闭开关时不会参与生成。', unit: 'mm', group: 'wiping' },
  'wiping.tower_slanted_outer_wall_depth': { label: '斜肋外墙深度', desc: '在外墙基础上继续增加 Y 向的斜肋外扩。关闭开关时不会参与生成。', unit: 'mm', group: 'wiping' },
  'templates.wipingGcode': {
    label: '擦料塔路径模板',
    desc: '底层 JS engine 使用的 templates.wipingGcode。通常无需修改，只有想覆盖默认擦料塔路径时再展开编辑。',
    type: 'gcode',
    group: 'advancedTemplates',
    valueShape: 'stringArray'
  },
  'templates.towerBaseLayerGcode': {
    label: '擦料塔首层模板',
    desc: '底层 JS engine 使用的 templates.towerBaseLayerGcode。用于生成擦料塔首层路径，修改后会随当前 preset 保存。',
    type: 'gcode',
    group: 'advancedTemplates',
    valueShape: 'stringArray'
  }
};

const PARAM_MENU_ACTIONS = [
  { id: 'cut', label: '剪切' },
  { id: 'copy', label: '复制' },
  { id: 'paste', label: '粘贴' },
  { id: 'undo', label: '撤销' },
  { id: 'delete', label: '删除' }
];

const GCODE_LINE_MENU_ACTIONS = [
  { id: 'deleteLine', label: '删除这一行' },
  { id: 'insertAbove', label: '上方插入一行' },
  { id: 'insertBelow', label: '下方插入一行' },
  { id: 'copyLine', label: '复制这一行' },
  { id: 'pasteLine', label: '粘贴' }
];

let paramContextMenuState = { target: null };
let gcodeLineContextMenuState = { row: null, editor: null };
let copiedGcodeLineText = '';
const gcodeHistoryStore = new WeakMap();
const PARAM_HISTORY_LIMIT = 4000;
const PARAMS_SAVE_DEFAULT_LABEL = '保存所有修改';
const PARAMS_SAVE_WORKING_LABEL = '保存中...';
const PARAMS_SAVE_SUCCESS_LABEL = '已保存';
const paramEditorSession = window.__paramEditorSession || {
  stores: new Map(),
  activePath: null,
  applying: false,
  historyPreviewToken: 0,
  historyPreviewTimer: null,
  lastFocus: null
};
window.__paramEditorSession = paramEditorSession;

function cloneParamData(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function splitParamMultilineArray(value) {
  const text = normalizeGcodeText(Array.isArray(value) ? value.join('\n') : String(value || ''));
  return text ? text.split('\n') : [];
}

function isParamStringArrayField(key) {
  return getParamFieldMeta(key).valueShape === 'stringArray';
}

function getParamEditorTextValue(key, value) {
  if (isParamStringArrayField(key)) {
    return Array.isArray(value) ? normalizeGcodeText(value.join('\n')) : normalizeGcodeText(value);
  }

  if (typeof value === 'string') {
    return key.includes('gcode') ? normalizeGcodeText(value) : value.replace(/\r\n/g, '\n');
  }

  if (value == null) return '';
  return String(value);
}

function normalizeParamValueByKey(key, value) {
  if (isParamStringArrayField(key)) {
    return splitParamMultilineArray(value);
  }

  if (typeof value === 'string') {
    return key.includes('gcode') ? normalizeGcodeText(value) : value.replace(/\r\n/g, '\n');
  }
  return cloneParamData(value);
}

function normalizeFlatState(flatState = {}) {
  const normalized = {};
  Object.keys(flatState).sort().forEach((key) => {
    normalized[key] = normalizeParamValueByKey(key, flatState[key]);
  });
  return normalized;
}

function resolveEffectiveWipingTowerValueFromFlat(flatData = {}) {
  return true;
}

function applyWipingTowerParamCompatibility(flatData = {}) {
  const nextFlat = { ...flatData };
  const effectiveTowerValue = true;

  nextFlat['wiping.have_wiping_components'] = effectiveTowerValue;
  nextFlat['wiping.use_wiping_towers'] = effectiveTowerValue;
  nextFlat['wiping.useWipingTowers'] = effectiveTowerValue;
  nextFlat['wiping.enable_wiping_tower'] = effectiveTowerValue;
  nextFlat['wiping.enableWipingTower'] = effectiveTowerValue;
  nextFlat['wiping.switch_tower_type'] = 1;

  const towerPlacement = resolveTowerPlacement(
    nextFlat['wiping.wiper_x'] ?? 0,
    nextFlat['wiping.wiper_y'] ?? 0,
    nextFlat
  );
  nextFlat['wiping.wiper_x'] = towerPlacement.x;
  nextFlat['wiping.wiper_y'] = towerPlacement.y;

  return normalizeFlatState(nextFlat);
}

function cloneParamFocus(focus) {
  return focus ? { ...focus } : null;
}

function createParamSnapshot(flatState, modes = {}, focus = null) {
  const normalizedModes = {};
  Object.keys(modes || {}).sort().forEach((key) => {
    normalizedModes[key] = modes[key];
  });

  return {
    flat: normalizeFlatState(flatState),
    modes: normalizedModes,
    focus: cloneParamFocus(focus)
  };
}

function serializeParamSnapshot(snapshot) {
  return JSON.stringify({
    flat: normalizeFlatState(snapshot?.flat || {}),
    modes: Object.keys(snapshot?.modes || {}).sort().reduce((acc, key) => {
      acc[key] = snapshot.modes[key];
      return acc;
    }, {})
  });
}

function serializeParamFullState(flatState = {}) {
  return JSON.stringify(normalizeFlatState(flatState));
}

function getParamStore(path) {
  return path ? paramEditorSession.stores.get(path) || null : null;
}

function getActiveParamStore() {
  return getParamStore(paramEditorSession.activePath);
}

function getCurrentParamStoreSnapshot(store = getActiveParamStore()) {
  if (!store?.history?.length) return null;
  const index = Math.max(0, Math.min(store.index || 0, store.history.length - 1));
  return store.history[index] || null;
}

function replaceCurrentParamStoreSnapshot(store, snapshot) {
  if (!store || !snapshot) return null;

  const nextSnapshot = createParamSnapshot(snapshot.flat, snapshot.modes, snapshot.focus);
  if (!Array.isArray(store.history) || !store.history.length) {
    store.history = [nextSnapshot];
    store.index = 0;
  } else {
    const nextIndex = Math.max(0, Math.min(store.index || 0, store.history.length - 1));
    store.index = nextIndex;
    store.history[nextIndex] = nextSnapshot;
  }

  store.currentFullSerialized = serializeParamFullState(nextSnapshot.flat);
  store.lastFocus = cloneParamFocus(nextSnapshot.focus || store.lastFocus);
  return nextSnapshot;
}

function markParamStoreSnapshotSaved(store, snapshot = getCurrentParamStoreSnapshot(store)) {
  if (!store || !snapshot) return null;

  const nextSnapshot = replaceCurrentParamStoreSnapshot(store, snapshot);
  store.savedSerialized = serializeParamSnapshot(nextSnapshot);
  store.savedFullSerialized = serializeParamFullState(nextSnapshot.flat);
  store.currentFullSerialized = store.savedFullSerialized;
  store.dirty = false;
  return nextSnapshot;
}

function refreshParamStoreDirtyFlag(store = getActiveParamStore()) {
  if (!store) return false;

  const currentSnapshot = getCurrentParamStoreSnapshot(store);
  store.currentFullSerialized = serializeParamFullState(currentSnapshot?.flat || {});
  store.dirty = store.currentFullSerialized !== (store.savedFullSerialized || store.savedSerialized);
  return store.dirty;
}

function getParamsSaveButtonLabel(button = document.getElementById('saveParamsBtn')) {
  return button?.querySelector('.params-save-label') || null;
}

function clearParamsSaveButtonFeedback(button = document.getElementById('saveParamsBtn'), options = {}) {
  if (!button) return;

  if (button._paramsSaveFeedbackTimer) {
    window.clearTimeout(button._paramsSaveFeedbackTimer);
    delete button._paramsSaveFeedbackTimer;
  }

  button.classList.remove('params-save-working', 'params-save-success');
  if (!options.keepLabel) {
    const label = getParamsSaveButtonLabel(button);
    if (label) label.textContent = PARAMS_SAVE_DEFAULT_LABEL;
  }
}

function setParamsSaveButtonWorking(button = document.getElementById('saveParamsBtn')) {
  if (!button) return;

  clearParamsSaveButtonFeedback(button, { keepLabel: true });
  button.classList.add('params-save-working');
  const label = getParamsSaveButtonLabel(button);
  if (label) label.textContent = PARAMS_SAVE_WORKING_LABEL;
}

function flashParamsSaveButtonSuccess(button = document.getElementById('saveParamsBtn'), duration = 1600, onComplete = null) {
  if (!button) return;

  clearParamsSaveButtonFeedback(button, { keepLabel: true });
  button.classList.add('params-save-success');
  const label = getParamsSaveButtonLabel(button);
  if (label) label.textContent = PARAMS_SAVE_SUCCESS_LABEL;

  button._paramsSaveFeedbackTimer = window.setTimeout(() => {
    delete button._paramsSaveFeedbackTimer;
    button.classList.remove('params-save-success');
    const nextLabel = getParamsSaveButtonLabel(button);
    if (nextLabel) nextLabel.textContent = PARAMS_SAVE_DEFAULT_LABEL;
    if (typeof onComplete === 'function') onComplete();
    updateParamDirtyUI();
  }, duration);
}

function updateParamDirtyUI(store = getActiveParamStore()) {
  const saveBtn = document.getElementById('saveParamsBtn');
  const page = document.getElementById('page-params');
  const currentEditingFile = document.getElementById('currentEditingFile');

  const isDirty = !!store?.dirty;

  if (saveBtn) {
    const isBusy = saveBtn.dataset.isSaving === 'true' || saveBtn.dataset.isAnimating === 'true';
    const canSave = isDirty && !isBusy;
    saveBtn.classList.toggle('params-save-dirty', canSave);
    saveBtn.classList.toggle('params-save-ripple', canSave);
    saveBtn.classList.toggle('params-save-idle', !isDirty && !isBusy);
    saveBtn.toggleAttribute('data-dirty', canSave);
    saveBtn.disabled = !canSave;
    saveBtn.setAttribute('aria-disabled', saveBtn.disabled ? 'true' : 'false');
  }

  if (page) {
    page.toggleAttribute('data-has-unsaved', isDirty);
  }

  if (currentEditingFile) {
    const baseName = currentEditingFile.dataset.baseName || currentEditingFile.textContent || '未选择';
    currentEditingFile.dataset.baseName = baseName;
    currentEditingFile.textContent = isDirty ? `${baseName} *` : baseName;
  }
}

function getParamFullStateBaseline(store = getActiveParamStore()) {
  if (store?.history?.[store.index]?.flat) {
    return normalizeFlatState(store.history[store.index].flat);
  }

  if (store?.savedFullSerialized) {
    try {
      return normalizeFlatState(JSON.parse(store.savedFullSerialized));
    } catch (error) {}
  }

  return {};
}

function collectParamFullStateFromDom(store = getActiveParamStore()) {
  const flatUpdates = { ...getParamFullStateBaseline(store) };
  document.querySelectorAll('.dynamic-param-input[data-json-key]').forEach((input) => {
    const key = input.getAttribute('data-json-key');
    if (!key) return;
    if (input.type === 'checkbox') {
      flatUpdates[key] = input.checked;
      return;
    }
    flatUpdates[key] = coerceParamValue(input.value, input, key);
  });

  document.querySelectorAll('[data-gcode-mode]').forEach((shell) => {
    const key = shell.getAttribute('data-json-key');
    if (!key) return;
    if (shell.dataset.gcodeMode === 'structured') syncStructuredToRaw(shell);
    const rawInput = shell.querySelector('[data-gcode-raw]');
    flatUpdates[key] = coerceParamValue(rawInput ? rawInput.value : '', rawInput, key);
  });

  return normalizeFlatState(flatUpdates);
}

function updateParamDirtyState(store = getActiveParamStore()) {
  if (!store) {
    updateParamDirtyUI(null);
    return false;
  }

  refreshParamStoreDirtyFlag(store);
  updateParamDirtyUI(store);
  return store.dirty;
}

function hasUnsavedParamChanges() {
  return !!getActiveParamStore()?.dirty;
}

function ensureParamStore(path, flatState) {
  const existing = getParamStore(path);
  if (existing) return existing;

  const snapshot = createParamSnapshot(flatState);
  const serialized = serializeParamSnapshot(snapshot);
  const store = {
    path,
    history: [snapshot],
    index: 0,
    savedSerialized: serialized,
    savedFullSerialized: serializeParamFullState(flatState),
    currentFullSerialized: serializeParamFullState(flatState),
    dirty: false,
    lastFocus: cloneParamFocus(snapshot.focus)
  };
  paramEditorSession.stores.set(path, store);
  return store;
}

function collectParamModesFromDom() {
  const modes = {};
  document.querySelectorAll('[data-gcode-mode]').forEach((shell) => {
    const key = shell.getAttribute('data-json-key');
    if (key) {
      modes[key] = shell.dataset.gcodeMode || 'raw';
    }
  });
  return modes;
}

function captureParamFocus() {
  const active = document.activeElement;
  if (!active) return null;

  const regularField = active.closest('.dynamic-param-input[data-json-key]');
  if (regularField) {
    return {
      type: 'field',
      key: regularField.getAttribute('data-json-key'),
      start: regularField.selectionStart ?? 0,
      end: regularField.selectionEnd ?? 0
    };
  }

  const rawInput = active.closest('[data-gcode-raw]');
  if (rawInput) {
    const shell = rawInput.closest('[data-gcode-mode]');
    return {
      type: 'gcode-raw',
      key: shell?.getAttribute('data-json-key'),
      start: rawInput.selectionStart ?? 0,
      end: rawInput.selectionEnd ?? 0
    };
  }

  const lineInput = active.closest('[data-gcode-line]');
  if (lineInput) {
    const row = lineInput.closest('.gcode-line-row');
    const shell = lineInput.closest('[data-gcode-mode]');
    return {
      type: 'gcode-line',
      key: shell?.getAttribute('data-json-key'),
      lineIndex: Number(row?.dataset.lineIndex || 0),
      start: lineInput.selectionStart ?? 0,
      end: lineInput.selectionEnd ?? 0
    };
  }

  return null;
}

function collectParamSnapshotFromDom() {
  return createParamSnapshot(collectParamFullStateFromDom(), collectParamModesFromDom(), captureParamFocus());
}

function rememberParamSnapshot(options = {}) {
  if (paramEditorSession.applying) return null;

  const store = getActiveParamStore();
  if (!store) return null;

  const snapshot = collectParamSnapshotFromDom();
  if (options.explicitFocus) {
    snapshot.focus = cloneParamFocus(options.explicitFocus);
  } else if (!snapshot.focus) {
    snapshot.focus = cloneParamFocus(store.lastFocus || store.history[store.index]?.focus || paramEditorSession.lastFocus);
  }

  if (snapshot.focus) {
    store.lastFocus = cloneParamFocus(snapshot.focus);
    paramEditorSession.lastFocus = cloneParamFocus(snapshot.focus);
  }

  const nextSerialized = serializeParamSnapshot(snapshot);
  const currentSerialized = serializeParamSnapshot(store.history[store.index]);

  if (!options.force && nextSerialized === currentSerialized) {
    store.history[store.index].focus = cloneParamFocus(snapshot.focus);
    store.currentFullSerialized = serializeParamFullState(store.history[store.index].flat);
    updateParamDirtyState(store);
    return snapshot;
  }

  if (options.replaceCurrent) {
    store.history[store.index] = snapshot;
  } else {
    store.history = store.history.slice(0, store.index + 1);
    store.history.push(snapshot);
    store.index = store.history.length - 1;
    if (store.history.length > PARAM_HISTORY_LIMIT) {
      store.history = store.history.slice(store.history.length - PARAM_HISTORY_LIMIT);
      store.index = store.history.length - 1;
    }
  }

  store.currentFullSerialized = serializeParamFullState(snapshot.flat);
  updateParamDirtyState(store);
  return snapshot;
}

function applyParamSnapshotToDom(snapshot, options = {}) {
  if (!snapshot) return;

  paramEditorSession.applying = true;
  try {
    document.querySelectorAll('.dynamic-param-input[data-json-key]').forEach((input) => {
      const key = input.getAttribute('data-json-key');
      const value = snapshot.flat[key];
      if (value === undefined) return;

      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
        return;
      }

      input.value = getParamEditorTextValue(key, value);
    });

    document.querySelectorAll('[data-gcode-mode]').forEach((shell) => {
      const key = shell.getAttribute('data-json-key');
      const rawInput = shell.querySelector('[data-gcode-raw]');

      if (rawInput && snapshot.flat[key] !== undefined) {
        rawInput.value = getParamEditorTextValue(key, snapshot.flat[key]);
      }

      syncRawToStructured(shell, { resetHistory: false });
    });

    document.querySelectorAll('.param-row-toggle').forEach((row) => {
      const checkbox = row.querySelector('.dynamic-param-input[type="checkbox"]');
      const status = row.querySelector('.param-switch-status');
      if (checkbox && status) {
        status.textContent = checkbox.checked ? '已开启' : '已关闭';
      }
    });
  } finally {
    paramEditorSession.applying = false;
  }

  updateParamDirtyUI();
}

function applyFullParamStateToDom(flatState = {}) {
  paramEditorSession.applying = true;
  try {
    document.querySelectorAll('.dynamic-param-input[data-json-key]').forEach((input) => {
      const key = input.getAttribute('data-json-key');
      if (!(key in flatState)) return;

      if (input.type === 'checkbox') {
        input.checked = Boolean(flatState[key]);
        return;
      }

      input.value = getParamEditorTextValue(key, flatState[key]);
    });

    document.querySelectorAll('[data-gcode-mode]').forEach((shell) => {
      const key = shell.getAttribute('data-json-key');
      if (!(key in flatState)) return;
      const rawInput = shell.querySelector('[data-gcode-raw]');
      if (rawInput) {
        rawInput.value = getParamEditorTextValue(key, flatState[key]);
      }
      syncRawToStructured(shell, { resetHistory: false });
    });

    document.querySelectorAll('.param-row-toggle').forEach((row) => {
      const checkbox = row.querySelector('.dynamic-param-input[type="checkbox"]');
      const status = row.querySelector('.param-switch-status');
      if (checkbox && status) {
        status.textContent = checkbox.checked ? '已开启' : '已关闭';
      }
    });
  } finally {
    paramEditorSession.applying = false;
  }
}

async function stepParamHistory(direction, options = {}) {
  const store = getActiveParamStore();
  if (!store) return false;

  const nextIndex = store.index + direction;
  if (nextIndex < 0 || nextIndex >= store.history.length) return false;

  const targetSnapshot = store.history[nextIndex];
  store.index = nextIndex;
  applyParamSnapshotToDom(targetSnapshot, options);
  updateParamDirtyState(store);
  return true;
}

function discardActiveParamChanges() {
  const store = getActiveParamStore();
  if (!store) return;

  const savedIndex = store.history.findIndex((snapshot) => serializeParamSnapshot(snapshot) === store.savedSerialized);
  if (savedIndex >= 0) {
    store.index = savedIndex;
  } else {
    const current = store.history[store.index];
    store.history = [createParamSnapshot(current.flat, current.modes, current.focus)];
    store.index = 0;
    store.savedSerialized = serializeParamSnapshot(store.history[0]);
    store.savedFullSerialized = serializeParamFullState(store.history[0].flat);
  }

  store.currentFullSerialized = store.savedFullSerialized || serializeParamFullState(getCurrentParamStoreSnapshot(store)?.flat || {});

  const paramsPage = document.getElementById('page-params');
  if (paramsPage && !paramsPage.classList.contains('hidden')) {
    try {
      applyFullParamStateToDom(JSON.parse(store.savedFullSerialized || '{}'));
    } catch (error) {
      applyParamSnapshotToDom(store.history[store.index], { restoreFocus: false });
    }
  }

  updateParamDirtyState(store);
}

function markActiveParamSnapshotSaved(snapshot = null) {
  const store = getActiveParamStore();
  if (!store) return;
  const targetSnapshot = snapshot || getCurrentParamStoreSnapshot(store);
  markParamStoreSnapshotSaved(store, targetSnapshot);
  updateParamDirtyState(store);
}

function replaceActiveParamStoreWithPersistedState(presetPath, flatState, options = {}) {
  const persistedFlatState = buildRenderableParamState(normalizeFlatState(flatState)).flat;
  let store = getParamStore(presetPath);
  const currentSnapshot = store?.history?.[store.index] || null;
  const nextSnapshot = createParamSnapshot(
    persistedFlatState,
    options.modes || currentSnapshot?.modes || collectParamModesFromDom(),
    options.focus === undefined ? currentSnapshot?.focus || null : options.focus
  );

  if (!store) {
    store = ensureParamStore(presetPath, persistedFlatState);
  }

  store.path = presetPath;
  store.history = [nextSnapshot];
  store.index = 0;
  markParamStoreSnapshotSaved(store, nextSnapshot);
  paramEditorSession.activePath = presetPath;

  if (options.applyDom) {
    applyFullParamStateToDom(persistedFlatState);
    updateParamDirtyUI(store);
  }

  updateParamDirtyState(store);
  return { store, snapshot: nextSnapshot, flatState: persistedFlatState };
}

function collectParamStateDiffKeys(leftFlat = {}, rightFlat = {}, limit = 12) {
  const keys = Array.from(new Set([
    ...Object.keys(normalizeFlatState(leftFlat)),
    ...Object.keys(normalizeFlatState(rightFlat))
  ])).sort();
  const diffs = [];
  for (const key of keys) {
    const left = normalizeParamValueByKey(key, leftFlat[key]);
    const right = normalizeParamValueByKey(key, rightFlat[key]);
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push(key);
      if (diffs.length >= limit) break;
    }
  }
  return diffs;
}

function logParamDirtyMismatch(context, expectedFlat = {}, actualFlat = {}, extra = {}) {
  const diffKeys = collectParamStateDiffKeys(expectedFlat, actualFlat);
  if (!diffKeys.length) return;

  Logger.warn(`[Params] Dirty mismatch after ${context}`, {
    diffKeys,
    diffCount: diffKeys.length,
    ...extra
  });
}

function escapeParamHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeGcodeText(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function getParamFieldMeta(key) {
  return PARAM_FIELD_META[key] || {
    label: key.split('.').pop().replace(/_/g, ' '),
    desc: `底层字段：${key}`,
    group: key.startsWith('toolhead.') ? 'toolhead' : key.startsWith('wiping.') ? 'wiping' : 'advanced'
  };
}

function getGroupForField(key) {
  const meta = getParamFieldMeta(key);
  if (meta.group) return meta.group;
  if (key.startsWith('toolhead.custom_mount_gcode')) return 'mount';
  if (key.startsWith('toolhead.custom_unmount_gcode')) return 'unmount';
  if (key.startsWith('toolhead.')) return 'toolhead';
  if (key.startsWith('wiping.')) return 'wiping';
  return 'advanced';
}

function isAdvancedTemplateField(key) {
  return PARAM_TEMPLATE_FIELD_ORDER.includes(key);
}

function isTowerGeometryField(key) {
  return TOWER_GEOMETRY_FIELD_KEYS.has(key);
}

function inferInputType(key, value) {
  const meta = getParamFieldMeta(key);
  if (meta.type) return meta.type;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string' && value.includes('\n')) return 'textarea';
  return 'text';
}

function getParamGroupIcon(icon) {
  const icons = {
    info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.25 11.25l.041-.02a.75.75 0 011.084.67v4.08a.75.75 0 01-1.125.65l-.041-.02M12 8.25h.008v.008H12V8.25z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    toolhead: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3.75h6m-7.5 4.5h9m-10.5 4.5h12m-9 4.5h6"/>',
    wiping: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 7.5h15M6 12h12m-9 4.5h6"/>',
    mount: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 16.5V4.5m0 0l-4.5 4.5M12 4.5l4.5 4.5"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 19.5h15"/>',
    unmount: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 7.5v12m0 0L7.5 15M12 19.5l4.5-4.5"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 4.5h15"/>',
    advanced: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m9 12h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>'
  };
  return icons[icon] || icons.advanced;
}

function getGcodeLineHint(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return '空行';
  if (trimmed.startsWith(';')) return '注释';
  if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) return '运动';
  if (trimmed.startsWith('G92')) return '坐标重置';
  if (trimmed.startsWith('M106')) return '风扇';
  if (trimmed.startsWith('M204')) return '加速度';
  if (trimmed.startsWith('L8')) return '自定义宏';
  return '指令';
}

const ACTIVE_PRESET_LOG_STATE = {
  storageKey: null,
  fileName: null,
  path: null,
  pathLoggedAt: 0
};
const ACTIVE_PRESET_CACHE_MAX_AGE_MS = 10000;

async function getActivePresetPath() {
  const downloadContext = typeof window.__getDownloadContextView__ === 'function'
    ? window.__getDownloadContextView__()
    : null;
  const resolvedPrinterId = downloadContext?.printer?.id || selectedPrinter;
  const resolvedVersionType = downloadContext?.selectedVersionType || selectedVersion;
  const currentKey = `${resolvedPrinterId}_${resolvedVersionType}`;
  const modernPath = typeof window.__getParamsPresetView__ === 'function'
    ? window.__getParamsPresetView__()?.absolutePath || null
    : null;

  if (modernPath) {
    ACTIVE_PRESET_LOG_STATE.storageKey = null;
    ACTIVE_PRESET_LOG_STATE.fileName = null;
    ACTIVE_PRESET_LOG_STATE.path = modernPath;
    return modernPath;
  }

  const storageKey = `mkp_current_script_${currentKey}`;
  const fileName = localStorage.getItem(storageKey);
  if (ACTIVE_PRESET_LOG_STATE.storageKey !== storageKey || ACTIVE_PRESET_LOG_STATE.fileName !== fileName) {
    Logger.info(`Read variable: ${storageKey}`);
    ACTIVE_PRESET_LOG_STATE.storageKey = storageKey;
    ACTIVE_PRESET_LOG_STATE.fileName = fileName;
  }
  const legacyPath = fileName
    ? `${await window.mkpAPI.getUserDataPath()}\\${fileName}`
    : null;

  ACTIVE_PRESET_LOG_STATE.path = legacyPath;
  return legacyPath;
}

async function loadActivePreset(forceRefresh = false) {
  const path = await getActivePresetPath();
  if (!path) return null;

  const now = Date.now();
  if (!forceRefresh && window.presetCache.path === path && (now - window.presetCache.timestamp < ACTIVE_PRESET_CACHE_MAX_AGE_MS)) {
    return { path, data: window.presetCache.data };
  }

  if (ACTIVE_PRESET_LOG_STATE.path !== path || now - ACTIVE_PRESET_LOG_STATE.pathLoggedAt > 4000 || forceRefresh) {
    Logger.info(`[O301] Read preset, path:${path}`);
    ACTIVE_PRESET_LOG_STATE.path = path;
    ACTIVE_PRESET_LOG_STATE.pathLoggedAt = now;
  }
  const result = await window.mkpAPI.readPreset(path);
  if (!result.success) {
    Logger.error(`[E301] Preset not found: ${path}`);
    return null;
  }

  if (typeof window.updatePresetCacheSnapshot === 'function') {
    window.updatePresetCacheSnapshot(path, result.data);
  } else {
    window.presetCache = { path, data: result.data, timestamp: now };
  }
  return { path, data: result.data };
}

function getEmptyParamsState() {
  return `
    <div class="col-span-full w-full flex flex-col items-center justify-center min-h-[320px] bg-gray-50/50 dark:bg-[#1E1E1E]/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-[#333] transition-all p-8">
      <svg class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
      </svg>
      <span class="text-lg font-semibold text-gray-500 dark:text-gray-400">当前未应用任何预设</span>
      <span class="text-sm text-gray-400 dark:text-gray-500 mt-2 text-center">请先前往 <span onclick="navTo('page:download')" class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer font-medium hover:underline transition-all">【下载预设】</span> 页面应用一个本地配置</span>
    </div>
  `;
}

function buildParamsSummary(presetData, fileName) {
  const printer = presetData?.printer || '--';
  const type = presetData?.type || '--';
  const version = presetData?.version || '--';
  const displayName = presetData?._custom_name || fileName;

  return `
    <div class="params-hero-card">
      <div>
        <div class="params-hero-label">当前预设</div>
        <div class="params-hero-title">${escapeParamHtml(displayName)}</div>
        <div class="params-hero-subtitle">${escapeParamHtml(fileName)}</div>
      </div>
      <div class="params-hero-badges">
        <span class="params-pill">机型 ${escapeParamHtml(printer)}</span>
        <span class="params-pill">类型 ${escapeParamHtml(type)}</span>
        <span class="params-pill params-pill-strong">版本 v${escapeParamHtml(version)}</span>
      </div>
    </div>
  `;
}

function renderFieldTooltip(meta) {
  return `
    <div class="param-tip">
      <div class="param-tip-title">字段说明</div>
      <div class="param-tip-body">${escapeParamHtml(meta.desc || '')}</div>
    </div>
  `;
}

function renderFieldLabel(meta, key, subText = '') {
  const metaText = subText || meta.unit || key;
  return `
    <div class="param-row-main">
      <div class="param-row-title-line">
        <div class="param-field-title">${escapeParamHtml(meta.label)}</div>
        <div class="param-tooltip-anchor">
          <span class="param-help-dot">?</span>
          ${renderFieldTooltip(meta)}
        </div>
      </div>
      <div class="param-field-sub">${escapeParamHtml(metaText)}</div>
    </div>
  `;
}

function createBooleanField(key, value, meta, options = {}) {
  const wrapperAttrs = options.wrapperAttrs ? ` ${options.wrapperAttrs}` : '';
  const inputAttrs = options.inputAttrs ? ` ${options.inputAttrs}` : '';
  return `
    <label class="param-row param-row-toggle"${wrapperAttrs}>
      ${renderFieldLabel(meta, key, '布尔开关')}
      <div class="param-row-control">
        <span class="param-switch-status">${value ? '已开启' : '已关闭'}</span>
        <span class="mkp-switch mkp-switch-compact">
          <input type="checkbox" data-json-key="${escapeParamHtml(key)}" class="dynamic-param-input mkp-switch-input" ${value ? 'checked' : ''}${inputAttrs}>
          <span class="mkp-switch-track"></span>
        </span>
      </div>
    </label>
  `;
}

function createStandardField(key, value, meta, inputType) {
  const isTextarea = inputType === 'textarea' || meta.multiline;
  const valueText = value == null ? '' : String(value);
  const numericConstraint = inputType === 'number' ? activeParamNumericConstraints[key] || null : null;
  const numericAttrs = inputType === 'number'
    ? `${numericConstraint ? ` min="${escapeParamHtml(numericConstraint.min)}" max="${escapeParamHtml(numericConstraint.max)}"` : ''} step="${numericConstraint?.integer ? '1' : 'any'}" inputmode="decimal"`
    : '';

  if (inputType === 'select' && Array.isArray(meta.options)) {
    return `
      <div class="param-row">
        ${renderFieldLabel(meta, key, '模式选择')}
        <div class="param-row-control">
          <select data-json-key="${escapeParamHtml(key)}" class="dynamic-param-input param-editable param-input">
            ${meta.options.map((option) => `
              <option value="${escapeParamHtml(option.value)}" ${String(option.value) === valueText ? 'selected' : ''}>${escapeParamHtml(option.label)}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  if (isTextarea) {
    return `
      <div class="param-row param-row-block">
        ${renderFieldLabel(meta, key, meta.desc || key)}
        <div class="param-row-control param-row-control-block">
          <textarea data-json-key="${escapeParamHtml(key)}" rows="4" class="dynamic-param-input param-editable param-textarea">${escapeParamHtml(valueText)}</textarea>
        </div>
      </div>
    `;
  }

  return `
    <div class="param-row">
      ${renderFieldLabel(meta, key, meta.unit ? `单位：${meta.unit}` : '文本字段')}
      <div class="param-row-control">
        <input type="${inputType === 'number' ? 'number' : 'text'}"${numericAttrs} data-json-key="${escapeParamHtml(key)}" value="${escapeParamHtml(valueText)}" class="dynamic-param-input param-editable param-input">
      </div>
    </div>
  `;
}

function renderGcodeLineRow(line, index) {
  return `
    <div class="gcode-line-row" data-line-index="${index}">
      <div class="gcode-line-meta" title="右键可插入、复制、粘贴或删除这一行">
        <span class="gcode-line-number">${index + 1}</span>
        <span class="gcode-line-kind">${escapeParamHtml(getGcodeLineHint(line))}</span>
      </div>
      <input type="text" value="${escapeParamHtml(line)}" class="param-editable gcode-line-input" data-gcode-line>
    </div>
  `;
}

function createGcodeField(key, value, meta) {
  const rawText = getParamEditorTextValue(key, value);
  const lines = rawText.split('\n');
  const renderLines = lines.length > 0 ? lines : [''];

  return `
    <div class="param-row param-row-block param-row-gcode" data-param-gcode="true">
      <div class="param-row-head">
        ${renderFieldLabel(meta, key, '默认整段编辑，可切换为分行精修')}
        <div class="param-field-actions">
          <div class="gcode-mode-switch">
            <button type="button" class="gcode-mode-btn is-active" data-mode-btn="raw" onclick="toggleGcodeMode(this, 'raw')">整段编辑</button>
            <button type="button" class="gcode-mode-btn" data-mode-btn="structured" onclick="toggleGcodeMode(this, 'structured')">分行编辑</button>
          </div>
        </div>
      </div>
      <div class="param-row-control param-row-control-block">
        <div class="gcode-card-shell" data-json-key="${escapeParamHtml(key)}" data-gcode-mode="raw">
        <div class="gcode-raw-shell">
          <textarea class="dynamic-param-input param-editable param-textarea gcode-raw-input" data-gcode-raw rows="10">${escapeParamHtml(rawText)}</textarea>
        </div>
        <div class="gcode-structured-shell hidden">
          <div class="gcode-structured-toolbar">右键行号或整行可插入、复制、粘贴、删除</div>
          <div class="gcode-editor" data-gcode-structured>
            ${renderLines.map((line, index) => renderGcodeLineRow(line, index)).join('')}
          </div>
        </div>
      </div>
      </div>
    </div>
  `;
}

function buildParamGroupSections(flatData) {
  const groups = { meta: [], toolhead: [], wiping: [], mount: [], unmount: [], advanced: [] };

  Object.keys(flatData).forEach((key) => {
    if (PARAM_HIDDEN_PUBLIC_FIELDS.has(key)) return;
    if (isAdvancedTemplateField(key)) return;
    if (isTowerGeometryField(key)) return;

    const value = flatData[key];
    const meta = getParamFieldMeta(key);
    const type = inferInputType(key, value);

    if (type === 'gcode') {
      groups[getGroupForField(key)].push(createGcodeField(key, value, meta));
      return;
    }

    if (type === 'boolean') {
      groups[getGroupForField(key)].push(createBooleanField(key, value, meta));
      return;
    }

    groups[getGroupForField(key)].push(createStandardField(key, value, meta, type));
  });

  return groups;
}

function renderParamFieldByKey(key, flatData, options = {}) {
  const value = flatData[key];
  const meta = getParamFieldMeta(key);
  const type = inferInputType(key, value);

  if (type === 'gcode') {
    return createGcodeField(key, value, meta);
  }

  if (type === 'boolean') {
    return createBooleanField(key, value, meta, options.booleanOptions || {});
  }

  return createStandardField(key, value, meta, type);
}

function renderPreviewParamGroup(groupKey, cards, options = {}) {
  const extraContent = options.extraContent || '';
  if (!cards.length && !extraContent) return '';

  const meta = PARAM_GROUP_META[groupKey] || PARAM_GROUP_META.advanced;
  const panelMarkup = cards.length
    ? `
      <div class="params-settings-panel">
        ${cards.join('')}
      </div>
    `
    : '';

  return `
    <section id="params-section-${escapeParamHtml(groupKey)}" class="params-section params-group-preview-section">
      <div class="params-group-preview-head">
        <h3 class="params-group-preview-title">${escapeParamHtml(meta.title)}</h3>
        <p class="params-group-preview-desc">${escapeParamHtml(meta.desc)}</p>
      </div>
      ${panelMarkup}
      ${extraContent ? `<div class="params-group-preview-extra">${extraContent}</div>` : ''}
    </section>
  `;
}

function buildParamsSectionNavMarkup(groups = {}) {
  const sectionKeys = PARAM_SECTION_ORDER
    .filter((groupKey) => Array.isArray(groups[groupKey]) && groups[groupKey].length > 0)
    .slice(0, 6);

  return sectionKeys.map((groupKey, index) => {
    const meta = PARAM_GROUP_META[groupKey] || PARAM_GROUP_META.advanced;
    return `
      <button
        type="button"
        class="params-nav-item${index === 0 ? ' active theme-text' : ''}"
        data-params-nav-target="params-section-${escapeParamHtml(groupKey)}"
        onclick="scrollToParamsSection('params-section-${escapeParamHtml(groupKey)}')"
      >
        ${escapeParamHtml(meta.title)}
      </button>
    `;
  }).join('');
}

function renderParamsSectionNav(groups = {}) {
  const nav = document.getElementById('paramsSectionNav');
  if (!nav) return;

  const markup = buildParamsSectionNavMarkup(groups);
  nav.innerHTML = markup;
  nav.classList.toggle('hidden', !markup.trim());
}

function getParamsPageScrollContainer() {
  const page = document.getElementById('page-params');
  if (typeof window.resolvePageScrollContainer === 'function') {
    return window.resolvePageScrollContainer(page) || page || document.getElementById('paramsPageContent');
  }
  return page || document.getElementById('paramsPageContent');
}

function getParamsStickyHeaderOffset(scrollContainer = getParamsPageScrollContainer()) {
  if (typeof window.getPageScrollHeaderOffset === 'function') {
    return window.getPageScrollHeaderOffset(scrollContainer);
  }
  const header = document.querySelector('#page-params .page-header');
  return header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
}

function scrollToParamsSection(sectionId) {
  const container = getParamsPageScrollContainer();
  const target = document.getElementById(sectionId);
  if (!container || !target) return;

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const headerOffset = getParamsStickyHeaderOffset(container);
  const targetScrollTop = container.scrollTop + (targetRect.top - containerRect.top) - headerOffset - 18;
  container.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth'
  });
}

function syncParamsSectionNavState() {
  const container = getParamsPageScrollContainer();
  const nav = document.getElementById('paramsSectionNav');
  if (!container) return;

  const sections = Array.from(container.querySelectorAll('.params-section'));
  const navItems = nav?.querySelectorAll('.params-nav-item') || [];
  if (!sections.length || !navItems.length) return;

  const containerRect = container.getBoundingClientRect();
  const stickyThreshold = getParamsStickyHeaderOffset(container) + 140;
  let currentActiveId = sections[0].id;

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= containerRect.top + stickyThreshold) {
      currentActiveId = section.id;
    }
  });

  navItems.forEach((item) => {
    const isActive = item.dataset.paramsNavTarget === currentActiveId;
    item.classList.toggle('active', isActive);
    item.classList.toggle('theme-text', isActive);
    item.classList.toggle('text-gray-500', !isActive);
    item.classList.toggle('hover:text-gray-900', !isActive);
    item.classList.toggle('dark:hover:text-gray-200', !isActive);
  });
}

function initParamsSectionNav() {
  const container = getParamsPageScrollContainer();
  if (!container) return;

  if (container.dataset.paramsNavBound !== 'true') {
    container.dataset.paramsNavBound = 'true';
    container.addEventListener('scroll', () => syncParamsSectionNavState());
  }

  syncParamsSectionNavState();
}

function getTowerGeometryBooleanValue(flatData = {}, ...keys) {
  const fallback = keys.length > 0
    ? keys.some((key) => toFiniteTowerNumber(flatData[key]) != null && toFiniteTowerNumber(flatData[key]) > 0)
    : false;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(flatData, key)) continue;
    const value = flatData[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
  }

  return fallback;
}

function buildPreviewWipeTowerGeometryTool(flatData = {}) {
  const slantedEnabled = getTowerGeometryBooleanValue(
    flatData,
    'wiping.tower_slanted_outer_wall_enabled',
    'wiping.towerSlantedOuterWallEnabled',
    'wiping.tower_slanted_outer_wall_width',
    'wiping.tower_slanted_outer_wall_depth'
  );
  const panelClass = slantedEnabled ? 'params-inline-subpanel' : 'params-inline-subpanel hidden';

  return {
    id: 'wipe-tower-geometry',
    title: '擦料塔几何',
    desc: '占地、边界和 CLI 生成共用这一组高级塔参数。',
    content: `
      <div class="params-inline-preview" data-inline-card="wipe-tower-geometry">
        <div class="params-settings-panel params-settings-panel-compact">
          ${renderParamFieldByKey('wiping.tower_width', flatData)}
          ${renderParamFieldByKey('wiping.tower_depth', flatData)}
          ${renderParamFieldByKey('wiping.tower_brim_width', flatData)}
          ${renderParamFieldByKey('wiping.tower_outer_wall_width', flatData)}
          ${renderParamFieldByKey('wiping.tower_outer_wall_depth', flatData)}
          ${renderParamFieldByKey('wiping.tower_slanted_outer_wall_enabled', flatData, {
            booleanOptions: { inputAttrs: 'data-tower-advanced-toggle="slanted-outer-wall"' }
          })}
        </div>
        <div class="${panelClass}" data-tower-advanced-panel="slanted-outer-wall">
          <div class="params-group-preview-head params-group-preview-head-inline params-group-preview-head-inline-compact">
            <h4 class="params-group-preview-subtitle">斜肋外墙</h4>
            <p class="params-group-preview-desc">只有启用后，下面这两项才会参与预览和生成。</p>
          </div>
          <div class="params-settings-panel params-settings-panel-compact">
            ${renderParamFieldByKey('wiping.tower_slanted_outer_wall_width', flatData)}
            ${renderParamFieldByKey('wiping.tower_slanted_outer_wall_depth', flatData)}
          </div>
        </div>
      </div>
    `
  };
}

function syncTowerAdvancedPanels(scope = document) {
  scope.querySelectorAll('[data-tower-advanced-toggle]').forEach((input) => {
    const sync = () => {
      const panelId = input.dataset.towerAdvancedToggle;
      const root = input.closest('[data-inline-card="wipe-tower-geometry"]') || scope;
      const panel = root.querySelector(`[data-tower-advanced-panel="${panelId}"]`);
      if (!panel) return;
      panel.classList.toggle('hidden', !input.checked);
    };

    sync();
    if (input.dataset.towerAdvancedBound === 'true') return;
    input.dataset.towerAdvancedBound = 'true';
    input.addEventListener('change', sync);
  });
}

function resolveTemplateFieldValue(flatData, templateKey) {
  if (flatData && Object.prototype.hasOwnProperty.call(flatData, templateKey)) {
    return flatData[templateKey];
  }
  return cloneParamData(PARAM_TEMPLATE_DEFAULTS[templateKey] || []);
}

function buildRenderableParamState(flatData = {}) {
  const injectedFlat = { ...flatData };

  Object.keys(PARAM_VALUE_DEFAULTS).forEach((key) => {
    if (injectedFlat[key] == null) {
      injectedFlat[key] = cloneParamData(PARAM_VALUE_DEFAULTS[key]);
    }
  });

  injectedFlat['wiping.have_wiping_components'] = resolveEffectiveWipingTowerValueFromFlat(injectedFlat);
  injectedFlat['wiping.use_wiping_towers'] = true;
  injectedFlat['wiping.useWipingTowers'] = true;
  injectedFlat['wiping.enable_wiping_tower'] = true;
  injectedFlat['wiping.enableWipingTower'] = true;
  injectedFlat['wiping.switch_tower_type'] = 1;
  const towerPlacement = resolveTowerPlacement(
    injectedFlat['wiping.wiper_x'] ?? 0,
    injectedFlat['wiping.wiper_y'] ?? 0,
    injectedFlat
  );
  injectedFlat['wiping.wiper_x'] = towerPlacement.x;
  injectedFlat['wiping.wiper_y'] = towerPlacement.y;

  PARAM_TEMPLATE_FIELD_ORDER.forEach((templateKey) => {
    injectedFlat[templateKey] = normalizeParamValueByKey(templateKey, resolveTemplateFieldValue(flatData, templateKey));
  });

  return {
    flat: normalizeFlatState(injectedFlat)
  };
}

function countParamLines(key, value) {
  const text = getParamEditorTextValue(key, value).trim();
  return text ? text.split('\n').length : 0;
}

function buildDiagnosticsPayload(flatData, presetPath, fileName) {
  const presetData = unflattenObject(flatData);
  const wipingTemplate = normalizeParamValueByKey('templates.wipingGcode', flatData['templates.wipingGcode']);
  const towerBaseTemplate = normalizeParamValueByKey('templates.towerBaseLayerGcode', flatData['templates.towerBaseLayerGcode']);

  return {
    source: {
      fileName,
      presetPath,
      fieldCount: Object.keys(flatData).length,
      customName: presetData._custom_name || null,
      version: presetData.version || null,
      printer: presetData.printer || null,
      type: presetData.type || null
    },
    toolhead: {
      speedLimit: presetData.toolhead?.speed_limit ?? null,
      offset: {
        x: presetData.toolhead?.offset?.x ?? null,
        y: presetData.toolhead?.offset?.y ?? null,
        z: presetData.toolhead?.offset?.z ?? null
      },
      customMountGcodeLines: countParamLines('toolhead.custom_mount_gcode', flatData['toolhead.custom_mount_gcode']),
      customUnmountGcodeLines: countParamLines('toolhead.custom_unmount_gcode', flatData['toolhead.custom_unmount_gcode'])
    },
    wiping: {
      haveWipingComponents: resolveEffectiveWipingTowerValueFromFlat(flatData),
      switchTowerType: presetData.wiping?.switch_tower_type ?? 1,
      wiperX: presetData.wiping?.wiper_x ?? null,
      wiperY: presetData.wiping?.wiper_y ?? null,
      wipeTowerPrintSpeed: presetData.wiping?.wipetower_speed ?? null,
      nozzleCoolingFlag: Boolean(presetData.wiping?.nozzle_cooling_flag),
      ironApplyFlag: Boolean(presetData.wiping?.iron_apply_flag),
      userDryTime: presetData.wiping?.user_dry_time ?? null,
      forceThickBridgeFlag: Boolean(presetData.wiping?.force_thick_bridge_flag),
      supportExtrusionMultiplier: presetData.wiping?.support_extrusion_multiplier ?? null
    },
    templates: {
      wipingGcode: wipingTemplate,
      towerBaseLayerGcode: towerBaseTemplate
    }
  };
}

function renderCompactParamToolDisclosure(section, options = {}) {
  if (!section?.content) return '';

  const title = options.title || section.title || '';
  const desc = options.desc ?? section.desc ?? '';
  const badge = options.badge ?? section.badge;

  return `
    <details class="params-disclosure params-disclosure-subtle params-tool-disclosure" data-disclosure-id="${escapeParamHtml(section.id || '')}">
      <summary class="params-disclosure-summary params-tool-disclosure-summary">
        <div class="params-tool-disclosure-copy">
          <div class="params-tool-disclosure-title-row">
            <span class="params-tool-disclosure-title">${escapeParamHtml(title)}</span>
            ${badge ? `<span class="params-disclosure-badge">${escapeParamHtml(badge)}</span>` : ''}
          </div>
          ${desc ? `<p class="params-tool-disclosure-desc">${escapeParamHtml(desc)}</p>` : ''}
        </div>
        <span class="params-disclosure-chevron" aria-hidden="true">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 9l6 6 6-6"></path>
          </svg>
        </span>
      </summary>
      <div class="params-disclosure-body">
        ${section.content}
      </div>
    </details>
  `;
}

function renderAdvancedTemplateEditorSection(flatData, presetPath, fileName) {
  const towerGeometryTool = buildPreviewWipeTowerGeometryTool(flatData);
  const towerPositionTool = buildTowerPositionDisclosure(flatData);
  const diagnosticsTool = buildDiagnosticsDisclosure(flatData, presetPath, fileName);
  const templateCards = PARAM_TEMPLATE_FIELD_ORDER.map((key) => createGcodeField(key, flatData[key], getParamFieldMeta(key)));

  return `
    <section class="params-section params-group-preview-section params-advanced-editor-section">
      <div class="params-group-preview-head">
        <h3 class="params-group-preview-title">高级模板编辑器</h3>
        <p class="params-group-preview-desc">模板、实验性工具和诊断信息统一收进这里，避免参数页底部再出现一排独立大标题。</p>
      </div>
      <div class="params-group-preview-extra">
        <div class="params-settings-panel">
          <div class="params-disclosure-note">
            修改后会随当前 preset 一起保存到 JSON 的 <code>templates.*</code> 字段，用来覆盖 JS engine 内置模板。
          </div>
          ${templateCards.join('')}
        </div>
        <div class="params-inline-preview">
          <div class="params-group-preview-head params-group-preview-head-inline">
            <h4 class="params-group-preview-subtitle">实验性工具</h4>
            <p class="params-group-preview-desc">擦料塔几何、位置预览和诊断结果都收在这里，需要时再展开。</p>
          </div>
          ${renderCompactParamToolDisclosure(towerGeometryTool)}
          ${renderCompactParamToolDisclosure(towerPositionTool, { title: '位置预览', desc: '' })}
          ${renderCompactParamToolDisclosure(diagnosticsTool, { title: '诊断结果', desc: '' })}
        </div>
      </div>
    </section>
  `;
}

function buildAdvancedTemplateDisclosure__unused(flatData) {
  const cards = PARAM_TEMPLATE_FIELD_ORDER.map((key) => {
    return createGcodeField(key, flatData[key], getParamFieldMeta(key));
  });

  return {
    id: 'advanced-templates',
    title: '高级模板编辑器',
    desc: '只在需要覆盖底层默认模板时再展开。普通调参通常不需要动这里。',
    badge: `${PARAM_TEMPLATE_FIELD_ORDER.length} 项模板`,
    content: `
      <div class="params-disclosure-note">
        修改后会随当前 preset 一起保存到 JSON 的 <code>templates.*</code> 字段，用来覆盖 JS engine 内置模板。
      </div>
      <div class="params-group-list params-group-list-compact">
        ${cards.join('')}
      </div>
    `
  };
}

function roundTowerEditorCoordinate(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toFiniteTowerNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getTowerEditorPrinterId(flatData = {}) {
  const downloadContext = typeof window.__getDownloadContextView__ === 'function'
    ? window.__getDownloadContextView__()
    : null;
  const printerId = flatData.printer || downloadContext?.printer?.id || selectedPrinter || '';
  return String(printerId || '').trim().toLowerCase();
}

function resolveTowerEditorPrinterProfile(flatData = {}) {
  return TOWER_EDITOR_PRINTER_PROFILES[getTowerEditorPrinterId(flatData)] || null;
}

function resolveTowerEditorBounds(flatData = {}) {
  const flatBounds = {
    minX: toFiniteTowerNumber(flatData['machine.bounds.minX']),
    maxX: toFiniteTowerNumber(flatData['machine.bounds.maxX']),
    minY: toFiniteTowerNumber(flatData['machine.bounds.minY']),
    maxY: toFiniteTowerNumber(flatData['machine.bounds.maxY'])
  };

  if (
    flatBounds.minX != null
    && flatBounds.maxX != null
    && flatBounds.minY != null
    && flatBounds.maxY != null
    && flatBounds.maxX > flatBounds.minX
    && flatBounds.maxY > flatBounds.minY
  ) {
    return flatBounds;
  }

  const printerProfile = resolveTowerEditorPrinterProfile(flatData);
  if (printerProfile?.bounds) {
    return { ...printerProfile.bounds };
  }

  return {
    minX: 0,
    maxX: TOWER_EDITOR_DEFAULTS.bedWidth,
    minY: 0,
    maxY: TOWER_EDITOR_DEFAULTS.bedDepth
  };
}

function intersectTowerSafeRanges(baseRange, limitRange) {
  if (!limitRange) {
    return {
      minX: baseRange.minX,
      maxX: baseRange.maxX,
      minY: baseRange.minY,
      maxY: baseRange.maxY
    };
  }

  const minX = Math.max(baseRange.minX, toFiniteTowerNumber(limitRange.minX) ?? baseRange.minX);
  const maxX = Math.min(baseRange.maxX, toFiniteTowerNumber(limitRange.maxX) ?? baseRange.maxX);
  const minY = Math.max(baseRange.minY, toFiniteTowerNumber(limitRange.minY) ?? baseRange.minY);
  const maxY = Math.min(baseRange.maxY, toFiniteTowerNumber(limitRange.maxY) ?? baseRange.maxY);

  return {
    minX: roundTowerEditorCoordinate(minX),
    maxX: roundTowerEditorCoordinate(Math.max(minX, maxX)),
    minY: roundTowerEditorCoordinate(minY),
    maxY: roundTowerEditorCoordinate(Math.max(minY, maxY))
  };
}

function resolveTowerEditorSafeFootprint(flatData = {}) {
  const previewFootprint = resolveTowerPreviewFootprint(flatData);
  return {
    minXOffset: Math.min(TOWER_EDITOR_FOOTPRINT.minXOffset, previewFootprint.minXOffset),
    maxXOffset: Math.max(TOWER_EDITOR_FOOTPRINT.maxXOffset, previewFootprint.maxXOffset),
    minYOffset: Math.min(TOWER_EDITOR_FOOTPRINT.minYOffset, previewFootprint.minYOffset),
    maxYOffset: Math.max(TOWER_EDITOR_FOOTPRINT.maxYOffset, previewFootprint.maxYOffset)
  };
}

function buildTowerSafeRangeFromBounds(bounds, manualSafeRange = null, flatData = {}) {
  const safeFootprint = resolveTowerEditorSafeFootprint(flatData);
  const baseRange = {
    minX: roundTowerEditorCoordinate((bounds?.minX ?? 0) - safeFootprint.minXOffset),
    maxX: roundTowerEditorCoordinate((bounds?.maxX ?? TOWER_EDITOR_DEFAULTS.bedWidth) - safeFootprint.maxXOffset),
    minY: roundTowerEditorCoordinate((bounds?.minY ?? 0) - safeFootprint.minYOffset),
    maxY: roundTowerEditorCoordinate((bounds?.maxY ?? TOWER_EDITOR_DEFAULTS.bedDepth) - safeFootprint.maxYOffset)
  };

  return intersectTowerSafeRanges(baseRange, manualSafeRange);
}

function normalizeTowerDeadZone(zone) {
  if (!zone || typeof zone !== 'object') return null;

  const minX = toFiniteTowerNumber(zone.minX);
  const maxX = toFiniteTowerNumber(zone.maxX);
  const minY = toFiniteTowerNumber(zone.minY);
  const maxY = toFiniteTowerNumber(zone.maxY);

  if (minX == null || maxX == null || minY == null || maxY == null) {
    return null;
  }

  return {
    id: String(zone.id || ''),
    label: String(zone.label || zone.id || '禁区'),
    kind: String(zone.kind || 'safety'),
    minX: roundTowerEditorCoordinate(Math.min(minX, maxX)),
    maxX: roundTowerEditorCoordinate(Math.max(minX, maxX)),
    minY: roundTowerEditorCoordinate(Math.min(minY, maxY)),
    maxY: roundTowerEditorCoordinate(Math.max(minY, maxY))
  };
}

function clipTowerDeadZoneToRange(zone, safeRange) {
  if (!zone || !safeRange) return null;

  const minX = Math.max(zone.minX, safeRange.minX);
  const maxX = Math.min(zone.maxX, safeRange.maxX);
  const minY = Math.max(zone.minY, safeRange.minY);
  const maxY = Math.min(zone.maxY, safeRange.maxY);

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    ...zone,
    minX: roundTowerEditorCoordinate(minX),
    maxX: roundTowerEditorCoordinate(maxX),
    minY: roundTowerEditorCoordinate(minY),
    maxY: roundTowerEditorCoordinate(maxY)
  };
}

function resolveTowerDeadZoneSource(flatData = {}, printerProfile = null) {
  const printerId = getTowerEditorPrinterId(flatData);
  if (printerId === 'p1' || printerId === 'p1s' || printerId === 'x1') {
    return BAMBU_X1_P1_FRONT_DEAD_ZONES;
  }
  return printerProfile?.deadZones || [];
}

function resolveTowerDeadZonesFromFlatData(flatData = {}, safeRange) {
  const printerProfile = resolveTowerEditorPrinterProfile(flatData);
  return resolveTowerDeadZoneSource(flatData, printerProfile)
    .map((zone) => normalizeTowerDeadZone(zone))
    .map((zone) => clipTowerDeadZoneToRange(zone, safeRange))
    .filter(Boolean);
}

function getTowerEditorDeadZones(editor) {
  try {
    const payload = String(editor?.dataset?.towerDeadZones || '').trim();
    if (!payload) return [];
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed)
      ? parsed.map((zone) => normalizeTowerDeadZone(zone)).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

function isTowerPointInsideDeadZone(x, y, zone) {
  if (!zone) return false;
  return x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY;
}

function projectTowerPointOutOfDeadZone(x, y, zone, safeRange) {
  const candidates = [];
  const nextLeft = roundTowerEditorCoordinate(zone.minX - TOWER_DEAD_ZONE_CLEARANCE);
  const nextRight = roundTowerEditorCoordinate(zone.maxX + TOWER_DEAD_ZONE_CLEARANCE);
  const nextBottom = roundTowerEditorCoordinate(zone.minY - TOWER_DEAD_ZONE_CLEARANCE);
  const nextTop = roundTowerEditorCoordinate(zone.maxY + TOWER_DEAD_ZONE_CLEARANCE);

  if (nextLeft >= safeRange.minX) {
    candidates.push({ x: nextLeft, y, distance: Math.abs(x - nextLeft) });
  }

  if (nextRight <= safeRange.maxX) {
    candidates.push({ x: nextRight, y, distance: Math.abs(x - nextRight) });
  }

  if (nextBottom >= safeRange.minY) {
    candidates.push({ x, y: nextBottom, distance: Math.abs(y - nextBottom) });
  }

  if (nextTop <= safeRange.maxY) {
    candidates.push({ x, y: nextTop, distance: Math.abs(y - nextTop) });
  }

  if (!candidates.length) {
    return {
      x: clampTowerEditorValue(x, safeRange.minX, safeRange.maxX),
      y: clampTowerEditorValue(y, safeRange.minY, safeRange.maxY)
    };
  }

  candidates.sort((left, right) => left.distance - right.distance);
  return {
    x: roundTowerEditorCoordinate(candidates[0].x),
    y: roundTowerEditorCoordinate(candidates[0].y)
  };
}

function resolveTowerPlacementFromGeometry(rawX, rawY, safeRange, deadZones = [], boardStyle = 'default') {
  const normalizedRawX = roundTowerEditorCoordinate(toFiniteTowerNumber(rawX) ?? safeRange.minX);
  const normalizedRawY = roundTowerEditorCoordinate(toFiniteTowerNumber(rawY) ?? safeRange.minY);
  const initialX = snapTowerAnchorCoordinate(normalizedRawX, safeRange.minX, safeRange.maxX);
  const initialY = snapTowerAnchorCoordinate(normalizedRawY, safeRange.minY, safeRange.maxY);
  const blockedZoneIds = deadZones
    .filter((zone) => isTowerPointInsideDeadZone(initialX, initialY, zone))
    .map((zone) => zone.id);
  const blockedZoneIdSet = new Set(blockedZoneIds);

  let nextX = initialX;
  let nextY = initialY;
  let adjustedForDeadZone = false;

  for (let index = 0; index < deadZones.length * 4; index += 1) {
    const activeZone = deadZones.find((zone) => isTowerPointInsideDeadZone(nextX, nextY, zone));
    if (!activeZone) break;
    blockedZoneIdSet.add(activeZone.id);

    const projected = projectTowerPointOutOfDeadZone(nextX, nextY, activeZone, safeRange);
    if (!projected || (projected.x === nextX && projected.y === nextY)) {
      break;
    }

    nextX = snapTowerAnchorCoordinate(projected.x, safeRange.minX, safeRange.maxX);
    nextY = snapTowerAnchorCoordinate(projected.y, safeRange.minY, safeRange.maxY);
    adjustedForDeadZone = true;
  }

  return {
    rawX: normalizedRawX,
    rawY: normalizedRawY,
    x: roundTowerEditorCoordinate(nextX),
    y: roundTowerEditorCoordinate(nextY),
    adjusted: normalizedRawX !== roundTowerEditorCoordinate(nextX)
      || normalizedRawY !== roundTowerEditorCoordinate(nextY),
    adjustedForDeadZone,
    blockedZoneIds: Array.from(blockedZoneIdSet),
    safeRange,
    deadZones,
    boardStyle
  };
}

function resolveTowerPlacement(rawX, rawY, flatData = {}) {
  const bounds = resolveTowerEditorBounds(flatData);
  const printerProfile = resolveTowerEditorPrinterProfile(flatData);
  const safeRange = buildTowerSafeRangeFromBounds(bounds, printerProfile?.manualSafeRange || null, flatData);
  const deadZones = resolveTowerDeadZonesFromFlatData(flatData, safeRange);
  return resolveTowerPlacementFromGeometry(rawX, rawY, safeRange, deadZones, printerProfile?.boardStyle || 'default');
}

function getTowerEditorMetrics(flatData = {}) {
  const bounds = resolveTowerEditorBounds(flatData);
  const placement = resolveTowerPlacement(flatData['wiping.wiper_x'] ?? 0, flatData['wiping.wiper_y'] ?? 0, flatData);
  const previewFootprint = resolveTowerPreviewFootprint(flatData);
  return {
    bedMinX: bounds.minX,
    bedMinY: bounds.minY,
    bedMaxX: bounds.maxX,
    bedMaxY: bounds.maxY,
    bedWidth: roundTowerEditorCoordinate(bounds.maxX - bounds.minX),
    bedDepth: roundTowerEditorCoordinate(bounds.maxY - bounds.minY),
    towerWidth: previewFootprint.width,
    towerDepth: previewFootprint.depth,
    wiperX: placement.x,
    wiperY: placement.y,
    rawWiperX: placement.rawX,
    rawWiperY: placement.rawY,
    adjusted: placement.adjusted,
    boardStyle: placement.boardStyle,
    deadZones: placement.deadZones,
    blockedZoneIds: placement.blockedZoneIds,
    safeRange: placement.safeRange
  };
}

function clampTowerPreviewCoordinate(value, min, max) {
  return roundTowerEditorCoordinate(clampTowerEditorValue(value, min, max));
}

function buildTowerPreviewBounds(minX, maxX, minY, maxY, metrics) {
  return {
    minX: clampTowerPreviewCoordinate(minX, metrics.bedMinX, metrics.bedMaxX),
    maxX: clampTowerPreviewCoordinate(maxX, metrics.bedMinX, metrics.bedMaxX),
    minY: clampTowerPreviewCoordinate(minY, metrics.bedMinY, metrics.bedMaxY),
    maxY: clampTowerPreviewCoordinate(maxY, metrics.bedMinY, metrics.bedMaxY)
  };
}

function shiftTowerPreviewAxisIntoBounds(min, max, boundsMin, boundsMax) {
  let nextMin = roundTowerEditorCoordinate(Math.min(min, max));
  let nextMax = roundTowerEditorCoordinate(Math.max(min, max));

  if (!Number.isFinite(boundsMin) || !Number.isFinite(boundsMax) || boundsMax < boundsMin) {
    return { min: nextMin, max: nextMax };
  }

  const span = nextMax - nextMin;
  const boundsSpan = boundsMax - boundsMin;
  if (span > boundsSpan) {
    const center = roundTowerEditorCoordinate((boundsMin + boundsMax) / 2);
    const halfSpan = roundTowerEditorCoordinate(span / 2);
    return {
      min: roundTowerEditorCoordinate(center - halfSpan),
      max: roundTowerEditorCoordinate(center + halfSpan)
    };
  }

  if (nextMin < boundsMin) {
    const offset = boundsMin - nextMin;
    nextMin += offset;
    nextMax += offset;
  }

  if (nextMax > boundsMax) {
    const offset = nextMax - boundsMax;
    nextMin -= offset;
    nextMax -= offset;
  }

  return {
    min: roundTowerEditorCoordinate(nextMin),
    max: roundTowerEditorCoordinate(nextMax)
  };
}

function buildTowerPreviewVisualBounds(minX, maxX, minY, maxY, metrics = null) {
  const rawBounds = {
    minX: roundTowerEditorCoordinate(Math.min(minX, maxX)),
    maxX: roundTowerEditorCoordinate(Math.max(minX, maxX)),
    minY: roundTowerEditorCoordinate(Math.min(minY, maxY)),
    maxY: roundTowerEditorCoordinate(Math.max(minY, maxY))
  };

  if (!metrics) {
    return rawBounds;
  }

  const shiftedX = shiftTowerPreviewAxisIntoBounds(rawBounds.minX, rawBounds.maxX, metrics.bedMinX, metrics.bedMaxX);
  const shiftedY = shiftTowerPreviewAxisIntoBounds(rawBounds.minY, rawBounds.maxY, metrics.bedMinY, metrics.bedMaxY);

  return {
    minX: shiftedX.min,
    maxX: shiftedX.max,
    minY: shiftedY.min,
    maxY: shiftedY.max
  };
}

function normalizeTowerCanvasAxisPercent(normalized) {
  const safeNormalized = clampTowerEditorValue(normalized, 0, 1);
  const usablePercent = Math.max(0, 100 - (TOWER_CANVAS_EDGE_INSET_PERCENT * 2));
  return TOWER_CANVAS_EDGE_INSET_PERCENT + (safeNormalized * usablePercent);
}

function denormalizeTowerCanvasAxisPercent(percent) {
  const usablePercent = Math.max(0, 100 - (TOWER_CANVAS_EDGE_INSET_PERCENT * 2));
  if (usablePercent <= 0) return 0;
  return clampTowerEditorValue((percent - TOWER_CANVAS_EDGE_INSET_PERCENT) / usablePercent, 0, 1);
}

function getTowerCanvasLeftPercent(x, metrics) {
  if (metrics.bedWidth <= 0) return 0;
  return normalizeTowerCanvasAxisPercent((x - metrics.bedMinX) / metrics.bedWidth);
}

function getTowerCanvasTopPercent(y, metrics) {
  if (metrics.bedDepth <= 0) return 0;
  return normalizeTowerCanvasAxisPercent(1 - ((y - metrics.bedMinY) / metrics.bedDepth));
}

function getTowerCanvasRectPercent(bounds, metrics) {
  const usablePercent = Math.max(0, 100 - (TOWER_CANVAS_EDGE_INSET_PERCENT * 2));
  return {
    left: getTowerCanvasLeftPercent(bounds.minX, metrics),
    top: getTowerCanvasTopPercent(bounds.maxY, metrics),
    width: metrics.bedWidth > 0 ? ((bounds.maxX - bounds.minX) / metrics.bedWidth) * usablePercent : 0,
    height: metrics.bedDepth > 0 ? ((bounds.maxY - bounds.minY) / metrics.bedDepth) * usablePercent : 0
  };
}

function snapTowerAnchorCoordinate(value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const numeric = toFiniteTowerNumber(value);
  if (numeric == null) {
    return Number.isFinite(min) ? roundTowerEditorCoordinate(min) : 0;
  }
  return roundTowerEditorCoordinate(clampTowerEditorValue(Math.round(numeric), min, max));
}

function getTowerPreviewOverrideNumber(flatData = {}, keys = [], fallback = null) {
  for (const key of keys) {
    const numeric = toFiniteTowerNumber(flatData[key]);
    if (numeric != null && numeric >= 0) {
      return numeric;
    }
  }
  return fallback;
}

function formatTowerEditorMeasure(value) {
  const numeric = toFiniteTowerNumber(value);
  if (numeric == null) return '--';
  return Number.isInteger(numeric) ? String(numeric) : String(roundTowerEditorCoordinate(numeric));
}

function resolveTowerGeometryState(flatData = {}) {
  const coreWidth = Math.max(20, getTowerPreviewOverrideNumber(flatData, [
    'wiping.tower_preview_width',
    'wiping.towerPreviewWidth',
    'wiping.tower_width',
    'wiping.towerWidth'
  ], TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.width));
  const coreDepth = Math.max(20, getTowerPreviewOverrideNumber(flatData, [
    'wiping.tower_preview_depth',
    'wiping.towerPreviewDepth',
    'wiping.tower_depth',
    'wiping.towerDepth'
  ], TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.depth));
  const brimWidth = Math.max(0, getTowerPreviewOverrideNumber(flatData, [
    'wiping.tower_preview_expansion',
    'wiping.towerPreviewExpansion',
    'wiping.tower_brim_width',
    'wiping.towerBrimWidth'
  ], 0));
  const outerWallWidth = Math.max(0, getTowerPreviewOverrideNumber(flatData, [
    'wiping.tower_outer_wall_width',
    'wiping.towerOuterWallWidth'
  ], 0));
  const outerWallDepth = Math.max(0, getTowerPreviewOverrideNumber(flatData, [
    'wiping.tower_outer_wall_depth',
    'wiping.towerOuterWallDepth'
  ], outerWallWidth));
  const slantedOuterWallEnabled = getTowerGeometryBooleanValue(
    flatData,
    'wiping.tower_slanted_outer_wall_enabled',
    'wiping.towerSlantedOuterWallEnabled',
    'wiping.tower_slanted_outer_wall_width',
    'wiping.tower_slanted_outer_wall_depth'
  );
  const slantedOuterWallWidth = slantedOuterWallEnabled
    ? Math.max(0, getTowerPreviewOverrideNumber(flatData, [
      'wiping.tower_slanted_outer_wall_width',
      'wiping.towerSlantedOuterWallWidth'
    ], 0))
    : 0;
  const slantedOuterWallDepth = slantedOuterWallEnabled
    ? Math.max(0, getTowerPreviewOverrideNumber(flatData, [
      'wiping.tower_slanted_outer_wall_depth',
      'wiping.towerSlantedOuterWallDepth'
    ], slantedOuterWallWidth))
    : 0;
  const layerWidth = coreWidth + ((outerWallWidth + slantedOuterWallWidth) * 2);
  const layerDepth = coreDepth + ((outerWallDepth + slantedOuterWallDepth) * 2);
  const baseWidth = layerWidth + (brimWidth * 2);
  const baseDepth = layerDepth + (brimWidth * 2);

  return {
    coreWidth: roundTowerEditorCoordinate(coreWidth),
    coreDepth: roundTowerEditorCoordinate(coreDepth),
    brimWidth: roundTowerEditorCoordinate(brimWidth),
    outerWallWidth: roundTowerEditorCoordinate(outerWallWidth),
    outerWallDepth: roundTowerEditorCoordinate(outerWallDepth),
    slantedOuterWallEnabled,
    slantedOuterWallWidth: roundTowerEditorCoordinate(slantedOuterWallWidth),
    slantedOuterWallDepth: roundTowerEditorCoordinate(slantedOuterWallDepth),
    layerWidth: roundTowerEditorCoordinate(layerWidth),
    layerDepth: roundTowerEditorCoordinate(layerDepth),
    baseWidth: roundTowerEditorCoordinate(baseWidth),
    baseDepth: roundTowerEditorCoordinate(baseDepth)
  };
}

function resolveTowerPreviewFootprint(flatData = {}) {
  const geometry = resolveTowerGeometryState(flatData);
  const width = geometry.baseWidth;
  const depth = geometry.baseDepth;
  const displayWidth = Math.max(
    roundTowerEditorCoordinate(width * TOWER_EDITOR_VISUAL_SCALE),
    TOWER_EDITOR_VISUAL_MIN_SIZE
  );
  const displayDepth = Math.max(
    roundTowerEditorCoordinate(depth * TOWER_EDITOR_VISUAL_SCALE),
    TOWER_EDITOR_VISUAL_MIN_SIZE
  );
  return {
    ...geometry,
    width: roundTowerEditorCoordinate(width),
    depth: roundTowerEditorCoordinate(depth),
    displayWidth: roundTowerEditorCoordinate(displayWidth),
    displayDepth: roundTowerEditorCoordinate(displayDepth),
    minXOffset: roundTowerEditorCoordinate(0),
    maxXOffset: roundTowerEditorCoordinate(width),
    minYOffset: roundTowerEditorCoordinate(0),
    maxYOffset: roundTowerEditorCoordinate(depth),
    displayMinXOffset: roundTowerEditorCoordinate(0),
    displayMaxXOffset: roundTowerEditorCoordinate(displayWidth),
    displayMinYOffset: roundTowerEditorCoordinate(0),
    displayMaxYOffset: roundTowerEditorCoordinate(displayDepth)
  };
}

function getTowerPreviewFootprintFromEditor(editor) {
  try {
    const payload = String(editor?.dataset?.towerFootprintGeometry || '').trim();
    if (!payload) {
      return resolveTowerPreviewFootprint({});
    }
    const parsed = JSON.parse(payload);
    const defaultDisplayWidth = Math.max(TOWER_EDITOR_VISUAL_MIN_SIZE, TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.width * TOWER_EDITOR_VISUAL_SCALE);
    const defaultDisplayDepth = Math.max(TOWER_EDITOR_VISUAL_MIN_SIZE, TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.depth * TOWER_EDITOR_VISUAL_SCALE);
    return {
      width: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.width) ?? TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.width),
      depth: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.depth) ?? TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.depth),
      displayWidth: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayWidth) ?? defaultDisplayWidth),
      displayDepth: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayDepth) ?? defaultDisplayDepth),
      minXOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.minXOffset) ?? 0),
      maxXOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.maxXOffset) ?? (toFiniteTowerNumber(parsed.width) ?? TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.width)),
      minYOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.minYOffset) ?? 0),
      maxYOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.maxYOffset) ?? (toFiniteTowerNumber(parsed.depth) ?? TOWER_EDITOR_VISUAL_FOOTPRINT_DEFAULTS.depth)),
      displayMinXOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayMinXOffset) ?? 0),
      displayMaxXOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayMaxXOffset) ?? defaultDisplayWidth),
      displayMinYOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayMinYOffset) ?? 0),
      displayMaxYOffset: roundTowerEditorCoordinate(toFiniteTowerNumber(parsed.displayMaxYOffset) ?? defaultDisplayDepth)
    };
  } catch (_error) {
    return resolveTowerPreviewFootprint({});
  }
}

function getTowerPreviewCenterOffset(footprint, axis = 'x') {
  if (axis === 'y') {
    const minOffset = toFiniteTowerNumber(footprint?.displayMinYOffset ?? footprint?.minYOffset) ?? 0;
    const maxOffset = toFiniteTowerNumber(footprint?.displayMaxYOffset ?? footprint?.maxYOffset) ?? 0;
    return roundTowerEditorCoordinate((minOffset + maxOffset) / 2);
  }

  const minOffset = toFiniteTowerNumber(footprint?.displayMinXOffset ?? footprint?.minXOffset) ?? 0;
  const maxOffset = toFiniteTowerNumber(footprint?.displayMaxXOffset ?? footprint?.maxXOffset) ?? 0;
  return roundTowerEditorCoordinate((minOffset + maxOffset) / 2);
}

function getTowerDeadZoneRenderPriority(zone) {
  return zone?.kind === 'safety' ? 1 : 0;
}

function clampTowerEditorValue(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return Number.isFinite(min) ? min : 0;
  if (max < min) return min;
  return Math.max(min, Math.min(max, numeric));
}

function getTowerEditorSafeRange(editor) {
  const minX = Number(editor?.dataset?.towerMinX || TOWER_EDITOR_DEFAULTS.safeMinX);
  const minY = Number(editor?.dataset?.towerMinY || TOWER_EDITOR_DEFAULTS.safeMinY);
  const maxX = Number(editor?.dataset?.towerMaxX || Math.max(minX, TOWER_EDITOR_DEFAULTS.bedWidth - TOWER_EDITOR_DEFAULTS.safeMaxXOffset));
  const maxY = Number(editor?.dataset?.towerMaxY || Math.max(minY, TOWER_EDITOR_DEFAULTS.bedDepth - TOWER_EDITOR_DEFAULTS.safeMaxYOffset));

  return { minX, maxX, minY, maxY };
}

function getTowerEditorAxisRange(editor, axis = 'x') {
  const range = getTowerEditorSafeRange(editor);
  if (axis === 'y') {
    return { min: range.minY, max: range.maxY };
  }
  return { min: range.minX, max: range.maxX };
}

function getTowerCoordinateEditorInput(editor, axis = 'x') {
  return editor?.querySelector(`[data-tower-coordinate-input="${axis}"]`) || null;
}

function syncTowerCoordinateDisplayField(field, value) {
  if (!field) return;
  const nextValue = String(value ?? '');
  if ('value' in field) {
    field.value = nextValue;
    return;
  }
  field.textContent = nextValue;
}

function setTowerEditorFeedback(editor, message = '', options = {}) {
  if (!editor) return;

  const axis = options.axis === 'x' || options.axis === 'y' ? options.axis : '';
  const tone = options.tone || 'warning';
  const feedback = editor.querySelector('[data-tower-feedback]');
  const xInput = getTowerCoordinateEditorInput(editor, 'x');
  const yInput = getTowerCoordinateEditorInput(editor, 'y');

  [xInput, yInput].forEach((input) => {
    if (!input) return;
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });

  const invalidInput = axis === 'x' ? xInput : axis === 'y' ? yInput : null;
  if (message && invalidInput) {
    invalidInput.classList.add('is-invalid');
    invalidInput.setAttribute('aria-invalid', 'true');
  }

  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle('is-visible', !!message);
  if (message) {
    feedback.dataset.tone = tone;
  } else {
    delete feedback.dataset.tone;
  }
}

function sanitizeTowerCoordinateInputValue(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return null;

  const normalized = rawValue.replace(/,/g, '.');
  const integerMatch = normalized.match(/^-?\d+/);
  if (integerMatch) {
    return Number.parseInt(integerMatch[0], 10);
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric < 0 ? Math.ceil(numeric) : Math.floor(numeric);
}

function buildTowerDragTooltipHtml(placement) {
  return `
    <div class="tower-drag-tooltip">
      <div class="tower-drag-tooltip-title">\u5750\u6807</div>
      <div class="tower-drag-tooltip-value">X${escapeParamHtml(placement?.x ?? '--')} \u00b7 Y${escapeParamHtml(placement?.y ?? '--')}</div>
    </div>
  `;
}

function showTowerDragTooltip(editor, placement) {
  const footprint = editor?.querySelector('[data-tower-footprint]');
  if (!footprint || typeof window.showFloatingTooltip !== 'function') {
    return;
  }

  footprint.dataset.tooltipHtml = buildTowerDragTooltipHtml(placement);
  window.showFloatingTooltip?.(footprint);
}

function hideTowerDragTooltip(editor, options = {}) {
  const footprint = editor?.querySelector('[data-tower-footprint]');
  if (footprint) {
    delete footprint.dataset.tooltipHtml;
  }
  window.hideFloatingTooltip?.(options);
}

function applyTowerCoordinateInput(editor, axis, rawValue) {
  if (!editor) return null;

  const input = getTowerCoordinateEditorInput(editor, axis);
  const parsed = sanitizeTowerCoordinateInputValue(rawValue);
  const currentX = Number(editor.dataset.towerX || 0);
  const currentY = Number(editor.dataset.towerY || 0);

  if (parsed == null) {
    syncTowerCoordinateDisplayField(input, axis === 'y' ? currentY : currentX);
    setTowerEditorFeedback(editor, '');
    return null;
  }

  const range = getTowerEditorAxisRange(editor, axis);
  const clamped = snapTowerAnchorCoordinate(parsed, range.min, range.max);
  const placement = axis === 'y'
    ? writeTowerPositionEditorValue(editor, currentX, clamped)
    : writeTowerPositionEditorValue(editor, clamped, currentY);

  if (parsed < range.min || parsed > range.max) {
    setTowerEditorFeedback(editor, `\u8BF7\u8F93\u5165 ${range.min}-${range.max} \u533A\u95F4\u7684\u6570\u3002`, { axis, tone: 'warning' });
    return placement;
  }

  if (placement?.adjustedForDeadZone) {
    setTowerEditorFeedback(editor, '\u5F53\u524D\u4F4D\u7F6E\u5728\u7981\u533A\u5185\uff0c\u5DF2\u81EA\u52A8\u79FB\u5230\u5B89\u5168\u70B9\u3002', { tone: 'warning' });
    return placement;
  }

  setTowerEditorFeedback(editor, '');
  return placement;
}

function resolveTowerEditorPlacement(editor, nextX, nextY) {
  const range = getTowerEditorSafeRange(editor);
  const deadZones = getTowerEditorDeadZones(editor);
  const boardStyle = String(editor?.dataset?.towerBoardStyle || 'default');
  return resolveTowerPlacementFromGeometry(nextX, nextY, range, deadZones, boardStyle);
}

function buildTowerPositionDisclosure(flatData) {
  const metrics = getTowerEditorMetrics(flatData);
  const range = metrics.safeRange;
  const clampedWiperX = clampTowerEditorValue(metrics.wiperX, range.minX, range.maxX);
  const clampedWiperY = clampTowerEditorValue(metrics.wiperY, range.minY, range.maxY);
  const previewFootprint = resolveTowerPreviewFootprint(flatData);
  const footprintBounds = buildTowerPreviewVisualBounds(
    clampedWiperX + previewFootprint.displayMinXOffset,
    clampedWiperX + previewFootprint.displayMaxXOffset,
    clampedWiperY + previewFootprint.displayMinYOffset,
    clampedWiperY + previewFootprint.displayMaxYOffset,
    metrics
  );
  const footprintStyle = getTowerCanvasRectPercent(footprintBounds, metrics);
  const visualDeadZones = [...metrics.deadZones].sort((left, right) => getTowerDeadZoneRenderPriority(left) - getTowerDeadZoneRenderPriority(right));
  const deadZoneMarkup = visualDeadZones.map((zone) => {
    const zoneStyle = getTowerCanvasRectPercent(zone, metrics);
    const canRenderZoneLabel = zoneStyle.width >= 14 && zoneStyle.height >= 10;
    return `
      <div
        class="tower-dead-zone tower-dead-zone--${escapeParamHtml(zone.kind || 'safety')}"
        style="left:${zoneStyle.left}%;top:${zoneStyle.top}%;width:${zoneStyle.width}%;height:${zoneStyle.height}%"
        title="${escapeParamHtml(zone.label)}"
      >
        ${canRenderZoneLabel ? `<span class="tower-dead-zone-label">${escapeParamHtml(zone.label)}</span>` : ''}
      </div>
    `;
  }).join('');
  const legendMarkup = metrics.deadZones.map((zone) => `
    <div class="tower-position-chip tower-position-chip--legend">
      <span class="tower-legend-swatch tower-legend-swatch--${escapeParamHtml(zone.kind || 'safety')}"></span>
      ${escapeParamHtml(zone.label)}
    </div>
  `).join('');
  // Legacy smoke marker: <span class="tower-footprint-label">濉?/span>
  const adjustmentChip = metrics.adjusted
    ? '<div class="tower-position-chip tower-position-chip--warning">已自动修正到安全落点</div>'
    : '';

  return {
    id: 'tower-position',
    title: '擦料塔位置预览',
    desc: '底部展开后可以直接拖动擦料塔，X / Y 表示蓝色方块左下角坐标，并会同步回写到上面的参数框。',
    badge: metrics.boardStyle === 'bambu-x1' ? 'P1 / X1 安全限制' : '实验中',
    content: `
      <div class="params-disclosure-note">
        红色区域表示不能放置擦料塔，虚线框表示当前允许的安全落点范围，蓝色方块按左下角坐标显示真实占地。
      </div>
      <div
        class="tower-position-editor"
        data-tower-editor
        data-tower-x="${escapeParamHtml(clampedWiperX)}"
        data-tower-y="${escapeParamHtml(clampedWiperY)}"
        data-bed-min-x="${metrics.bedMinX}"
        data-bed-min-y="${metrics.bedMinY}"
        data-bed-width="${metrics.bedWidth}"
        data-bed-depth="${metrics.bedDepth}"
        data-tower-min-x="${range.minX}"
        data-tower-max-x="${range.maxX}"
        data-tower-min-y="${range.minY}"
        data-tower-max-y="${range.maxY}"
        data-tower-width="${metrics.towerWidth}"
        data-tower-depth="${metrics.towerDepth}"
        data-tower-x-input="wiping.wiper_x"
        data-tower-y-input="wiping.wiper_y"
        data-tower-board-style="${escapeParamHtml(metrics.boardStyle)}"
        data-tower-dead-zones="${escapeParamHtml(JSON.stringify(metrics.deadZones))}"
        data-tower-footprint-geometry="${escapeParamHtml(JSON.stringify(previewFootprint))}"
      >
        <div class="tower-position-toolbar">
          <label class="tower-position-coordinate">
            <span class="tower-position-coordinate-label">X</span>
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              class="tower-position-coordinate-input"
              data-tower-coordinate-input="x"
              data-tower-x-label
              value="${escapeParamHtml(clampedWiperX)}"
              aria-label="Tower X coordinate"
            >
          </label>
          <label class="tower-position-coordinate">
            <span class="tower-position-coordinate-label">Y</span>
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              class="tower-position-coordinate-input"
              data-tower-coordinate-input="y"
              data-tower-y-label
              value="${escapeParamHtml(clampedWiperY)}"
              aria-label="Tower Y coordinate"
            >
          </label>
          <div class="tower-position-chip">Bed ${metrics.bedWidth} x ${metrics.bedDepth}</div>
          <div class="tower-position-chip">Tower ${escapeParamHtml(formatTowerEditorMeasure(previewFootprint.width))} x ${escapeParamHtml(formatTowerEditorMeasure(previewFootprint.depth))}</div>
          ${adjustmentChip}
        </div>
        <div class="tower-position-feedback" data-tower-feedback aria-live="polite"></div>
        <div class="tower-position-legend">
          ${legendMarkup}
        </div>
        <div class="tower-position-canvas" data-tower-canvas>
          <div class="tower-bed-grid" aria-hidden="true"></div>
          ${deadZoneMarkup}
          <div
            class="tower-footprint"
            data-tower-footprint
            data-tower-handle
            data-tooltip-anchor-align="center"
            style="left:${footprintStyle.left}%;top:${footprintStyle.top}%;width:${footprintStyle.width}%;height:${footprintStyle.height}%"
            aria-label="擦料塔占地"
            title="拖动以调整擦料塔位置"
          >
            <span class="tower-footprint-label">塔</span>
          </div>
          <div class="tower-bed-origin">${metrics.bedMinX},${metrics.bedMinY}</div>
          <div class="tower-bed-corner">${metrics.bedMaxX},${metrics.bedMaxY}</div>
        </div>
      </div>
    `
  };
}

function updateTowerPositionEditor(editor) {
  if (!editor) return;
  const handle = editor.querySelector('[data-tower-handle]');
  const footprint = editor.querySelector('[data-tower-footprint]');
  const xLabel = editor.querySelector('[data-tower-x-label]');
  const yLabel = editor.querySelector('[data-tower-y-label]');
  if (!handle) return;

  const bedMinX = Number(editor.dataset.bedMinX || 0);
  const bedMinY = Number(editor.dataset.bedMinY || 0);
  const bedWidth = Number(editor.dataset.bedWidth || TOWER_EDITOR_DEFAULTS.bedWidth);
  const bedDepth = Number(editor.dataset.bedDepth || TOWER_EDITOR_DEFAULTS.bedDepth);
  const placement = resolveTowerEditorPlacement(editor, editor.dataset.towerX, editor.dataset.towerY);
  const metrics = {
    bedMinX,
    bedMinY,
    bedMaxX: bedMinX + bedWidth,
    bedMaxY: bedMinY + bedDepth,
    bedWidth,
    bedDepth
  };
  const previewFootprint = getTowerPreviewFootprintFromEditor(editor);

  editor.dataset.towerX = String(roundTowerEditorCoordinate(placement.x));
  editor.dataset.towerY = String(roundTowerEditorCoordinate(placement.y));
  if (handle && handle !== footprint) {
    const left = getTowerCanvasLeftPercent(placement.x, metrics);
    const top = getTowerCanvasTopPercent(placement.y, metrics);
    handle.style.left = `${left}%`;
    handle.style.top = `${top}%`;
  }
  if (footprint) {
    const footprintBounds = buildTowerPreviewVisualBounds(
      placement.x + previewFootprint.displayMinXOffset,
      placement.x + previewFootprint.displayMaxXOffset,
      placement.y + previewFootprint.displayMinYOffset,
      placement.y + previewFootprint.displayMaxYOffset,
      metrics
    );
    const footprintStyle = getTowerCanvasRectPercent(footprintBounds, metrics);
    footprint.style.left = `${footprintStyle.left}%`;
    footprint.style.top = `${footprintStyle.top}%`;
    footprint.style.width = `${footprintStyle.width}%`;
    footprint.style.height = `${footprintStyle.height}%`;
  }
  syncTowerCoordinateDisplayField(xLabel, editor.dataset.towerX);
  syncTowerCoordinateDisplayField(yLabel, editor.dataset.towerY);
}

function syncTowerPositionEditorsFromInputs() {
  document.querySelectorAll('[data-tower-editor]').forEach((editor) => {
    const xKey = editor.dataset.towerXInput || 'wiping.wiper_x';
    const yKey = editor.dataset.towerYInput || 'wiping.wiper_y';
    const xInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(xKey)}"]`);
    const yInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(yKey)}"]`);
    const placement = resolveTowerEditorPlacement(
      editor,
      xInput?.value ?? editor.dataset.towerX ?? 0,
      yInput?.value ?? editor.dataset.towerY ?? 0
    );
    editor.dataset.towerX = String(placement.x);
    editor.dataset.towerY = String(placement.y);
    updateTowerPositionEditor(editor);
    setTowerEditorFeedback(editor, '');
  });
}

function writeTowerPositionEditorValue(editor, nextX, nextY) {
  if (!editor) return;

  const xKey = editor.dataset.towerXInput || 'wiping.wiper_x';
  const yKey = editor.dataset.towerYInput || 'wiping.wiper_y';
  const xInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(xKey)}"]`);
  const yInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(yKey)}"]`);
  const placement = resolveTowerEditorPlacement(editor, nextX, nextY);
  const xValue = placement.x;
  const yValue = placement.y;

  editor.dataset.towerX = String(xValue);
  editor.dataset.towerY = String(yValue);

  if (xInput) {
    xInput.value = String(xValue);
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (yInput) {
    yInput.value = String(yValue);
    yInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  updateTowerPositionEditor(editor);
  return placement;
}

function updateTowerPositionFromPointer(editor, clientX, clientY) {
  const canvas = editor?.querySelector('[data-tower-canvas]');
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const bedMinX = Number(editor.dataset.bedMinX || 0);
  const bedMinY = Number(editor.dataset.bedMinY || 0);
  const bedWidth = Number(editor.dataset.bedWidth || TOWER_EDITOR_DEFAULTS.bedWidth);
  const bedDepth = Number(editor.dataset.bedDepth || TOWER_EDITOR_DEFAULTS.bedDepth);
  const previewFootprint = getTowerPreviewFootprintFromEditor(editor);
  const centerOffsetX = getTowerPreviewCenterOffset(previewFootprint, 'x');
  const centerOffsetY = getTowerPreviewCenterOffset(previewFootprint, 'y');
  const percentLeft = ((clientX - rect.left) / rect.width) * 100;
  const percentTop = ((clientY - rect.top) / rect.height) * 100;
  const normalizedLeft = denormalizeTowerCanvasAxisPercent(percentLeft);
  const normalizedTop = denormalizeTowerCanvasAxisPercent(percentTop);
  const nextCenterX = bedMinX + (normalizedLeft * bedWidth);
  const nextCenterY = bedMinY + ((1 - normalizedTop) * bedDepth);
  const nextX = snapTowerAnchorCoordinate(nextCenterX - centerOffsetX);
  const nextY = snapTowerAnchorCoordinate(nextCenterY - centerOffsetY);
  return writeTowerPositionEditorValue(editor, nextX, nextY);
}

function buildParamNumericConstraints(flatData = {}) {
  const towerMetrics = getTowerEditorMetrics(flatData);
  const maxTowerBody = Math.max(20, Math.floor(Math.min(towerMetrics.bedWidth, towerMetrics.bedDepth) * 0.45));
  const maxTowerExpansion = Math.max(0, Math.floor(Math.min(towerMetrics.bedWidth, towerMetrics.bedDepth) * 0.12));
  return {
    'wiping.wiper_x': {
      min: towerMetrics.safeRange.minX,
      max: towerMetrics.safeRange.maxX,
      integer: true
    },
    'wiping.wiper_y': {
      min: towerMetrics.safeRange.minY,
      max: towerMetrics.safeRange.maxY,
      integer: true
    },
    'wiping.tower_width': {
      min: 20,
      max: maxTowerBody,
      integer: false
    },
    'wiping.tower_depth': {
      min: 20,
      max: maxTowerBody,
      integer: false
    },
    'wiping.tower_brim_width': {
      min: 0,
      max: maxTowerExpansion,
      integer: false
    },
    'wiping.tower_outer_wall_width': {
      min: 0,
      max: maxTowerExpansion,
      integer: false
    },
    'wiping.tower_outer_wall_depth': {
      min: 0,
      max: maxTowerExpansion,
      integer: false
    },
    'wiping.tower_slanted_outer_wall_width': {
      min: 0,
      max: maxTowerExpansion,
      integer: false
    },
    'wiping.tower_slanted_outer_wall_depth': {
      min: 0,
      max: maxTowerExpansion,
      integer: false
    }
  };
}

function applyNumericConstraintAttributes(input, numericConstraint) {
  if (!input || input.type !== 'number' || !numericConstraint) return;
  input.min = String(numericConstraint.min);
  input.max = String(numericConstraint.max);
  input.step = numericConstraint.integer ? '1' : 'any';
}

function refreshTowerPositionDisclosureFromDom() {
  const existingDisclosure = document.querySelector('[data-disclosure-id="tower-position"]');
  if (!existingDisclosure) return;

  const store = getActiveParamStore();
  const flatState = collectParamFullStateFromDom(store);
  const renderState = buildRenderableParamState(flatState);
  activeParamNumericConstraints = buildParamNumericConstraints(renderState.flat);

  const xInput = document.querySelector('.dynamic-param-input[data-json-key="wiping.wiper_x"]');
  const yInput = document.querySelector('.dynamic-param-input[data-json-key="wiping.wiper_y"]');
  const xConstraint = activeParamNumericConstraints['wiping.wiper_x'];
  const yConstraint = activeParamNumericConstraints['wiping.wiper_y'];
  const wasOpen = existingDisclosure.open;

  if (xInput) {
    applyNumericConstraintAttributes(xInput, xConstraint);
    xInput.value = String(renderState.flat['wiping.wiper_x']);
  }

  if (yInput) {
    applyNumericConstraintAttributes(yInput, yConstraint);
    yInput.value = String(renderState.flat['wiping.wiper_y']);
  }

  existingDisclosure.outerHTML = renderCompactParamToolDisclosure(buildTowerPositionDisclosure(renderState.flat), { title: '位置预览', desc: '' });
  const nextDisclosure = document.querySelector('[data-disclosure-id="tower-position"]');
  if (nextDisclosure) {
    nextDisclosure.open = wasOpen;
  }
  initTowerPositionEditors();
}

function normalizeTowerInputValue(input, numeric) {
  const key = input?.getAttribute?.('data-json-key');
  if (key !== 'wiping.wiper_x' && key !== 'wiping.wiper_y') {
    return null;
  }

  const editor = document.querySelector('[data-tower-editor]');
  if (!editor) {
    return null;
  }

  const xKey = editor.dataset.towerXInput || 'wiping.wiper_x';
  const yKey = editor.dataset.towerYInput || 'wiping.wiper_y';
  const xInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(xKey)}"]`);
  const yInput = document.querySelector(`.dynamic-param-input[data-json-key="${CSS.escape(yKey)}"]`);
  const rawX = key === xKey ? numeric : (xInput?.value ?? editor.dataset.towerX ?? 0);
  const rawY = key === yKey ? numeric : (yInput?.value ?? editor.dataset.towerY ?? 0);
  const placement = resolveTowerEditorPlacement(editor, rawX, rawY);

  if (xInput) {
    xInput.value = String(placement.x);
  }

  if (yInput) {
    yInput.value = String(placement.y);
  }

  editor.dataset.towerX = String(placement.x);
  editor.dataset.towerY = String(placement.y);

  return {
    placement,
    changed: snapTowerAnchorCoordinate(toFiniteTowerNumber(rawX) ?? 0) !== placement.x
      || snapTowerAnchorCoordinate(toFiniteTowerNumber(rawY) ?? 0) !== placement.y
  };
}

function normalizeNumericInputElement(input) {
  if (!input || input.type !== 'number') return false;

  const rawValue = String(input.value ?? '').trim();
  if (!rawValue) return false;

  const towerNumeric = sanitizeTowerCoordinateInputValue(rawValue);
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return false;

  const normalizedTower = normalizeTowerInputValue(input, towerNumeric ?? numeric);
  if (normalizedTower) {
    updateTowerPositionEditor(document.querySelector('[data-tower-editor]'));
    return normalizedTower.changed;
  }

  const min = input.min !== '' ? Number(input.min) : Number.NEGATIVE_INFINITY;
  const max = input.max !== '' ? Number(input.max) : Number.POSITIVE_INFINITY;
  const nextValue = clampTowerEditorValue(numeric, min, max);
  if (nextValue === numeric) {
    return false;
  }

  input.value = String(roundTowerEditorCoordinate(nextValue));
  return true;
}

function initTowerPositionEditors() {
  document.querySelectorAll('[data-tower-editor]').forEach((editor) => {
    if (editor.dataset.towerEditorBound === 'true') {
      updateTowerPositionEditor(editor);
      return;
    }

    editor.dataset.towerEditorBound = 'true';
    const canvas = editor.querySelector('[data-tower-canvas]');
    const handle = editor.querySelector('[data-tower-handle]');
    const xInput = getTowerCoordinateEditorInput(editor, 'x');
    const yInput = getTowerCoordinateEditorInput(editor, 'y');
    if (!canvas || !handle) return;

    const startDrag = (event) => {
      if (typeof event.button === 'number' && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const initialPlacement = updateTowerPositionFromPointer(editor, event.clientX, event.clientY);
      if (initialPlacement) {
        setTowerEditorFeedback(editor, initialPlacement.adjustedForDeadZone ? '\u5F53\u524D\u4F4D\u7F6E\u5728\u7981\u533A\u5185\uff0c\u5DF2\u81EA\u52A8\u79FB\u5230\u5B89\u5168\u70B9\u3002' : '');
        showTowerDragTooltip(editor, initialPlacement);
      }

      const move = (moveEvent) => {
        const nextPlacement = updateTowerPositionFromPointer(editor, moveEvent.clientX, moveEvent.clientY);
        if (nextPlacement) {
          setTowerEditorFeedback(editor, nextPlacement.adjustedForDeadZone ? '\u5F53\u524D\u4F4D\u7F6E\u5728\u7981\u533A\u5185\uff0c\u5DF2\u81EA\u52A8\u79FB\u5230\u5B89\u5168\u70B9\u3002' : '');
          showTowerDragTooltip(editor, nextPlacement);
        }
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        hideTowerDragTooltip(editor, { immediate: true });
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    };

    canvas.addEventListener('pointerdown', startDrag);
    handle.addEventListener('pointerdown', startDrag);

    [xInput, yInput].forEach((input) => {
      if (!input) return;

      input.addEventListener('input', () => {
        applyTowerCoordinateInput(editor, input.dataset.towerCoordinateInput || 'x', input.value);
      });

      input.addEventListener('blur', () => {
        if (!String(input.value ?? '').trim()) {
          syncTowerCoordinateDisplayField(
            input,
            input.dataset.towerCoordinateInput === 'y' ? editor.dataset.towerY : editor.dataset.towerX
          );
          setTowerEditorFeedback(editor, '');
          return;
        }
        applyTowerCoordinateInput(editor, input.dataset.towerCoordinateInput || 'x', input.value);
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        }
      });
    });

    updateTowerPositionEditor(editor);
  });
}

function buildDiagnosticsDisclosure(flatData, presetPath, fileName) {
  const payload = buildDiagnosticsPayload(flatData, presetPath, fileName);
  const metrics = [
    { label: '字段总数', value: String(payload.source.fieldCount) },
    { label: '挂载脚本', value: `${payload.toolhead.customMountGcodeLines} 行` },
    { label: '收起脚本', value: `${payload.toolhead.customUnmountGcodeLines} 行` },
    { label: '模板行数', value: `${payload.templates.wipingGcode.length} / ${payload.templates.towerBaseLayerGcode.length}` }
  ];

  return {
    id: 'diagnostics',
    title: '诊断 / 解析结果',
    desc: '快速查看当前 preset 被参数页和 JS engine 读取后的关键结果，方便排查字段或模板是否生效。',
    badge: '只读',
    content: `
      <div class="params-disclosure-note">
        这里展示的是当前页面解析后的摘要和 JSON 预览，不会直接修改文件内容。
      </div>
      <div class="params-diagnostics-grid">
        ${metrics.map((item) => `
          <div class="params-diagnostic-card">
            <div class="params-diagnostic-label">${escapeParamHtml(item.label)}</div>
            <div class="params-diagnostic-value">${escapeParamHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
      <pre class="params-diagnostics-code"><code>${escapeParamHtml(JSON.stringify(payload, null, 2))}</code></pre>
    `
  };
}

function renumberGcodeRows(editor) {
  Array.from(editor.querySelectorAll('.gcode-line-row')).forEach((row, index) => {
    row.dataset.lineIndex = String(index);
    const number = row.querySelector('.gcode-line-number');
    const kind = row.querySelector('.gcode-line-kind');
    const input = row.querySelector('[data-gcode-line]');
    if (number) number.textContent = String(index + 1);
    if (kind && input) kind.textContent = getGcodeLineHint(input.value);
  });
}

function getStructuredLines(editor) {
  return Array.from(editor.querySelectorAll('[data-gcode-line]')).map((input) => input.value);
}

function syncStructuredToRaw(cardShell) {
  const rawInput = cardShell.querySelector('[data-gcode-raw]');
  const editor = cardShell.querySelector('[data-gcode-structured]');
  if (!rawInput || !editor) return;
  rawInput.value = getStructuredLines(editor).join('\n');
}

function getDefaultGcodeSelection() {
  return { lineIndex: 0, start: 0, end: 0 };
}

function getGcodeEditorSelection(editor) {
  const activeInput = document.activeElement?.closest?.('[data-gcode-line]');
  if (!activeInput || !editor.contains(activeInput)) return getDefaultGcodeSelection();
  const row = activeInput.closest('.gcode-line-row');
  return {
    lineIndex: Number(row?.dataset.lineIndex || 0),
    start: activeInput.selectionStart ?? activeInput.value.length,
    end: activeInput.selectionEnd ?? activeInput.value.length
  };
}

function seedGcodeHistory(cardShell, text) {
  gcodeHistoryStore.set(cardShell, {
    stack: [{ text, selection: getDefaultGcodeSelection() }],
    index: 0
  });
}

function ensureGcodeHistory(cardShell) {
  let history = gcodeHistoryStore.get(cardShell);
  if (history) return history;
  const rawInput = cardShell.querySelector('[data-gcode-raw]');
  const text = normalizeGcodeText(rawInput ? rawInput.value : '');
  seedGcodeHistory(cardShell, text);
  return gcodeHistoryStore.get(cardShell);
}

function buildGcodeHistoryState(editor) {
  return {
    text: getStructuredLines(editor).join('\n'),
    selection: getGcodeEditorSelection(editor)
  };
}

function rememberGcodeHistory(cardShell) {
  const editor = cardShell.querySelector('[data-gcode-structured]');
  if (!editor) return;

  const history = ensureGcodeHistory(cardShell);
  const nextState = buildGcodeHistoryState(editor);
  const currentState = history.stack[history.index];

  if (currentState && currentState.text === nextState.text) {
    currentState.selection = nextState.selection;
    syncStructuredToRaw(cardShell);
    return;
  }

  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(nextState);
  history.index = history.stack.length - 1;
  if (history.stack.length > 180) {
    history.stack = history.stack.slice(history.stack.length - 180);
    history.index = history.stack.length - 1;
  }
  syncStructuredToRaw(cardShell);
}

function syncRawToStructured(cardShell, options = {}) {
  const rawInput = cardShell.querySelector('[data-gcode-raw]');
  const editor = cardShell.querySelector('[data-gcode-structured]');
  if (!rawInput || !editor) return;

  const text = normalizeGcodeText(rawInput.value);
  const lines = text.split('\n');
  const renderLines = lines.length > 0 ? lines : [''];
  editor.innerHTML = renderLines.map((line, index) => renderGcodeLineRow(line, index)).join('');
  renumberGcodeRows(editor);
  if (options.resetHistory !== false) seedGcodeHistory(cardShell, text);
}

function toggleGcodeMode(button, mode) {
  const card = button.closest('[data-param-gcode]');
  const shell = card?.querySelector('[data-gcode-mode]');
  if (!shell) return;

  if (mode === 'structured') syncRawToStructured(shell, { resetHistory: true });
  else syncStructuredToRaw(shell);

  shell.dataset.gcodeMode = mode;
  const rawShell = shell.querySelector('.gcode-raw-shell');
  const structuredShell = shell.querySelector('.gcode-structured-shell');
  if (rawShell) rawShell.classList.toggle('hidden', mode !== 'raw');
  if (structuredShell) structuredShell.classList.toggle('hidden', mode !== 'structured');

  card.querySelectorAll('[data-mode-btn]').forEach((item) => {
    item.classList.toggle('is-active', item.getAttribute('data-mode-btn') === mode);
  });

  rememberParamSnapshot();
  updateParamDirtyState();
}

async function renderDynamicParamsPage() {
  const container = document.getElementById('dynamicParamsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-10 text-center text-gray-500">
      <svg class="w-8 h-8 animate-spin mx-auto theme-text mb-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      正在读取 JSON 预设文件...
    </div>
  `;

  const preset = await loadActivePreset();
  const modernPresetView = typeof window.__getParamsPresetView__ === 'function'
    ? window.__getParamsPresetView__() || null
    : null;
  if (!preset) {
    paramEditorSession.activePath = null;
    activeParamNumericConstraints = {};
    renderParamsSectionNav({});
    container.innerHTML = getEmptyParamsState();
    const currentEditingFile = document.getElementById('currentEditingFile');
    if (currentEditingFile) {
      const emptyLabel = modernPresetView?.fileName || '未选择';
      currentEditingFile.dataset.baseName = emptyLabel;
      currentEditingFile.textContent = emptyLabel;
    }
    updateParamDirtyUI(null);
    return;
  }

  const presetPath = typeof window.resolveParamsPresetPath === 'function'
    ? window.resolveParamsPresetPath(window, preset.path) || preset.path
    : preset.path;
  const fileName = typeof window.resolveParamsDisplayFileName === 'function'
    ? window.resolveParamsDisplayFileName(window, presetPath)
    : presetPath.split('\\').pop();
  const currentEditingFile = document.getElementById('currentEditingFile');
  if (currentEditingFile) {
    currentEditingFile.dataset.baseName = fileName;
    currentEditingFile.textContent = fileName;
  }

  if (window.mkpAPI?.ensurePresetBackup) {
    try {
      await window.mkpAPI.ensurePresetBackup(presetPath);
    } catch (error) {}
  }

  const diskFlat = normalizeFlatState(flattenObject(preset.data));
  const diskRenderState = buildRenderableParamState(diskFlat);
  const diskSnapshot = createParamSnapshot(diskRenderState.flat);
  let store = getParamStore(presetPath);
  if (!store) {
    store = ensureParamStore(presetPath, diskRenderState.flat);
  } else if (!store.dirty && serializeParamSnapshot(store.history[store.index]) !== serializeParamSnapshot(diskSnapshot)) {
    store.history = [diskSnapshot];
    store.index = 0;
    markParamStoreSnapshotSaved(store, diskSnapshot);
  }

  paramEditorSession.activePath = presetPath;
  const currentSnapshot = getCurrentParamStoreSnapshot(store) || diskSnapshot;
  const activeSnapshot = createParamSnapshot(
    buildRenderableParamState(currentSnapshot.flat).flat,
    currentSnapshot.modes,
    currentSnapshot.focus
  );
  replaceCurrentParamStoreSnapshot(store, activeSnapshot);
  if (!store.dirty) {
    markParamStoreSnapshotSaved(store, activeSnapshot);
  }

  const renderState = buildRenderableParamState(activeSnapshot.flat);
  activeParamNumericConstraints = buildParamNumericConstraints(renderState.flat);
  const groups = buildParamGroupSections(renderState.flat);
  const metaSectionMarkup = renderPreviewParamGroup('meta', groups.meta);
  const toolheadSectionMarkup = renderPreviewParamGroup('toolhead', groups.toolhead);
  const wipingSectionMarkup = renderPreviewParamGroup('wiping', groups.wiping);
  const mountSectionMarkup = renderPreviewParamGroup('mount', groups.mount);
  const unmountSectionMarkup = renderPreviewParamGroup('unmount', groups.unmount);
  const advancedSectionMarkup = renderPreviewParamGroup('advanced', groups.advanced);
  const advancedTemplateEditorMarkup = renderAdvancedTemplateEditorSection(renderState.flat, presetPath, fileName);
  renderParamsSectionNav(groups);
  container.innerHTML = `
    <div class="col-span-full params-shell">
      ${buildParamsSummary(unflattenObject(renderState.flat), fileName)}
      ${metaSectionMarkup}
      ${toolheadSectionMarkup}
      ${wipingSectionMarkup}
      ${mountSectionMarkup}
      ${unmountSectionMarkup}
      ${advancedSectionMarkup}
      ${advancedTemplateEditorMarkup}
    </div>
  `;

  applyParamSnapshotToDom(activeSnapshot, { restoreFocus: false });
  syncTowerAdvancedPanels(container);
  initTowerPositionEditors();
  initParamsSectionNav();
  updateParamDirtyState(store);
}

function coerceParamValue(rawValue, input, key = '') {
  if (input?.type === 'checkbox') return input.checked;

  if (isParamStringArrayField(key)) {
    return splitParamMultilineArray(rawValue);
  }

  const value = String(rawValue ?? '');
  const meta = getParamFieldMeta(key);
  if (meta.type === 'select' && Array.isArray(meta.options)) {
    const matchedOption = meta.options.find((option) => String(option.value) === value);
    if (matchedOption) return matchedOption.value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (input?.type === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    const min = input.min !== '' ? Number(input.min) : Number.NEGATIVE_INFINITY;
    const max = input.max !== '' ? Number(input.max) : Number.POSITIVE_INFINITY;
    return clampTowerEditorValue(Number(value), min, max);
  }
  if ((value.startsWith('{') || value.startsWith('[')) && value.trim()) {
    try {
      return JSON.parse(value);
    } catch (error) {}
  }
  return value;
}

async function saveAllDynamicParams(options = {}) {
  const store = getActiveParamStore();
  if (!store?.dirty) {
    updateParamDirtyUI(store);
    return false;
  }

  const preset = await loadActivePreset();
  if (!preset) {
    await MKPModal.alert({
      title: '\u63d0\u793a',
      msg: '\u5f53\u524d\u672a\u5e94\u7528\u4efb\u4f55\u9884\u8bbe\uff0c\u65e0\u6cd5\u4fdd\u5b58\u3002',
      type: 'warning'
    });
    return false;
  }

  const presetPath = typeof window.resolveParamsPresetPath === 'function'
    ? window.resolveParamsPresetPath(window, preset.path) || preset.path
    : preset.path;
  const fileName = typeof window.resolveParamsDisplayFileName === 'function'
    ? window.resolveParamsDisplayFileName(window, presetPath)
    : presetPath.split('\\').pop();

  if (!options.skipConfirm) {
    const confirmed = await MKPModal.confirm({
      title: '\u4fdd\u5b58\u6240\u6709\u4fee\u6539\uff1f',
      msg: `\u5c06\u628a\u5f53\u524d\u53c2\u6570\u5199\u56de\u5230 <span class="font-mono text-xs">${escapeParamHtml(fileName)}</span>\u3002`,
      type: 'info',
      confirmText: '\u786e\u8ba4\u4fdd\u5b58',
      cancelText: '\u518d\u68c0\u67e5\u4e00\u4e0b'
    });
    if (!confirmed) return false;
  }

  const saveBtn = document.getElementById('saveParamsBtn');
  if (!saveBtn || saveBtn.disabled || saveBtn.dataset.isSaving === 'true') return false;

  saveBtn.dataset.isSaving = 'true';
  setParamsSaveButtonWorking(saveBtn);
  updateParamDirtyUI(store);

  const snapshot = rememberParamSnapshot({ force: true }) || collectParamSnapshotFromDom();
  const flatUpdates = applyWipingTowerParamCompatibility(snapshot.flat);

  const startTime = Date.now();
  let result = null;
  try {
    result = await window.mkpAPI.overwritePreset(presetPath, unflattenObject(flatUpdates));
  } catch (error) {
    clearParamsSaveButtonFeedback(saveBtn);
    delete saveBtn.dataset.isSaving;
    updateParamDirtyUI(store);
    await MKPModal.alert({
      title: '\u4fdd\u5b58\u5931\u8d25',
      msg: error?.message || '\u5199\u5165\u5931\u8d25\u3002',
      type: 'error'
    });
    return false;
  }

  const elapsed = Date.now() - startTime;
  if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));

  if (!result?.success) {
    clearParamsSaveButtonFeedback(saveBtn);
    delete saveBtn.dataset.isSaving;
    updateParamDirtyUI(store);
    await MKPModal.alert({
      title: '\u4fdd\u5b58\u5931\u8d25',
      msg: result?.error || '\u5199\u5165\u5931\u8d25\u3002',
      type: 'error'
    });
    return false;
  }

  const nextPresetData = unflattenObject(flatUpdates);
  if (typeof window.updatePresetCacheSnapshot === 'function') {
    window.updatePresetCacheSnapshot(presetPath, nextPresetData);
  } else {
    window.presetCache = {
      path: presetPath,
      data: nextPresetData,
      timestamp: Date.now()
    };
  }

  markActiveParamSnapshotSaved(snapshot);

  if (typeof window.emitActivePresetUpdated === 'function') {
    window.emitActivePresetUpdated({ reason: 'params-save', path: presetPath, forceRefresh: false });
  }
  if (typeof window.broadcastPresetMutation === 'function') {
    window.broadcastPresetMutation({ reason: 'params-save', path: presetPath });
  }

  flashParamsSaveButtonSuccess(saveBtn, 1800, () => {
    delete saveBtn.dataset.isSaving;
  });
  return true;
}

async function demoRestoreDefaults() {
  const preset = await loadActivePreset();
  if (!preset?.data) {
    await MKPModal.alert({ title: '提示', msg: '当前没有已应用的预设，无法恢复。', type: 'warning' });
    return;
  }

  const confirmed = await MKPModal.confirm({
    title: '恢复原版参数？',
    msg: '会用当前机型、类型和版本对应的原版预设覆盖当前内容。<br><br>会尽量保留你的显示名称。',
    type: 'warning',
    confirmText: '恢复默认',
    cancelText: '取消'
  });
  if (!confirmed) return;

  const printer = preset.data.printer;
  const type = preset.data.type;
  const version = preset.data.version;
  if (!printer || !type || !version) {
    await MKPModal.alert({ title: '恢复失败', msg: '当前预设缺少 printer/type/version，无法定位原版文件。', type: 'error' });
    return;
  }

  const button = document.getElementById('btn-restore-defaults');
  let resetEngine = () => {};
  if (button) {
    const spinIcon = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    resetEngine = setButtonStatus(button, '110px', '恢复中', spinIcon, 'btn-expand-theme');
  }

  try {
    const presetPath = typeof window.resolveParamsPresetPath === 'function'
      ? window.resolveParamsPresetPath(window, preset.path) || preset.path
      : preset.path;
    const defaultFileName = `${printer}_${type}_v${version}.json`;
    const restoredFileName = typeof window.resolveParamsDisplayFileName === 'function'
      ? window.resolveParamsDisplayFileName(window, presetPath) || defaultFileName
      : defaultFileName;
    let defaultData = null;
    let sourceLabel = '本地原始备份';

    if (window.mkpAPI?.readPresetBackup) {
      const backupResult = await window.mkpAPI.readPresetBackup(presetPath);
      if (backupResult?.success && backupResult.data) {
        defaultData = backupResult.data;
      }
    }

    if (!defaultData) {
      defaultData = await fetchCloudDataWithFallback(defaultFileName);
      sourceLabel = '云端原版文件';
    }

    const result = await window.mkpAPI.overwritePreset(presetPath, defaultData);
    if (!result.success) throw new Error(result.error || '写入原版预设失败。');

    if (typeof window.updatePresetCacheSnapshot === 'function') {
      window.updatePresetCacheSnapshot(presetPath, defaultData);
    } else {
      window.presetCache = {
        path: presetPath,
        data: defaultData,
        timestamp: Date.now()
      };
    }

    const isParamsVisible = !document.getElementById('page-params')?.classList.contains('hidden');
    const restoredState = replaceActiveParamStoreWithPersistedState(
      presetPath,
      flattenObject(defaultData),
      { applyDom: isParamsVisible }
    );
    const restoredStore = restoredState.store;
    const saveBtn = document.getElementById('saveParamsBtn');
    clearParamsSaveButtonFeedback(saveBtn);
    if (saveBtn) {
      delete saveBtn.dataset.isSaving;
      updateParamDirtyUI(restoredStore);
    }

    if (typeof window.emitActivePresetUpdated === 'function') {
      window.emitActivePresetUpdated({ reason: 'params-restore-defaults', path: presetPath, forceRefresh: false });
    }
    if (typeof window.broadcastPresetMutation === 'function') {
      window.broadcastPresetMutation({ reason: 'params-restore-defaults', path: presetPath });
    }
    if (isParamsVisible) {
      await renderDynamicParamsPage();
    }
    const finalStore = getParamStore(presetPath);
    const finalFlat = finalStore?.savedFullSerialized
      ? JSON.parse(finalStore.savedFullSerialized)
      : restoredState.flatState;
    const currentFlat = isParamsVisible
      ? collectParamFullStateFromDom(finalStore)
      : (finalStore?.history?.[finalStore.index]?.flat || restoredState.flatState);
    if (finalStore?.dirty) {
      logParamDirtyMismatch('restore-defaults', finalFlat, currentFlat, {
        presetPath,
        fileName: restoredFileName
      });
    }
    await MKPModal.alert({ title: '已恢复', msg: `已按${sourceLabel}恢复为 ${restoredFileName} 的初始内容。`, type: 'success' });
  } catch (error) {
    await MKPModal.alert({ title: '恢复失败', msg: error.message, type: 'error' });
  } finally {
    resetEngine();
  }
}

function ensureParamContextMenu() {
  if (document.getElementById('paramEditorContextMenu')) return;

  const menu = document.createElement('div');
  menu.id = 'paramEditorContextMenu';
  menu.className = 'param-context-menu hidden';
  menu.innerHTML = PARAM_MENU_ACTIONS.map((item) => (
    `<button type="button" class="param-context-item" data-action="${item.id}">${item.label}</button>`
  )).join('');
  document.body.appendChild(menu);

  menu.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !paramContextMenuState.target) return;
    const action = button.getAttribute('data-action');
    const target = paramContextMenuState.target;
    hideContextMenus();
    await runParamContextAction(target, action);
  });
}

function ensureGcodeLineContextMenu() {
  if (document.getElementById('gcodeLineContextMenu')) return;

  const menu = document.createElement('div');
  menu.id = 'gcodeLineContextMenu';
  menu.className = 'param-context-menu hidden';
  menu.innerHTML = GCODE_LINE_MENU_ACTIONS.map((item) => (
    `<button type="button" class="param-context-item" data-gcode-action="${item.id}">${item.label}</button>`
  )).join('');
  document.body.appendChild(menu);

  menu.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-gcode-action]');
    if (!button || !gcodeLineContextMenuState.row || !gcodeLineContextMenuState.editor) return;
    const action = button.getAttribute('data-gcode-action');
    const { row, editor } = gcodeLineContextMenuState;
    hideContextMenus();
    await runGcodeLineAction(editor, row, action);
  });
}

function hideContextMenus(options = {}) {
  const paramMenu = document.getElementById('paramEditorContextMenu');
  const gcodeMenu = document.getElementById('gcodeLineContextMenu');
  if (paramMenu) {
    if (typeof window.hideFloatingSurface === 'function') window.hideFloatingSurface(paramMenu, options);
    else paramMenu.classList.add('hidden');
  }
  if (gcodeMenu) {
    if (typeof window.hideFloatingSurface === 'function') window.hideFloatingSurface(gcodeMenu, options);
    else gcodeMenu.classList.add('hidden');
  }
  paramContextMenuState.target = null;
  gcodeLineContextMenuState.row = null;
  gcodeLineContextMenuState.editor = null;
}

function showMenu(menuId, x, y) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  if (typeof window.positionFloatingMenu === 'function') {
    window.positionFloatingMenu(menu, x, y, { keepVisible: true, margin: 12, minWidth: 160 });
  } else {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }
  if (typeof window.showFloatingSurface === 'function') {
    window.showFloatingSurface(menu);
  } else {
    menu.classList.remove('hidden');
  }
}

function runNativeEditCommand(target, command, value = null) {
  target.focus();
  try {
    return document.execCommand(command, false, value);
  } catch (error) {
    return false;
  }
}

function replaceSelectionWithUndo(target, text) {
  if (runNativeEditCommand(target, 'insertText', text)) return;
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? start;
  target.setRangeText(text, start, end, 'end');
  target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

function deleteSelectionWithUndo(target) {
  if (runNativeEditCommand(target, 'delete')) return;
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? start;
  if (start === end) return;
  target.setRangeText('', start, end, 'end');
  target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
}

async function readClipboardTextSafe() {
  try {
    if (navigator.clipboard) {
      const text = await navigator.clipboard.readText();
      if (typeof text === 'string') return text;
    }
  } catch (error) {}
  return copiedGcodeLineText || '';
}

async function runParamContextAction(target, action) {
  target.focus();

  if (action === 'undo') return void runNativeEditCommand(target, 'undo');
  if (action === 'delete') return void deleteSelectionWithUndo(target);

  if (action === 'copy') {
    const selected = target.value.slice(target.selectionStart ?? 0, target.selectionEnd ?? 0);
    copiedGcodeLineText = selected;
    if (!runNativeEditCommand(target, 'copy') && selected) await copyToClipboard(selected);
    return;
  }

  if (action === 'cut') {
    const selected = target.value.slice(target.selectionStart ?? 0, target.selectionEnd ?? 0);
    copiedGcodeLineText = selected;
    if (!runNativeEditCommand(target, 'cut')) {
      if (selected) await copyToClipboard(selected);
      deleteSelectionWithUndo(target);
    }
    return;
  }

  if (action === 'paste') {
    if (runNativeEditCommand(target, 'paste')) return;
    replaceSelectionWithUndo(target, await readClipboardTextSafe());
  }
}

function createGcodeRowElement(line) {
  const row = document.createElement('div');
  row.className = 'gcode-line-row';
  row.innerHTML = `
    <div class="gcode-line-meta" title="右键可插入、复制、粘贴或删除这一行">
      <span class="gcode-line-number"></span>
      <span class="gcode-line-kind"></span>
    </div>
    <input type="text" value="${escapeParamHtml(line)}" class="param-editable gcode-line-input" data-gcode-line>
  `;
  return row;
}

function insertGcodeRow(editor, referenceRow, position, text = '') {
  const row = createGcodeRowElement(text);
  if (!referenceRow) editor.appendChild(row);
  else if (position === 'before') editor.insertBefore(row, referenceRow);
  else editor.insertBefore(row, referenceRow.nextSibling);
  renumberGcodeRows(editor);
  row.querySelector('[data-gcode-line]').focus();
  return row;
}

async function runGcodeLineAction(editor, row, action) {
  const input = row.querySelector('[data-gcode-line]');
  const cardShell = editor.closest('[data-gcode-mode]');
  const jsonKey = cardShell?.getAttribute('data-json-key');
  if (!input) return;

  if (action === 'insertAbove') {
    const newRow = insertGcodeRow(editor, row, 'before', '');
    if (cardShell) rememberGcodeHistory(cardShell);
    rememberParamSnapshot({
      force: true,
      explicitFocus: jsonKey ? {
        type: 'gcode-line',
        key: jsonKey,
        lineIndex: Number(newRow?.dataset.lineIndex || row.dataset.lineIndex || 0),
        start: 0,
        end: 0
      } : null
    });
    return;
  }
  if (action === 'insertBelow') {
    const newRow = insertGcodeRow(editor, row, 'after', '');
    if (cardShell) rememberGcodeHistory(cardShell);
    rememberParamSnapshot({
      force: true,
      explicitFocus: jsonKey ? {
        type: 'gcode-line',
        key: jsonKey,
        lineIndex: Number(newRow?.dataset.lineIndex || row.dataset.lineIndex || 0),
        start: 0,
        end: 0
      } : null
    });
    return;
  }

  if (action === 'copyLine') {
    copiedGcodeLineText = input.value;
    await copyToClipboard(input.value);
    return;
  }

  if (action === 'pasteLine') {
    input.value = await readClipboardTextSafe();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    renumberGcodeRows(editor);
    if (cardShell) rememberGcodeHistory(cardShell);
    rememberParamSnapshot({
      force: true,
      explicitFocus: jsonKey ? {
        type: 'gcode-line',
        key: jsonKey,
        lineIndex: Number(row.dataset.lineIndex || 0),
        start: 0,
        end: input.value.length
      } : null
    });
    return;
  }

  if (action === 'deleteLine') {
    const fallbackLineIndex = Math.max(0, Number(row.dataset.lineIndex || 0) - 1);
    if (editor.querySelectorAll('.gcode-line-row').length === 1) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      row.remove();
      renumberGcodeRows(editor);
    }
    if (cardShell) rememberGcodeHistory(cardShell);
    rememberParamSnapshot({
      force: true,
      explicitFocus: jsonKey ? {
        type: 'gcode-line',
        key: jsonKey,
        lineIndex: Math.min(fallbackLineIndex, Math.max(0, editor.querySelectorAll('.gcode-line-row').length - 1)),
        start: 0,
        end: 0
      } : null
    });
  }
}

async function canNavigateAwayFromParams(nextPage) {
  const paramsPage = document.getElementById('page-params');
  const store = getActiveParamStore();
  if (!paramsPage || paramsPage.classList.contains('hidden') || nextPage === 'params' || !store?.dirty) {
    return true;
  }

  const confirmedSave = await MKPModal.confirm({
    title: '当前参数未保存',
    msg: '检测到当前预设有未保存修改。是否先保存后再切换页面？',
    type: 'warning',
    confirmText: '保存并切换',
    cancelText: '直接切换'
  });

  if (!confirmedSave) {
    discardActiveParamChanges();
    return true;
  }
  return await saveAllDynamicParams({ skipConfirm: true });
}

function bindParamEditors() {
  ensureParamContextMenu();
  ensureGcodeLineContextMenu();
  if (window._paramEditorsBound) return;
  window._paramEditorsBound = true;

  const getParamsScrollContainer = (element = null) => {
    return element?.closest?.('.page-content') || document.getElementById('paramsPageContent') || null;
  };

  const getNormalizedWheelDelta = (event, referenceElement = null) => {
    if (typeof window.normalizeWheelScrollDelta === 'function') {
      return window.normalizeWheelScrollDelta(event, referenceElement);
    }
    return { left: event.deltaX, top: event.deltaY };
  };

  const applyWheelProxyScroll = (scrollContainer, event) => {
    if (typeof window.applyWheelScrollProxy === 'function') {
      return window.applyWheelScrollProxy(scrollContainer, event, scrollContainer);
    }

    const delta = getNormalizedWheelDelta(event, scrollContainer);
    if (delta.top) scrollContainer.scrollTop += delta.top;
    if (delta.left) scrollContainer.scrollLeft += delta.left;
    return delta;
  };

  const canElementConsumeWheel = (element, deltaY) => {
    if (!element || !deltaY) return false;
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    if (maxScrollTop <= 0) return false;
    if (deltaY < 0) return element.scrollTop > 0;
    if (deltaY > 0) return element.scrollTop < maxScrollTop;
    return false;
  };

  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;

    const editorTarget = event.target instanceof Element
      ? event.target.closest('.param-textarea, .gcode-editor')
      : null;
    if (!editorTarget) return;

    const activeTarget = editorTarget.matches('.param-textarea')
      ? document.activeElement === editorTarget
      : editorTarget.contains(document.activeElement);

    if (activeTarget && canElementConsumeWheel(editorTarget, event.deltaY)) {
      return;
    }

    const scrollContainer = getParamsScrollContainer(editorTarget);
    if (!scrollContainer) return;
    applyWheelProxyScroll(scrollContainer, event);
    event.preventDefault();
  }, { passive: false, capture: true });

  document.addEventListener('contextmenu', (event) => {
    const gcodeHandle = event.target.closest('.gcode-line-meta');
    const gcodeRow = event.target.closest('.gcode-line-row');
    const gcodeEditor = event.target.closest('[data-gcode-structured]');
    if (gcodeHandle && gcodeRow && gcodeEditor) {
      event.preventDefault();
      hideContextMenus();
      gcodeLineContextMenuState.row = gcodeRow;
      gcodeLineContextMenuState.editor = gcodeEditor;
      showMenu('gcodeLineContextMenu', event.clientX, event.clientY);
      return;
    }

    const target = event.target.closest('.param-editable');
    if (!target) {
      hideContextMenus({ immediate: true });
      return;
    }

    event.preventDefault();
    hideContextMenus({ immediate: true });
    paramContextMenuState.target = target;
    showMenu('paramEditorContextMenu', event.clientX, event.clientY);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#paramEditorContextMenu') && !event.target.closest('#gcodeLineContextMenu')) {
      hideContextMenus({ immediate: true });
    }
  });

  const handleParamKeydown = (event) => {
    if (event.key === 'Escape') hideContextMenus();

    const isSave = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 's';
    const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    const paramsPage = document.getElementById('page-params');
    const isParamsVisible = paramsPage && !paramsPage.classList.contains('hidden');
    const modalVisible = !document.getElementById('mkp-global-modal')?.classList.contains('pointer-events-none');
    if (!isParamsVisible || modalVisible) return;
    if (isSave) {
      event.preventDefault();
      saveAllDynamicParams({ skipConfirm: true });
      return;
    }

    if (!isUndo && !isRedo) return;
    event.preventDefault();
    void stepParamHistory(isUndo ? -1 : 1, { restoreFocus: false });
  };

  window.addEventListener('keydown', handleParamKeydown, true);

  document.addEventListener('input', (event) => {
    const lineInput = event.target.closest('[data-gcode-line]');
    if (lineInput) {
      const row = lineInput.closest('.gcode-line-row');
      const kind = row?.querySelector('.gcode-line-kind');
      const cardShell = lineInput.closest('[data-gcode-mode]');
      if (kind) kind.textContent = getGcodeLineHint(lineInput.value);
      if (cardShell) rememberGcodeHistory(cardShell);
      rememberParamSnapshot();
      return;
    }

    const rawInput = event.target.closest('[data-gcode-raw]');
    if (rawInput) {
      const shell = rawInput.closest('[data-gcode-mode]');
      if (shell?.dataset.gcodeMode === 'structured') syncRawToStructured(shell, { resetHistory: true });
      rememberParamSnapshot();
      return;
    }

    const editable = event.target.closest('.dynamic-param-input[data-json-key]');
    if (editable) {
      const key = editable.getAttribute('data-json-key');
      if (key === 'wiping.wiper_x' || key === 'wiping.wiper_y') {
        syncTowerPositionEditorsFromInputs();
      } else if (isTowerGeometryField(key)) {
        refreshTowerPositionDisclosureFromDom();
      }
      rememberParamSnapshot();
    }
  });

  document.addEventListener('change', (event) => {
    const editable = event.target.closest('.dynamic-param-input[data-json-key]');
    if (editable?.type === 'number') {
      const key = editable.getAttribute('data-json-key');
      const normalized = normalizeNumericInputElement(editable);
      if (key === 'wiping.wiper_x' || key === 'wiping.wiper_y') {
        syncTowerPositionEditorsFromInputs();
      } else if (isTowerGeometryField(key)) {
        refreshTowerPositionDisclosureFromDom();
      }
      if (normalized) {
        rememberParamSnapshot({ force: true });
      }
      updateParamDirtyState();
    }

    const checkbox = event.target.closest('.dynamic-param-input[type="checkbox"]');
    const status = checkbox?.closest('.param-row-toggle')?.querySelector('.param-switch-status');
    if (status) status.textContent = checkbox.checked ? '已开启' : '已关闭';
    if (checkbox?.dataset?.towerAdvancedToggle) {
      refreshTowerPositionDisclosureFromDom();
      syncTowerAdvancedPanels(document);
    }
    if (checkbox) {
      rememberParamSnapshot();
      updateParamDirtyState();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindParamEditors();
});

window.getActivePresetPath = getActivePresetPath;
window.loadActivePreset = loadActivePreset;
window.renderDynamicParamsPage = renderDynamicParamsPage;
window.saveAllDynamicParams = saveAllDynamicParams;
window.demoRestoreDefaults = demoRestoreDefaults;
window.toggleGcodeMode = toggleGcodeMode;
window.canNavigateAwayFromParams = canNavigateAwayFromParams;
window.scrollToParamsSection = scrollToParamsSection;
window.hasUnsavedParamChanges = hasUnsavedParamChanges;
window.__syncParamsSaveButtonState = () => updateParamDirtyUI();
