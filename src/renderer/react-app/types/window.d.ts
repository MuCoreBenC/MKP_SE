export {};

import type { VersionType } from '../../app/core/preset';

type LocalPresetDetail = {
  fileName: string;
  customName?: string;
  displayName?: string;
  realVersion?: string;
  modifiedAt?: number;
  size?: number;
};

type DownloadFileResult = {
  success: boolean;
  error?: string;
};

type DuplicatePresetPayload = {
  fileName: string;
  printerId: string;
  versionType: string | null;
  realVersion?: string;
};

type RenamePresetDisplayPayload = {
  fileName: string;
  newName: string;
};

type LocalPresetsManifestItem = {
  id?: string;
  type?: string;
  version?: string;
  file?: string;
  lastModified?: string;
  releaseNotes?: string[] | string;
  description?: string;
};

type LocalPresetsManifestResult = {
  success: boolean;
  data?: {
    presets?: LocalPresetsManifestItem[];
  };
};

declare global {
  interface Window {
    mkpAPI?: {
      listLocalPresetsDetailed?: () => Promise<{
        success: boolean;
        data?: LocalPresetDetail[];
      }>;
      readBundledPresetsManifest?: () => Promise<LocalPresetsManifestResult>;
      readLocalPresetsManifest?: () => Promise<LocalPresetsManifestResult>;
      downloadFile?: (url: string, fileName: string) => Promise<DownloadFileResult>;
      copyBundledPreset?: (fileName: string) => Promise<DownloadFileResult>;
      duplicatePreset?: (payload: DuplicatePresetPayload) => Promise<DownloadFileResult & { newFileName?: string }>;
      renamePresetDisplay?: (payload: RenamePresetDisplayPayload) => Promise<DownloadFileResult>;
      deleteFile?: (fileName: string) => Promise<DownloadFileResult>;
    };
    compareVersionsFront?: (left: string, right: string) => number;
    selectedVersion?: VersionType | null;
    saveUserConfig?: () => void;
    updateSidebarVersionBadge?: (versionType: VersionType | null) => void;
    renderDownloadVersions?: (printerData: unknown) => void;
    handleApplyLocal?: (
      releaseId: string,
      fileName: string,
      printerData: unknown,
      versionType?: VersionType | null,
      clickedBtn?: unknown
    ) => void;
    checkOnlineUpdates?: (buttonElement?: unknown) => Promise<void> | void;
    resolveActivePresetFileName?: (targetWindow: Window, legacyActiveFileName: string | null) => string | null;
  }
}
