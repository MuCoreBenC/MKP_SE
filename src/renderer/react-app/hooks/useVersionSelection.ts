import { useCallback, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';
import type { VersionType } from '../../app/core/preset';

export function useVersionSelection() {
  const context = useDownloadContext();
  const resetTransientState = useDownloadPageUiStore((state) => state.resetTransientState);
  const [pending, setPending] = useState<VersionType | null>(null);

  const selectVersion = useCallback((versionType: VersionType | null) => {
    setPending(versionType);
    resetTransientState();

    if (typeof window !== 'undefined') {
      if (typeof window.selectedVersion !== 'undefined') {
        window.selectedVersion = versionType;
      }
      if (typeof window.saveUserConfig === 'function') {
        window.saveUserConfig();
      }
      if (typeof window.updateSidebarVersionBadge === 'function') {
        window.updateSidebarVersionBadge(versionType);
      }
      if (typeof window.renderDownloadVersions === 'function') {
        window.renderDownloadVersions(context.printer);
      }
    }

    setPending(null);
  }, [context.printer, resetTransientState]);

  return {
    pendingVersion: pending,
    selectVersion
  };
}
