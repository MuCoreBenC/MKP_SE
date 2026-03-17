import { initModernRuntime } from './init-modern-runtime';
import type { AppBootstrapResult } from '../bootstrap/app-bootstrap';
import type { AppContainer } from '../core/app-container';
import type { CatalogDataSource } from '../repositories/catalog-repository';
import type { DefaultResourceDataSource } from '../repositories/default-resource-repository';
import type { PresetDataSource, PresetRecord } from '../repositories/preset-repository';
import type { CatalogBrandSchema, CatalogPrinterSchema } from '../schemas/catalog-schema';
import type { AppManifestSchema } from '../schemas/app-manifest-schema';
import type { PresetSchema } from '../schemas/preset-schema';
import type { VersionType } from '../core/preset';
import type { UpdateCheckResult } from '../services/update-service';

type ModernRuntime = AppBootstrapResult;
type HomeViewModel = ReturnType<AppContainer['controllers']['homeController']['getHomeViewModel']>;
type ActivePresetView = ReturnType<AppContainer['controllers']['presetsController']['getActivePreset']>;
type DownloadContextView = {
  printer: HomeViewModel['printers'][number] | null;
  selectedVersionType: VersionType;
};
type AppUpdateStateView = {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  checkedAt: string | null;
};

declare global {
  interface Window {
    brands?: Array<{ id: string; name?: string; shortName?: string; subtitle?: string; favorite?: boolean; image?: string }>;
    printersByBrand?: Record<string, Array<{ id: string; name?: string; shortName?: string; image?: string; favorite?: boolean; disabled?: boolean; supportedVersions?: VersionType[]; defaultPresets?: Partial<Record<VersionType, string>> }>>;
    APP_REAL_VERSION?: string;
    __MKP_MODERN_RUNTIME__?: ModernRuntime;
    selectedBrand?: string | null;
    selectedPrinter?: string | null;
    selectedVersion?: VersionType | null;
    __syncLegacyContextToModern__?: (payload: {
      brandId?: string | null;
      printerId?: string | null;
      versionType?: VersionType | null;
    }) => void;
    __hydrateModernContextFromLegacy__?: () => void;
    __getDownloadContextView__?: () => DownloadContextView;
    __getActivePresetView__?: () => ActivePresetView;
    __getParamsPresetView__?: () => ActivePresetView;
    resolveActivePresetFileName?: (targetWindow: Window, fallbackFileName: string | null) => string | null;
    resolveDownloadAppliedState?: (targetWindow: Window, candidateFileNames: string[], fallbackActiveFileName: string | null) => boolean;
    resolveParamsPresetPath?: (targetWindow: Window, fallbackPath: string | null) => string | null;
    resolveParamsDisplayFileName?: (targetWindow: Window, fallbackPath: string | null) => string | null;
    __getCalibrationContextView__?: () => {
      printerId: string;
      versionType: VersionType;
      presetPath: string | null;
    };
    __getAppUpdateStateView__?: () => AppUpdateStateView;
    __getCachedUpdateManifestView__?: () => AppManifestSchema | null;
    __getUpdateModeView__?: () => 'manual' | 'auto';
    __setUpdateModeForLegacy__?: (mode: 'manual' | 'auto') => void;
    __parseUpdateManifestForLegacy__?: (manifest: unknown) => AppManifestSchema | null;
    __checkAppUpdateForLegacy__?: (currentVersion: string, manifest: unknown) => UpdateCheckResult | null;
  }
}

export function resolveDownloadContext(
  targetWindow: Window,
  fallbackPrinter: unknown,
  fallbackVersionType: VersionType | null
) {
  const view = targetWindow.__getDownloadContextView__?.();
  return {
    printer: view?.printer ?? fallbackPrinter ?? null,
    selectedVersionType: view?.selectedVersionType ?? fallbackVersionType ?? null
  };
}

export function resolveParamsPresetPath(targetWindow: Window, fallbackPath: string | null) {
  return targetWindow.__getParamsPresetView__?.()?.absolutePath ?? fallbackPath ?? null;
}

export function buildScriptCommandView(targetWindow: Window, exePath: string, fallbackPresetPath: string | null) {
  const presetPath = resolveParamsPresetPath(targetWindow, fallbackPresetPath);
  if (!presetPath) {
    return null;
  }

  return `"${exePath}" --Json "${presetPath}" --Gcode`;
}

export function resolveParamsDisplayFileName(targetWindow: Window, fallbackPath: string | null) {
  const fileName = targetWindow.__getParamsPresetView__?.()?.fileName;
  if (fileName) {
    return fileName;
  }

  if (!fallbackPath) {
    return null;
  }

  return fallbackPath.split('\\').pop() ?? null;
}

export function resolveActivePresetFileName(targetWindow: Window, fallbackFileName: string | null) {
  return targetWindow.__getActivePresetView__?.()?.fileName ?? fallbackFileName ?? null;
}

export function hasParamsPresetView(targetWindow: Window) {
  return !!targetWindow.__getParamsPresetView__?.();
}

export function hasModernActivePresetView(targetWindow: Window) {
  return !!targetWindow.__getActivePresetView__?.();
}

export function resolveDownloadAppliedState(
  targetWindow: Window,
  candidateFileNames: string[],
  fallbackActiveFileName: string | null
) {
  const activeFileName = resolveActivePresetFileName(targetWindow, fallbackActiveFileName);
  return !!activeFileName && candidateFileNames.includes(activeFileName);
}

export function resolveCalibrationPresetPath(targetWindow: Window, fallbackPresetPath: string | null) {
  return targetWindow.__getCalibrationContextView__?.()?.presetPath ?? fallbackPresetPath ?? null;
}

export function resolveLegacyUpdateManifest(targetWindow: Window, manifest: unknown): AppManifestSchema | null {
  return targetWindow.__MKP_MODERN_BRIDGE__?.parseUpdateManifest(manifest) ?? null;
}

export function resolveLegacyUpdateCheck(
  targetWindow: Window,
  currentVersion: string,
  manifest: unknown
): UpdateCheckResult | null {
  return targetWindow.__MKP_MODERN_BRIDGE__?.checkUpdates(currentVersion, manifest) ?? null;
}

export function resolveAppUpdateStateView(targetWindow: Window): AppUpdateStateView | null {
  return targetWindow.__getAppUpdateStateView__?.() ?? null;
}

export function resolveCachedUpdateManifestView(targetWindow: Window): AppManifestSchema | null {
  return targetWindow.__getCachedUpdateManifestView__?.() ?? null;
}

function syncLegacySelectionGlobals(targetWindow: Window, runtime: ModernRuntime) {
  const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
  targetWindow.selectedBrand = snapshot.selectedBrandId;
  targetWindow.selectedPrinter = snapshot.selectedPrinterId;
  targetWindow.selectedVersion = snapshot.selectedVersionType;
}

function installLegacyContextSync(targetWindow: Window, runtime: ModernRuntime) {
  targetWindow.__syncLegacyContextToModern__ = (payload) => {
    const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
    const brandId = payload.brandId || snapshot.selectedBrandId;
    const printerId = payload.printerId || snapshot.selectedPrinterId;
    const versionType = payload.versionType || snapshot.selectedVersionType;

    runtime.container.controllers.homeController.selectPrinterContext(brandId, printerId, versionType);
    syncLegacySelectionGlobals(targetWindow, runtime);
  };

  targetWindow.__hydrateModernContextFromLegacy__ = () => {
    const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
    const brandId = targetWindow.selectedBrand || snapshot.selectedBrandId;
    const printerId = targetWindow.selectedPrinter || snapshot.selectedPrinterId;
    const versionType = targetWindow.selectedVersion || snapshot.selectedVersionType;

    runtime.container.controllers.homeController.selectPrinterContext(brandId, printerId, versionType);
    syncLegacySelectionGlobals(targetWindow, runtime);
  };

  targetWindow.__getDownloadContextView__ = () => {
    const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
    const homeView = runtime.container.controllers.homeController.getHomeViewModel(snapshot.selectedBrandId);
    const printer = homeView.printers.find((item) => item.id === snapshot.selectedPrinterId) ?? null;

    return {
      printer,
      selectedVersionType: snapshot.selectedVersionType
    };
  };

  targetWindow.__getActivePresetView__ = () => {
    const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
    return runtime.container.controllers.presetsController.getActivePreset(
      snapshot.selectedPrinterId,
      snapshot.selectedVersionType
    );
  };

  targetWindow.__getParamsPresetView__ = () => targetWindow.__getActivePresetView__?.() ?? null;
  targetWindow.resolveActivePresetFileName = (viewWindow, fallbackFileName) =>
    resolveActivePresetFileName(viewWindow, fallbackFileName);
  targetWindow.resolveDownloadAppliedState = (viewWindow, candidateFileNames, fallbackActiveFileName) =>
    resolveDownloadAppliedState(viewWindow, candidateFileNames, fallbackActiveFileName);
  targetWindow.resolveParamsPresetPath = (viewWindow, fallbackPath) =>
    resolveParamsPresetPath(viewWindow, fallbackPath);
  targetWindow.resolveParamsDisplayFileName = (viewWindow, fallbackPath) =>
    resolveParamsDisplayFileName(viewWindow, fallbackPath);

  targetWindow.__getCalibrationContextView__ = () => {
    const snapshot = runtime.container.stores.userConfigStore.getSnapshot();
    const activePreset = targetWindow.__getActivePresetView__?.() ?? null;

    return {
      printerId: snapshot.selectedPrinterId,
      versionType: snapshot.selectedVersionType,
      presetPath: activePreset?.absolutePath ?? null
    };
  };

  targetWindow.__parseUpdateManifestForLegacy__ = (manifest) => resolveLegacyUpdateManifest(targetWindow, manifest);
  targetWindow.__getAppUpdateStateView__ = () => {
    const snapshot = runtime.container.stores.updateStore.getSnapshot();

    return {
      currentVersion: snapshot.currentVersion,
      latestVersion: snapshot.latestVersion,
      hasUpdate: snapshot.hasUpdate,
      checkedAt: snapshot.remoteCheckedAt
    };
  };
  targetWindow.__getCachedUpdateManifestView__ = () => {
    const snapshot = runtime.container.stores.updateStore.getSnapshot();
    return snapshot.remoteManifest ? { ...snapshot.remoteManifest } : null;
  };
  targetWindow.__getUpdateModeView__ = () => runtime.container.stores.userConfigStore.getSnapshot().updateMode;
  targetWindow.__setUpdateModeForLegacy__ = (mode) => {
    runtime.container.services.userConfigService.setUpdateMode(mode);
  };
  targetWindow.__checkAppUpdateForLegacy__ = (currentVersion, manifest) =>
    resolveLegacyUpdateCheck(targetWindow, currentVersion, manifest);
}

function bindLegacySelectionGlobals(targetWindow: Window, runtime: ModernRuntime) {
  syncLegacySelectionGlobals(targetWindow, runtime);
  runtime.container.stores.userConfigStore.subscribe(() => {
    syncLegacySelectionGlobals(targetWindow, runtime);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function toCatalogBrand(input: NonNullable<Window['brands']>[number], index: number): CatalogBrandSchema {
  const timestamp = nowIso();
  return {
    id: String(input.id),
    displayName: String(input.name || input.shortName || input.id),
    shortName: String(input.shortName || input.name || input.id),
    subtitle: String(input.subtitle || ''),
    imageRef: String(input.image || `assets/images/${input.id}.webp`),
    favorite: !!input.favorite,
    pinned: index === 0,
    disabled: false,
    builtin: true,
    canDelete: false,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function toCatalogPrinter(brandId: string, input: NonNullable<NonNullable<Window['printersByBrand']>[string]>[number], index: number): CatalogPrinterSchema {
  const timestamp = nowIso();
  return {
    id: String(input.id),
    brandId,
    displayName: String(input.name || input.shortName || input.id),
    shortName: String(input.shortName || input.name || input.id),
    subtitle: '',
    imageRef: String(input.image || ''),
    supportedVersionTypes: Array.isArray(input.supportedVersions) && input.supportedVersions.length > 0 ? input.supportedVersions : ['standard'],
    defaultPresetRefs: input.defaultPresets || {},
    favorite: !!input.favorite,
    pinned: index === 0,
    disabled: !!input.disabled,
    builtin: true,
    canDelete: false,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createCatalogSources(targetWindow: Window): { builtin: CatalogDataSource; user: CatalogDataSource } {
  const brands = Array.isArray(targetWindow.brands) ? targetWindow.brands : [];
  const printersByBrand = targetWindow.printersByBrand && typeof targetWindow.printersByBrand === 'object'
    ? targetWindow.printersByBrand
    : {};

  const builtinBrands = brands.map((brand, index) => toCatalogBrand(brand, index));
  const builtinPrinters = Object.entries(printersByBrand).flatMap(([brandId, printers]) =>
    (Array.isArray(printers) ? printers : []).map((printer, index) => toCatalogPrinter(brandId, printer, index))
  );

  return {
    builtin: {
      read: () => ({ brands: builtinBrands, printers: builtinPrinters })
    },
    user: {
      read: () => ({ brands: [], printers: [] }),
      write: () => {}
    }
  };
}

function createPresetSources(targetWindow: Window): { builtin: PresetDataSource; user: PresetDataSource } {
  const printersByBrand = targetWindow.printersByBrand && typeof targetWindow.printersByBrand === 'object'
    ? targetWindow.printersByBrand
    : {};

  const builtinRecords: PresetRecord[] = Object.entries(printersByBrand).flatMap(([, printers]) =>
    (Array.isArray(printers) ? printers : []).flatMap((printer) => {
      const mapping = printer.defaultPresets || {};
      return (Object.entries(mapping) as Array<[VersionType, string | undefined]>).flatMap(([versionType, fileName]) => {
        if (!fileName) {
          return [];
        }

        return [{
          fileName,
          absolutePath: fileName,
          storageLayer: 'builtin' as const,
          content: {
            printer: printer.id,
            type: versionType,
            version: '0.0.0-runtime'
          } satisfies PresetSchema
        }];
      });
    })
  );

  return {
    builtin: {
      list: () => builtinRecords,
      write: () => {}
    },
    user: {
      list: () => [],
      write: () => {}
    }
  };
}

function createDefaultResourceSource(): DefaultResourceDataSource {
  return {
    readPreset(fileName: string) {
      return {
        fileName,
        content: {
          version: '0.0.0-runtime'
        }
      };
    },
    writePreset() {}
  };
}

export function mountModernRuntime(targetWindow: Window = window) {
  const runtime = initModernRuntime({
    windowObject: targetWindow,
    storage: targetWindow.localStorage,
    packageVersion: String(targetWindow.APP_REAL_VERSION || '0.0.0-runtime'),
    presetSources: createPresetSources(targetWindow),
    catalogSources: createCatalogSources(targetWindow),
    defaultResourceSource: createDefaultResourceSource()
  });

  targetWindow.__MKP_MODERN_RUNTIME__ = runtime;
  bindLegacySelectionGlobals(targetWindow, runtime);
  installLegacyContextSync(targetWindow, runtime);
  return runtime;
}
