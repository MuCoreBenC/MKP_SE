import { useCallback, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';
import type { VersionType } from '../../app/core/preset';

export function useVersionSelection() {
  const context = useDownloadContext();
  const resetTransientState = useDownloadPageUiStore((state) => state.resetTransientState);
  const [pending, setPending] = useState<VersionType | null>(null);

  const selectVersion = useCallback((versionType: VersionType | null) => {
    if (versionType && !context.printer?.id) {
      return;
    }

    setPending(versionType);
    resetTransientState();

    if (typeof window !== 'undefined') {
      if (typeof window.selectedVersion !== 'undefined') {
        window.selectedVersion = versionType;
      }
      if (versionType && typeof window.__syncLegacyContextToModern__ === 'function' && context.printer?.id) {
        window.__syncLegacyContextToModern__({
          printerId: context.printer.id,
          versionType
        });
      }
      if (typeof window.updateSidebarVersionBadge === 'function') {
        window.updateSidebarVersionBadge(versionType);
      }
      if (typeof window.saveUserConfig === 'function') {
        window.saveUserConfig();
      }
      window.dispatchEvent(new CustomEvent('mkp:download-context-updated'));
    }

    setPending(null);
  }, [context.printer, resetTransientState]);

  return {
    pendingVersion: pending,
    selectVersion
  };
}
