import { useCallback } from 'react';

import { useDownloadContext } from './useDownloadContext';

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

export function usePresetActions() {
  const context = useDownloadContext();

  const applyLocalPreset = useCallback((fileName: string) => {
    if (!context.printer || !context.selectedVersionType) return;
    if (typeof window.handleApplyLocal === 'function') {
      window.handleApplyLocal(fileName, fileName, context.printer, context.selectedVersionType, null);
    }
  }, [context.printer, context.selectedVersionType]);

  const duplicateLocalPreset = useCallback(async ({ fileName, realVersion }: DuplicatePresetOptions) => {
    if (!context.printer?.id || !window.mkpAPI?.duplicatePreset) return { success: false, error: 'duplicatePreset unavailable' };

    return window.mkpAPI.duplicatePreset({
      fileName,
      printerId: context.printer.id,
      versionType: context.selectedVersionType,
      realVersion
    });
  }, [context.printer?.id, context.selectedVersionType]);

  const renameLocalPreset = useCallback(async ({ fileName, newName }: RenamePresetOptions) => {
    if (!window.mkpAPI?.renamePresetDisplay) return { success: false, error: 'renamePresetDisplay unavailable' };
    return window.mkpAPI.renamePresetDisplay({ fileName, newName });
  }, []);

  const deleteLocalPreset = useCallback(async (fileName: string) => {
    if (!window.mkpAPI?.deleteFile) return { success: false, error: 'deleteFile unavailable' };
    return window.mkpAPI.deleteFile(fileName);
  }, []);

  const downloadOnlinePreset = useCallback(async ({ fileName }: DownloadOnlinePresetOptions) => {
    if (!window.mkpAPI?.copyBundledPreset) return { success: false, error: 'copyBundledPreset unavailable' };
    return window.mkpAPI.copyBundledPreset(fileName);
  }, []);

  const refreshOnlinePresets = useCallback(async () => {
    if (typeof window.checkOnlineUpdates !== 'function') {
      return { success: false, error: 'checkOnlineUpdates unavailable' };
    }

    await window.checkOnlineUpdates();
    return { success: true };
  }, []);

  return {
    applyLocalPreset,
    duplicateLocalPreset,
    renameLocalPreset,
    deleteLocalPreset,
    downloadOnlinePreset,
    refreshOnlinePresets
  };
}
