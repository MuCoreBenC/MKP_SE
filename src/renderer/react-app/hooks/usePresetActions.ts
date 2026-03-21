import { useCallback } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';

type DuplicatePresetOptions = {
  fileName: string;
  realVersion?: string;
};

type RenamePresetOptions = {
  fileName: string;
  newName: string;
};

type DownloadOnlinePresetOptions = {
  fileName: string;
};

const CLOUD_BASES = {
  gitee: 'https://gitee.com/MuCoreBenC/MKP_Support_Electron/raw/main',
  jsDelivr: 'https://cdn.jsdelivr.net/gh/MuCoreBenC/MKP_Support_Electron@main',
  github: 'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main'
};

function buildPresetDownloadUrls(fileName: string) {
  return [
    `${CLOUD_BASES.gitee}/cloud_data/presets/${fileName}`,
    `${CLOUD_BASES.jsDelivr}/cloud_data/presets/${fileName}`,
    `${CLOUD_BASES.github}/cloud_data/presets/${fileName}`
  ];
}

function getPinnedPresetKey(printerId: string, versionType: string) {
  return `mkp_pinned_presets_${printerId}_${versionType}`;
}

export function usePresetActions() {
  const context = useDownloadContext();
  const bumpDataRevision = useDownloadPageUiStore((state) => state.bumpDataRevision);
  const setNewlyDownloadedFile = useDownloadPageUiStore((state) => state.setNewlyDownloadedFile);

  const applyLocalPreset = useCallback((fileName: string) => {
    if (!context.printer?.id || !context.selectedVersionType) {
      return { success: false, error: 'missing preset context' };
    }

    const storageKey = `mkp_current_script_${context.printer.id}_${context.selectedVersionType}`;
    window.localStorage.setItem(storageKey, fileName);
    window.saveUserConfig?.();
    window.updatePresetCacheSnapshot?.(null, null);
    window.emitActivePresetUpdated?.({
      reason: 'react-apply-local-preset',
      path: null,
      forceRefresh: true
    });
    window.broadcastPresetMutation?.({
      path: null,
      reason: 'react-apply-local-preset'
    });
    bumpDataRevision();
    return { success: true };
  }, [bumpDataRevision, context.printer?.id, context.selectedVersionType]);

  const duplicateLocalPreset = useCallback(async ({ fileName, realVersion }: DuplicatePresetOptions) => {
    if (!context.printer?.id || !window.mkpAPI?.duplicatePreset) {
      return { success: false, error: 'duplicatePreset unavailable' };
    }

    const result = await window.mkpAPI.duplicatePreset({
      fileName,
      printerId: context.printer.id,
      versionType: context.selectedVersionType,
      realVersion
    });

    if (result.success) {
      setNewlyDownloadedFile(result.newFileName || fileName);
      bumpDataRevision();
    }

    return result;
  }, [bumpDataRevision, context.printer?.id, context.selectedVersionType, setNewlyDownloadedFile]);

  const renameLocalPreset = useCallback(async ({ fileName, newName }: RenamePresetOptions) => {
    if (!window.mkpAPI?.renamePresetDisplay) {
      return { success: false, error: 'renamePresetDisplay unavailable' };
    }

    const result = await window.mkpAPI.renamePresetDisplay({ fileName, newName });
    if (result.success) {
      bumpDataRevision();
    }
    return result;
  }, [bumpDataRevision]);

  const deleteLocalPreset = useCallback(async (fileName: string) => {
    if (!window.mkpAPI?.deleteFile) {
      return { success: false, error: 'deleteFile unavailable' };
    }

    const result = await window.mkpAPI.deleteFile(fileName);
    if (result.success) {
      bumpDataRevision();
    }
    return result;
  }, [bumpDataRevision]);

  const downloadOnlinePreset = useCallback(async ({ fileName }: DownloadOnlinePresetOptions) => {
    if (!window.mkpAPI?.downloadFile && !window.mkpAPI?.copyBundledPreset) {
      return { success: false, error: 'download APIs unavailable' };
    }

    let result: { success: boolean; error?: string } = { success: false, error: 'all download nodes failed' };

    if (window.mkpAPI?.downloadFile) {
      for (const url of buildPresetDownloadUrls(fileName)) {
        try {
          result = await window.mkpAPI.downloadFile(url, fileName);
          if (result.success) {
            break;
          }
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'download failed'
          };
        }
      }
    }

    if (!result.success && window.mkpAPI?.copyBundledPreset) {
      result = await window.mkpAPI.copyBundledPreset(fileName);
    }

    if (result.success) {
      setNewlyDownloadedFile(fileName);
      bumpDataRevision();
    }

    return result;
  }, [bumpDataRevision, setNewlyDownloadedFile]);

  const togglePinnedPreset = useCallback((fileName: string) => {
    if (!context.printer?.id || !context.selectedVersionType) {
      return false;
    }

    const storageKey = getPinnedPresetKey(context.printer.id, context.selectedVersionType);
    let pinnedFiles: string[] = [];
    try {
      pinnedFiles = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    } catch (error) {
      pinnedFiles = [];
    }

    const nextSet = new Set(pinnedFiles);
    if (nextSet.has(fileName)) {
      nextSet.delete(fileName);
    } else {
      nextSet.add(fileName);
    }

    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(nextSet)));
    bumpDataRevision();
    return true;
  }, [bumpDataRevision, context.printer?.id, context.selectedVersionType]);

  const refreshOnlinePresets = useCallback(async () => {
    bumpDataRevision();
    return { success: true };
  }, [bumpDataRevision]);

  return {
    applyLocalPreset,
    duplicateLocalPreset,
    renameLocalPreset,
    deleteLocalPreset,
    downloadOnlinePreset,
    togglePinnedPreset,
    refreshOnlinePresets
  };
}
