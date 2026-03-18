import { useEffect, useMemo, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';

type OnlinePresetItem = {
  fileName: string;
  displayTitle: string;
  realVersion: string;
  date: string;
  isLatest: boolean;
};

type OnlinePresetListState = {
  items: OnlinePresetItem[];
  loading: boolean;
};

type ManifestPreset = {
  id?: string;
  type?: string;
  version?: string;
  file?: string;
  lastModified?: string;
};

function compareVersionsDesc(left: string, right: string) {
  if (typeof window.compareVersionsFront === 'function') {
    return window.compareVersionsFront(right, left);
  }
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' });
}

function inferPresetType(preset: ManifestPreset) {
  const directType = String(preset.type || '').trim().toLowerCase();
  if (directType) return directType;

  const fileName = String(preset.file || '').toLowerCase();
  const segments = fileName.replace(/\.json$/i, '').split('_');
  return segments.length >= 2 ? segments[1] : '';
}

export function useOnlinePresetList(): OnlinePresetListState {
  const context = useDownloadContext();
  const [state, setState] = useState<OnlinePresetListState>({ items: [], loading: true });

  useEffect(() => {
    let disposed = false;

    async function run() {
      if (!context.printer?.id || !context.selectedVersionType) {
        setState({ items: [], loading: false });
        return;
      }

      setState((previous) => ({ ...previous, loading: true }));

      const bundledManifest = await window.mkpAPI?.readBundledPresetsManifest?.();
      const localManifest = await window.mkpAPI?.readLocalPresetsManifest?.();
      const manifestData = bundledManifest?.success ? bundledManifest.data : localManifest?.data;
      const requestedPrinterId = String(context.printer.id || '').trim().toLowerCase();
      const requestedType = String(context.selectedVersionType || '').trim().toLowerCase();

      const items = (manifestData?.presets || [])
        .filter((preset) => String(preset.id || '').trim().toLowerCase() === requestedPrinterId)
        .filter((preset) => {
          const inferredType = inferPresetType(preset);
          const normalizedFileName = String(preset.file || '').toLowerCase();
          return inferredType === requestedType || normalizedFileName.includes(`_${requestedType}_`);
        })
        .sort((left, right) => compareVersionsDesc(left.version || '0.0.0', right.version || '0.0.0'))
        .map((preset, index) => ({
          fileName: String(preset.file || ''),
          displayTitle: [String(preset.file || '').replace(/\.json$/i, ''), preset.version ? `v${preset.version}` : '']
            .filter(Boolean)
            .join(' '),
          realVersion: String(preset.version || '0.0.0'),
          date: String(preset.lastModified || '--'),
          isLatest: index === 0
        }))
        .filter((item) => !!item.fileName);

      if (!disposed) {
        setState({ items, loading: false });
      }
    }

    void run();
    return () => {
      disposed = true;
    };
  }, [context.printer?.id, context.selectedVersionType]);

  return useMemo(() => state, [state]);
}
