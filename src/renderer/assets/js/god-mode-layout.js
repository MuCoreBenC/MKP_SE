(function godModeLayoutBootstrap() {
  const GOD_MODE_ENABLE_KEY = 'setting_god_mode_v1';
  const GOD_MODE_LAYOUT_KEY = 'mkp_god_mode_layout_v1';
  const SNAP_THRESHOLD_PX = 8;
  const FLOATING_HIDE_DELAY_MS = 160;
  const MIN_LAYOUT_SIZE_PX = 12;
  const SVG_CHILD_TAGS = new Set(['path', 'g', 'use', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
  const IGNORED_TAGS = new Set(['html', 'body', 'head', 'meta', 'link', 'style', 'script', 'noscript']);
  const EMPTY_INLINE_STYLE_TOKEN = '__god_mode_empty__';

  const state = {
    ready: false,
    developerMode: false,
    runtimeInfo: null,
    enabled: false,
    formalLayouts: {},
    savedLayouts: {},
    draftLayouts: {},
    activeTarget: null,
    pendingMoveTarget: null,
    dragSession: null,
    pointerMoveSession: null,
    resizeSession: null,
    pointerPosition: { x: 0, y: 0 },
    menuPoint: { x: 24, y: 24 },
    helperTimer: 0,
    reapplyFrame: 0,
    frameSyncFrame: 0,
    observer: null,
    constraintResizeObserver: null,
    observedConstraintContainers: new Set(),
    historyPast: [],
    historyFuture: [],
    ui: {
      root: null,
      menu: null,
      menuTitle: null,
      menuMeta: null,
      menuParent: null,
      menuGrandParent: null,
      input: null,
      inputTitle: null,
      inputDesc: null,
      inputX: null,
      inputY: null,
      inputError: null,
      constraint: null,
      constraintTitle: null,
      constraintDesc: null,
      constraintLeft: null,
      constraintRight: null,
      constraintTop: null,
      constraintBottom: null,
      constraintError: null,
      selectionFrame: null,
      settingsRow: null,
      settingsMeta: null,
      settingsOpenFolder: null,
      settingsRestorePrevious: null,
      settingsRestoreInitial: null,
      settingsFreezeFormal: null,
      helper: null,
      lineX: null,
      lineY: null
    }
  };

  function safeLog(level, message) {
    if (window.Logger && typeof window.Logger[level] === 'function') {
      window.Logger[level](message);
      return;
    }
    const fallback = level === 'error' ? console.error : console.log;
    fallback(message);
  }

  function safeCssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  function getRuntimeApi() {
    return window.mkpAPI || null;
  }

  function getSnapshotLabelFromPath(filePath) {
    if (!filePath) return '未保存快照';
    const normalized = String(filePath).replace(/\\/g, '/');
    return normalized.split('/').pop() || normalized;
  }

  function updateDeveloperSettingsMeta(text) {
    const metaNode = state.ui.settingsMeta || document.getElementById('settingGodModeMeta');
    if (metaNode) {
      metaNode.textContent = text;
    }
  }

  function syncDeveloperSettingsVisibility() {
    const row = state.ui.settingsRow || document.getElementById('settingGodModeRow');
    if (!row) return;
    row.classList.toggle('hidden', !state.developerMode);
  }

  function updateDeveloperSettingsButtonsState(disabled) {
    [state.ui.settingsOpenFolder, state.ui.settingsRestorePrevious, state.ui.settingsRestoreInitial]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = disabled;
        button.classList.toggle('opacity-50', disabled);
        button.classList.toggle('cursor-not-allowed', disabled);
      });
  }

  function getSnapshotLabelFromPath(filePath) {
    if (!filePath) return 'not-saved-yet';
    const normalized = String(filePath).replace(/\\/g, '/');
    return normalized.split('/').pop() || normalized;
  }

  function hasPreviousSnapshot(runtimeInfo = state.runtimeInfo) {
    if (!runtimeInfo || !Array.isArray(runtimeInfo.snapshots)) {
      return false;
    }

    const currentFile = runtimeInfo.activeSnapshotFile || getSnapshotLabelFromPath(runtimeInfo.activeSnapshotPath);
    const currentIndex = runtimeInfo.snapshots.findIndex((entry) => entry && entry.fileName === currentFile);
    if (currentIndex >= 0) {
      return currentIndex + 1 < runtimeInfo.snapshots.length;
    }

    return runtimeInfo.snapshots.length > 1;
  }

  function buildDeveloperSettingsMeta(runtimeInfo = state.runtimeInfo) {
    if (!state.developerMode) {
      return 'Developer-only tool. Hidden in packaged builds.';
    }

    const directory = runtimeInfo && runtimeInfo.directory ? runtimeInfo.directory : 'not-initialized';
    const formalDefaultsFile = runtimeInfo && runtimeInfo.formalDefaultsFile ? runtimeInfo.formalDefaultsFile : 'not-initialized';
    const currentSnapshot = getSnapshotLabelFromPath(
      runtimeInfo && (runtimeInfo.snapshotPath || runtimeInfo.activeSnapshotPath || runtimeInfo.currentPath)
    );
    return `Snapshots: ${directory} | Current: ${currentSnapshot} | Formal: ${formalDefaultsFile}`;
  }

  function updateDeveloperSettingsMeta(text = buildDeveloperSettingsMeta()) {
    const metaNode = state.ui.settingsMeta || document.getElementById('settingGodModeMeta');
    if (metaNode) {
      metaNode.textContent = text;
    }
  }

  function syncDeveloperSettingsVisibility() {
    const row = state.ui.settingsRow || document.getElementById('settingGodModeRow');
    if (!row) return;
    row.classList.toggle('hidden', !state.developerMode);
    row.hidden = !state.developerMode;
  }

  function updateDeveloperSettingsButtonsState(disabled = false) {
    const disableAll = disabled || !state.developerMode;
    const hasInitialSnapshot = Boolean(state.runtimeInfo && state.runtimeInfo.initialSnapshotFile);
    const canRestorePrevious = hasPreviousSnapshot();

    [
      [state.ui.settingsOpenFolder, disableAll],
      [state.ui.settingsRestorePrevious, disableAll || !canRestorePrevious],
      [state.ui.settingsRestoreInitial, disableAll || !hasInitialSnapshot],
      [state.ui.settingsFreezeFormal, disableAll]
    ].forEach(([button, buttonDisabled]) => {
      if (!button) return;
      button.disabled = buttonDisabled;
      button.classList.toggle('opacity-50', buttonDisabled);
      button.classList.toggle('cursor-not-allowed', buttonDisabled);
    });
  }

  function normalizeConstraintValue(value) {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.round(parsed);
  }

  function normalizeConstraints(constraints) {
    const next = {
      left: normalizeConstraintValue(constraints && constraints.left),
      right: normalizeConstraintValue(constraints && constraints.right),
      top: normalizeConstraintValue(constraints && constraints.top),
      bottom: normalizeConstraintValue(constraints && constraints.bottom)
    };
    return next;
  }

  function hasActiveConstraints(constraints) {
    if (!constraints) return false;
    return ['left', 'right', 'top', 'bottom'].some((key) => constraints[key] !== undefined);
  }

  function normalizeLayout(layout) {
    const parsedX = Number(layout && layout.x);
    const parsedY = Number(layout && layout.y);
    const parsedWidth = Number(layout && layout.width);
    const parsedHeight = Number(layout && layout.height);
    const constraints = normalizeConstraints(layout && layout.constraints);
    return {
      x: Number.isFinite(parsedX) ? Math.round(parsedX) : 0,
      y: Number.isFinite(parsedY) ? Math.round(parsedY) : 0,
      width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(parsedWidth)) : null,
      height: Number.isFinite(parsedHeight) && parsedHeight > 0 ? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(parsedHeight)) : null,
      constraints: hasActiveConstraints(constraints) ? constraints : null
    };
  }

  function isZeroLayout(layout) {
    const next = normalizeLayout(layout);
    return next.x === 0 && next.y === 0 && next.width === null && next.height === null && !next.constraints;
  }

  function areLayoutsEqual(leftLayout, rightLayout) {
    const left = normalizeLayout(leftLayout);
    const right = normalizeLayout(rightLayout);
    return (
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height &&
      normalizeConstraintValue(left.constraints && left.constraints.left) === normalizeConstraintValue(right.constraints && right.constraints.left) &&
      normalizeConstraintValue(left.constraints && left.constraints.right) === normalizeConstraintValue(right.constraints && right.constraints.right) &&
      normalizeConstraintValue(left.constraints && left.constraints.top) === normalizeConstraintValue(right.constraints && right.constraints.top) &&
      normalizeConstraintValue(left.constraints && left.constraints.bottom) === normalizeConstraintValue(right.constraints && right.constraints.bottom)
    );
  }

  function cloneNormalizedLayout(layout) {
    const normalized = normalizeLayout(layout);
    return {
      ...normalized,
      constraints: normalized.constraints ? { ...normalized.constraints } : null
    };
  }

  function offsetLayoutByDelta(layout, dx, dy) {
    const next = cloneNormalizedLayout(layout);

    if (next.constraints) {
      if (dx) {
        if (next.constraints.left !== undefined && next.constraints.right !== undefined) {
          next.constraints.left += dx;
          next.constraints.right -= dx;
        } else if (next.constraints.left !== undefined) {
          next.constraints.left += dx;
        } else if (next.constraints.right !== undefined) {
          next.constraints.right -= dx;
        } else {
          next.x += dx;
        }
      }

      if (dy) {
        if (next.constraints.top !== undefined && next.constraints.bottom !== undefined) {
          next.constraints.top += dy;
          next.constraints.bottom -= dy;
        } else if (next.constraints.top !== undefined) {
          next.constraints.top += dy;
        } else if (next.constraints.bottom !== undefined) {
          next.constraints.bottom -= dy;
        } else {
          next.y += dy;
        }
      }

      return normalizeLayout(next);
    }

    next.x += dx;
    next.y += dy;
    return normalizeLayout(next);
  }

  function resizeLayoutByDelta(layout, direction, dx, dy) {
    const next = cloneNormalizedLayout(layout);
    const horizontalConstraints = next.constraints ? {
      left: next.constraints.left,
      right: next.constraints.right
    } : null;
    const verticalConstraints = next.constraints ? {
      top: next.constraints.top,
      bottom: next.constraints.bottom
    } : null;

    if (direction.includes('e') && dx) {
      if (horizontalConstraints && horizontalConstraints.right !== undefined) {
        next.constraints.right -= dx;
      } else {
        next.width = Math.max(MIN_LAYOUT_SIZE_PX, (next.width || MIN_LAYOUT_SIZE_PX) + dx);
      }
    }

    if (direction.includes('w') && dx) {
      if (horizontalConstraints && horizontalConstraints.left !== undefined && horizontalConstraints.right !== undefined) {
        next.constraints.left += dx;
      } else if (horizontalConstraints && horizontalConstraints.left !== undefined) {
        next.constraints.left += dx;
        next.width = Math.max(MIN_LAYOUT_SIZE_PX, (next.width || MIN_LAYOUT_SIZE_PX) - dx);
      } else if (horizontalConstraints && horizontalConstraints.right !== undefined) {
        next.width = Math.max(MIN_LAYOUT_SIZE_PX, (next.width || MIN_LAYOUT_SIZE_PX) - dx);
      } else {
        next.x += dx;
        next.width = Math.max(MIN_LAYOUT_SIZE_PX, (next.width || MIN_LAYOUT_SIZE_PX) - dx);
      }
    }

    if (direction.includes('s') && dy) {
      if (verticalConstraints && verticalConstraints.bottom !== undefined) {
        next.constraints.bottom -= dy;
      } else {
        next.height = Math.max(MIN_LAYOUT_SIZE_PX, (next.height || MIN_LAYOUT_SIZE_PX) + dy);
      }
    }

    if (direction.includes('n') && dy) {
      if (verticalConstraints && verticalConstraints.top !== undefined && verticalConstraints.bottom !== undefined) {
        next.constraints.top += dy;
      } else if (verticalConstraints && verticalConstraints.top !== undefined) {
        next.constraints.top += dy;
        next.height = Math.max(MIN_LAYOUT_SIZE_PX, (next.height || MIN_LAYOUT_SIZE_PX) - dy);
      } else if (verticalConstraints && verticalConstraints.bottom !== undefined) {
        next.height = Math.max(MIN_LAYOUT_SIZE_PX, (next.height || MIN_LAYOUT_SIZE_PX) - dy);
      } else {
        next.y += dy;
        next.height = Math.max(MIN_LAYOUT_SIZE_PX, (next.height || MIN_LAYOUT_SIZE_PX) - dy);
      }
    }

    return normalizeLayout(next);
  }

  function readSavedLayouts() {
    try {
      const raw = localStorage.getItem(GOD_MODE_LAYOUT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};

      const next = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (!key) return;
        const normalized = normalizeLayout(value);
        if (!isZeroLayout(normalized)) {
          next[key] = normalized;
        }
      });
      return next;
    } catch (error) {
      safeLog('warn', `[GodMode] Failed to read legacy local layouts: ${error.message}`);
      return {};
    }
  }

  function buildPersistableSavedLayouts() {
    const next = {};
    Object.entries(state.savedLayouts).forEach(([key, value]) => {
      const normalized = normalizeLayout(value);
      if (!isZeroLayout(normalized)) {
        next[key] = normalized;
      }
    });
    return next;
  }

  function loadFormalLayoutsFromWindow() {
    return cloneLayoutMap(window.__MKP_LAYOUT_DEFAULTS__ || {});
  }

  async function loadSavedLayoutsFromRuntime() {
    const api = getRuntimeApi();
    if (!api || typeof api.readGodModeLayoutState !== 'function') {
      return {};
    }

    const result = await api.readGodModeLayoutState();
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Unable to read God Mode layout state');
    }

    state.runtimeInfo = result;
    updateDeveloperSettingsMeta(
      `快照目录：${result.directory || '未初始化'} · 当前快照：${getSnapshotLabelFromPath(result.activeSnapshotPath || result.currentPath)}`
    );
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(false);
    return cloneLayoutMap(result.layouts || {});
  }

  async function migrateLegacyLocalStorageLayoutsIfNeeded() {
    const legacyLayouts = readSavedLayouts();
    if (!Object.keys(legacyLayouts).length) {
      return false;
    }

    const runtimeLayouts = state.savedLayouts || {};
    if (Object.keys(runtimeLayouts).length) {
      return false;
    }

    state.savedLayouts = cloneLayoutMap(legacyLayouts);
    await persistSavedLayouts('legacy-local-storage-migration');
    localStorage.removeItem(GOD_MODE_LAYOUT_KEY);
    safeLog('info', '[GodMode] Migrated legacy localStorage layouts into developer snapshot storage');
    return true;
  }

  async function persistSavedLayouts(reason = 'manual-save') {
    const api = getRuntimeApi();
    if (!state.developerMode || !api || typeof api.saveGodModeLayoutSnapshot !== 'function') {
      return null;
    }

    const result = await api.saveGodModeLayoutSnapshot({
      layouts: buildPersistableSavedLayouts(),
      reason
    });

    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Unable to save God Mode layout snapshot');
    }

    state.runtimeInfo = {
      ...(state.runtimeInfo || {}),
      ...result
    };
    updateDeveloperSettingsMeta(
      `快照目录：${result.directory || '未初始化'} · 当前快照：${getSnapshotLabelFromPath(result.snapshotPath || result.currentPath)}`
    );
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(false);
    return result;
  }

  async function restoreSavedLayoutsSnapshot(target) {
    const api = getRuntimeApi();
    if (!state.developerMode || !api || typeof api.restoreGodModeLayoutSnapshot !== 'function') {
      return null;
    }

    const result = await api.restoreGodModeLayoutSnapshot(target);
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Unable to restore God Mode layout snapshot');
    }

    state.runtimeInfo = {
      ...(state.runtimeInfo || {}),
      ...result
    };
    state.savedLayouts = cloneLayoutMap(result.layouts || {});
    state.draftLayouts = {};
    reapplyAllLayouts();
    seedHistorySnapshot(`restore-${target}`);
    if (state.activeTarget) {
      refreshContextMeta(state.activeTarget);
    }
    updateDeveloperSettingsMeta(
      `快照目录：${result.directory || '未初始化'} · 当前快照：${getSnapshotLabelFromPath(result.snapshotPath || result.currentPath)}`
    );
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(false);
    return result;
  }

  async function freezeCurrentLayoutsAsFormalDefaults() {
    const api = getRuntimeApi();
    if (!state.developerMode || !api || typeof api.freezeGodModeLayoutAsFormal !== 'function') {
      return null;
    }

    const result = await api.freezeGodModeLayoutAsFormal({
      layouts: buildPersistableSavedLayouts(),
      source: 'god-mode-freeze'
    });
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : 'Unable to freeze God Mode layout defaults');
    }

    state.formalLayouts = cloneLayoutMap(result.layouts || {});
    state.runtimeInfo = {
      ...(state.runtimeInfo || {}),
      formalDefaultsFile: result.filePath || (state.runtimeInfo && state.runtimeInfo.formalDefaultsFile) || null
    };
    window.__MKP_LAYOUT_DEFAULTS__ = cloneLayoutMap(result.layouts || {});
    window.__MKP_LAYOUT_DEFAULTS_META__ = {
      generatedAt: new Date().toISOString(),
      source: 'god-mode-freeze',
      layoutCount: Object.keys(result.layouts || {}).length
    };
    if (window.__MKP_LAYOUT_DEFAULTS_RUNTIME__ && typeof window.__MKP_LAYOUT_DEFAULTS_RUNTIME__.reapply === 'function') {
      window.__MKP_LAYOUT_DEFAULTS_RUNTIME__.reapply();
    }
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(false);
    return result;
  }

  async function initializeRuntimeState() {
    const api = getRuntimeApi();
    let runtimeState = null;

    if (api && typeof api.getGodModeRuntimeState === 'function') {
      runtimeState = await api.getGodModeRuntimeState();
    }

    state.runtimeInfo = runtimeState && runtimeState.success === true ? runtimeState : null;
    state.developerMode = Boolean(runtimeState && runtimeState.success === true && runtimeState.isDeveloperMode);

    syncDeveloperSettingsVisibility();
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(true);

    state.formalLayouts = loadFormalLayoutsFromWindow();

    if (!state.developerMode) {
      state.savedLayouts = cloneLayoutMap(state.formalLayouts);
      state.draftLayouts = {};
      return;
    }

    let runtimeLayouts = await loadSavedLayoutsFromRuntime();
    let migrated = false;
    if (!Object.keys(runtimeLayouts).length) {
      migrated = await migrateLegacyLocalStorageLayoutsIfNeeded();
      if (migrated) {
        runtimeLayouts = await loadSavedLayoutsFromRuntime();
      }
    }

    state.savedLayouts = Object.keys(runtimeLayouts).length
      ? runtimeLayouts
      : cloneLayoutMap(state.formalLayouts);

    state.draftLayouts = {};
    updateDeveloperSettingsMeta();
    updateDeveloperSettingsButtonsState(false);
  }

  function getMergedLayout(key) {
    return normalizeLayout({
      ...(state.savedLayouts[key] || {}),
      ...(state.draftLayouts[key] || {})
    });
  }

  function cloneLayoutMap(map) {
    const next = {};
    Object.entries(map || {}).forEach(([key, value]) => {
      next[key] = normalizeLayout(value);
    });
    return next;
  }

  function serializeHistorySnapshot(snapshot) {
    return JSON.stringify({
      savedLayouts: snapshot.savedLayouts,
      draftLayouts: snapshot.draftLayouts,
      activeKey: snapshot.activeKey || null
    });
  }

  function createHistorySnapshot(label = '') {
    return {
      label,
      savedLayouts: cloneLayoutMap(state.savedLayouts),
      draftLayouts: cloneLayoutMap(state.draftLayouts),
      activeKey: state.activeTarget ? getElementKey(state.activeTarget) : null
    };
  }

  function formatSignedPixels(value) {
    const rounded = Math.round(Number(value) || 0);
    return `${rounded >= 0 ? '+' : '-'}${Math.abs(rounded)} px`;
  }

  function buildElementSelector(element) {
    if (!(element instanceof Element)) return null;
    if (element.id) return `#${safeCssEscape(element.id)}`;

    const segments = [];
    let current = element;

    while (current && current !== document.body) {
      if (current.id) {
        segments.unshift(`#${safeCssEscape(current.id)}`);
        break;
      }

      const parent = current.parentElement;
      if (!parent) break;

      const sameTypeSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = sameTypeSiblings.indexOf(current) + 1;
      segments.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
      current = parent;
    }

    if (!segments.length) return null;
    if (segments[0].startsWith('#')) return segments.join(' > ');
    return `body > ${segments.join(' > ')}`;
  }

  function getElementKey(element) {
    if (!(element instanceof Element)) return null;
    const cached = element.getAttribute('data-god-mode-key');
    if (cached) return cached;
    const key = buildElementSelector(element);
    if (!key) return null;
    element.setAttribute('data-god-mode-key', key);
    return key;
  }

  function resolveElementByKey(key) {
    if (!key) return null;
    try {
      return document.querySelector(key);
    } catch (error) {
      safeLog('warn', `[GodMode] Invalid selector skipped: ${key}`);
      return null;
    }
  }

  function resolveRenderableTarget(target) {
    let element = target;
    if (target && target.nodeType === Node.TEXT_NODE) {
      element = target.parentElement;
    }

    if (!(element instanceof Element)) return null;
    if (element.closest('[data-god-mode-ui="true"]')) return null;

    const tagName = element.tagName.toLowerCase();
    if (SVG_CHILD_TAGS.has(tagName) && element.closest('svg')) {
      element = element.closest('svg');
    }

    while (element && IGNORED_TAGS.has(element.tagName.toLowerCase())) {
      element = element.parentElement;
    }

    if (!element || element === document.documentElement || element === document.body) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return null;

    return element;
  }

  function describeElement(element) {
    if (!(element instanceof Element)) return '未命名元素';
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}#${element.id}`;

    const className = Array.from(element.classList || [])
      .filter((name) => !name.startsWith('dark:') && !name.startsWith('hover:'))
      .slice(0, 2)
      .join('.');
    if (className) return `${tag}.${className}`;

    const text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    if (text) return `${tag} · ${text}`;
    return tag;
  }

  function getAncestorRenderableTarget(target, levels = 1) {
    if (!(target instanceof Element)) return null;

    let current = target;
    for (let step = 0; step < levels; step += 1) {
      let walker = current.parentElement;
      let found = null;

      while (walker) {
        const candidate = resolveRenderableTarget(walker);
        if (candidate && candidate !== current) {
          found = candidate;
          break;
        }
        walker = walker.parentElement;
      }

      if (!found) return null;
      current = found;
    }

    return current;
  }

  function ensureUi() {
    if (state.ui.root) return;

    const root = document.createElement('div');
    root.setAttribute('data-god-mode-ui', 'true');

    const menu = document.createElement('div');
    menu.className = 'god-mode-floating god-mode-context-menu hidden';
    menu.setAttribute('data-god-mode-ui', 'true');
    menu.innerHTML = [
      '<div class="god-mode-context-head">',
      '  <div class="god-mode-context-title" data-god-mode-menu-title>未选择对象</div>',
      '  <div class="god-mode-context-meta" data-god-mode-menu-meta>偏移 X +0 px / Y +0 px</div>',
      '</div>',
      '<div class="god-mode-context-actions">',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="parent">选中父级</button>',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="grandparent">选中父级的父级</button>',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="move">移动</button>',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="edge-gap">固定边距</button>',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="input">输入 XY</button>',
      '  <button type="button" class="god-mode-context-btn" data-god-mode-action="save">保存位置</button>',
      '  <button type="button" class="god-mode-context-btn is-danger" data-god-mode-action="restore">恢复原始位置</button>',
      '</div>'
    ].join('');

    const input = document.createElement('div');
    input.className = 'god-mode-floating god-mode-input-panel hidden';
    input.setAttribute('data-god-mode-ui', 'true');
    input.innerHTML = [
      '<div class="god-mode-input-head">',
      '  <div class="god-mode-input-title" data-god-mode-input-title>输入偏移 XY</div>',
      '  <div class="god-mode-input-desc" data-god-mode-input-desc>这里填写的是相对原始位置的像素偏移。</div>',
      '</div>',
      '<div class="god-mode-input-body">',
      '  <div class="god-mode-input-grid">',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeInputX">X 偏移</label>',
      '      <input id="godModeInputX" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeInputY">Y 偏移</label>',
      '      <input id="godModeInputY" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '  </div>',
      '  <div class="god-mode-input-error" data-god-mode-input-error></div>',
      '  <div class="god-mode-input-actions">',
      '    <button type="button" class="god-mode-btn-secondary" data-god-mode-input-action="apply">仅应用</button>',
      '    <button type="button" class="god-mode-btn-primary" data-god-mode-input-action="apply-save">应用并保存</button>',
      '    <button type="button" class="god-mode-btn-ghost" data-god-mode-input-action="cancel">取消</button>',
      '  </div>',
      '</div>'
    ].join('');

    const constraint = document.createElement('div');
    constraint.className = 'god-mode-floating god-mode-input-panel god-mode-constraint-panel hidden';
    constraint.setAttribute('data-god-mode-ui', 'true');
    constraint.innerHTML = [
      '<div class="god-mode-input-head">',
      '  <div class="god-mode-input-title" data-god-mode-constraint-title>固定边距</div>',
      '  <div class="god-mode-input-desc" data-god-mode-constraint-desc>相对于父容器四边。留空表示不处理，左右同时填写会自动改宽度，上下同时填写会自动改高度。</div>',
      '</div>',
      '<div class="god-mode-input-body">',
      '  <div class="god-mode-input-grid god-mode-input-grid-quad">',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeConstraintLeft">左边距</label>',
      '      <input id="godModeConstraintLeft" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeConstraintRight">右边距</label>',
      '      <input id="godModeConstraintRight" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeConstraintTop">上边距</label>',
      '      <input id="godModeConstraintTop" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '    <div class="god-mode-input-field">',
      '      <label for="godModeConstraintBottom">下边距</label>',
      '      <input id="godModeConstraintBottom" type="number" step="1" inputmode="numeric">',
      '    </div>',
      '  </div>',
      '  <div class="god-mode-input-error" data-god-mode-constraint-error></div>',
      '  <div class="god-mode-input-actions">',
      '    <button type="button" class="god-mode-btn-secondary" data-god-mode-constraint-action="apply">仅应用</button>',
      '    <button type="button" class="god-mode-btn-primary" data-god-mode-constraint-action="apply-save">应用并保存</button>',
      '    <button type="button" class="god-mode-btn-ghost" data-god-mode-constraint-action="cancel">取消</button>',
      '  </div>',
      '</div>'
    ].join('');

    const selectionFrame = document.createElement('div');
    selectionFrame.className = 'god-mode-selection-frame hidden';
    selectionFrame.setAttribute('data-god-mode-ui', 'true');
    selectionFrame.innerHTML = [
      '<div class="god-mode-selection-edge is-n" data-god-mode-selection-edge="n" data-god-mode-resize-handle="n"></div>',
      '<div class="god-mode-selection-edge is-e" data-god-mode-selection-edge="e" data-god-mode-resize-handle="e"></div>',
      '<div class="god-mode-selection-edge is-s" data-god-mode-selection-edge="s" data-god-mode-resize-handle="s"></div>',
      '<div class="god-mode-selection-edge is-w" data-god-mode-selection-edge="w" data-god-mode-resize-handle="w"></div>',
      '<div class="god-mode-selection-handle is-nw" data-god-mode-resize-handle="nw"></div>',
      '<div class="god-mode-selection-handle is-n" data-god-mode-resize-handle="n"></div>',
      '<div class="god-mode-selection-handle is-ne" data-god-mode-resize-handle="ne"></div>',
      '<div class="god-mode-selection-handle is-e" data-god-mode-resize-handle="e"></div>',
      '<div class="god-mode-selection-handle is-se" data-god-mode-resize-handle="se"></div>',
      '<div class="god-mode-selection-handle is-s" data-god-mode-resize-handle="s"></div>',
      '<div class="god-mode-selection-handle is-sw" data-god-mode-resize-handle="sw"></div>',
      '<div class="god-mode-selection-handle is-w" data-god-mode-resize-handle="w"></div>'
    ].join('');

    const helper = document.createElement('div');
    helper.className = 'god-mode-helper hidden';
    helper.setAttribute('data-god-mode-ui', 'true');

    const lineX = document.createElement('div');
    lineX.className = 'god-mode-snap-line god-mode-snap-line-x hidden';
    lineX.setAttribute('data-god-mode-ui', 'true');

    const lineY = document.createElement('div');
    lineY.className = 'god-mode-snap-line god-mode-snap-line-y hidden';
    lineY.setAttribute('data-god-mode-ui', 'true');

    root.appendChild(menu);
    root.appendChild(input);
    root.appendChild(constraint);
    root.appendChild(selectionFrame);
    root.appendChild(helper);
    root.appendChild(lineX);
    root.appendChild(lineY);
    document.body.appendChild(root);

    state.ui.root = root;
    state.ui.menu = menu;
    state.ui.menuTitle = menu.querySelector('[data-god-mode-menu-title]');
    state.ui.menuMeta = menu.querySelector('[data-god-mode-menu-meta]');
    state.ui.menuParent = menu.querySelector('[data-god-mode-action="parent"]');
    state.ui.menuGrandParent = menu.querySelector('[data-god-mode-action="grandparent"]');
    state.ui.input = input;
    state.ui.inputTitle = input.querySelector('[data-god-mode-input-title]');
    state.ui.inputDesc = input.querySelector('[data-god-mode-input-desc]');
    state.ui.inputX = input.querySelector('#godModeInputX');
    state.ui.inputY = input.querySelector('#godModeInputY');
    state.ui.inputError = input.querySelector('[data-god-mode-input-error]');
    state.ui.constraint = constraint;
    state.ui.constraintTitle = constraint.querySelector('[data-god-mode-constraint-title]');
    state.ui.constraintDesc = constraint.querySelector('[data-god-mode-constraint-desc]');
    state.ui.constraintLeft = constraint.querySelector('#godModeConstraintLeft');
    state.ui.constraintRight = constraint.querySelector('#godModeConstraintRight');
    state.ui.constraintTop = constraint.querySelector('#godModeConstraintTop');
    state.ui.constraintBottom = constraint.querySelector('#godModeConstraintBottom');
    state.ui.constraintError = constraint.querySelector('[data-god-mode-constraint-error]');
    state.ui.selectionFrame = selectionFrame;
    state.ui.settingsRow = document.getElementById('settingGodModeRow');
    state.ui.settingsMeta = document.getElementById('settingGodModeMeta');
    state.ui.settingsOpenFolder = document.getElementById('btnGodModeOpenFolder');
    state.ui.settingsRestorePrevious = document.getElementById('btnGodModeRestorePrevious');
    state.ui.settingsRestoreInitial = document.getElementById('btnGodModeRestoreInitial');
    state.ui.settingsFreezeFormal = document.getElementById('btnGodModeFreezeFormal');
    state.ui.helper = helper;
    state.ui.lineX = lineX;
    state.ui.lineY = lineY;

    menu.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const button = event.target.closest('[data-god-mode-action]');
      if (!button || !state.activeTarget) return;
      if (button.disabled) return;

      const action = button.getAttribute('data-god-mode-action');
      if (action === 'parent') {
        const parentTarget = getAncestorRenderableTarget(state.activeTarget, 1);
        if (parentTarget) {
          openContextMenu(parentTarget, state.menuPoint.x, state.menuPoint.y);
        }
      } else if (action === 'grandparent') {
        const grandParentTarget = getAncestorRenderableTarget(state.activeTarget, 2);
        if (grandParentTarget) {
          openContextMenu(grandParentTarget, state.menuPoint.x, state.menuPoint.y);
        }
      } else if (action === 'move') {
        armMoveMode(state.activeTarget, event);
      } else if (action === 'edge-gap') {
        openConstraintPanel(state.activeTarget);
      } else if (action === 'input') {
        openInputPanel(state.activeTarget);
      } else if (action === 'save') {
        saveTargetLayout(state.activeTarget);
        closeContextMenu({ keepSelection: true });
      } else if (action === 'restore') {
        restoreTargetLayout(state.activeTarget);
        closeContextMenu({ keepSelection: false });
      }
    });

    if (state.ui.settingsFreezeFormal) {
      state.ui.settingsFreezeFormal.addEventListener('click', async () => {
        try {
          const result = await freezeCurrentLayoutsAsFormalDefaults();
          showHelper(`Formal layout frozen: ${getSnapshotLabelFromPath(result && result.filePath)}`, {
            timeoutMs: 1800
          });
        } catch (error) {
          showHelper(`Freeze failed: ${error.message}`, { timeoutMs: 2200 });
        }
      });
    }

    input.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyInputOffsets({ saveAfter: false });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeInputPanel({ keepSelection: false });
      }
    });

    constraint.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    constraint.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyConstraintOffsets({ saveAfter: false });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeConstraintPanel({ keepSelection: false });
      }
    });

    constraint.addEventListener('click', (event) => {
      const button = event.target.closest('[data-god-mode-constraint-action]');
      if (!button) return;

      const action = button.getAttribute('data-god-mode-constraint-action');
      if (action === 'apply') {
        applyConstraintOffsets({ saveAfter: false });
      } else if (action === 'apply-save') {
        applyConstraintOffsets({ saveAfter: true });
      } else if (action === 'cancel') {
        closeConstraintPanel({ keepSelection: false });
      }
    });

    selectionFrame.addEventListener('pointerdown', (event) => {
      const handle = event.target.closest('[data-god-mode-resize-handle]');
      if (!handle || !state.activeTarget) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      startResizeSession(state.activeTarget, handle.getAttribute('data-god-mode-resize-handle'), event);
    });

    selectionFrame.addEventListener('contextmenu', (event) => {
      const handle = event.target.closest('[data-god-mode-resize-handle]');
      if (!handle || !state.activeTarget) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      openContextMenu(state.activeTarget, event.clientX, event.clientY);
    });

    if (state.ui.settingsOpenFolder) {
      state.ui.settingsOpenFolder.addEventListener('click', async () => {
        try {
          const result = await getRuntimeApi().openGodModeLayoutFolder();
          if (!result || result.success !== true) {
            throw new Error(result && result.error ? result.error : '无法打开快照目录');
          }
          showHelper('已打开布局快照目录', { timeoutMs: 1400 });
        } catch (error) {
          showHelper(`打开目录失败：${error.message}`, { timeoutMs: 1800 });
        }
      });
    }

    if (state.ui.settingsRestorePrevious) {
      state.ui.settingsRestorePrevious.addEventListener('click', async () => {
        try {
          await restoreSavedLayoutsSnapshot('previous');
          showHelper('已回退到上一版布局快照', { timeoutMs: 1500 });
        } catch (error) {
          showHelper(`回退失败：${error.message}`, { timeoutMs: 1800 });
        }
      });
    }

    if (state.ui.settingsRestoreInitial) {
      state.ui.settingsRestoreInitial.addEventListener('click', async () => {
        try {
          await restoreSavedLayoutsSnapshot('initial');
          showHelper('已恢复到初始布局快照', { timeoutMs: 1500 });
        } catch (error) {
          showHelper(`恢复失败：${error.message}`, { timeoutMs: 1800 });
        }
      });
    }

    input.addEventListener('click', (event) => {
      const button = event.target.closest('[data-god-mode-input-action]');
      if (!button) return;

      const action = button.getAttribute('data-god-mode-input-action');
      if (action === 'apply') {
        applyInputOffsets({ saveAfter: false });
      } else if (action === 'apply-save') {
        applyInputOffsets({ saveAfter: true });
      } else if (action === 'cancel') {
        closeInputPanel({ keepSelection: false });
      }
    });
  }

  function showFloating(element) {
    if (!element) return;
    clearTimeout(element._godModeHideTimer);
    element.classList.remove('hidden');
    requestAnimationFrame(() => {
      element.classList.add('is-visible');
    });
  }

  function hideFloating(element) {
    if (!element || element.classList.contains('hidden')) return;
    element.classList.remove('is-visible');
    clearTimeout(element._godModeHideTimer);
    element._godModeHideTimer = setTimeout(() => {
      element.classList.add('hidden');
    }, FLOATING_HIDE_DELAY_MS);
  }

  function positionFloating(element, x, y) {
    if (!element) return;
    const margin = 12;
    const rect = element.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const nextLeft = Math.min(Math.max(margin, x), maxLeft);
    const nextTop = Math.min(Math.max(margin, y), maxTop);
    element.style.left = `${nextLeft}px`;
    element.style.top = `${nextTop}px`;
  }

  function showHelper(message, options = {}) {
    ensureUi();
    clearTimeout(state.helperTimer);
    state.ui.helper.textContent = message;
    state.ui.helper.classList.remove('hidden');
    if (!options.sticky) {
      state.helperTimer = setTimeout(() => {
        hideHelper();
      }, options.timeoutMs || 1800);
    }
  }

  function hideHelper() {
    clearTimeout(state.helperTimer);
    if (state.ui.helper) {
      state.ui.helper.classList.add('hidden');
    }
  }

  function hideSelectionFrame() {
    if (!state.ui.selectionFrame) return;
    state.ui.selectionFrame.classList.add('hidden');
  }

  function syncSelectionFrame() {
    ensureUi();

    if (!state.enabled || !state.activeTarget || !document.body.contains(state.activeTarget)) {
      hideSelectionFrame();
      return;
    }

    const rect = state.activeTarget.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      hideSelectionFrame();
      return;
    }

    state.ui.selectionFrame.style.left = `${Math.round(rect.left)}px`;
    state.ui.selectionFrame.style.top = `${Math.round(rect.top)}px`;
    state.ui.selectionFrame.style.width = `${Math.round(rect.width)}px`;
    state.ui.selectionFrame.style.height = `${Math.round(rect.height)}px`;
    state.ui.selectionFrame.classList.remove('hidden');
  }

  function scheduleSelectionFrameSync() {
    if (state.frameSyncFrame) return;
    state.frameSyncFrame = requestAnimationFrame(() => {
      state.frameSyncFrame = 0;
      syncSelectionFrame();
    });
  }

  function setSelectedTarget(target) {
    if (state.activeTarget === target) return;
    if (state.activeTarget) {
      state.activeTarget.classList.remove('god-mode-selected');
    }
    state.activeTarget = target;
    if (state.activeTarget) {
      state.activeTarget.classList.add('god-mode-selected');
    }
    scheduleSelectionFrameSync();
  }

  function clearSelectedTarget() {
    if (state.activeTarget) {
      state.activeTarget.classList.remove('god-mode-selected');
    }
    state.activeTarget = null;
    hideSelectionFrame();
  }

  function maybeClearSelectedTarget() {
    if (state.dragSession || state.pointerMoveSession || state.resizeSession || state.pendingMoveTarget || !state.activeTarget) return;
    const menuOpen = state.ui.menu && !state.ui.menu.classList.contains('hidden');
    const inputOpen = state.ui.input && !state.ui.input.classList.contains('hidden');
    const constraintOpen = state.ui.constraint && !state.ui.constraint.classList.contains('hidden');
    if (!menuOpen && !inputOpen && !constraintOpen) {
      clearSelectedTarget();
    }
  }

  function getConstraintContainerElement(target) {
    return target && target.parentElement ? target.parentElement : null;
  }

  function captureAppliedElementState(element) {
    if (!(element instanceof Element)) return null;
    return {
      hasOffsetClass: element.classList.contains('god-mode-offset'),
      offsetX: element.style.getPropertyValue('--god-mode-offset-x'),
      offsetY: element.style.getPropertyValue('--god-mode-offset-y'),
      hasSizedClass: element instanceof HTMLElement ? element.classList.contains('god-mode-sized') : false,
      widthStyle: element instanceof HTMLElement ? element.style.getPropertyValue('width') : '',
      heightStyle: element instanceof HTMLElement ? element.style.getPropertyValue('height') : ''
    };
  }

  function restoreCapturedElementState(element, snapshot) {
    if (!(element instanceof Element) || !snapshot) return;

    if (snapshot.hasOffsetClass) {
      element.classList.add('god-mode-offset');
      element.style.setProperty('--god-mode-offset-x', snapshot.offsetX || '0px');
      element.style.setProperty('--god-mode-offset-y', snapshot.offsetY || '0px');
    } else {
      element.classList.remove('god-mode-offset');
      element.style.removeProperty('--god-mode-offset-x');
      element.style.removeProperty('--god-mode-offset-y');
    }

    if (element instanceof HTMLElement) {
      if (snapshot.hasSizedClass) {
        element.classList.add('god-mode-sized');
      } else {
        element.classList.remove('god-mode-sized');
      }

      if (snapshot.widthStyle) {
        element.style.setProperty('width', snapshot.widthStyle);
      } else {
        restoreOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
      }

      if (snapshot.heightStyle) {
        element.style.setProperty('height', snapshot.heightStyle);
      } else {
        restoreOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
      }
    }
  }

  function measureBaseRect(element) {
    if (!(element instanceof Element)) {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0
      };
    }

    const snapshot = captureAppliedElementState(element);
    element.classList.remove('god-mode-offset');
    element.style.removeProperty('--god-mode-offset-x');
    element.style.removeProperty('--god-mode-offset-y');

    if (element instanceof HTMLElement) {
      element.classList.remove('god-mode-sized');
      restoreOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
      restoreOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
    }

    const rect = element.getBoundingClientRect();
    restoreCapturedElementState(element, snapshot);
    return rect;
  }

  function resolveEffectiveLayoutForElement(element, layout) {
    const normalized = normalizeLayout(layout);
    if (!normalized.constraints) {
      return normalized;
    }

    const baseRect = measureBaseRect(element);
    const containerRect = getConstraintContainerRect(element);
    const next = {
      ...normalized
    };

    let visualWidth = normalized.width ?? Math.round(baseRect.width);
    let visualHeight = normalized.height ?? Math.round(baseRect.height);

    if (normalized.constraints.left !== undefined && normalized.constraints.right !== undefined) {
      visualWidth = Math.max(
        MIN_LAYOUT_SIZE_PX,
        Math.round(containerRect.width - normalized.constraints.left - normalized.constraints.right)
      );
    }

    if (normalized.constraints.top !== undefined && normalized.constraints.bottom !== undefined) {
      visualHeight = Math.max(
        MIN_LAYOUT_SIZE_PX,
        Math.round(containerRect.height - normalized.constraints.top - normalized.constraints.bottom)
      );
    }

    let visualLeft = baseRect.left + normalized.x;
    let visualTop = baseRect.top + normalized.y;

    if (normalized.constraints.left !== undefined) {
      visualLeft = containerRect.left + normalized.constraints.left;
    } else if (normalized.constraints.right !== undefined) {
      visualLeft = containerRect.right - normalized.constraints.right - visualWidth;
    }

    if (normalized.constraints.top !== undefined) {
      visualTop = containerRect.top + normalized.constraints.top;
    } else if (normalized.constraints.bottom !== undefined) {
      visualTop = containerRect.bottom - normalized.constraints.bottom - visualHeight;
    }

    next.x = Math.round(visualLeft - baseRect.left);
    next.y = Math.round(visualTop - baseRect.top);
    next.width = (
      normalized.width !== null ||
      normalized.constraints.left !== undefined ||
      normalized.constraints.right !== undefined
    ) ? visualWidth : null;
    next.height = (
      normalized.height !== null ||
      normalized.constraints.top !== undefined ||
      normalized.constraints.bottom !== undefined
    ) ? visualHeight : null;

    return next;
  }

  function syncConstraintSnapshotFromElement(target, layout) {
    const normalized = normalizeLayout(layout);
    if (!normalized.constraints || !(target instanceof Element)) {
      return normalized;
    }

    const rect = target.getBoundingClientRect();
    const containerRect = getConstraintContainerRect(target);
    const next = {
      ...normalized,
      width: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.width)),
      height: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.height)),
      constraints: {
        ...normalized.constraints
      }
    };

    if (next.constraints.left !== undefined) {
      next.constraints.left = Math.round(rect.left - containerRect.left);
    }
    if (next.constraints.right !== undefined) {
      next.constraints.right = Math.round(containerRect.right - rect.right);
    }
    if (next.constraints.top !== undefined) {
      next.constraints.top = Math.round(rect.top - containerRect.top);
    }
    if (next.constraints.bottom !== undefined) {
      next.constraints.bottom = Math.round(containerRect.bottom - rect.bottom);
    }

    return normalizeLayout(next);
  }

  function refreshConstraintObservers() {
    if (!state.constraintResizeObserver) return;

    state.observedConstraintContainers.forEach((element) => {
      try {
        state.constraintResizeObserver.unobserve(element);
      } catch (error) {
        safeLog('warn', `[GodMode] Failed to unobserve container: ${error.message}`);
      }
    });
    state.observedConstraintContainers.clear();

    const keys = new Set([
      ...Object.keys(state.savedLayouts),
      ...Object.keys(state.draftLayouts)
    ]);

    keys.forEach((key) => {
      const merged = getMergedLayout(key);
      if (!merged.constraints) return;
      const element = resolveElementByKey(key);
      const container = getConstraintContainerElement(element);
      if (!container || state.observedConstraintContainers.has(container)) return;
      state.constraintResizeObserver.observe(container);
      state.observedConstraintContainers.add(container);
    });
  }

  function rememberOriginalInlineDimension(element, propertyName, attributeName) {
    if (!(element instanceof HTMLElement)) return;
    if (element.hasAttribute(attributeName)) return;
    const inlineValue = element.style.getPropertyValue(propertyName);
    element.setAttribute(attributeName, inlineValue || EMPTY_INLINE_STYLE_TOKEN);
  }

  function restoreOriginalInlineDimension(element, propertyName, attributeName) {
    if (!(element instanceof HTMLElement)) return;
    const inlineValue = element.getAttribute(attributeName);
    if (!inlineValue || inlineValue === EMPTY_INLINE_STYLE_TOKEN) {
      element.style.removeProperty(propertyName);
      return;
    }
    element.style.setProperty(propertyName, inlineValue);
  }

  function applyLayoutToElement(element, layout) {
    if (!(element instanceof Element)) return;
    const normalized = resolveEffectiveLayoutForElement(element, layout);
    const hasOffset = normalized.x !== 0 || normalized.y !== 0;
    const hasSize = normalized.width !== null || normalized.height !== null;

    if (!hasOffset) {
      element.classList.remove('god-mode-offset');
      element.style.removeProperty('--god-mode-offset-x');
      element.style.removeProperty('--god-mode-offset-y');
    } else {
      element.classList.add('god-mode-offset');
      element.style.setProperty('--god-mode-offset-x', `${normalized.x}px`);
      element.style.setProperty('--god-mode-offset-y', `${normalized.y}px`);
    }

    if (element instanceof HTMLElement) {
      if (hasSize) {
        rememberOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
        rememberOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
        element.classList.add('god-mode-sized');

        if (normalized.width === null) {
          restoreOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
        } else {
          element.style.setProperty('width', `${normalized.width}px`);
        }

        if (normalized.height === null) {
          restoreOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
        } else {
          element.style.setProperty('height', `${normalized.height}px`);
        }
      } else {
        element.classList.remove('god-mode-sized');
        restoreOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
        restoreOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
      }
    }
  }

  function reapplyAllLayouts() {
    document.querySelectorAll('.god-mode-offset').forEach((element) => {
      element.classList.remove('god-mode-offset');
      element.style.removeProperty('--god-mode-offset-x');
      element.style.removeProperty('--god-mode-offset-y');
    });

    document.querySelectorAll('.god-mode-sized').forEach((element) => {
      element.classList.remove('god-mode-sized');
      restoreOriginalInlineDimension(element, 'width', 'data-god-mode-origin-width');
      restoreOriginalInlineDimension(element, 'height', 'data-god-mode-origin-height');
    });

    const keys = new Set([
      ...Object.keys(state.savedLayouts),
      ...Object.keys(state.draftLayouts)
    ]);

    keys.forEach((key) => {
      const element = resolveElementByKey(key);
      if (!element) return;
      applyLayoutToElement(element, getMergedLayout(key));
    });

    refreshConstraintObservers();
    scheduleSelectionFrameSync();
  }

  function restoreHistorySnapshot(snapshot, options = {}) {
    state.savedLayouts = cloneLayoutMap(snapshot.savedLayouts);
    state.draftLayouts = cloneLayoutMap(snapshot.draftLayouts);
    reapplyAllLayouts();

    if (options.restoreSelection !== false && snapshot.activeKey) {
      const nextTarget = resolveElementByKey(snapshot.activeKey);
      if (nextTarget) {
        setSelectedTarget(nextTarget);
      } else {
        clearSelectedTarget();
      }
    } else if (options.restoreSelection === false) {
      clearSelectedTarget();
    }

    if (state.activeTarget) {
      refreshContextMeta(state.activeTarget);
    }
  }

  function commitHistorySnapshot(label = '') {
    const snapshot = createHistorySnapshot(label);
    const serialized = serializeHistorySnapshot(snapshot);
    const lastSnapshot = state.historyPast[state.historyPast.length - 1];
    const lastSerialized = lastSnapshot ? serializeHistorySnapshot(lastSnapshot) : null;

    if (serialized === lastSerialized) return;

    state.historyPast.push(snapshot);
    if (state.historyPast.length > 120) {
      state.historyPast.shift();
    }
    state.historyFuture = [];
  }

  function seedHistorySnapshot(label = 'seed') {
    state.historyPast = [createHistorySnapshot(label)];
    state.historyFuture = [];
  }

  function undoHistory() {
    if (state.historyPast.length <= 1) return false;

    const current = state.historyPast.pop();
    state.historyFuture.push(current);
    const previous = state.historyPast[state.historyPast.length - 1];
    restoreHistorySnapshot(previous);
    showHelper('撤回', { timeoutMs: 900 });
    return true;
  }

  function redoHistory() {
    if (!state.historyFuture.length) return false;

    const snapshot = state.historyFuture.pop();
    state.historyPast.push(snapshot);
    restoreHistorySnapshot(snapshot);
    showHelper('重做', { timeoutMs: 900 });
    return true;
  }

  function applyDraftLayout(target, layout) {
    const key = getElementKey(target);
    if (!key) return;

    let normalized = normalizeLayout(layout);
    applyLayoutToElement(target, normalized);
    normalized = syncConstraintSnapshotFromElement(target, normalized);
    const saved = normalizeLayout(state.savedLayouts[key] || {});

    if (areLayoutsEqual(saved, normalized)) {
      delete state.draftLayouts[key];
    } else {
      state.draftLayouts[key] = normalized;
    }

    applyLayoutToElement(target, normalized);
    refreshContextMeta(target);
    refreshConstraintObservers();
    scheduleSelectionFrameSync();
  }

  function saveTargetLayout(target) {
    const key = getElementKey(target);
    if (!key) return;

    const merged = getMergedLayout(key);
    if (isZeroLayout(merged)) {
      delete state.savedLayouts[key];
    } else {
      state.savedLayouts[key] = merged;
    }

    delete state.draftLayouts[key];
    void persistSavedLayouts('save-target-layout')
      .then(() => {
        updateDeveloperSettingsButtonsState(false);
      })
      .catch((error) => {
      safeLog('error', `[GodMode] Snapshot save failed: ${error.message}`);
      showHelper(`布局快照保存失败：${error.message}`, { timeoutMs: 2200 });
    });
    applyLayoutToElement(target, merged);
    refreshContextMeta(target);
    refreshConstraintObservers();
    commitHistorySnapshot('save');
    showHelper(`已保存 ${describeElement(target)} 的位置`, { timeoutMs: 1400 });
    safeLog('info', `[GodMode] Saved layout ${key} => ${JSON.stringify(merged)}`);
  }

  function restoreTargetLayout(target) {
    const key = getElementKey(target);
    if (!key) return;

    delete state.draftLayouts[key];
    const formalLayout = state.formalLayouts[key];
    if (formalLayout) {
      state.savedLayouts[key] = cloneNormalizedLayout(formalLayout);
    } else {
      delete state.savedLayouts[key];
    }
    void persistSavedLayouts('restore-target-layout')
      .then(() => {
        updateDeveloperSettingsButtonsState(false);
      })
      .catch((error) => {
      safeLog('error', `[GodMode] Snapshot restore persist failed: ${error.message}`);
      showHelper(`布局快照写入失败：${error.message}`, { timeoutMs: 2200 });
    });
    applyLayoutToElement(target, {});
    if (state.dragSession && state.dragSession.key === key) {
      finishMoveSession({ cancel: true });
    }
    if (state.pointerMoveSession && state.pointerMoveSession.key === key) {
      finishPointerMoveSession({ cancel: true });
    }
    if (state.resizeSession && state.resizeSession.key === key) {
      finishResizeSession({ cancel: true });
    }
    refreshContextMeta(target);
    refreshConstraintObservers();
    commitHistorySnapshot('restore');
    showHelper(`已恢复 ${describeElement(target)} 的原始位置`, { timeoutMs: 1400 });
    safeLog('info', `[GodMode] Restored layout ${key}`);
  }

  function refreshContextMeta(target) {
    if (!target || !state.ui.menuMeta || !state.ui.menuTitle) return;
    const key = getElementKey(target);
    const merged = key ? getMergedLayout(key) : normalizeLayout({});
    const isDirty = Boolean(key && state.draftLayouts[key]);
    const parentTarget = getAncestorRenderableTarget(target, 1);
    const grandParentTarget = getAncestorRenderableTarget(target, 2);
    const rect = target.getBoundingClientRect();
    const widthText = `${Math.round(rect.width)} px`;
    const heightText = `${Math.round(rect.height)} px`;

    if (state.ui.menuParent) {
      state.ui.menuParent.disabled = !parentTarget;
      state.ui.menuParent.setAttribute('aria-disabled', String(!parentTarget));
      state.ui.menuParent.textContent = parentTarget ? `选中父级 · ${describeElement(parentTarget)}` : '选中父级';
    }

    if (state.ui.menuGrandParent) {
      state.ui.menuGrandParent.disabled = !grandParentTarget;
      state.ui.menuGrandParent.setAttribute('aria-disabled', String(!grandParentTarget));
      state.ui.menuGrandParent.textContent = grandParentTarget
        ? `选中父级的父级 · ${describeElement(grandParentTarget)}`
        : '选中父级的父级';
    }

    state.ui.menuTitle.textContent = describeElement(target);
    state.ui.menuMeta.textContent = `偏移 X ${formatSignedPixels(merged.x)} / Y ${formatSignedPixels(merged.y)} · 宽 ${widthText} / 高 ${heightText}${isDirty ? ' · 未保存' : ''}`;
  }

  function openContextMenu(target, x, y) {
    ensureUi();
    setSelectedTarget(target);
    refreshContextMeta(target);
    state.menuPoint = { x, y };
    hideFloating(state.ui.input);
    hideFloating(state.ui.constraint);
    showFloating(state.ui.menu);
    requestAnimationFrame(() => {
      positionFloating(state.ui.menu, x, y);
    });
  }

  function closeContextMenu(options = {}) {
    hideFloating(state.ui.menu);
    if (!options.keepSelection) {
      setTimeout(() => {
        maybeClearSelectedTarget();
      }, FLOATING_HIDE_DELAY_MS + 10);
    }
  }

  function openInputPanel(target) {
    ensureUi();
    setSelectedTarget(target);
    const key = getElementKey(target);
    const merged = key ? getMergedLayout(key) : normalizeLayout({});

    state.ui.inputTitle.textContent = `输入偏移 XY · ${describeElement(target)}`;
    state.ui.inputDesc.textContent = '这里填写的是相对原始位置的像素偏移，支持负数，结果会自动取整。';
    state.ui.inputX.value = String(merged.x);
    state.ui.inputY.value = String(merged.y);
    state.ui.inputError.textContent = '';
    hideFloating(state.ui.menu);
    hideFloating(state.ui.constraint);
    showFloating(state.ui.input);

    requestAnimationFrame(() => {
      positionFloating(state.ui.input, state.menuPoint.x + 14, state.menuPoint.y + 14);
      state.ui.inputX.focus();
      state.ui.inputX.select();
    });
  }

  function closeInputPanel(options = {}) {
    hideFloating(state.ui.input);
    if (!options.keepSelection) {
      setTimeout(() => {
        maybeClearSelectedTarget();
      }, FLOATING_HIDE_DELAY_MS + 10);
    }
  }

  function getConstraintContainerRect(target) {
    const parent = target && target.parentElement;
    if (parent instanceof HTMLElement) {
      const rect = parent.getBoundingClientRect();
      return {
        label: describeElement(parent),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }

    return {
      label: '窗口',
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function openConstraintPanel(target) {
    ensureUi();
    setSelectedTarget(target);

    const rect = target.getBoundingClientRect();
    const containerRect = getConstraintContainerRect(target);
    const key = getElementKey(target);
    const merged = key ? getMergedLayout(key) : normalizeLayout({});
    const leftGap = Math.round(rect.left - containerRect.left);
    const rightGap = Math.round(containerRect.right - rect.right);
    const topGap = Math.round(rect.top - containerRect.top);
    const bottomGap = Math.round(containerRect.bottom - rect.bottom);

    state.ui.constraintTitle.textContent = `固定边距 · ${describeElement(target)}`;
    state.ui.constraintDesc.textContent = `以 ${containerRect.label} 为参照。左右都填会自动改宽度，上下都填会自动改高度。`;
    state.ui.constraintLeft.value = merged.constraints && merged.constraints.left !== undefined ? String(merged.constraints.left) : String(leftGap);
    state.ui.constraintRight.value = merged.constraints && merged.constraints.right !== undefined ? String(merged.constraints.right) : '';
    state.ui.constraintTop.value = merged.constraints && merged.constraints.top !== undefined ? String(merged.constraints.top) : String(topGap);
    state.ui.constraintBottom.value = merged.constraints && merged.constraints.bottom !== undefined ? String(merged.constraints.bottom) : '';
    state.ui.constraintError.textContent = '';

    hideFloating(state.ui.menu);
    hideFloating(state.ui.input);
    showFloating(state.ui.constraint);

    requestAnimationFrame(() => {
      positionFloating(state.ui.constraint, state.menuPoint.x + 14, state.menuPoint.y + 14);
      state.ui.constraintLeft.focus();
      state.ui.constraintLeft.select();
    });
  }

  function closeConstraintPanel(options = {}) {
    hideFloating(state.ui.constraint);
    if (!options.keepSelection) {
      setTimeout(() => {
        maybeClearSelectedTarget();
      }, FLOATING_HIDE_DELAY_MS + 10);
    }
  }

  function parseIntegerInput(value) {
    const normalized = String(value || '').trim().replace(/[^\d+\-.]/g, '');
    if (!normalized || normalized === '+' || normalized === '-' || normalized === '.' || normalized === '+.' || normalized === '-.') {
      return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
  }

  function parseOptionalIntegerInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    return parseIntegerInput(raw);
  }

  function applyInputOffsets(options = {}) {
    if (!state.activeTarget) return;
    const key = getElementKey(state.activeTarget);
    if (!key) return;

    const nextX = parseIntegerInput(state.ui.inputX.value);
    const nextY = parseIntegerInput(state.ui.inputY.value);

    if (nextX === null || nextY === null) {
      state.ui.inputError.textContent = '请输入有效的整数偏移值。';
      return;
    }

    const base = getMergedLayout(key);
    applyDraftLayout(state.activeTarget, {
      ...base,
      x: nextX,
      y: nextY
    });
    if (options.saveAfter) {
      saveTargetLayout(state.activeTarget);
    } else {
      commitHistorySnapshot('input');
    }

    closeInputPanel({ keepSelection: !options.saveAfter });
    showHelper(options.saveAfter ? '已应用并保存位置' : '已应用临时偏移', {
      timeoutMs: 1500
    });
  }

  function applyConstraintOffsets(options = {}) {
    if (!state.activeTarget) return;

    const nextLeft = parseOptionalIntegerInput(state.ui.constraintLeft.value);
    const nextRight = parseOptionalIntegerInput(state.ui.constraintRight.value);
    const nextTop = parseOptionalIntegerInput(state.ui.constraintTop.value);
    const nextBottom = parseOptionalIntegerInput(state.ui.constraintBottom.value);

    if ([nextLeft, nextRight, nextTop, nextBottom].some((value) => value === null)) {
      state.ui.constraintError.textContent = '请输入有效的整数边距，或留空不处理。';
      return;
    }

    if ([nextLeft, nextRight, nextTop, nextBottom].every((value) => value === undefined)) {
      state.ui.constraintError.textContent = '至少填写一个边距值。';
      return;
    }

    const key = getElementKey(state.activeTarget);
    if (!key) return;

    const base = getMergedLayout(key);
    const rect = state.activeTarget.getBoundingClientRect();
    const nextLayout = { ...base };
    nextLayout.width = base.width ?? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.width));
    nextLayout.height = base.height ?? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.height));
    nextLayout.constraints = {
      left: nextLeft,
      right: nextRight,
      top: nextTop,
      bottom: nextBottom
    };

    applyDraftLayout(state.activeTarget, nextLayout);
    if (options.saveAfter) {
      saveTargetLayout(state.activeTarget);
    } else {
      commitHistorySnapshot('constraint');
    }

    closeConstraintPanel({ keepSelection: !options.saveAfter });
    showHelper(options.saveAfter ? '已固定边距并保存' : '已按边距重新定位', {
      timeoutMs: 1500
    });
  }

  function isTextEditingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  function getArrowNudgeStep(event) {
    if (event.altKey) return 1;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey) return 20;
    if (event.shiftKey) return 10;
    if (event.ctrlKey || event.metaKey) return 5;
    return 1;
  }

  function getArrowDirectionDelta(key) {
    if (key === 'ArrowLeft') return { x: -1, y: 0 };
    if (key === 'ArrowRight') return { x: 1, y: 0 };
    if (key === 'ArrowUp') return { x: 0, y: -1 };
    if (key === 'ArrowDown') return { x: 0, y: 1 };
    return null;
  }

  function nudgeSelectedTarget(event) {
    if (!state.activeTarget) return false;

    const key = getElementKey(state.activeTarget);
    if (!key) return false;

    const direction = getArrowDirectionDelta(event.key);
    if (!direction) return false;

    const step = getArrowNudgeStep(event);
    const base = getMergedLayout(key);
    const next = offsetLayoutByDelta(base, direction.x * step, direction.y * step);

    applyDraftLayout(state.activeTarget, next);
    commitHistorySnapshot('nudge');
    showHelper(`微调 ${describeElement(state.activeTarget)} · X ${formatSignedPixels(next.x)} / Y ${formatSignedPixels(next.y)}`, {
      timeoutMs: 900
    });
    return true;
  }

  function hideSnapLines() {
    if (state.ui.lineX) state.ui.lineX.classList.add('hidden');
    if (state.ui.lineY) state.ui.lineY.classList.add('hidden');
    if (state.ui.lineX) state.ui.lineX.classList.remove('is-visible');
    if (state.ui.lineY) state.ui.lineY.classList.remove('is-visible');
  }

  function showVerticalSnapLine(x) {
    if (!state.ui.lineX) return;
    state.ui.lineX.style.left = `${Math.round(x)}px`;
    state.ui.lineX.classList.remove('hidden');
    state.ui.lineX.classList.add('is-visible');
  }

  function showHorizontalSnapLine(y) {
    if (!state.ui.lineY) return;
    state.ui.lineY.style.top = `${Math.round(y)}px`;
    state.ui.lineY.classList.remove('hidden');
    state.ui.lineY.classList.add('is-visible');
  }

  function collectSnapGuides(target) {
    const guides = { x: [], y: [] };
    const viewport = {
      centerX: window.innerWidth / 2,
      centerY: window.innerHeight / 2
    };

    guides.x.push(viewport.centerX);
    guides.y.push(viewport.centerY);

    const parent = target.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      guides.x.push(rect.left, rect.left + rect.width / 2, rect.right);
      guides.y.push(rect.top, rect.top + rect.height / 2, rect.bottom);

      Array.from(parent.children).forEach((child) => {
        if (child === target || child.closest('[data-god-mode-ui="true"]')) return;
        const childRect = child.getBoundingClientRect();
        if (childRect.width < 1 && childRect.height < 1) return;
        guides.x.push(childRect.left, childRect.left + childRect.width / 2, childRect.right);
        guides.y.push(childRect.top, childRect.top + childRect.height / 2, childRect.bottom);
      });
    }

    return {
      x: Array.from(new Set(guides.x.map((value) => Math.round(value)))),
      y: Array.from(new Set(guides.y.map((value) => Math.round(value))))
    };
  }

  function findBestSnap(anchors, guides) {
    let best = null;
    anchors.forEach((anchor) => {
      guides.forEach((guide) => {
        const diff = guide - anchor;
        if (Math.abs(diff) > SNAP_THRESHOLD_PX) return;
        if (!best || Math.abs(diff) < Math.abs(best.diff)) {
          best = { diff, guide };
        }
      });
    });
    return best;
  }

  function getSnappedDelta(session, rawDx, rawDy, axisLock, snapDisabled = false) {
    const rect = session.startRect;
    let dx = rawDx;
    let dy = rawDy;

    if (snapDisabled) {
      hideSnapLines();
      return {
        dx: Math.round(dx),
        dy: Math.round(dy)
      };
    }

    const left = rect.left + dx;
    const top = rect.top + dy;
    const anchorsX = [left, left + rect.width / 2, left + rect.width];
    const anchorsY = [top, top + rect.height / 2, top + rect.height];

    const bestX = axisLock === 'vertical' ? null : findBestSnap(anchorsX, session.guides.x);
    const bestY = axisLock === 'horizontal' ? null : findBestSnap(anchorsY, session.guides.y);

    if (bestX) {
      dx += bestX.diff;
      showVerticalSnapLine(bestX.guide);
    } else if (state.ui.lineX) {
      state.ui.lineX.classList.add('hidden');
      state.ui.lineX.classList.remove('is-visible');
    }

    if (bestY) {
      dy += bestY.diff;
      showHorizontalSnapLine(bestY.guide);
    } else if (state.ui.lineY) {
      state.ui.lineY.classList.add('hidden');
      state.ui.lineY.classList.remove('is-visible');
    }

    return {
      dx: Math.round(dx),
      dy: Math.round(dy)
    };
  }

  function getSnappedResizeLayout(session, layout, snapDisabled = false) {
    const next = cloneNormalizedLayout(layout);

    if (snapDisabled) {
      hideSnapLines();
      return next;
    }

    const effective = resolveEffectiveLayoutForElement(session.target, next);
    const baseRect = measureBaseRect(session.target);
    let visualLeft = baseRect.left + effective.x;
    let visualTop = baseRect.top + effective.y;
    let visualWidth = effective.width ?? Math.round(baseRect.width);
    let visualHeight = effective.height ?? Math.round(baseRect.height);

    let bestX = null;
    let bestY = null;
    if (session.direction.includes('e')) {
      bestX = findBestSnap([visualLeft + visualWidth], session.guides.x);
    } else if (session.direction.includes('w')) {
      bestX = findBestSnap([visualLeft], session.guides.x);
    }

    if (session.direction.includes('s')) {
      bestY = findBestSnap([visualTop + visualHeight], session.guides.y);
    } else if (session.direction.includes('n')) {
      bestY = findBestSnap([visualTop], session.guides.y);
    }

    if (bestX) {
      showVerticalSnapLine(bestX.guide);
      if (session.direction.includes('e')) {
        return normalizeLayout(resizeLayoutByDelta(next, 'e', bestX.diff, 0));
      } else if (session.direction.includes('w')) {
        return normalizeLayout(resizeLayoutByDelta(next, 'w', bestX.diff, 0));
      }
    } else if (state.ui.lineX) {
      state.ui.lineX.classList.add('hidden');
      state.ui.lineX.classList.remove('is-visible');
    }

    if (bestY) {
      showHorizontalSnapLine(bestY.guide);
      if (session.direction.includes('s')) {
        return normalizeLayout(resizeLayoutByDelta(next, 's', 0, bestY.diff));
      } else if (session.direction.includes('n')) {
        return normalizeLayout(resizeLayoutByDelta(next, 'n', 0, bestY.diff));
      }
    } else if (state.ui.lineY) {
      state.ui.lineY.classList.add('hidden');
      state.ui.lineY.classList.remove('is-visible');
    }

    return normalizeLayout(next);
  }

  function ensureMoveShiftLock(session, currentLayout, anchorPointer) {
    if (session.shiftLock) return session.shiftLock;

    session.shiftLock = {
      axis: null,
      startLayout: normalizeLayout(currentLayout),
      startRect: session.target.getBoundingClientRect(),
      anchorPointer: {
        x: anchorPointer.x,
        y: anchorPointer.y
      },
      guides: collectSnapGuides(session.target)
    };

    return session.shiftLock;
  }

  function resolveMoveShiftAxis(shiftLock, rawDx, rawDy) {
    if (shiftLock.axis) return shiftLock.axis;

    if (Math.abs(rawDx) < 1 && Math.abs(rawDy) < 1) {
      return null;
    }

    shiftLock.axis = Math.abs(rawDx) >= Math.abs(rawDy) ? 'horizontal' : 'vertical';
    return shiftLock.axis;
  }

  function clearMoveShiftLock(session) {
    if (!session || !session.shiftLock) return;
    session.shiftLock = null;
    hideSnapLines();
  }

  function updateMoveSessionLayout(session, event) {
    const point = { x: event.clientX, y: event.clientY };
    const currentLayout = getMergedLayout(session.key);

    if (event.shiftKey) {
      const shiftLock = ensureMoveShiftLock(session, currentLayout, session.lastPointer);
      let dx = point.x - shiftLock.anchorPointer.x;
      let dy = point.y - shiftLock.anchorPointer.y;
      const axisLock = resolveMoveShiftAxis(shiftLock, dx, dy);

      if (!axisLock) {
        hideSnapLines();
        session.lastPointer = point;
        return;
      }

      if (axisLock === 'horizontal') dy = 0;
      if (axisLock === 'vertical') dx = 0;

      const snapDisabled = event.ctrlKey || event.metaKey;
      const snapped = getSnappedDelta(
        {
          startRect: shiftLock.startRect,
          guides: shiftLock.guides
        },
        dx,
        dy,
        axisLock,
        snapDisabled
      );

      applyDraftLayout(session.target, offsetLayoutByDelta(shiftLock.startLayout, snapped.dx, snapped.dy));
      session.lastPointer = point;
      return;
    }

    clearMoveShiftLock(session);

    const dx = point.x - session.lastPointer.x;
    const dy = point.y - session.lastPointer.y;
    const snapDisabled = event.ctrlKey || event.metaKey;
    const snapped = getSnappedDelta(
      {
        startRect: session.target.getBoundingClientRect(),
        guides: session.guides
      },
      dx,
      dy,
      null,
      snapDisabled
    );

    applyDraftLayout(session.target, offsetLayoutByDelta(currentLayout, snapped.dx, snapped.dy));
    session.lastPointer = point;
  }

  function armMoveMode(target, event) {
    closeInputPanel({ keepSelection: true });
    closeConstraintPanel({ keepSelection: true });
    closeContextMenu({ keepSelection: true });
    setSelectedTarget(target);
    startPointerMoveSession(target, {
      x: event && Number.isFinite(event.clientX) ? event.clientX : state.pointerPosition.x,
      y: event && Number.isFinite(event.clientY) ? event.clientY : state.pointerPosition.y
    });
  }

  function startPointerMoveSession(target, point) {
    const key = getElementKey(target);
    if (!key) return;

    state.pointerMoveSession = {
      key,
      target,
      startLayout: getMergedLayout(key),
      lastPointer: {
        x: Number.isFinite(point && point.x) ? point.x : state.pointerPosition.x,
        y: Number.isFinite(point && point.y) ? point.y : state.pointerPosition.y
      },
      guides: collectSnapGuides(target),
      shiftLock: null
    };

    state.pendingMoveTarget = null;
    setSelectedTarget(target);
    showHelper('移动模式：直接移动鼠标或方向键，左键或 Enter 确认，Esc 取消，Ctrl/Cmd 临时关闭吸附。', {
      sticky: true
    });
  }

  function finishPointerMoveSession(options = {}) {
    if (!state.pointerMoveSession) return;

    const session = state.pointerMoveSession;
    clearMoveShiftLock(session);
    hideSnapLines();

    if (options.cancel) {
      applyDraftLayout(session.target, session.startLayout);
      showHelper('已取消本次移动。', { timeoutMs: 1200 });
    } else {
      commitHistorySnapshot('move-mode');
      showHelper('移动完成：右键该对象可保存位置或继续调整。', { timeoutMs: 1500 });
    }

    state.pointerMoveSession = null;
  }

  function startMoveSession(target, event) {
    const key = getElementKey(target);
    if (!key) return;

    const startLayout = getMergedLayout(key);
    state.dragSession = {
      key,
      target,
      startLayout,
      startRect: target.getBoundingClientRect(),
      startPointer: { x: event.clientX, y: event.clientY },
      lastPointer: { x: event.clientX, y: event.clientY },
      guides: collectSnapGuides(target),
      shiftLock: null
    };

    state.pendingMoveTarget = null;
    setSelectedTarget(target);
    target.classList.add('god-mode-dragging-target');
    document.body.classList.add('god-mode-is-dragging');
    showHelper('拖动中：Shift 锁定单轴，Ctrl/Cmd 临时关闭吸附。', { sticky: true });
  }

  function finishMoveSession(options = {}) {
    if (!state.dragSession) return;

    const session = state.dragSession;
    clearMoveShiftLock(session);
    session.target.classList.remove('god-mode-dragging-target');
    document.body.classList.remove('god-mode-is-dragging');
    hideSnapLines();

    if (options.cancel) {
      applyDraftLayout(session.target, session.startLayout);
      showHelper('已取消本次拖动。', { timeoutMs: 1200 });
    } else {
      commitHistorySnapshot('drag');
      showHelper('拖动完成：右键该对象可保存位置或恢复原位。', { timeoutMs: 1500 });
    }

    state.dragSession = null;
  }

  function startResizeSession(target, direction, event) {
    const key = getElementKey(target);
    if (!key) return;

    closeContextMenu({ keepSelection: true });
    closeInputPanel({ keepSelection: true });
    closeConstraintPanel({ keepSelection: true });
    if (state.pointerMoveSession) {
      finishPointerMoveSession({ cancel: false });
    }

    const targetRect = target.getBoundingClientRect();
    const initialLayout = normalizeLayout({
      ...getMergedLayout(key),
      width: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(targetRect.width)),
      height: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(targetRect.height))
    });

    state.resizeSession = {
      key,
      target,
      direction,
      originLayout: cloneNormalizedLayout(initialLayout),
      startLayout: cloneNormalizedLayout(initialLayout),
      startRect: targetRect,
      startPointer: { x: event.clientX, y: event.clientY },
      guides: collectSnapGuides(target)
    };

    setSelectedTarget(target);
    target.classList.add('god-mode-dragging-target');
    document.body.classList.add('god-mode-is-dragging');
    showHelper('缩放中：拖动边缘或角点改大小，Enter 确认，Esc 取消。', { sticky: true });
  }

  function buildResizedLayout(session, pointerX, pointerY) {
    const dx = pointerX - session.startPointer.x;
    const dy = pointerY - session.startPointer.y;
    return resizeLayoutByDelta(session.startLayout, session.direction || '', Math.round(dx), Math.round(dy));
  }

  function refreshResizeSessionAnchor(session, point) {
    if (!session || !session.target) return;
    const rect = session.target.getBoundingClientRect();
    session.startLayout = normalizeLayout({
      ...getMergedLayout(session.key),
      width: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.width)),
      height: Math.max(MIN_LAYOUT_SIZE_PX, Math.round(rect.height))
    });
    session.startRect = rect;
    session.startPointer = {
      x: Number.isFinite(point && point.x) ? point.x : state.pointerPosition.x,
      y: Number.isFinite(point && point.y) ? point.y : state.pointerPosition.y
    };
    session.guides = collectSnapGuides(session.target);
  }

  function nudgeResizeSession(event) {
    if (!state.resizeSession) return false;

    const direction = getArrowDirectionDelta(event.key);
    if (!direction) return false;

    const step = getArrowNudgeStep(event);
    const currentLayout = getMergedLayout(state.resizeSession.key);
    const next = resizeLayoutByDelta(
      currentLayout,
      state.resizeSession.direction || '',
      direction.x * step,
      direction.y * step
    );

    applyDraftLayout(state.resizeSession.target, next);
    refreshResizeSessionAnchor(state.resizeSession, state.pointerPosition);
    showHelper(`缩放微调 · 宽 ${Math.round(state.resizeSession.target.getBoundingClientRect().width)} px / 高 ${Math.round(state.resizeSession.target.getBoundingClientRect().height)} px`, {
      timeoutMs: 900
    });
    return true;
  }

  function finishResizeSession(options = {}) {
    if (!state.resizeSession) return;

    const session = state.resizeSession;
    session.target.classList.remove('god-mode-dragging-target');
    document.body.classList.remove('god-mode-is-dragging');
    hideSnapLines();

    if (options.cancel) {
      applyDraftLayout(session.target, session.originLayout || session.startLayout);
      showHelper('已取消本次缩放。', { timeoutMs: 1200 });
    } else {
      commitHistorySnapshot('resize');
      showHelper('缩放完成：右键该对象可保存尺寸或继续调整。', { timeoutMs: 1500 });
    }

    state.resizeSession = null;
  }

  function scheduleReapplyLayouts() {
    if (state.reapplyFrame) return;
    state.reapplyFrame = requestAnimationFrame(() => {
      state.reapplyFrame = 0;
      reapplyAllLayouts();
    });
  }

  function syncSettingsUi(enabled) {
    const checkbox = document.getElementById('settingGodMode');
    if (checkbox) {
      checkbox.checked = enabled;
      checkbox.disabled = !state.developerMode;
    }

    if (typeof window.syncSettingsToggleStatus === 'function') {
      window.syncSettingsToggleStatus('settingGodModeStatus', enabled);
      return;
    }

    const status = document.getElementById('settingGodModeStatus');
    if (status) status.textContent = enabled ? '已开启' : '已关闭';
  }

  function setEnabled(enabled, options = {}) {
    state.enabled = state.developerMode && Boolean(enabled);
    document.body.classList.toggle('god-mode-enabled', state.enabled);
    syncSettingsUi(state.enabled);

    if (options.persist !== false) {
      if (state.developerMode) {
        localStorage.setItem(GOD_MODE_ENABLE_KEY, state.enabled ? 'true' : 'false');
      } else {
        localStorage.removeItem(GOD_MODE_ENABLE_KEY);
      }
    }

    if (!state.enabled) {
      finishMoveSession({ cancel: false });
      finishPointerMoveSession({ cancel: false });
      finishResizeSession({ cancel: false });
      state.pendingMoveTarget = null;
      state.draftLayouts = {};
      closeContextMenu({ keepSelection: false });
      closeInputPanel({ keepSelection: false });
      closeConstraintPanel({ keepSelection: false });
      hideHelper();
      hideSnapLines();
      clearSelectedTarget();
      scheduleReapplyLayouts();
      return;
    }

    scheduleReapplyLayouts();
    seedHistorySnapshot('enabled');
  }

  function handleContextMenu(event) {
    if (!state.enabled) return;

     state.pointerPosition = { x: event.clientX, y: event.clientY };

    const target = resolveRenderableTarget(event.target);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }

    if (state.dragSession) {
      finishMoveSession({ cancel: false });
    }
    if (state.pointerMoveSession) {
      finishPointerMoveSession({ cancel: false });
    }
    if (state.resizeSession) {
      finishResizeSession({ cancel: false });
    }

    state.pendingMoveTarget = null;
    openContextMenu(target, event.clientX, event.clientY);
  }

  function handlePointerDown(event) {
    if (!state.enabled) return;
    ensureUi();
    state.pointerPosition = { x: event.clientX, y: event.clientY };

    const clickedInsideUi = event.target.closest('[data-god-mode-ui="true"]');
    if (clickedInsideUi) return;

    if (event.button === 0 && state.pointerMoveSession) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      finishPointerMoveSession({ cancel: false });
      return;
    }

    if (event.button === 0 && state.pendingMoveTarget) {
      const resolved = resolveRenderableTarget(event.target);
      const selected = state.pendingMoveTarget;
      if (resolved && (resolved === selected || selected.contains(resolved) || resolved.contains(selected))) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        startMoveSession(selected, event);
        closeContextMenu({ keepSelection: true });
        return;
      }
      state.pendingMoveTarget = null;
      hideHelper();
    }

    closeContextMenu({ keepSelection: false });
    closeInputPanel({ keepSelection: false });
    closeConstraintPanel({ keepSelection: false });
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;
    state.pointerPosition = { x: event.clientX, y: event.clientY };

    if (state.resizeSession) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      const snapDisabled = event.ctrlKey || event.metaKey;
      applyDraftLayout(
        state.resizeSession.target,
        getSnappedResizeLayout(
          state.resizeSession,
          buildResizedLayout(state.resizeSession, event.clientX, event.clientY),
          snapDisabled
        )
      );
      refreshResizeSessionAnchor(state.resizeSession, { x: event.clientX, y: event.clientY });
      return;
    }

    if (state.pointerMoveSession) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      updateMoveSessionLayout(state.pointerMoveSession, event);
      return;
    }

    if (!state.dragSession) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    updateMoveSessionLayout(state.dragSession, event);
  }

  function handlePointerUp() {
    if (!state.enabled) return;
    if (state.resizeSession) {
      finishResizeSession({ cancel: false });
      return;
    }
    if (!state.dragSession) return;
    finishMoveSession({ cancel: false });
  }

  function handleKeyDown(event) {
    if (!state.enabled) return;

    const normalizedKey = String(event.key || '').toLowerCase();
    const acceleratorPressed = event.ctrlKey || event.metaKey;
    const isTyping = isTextEditingTarget(event.target);

    if (state.resizeSession) {
      if (normalizedKey === 'escape') {
        event.preventDefault();
        finishResizeSession({ cancel: true });
        return;
      }

      if (normalizedKey === 'enter') {
        event.preventDefault();
        finishResizeSession({ cancel: false });
        return;
      }

      if (!isTyping && normalizedKey.startsWith('arrow')) {
        event.preventDefault();
        nudgeResizeSession(event);
        return;
      }

      if (acceleratorPressed) {
        hideSnapLines();
      }
      return;
    }

    if (state.dragSession) {
      if (normalizedKey === 'escape') {
        event.preventDefault();
        finishMoveSession({ cancel: true });
        return;
      }

      if (acceleratorPressed) {
        hideSnapLines();
      }
      return;
    }

    if (state.pointerMoveSession) {
      if (normalizedKey === 'escape') {
        event.preventDefault();
        finishPointerMoveSession({ cancel: true });
        return;
      }

      if (normalizedKey === 'enter') {
        event.preventDefault();
        finishPointerMoveSession({ cancel: false });
        return;
      }

      if (!isTyping && normalizedKey.startsWith('arrow') && state.activeTarget) {
        event.preventDefault();
        nudgeSelectedTarget(event);
        return;
      }

      if (acceleratorPressed) {
        hideSnapLines();
      }
      return;
    }

    if (!isTyping && acceleratorPressed && !event.altKey && normalizedKey === 's' && state.activeTarget) {
      event.preventDefault();
      saveTargetLayout(state.activeTarget);
      return;
    }

    if (!isTyping && acceleratorPressed && !event.altKey && normalizedKey === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        redoHistory();
      } else {
        undoHistory();
      }
      return;
    }

    if (!isTyping && acceleratorPressed && !event.altKey && normalizedKey === 'y') {
      event.preventDefault();
      redoHistory();
      return;
    }

    if (!isTyping && normalizedKey.startsWith('arrow') && state.activeTarget && !state.dragSession) {
      event.preventDefault();
      nudgeSelectedTarget(event);
      return;
    }

    if (event.key !== 'Escape') return;

    if (state.pendingMoveTarget) {
      event.preventDefault();
      state.pendingMoveTarget = null;
      hideHelper();
      clearSelectedTarget();
    }

    closeContextMenu({ keepSelection: false });
    closeInputPanel({ keepSelection: false });
    closeConstraintPanel({ keepSelection: false });
  }

  function bindStorageSync() {
    window.addEventListener('storage', (event) => {
      if (!state.developerMode) {
        return;
      }

      if (event.key === GOD_MODE_ENABLE_KEY) {
        setEnabled(event.newValue === 'true', { persist: false });
      }
    });
  }

  function initSettingsToggle() {
    const checkbox = document.getElementById('settingGodMode');
    if (!checkbox) return;

    checkbox.addEventListener('change', () => {
      if (!state.developerMode) {
        checkbox.checked = false;
        return;
      }
      setEnabled(checkbox.checked, { persist: true });
    });
  }

  function initObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(() => {
      scheduleReapplyLayouts();
    });
    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function initConstraintResizeObserver() {
    if (state.constraintResizeObserver || typeof ResizeObserver !== 'function') return;
    state.constraintResizeObserver = new ResizeObserver(() => {
      scheduleReapplyLayouts();
    });
  }

  async function init() {
    ensureUi();
    initSettingsToggle();
    bindStorageSync();
    initObserver();
    initConstraintResizeObserver();

    try {
      await initializeRuntimeState();
    } catch (error) {
      safeLog('error', `[GodMode] Runtime bootstrap failed: ${error.message}`);
      updateDeveloperSettingsMeta(`Snapshots unavailable: ${error.message}`);
      updateDeveloperSettingsButtonsState(true);
      state.savedLayouts = {};
      state.draftLayouts = {};
      state.developerMode = false;
      syncDeveloperSettingsVisibility();
    }

    setEnabled(localStorage.getItem(GOD_MODE_ENABLE_KEY) === 'true', { persist: false });
    state.ready = true;

    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', scheduleReapplyLayouts);
    window.addEventListener('resize', scheduleSelectionFrameSync);
    window.addEventListener('scroll', scheduleSelectionFrameSync, true);
    window.addEventListener('blur', () => {
      if (state.dragSession) {
        finishMoveSession({ cancel: false });
      }
      if (state.pointerMoveSession) {
        finishPointerMoveSession({ cancel: false });
      }
      if (state.resizeSession) {
        finishResizeSession({ cancel: false });
      }
    });
  }

  window.toggleGodMode = function toggleGodMode(checked) {
    setEnabled(Boolean(checked), { persist: true });
  };

  window.saveGodModeLayoutTarget = function saveGodModeLayoutTarget() {
    if (state.activeTarget) saveTargetLayout(state.activeTarget);
  };

  window.freezeGodModeAsFormalLayout = function freezeGodModeAsFormalLayout() {
    return freezeCurrentLayoutsAsFormalDefaults();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void init();
    }, { once: true });
  } else {
    void init();
  }
})();
