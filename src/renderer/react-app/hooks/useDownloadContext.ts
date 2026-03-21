import { useSyncExternalStore } from 'react';

import type { VersionType } from '../../app/core/preset';

export type DownloadContextView = {
  printer: {
    id: string;
    brandId?: string;
    shortName?: string;
    name?: string;
    supportedVersions?: string[];
    defaultPresets?: Partial<Record<VersionType, string>>;
  } | null;
  selectedVersionType: VersionType | null;
};

const DOWNLOAD_CONTEXT_UPDATED_EVENT = 'mkp:download-context-updated';

const FALLBACK_VIEW: DownloadContextView = {
  printer: null,
  selectedVersionType: null
};

function resolvePrinterFromLegacyState(selectedPrinterId: string | null) {
  if (!selectedPrinterId || typeof window === 'undefined' || !window.printersByBrand) {
    return null;
  }

  for (const [brandId, printers] of Object.entries(window.printersByBrand)) {
    const printer = (printers || []).find((item) => item.id === selectedPrinterId);
    if (printer) {
      return {
        ...printer,
        brandId
      };
    }
  }

  return null;
}

function getSnapshot(): DownloadContextView {
  if (typeof window === 'undefined') {
    return FALLBACK_VIEW;
  }

  const runtimeView = typeof window.__getDownloadContextView__ === 'function'
    ? window.__getDownloadContextView__()
    : null;
  const hasLegacyPrinterSelection = Object.prototype.hasOwnProperty.call(window, 'selectedPrinter');
  const hasLegacyVersionSelection = Object.prototype.hasOwnProperty.call(window, 'selectedVersion');
  const selectedPrinterId = hasLegacyPrinterSelection
    ? window.selectedPrinter ?? null
    : runtimeView?.printer?.id ?? null;
  const selectedVersionType = hasLegacyVersionSelection
    ? window.selectedVersion ?? null
    : runtimeView?.selectedVersionType ?? null;
  const legacyPrinter = resolvePrinterFromLegacyState(selectedPrinterId);

  return {
    printer: legacyPrinter ?? runtimeView?.printer ?? null,
    selectedVersionType
  };
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener(DOWNLOAD_CONTEXT_UPDATED_EVENT, handler);
  return () => window.removeEventListener(DOWNLOAD_CONTEXT_UPDATED_EVENT, handler);
}

export function useDownloadContext(): DownloadContextView {
  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK_VIEW);
}
