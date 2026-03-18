import { useEffect, useMemo, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';

type LocalPresetItem = {
  fileName: string;
  displayTitle: string;
  realVersion: string;
  modifiedAt?: number;
  size?: number;
  isApplied: boolean;
};

type LocalPresetListState = {
  items: LocalPresetItem[];
  loading: boolean;
};

type LocalPresetDetail = {
  fileName: string;
  customName?: string;
  displayName?: string;
  realVersion?: string;
  modifiedAt?: number;
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

export function useLocalPresetList(): LocalPresetListState {
  const context = useDownloadContext();
  const localSearchQuery = useDownloadPageUiStore((state) => state.localSearchQuery.trim().toLowerCase());
  const localSortMode = useDownloadPageUiStore((state) => state.localSortMode);
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
      const activeFileName = getResolvedActiveFileName(printerId, versionType);

      let items = (result?.success ? result.data ?? [] : [])
        .filter((item: LocalPresetDetail) => String(item.fileName || '').toLowerCase().startsWith(prefix))
        .map((item: LocalPresetDetail) => ({
          fileName: item.fileName,
          displayTitle: item.customName || item.displayName || item.fileName.replace(/\.json$/i, ''),
          realVersion: item.realVersion || '0.0.0',
          modifiedAt: item.modifiedAt,
          size: item.size,
          isApplied: item.fileName === activeFileName
        }));

      if (localSearchQuery) {
        items = items.filter((item) => {
          return item.displayTitle.toLowerCase().includes(localSearchQuery)
            || item.fileName.toLowerCase().includes(localSearchQuery)
            || item.realVersion.toLowerCase().includes(localSearchQuery);
        });
      }

      items.sort((left, right) => {
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

      if (!disposed) {
        setState({ items, loading: false });
      }
    }

    void run();
    return () => {
      disposed = true;
    };
  }, [context.printer?.id, context.selectedVersionType, localSearchQuery, localSortMode]);

  return useMemo(() => state, [state]);
}
