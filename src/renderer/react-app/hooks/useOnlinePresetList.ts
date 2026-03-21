import { useEffect, useMemo, useState } from 'react';

import { useDownloadContext } from './useDownloadContext';
import { useDownloadPageUiStore } from '../stores/useDownloadPageUiStore';

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

const CLOUD_BASES = {
  gitee: 'https://gitee.com/MuCoreBenC/MKP_Support_Electron/raw/main',
  jsDelivr: 'https://cdn.jsdelivr.net/gh/MuCoreBenC/MKP_Support_Electron@main',
  github: 'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main'
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

async function readRemoteManifest() {
  const manifestUrls = [
    `${CLOUD_BASES.gitee}/cloud_data/presets/presets_manifest.json?t=${Date.now()}`,
    `${CLOUD_BASES.jsDelivr}/cloud_data/presets/presets_manifest.json?t=${Date.now()}`,
    `${CLOUD_BASES.github}/cloud_data/presets/presets_manifest.json?t=${Date.now()}`
  ];

  for (const url of manifestUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const manifest = await response.json();
      if (manifest && Array.isArray(manifest.presets)) {
        return manifest;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

export function useOnlinePresetList(): OnlinePresetListState {
  const context = useDownloadContext();
  const dataRevision = useDownloadPageUiStore((state) => state.dataRevision);
  const [state, setState] = useState<OnlinePresetListState>({ items: [], loading: true });

  useEffect(() => {
    let disposed = false;

    async function run() {
      if (!context.printer?.id || !context.selectedVersionType) {
        setState({ items: [], loading: false });
        return;
      }

      setState((previous) => ({ ...previous, loading: true }));

      const remoteManifest = await readRemoteManifest();
      const bundledManifest = await window.mkpAPI?.readBundledPresetsManifest?.();
      const localManifest = await window.mkpAPI?.readLocalPresetsManifest?.();
      const manifestData = remoteManifest || bundledManifest?.data || localManifest?.data;
      const requestedPrinterId = String(context.printer.id || '').trim().toLowerCase();
      const requestedType = String(context.selectedVersionType || '').trim().toLowerCase();

      const items = (manifestData?.presets || [])
        .filter((preset: ManifestPreset) => String(preset.id || '').trim().toLowerCase() === requestedPrinterId)
        .filter((preset: ManifestPreset) => {
          const inferredType = inferPresetType(preset);
          const normalizedFileName = String(preset.file || '').toLowerCase();
          return inferredType === requestedType || normalizedFileName.includes(`_${requestedType}_`);
        })
        .sort((left: ManifestPreset, right: ManifestPreset) => compareVersionsDesc(left.version || '0.0.0', right.version || '0.0.0'))
        .map((preset: ManifestPreset, index: number) => ({
          fileName: String(preset.file || ''),
          displayTitle: [String(preset.file || '').replace(/\.json$/i, ''), preset.version ? `v${preset.version}` : '']
            .filter(Boolean)
            .join(' '),
          realVersion: String(preset.version || '0.0.0'),
          date: String(preset.lastModified || '--'),
          isLatest: index === 0
        }))
        .filter((item: OnlinePresetItem) => !!item.fileName);

      if (!disposed) {
        setState({ items, loading: false });
      }
    }

    void run();
    return () => {
      disposed = true;
    };
  }, [context.printer?.id, context.selectedVersionType, dataRevision]);

  return useMemo(() => state, [state]);
}
