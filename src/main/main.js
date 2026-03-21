const electron = require('electron');
const { BrowserWindow, Notification, ipcMain, nativeTheme, shell, dialog } = electron; // 必须全部引入
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const {
  buildSupportBundle,
  buildCrashLogMessage,
  buildGuiRelaunchArgs,
  buildScopedLogFilePath,
  buildPrefixedLogLines,
  collectScopedLogExcerpt,
  buildUpdaterFailureLogMessage
} = require('./main_process_diagnostics');
const {
  buildPostprocessStepLogLines,
  buildPostprocessTraceExport,
  getEngineRuntimeMetadata,
  parseCliArguments,
  processGcodeDetailed
} = require('./mkp_engine');
const {
  cleanupLegacyPostprocessArtifacts,
  createFailedPostprocessReportState,
  createPendingPostprocessReportState,
  createPostprocessReportFilePath,
  getArgValue,
  launchDetachedPostprocessReportViewer,
  readPostprocessReportState,
  resolvePostprocessOutputPath,
  writePostprocessReportState
} = require('./postprocess_report_runtime');
const {
  importHomeCatalogImage,
  readHomeCatalog,
  removeHomeCatalog,
  saveHomeCatalog
} = require('./catalog-store');
const { readReleaseEditorState, saveReleaseEditorState, runReleaseMode } = require('./release-ops');
const {
  importDefaultCatalogImage,
  readDefaultCatalogConfig,
  readDefaultPreset,
  saveDefaultCatalogConfig,
  saveDefaultPreset
} = require('./release-config-ops');
const {
  convertTomlPresetFileToJson,
  ensureConvertedPresetsDir
} = require('./preset_conversion');
const http = require('http');
const https = require('https');

function getElectronApp() {
  return electron.app || null;
}

function waitForElectronApp(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function resolveWhenReady() {
      const currentApp = getElectronApp();
      if (currentApp) {
        resolve(currentApp);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Electron app unavailable during bootstrap'));
        return;
      }

      setTimeout(resolveWhenReady, 10);
    }

    resolveWhenReady();
  });
}

const app = new Proxy({}, {
  get(target, prop) {
    if (prop === 'whenReady') {
      return () => waitForElectronApp().then((resolvedApp) => resolvedApp.whenReady());
    }

    if (prop === 'on' || prop === 'once') {
      return (eventName, listener) =>
        waitForElectronApp().then((resolvedApp) => resolvedApp[prop](eventName, listener));
    }

    if (prop === 'commandLine') {
      return {
        appendSwitch: (...args) => {
          const resolvedApp = getElectronApp();
          if (!resolvedApp?.commandLine?.appendSwitch) {
            return false;
          }

          resolvedApp.commandLine.appendSwitch(...args);
          return true;
        }
      };
    }

    const resolvedApp = getElectronApp();
    const value = resolvedApp?.[prop];
    return typeof value === 'function' ? value.bind(resolvedApp) : value;
  }
});

const isCliMode = process.argv.includes('--Gcode');
const isPostprocessReportMode = process.argv.includes('--postprocess-report');
const isReleaseCenterMode = process.argv.includes('--release-center');
const AdmZip = require('adm-zip');
const LOG_RETENTION_MS = 7 * 24 * 3600 * 1000;
const DIAGNOSTIC_EXPORT_MAX_LOG_LINES = 240;
const DIAGNOSTIC_EXPORT_MAX_ISSUE_LOG_LINES = 1200;
const SUPPORT_BUNDLE_REUSE_WINDOW_MS = 60 * 1000;
let hasCleanedExpiredLogs = false;
let supportBundleExportPromise = null;
let lastSupportBundleExportResult = null;
let getGodModeLayoutsDirectory = () => null;
let getGodModeFormalLayoutDefaultsFilePath = () => null;
let readGodModeLayoutState = () => {
  throw new Error('God Mode layout storage is unavailable in packaged builds');
};
let restoreGodModeLayoutSnapshot = () => {
  throw new Error('God Mode layout storage is unavailable in packaged builds');
};
let saveGodModeLayoutSnapshot = () => {
  throw new Error('God Mode layout storage is unavailable in packaged builds');
};
let writeGodModeFormalLayoutDefaults = () => {
  throw new Error('God Mode layout storage is unavailable in packaged builds');
};
let hasLoadedGodModeLayoutStore = false;

function ensureGodModeLayoutStoreLoaded() {
  if (hasLoadedGodModeLayoutStore || app.isPackaged) {
    return;
  }

  hasLoadedGodModeLayoutStore = true;
  ({
    getGodModeLayoutsDirectory,
    getGodModeFormalLayoutDefaultsFilePath,
    readGodModeLayoutState,
    restoreGodModeLayoutSnapshot,
    saveGodModeLayoutSnapshot,
    writeGodModeFormalLayoutDefaults
  } = require('./god_mode_layout_store'));
}

const mainProcessDiagnosticsState = {
  lastPage: 'startup',
  lastRendererLog: null
};
let cachedAutoUpdater = null;
let hasResolvedAutoUpdater = false;

function isUpdaterSupportedRuntime() {
  return resolveMainProcessMode() === 'gui' && app.isPackaged && process.defaultApp !== true;
}

function getAutoUpdater() {
  if (hasResolvedAutoUpdater) {
    return cachedAutoUpdater;
  }

  hasResolvedAutoUpdater = true;

  try {
    ({ autoUpdater: cachedAutoUpdater } = require('electron-updater'));
  } catch (error) {
    appendMainProcessLog(`[WARN] [Updater] electron-updater unavailable: ${error.message}`);
    cachedAutoUpdater = null;
  }

  return cachedAutoUpdater;
}

async function checkForUpdatesInBackground() {
  if (!isUpdaterSupportedRuntime()) {
    appendMainProcessLog(
      `[INFO] [Updater] Skip auto-check in runtime=${resolveMainProcessMode()} packaged=${app.isPackaged} defaultApp=${process.defaultApp === true}`
    );
    return;
  }

  const updater = getAutoUpdater();
  if (!updater) {
    return;
  }

  try {
    await updater.checkForUpdatesAndNotify();
  } catch (error) {
    appendMainProcessLog(buildUpdaterFailureLogMessage(error));
  }
}

function getSafeAppVersion() {
  try {
    return app.getVersion();
  } catch (error) {
    return null;
  }
}

function resolveMainProcessMode() {
  if (isPostprocessReportMode) {
    return 'postprocess-report';
  }

  if (isCliMode) {
    return 'cli';
  }

  if (isReleaseCenterMode) {
    return 'release-center';
  }

  return 'gui';
}

function safelyGetAppPath() {
  try {
    return app.getAppPath();
  } catch (error) {
    return null;
  }
}

function cleanupExpiredLogs(logDir) {
  if (hasCleanedExpiredLogs || !fs.existsSync(logDir)) {
    return;
  }

  hasCleanedExpiredLogs = true;
  const nowTime = Date.now();
  const files = fs.readdirSync(logDir);
  files.forEach((file) => {
    if (!file.endsWith('.log')) {
      return;
    }

    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);
    if (nowTime - stats.mtimeMs > LOG_RETENTION_MS) {
      fs.unlinkSync(filePath);
    }
  });
}

function resolveDiagnosticsLogScope(options = {}) {
  if (options.scope === 'cli') {
    return 'cli';
  }

  if (options.scope === 'gui') {
    return 'gui';
  }

  return resolveMainProcessMode() === 'cli' ? 'cli' : 'gui';
}

function appendMainProcessLog(message, options = {}) {
  try {
    const userDataPath = options.userDataPath || app.getPath('userData');
    const logDir = path.join(userDataPath, 'Logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    cleanupExpiredLogs(logDir);

    const now = options.date instanceof Date ? options.date : new Date();
    const logFile = buildScopedLogFilePath(userDataPath, resolveDiagnosticsLogScope(options), now);
    fs.appendFileSync(logFile, buildPrefixedLogLines(message, now), 'utf8');
    return logFile;
  } catch (error) {
    console.error('[E307] Log write err: ' + error.message);
    return null;
  }
}

function captureMainProcessContext(extra = {}) {
  return {
    mode: resolveMainProcessMode(),
    argv: process.argv.slice(),
    execPath: process.execPath,
    appPath: safelyGetAppPath(),
    lastPage: mainProcessDiagnosticsState.lastPage,
    lastRendererLog: mainProcessDiagnosticsState.lastRendererLog,
    extra
  };
}

function getMainProcessRuntimeInfo(extra = {}) {
  return getEngineRuntimeMetadata({
    appVersion: getSafeAppVersion(),
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: safelyGetAppPath(),
    resourcesPath: process.resourcesPath || null,
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    mode: resolveMainProcessMode(),
    ...extra
  });
}

function logMainProcessFailure(kind, errorLike, context = {}) {
  appendMainProcessLog(
    buildCrashLogMessage(kind, errorLike, {
      ...captureMainProcessContext(context.extra),
      ...context
    })
  );
}

function updateDiagnosticsFromRendererLog(message) {
  const normalized = String(message || '').trim();
  if (!normalized) {
    return;
  }

  mainProcessDiagnosticsState.lastRendererLog = normalized;
  const pageMatch = normalized.match(/\[UI\]\s+Switch tab,\s+page:([a-z0-9_-]+)/i);
  if (pageMatch && pageMatch[1]) {
    mainProcessDiagnosticsState.lastPage = pageMatch[1].toLowerCase();
  }
}

process.on('uncaughtExceptionMonitor', (error, origin) => {
  logMainProcessFailure('uncaughtException', error, {
    origin: origin || 'uncaughtExceptionMonitor'
  });
});

process.on('unhandledRejection', (reason) => {
  logMainProcessFailure('unhandledRejection', reason);
});

app.on('render-process-gone', (event, webContents, details) => {
  logMainProcessFailure('render-process-gone', new Error(details?.reason || 'render-process-gone'), {
    extra: {
      reason: details?.reason || null,
      exitCode: details?.exitCode ?? null
    }
  });
});

app.on('child-process-gone', (event, details) => {
  logMainProcessFailure('child-process-gone', new Error(details?.reason || 'child-process-gone'), {
    extra: {
      type: details?.type || null,
      reason: details?.reason || null,
      exitCode: details?.exitCode ?? null,
      serviceName: details?.serviceName || null,
      name: details?.name || null
    }
  });
});

appendMainProcessLog(
  `[INFO] [MainProcess] bootstrap mode=${resolveMainProcessMode()} argv=${JSON.stringify(process.argv)}`
);
appendMainProcessLog(
  `[INFO] [MainProcess] runtime=${JSON.stringify(getMainProcessRuntimeInfo())}`
);

function getProjectRootPath() {
  return path.join(__dirname, '../../');
}

function isDeveloperLayoutModeAvailable() {
  const available = !app.isPackaged;
  if (available) {
    ensureGodModeLayoutStoreLoaded();
  }

  return available;
}

function getResourcesRootPath() {
  return app.isPackaged ? process.resourcesPath : getProjectRootPath();
}

function getAppContentRootPath() {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : getProjectRootPath();
}

function getBundledCloudDataPath() {
  return path.join(getResourcesRootPath(), 'cloud_data');
}

function getBundledAppManifestPath() {
  return path.join(getBundledCloudDataPath(), 'app_manifest.json');
}

function getCachedRemoteManifestPath() {
  return path.join(app.getPath('userData'), 'update_cache', 'app_manifest.remote.json');
}

function getReleaseRuntimeOptions() {
  return {
    projectRoot: getAppContentRootPath(),
    cloudDataDir: getBundledCloudDataPath(),
    releaseRoot: path.join(getAppContentRootPath(), 'release_upload'),
    packageJsonPath: path.join(getAppContentRootPath(), 'package.json'),
    preloadPath: path.join(getAppContentRootPath(), 'preload.js'),
    srcDir: path.join(getAppContentRootPath(), 'src'),
    defaultModelsDir: path.join(getAppContentRootPath(), 'src', 'default_models'),
    presetsDir: path.join(getBundledCloudDataPath(), 'presets'),
    manifestPath: getBundledAppManifestPath(),
    presetsManifestPath: path.join(getBundledCloudDataPath(), 'presets', 'presets_manifest.json')
  };
}

function resolveManifestCandidatesForAppRoot(targetAppPath) {
  const candidates = [];
  const normalizedAppRoot = path.resolve(targetAppPath);
  const resourcesRoot = path.basename(normalizedAppRoot).toLowerCase() === 'app'
    ? path.dirname(normalizedAppRoot)
    : normalizedAppRoot;

  candidates.push(path.join(resourcesRoot, 'cloud_data', 'app_manifest.json'));
  candidates.push(path.join(normalizedAppRoot, 'cloud_data', 'app_manifest.json'));
  candidates.push(path.join(normalizedAppRoot, 'app_manifest.json'));

  return Array.from(new Set(candidates));
}

// ==========================================
// 🚀 增量热更新引擎 (ZIP 下载与智能解压覆盖)
// ==========================================
// 🛠️ 内部工具：智能解压防呆函数
function classifyPatchLayout(zipEntries) {
  const normalizedNames = zipEntries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName.replace(/\\/g, '/'));

  const topLevelNames = new Set(
    normalizedNames
      .map((name) => name.split('/')[0])
      .filter(Boolean)
  );

  if (topLevelNames.has('app') || topLevelNames.has('cloud_data')) {
    return 'resources-root';
  }

  if (topLevelNames.has('src') || topLevelNames.has('package.json') || topLevelNames.has('preload.js')) {
    return 'app-root';
  }

  if (topLevelNames.has('main') || topLevelNames.has('renderer') || topLevelNames.has('default_models') || topLevelNames.has('input.css')) {
    return 'legacy-src-root';
  }

  return 'app-root';
}

function extractPatch(tempFilePath, targetResourcesPath) {
  const zip = new AdmZip(tempFilePath);
  const zipEntries = zip.getEntries();
  const layout = classifyPatchLayout(zipEntries);
  const appBasePath = app.isPackaged ? path.join(targetResourcesPath, 'app') : targetResourcesPath;
  const srcBasePath = app.isPackaged ? path.join(targetResourcesPath, 'app', 'src') : path.join(targetResourcesPath, 'src');
  const extractBasePath = layout === 'resources-root'
    ? targetResourcesPath
    : layout === 'legacy-src-root'
      ? srcBasePath
      : appBasePath;

  if (zipEntries.length === 0) throw new Error("下载的补丁包是空的！");

  // 💡 智能判断：检测压缩包是不是多套了一层文件夹
  const firstEntryName = zipEntries[0].entryName;
  const hasWrapperFolder = firstEntryName.includes('/') && zipEntries.every(entry => entry.entryName.startsWith(firstEntryName.split('/')[0] + '/'));

  if (hasWrapperFolder) {
    const wrapperFolderName = firstEntryName.split('/')[0] + '/';
    console.log(`[热更新] 检测到外层文件夹 [${wrapperFolderName}]，正在智能剥离...`);
    
    zipEntries.forEach(entry => {
      if (!entry.isDirectory) {
        // 算出剥离外层文件夹后的真实目标路径
        const targetPath = path.join(extractBasePath, entry.entryName.replace(wrapperFolderName, ''));
        // 确保目标文件夹存在
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        // 单个文件覆盖提取
        zip.extractEntryTo(entry, path.dirname(targetPath), false, true); 
      }
    });
  } else {
    console.log("[热更新] 压缩包层级正确，直接覆盖解压...");
    zip.extractAllTo(extractBasePath, true); // true 表示允许覆盖已有文件
  }
}

function normalizeVersionValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim().replace(/^v/i, '');
  return normalized && /\d/.test(normalized) ? normalized : null;
}

function findVersionInJsonData(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    return null;
  }

  const directCandidates = [
    jsonData.version,
    jsonData.presetVersion,
    jsonData.preset_version,
    jsonData.profileVersion,
    jsonData.profile_version,
    jsonData.realVersion,
    jsonData.real_version,
    jsonData.meta && jsonData.meta.version,
    jsonData.info && jsonData.info.version,
    jsonData.preset && jsonData.preset.version,
    jsonData.profile && jsonData.profile.version
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeVersionValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const visited = new Set();
  const queue = [{ value: jsonData, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !current.value || typeof current.value !== 'object') {
      continue;
    }

    if (visited.has(current.value) || current.depth > 4) {
      continue;
    }
    visited.add(current.value);

    for (const [key, value] of Object.entries(current.value)) {
      if (/version/i.test(key)) {
        const normalized = normalizeVersionValue(value);
        if (normalized) {
          return normalized;
        }
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        queue.push({ value, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

function inspectPatchArchive(tempFilePath) {
  const zip = new AdmZip(tempFilePath);
  const zipEntries = zip.getEntries();

  if (zipEntries.length === 0) {
    throw new Error('下载的补丁包为空，无法应用更新。');
  }

  const packageEntries = zipEntries
    .filter((entry) => !entry.isDirectory && /(^|\/)package\.json$/i.test(entry.entryName))
    .sort((left, right) => left.entryName.split('/').length - right.entryName.split('/').length);

  let packageVersion = null;
  if (packageEntries.length > 0) {
    const packageJson = JSON.parse(packageEntries[0].getData().toString('utf8'));
    packageVersion = normalizeVersionValue(packageJson.version);
  }

  const manifestEntries = zipEntries
    .filter((entry) => !entry.isDirectory && /(^|\/)(app_manifest|cloud_data\/app_manifest)\.json$/i.test(entry.entryName.replace(/\\/g, '/')))
    .sort((left, right) => left.entryName.split('/').length - right.entryName.split('/').length);

  let manifestVersion = null;
  for (const manifestEntry of manifestEntries) {
    try {
      const manifestJson = JSON.parse(manifestEntry.getData().toString('utf8'));
      manifestVersion = normalizeVersionValue(
        manifestJson.latestVersion
        || manifestJson.version
        || findVersionInJsonData(manifestJson)
      );
      if (manifestVersion) {
        break;
      }
    } catch (error) {
      console.warn('[HotUpdate] Failed to parse manifest candidate inside patch archive:', manifestEntry.entryName, error.message);
    }
  }

  return {
    zipEntries,
    packageVersion,
    manifestVersion
  };
}

function readInstalledAppVersion(targetAppPath) {
  try {
    const manifestCandidates = resolveManifestCandidatesForAppRoot(targetAppPath);

    for (const manifestPath of manifestCandidates) {
      if (!fs.existsSync(manifestPath)) continue;
      const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const manifestVersion = normalizeVersionValue(
        manifestJson.latestVersion
        || manifestJson.version
        || findVersionInJsonData(manifestJson)
      );
      if (manifestVersion) {
        return manifestVersion;
      }
    }

    const packageJsonPath = path.join(targetAppPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const packageVersion = normalizeVersionValue(packageJson.version);
      if (packageVersion) {
        return packageVersion;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function readAppPackageVersion(targetAppPath) {
  return readInstalledAppVersion(targetAppPath);
}

function downloadPatchBuffer(url) {
  return new Promise((resolve, reject) => {
    const transport = String(url).startsWith('https://') ? https : http;
    const request = transport.get(url, {
      headers: {
        'User-Agent': 'MKP-Support-Electron',
        'Accept': '*/*'
      }
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(downloadPatchBuffer(response.headers.location));
        return;
      }

      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode || 0}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(15000, () => request.destroy(new Error('请求超时')));
  });
}


// ==========================================
// 🚀 预设文件本地复制引擎 (防中文/防无限叠加/内置展示名)
// ==========================================
ipcMain.handle('duplicate-preset', (event, payload) => {
  try {
    const { fileName, printerId, versionType, realVersion } = payload;
    const dir = path.join(app.getPath('userData'), 'Presets');
    const srcPath = path.join(dir, fileName);

    if (!fs.existsSync(srcPath)) throw new Error("源文件不存在");

    // 1. 生成 12 位纯数字时间戳 (如: 260313122011)
    const d = new Date();
    const ts = String(d.getFullYear()).slice(-2) +
               String(d.getMonth() + 1).padStart(2, '0') +
               String(d.getDate()).padStart(2, '0') +
               String(d.getHours()).padStart(2, '0') +
               String(d.getMinutes()).padStart(2, '0') +
               String(d.getSeconds()).padStart(2, '0');

    // 2. 拼接纯英文、固定长度的文件名 (杜绝无限叠加！)
    // 不管源文件叫什么，新文件永远是: a1_quick_v3.0.0-r1_260313122011.json
    const normalizedPrinterId = String(printerId || '').trim();
    let resolvedVersionType = typeof versionType === 'string' ? versionType.trim() : '';
    if (!resolvedVersionType || resolvedVersionType.toLowerCase() === 'null' || resolvedVersionType.toLowerCase() === 'undefined') {
      const escapedPrinterId = normalizedPrinterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionTypeMatch = String(fileName || '').match(new RegExp(`^${escapedPrinterId}_([^_]+)_v`, 'i'));
      resolvedVersionType = versionTypeMatch?.[1] || '';
    }
    if (!resolvedVersionType) {
      resolvedVersionType = 'standard';
    }

    const newFileName = `${normalizedPrinterId}_${resolvedVersionType}_v${realVersion}_${ts}.json`;
    const destPath = path.join(dir, newFileName);

    // 3. 读取源文件，注入中文显示名 `_custom_name`
    const rawData = fs.readFileSync(srcPath, 'utf-8');
    const jsonData = JSON.parse(rawData);

    // 提取原有的 _custom_name 或基于版本号生成
    let baseName = jsonData._custom_name;
    if (!baseName) {
        baseName = `v${realVersion}`; // 如果原文件没起名字，就叫 v3.0.0-r1
    }
    // 智能清洗：把旧的“副本_xxxx”字样砍掉，防止在 UI 上变成“副本 副本 副本”
    baseName = baseName.replace(/\s*副本_\d{4}$/, '');

    // 注入新的展示名，例如: "v3.0.0-r1 副本_2011"
    jsonData._custom_name = `${baseName} 副本_${ts.slice(-4)}`;

    // 重新写入硬盘
    fs.writeFileSync(destPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    try {
      savePresetBackupSync(destPath, jsonData);
    } catch (backupError) {
      console.warn('[PresetBackup] 复制预设后创建备份失败:', backupError.message);
    }

    return { success: true, newFileName };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 📡 IPC 接收器：保存云端最新的 manifest 到本地
ipcMain.handle('save-local-manifest', async (event, jsonStr) => {
  try {
    // 💡 这里的路径必须和你的热更新解压目录保持绝对一致！
    // 这样它才能真正覆盖软件里的旧数据，确保下次断网启动时读到的是新数据
    const targetPath = getBundledAppManifestPath();

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, jsonStr, 'utf-8');
    console.log('[版本引擎] 本地 app_manifest.json 已成功覆盖为最新云端版本');
    
    return { success: true };
  } catch (error) {
    console.error("[版本引擎] 保存本地 manifest 失败:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-bundled-preset', async (event, fileName) => {
  try {
    const bundledDir = app.isPackaged
      ? path.join(process.resourcesPath, 'cloud_data', 'presets')
      : path.join(__dirname, '../../cloud_data/presets');
    const sourcePath = path.join(bundledDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '打包资源中不存在该预设文件' };
    }

    const userDataPath = path.join(app.getPath('userData'), 'Presets');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const targetPath = path.join(userDataPath, fileName);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      try {
        const presetData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
        savePresetBackupSync(targetPath, presetData);
      } catch (backupError) {
        console.warn('[PresetBackup] copy bundled preset backup failed:', backupError.message);
      }
    }

    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==========================================
// 🚀 预设清单 (Manifest) 本地读写引擎
// ==========================================
ipcMain.handle('read-local-presets-manifest', async () => {
  try {
    const userManifestPath = path.join(app.getPath('userData'), 'Presets', 'presets_manifest.json');
    const bundledManifestPath = app.isPackaged
      ? path.join(process.resourcesPath, 'cloud_data', 'presets', 'presets_manifest.json')
      : path.join(__dirname, '../../cloud_data/presets/presets_manifest.json');
    const manifestPath = fs.existsSync(userManifestPath) ? userManifestPath : bundledManifestPath;
    if (fs.existsSync(manifestPath)) {
      const data = fs.readFileSync(manifestPath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: '本地清单不存在' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-local-presets-manifest', async (event, jsonStr) => {
  try {
    const manifestPath = path.join(app.getPath('userData'), 'Presets', 'presets_manifest.json');
    fs.writeFileSync(manifestPath, jsonStr, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// 📡 IPC 接收器：前端呼叫强行读取本地 manifest (绕过 fetch 限制)
ipcMain.handle('read-bundled-presets-manifest', async () => {
  try {
    const manifestPath = app.isPackaged
      ? path.join(process.resourcesPath, 'cloud_data', 'presets', 'presets_manifest.json')
      : path.join(__dirname, '../../cloud_data/presets/presets_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: '打包 manifest 不存在' };
    }

    const data = fs.readFileSync(manifestPath, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-local-manifest', async () => {
  try {
    const manifestPath = getBundledAppManifestPath();
      
    if (fs.existsSync(manifestPath)) {
      const data = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(data);
    } else {
      console.warn('[版本引擎] 本地未找到 app_manifest.json');
      return null;
    }
  } catch (error) {
    console.error('[版本引擎] 读取本地 manifest 失败:', error);
    return null;
  }
});

// 📡 IPC 接收器：前端呼叫热更新
ipcMain.handle('read-release-info', async () => {
  try {
    return { success: true, data: readReleaseEditorState(getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-release-info', async (event, payload) => {
  try {
    return { success: true, data: saveReleaseEditorState(payload || {}, getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-release-config', async () => {
  try {
    return { success: true, data: readDefaultCatalogConfig(getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-release-config-catalog', async (event, payload) => {
  try {
    return { success: true, data: saveDefaultCatalogConfig(payload || {}, getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-release-config-image', async (event, payload) => {
  try {
    return { success: true, data: await importDefaultCatalogImage(payload || {}, getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-release-config-preset', async (event, fileName) => {
  try {
    return { success: true, data: readDefaultPreset(fileName, getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-release-config-preset', async (event, payload) => {
  try {
    return { success: true, data: saveDefaultPreset(payload || {}, getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('run-release-build', async (event, mode) => {
  try {
    return { success: true, data: runReleaseMode(String(mode || '2'), getReleaseRuntimeOptions()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-release-path', async (event, target) => {
  try {
    const options = getReleaseRuntimeOptions();
    const mapping = {
      cloud: path.join(options.releaseRoot, 'cloud_data'),
      dist: path.join(options.projectRoot, 'dist'),
      readme: path.join(options.releaseRoot, 'release_readme.txt'),
      manifest: options.manifestPath
    };
    const targetPath = mapping[String(target || 'cloud')] || mapping.cloud;
    await shell.openPath(targetPath);
    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-converted-presets-folder', async () => {
  try {
    const outputDir = ensureConvertedPresetsDir(app.getPath('userData'));
    return { success: true, path: outputDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-converted-presets-folder', async () => {
  try {
    const outputDir = ensureConvertedPresetsDir(app.getPath('userData'));
    const openError = await shell.openPath(outputDir);
    if (openError) {
      return { success: false, error: openError, path: outputDir };
    }
    return { success: true, path: outputDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('convert-toml-preset-to-json', async () => {
  try {
    const pickerResult = await dialog.showOpenDialog({
      title: '选择要转换的 TOML 预设',
      properties: ['openFile'],
      filters: [
        { name: 'TOML Preset', extensions: ['toml'] }
      ]
    });

    if (pickerResult.canceled || !pickerResult.filePaths?.[0]) {
      return { success: false, canceled: true };
    }

    const conversion = convertTomlPresetFileToJson(pickerResult.filePaths[0], app.getPath('userData'));
    return {
      success: true,
      sourcePath: conversion.sourcePath,
      outputPath: conversion.outputPath,
      outputDir: conversion.outputDir
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-home-catalog', async () => {
  try {
    return { success: true, data: readHomeCatalog(app.getPath('userData')) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-home-catalog', async (event, payload) => {
  try {
    const filePath = saveHomeCatalog(app.getPath('userData'), payload || {});
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reset-home-catalog', async () => {
  try {
    removeHomeCatalog(app.getPath('userData'));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-home-catalog-image', async (event, payload) => {
  try {
    const filePath = await importHomeCatalogImage(app.getPath('userData'), payload || {});
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apply-hot-update', async (event, payload) => {
  const tempZipPath = path.join(app.getPath('temp'), 'mkp_patch.zip');
  try {
    console.log(`[热更新] 准备下载补丁: ${zipUrl}`);
    
    // 1. 下载 ZIP 到系统的临时目录 (Temp)
    const tempZipPath = path.join(app.getPath('temp'), 'mkp_patch.zip');
    const response = await fetch(zipUrl);
    
    if (!response.ok) throw new Error(`云端下载失败，HTTP状态码: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempZipPath, Buffer.from(arrayBuffer));
    console.log(`[热更新] 补丁下载完成，保存在: ${tempZipPath}`);

    // 2. 确定要覆盖的本地代码老巢 (resources/app)
    const targetExtractPath = getResourcesRootPath();

    // 3. 呼叫智能解压工具
    extractPatch(tempZipPath, targetExtractPath);
    
    console.log(`[热更新] 解压覆盖成功！目标目录: ${targetExtractPath}`);
    
    // 4. 打扫战场 (删除临时压缩包)
    try {
      fs.unlinkSync(tempZipPath);
    } catch (error) {
      console.warn('[HotUpdate] Failed to remove temporary patch archive after apply:', tempZipPath, error.message);
    }

    return { success: true };
    
  } catch (error) {
    console.error("[热更新] 严重失败:", error);
    return { success: false, error: error.message };
  }
});

// ==========================================
// 日志系统 (按天轮转 + 自动清理)
// ==========================================
ipcMain.on('write-log', (event, message) => {
  try {
    updateDiagnosticsFromRendererLog(message);
    appendMainProcessLog(message);
    return;
    const logDir = path.join(app.getPath('userData'), 'Logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 1. 自动清理 7 天前的旧日志 (每次写日志时顺手检查一下)
    const files = fs.readdirSync(logDir);
    const nowTime = Date.now();
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        // 如果文件最后修改时间超过 7 天 (7 * 24 * 60 * 60 * 1000 毫秒)，就删掉它
        if (nowTime - stats.mtimeMs > 7 * 24 * 3600 * 1000) {
          fs.unlinkSync(filePath);
        }
      }
    });

    // 2. 按天生成当前日志文件
    const date = new Date();
    const fileName = `mkp_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
    const logFile = path.join(logDir, fileName);

    // 3. 格式化时间并写入
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    const logLine = `[${timeStr}] ${message}\n`;

    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (error) {
    console.error("[E307] Log write err: " + error.message);
  }
});

function getReusableSupportBundleExportResult(nowMs = Date.now()) {
  if (!lastSupportBundleExportResult || !lastSupportBundleExportResult.success) {
    return null;
  }

  const exportedAtMs = Number(lastSupportBundleExportResult.exportedAtMs || 0);
  if (!exportedAtMs || nowMs - exportedAtMs > SUPPORT_BUNDLE_REUSE_WINDOW_MS) {
    lastSupportBundleExportResult = null;
    return null;
  }

  if (!lastSupportBundleExportResult.readmePath || !fs.existsSync(lastSupportBundleExportResult.readmePath)) {
    lastSupportBundleExportResult = null;
    return null;
  }

  const { exportedAtMs: ignoredExportedAtMs, ...cachedResult } = lastSupportBundleExportResult;
  return {
    ...cachedResult,
    reused: true
  };
}

function rememberSupportBundleExportResult(result, nowMs = Date.now()) {
  if (!result || result.success !== true) {
    return result;
  }

  lastSupportBundleExportResult = {
    ...result,
    exportedAtMs: nowMs
  };
  return result;
}

ipcMain.handle('open-last-support-bundle-folder', async () => {
  if (!lastSupportBundleExportResult?.success || !lastSupportBundleExportResult.readmePath) {
    return {
      success: false,
      error: '最近没有可打开的诊断包。'
    };
  }

  if (!fs.existsSync(lastSupportBundleExportResult.readmePath)) {
    lastSupportBundleExportResult = null;
    return {
      success: false,
      error: '最近的诊断包文件夹已经不存在。'
    };
  }

  shell.showItemInFolder(lastSupportBundleExportResult.readmePath);
  return {
    success: true,
    exportDir: lastSupportBundleExportResult.exportDir || null,
    readmePath: lastSupportBundleExportResult.readmePath
  };
});

// ==========================================
// 生成极简诊断报告 (导出至桌面)
// ==========================================
function exportSupportBundleToDesktop() {
  const reusableSupportBundleExportResult = getReusableSupportBundleExportResult();
  if (reusableSupportBundleExportResult) {
    return reusableSupportBundleExportResult;
  }

  const now = new Date();
  const desktopPath = app.getPath('desktop');
  const userDataPath = app.getPath('userData');
  const exportRootDir = path.join(desktopPath, 'mkpse_log');
  const guiExcerpt = collectScopedLogExcerpt({
    userDataPath,
    scope: 'gui',
    date: now,
    maxLines: DIAGNOSTIC_EXPORT_MAX_LOG_LINES
  });
  const cliExcerpt = collectScopedLogExcerpt({
    userDataPath,
    scope: 'cli',
    date: now,
    maxLines: DIAGNOSTIC_EXPORT_MAX_LOG_LINES,
    maxIssueLines: DIAGNOSTIC_EXPORT_MAX_ISSUE_LOG_LINES,
    latestSessionOnly: true
  });
  const bundle = buildSupportBundle({
    appVersion: getSafeAppVersion(),
    runtime: getMainProcessRuntimeInfo(),
    lastPage: mainProcessDiagnosticsState.lastPage,
    lastRendererLog: mainProcessDiagnosticsState.lastRendererLog,
    guiLogExcerpt: guiExcerpt.content,
    cliLogExcerpt: cliExcerpt.content,
    guiLogMeta: guiExcerpt,
    cliLogMeta: cliExcerpt
  }, {
    date: now
  });
  const exportDir = path.join(exportRootDir, bundle.folderName);

  fs.mkdirSync(exportDir, { recursive: true });
  bundle.files.forEach((file) => {
    fs.writeFileSync(path.join(exportDir, file.name), file.content, 'utf8');
  });

  const readmePath = path.join(exportDir, 'README_MKPSE_求助.txt');
  appendMainProcessLog(
    `[INFO] [MainProcess] support bundle exported fingerprint=${bundle.fingerprint} exportDir=${exportDir}`,
    { scope: 'gui' }
  );
  shell.showItemInFolder(readmePath);

  return rememberSupportBundleExportResult({
    success: true,
    fingerprint: bundle.fingerprint,
    summary: bundle.summary,
    exportDir,
    readmePath,
    reused: false
  }, now.getTime());
}

ipcMain.handle('export-bug-report', async () => {
  if (supportBundleExportPromise) {
    return supportBundleExportPromise;
  }

  supportBundleExportPromise = (async () => {
    try {
      return exportSupportBundleToDesktop();
    } catch (error) {
      appendMainProcessLog(
        `[ERROR] [MainProcess] support bundle export failed message=${JSON.stringify(error.message || String(error))}`,
        { scope: 'gui' }
      );
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  })();

  try {
    return await supportBundleExportPromise;
  } finally {
    supportBundleExportPromise = null;
  }
});
/*
    const desktopPath = app.getPath('desktop');
    const now = new Date();
    
    // 导出文件命名
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const exportPath = path.join(desktopPath, `mkpse_${dateStr}.txt`);

    // 🔍 找到今天的日志文件
    const logDir = path.join(app.getPath('userData'), 'Logs');
    const todayFileName = `mkp_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.log`;
    const todayLogPath = path.join(logDir, todayFileName);

    let logContent = '=== 今日暂无运行日志 ===';
    if (fs.existsSync(todayLogPath)) {
      const content = fs.readFileSync(todayLogPath, 'utf-8');
      const lines = content.split('\n');
      logContent = lines.slice(-500).join('\n'); // 只取最后 500 行
    }

    const header = `
=========================================
📝 MKPSE 运行日志 (安全导出)
=========================================
✅ 隐私声明：本报告仅包含软件的基础运行状态与报错代码，绝不包含您的模型数据、个人文件或身份信息。请放心发送至交流群求助。

软件版本: v${app.getVersion()}
操作系统: ${require('os').type()} ${require('os').arch()}
导出时间: ${now.toLocaleString('zh-CN')}
=========================================
👇 今日运行日志 👇

`;
    fs.writeFileSync(exportPath, header + logContent);
    require('electron').shell.showItemInFolder(exportPath);
  } catch (error) {
    console.error('导出报告失败', e);
  }
});


// 版本号对比工具
*/
function compareVersions(v1, v2) {
  const a = (v1 || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const b = (v2 || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const num1 = a[i] || 0;
    const num2 = b[i] || 0;
    if (num1 > num2) return 1;  
    if (num1 < num2) return -1; 
  }
  return 0; 
}

// ==========================================
// 🚀 初始化：释放出厂预设数据 (适配最新扁平架构 + 完善日志)
// ==========================================
ipcMain.handle('init-default-presets', async () => {
  try {
    const userDataPath = path.join(app.getPath('userData'), 'Presets');
    
    // 1. 确保用户目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
      console.log("[系统初始化] 📁 创建用户数据目录:", userDataPath);
    }

    // 2. 自动判断环境，精准定位云端数据文件夹
    // 打包后：去 resources 里找 | 开发中：从 src/main 往上跳两级到根目录
    const bundledPresetsPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'cloud_data', 'presets') 
      : path.join(__dirname, '../../cloud_data/presets');

    if (!fs.existsSync(bundledPresetsPath)) {
      console.warn(`[系统初始化] ⚠️ 未找到内置预设目录: ${bundledPresetsPath}`);
      return { success: true, msg: "无内置预设" };
    }

    console.log(`[系统初始化] ⏳ 正在从 ${bundledPresetsPath} 释放预设...`);
    let copiedCount = 0;

    // 3. 遍历并释放文件
    const files = fs.readdirSync(bundledPresetsPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sourceFile = path.join(bundledPresetsPath, file);
        const targetFile = path.join(userDataPath, file);
        const shouldForceRefresh = file.toLowerCase() === 'presets_manifest.json';

        // 💡 核心优化：因为新版文件名自带版本号(如 v3.0.0-r1)，只要文件不存在直接复制即可
        if (shouldForceRefresh || !fs.existsSync(targetFile)) {
          fs.copyFileSync(sourceFile, targetFile);
          console.log(`[O103] Default preset release, file:${file}`);
          copiedCount++;
        } else {
          // 如果同名文件已存在，说明用户已经有了这个版本的预设，无需覆盖
          console.log(`[系统初始化] ⚡ 预设已存在，跳过: ${file}`);
        }
      }
    }
    
    console.log(`[系统初始化] 🎉 预设释放完成！本次共新增 ${copiedCount} 个文件。`);
    return { success: true, copiedCount };

  } catch (error) {
    console.error("[E102] Preset release fail: ", error);
    return { success: false, error: error.message };
  }
});

let postprocessReportWindow = null;
let postprocessReportStatePath = null;
const POSTPROCESS_REPORT_MINIMUM_PROGRESS_DURATION_MS = 1000;
const POSTPROCESS_REPORT_AUTO_CLOSE_SECONDS = 10;
const POSTPROCESS_REPORT_BOOTSTRAP_DELAY_MS = 560;
const POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS = 320;
const POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT = 12;
const POSTPROCESS_REPORT_UI_VARIANT_LEGACY = 'legacy';
const POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2 = 'classic-v2';
const DEFAULT_APP_WINDOW_WIDTH = 934;
const DEFAULT_APP_WINDOW_HEIGHT = 646;

function waitForMilliseconds(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(durationMs) || 0));
  });
}

function getOptionalCliFlagValue(argv = [], flag) {
  const directValue = getArgValue(argv, flag);
  if (directValue) {
    return directValue;
  }

  const prefix = `${flag}=`;
  const matchedArg = (argv || []).find((item) => String(item || '').startsWith(prefix));
  return matchedArg ? matchedArg.slice(prefix.length) : null;
}

function normalizePostprocessReportUiVariant(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2
    || normalized === 'classic_v2'
    || normalized === 'v2'
  ) {
    return POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2;
  }

  return POSTPROCESS_REPORT_UI_VARIANT_LEGACY;
}

function resolvePostprocessReportUiVariant(argv = process.argv, env = process.env) {
  const cliValue = getOptionalCliFlagValue(argv, '--postprocess-report-ui');
  if (cliValue) {
    return normalizePostprocessReportUiVariant(cliValue);
  }

  const envValue = env?.MKP_POSTPROCESS_REPORT_UI;
  if (envValue != null && String(envValue).trim()) {
    return normalizePostprocessReportUiVariant(envValue);
  }

  return POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2;
}

function getPostprocessReportWindowMetrics(variant = POSTPROCESS_REPORT_UI_VARIANT_LEGACY) {
  if (normalizePostprocessReportUiVariant(variant) === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2) {
    return {
      collapsedWidth: DEFAULT_APP_WINDOW_WIDTH,
      collapsedHeight: DEFAULT_APP_WINDOW_HEIGHT,
      expandedWidth: DEFAULT_APP_WINDOW_WIDTH,
      expandedHeight: DEFAULT_APP_WINDOW_HEIGHT,
      minWidth: DEFAULT_APP_WINDOW_WIDTH,
      minHeight: DEFAULT_APP_WINDOW_HEIGHT,
      backgroundColor: '#f5f7fb'
    };
  }

  return {
    collapsedWidth: 720,
    collapsedHeight: 320,
    expandedWidth: 1160,
    expandedHeight: 860,
    minWidth: 520,
    minHeight: 280,
    backgroundColor: '#f3f6fb'
  };
}

function resolvePostprocessReportRendererPath(variant = POSTPROCESS_REPORT_UI_VARIANT_LEGACY) {
  return path.join(
    __dirname,
    normalizePostprocessReportUiVariant(variant) === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2
      ? '../renderer/postprocess_report_v2.html'
      : '../renderer/postprocess_report_legacy.html'
  );
}

const postprocessReportUiVariant = resolvePostprocessReportUiVariant();

function buildPostprocessReportBootstrapDataUrlLegacy() {
  const bootstrapHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MKP 后处理中</title>
  <style>
    :root {
      color-scheme: light;
      --bootstrap-bg: #f3f6fb;
      --bootstrap-panel: rgba(255, 255, 255, 0.94);
      --bootstrap-text: #111827;
      --bootstrap-muted: #6b7280;
      --bootstrap-accent: #3b82f6;
      --bootstrap-border: rgba(148, 163, 184, 0.18);
      --bootstrap-track: rgba(59, 130, 246, 0.14);
      --bootstrap-shadow: 0 22px 48px rgba(15, 23, 42, 0.10);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), rgba(59, 130, 246, 0) 38%),
        linear-gradient(180deg, #f7f9fc 0%, var(--bootstrap-bg) 100%);
      color: var(--bootstrap-text);
      overflow: hidden;
    }

    body {
      display: grid;
      place-items: center;
      padding: 18px;
    }

    .bootstrap-shell {
      width: min(100%, 720px);
      border-radius: 24px;
      border: 1px solid var(--bootstrap-border);
      background: var(--bootstrap-panel);
      box-shadow: var(--bootstrap-shadow);
      padding: 24px 26px;
    }

    .bootstrap-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .bootstrap-mark {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--bootstrap-accent);
      font-weight: 800;
      letter-spacing: 0.08em;
      flex-shrink: 0;
    }

    .bootstrap-title {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.2;
      margin: 0;
    }

    .bootstrap-copy {
      margin: 4px 0 0;
      color: var(--bootstrap-muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .bootstrap-progress-meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .bootstrap-percent {
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
      color: var(--bootstrap-accent);
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }

    .bootstrap-phase {
      color: var(--bootstrap-muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .bootstrap-progress-track {
      position: relative;
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--bootstrap-track);
      border: 1px solid rgba(59, 130, 246, 0.12);
    }

    .bootstrap-progress-fill {
      position: relative;
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.76), #3b82f6 70%, rgba(255, 255, 255, 0.95) 100%);
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.24);
      transition: width 0.12s linear;
    }

    .bootstrap-progress-fill::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.34) 50%, rgba(255, 255, 255, 0) 100%);
      transform: translateX(-100%);
      animation: bootstrap-slide 1.15s linear infinite;
    }

    .bootstrap-stages {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .bootstrap-stage {
      --stage-progress: 0%;
      position: relative;
      min-width: 132px;
      flex: 1 1 0;
      padding: 10px 12px 16px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.94) 100%);
      color: var(--bootstrap-muted);
      overflow: hidden;
      transition:
        border-color 0.18s ease,
        background 0.18s ease,
        box-shadow 0.18s ease,
        color 0.18s ease,
        transform 0.18s ease;
    }

    .bootstrap-stage::before,
    .bootstrap-stage::after {
      content: "";
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 8px;
      height: 4px;
      border-radius: 999px;
    }

    .bootstrap-stage::before {
      background: rgba(59, 130, 246, 0.10);
    }

    .bootstrap-stage::after {
      right: auto;
      width: var(--stage-progress);
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.78) 0%, #3b82f6 100%);
      box-shadow: 0 4px 10px rgba(59, 130, 246, 0.20);
      transition: width 0.12s linear;
    }

    .bootstrap-stage-title {
      display: block;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
      color: inherit;
    }

    .bootstrap-stage-range {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      line-height: 1.4;
      opacity: 0.78;
      font-variant-numeric: tabular-nums;
    }

    .bootstrap-stage.is-active,
    .bootstrap-stage.is-complete {
      color: var(--bootstrap-text);
    }

    .bootstrap-stage.is-active {
      border-color: rgba(59, 130, 246, 0.26);
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.10) 0%, rgba(59, 130, 246, 0.05) 100%);
      box-shadow: 0 12px 28px rgba(59, 130, 246, 0.12);
      transform: translateY(-1px);
    }

    .bootstrap-stage.is-complete {
      border-color: rgba(59, 130, 246, 0.18);
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%);
    }

    .bootstrap-status {
      margin-top: 12px;
      color: var(--bootstrap-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    @keyframes bootstrap-slide {
      0% {
        transform: translateX(-105%);
      }

      100% {
        transform: translateX(285%);
      }
    }
  </style>
</head>
<body>
  <section class="bootstrap-shell" aria-label="后处理启动中">
    <div class="bootstrap-head">
      <div class="bootstrap-mark">MKP</div>
      <div>
        <h1 class="bootstrap-title">正在启动后处理窗口</h1>
        <p class="bootstrap-copy">启动阶段会先计入总进度，随后继续显示实时处理进度。</p>
      </div>
    </div>
    <div class="bootstrap-progress-meta">
      <div id="bootstrapPercent" class="bootstrap-percent">0%</div>
      <div id="bootstrapPhase" class="bootstrap-phase">正在显示执行窗口</div>
    </div>
    <div class="bootstrap-progress-track" aria-hidden="true">
      <div id="bootstrapFill" class="bootstrap-progress-fill"></div>
    </div>
    <div id="bootstrapStages" class="bootstrap-stages" aria-label="后处理启动阶段">
      <div class="bootstrap-stage is-active" data-stage-start="0" data-stage-end="4">
        <span class="bootstrap-stage-title">显示窗口</span>
        <small class="bootstrap-stage-range">0-4%</small>
      </div>
      <div class="bootstrap-stage" data-stage-start="4" data-stage-end="8">
        <span class="bootstrap-stage-title">加载报告</span>
        <small class="bootstrap-stage-range">4-8%</small>
      </div>
      <div class="bootstrap-stage" data-stage-start="8" data-stage-end="${POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT}">
        <span class="bootstrap-stage-title">同步状态</span>
        <small class="bootstrap-stage-range">8-${POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT}%</small>
      </div>
    </div>
    <div id="bootstrapStatus" class="bootstrap-status">正在准备报告界面与初始状态同步...</div>
  </section>
  <script>
    (function() {
      const targetPercent = ${POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT};
      const durationMs = ${Math.max(360, POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS)};
      const phases = [
        { percent: 0, label: '正在显示执行窗口', status: '优先把窗口显示出来，后台处理随后开始。' },
        { percent: 4, label: '正在加载报告界面', status: '正在准备实时报告所需的页面资源。' },
        { percent: 8, label: '正在同步初始状态', status: '即将切换到正式报告页并接入真实进度。' },
        { percent: targetPercent, label: '即将进入实时报告', status: '启动阶段完成，后续百分比会继续累计到 100%。' }
      ];
      const percentElement = document.getElementById('bootstrapPercent');
      const phaseElement = document.getElementById('bootstrapPhase');
      const statusElement = document.getElementById('bootstrapStatus');
      const fillElement = document.getElementById('bootstrapFill');
      const stageElements = Array.from(document.querySelectorAll('.bootstrap-stage'));
      let startTime = 0;

      function resolvePhase(percent) {
        let currentPhase = phases[0];
        for (const phase of phases) {
          if (percent >= phase.percent) {
            currentPhase = phase;
          }
        }
        return currentPhase;
      }

      function render(percent) {
        const safePercent = Math.max(0, Math.min(targetPercent, percent));
        const currentPhase = resolvePhase(safePercent);
        percentElement.textContent = Math.round(safePercent) + '%';
        phaseElement.textContent = currentPhase.label;
        statusElement.textContent = currentPhase.status;
        fillElement.style.width = safePercent + '%';
        stageElements.forEach((stage, index) => {
          const stageStart = Number(stage.dataset.stageStart || 0);
          const stageEnd = Number(stage.dataset.stageEnd || targetPercent);
          const stageSpan = Math.max(1, stageEnd - stageStart);
          const stageProgress = safePercent <= stageStart
            ? 0
            : safePercent >= stageEnd
              ? 100
              : ((safePercent - stageStart) / stageSpan) * 100;
          const isLastStage = index === stageElements.length - 1;
          const isComplete = safePercent >= stageEnd && !isLastStage;
          const isActive = !isComplete && safePercent >= stageStart;

          stage.style.setProperty('--stage-progress', Math.max(0, Math.min(100, stageProgress)).toFixed(2) + '%');
          stage.classList.toggle('is-complete', isComplete);
          stage.classList.toggle('is-active', isActive);
        });
      }

      function tick(timestamp) {
        if (!startTime) {
          startTime = timestamp;
        }

        const elapsed = timestamp - startTime;
        const percent = Math.min(targetPercent, (elapsed / durationMs) * targetPercent);
        render(percent);

        if (percent < targetPercent) {
          window.requestAnimationFrame(tick);
        }
      }

      render(0);
      window.requestAnimationFrame(tick);
    })();
  </script>
</body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(bootstrapHtml)}`;
}

function buildPostprocessReportBootstrapDataUrlClassicV2() {
  const bootstrapHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MKP 后处理中</title>
  <style>
    :root {
      color-scheme: light;
      --surface: #ffffff;
      --surface-muted: #f5f7fb;
      --surface-line: rgba(148, 163, 184, 0.18);
      --text: #0f172a;
      --muted: #667085;
      --accent: #2563eb;
      --track: rgba(37, 99, 235, 0.12);
      --shadow: 0 18px 42px rgba(15, 23, 42, 0.10);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
      background:
        linear-gradient(180deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.015) 148px, rgba(37, 99, 235, 0) 100%),
        var(--surface-muted);
      color: var(--text);
      overflow: hidden;
    }

    body {
      display: grid;
      place-items: center;
      padding: 18px;
    }

    .shell {
      width: min(100%, 660px);
      border-radius: 20px;
      border: 1px solid var(--surface-line);
      background: rgba(255, 255, 255, 0.96);
      box-shadow: var(--shadow);
      padding: 18px 20px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(37, 99, 235, 0.10);
      border: 1px solid rgba(37, 99, 235, 0.14);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--accent);
      flex-shrink: 0;
    }

    .eyebrow {
      display: block;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .title {
      margin: 0;
      font-size: 16px;
      line-height: 1.2;
      font-weight: 700;
    }

    .status {
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.10);
      border: 1px solid rgba(37, 99, 235, 0.16);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .label {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .headline {
      margin: 6px 0 0;
      font-size: 24px;
      line-height: 1.16;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .copy {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .progress-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      margin-top: 20px;
    }

    .track {
      height: 10px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--track);
      border: 1px solid rgba(37, 99, 235, 0.10);
    }

    .fill {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(37, 99, 235, 0.76) 0%, #2563eb 100%);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.18);
      transition: width 0.12s linear;
    }

    .percent {
      min-width: 54px;
      text-align: right;
      font-size: 18px;
      line-height: 1;
      font-weight: 800;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }

    .footer {
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <section class="shell" aria-label="后处理启动中">
    <div class="topbar">
      <div class="brand">
        <div class="mark">MKP</div>
        <div>
          <small class="eyebrow">Classic V2 Preview</small>
          <h1 class="title">CLI 后处理进度窗</h1>
        </div>
      </div>
      <div class="status">运行中</div>
    </div>
    <p id="bootstrapPhase" class="label">正在启动后处理窗口</p>
    <h2 class="headline">先让窗口稳定显示出来</h2>
    <p id="bootstrapStatus" class="copy">这个实验版会先显示一个更像工具程序的进度壳，再接入真实处理进度。</p>
    <div class="progress-row">
      <div class="track" aria-hidden="true">
        <div id="bootstrapFill" class="fill"></div>
      </div>
      <div id="bootstrapPercent" class="percent">0%</div>
    </div>
    <div class="footer">
      <span>Classic V2 只做首屏原型，旧版 legacy 仍然保留可随时切回。</span>
      <span>0-${POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT}%</span>
    </div>
  </section>
  <script>
    (function() {
      const targetPercent = ${POSTPROCESS_REPORT_BOOTSTRAP_TARGET_PERCENT};
      const durationMs = ${Math.max(420, POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS + 100)};
      const phases = [
        { percent: 0, label: '正在启动后处理窗口', status: '优先显示窗口壳体，避免切片开始后毫无反馈。' },
        { percent: 5, label: '正在准备实时状态', status: '下一步会切换到实验版首屏，并接入真实进度。' },
        { percent: targetPercent, label: '即将进入处理进度', status: '启动阶段完成，后续百分比会继续累计到 100%。' }
      ];
      const percentElement = document.getElementById('bootstrapPercent');
      const phaseElement = document.getElementById('bootstrapPhase');
      const statusElement = document.getElementById('bootstrapStatus');
      const fillElement = document.getElementById('bootstrapFill');
      let startTime = 0;

      function resolvePhase(percent) {
        let currentPhase = phases[0];
        for (const phase of phases) {
          if (percent >= phase.percent) {
            currentPhase = phase;
          }
        }
        return currentPhase;
      }

      function render(percent) {
        const safePercent = Math.max(0, Math.min(targetPercent, percent));
        const currentPhase = resolvePhase(safePercent);
        percentElement.textContent = Math.round(safePercent) + '%';
        phaseElement.textContent = currentPhase.label;
        statusElement.textContent = currentPhase.status;
        fillElement.style.width = safePercent + '%';
      }

      function tick(timestamp) {
        if (!startTime) {
          startTime = timestamp;
        }

        const elapsed = timestamp - startTime;
        const percent = Math.min(targetPercent, (elapsed / durationMs) * targetPercent);
        render(percent);

        if (percent < targetPercent) {
          window.requestAnimationFrame(tick);
        }
      }

      render(0);
      window.requestAnimationFrame(tick);
    })();
  </script>
</body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(bootstrapHtml)}`;
}

function buildPostprocessReportBootstrapDataUrl(variant = postprocessReportUiVariant) {
  return normalizePostprocessReportUiVariant(variant) === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2
    ? buildPostprocessReportBootstrapDataUrlClassicV2()
    : buildPostprocessReportBootstrapDataUrlLegacy();
}

function normalizePostprocessReportState(state = {}) {
  const normalizedState = {
    ...state,
    ui: {
      minimumProgressDurationMs: POSTPROCESS_REPORT_MINIMUM_PROGRESS_DURATION_MS,
      autoCloseSeconds: state.status === 'failed'
        ? 0
        : POSTPROCESS_REPORT_AUTO_CLOSE_SECONDS,
      ...(state.ui || {})
    }
  };

  if (!normalizedState.progress) {
    normalizedState.progress = {
      percent: normalizedState.status === 'failed' || normalizedState.status === 'completed' ? 100 : 0,
      phase: normalizedState.status || 'running',
      label: normalizedState.status === 'failed' ? '后处理失败' : '后处理进行中',
      detail: '',
      currentStepTitle: '',
      updatedAt: new Date().toISOString()
    };
  }

  return normalizedState;
}

function persistPostprocessReportState(reportPath, state = {}) {
  return writePostprocessReportState(reportPath, normalizePostprocessReportState(state));
}

function getCurrentPostprocessReportState() {
  try {
    const nextState = readPostprocessReportState(postprocessReportStatePath);
    return nextState ? normalizePostprocessReportState(nextState) : null;
  } catch (error) {
    return normalizePostprocessReportState({
      status: 'failed',
      progress: {
        percent: 100,
        phase: 'failed',
        label: '读取后处理报告失败',
        detail: '无法读取当前的后处理报告文件。',
        currentStepTitle: '读取后处理报告失败',
        updatedAt: new Date().toISOString()
      },
      steps: [
        {
          kind: 'error',
          title: '读取后处理报告失败',
          human: '无法读取当前的后处理报告文件。',
          technical: `Read report failed: ${error.message}`
        }
      ],
      ui: {
        autoCloseSeconds: 0
      }
    });
  }
}

function getPostprocessBaseName(report) {
  const sourcePath = report?.outputPath || report?.inputPath || 'mkp_postprocess';
  return path.basename(sourcePath, path.extname(sourcePath));
}

async function exportPostprocessTrace(mode = 'technical') {
  const report = getCurrentPostprocessReportState();
  if (!report) {
    return { success: false, error: '当前没有可导出的后处理报告。' };
  }

  const baseDir = path.dirname(report.outputPath || report.inputPath || app.getPath('documents'));
  const defaultPath = path.join(baseDir, `${getPostprocessBaseName(report)}_trace_${mode === 'human' ? 'human' : 'technical'}.md`);
  const saveResult = await dialog.showSaveDialog({
    title: '导出后处理步骤',
    defaultPath,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] }
    ]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { success: false, canceled: true };
  }

  fs.writeFileSync(saveResult.filePath, buildPostprocessTraceExport(report, mode), 'utf8');
  return { success: true, filePath: saveResult.filePath };
}

async function exportPostprocessGcode() {
  const report = getCurrentPostprocessReportState();
  if (!report?.outputPath || !fs.existsSync(report.outputPath)) {
    return { success: false, error: '当前没有可导出的处理后 G-code 文件。' };
  }

  const saveResult = await dialog.showSaveDialog({
    title: '导出处理后的 G-code',
    defaultPath: report.outputPath,
    filters: [
      { name: 'G-code', extensions: ['gcode'] }
    ]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { success: false, canceled: true };
  }

  fs.copyFileSync(report.outputPath, saveResult.filePath);
  return { success: true, filePath: saveResult.filePath };
}

function registerPostprocessReportHandlers() {
  ipcMain.removeHandler('get-postprocess-report-state');
  ipcMain.handle('get-postprocess-report-state', async () => {
    return getCurrentPostprocessReportState();
  });

  ipcMain.removeHandler('set-postprocess-report-expanded');
  ipcMain.handle('set-postprocess-report-expanded', async (event, expanded) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || postprocessReportWindow;
    if (targetWindow && !targetWindow.isDestroyed()) {
      const windowMetrics = getPostprocessReportWindowMetrics(postprocessReportUiVariant);
      const width = expanded ? windowMetrics.expandedWidth : windowMetrics.collapsedWidth;
      const height = expanded ? windowMetrics.expandedHeight : windowMetrics.collapsedHeight;
      targetWindow.setContentSize(width, height, true);
      targetWindow.center();
    }
    return { success: true };
  });

  ipcMain.removeHandler('close-postprocess-report-window');
  ipcMain.handle('close-postprocess-report-window', async () => {
    if (postprocessReportWindow && !postprocessReportWindow.isDestroyed()) {
      postprocessReportWindow.close();
    } else {
      app.quit();
    }
    return { success: true };
  });

  ipcMain.removeHandler('export-postprocess-trace');
  ipcMain.handle('export-postprocess-trace', async (event, mode = 'technical') => {
    return exportPostprocessTrace(mode);
  });

  ipcMain.removeHandler('export-postprocess-gcode');
  ipcMain.handle('export-postprocess-gcode', async () => {
    return exportPostprocessGcode();
  });
}

function createPostprocessReportWindow() {
  const windowMetrics = getPostprocessReportWindowMetrics(postprocessReportUiVariant);
  const isClassicV2 = postprocessReportUiVariant === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2;
  let hasLoadedLiveReportPage = false;
  postprocessReportWindow = new BrowserWindow({
    width: windowMetrics.collapsedWidth,
    height: windowMetrics.collapsedHeight,
    minWidth: windowMetrics.minWidth,
    minHeight: windowMetrics.minHeight,
    useContentSize: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: windowMetrics.backgroundColor,
    show: false,
    icon: path.join(__dirname, '../renderer/assets/icons/logo-main.ico'),
    title: 'MKP 后处理过程',
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      contextIsolation: true
    }
  });

  const loadLivePostprocessReportPage = () => {
    if (isClassicV2) {
      return;
    }

    if (!postprocessReportWindow || postprocessReportWindow.isDestroyed() || hasLoadedLiveReportPage) {
      return;
    }

    hasLoadedLiveReportPage = true;
    setTimeout(() => {
      if (postprocessReportWindow && !postprocessReportWindow.isDestroyed()) {
        postprocessReportWindow.loadFile(resolvePostprocessReportRendererPath(postprocessReportUiVariant));
      }
    }, POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS);
  };

  const revealPostprocessReportWindow = () => {
    if (!postprocessReportWindow || postprocessReportWindow.isDestroyed()) {
      return;
    }

    if (postprocessReportWindow.isMinimized()) {
      postprocessReportWindow.restore();
    }

    if (!postprocessReportWindow.isVisible()) {
      postprocessReportWindow.show();
    }

    postprocessReportWindow.moveTop();
    postprocessReportWindow.focus();

    if (process.platform === 'win32') {
      postprocessReportWindow.setAlwaysOnTop(true, 'screen-saver');
      setTimeout(() => {
        if (postprocessReportWindow && !postprocessReportWindow.isDestroyed()) {
          postprocessReportWindow.setAlwaysOnTop(false);
        }
      }, 1200);
    }
  };

  postprocessReportWindow.once('ready-to-show', () => {
    revealPostprocessReportWindow();
  });
  postprocessReportWindow.webContents.on('did-finish-load', () => {
    revealPostprocessReportWindow();
    loadLivePostprocessReportPage();
  });

  postprocessReportWindow.on('closed', () => {
    postprocessReportWindow = null;
    app.quit();
  });

  if (isClassicV2) {
    postprocessReportWindow.loadFile(resolvePostprocessReportRendererPath(postprocessReportUiVariant));
    return;
  }

  postprocessReportWindow.loadURL(buildPostprocessReportBootstrapDataUrl(postprocessReportUiVariant));
}

if (isPostprocessReportMode) {
  if (app.dock) app.dock.hide();

  app.whenReady().then(() => {
    postprocessReportStatePath = getArgValue(process.argv, '--Report');
    registerPostprocessReportHandlers();
    createPostprocessReportWindow();
  });

} else if (isCliMode) {
  // ==========================================
  // 🌚 隐性人格：CLI 后台处理模式
  // ==========================================
  if (app.dock) app.dock.hide();

  app.whenReady().then(async () => {
    try {
      console.log("[O503] CLI process");
      const cliArgs = parseCliArguments(process.argv);
      const gcodePath = cliArgs.gcodePath;
      const outputPath = resolvePostprocessOutputPath(gcodePath);
      const runtimeInfo = getMainProcessRuntimeInfo({ mode: 'cli' });
      const removedArtifacts = cleanupLegacyPostprocessArtifacts(gcodePath, {
        preservePaths: [outputPath]
      });
      const reportPath = createPostprocessReportFilePath(gcodePath);

      appendMainProcessLog(
        `[INFO] [CLI] start ${JSON.stringify({
          runtime: runtimeInfo,
          configFormat: cliArgs.configFormat,
          configPath: cliArgs.configPath,
          inputPath: gcodePath,
          outputPath,
          reportPath
        })}`
      );

      if (removedArtifacts.length > 0) {
        appendMainProcessLog(
          `[INFO] [CLI] Removed stale postprocess artifacts: ${JSON.stringify(removedArtifacts)}`
        );
      }

      persistPostprocessReportState(reportPath, createPendingPostprocessReportState({
        configFormat: cliArgs.configFormat,
        configPath: cliArgs.configPath,
        inputPath: gcodePath,
        outputPath,
        runtime: runtimeInfo
      }));
      launchDetachedPostprocessReportViewer(app, reportPath, {
        uiVariant: postprocessReportUiVariant
      });
      await waitForMilliseconds(POSTPROCESS_REPORT_BOOTSTRAP_DELAY_MS);

      const startTime = Date.now();
      const detailedResult = processGcodeDetailed(gcodePath, cliArgs.configPath, {
        configFormat: cliArgs.configFormat,
        outputPath,
        runtimeInfo,
        reportThrottleMs: 90,
        onReportUpdate: (nextState) => {
          persistPostprocessReportState(reportPath, nextState);
        }
      });
      const processedGcode = detailedResult.outputGcode;

      fs.writeFileSync(outputPath, processedGcode);
      appendMainProcessLog(
        `[INFO] [CLI] wrote output=${JSON.stringify({
          outputPath,
          bytes: Buffer.byteLength(processedGcode, 'utf8'),
          reportPath
        })}`
      );
      persistPostprocessReportState(reportPath, {
        ...detailedResult.report,
        outputPath,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        progress: {
          ...(detailedResult.report.progress || {}),
          percent: 100,
          phase: 'completed',
          label: '后处理完成',
          detail: `已生成 ${path.basename(outputPath)}。`,
          currentStepTitle: detailedResult.report.progress?.currentStepTitle
            || detailedResult.report.steps?.[detailedResult.report.steps.length - 1]?.title
            || '后处理完成',
          updatedAt: new Date().toISOString()
        }
      });
      appendMainProcessLog(buildPostprocessStepLogLines(detailedResult.report).join('\n'));
      
      const costTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (Notification.isSupported()) {
        new Notification({
          title: 'MKP SupportE',
          body: `✅ 涂胶路径已注入！(耗时: ${costTime}s)\n文件: ${path.basename(outputPath)}`,
          silent: true
        }).show();
      }
      
      setTimeout(() => app.quit(), 300);
    } catch (error) {
      console.error("[E604] CLI exec err: " + error.message);
      appendMainProcessLog(
        `[ERROR] [CLI] failed message=${JSON.stringify(error.message || String(error))} stack=${JSON.stringify(error.stack || '')}`
      );
      try {
        const cliArgs = parseCliArguments(process.argv);
        const gcodePath = cliArgs.gcodePath;
        const outputPath = resolvePostprocessOutputPath(gcodePath);
        const reportPath = createPostprocessReportFilePath(gcodePath);
        const runtimeInfo = getMainProcessRuntimeInfo({ mode: 'cli' });
        persistPostprocessReportState(reportPath, createFailedPostprocessReportState({
          configFormat: cliArgs.configFormat,
          configPath: cliArgs.configPath,
          inputPath: gcodePath,
          outputPath,
          runtime: runtimeInfo
        }, error));
        launchDetachedPostprocessReportViewer(app, reportPath, {
          uiVariant: postprocessReportUiVariant
        });
      } catch (reportError) {
        console.warn('[CLI] Failed to launch detached postprocess report viewer:', reportPath, reportError.message);
      }
      if (Notification.isSupported()) {
        new Notification({ title: 'MKP 处理失败', body: `❌ ${error.message}` }).show();
      }
      setTimeout(() => app.quit(), 300);
    }
  });

} else if (isReleaseCenterMode) {
  function createReleaseCenterWindow() {
    const releaseWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 1120,
      minHeight: 760,
      autoHideMenuBar: true,
      backgroundColor: '#101317',
      show: false,
      icon: path.join(__dirname, '../renderer/assets/icons/logo-main.ico'),
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true
      }
    });

    releaseWindow.once('ready-to-show', () => {
      releaseWindow.show();
    });

    releaseWindow.loadFile(path.join(__dirname, '../renderer/release_center.html'));
  }

  app.whenReady().then(() => {
    app.commandLine.appendSwitch('no-proxy-server');
    app.commandLine.appendSwitch('disable-features', 'ProxyConfig');
    ipcMain.on('set-native-theme', (event, mode) => {
      nativeTheme.themeSource = mode;
    });

    createReleaseCenterWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createReleaseCenterWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
} else {
  // ==========================================
  // 🌞 显性人格：正常 GUI 界面
  // ==========================================
  
  // ==========================================
  // 获取当前运行的 EXE 绝对路径 (用于拼接脚本)
  // ==========================================
  ipcMain.handle('get-exe-path', () => {
    return app.getPath('exe'); 
  });

  ipcMain.handle('get-cli-launch-info', () => {
    return {
      exePath: app.getPath('exe'),
      appPath: process.defaultApp === true ? safelyGetAppPath() : null,
      defaultApp: process.defaultApp === true
    };
  });

  // 监听前端的系统数据请求
ipcMain.handle('get-userdata-path', () => {
  return path.join(app.getPath('userData'), 'Presets'); 
});

ipcMain.handle('get-god-mode-runtime-state', async () => {
  const isDeveloperMode = isDeveloperLayoutModeAvailable();
  const projectRoot = getProjectRootPath();
  return {
    success: true,
    isDeveloperMode,
    projectRoot,
    directory: isDeveloperMode ? getGodModeLayoutsDirectory(projectRoot) : null,
    formalDefaultsFile: isDeveloperMode ? getGodModeFormalLayoutDefaultsFilePath(projectRoot) : null
  };
});

ipcMain.handle('read-god-mode-layout-state', async () => {
  if (!isDeveloperLayoutModeAvailable()) {
    return {
      success: false,
      isDeveloperMode: false,
      error: 'God Mode layouts are only available in development builds'
    };
  }

  const state = readGodModeLayoutState(getProjectRootPath());
  return {
    success: true,
    isDeveloperMode: true,
    formalDefaultsFile: getGodModeFormalLayoutDefaultsFilePath(getProjectRootPath()),
    ...state
  };
});

ipcMain.handle('save-god-mode-layout-snapshot', async (event, payload = {}) => {
  if (!isDeveloperLayoutModeAvailable()) {
    return {
      success: false,
      isDeveloperMode: false,
      error: 'God Mode layouts are only available in development builds'
    };
  }

  const result = saveGodModeLayoutSnapshot(
    getProjectRootPath(),
    payload.layouts || {},
    { reason: payload.reason || 'manual-save' }
  );

  return {
    success: true,
    isDeveloperMode: true,
    formalDefaultsFile: getGodModeFormalLayoutDefaultsFilePath(getProjectRootPath()),
    ...result
  };
});

ipcMain.handle('restore-god-mode-layout-snapshot', async (event, target = 'previous') => {
  if (!isDeveloperLayoutModeAvailable()) {
    return {
      success: false,
      isDeveloperMode: false,
      error: 'God Mode layouts are only available in development builds'
    };
  }

  const result = restoreGodModeLayoutSnapshot(getProjectRootPath(), target);
  return {
    success: true,
    isDeveloperMode: true,
    formalDefaultsFile: getGodModeFormalLayoutDefaultsFilePath(getProjectRootPath()),
    ...result
  };
});

ipcMain.handle('open-god-mode-layout-folder', async () => {
  if (!isDeveloperLayoutModeAvailable()) {
    return {
      success: false,
      isDeveloperMode: false,
      error: 'God Mode layouts are only available in development builds'
    };
  }

  const targetPath = getGodModeLayoutsDirectory(getProjectRootPath());
  fs.mkdirSync(targetPath, { recursive: true });
  const openError = await shell.openPath(targetPath);
  return {
    success: !openError,
    isDeveloperMode: true,
    directory: targetPath,
    error: openError || null
  };
});

ipcMain.handle('freeze-god-mode-layout-as-formal', async (event, payload = {}) => {
  if (!isDeveloperLayoutModeAvailable()) {
    return {
      success: false,
      isDeveloperMode: false,
      error: 'God Mode layouts are only available in development builds'
    };
  }

  const result = writeGodModeFormalLayoutDefaults(
    getProjectRootPath(),
    payload.layouts || {},
    { source: payload.source || 'god-mode-freeze' }
  );

  return {
    success: true,
    isDeveloperMode: true,
    ...result
  };
});

  function createWindow() {
    const mainWindow = new BrowserWindow({
      width: DEFAULT_APP_WINDOW_WIDTH,
      height: DEFAULT_APP_WINDOW_HEIGHT,      // 加上 30px 补偿
      minWidth: DEFAULT_APP_WINDOW_WIDTH,
      minHeight: DEFAULT_APP_WINDOW_HEIGHT,   // 加上 30px 补偿
      useContentSize: false, // 彻底关掉内容计算，解决 580px 挤压 bug
      autoHideMenuBar: true, // 隐藏菜单栏
      backgroundColor: '#1A1D1F',
      show: false, // 👈 2. 核心：刚创建时先隐藏，不要让用户看到黑屏
      icon: path.join(__dirname, '../renderer/assets/icons/logo-main.ico'),
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true
      }
    });
    // 移除默认菜单
    //mainWindow.removeMenu();
    // 3. 核心：等 HTML 和代码在后台全部加载渲染完毕后，瞬间弹出！
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  app.whenReady().then(() => {

    // 1. 强行关闭代理自动发现，解决挂梯子打开软件卡死 10 秒的 Bug！
    app.commandLine.appendSwitch('no-proxy-server');
    app.commandLine.appendSwitch('disable-features', 'ProxyConfig');
    // 监听前端发来的主题切换消息
    ipcMain.on('set-native-theme', (event, mode) => {
      nativeTheme.themeSource = mode;
    });

    createWindow();
    checkForUpdatesInBackground();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}





// ==========================================
// 获取软件真实版本号 (自动读取 package.json)
// ==========================================
ipcMain.handle('get-app-version', () => {
  const targetAppPath = getAppContentRootPath();
  return readInstalledAppVersion(targetAppPath) || app.getVersion();
});
// ==========================================
// 🔄 基础系统控制 API (重启与外部跳转)
// ==========================================

// 收到前端指令后重启软件 (热更新完成后调用)
ipcMain.handle('restart-app', () => {
  const relaunchArgs = buildGuiRelaunchArgs({
    defaultApp: process.defaultApp === true,
    appPath: safelyGetAppPath(),
    currentArgv: process.argv.slice()
  });

  appendMainProcessLog(
    `[INFO] [MainProcess] restart requested currentArgv=${JSON.stringify(process.argv)} relaunchArgs=${JSON.stringify(relaunchArgs)}`
  );

  app.relaunch({
    execPath: process.execPath,
    args: relaunchArgs
  });
  app.quit();
});

// 使用默认浏览器打开外部网页 (用于全量更新下载安装包)
ipcMain.handle('open-external', (event, targetUrl) => {
  shell.openExternal(targetUrl);
  return { success: true };
});

// ==========================================
// 数据读写与文件操作引擎
// ==========================================

// 1. 读取 JSON 预设
ipcMain.handle('read-preset', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: '文件不存在' };
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: JSON.parse(content) }; // 原生秒解
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ensure-preset-backup', async (event, filePath) => {
  try {
    const backupPath = ensurePresetBackupSync(filePath);
    return { success: true, path: backupPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-preset-backup', async (event, filePath) => {
  try {
    const backupPath = getPresetBackupPath(filePath);
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: '备份不存在' };
    }
    const content = fs.readFileSync(backupPath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 2. 写入 JSON 预设 (极其简单，绝对不会丢数据)
ipcMain.handle('write-preset', async (event, filePath, updates) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: '文件不存在' };
    
    // 先读出现有数据
    const content = fs.readFileSync(filePath, 'utf-8');
    let data = JSON.parse(content);

    // 深度合并更新的数据 (例如把新的 x 偏移塞进去)
    // 假设前端传来的 updates 是 { toolhead: { offset: { x: 0.5 } } }
    data = mergeDeep(data, updates); // (这里可以用一个简单的合并函数)

    // 原生完美写回，带有 2 个空格的美化缩进
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 简单的深度合并函数
function mergeDeep(target, source) {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function getPresetsDirectory() {
  return path.join(app.getPath('userData'), 'Presets');
}

function getPresetBackupDirectory() {
  return path.join(getPresetsDirectory(), '_backup');
}

function getPresetBackupPath(filePath) {
  return path.join(getPresetBackupDirectory(), path.basename(filePath));
}

function ensurePresetBackupSync(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('源文件不存在，无法创建备份');
  }

  const backupDir = getPresetBackupDirectory();
  const backupPath = getPresetBackupPath(filePath);
  if (fs.existsSync(backupPath)) {
    return backupPath;
  }

  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function savePresetBackupSync(filePath, data) {
  const backupDir = getPresetBackupDirectory();
  const backupPath = getPresetBackupPath(filePath);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');
  return backupPath;
}

function extractPresetVersion(fileName, jsonData = null) {
  const contentVersion = findVersionInJsonData(jsonData);
  if (contentVersion) {
    return contentVersion;
  }

  if (jsonData && typeof jsonData === 'object') {
    return '0.0.0';
  }

  const versionMatch = String(fileName || '').match(/_v([a-zA-Z0-9.\-]+)/i);
  return versionMatch ? versionMatch[1] : '0.0.1';
}

function buildPresetDisplayName(fileName, printerId, versionType, jsonData = null) {
  if (jsonData && typeof jsonData._custom_name === 'string' && jsonData._custom_name.trim()) {
    return jsonData._custom_name.trim();
  }

  const baseName = String(fileName || '').replace(/\.json$/i, '');
  const prefix = printerId && versionType ? `${printerId}_${versionType}_` : '';
  return prefix && baseName.startsWith(prefix) ? baseName.slice(prefix.length) : baseName;
}

// ==========================================
// 获取本地预设文件夹中的所有 JSON 文件名
// ==========================================
ipcMain.handle('get-local-presets', () => {
  try {
    const userDataPath = path.join(app.getPath('userData'), 'Presets');
    if (!fs.existsSync(userDataPath)) {
      return []; // 文件夹不存在就返回空数组
    }
    const files = fs.readdirSync(userDataPath);
    // 只返回 .json 结尾的文件
    return files.filter(f => f.toLowerCase().endsWith('.json')); 
  } catch (error) {
    console.error("获取本地文件列表失败:", error);
    return [];
  }
});

ipcMain.handle('overwrite-preset', async (event, filePath, data) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: '文件不存在' };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.removeHandler('apply-hot-update');
ipcMain.handle('apply-hot-update', async (event, payload) => {
  const tempZipPath = path.join(app.getPath('temp'), 'mkp_patch.zip');

  try {
    const urls = Array.isArray(payload?.urls)
      ? payload.urls.filter(Boolean)
      : [payload?.url || payload?.downloadUrl || payload].filter((item) => typeof item === 'string' && item.trim());
    const expectedVersion = normalizeVersionValue(payload?.expectedVersion);

    if (urls.length === 0) {
      throw new Error('未提供可用的补丁下载地址。');
    }

    let appliedUrl = null;
    let archiveInfo = null;
    let lastError = null;

    for (const zipUrl of urls) {
      try {
        const zipBuffer = await downloadPatchBuffer(zipUrl);
        fs.writeFileSync(tempZipPath, zipBuffer);

        archiveInfo = inspectPatchArchive(tempZipPath);
        if (!archiveInfo.packageVersion && archiveInfo.manifestVersion) {
          archiveInfo.packageVersion = archiveInfo.manifestVersion;
        }
        if (expectedVersion) {
          if (!archiveInfo.packageVersion) {
            throw new Error('补丁包缺少 package.json，无法校验目标版本。');
          }
          if (archiveInfo.packageVersion !== expectedVersion) {
            throw new Error(`补丁包版本 ${archiveInfo.packageVersion} 与预期 ${expectedVersion} 不一致。`);
          }
        }

        appliedUrl = zipUrl;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!appliedUrl || !archiveInfo) {
      throw lastError || new Error('所有补丁下载线路都失败了。');
    }

    const targetExtractPath = getResourcesRootPath();

    extractPatch(tempZipPath, targetExtractPath);

    const installedVersion = readAppPackageVersion(getAppContentRootPath());
    if (expectedVersion && installedVersion !== expectedVersion) {
      throw new Error(`补丁已解压，但当前程序版本仍是 ${installedVersion || 'unknown'}，未达到预期版本 ${expectedVersion}。`);
    }

    return {
      success: true,
      appliedUrl,
      version: installedVersion || archiveInfo.packageVersion || expectedVersion || null
    };
  } catch (error) {
    console.error('[HotUpdate] apply failed:', error);
    return { success: false, error: error.message };
  } finally {
    try {
      fs.unlinkSync(tempZipPath);
    } catch (error) {
      console.warn('[HotUpdate] Failed to remove temporary patch archive during cleanup:', tempZipPath, error.message);
    }
  }
});

ipcMain.removeHandler('save-local-manifest');
ipcMain.handle('save-local-manifest', async (event, jsonStr) => {
  try {
    const targetPath = getCachedRemoteManifestPath();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, jsonStr, 'utf-8');
    console.log('[VersionEngine] Cached latest remote app_manifest.json');
    return { success: true };
  } catch (error) {
    console.error('[VersionEngine] Failed to cache remote manifest:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.removeHandler('read-local-manifest');
ipcMain.handle('read-local-manifest', async () => {
  try {
    const cachedManifestPath = getCachedRemoteManifestPath();
    const bundledManifestPath = getBundledAppManifestPath();
    const manifestPath = fs.existsSync(cachedManifestPath)
      ? cachedManifestPath
      : bundledManifestPath;

    if (!fs.existsSync(manifestPath)) {
      console.warn('[VersionEngine] No local app_manifest.json found');
      return null;
    }

    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    console.error('[VersionEngine] Failed to read local manifest:', error);
    return null;
  }
});

ipcMain.handle('list-local-presets-detailed', (event, query = {}) => {
  try {
    const userDataPath = getPresetsDirectory();
    if (!fs.existsSync(userDataPath)) {
      return { success: true, data: [] };
    }

    const printerId = query.printerId || '';
    const versionType = query.versionType || '';
    const prefix = printerId && versionType ? `${printerId}_${versionType}_` : '';
    const malformedPrefixes = printerId
      ? [`${printerId}_null_`, `${printerId}_undefined_`]
      : [];

    const files = fs.readdirSync(userDataPath)
      .filter((file) => file.toLowerCase().endsWith('.json'))
      .filter((file) => file !== 'presets_manifest.json')
      .filter((file) => !prefix || file.startsWith(prefix) || malformedPrefixes.some((badPrefix) => file.startsWith(badPrefix)));

    const data = files.map((fileName) => {
      const absolutePath = path.join(userDataPath, fileName);
      const stats = fs.statSync(absolutePath);

      let jsonData = null;
      try {
        jsonData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
      } catch (error) {
        jsonData = null;
      }

      return {
        fileName,
        realVersion: extractPresetVersion(fileName, jsonData),
        presetType: jsonData && typeof jsonData.type === 'string' ? jsonData.type : null,
        customName: jsonData && typeof jsonData._custom_name === 'string' ? jsonData._custom_name : null,
        displayName: buildPresetDisplayName(fileName, printerId, versionType, jsonData),
        modifiedAt: stats.mtimeMs,
        createdAt: stats.birthtimeMs || stats.ctimeMs,
        size: stats.size
      };
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
});


// ==========================================
// 真实文件探测器
// ==========================================
ipcMain.handle('check-file-exists', (event, fileName) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'Presets', fileName);
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
});

// ==========================================
// 真实下载引擎：从网络拉取文件并保存到本地
// ==========================================
ipcMain.handle('download-file', async (event, fileUrl, fileName) => {
  try {
    const userDataPath = path.join(app.getPath('userData'), 'Presets');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // 目标保存路径
    const targetPath = path.join(userDataPath, fileName);

    // 发起网络请求 (Electron 现在的 Node 版本自带原生 fetch)
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }
    
    // 获取文本内容并写入文件
    const textContent = await response.text();
    fs.writeFileSync(targetPath, textContent, 'utf-8');
    try {
      savePresetBackupSync(targetPath, JSON.parse(textContent));
    } catch (backupError) {
      console.warn('[PresetBackup] 下载后创建备份失败:', backupError.message);
    }

    return { success: true };
  } catch (error) {
    console.error("下载文件失败:", error);
    return { success: false, error: error.message };
  }
});

// ==========================================
// 真实文件删除引擎
// ==========================================
ipcMain.handle('delete-file', (event, fileName) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'Presets', fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: '文件不存在' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-preset-files', (event, fileNames = []) => {
  try {
    const deleted = [];
    const failed = [];
    const userDataPath = getPresetsDirectory();

    fileNames.forEach((fileName) => {
      try {
        const filePath = path.join(userDataPath, fileName);
        if (!fs.existsSync(filePath)) {
          failed.push({ fileName, error: '文件不存在' });
          return;
        }

        fs.unlinkSync(filePath);
        deleted.push(fileName);
      } catch (error) {
        failed.push({ fileName, error: error.message });
      }
    });

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  } catch (error) {
    return {
      success: false,
      deleted: [],
      failed: fileNames.map((fileName) => ({ fileName, error: error.message }))
    };
  }
});

// ==========================================
// 智能模型提取与保护引擎 (防篡改、防占用、支持首次强制选择打开方式)
// ==========================================
ipcMain.handle('open-calibration-model', async (event, modelType, forceOpenWith = false) => {
  try {
    const sourceDir = path.join(__dirname, '../default_models');
    // 【修改点 1】：应用你指定的新模型名称
    const baseFileName = modelType === 'Z' ? 'ZOffset Calibration.3mf' : 'Precise Calibration.3mf';
    const sourcePath = path.join(sourceDir, baseFileName);

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: `找不到底层模型文件：${baseFileName}` };
    }

    const targetDir = path.join(app.getPath('userData'), 'CalibrationModels');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let targetPath = path.join(targetDir, baseFileName);
    let finalFileName = baseFileName;

    // 智能防占用复制
    try {
      fs.copyFileSync(sourcePath, targetPath);
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        const ext = path.extname(baseFileName);
        const name = path.basename(baseFileName, ext);
        finalFileName = `${name}_${Date.now()}${ext}`; 
        targetPath = path.join(targetDir, finalFileName);
        fs.copyFileSync(sourcePath, targetPath);
      } else {
        throw err;
      }
    }

    // 静默清理历史垃圾
    fs.readdir(targetDir, (err, files) => {
      if (!err) {
        files.forEach(file => {
          if (file !== finalFileName && (file.startsWith('ZOffset Calibration') || file.startsWith('Precise Calibration'))) {
            try {
              fs.unlinkSync(path.join(targetDir, file));
            } catch (error) {
              console.warn('[CalibrationCleanup] Failed to remove legacy calibration file:', file, error.message);
            }
          }
        });
      }
    });

    // 【修改点 2】：Windows 专属的“打开方式”强制弹窗！
    if (forceOpenWith && process.platform === 'win32') {
      // 呼叫 Windows 底层 API 强制弹出软件选择框
      exec(`rundll32 shell32.dll,OpenAs_RunDLL "${targetPath}"`);
      return { success: true, path: targetPath };
    } else {
      const openError = await shell.openPath(targetPath);
      if (openError && process.platform === 'win32') {
        exec(`cmd /c start "" "${targetPath}"`);
        exec(`rundll32 shell32.dll,OpenAs_RunDLL "${targetPath}"`);
        return { success: true, path: targetPath, openWithFallback: true };
      }
      if (openError) return { success: false, error: `无法打开模型: ${openError}` };
      return { success: true, path: targetPath };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==========================================
// 🚀 Windows DOS 8.3 短路径转换引擎 (专治各种切片软件乱码/空格 Bug)
// ==========================================
ipcMain.handle('get-short-path', (event, targetPath) => {
  if (process.platform !== 'win32') return targetPath; // Mac 和 Linux 不需要，它们原生支持良好
  try {
    const { execSync } = require('child_process');
    // 调用 cmd 内部的 %~sI 魔法修饰符，获取物理短路径
    const command = `for %I in ("${targetPath}") do @echo %~sI`;
    // 执行并去掉换行符
    const shortPath = execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    
    return shortPath || targetPath;
  } catch (error) {
    console.error("[短路径引擎] 转换失败，降级为原路径:", error);
    return targetPath;
  }
});

// ==========================================
// 🚀 高级文件管理引擎 (重命名显示名 & 资源管理器定位)
// ==========================================
ipcMain.handle('rename-preset-display', (event, payload) => {
  try {
    const { fileName, newName } = payload;
    const destPath = path.join(app.getPath('userData'), 'Presets', fileName);
    if (!fs.existsSync(destPath)) throw new Error("文件不存在");
    
    // 扒开 JSON，注入 _custom_name，完美规避底层中文路径报错！
    const rawData = fs.readFileSync(destPath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    jsonData._custom_name = newName;
    
    fs.writeFileSync(destPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-item-in-folder', (event, fileName) => {
  try {
    const destPath = path.join(app.getPath('userData'), 'Presets', fileName);
    if (fs.existsSync(destPath)) {
      shell.showItemInFolder(destPath);
      return { success: true };
    }
    return { success: false, error: "文件不存在" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
