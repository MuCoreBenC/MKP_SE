import { CLOUD_BASES, compareVersions } from './versioning.js';

export function formatPresetDate(timestamp) {
  if (!timestamp) return '--';

  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '--';
  }
}

export function formatPresetSize(size) {
  if (!Number.isFinite(size) || size <= 0) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function getCustomOrderKey(printerId, versionType) {
  return `mkp_custom_order_${printerId}_${versionType}`;
}

export function getLocalSortKey(printerId, versionType) {
  return `mkp_local_sort_${printerId}_${versionType}`;
}

export function getPinnedPresetKey(printerId, versionType) {
  return `mkp_pinned_presets_${printerId}_${versionType}`;
}

export function getCurrentScriptStorageKey(printerId, versionType) {
  return `mkp_current_script_${printerId}_${versionType}`;
}

export function readStoredArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (error) {
    return [];
  }
}

export function readStoredSet(key) {
  return new Set(readStoredArray(key));
}

export function writeStoredSet(key, values) {
  localStorage.setItem(key, JSON.stringify(Array.from(values)));
}

export function collectLocalPresetMatchers(printerData, versionType, manifestPresets = []) {
  const acceptedPrefixes = new Set();
  const acceptedFileNames = new Set();
  const normalizedVersionType = String(versionType || '').trim().toLowerCase();

  const registerFileName = (fileName) => {
    const normalizedFileName = String(fileName || '').trim().toLowerCase();
    if (!normalizedFileName) return;

    acceptedFileNames.add(normalizedFileName);

    const marker = `_${normalizedVersionType}_`;
    const markerIndex = normalizedFileName.indexOf(marker);
    if (markerIndex >= 0) {
      acceptedPrefixes.add(normalizedFileName.slice(0, markerIndex + marker.length));
    }
  };

  acceptedPrefixes.add(
    `${String(printerData?.id || '').trim().toLowerCase()}_${normalizedVersionType}_`,
  );

  const defaultPresetFile = printerData?.defaultPresets?.[versionType];
  if (defaultPresetFile) {
    registerFileName(defaultPresetFile);
  }

  manifestPresets.forEach((preset) => {
    registerFileName(preset?.file);
  });

  return {
    acceptedPrefixes,
    acceptedFileNames,
  };
}

export function matchesLocalPresetForPrinter(fileName, matcher) {
  const normalizedFileName = String(fileName || '').trim().toLowerCase();
  if (!normalizedFileName || !matcher) {
    return false;
  }

  if (matcher.acceptedFileNames.has(normalizedFileName)) {
    return true;
  }

  return Array.from(matcher.acceptedPrefixes).some((prefix) =>
    normalizedFileName.startsWith(prefix),
  );
}

export function inferManifestPresetType(preset) {
  const directType = String(preset?.type || '').trim().toLowerCase();
  if (directType) return directType;

  const fileName = String(preset?.file || '').toLowerCase();
  const segments = fileName.replace(/\.json$/i, '').split('_');
  return segments.length >= 2 ? segments[1] : '';
}

export function mapManifestToMatchedPresets(manifestData, printerId, versionType) {
  const normalizedPrinterId = String(printerId || '').trim().toLowerCase();
  const normalizedRequestedType = String(versionType || '').trim().toLowerCase();

  return (manifestData?.presets || [])
    .filter((preset) => String(preset?.id || '').trim().toLowerCase() === normalizedPrinterId)
    .map((preset) => {
      const inferredType = inferManifestPresetType(preset);
      const fileName = String(preset?.file || '');
      const normalizedFileName = fileName.toLowerCase();
      const matchesRequestedType = normalizedRequestedType
        ? inferredType === normalizedRequestedType ||
          normalizedFileName.includes(`_${normalizedRequestedType}_`)
        : true;

      return {
        ...preset,
        type: inferredType || preset?.type || '',
        _matchesRequestedType: matchesRequestedType,
      };
    })
    .filter((preset) => preset._matchesRequestedType)
    .sort((left, right) => compareVersions(right.version, left.version));
}

export function mapManifestPresetsToOnlineList(presets, fallbackVersion = '0.0.0') {
  const today = new Date().toISOString().split('T')[0];

  return presets.map((preset, index) => ({
    id: `v${preset.version || fallbackVersion}`,
    version: preset.version || fallbackVersion,
    realVersion: preset.version || fallbackVersion,
    date: preset.lastModified || today,
    isLatest: index === 0,
    fileName: preset.file,
    displayTitle: [
      preset.file ? preset.file.replace(/\.json$/i, '') : '',
      preset.version ? `v${preset.version}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    changes: Array.isArray(preset.releaseNotes)
      ? preset.releaseNotes
      : preset.releaseNotes
        ? [preset.releaseNotes]
        : preset.description
          ? [preset.description]
          : ['常规体验优化与参数更新'],
  }));
}

export function buildPresetDownloadUrls(fileName) {
  return [
    `${CLOUD_BASES.gitee}/cloud_data/presets/${fileName}`,
    `${CLOUD_BASES.jsDelivr}/cloud_data/presets/${fileName}`,
    `${CLOUD_BASES.github}/cloud_data/presets/${fileName}`,
  ];
}

export function sortLocalPresets(
  localPresets,
  {
    pinnedSet = new Set(),
    sortMode = 'custom',
    customOrder = [],
  } = {},
) {
  return [...localPresets]
    .map((item) => ({
      ...item,
      isPinned: pinnedSet.has(item.fileName),
    }))
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      if (sortMode === 'custom') {
        const leftIndex = customOrder.indexOf(left.fileName);
        const rightIndex = customOrder.indexOf(right.fileName);
        if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
        if (leftIndex !== -1) return -1;
        if (rightIndex !== -1) return 1;
      }

      if (sortMode === 'name-asc') {
        return left.displayTitle.localeCompare(right.displayTitle, 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        });
      }

      if (sortMode === 'updated-desc') {
        return (right.modifiedAt || 0) - (left.modifiedAt || 0);
      }

      const versionCompare = compareVersions(right.realVersion, left.realVersion);
      if (versionCompare !== 0) return versionCompare;
      return (right.modifiedAt || 0) - (left.modifiedAt || 0);
    });
}

export function mapLocalPresetRecords(list, printerData, versionType, manifestPresets = []) {
  const matcher = collectLocalPresetMatchers(printerData, versionType, manifestPresets);
  const releaseNotesMap = Object.fromEntries(
    manifestPresets
      .filter((preset) => preset?.file)
      .map((preset) => [
        String(preset.file).toLowerCase(),
        Array.isArray(preset.releaseNotes)
          ? preset.releaseNotes
          : preset.releaseNotes
            ? [preset.releaseNotes]
            : preset.description
              ? [preset.description]
              : ['General improvements and parameter updates'],
      ]),
  );

  return list
    .filter((item) => matchesLocalPresetForPrinter(item.fileName, matcher))
    .map((item) => {
      const displayTitle =
        item.customName || item.displayName || item.fileName.replace(/\.json$/i, '');
      const originalBaseName =
        `${printerData.id}_${versionType}_v${item.realVersion}.json`.toLowerCase();

      return {
        id: item.fileName,
        fileName: item.fileName,
        displayTitle,
        realVersion: item.realVersion,
        modifiedAt: item.modifiedAt,
        createdAt: item.createdAt,
        size: item.size,
        changes:
          releaseNotesMap[item.fileName.toLowerCase()] ||
          releaseNotesMap[originalBaseName] ||
          [`本地自定义配置(预设版本 v${item.realVersion})`],
      };
    });
}
