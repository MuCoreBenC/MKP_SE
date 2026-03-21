import { useEffect, useMemo, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';

export type LocalPresetItem = {
  fileName: string;
  displayTitle: string;
  realVersion: string;
  presetType?: string;
  modifiedAt?: number;
  createdAt?: number;
  size?: number;
  isApplied: boolean;
  isPinned: boolean;
  isLatest: boolean;
};

export type LocalPresetListState = {
  items: LocalPresetItem[];
  loading: boolean;
};

type LocalPresetDetail = {
  fileName: string;
  customName?: string;
  displayName?: string;
  realVersion?: string;
  presetType?: string;
  modifiedAt?: number;
  createdAt?: number;
  size?: number;
};

function getResolvedActiveFileName(printerId: string, versionType: string | null) {
  if (!printerId || !versionType) return null;
  const legacyActiveFileName = window.localStorage.getItem(`mkp_current_script_${printerId}_${versionType}`);
  return typeof window.resolveActivePresetFileName === 'function'
    ? window.resolveActivePresetFileName(window, legacyActiveFileName)
    : legacyActiveFileName;
}

function compareVersionsDesc(left: string, right: string) {
  if (typeof window.compareVersionsFront === 'function') {
    return window.compareVersionsFront(right, left);
  }
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' });
}

function getPinnedPresetKey(printerId: string, versionType: string) {
  return `mkp_pinned_presets_${printerId}_${versionType}`;
}

function getPinnedPresetSet(printerId: string, versionType: string) {
  try {
    const raw = window.localStorage.getItem(getPinnedPresetKey(printerId, versionType));
    return new Set<string>(JSON.parse(raw || '[]'));
  } catch (error) {
    return new Set<string>();
  }
}

export function useLocalPresetList(): LocalPresetListState {
  const context = useDownloadContext();
  const localSearchQuery = useDownloadPageUiStore((state) => state.localSearchQuery.trim().toLowerCase());
  const localSortMode = useDownloadPageUiStore((state) => state.localSortMode);
  const dataRevision = useDownloadPageUiStore((state) => state.dataRevision);
  const [state, setState] = useState<LocalPresetListState>({ items: [], loading: true });

  useEffect(() => {
    let disposed = false;

    async function run() {
      if (!context.printer?.id || !context.selectedVersionType || !window.mkpAPI?.listLocalPresetsDetailed) {
        setState({ items: [], loading: false });
        return;
      }

      setState((previous) => ({ ...previous, loading: true }));

      const result = await window.mkpAPI.listLocalPresetsDetailed();
      const printerId = context.printer.id;
      const versionType = context.selectedVersionType;
      const prefix = `${printerId}_${versionType}_`.toLowerCase();
      const malformedPrefixes = [`${printerId}_null_`, `${printerId}_undefined_`];
      const activeFileName = getResolvedActiveFileName(printerId, versionType);
      const pinnedFiles = getPinnedPresetSet(printerId, versionType);

      let items = (result?.success ? result.data ?? [] : [])
        .filter((item: LocalPresetDetail) => {
          const normalizedFileName = String(item.fileName || '').toLowerCase();
          if (normalizedFileName.startsWith(prefix)) {
            return true;
          }

          const normalizedPresetType = String(item.presetType || '').trim().toLowerCase();
          return normalizedPresetType === String(versionType || '').trim().toLowerCase()
            && malformedPrefixes.some((badPrefix) => normalizedFileName.startsWith(badPrefix));
        })
        .map((item: LocalPresetDetail) => ({
          fileName: item.fileName,
          displayTitle: item.customName || item.displayName || item.fileName.replace(/\.json$/i, ''),
          realVersion: item.realVersion || '0.0.0',
          presetType: item.presetType,
          modifiedAt: item.modifiedAt,
          createdAt: item.createdAt,
          size: item.size,
          isApplied: item.fileName === activeFileName,
          isPinned: pinnedFiles.has(item.fileName),
          isLatest: false
        }));

      if (localSearchQuery) {
        items = items.filter((item) => {
          return item.displayTitle.toLowerCase().includes(localSearchQuery)
            || item.fileName.toLowerCase().includes(localSearchQuery)
            || item.realVersion.toLowerCase().includes(localSearchQuery);
        });
      }

      const latestFileName = [...items].sort((left, right) => {
        const versionCompare = compareVersionsDesc(left.realVersion, right.realVersion);
        if (versionCompare !== 0) {
          return versionCompare;
        }

        return (right.modifiedAt || 0) - (left.modifiedAt || 0);
      })[0]?.fileName || null;

      items.sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return left.isPinned ? -1 : 1;
        }

        if (localSortMode === 'updated-desc') {
          return (right.modifiedAt || 0) - (left.modifiedAt || 0);
        }

        if (localSortMode === 'name-asc') {
          return left.displayTitle.localeCompare(right.displayTitle, 'zh-CN', {
            numeric: true,
            sensitivity: 'base'
          });
        }

        return compareVersionsDesc(left.realVersion, right.realVersion);
      });

      items = items.map((item) => ({
        ...item,
        isLatest: item.fileName === latestFileName
      }));

      if (!disposed) {
        setState({ items, loading: false });
      }
    }

    void run();
    return () => {
      disposed = true;
    };
  }, [context.printer?.id, context.selectedVersionType, dataRevision, localSearchQuery, localSortMode]);

  return useMemo(() => state, [state]);
}
