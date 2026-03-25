export const CLOUD_BASES = {
  gitee: 'https://gitee.com/MuCoreBenC/MKP_Support_Electron/raw/main',
  jsDelivr: 'https://cdn.jsdelivr.net/gh/MuCoreBenC/MKP_Support_Electron@main',
  github: 'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main',
};

export const APP_UPDATE_STATE_KEY = 'mkp_app_update_state';

export function compareVersions(leftVersion, rightVersion) {
  try {
    const tokenize = (value) =>
      String(value || '0.0.0')
        .replace(/^v/i, '')
        .toLowerCase()
        .split(/[.\-_]/)
        .flatMap((part) => part.match(/[a-z]+|\d+/g) || ['0']);

    const isNumeric = (token) => /^\d+$/.test(token);
    const isZeroLike = (token) =>
      token === undefined || token === null || token === '' || token === '0';

    const leftTokens = tokenize(leftVersion);
    const rightTokens = tokenize(rightVersion);
    const length = Math.max(leftTokens.length, rightTokens.length);

    for (let index = 0; index < length; index += 1) {
      const left = leftTokens[index];
      const right = rightTokens[index];

      if (left === right) continue;
      if (left === undefined) return isZeroLike(right) ? 0 : -1;
      if (right === undefined) return isZeroLike(left) ? 0 : 1;

      if (isNumeric(left) && isNumeric(right)) {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        if (leftNumber > rightNumber) return 1;
        if (leftNumber < rightNumber) return -1;
        continue;
      }

      if (isNumeric(left) && !isNumeric(right)) return 1;
      if (!isNumeric(left) && isNumeric(right)) return -1;

      const textCompare = left.localeCompare(right, 'zh-CN', {
        numeric: true,
        sensitivity: 'base',
      });
      if (textCompare !== 0) return textCompare;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

export function normalizeAppVersion(version) {
  return String(version || '0.0.0').replace(/^v/i, '').trim() || '0.0.0';
}

export function parseManifestToVersionEntries(manifest, currentAppVersion) {
  const cleanCurrent = normalizeAppVersion(currentAppVersion);
  const entries = [];

  if (!manifest || typeof manifest !== 'object' || !manifest.latestVersion) {
    return entries;
  }

  entries.push({
    version: normalizeAppVersion(manifest.latestVersion),
    date: manifest.releaseDate || '',
    desc: manifest.shortDesc || '常规体验优化与错误修复',
    status: normalizeAppVersion(manifest.latestVersion) === cleanCurrent ? 'RUNNING' : 'LATEST',
    current: normalizeAppVersion(manifest.latestVersion) === cleanCurrent,
    canRollback: manifest.canRollback !== false,
    details: Array.isArray(manifest.releaseNotes) ? manifest.releaseNotes : [],
    downloadUrl: manifest.downloadUrl || '',
  });

  if (Array.isArray(manifest.history)) {
    manifest.history.forEach((item) => {
      if (!item?.version) return;

      const normalizedVersion = normalizeAppVersion(item.version);
      entries.push({
        version: normalizedVersion,
        date: item.releaseDate || '',
        desc: item.shortDesc || '历史版本更新',
        status: normalizedVersion === cleanCurrent ? 'RUNNING' : 'LEGACY',
        current: normalizedVersion === cleanCurrent,
        canRollback: item.canRollback !== false,
        details: Array.isArray(item.releaseNotes) ? item.releaseNotes : [],
        downloadUrl: item.downloadUrl || '',
      });
    });
  }

  return entries;
}

export function getAppManifestUrls(now = Date.now()) {
  return [
    `${CLOUD_BASES.gitee}/cloud_data/app_manifest.json?t=${now}`,
    `${CLOUD_BASES.jsDelivr}/cloud_data/app_manifest.json?t=${now}`,
    `${CLOUD_BASES.github}/cloud_data/app_manifest.json?t=${now}`,
  ];
}

export function buildPatchUrlCandidates(downloadUrl) {
  const urls = [];
  const append = (url) => {
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  };

  append(downloadUrl);

  try {
    const fileName = new URL(downloadUrl).pathname.split('/').pop();
    append(`${CLOUD_BASES.gitee}/cloud_data/${fileName}`);
    append(`${CLOUD_BASES.jsDelivr}/cloud_data/${fileName}`);
    append(`${CLOUD_BASES.github}/cloud_data/${fileName}`);
  } catch (error) {
    return urls;
  }

  return urls;
}

export function createStoredAppUpdateState(payload = {}) {
  return {
    latestVersion: normalizeAppVersion(payload.latestVersion),
    hasUpdate: !!payload.hasUpdate,
    checkedAt: Number(payload.checkedAt) || Date.now(),
  };
}

export function computeAppUpdateState(manifest, currentAppVersion) {
  if (!manifest?.latestVersion) {
    return createStoredAppUpdateState({ latestVersion: currentAppVersion, hasUpdate: false });
  }

  const latestVersion = normalizeAppVersion(manifest.latestVersion);
  const currentVersion = normalizeAppVersion(currentAppVersion);

  return createStoredAppUpdateState({
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
  });
}
