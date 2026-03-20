const fs = require('fs');
const path = require('path');

const GOD_MODE_DIR_NAME = 'dev';
const GOD_MODE_LAYOUT_DIR_NAME = 'god-mode-layouts';
const GOD_MODE_SNAPSHOTS_DIR_NAME = 'snapshots';
const GOD_MODE_MANIFEST_FILE_NAME = 'manifest.json';
const GOD_MODE_CURRENT_FILE_NAME = 'current.json';
const GOD_MODE_INITIAL_FILE_NAME = '000_initial.json';
const GOD_MODE_FORMAL_LAYOUT_DEFAULTS_FILE_NAME = 'layout-defaults.generated.js';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatTimestampForFileName(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
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

  const hasAny = Object.values(next).some((value) => value !== undefined);
  return hasAny ? next : null;
}

function normalizeLayoutEntry(layout) {
  const parsedX = Number(layout && layout.x);
  const parsedY = Number(layout && layout.y);
  const parsedWidth = Number(layout && layout.width);
  const parsedHeight = Number(layout && layout.height);

  return {
    x: Number.isFinite(parsedX) ? Math.round(parsedX) : 0,
    y: Number.isFinite(parsedY) ? Math.round(parsedY) : 0,
    width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? Math.round(parsedWidth) : null,
    height: Number.isFinite(parsedHeight) && parsedHeight > 0 ? Math.round(parsedHeight) : null,
    constraints: normalizeConstraints(layout && layout.constraints)
  };
}

function normalizeLayoutsMap(layouts) {
  const next = {};
  Object.entries(layouts && typeof layouts === 'object' ? layouts : {}).forEach(([key, value]) => {
    if (!key) return;
    next[key] = normalizeLayoutEntry(value);
  });
  return next;
}

function buildSnapshotPayload(layouts, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  return {
    schemaVersion: 1,
    reason: String(options.reason || 'manual-save'),
    savedAt: now.toISOString(),
    layouts: normalizeLayoutsMap(layouts)
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function getGodModeLayoutsDirectory(projectRoot) {
  return path.join(path.resolve(projectRoot), GOD_MODE_DIR_NAME, GOD_MODE_LAYOUT_DIR_NAME);
}

function getGodModeSnapshotsDirectory(projectRoot) {
  return path.join(getGodModeLayoutsDirectory(projectRoot), GOD_MODE_SNAPSHOTS_DIR_NAME);
}

function getGodModeManifestPath(projectRoot) {
  return path.join(getGodModeLayoutsDirectory(projectRoot), GOD_MODE_MANIFEST_FILE_NAME);
}

function getGodModeCurrentPath(projectRoot) {
  return path.join(getGodModeLayoutsDirectory(projectRoot), GOD_MODE_CURRENT_FILE_NAME);
}

function getGodModeInitialSnapshotPath(projectRoot) {
  return path.join(getGodModeSnapshotsDirectory(projectRoot), GOD_MODE_INITIAL_FILE_NAME);
}

function getGodModeFormalLayoutDefaultsFilePath(projectRoot) {
  return path.join(
    path.resolve(projectRoot),
    'src',
    'renderer',
    'assets',
    'js',
    GOD_MODE_FORMAL_LAYOUT_DEFAULTS_FILE_NAME
  );
}

function buildFormalLayoutDefaultsSource(layouts, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const payload = normalizeLayoutsMap(layouts);
  const meta = {
    generatedAt: now.toISOString(),
    source: String(options.source || 'god-mode-freeze'),
    layoutCount: Object.keys(payload).length
  };

  return [
    '(function initMkpLayoutDefaults(global) {',
    `  global.__MKP_LAYOUT_DEFAULTS__ = ${JSON.stringify(payload, null, 2)};`,
    `  global.__MKP_LAYOUT_DEFAULTS_META__ = ${JSON.stringify(meta, null, 2)};`,
    '})(window);',
    ''
  ].join('\n');
}

function createSnapshotFile(projectRoot, layouts, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const snapshotsDir = getGodModeSnapshotsDirectory(projectRoot);
  ensureDir(snapshotsDir);

  const fileName = options.fileName || `layout_${formatTimestampForFileName(now)}.json`;
  const snapshotPath = path.join(snapshotsDir, fileName);
  const payload = buildSnapshotPayload(layouts, {
    now,
    reason: options.reason
  });

  writeJson(snapshotPath, payload);
  return {
    fileName,
    snapshotPath,
    payload
  };
}

function createSnapshotRecord(fileName, payload) {
  return {
    fileName,
    reason: String(payload && payload.reason ? payload.reason : 'manual-save'),
    savedAt: String(payload && payload.savedAt ? payload.savedAt : new Date(0).toISOString())
  };
}

function sortSnapshotRecordsDesc(records) {
  return [...records].sort((left, right) => {
    return String(right.savedAt || '').localeCompare(String(left.savedAt || ''));
  });
}

function ensureGodModeLayoutStore(projectRoot) {
  const directory = getGodModeLayoutsDirectory(projectRoot);
  const snapshotsDir = getGodModeSnapshotsDirectory(projectRoot);
  const manifestPath = getGodModeManifestPath(projectRoot);
  const currentPath = getGodModeCurrentPath(projectRoot);
  const initialSnapshotPath = getGodModeInitialSnapshotPath(projectRoot);

  ensureDir(directory);
  ensureDir(snapshotsDir);

  let manifest = readJsonIfExists(manifestPath);
  let currentPayload = readJsonIfExists(currentPath);

  const hasInitialSnapshot = fs.existsSync(initialSnapshotPath);
  if (!hasInitialSnapshot) {
    createSnapshotFile(projectRoot, {}, {
      fileName: GOD_MODE_INITIAL_FILE_NAME,
      reason: 'initial'
    });
  }

  if (!currentPayload) {
    currentPayload = buildSnapshotPayload({}, { reason: 'initial' });
    writeJson(currentPath, currentPayload);
  }

  if (!manifest || typeof manifest !== 'object') {
    manifest = {
      schemaVersion: 1,
      initialSnapshotFile: GOD_MODE_INITIAL_FILE_NAME,
      activeSnapshotFile: GOD_MODE_INITIAL_FILE_NAME,
      snapshots: []
    };
  }

  const snapshotFiles = fs.readdirSync(snapshotsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'));

  const snapshotRecordMap = new Map();
  snapshotFiles.forEach((fileName) => {
    const payload = readJsonIfExists(path.join(snapshotsDir, fileName));
    if (!payload) return;
    snapshotRecordMap.set(fileName, createSnapshotRecord(fileName, payload));
  });

  const currentActiveFile = manifest.activeSnapshotFile;
  if (!currentActiveFile || !snapshotRecordMap.has(currentActiveFile)) {
    if (snapshotRecordMap.size === 0) {
      const initialPayload = readJsonIfExists(initialSnapshotPath) || buildSnapshotPayload({}, { reason: 'initial' });
      snapshotRecordMap.set(GOD_MODE_INITIAL_FILE_NAME, createSnapshotRecord(GOD_MODE_INITIAL_FILE_NAME, initialPayload));
    }

    const sortedSnapshotFiles = sortSnapshotRecordsDesc(Array.from(snapshotRecordMap.values()));
    manifest.activeSnapshotFile = sortedSnapshotFiles.length ? sortedSnapshotFiles[0].fileName : GOD_MODE_INITIAL_FILE_NAME;
  }

  manifest.initialSnapshotFile = GOD_MODE_INITIAL_FILE_NAME;
  manifest.snapshots = sortSnapshotRecordsDesc(Array.from(snapshotRecordMap.values()));
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);

  return {
    directory,
    snapshotsDir,
    manifestPath,
    currentPath,
    initialSnapshotPath,
    manifest,
    currentPayload
  };
}

function readGodModeLayoutState(projectRoot) {
  const store = ensureGodModeLayoutStore(projectRoot);
  return {
    directory: store.directory,
    snapshotsDir: store.snapshotsDir,
    manifestPath: store.manifestPath,
    currentPath: store.currentPath,
    initialSnapshotPath: store.initialSnapshotPath,
    activeSnapshotPath: path.join(store.snapshotsDir, store.manifest.activeSnapshotFile),
    activeSnapshotFile: store.manifest.activeSnapshotFile,
    initialSnapshotFile: store.manifest.initialSnapshotFile,
    snapshots: store.manifest.snapshots,
    layouts: normalizeLayoutsMap(store.currentPayload && store.currentPayload.layouts)
  };
}

function saveGodModeLayoutSnapshot(projectRoot, layouts, options = {}) {
  const store = ensureGodModeLayoutStore(projectRoot);
  const snapshot = createSnapshotFile(projectRoot, layouts, {
    reason: options.reason || 'manual-save',
    now: options.now
  });

  writeJson(store.currentPath, snapshot.payload);

  const manifest = {
    ...store.manifest,
    activeSnapshotFile: snapshot.fileName,
    updatedAt: snapshot.payload.savedAt
  };

  const withoutExisting = Array.isArray(manifest.snapshots)
    ? manifest.snapshots.filter((entry) => entry && entry.fileName !== snapshot.fileName)
    : [];
  manifest.snapshots = sortSnapshotRecordsDesc([
    createSnapshotRecord(snapshot.fileName, snapshot.payload),
    ...withoutExisting
  ]);

  writeJson(store.manifestPath, manifest);

  return {
    directory: store.directory,
    currentPath: store.currentPath,
    manifestPath: store.manifestPath,
    snapshotPath: snapshot.snapshotPath,
    snapshotFile: snapshot.fileName,
    activeSnapshotFile: snapshot.fileName,
    snapshots: manifest.snapshots,
    layouts: snapshot.payload.layouts
  };
}

function resolveRestoreSnapshotRecord(store, target) {
  if (target === 'initial') {
    return store.manifest.snapshots.find((entry) => entry && entry.fileName === GOD_MODE_INITIAL_FILE_NAME) || null;
  }

  if (target === 'previous') {
    const snapshots = Array.isArray(store.manifest.snapshots) ? store.manifest.snapshots : [];
    const currentIndex = snapshots.findIndex((entry) => entry && entry.fileName === store.manifest.activeSnapshotFile);
    const previousEntry = currentIndex >= 0 ? snapshots[currentIndex + 1] : snapshots[1];
    return previousEntry || null;
  }

  if (typeof target === 'string' && target.trim()) {
    return (store.manifest.snapshots || []).find((entry) => entry && entry.fileName === target.trim()) || null;
  }

  return null;
}

function restoreGodModeLayoutSnapshot(projectRoot, target = 'previous') {
  const store = ensureGodModeLayoutStore(projectRoot);
  const targetRecord = resolveRestoreSnapshotRecord(store, target);
  if (!targetRecord) {
    throw new Error(`God Mode snapshot not found for target: ${target}`);
  }

  const snapshotPath = path.join(store.snapshotsDir, targetRecord.fileName);
  const payload = readJsonIfExists(snapshotPath);
  if (!payload || typeof payload !== 'object') {
    throw new Error(`God Mode snapshot file is invalid: ${targetRecord.fileName}`);
  }

  writeJson(store.currentPath, payload);

  const manifest = {
    ...store.manifest,
    activeSnapshotFile: targetRecord.fileName,
    updatedAt: new Date().toISOString()
  };
  writeJson(store.manifestPath, manifest);

  return {
    directory: store.directory,
    currentPath: store.currentPath,
    manifestPath: store.manifestPath,
    snapshotPath,
    snapshotFile: targetRecord.fileName,
    activeSnapshotFile: targetRecord.fileName,
    snapshots: manifest.snapshots,
    layouts: normalizeLayoutsMap(payload.layouts)
  };
}

function writeGodModeFormalLayoutDefaults(projectRoot, layouts, options = {}) {
  const filePath = getGodModeFormalLayoutDefaultsFilePath(projectRoot);
  const payload = normalizeLayoutsMap(layouts);
  const source = buildFormalLayoutDefaultsSource(payload, options);

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, source, 'utf8');

  return {
    filePath,
    layoutCount: Object.keys(payload).length,
    layouts: payload
  };
}

module.exports = {
  GOD_MODE_CURRENT_FILE_NAME,
  GOD_MODE_DIR_NAME,
  GOD_MODE_FORMAL_LAYOUT_DEFAULTS_FILE_NAME,
  GOD_MODE_INITIAL_FILE_NAME,
  GOD_MODE_LAYOUT_DIR_NAME,
  GOD_MODE_MANIFEST_FILE_NAME,
  GOD_MODE_SNAPSHOTS_DIR_NAME,
  buildFormalLayoutDefaultsSource,
  ensureGodModeLayoutStore,
  getGodModeCurrentPath,
  getGodModeFormalLayoutDefaultsFilePath,
  getGodModeInitialSnapshotPath,
  getGodModeLayoutsDirectory,
  getGodModeManifestPath,
  getGodModeSnapshotsDirectory,
  readGodModeLayoutState,
  restoreGodModeLayoutSnapshot,
  saveGodModeLayoutSnapshot,
  writeGodModeFormalLayoutDefaults
};
