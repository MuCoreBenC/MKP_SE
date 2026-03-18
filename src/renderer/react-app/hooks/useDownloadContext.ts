import { useMemo } from 'react';

import type { VersionType } from '../../app/core/preset';

export type DownloadContextView = {
  printer: {
    id: string;
    shortName?: string;
    name?: string;
    supportedVersions?: string[];
  } | null;
  selectedVersionType: VersionType | null;
};

export function useDownloadContext(): DownloadContextView {
  return useMemo(() => {
    const fallback = {
      printer: null,
      selectedVersionType: null
    } satisfies DownloadContextView;

    if (typeof window === 'undefined' || typeof window.__getDownloadContextView__ !== 'function') {
      return fallback;
    }

    const view = window.__getDownloadContextView__();
    return {
      printer: view?.printer ?? null,
      selectedVersionType: view?.selectedVersionType ?? null
    };
  }, []);
}
