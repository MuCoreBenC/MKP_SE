import type { AppContainer } from '../core/app-container';

declare global {
  interface Window {
    mkpModernApp?: AppContainer;
    __MKP_MODERN_BRIDGE__?: {
      getHomeViewModel: (brandId: string) => ReturnType<AppContainer['controllers']['homeController']['getHomeViewModel']>;
      selectPrinterContext: (brandId: string, printerId: string, versionType: 'standard' | 'quick' | 'lite') => ReturnType<AppContainer['controllers']['homeController']['selectPrinterContext']>;
      getPresetList: (printerId: string, versionType: 'standard' | 'quick' | 'lite') => ReturnType<AppContainer['controllers']['presetsController']['getPresetList']>;
      getActivePreset: (printerId: string, versionType: 'standard' | 'quick' | 'lite') => ReturnType<AppContainer['controllers']['presetsController']['getActivePreset']>;
      parseUpdateManifest: (manifest: unknown) => ReturnType<AppContainer['controllers']['updatesController']['parseManifest']>;
      checkUpdates: (currentVersion: string, manifest: unknown) => ReturnType<AppContainer['controllers']['updatesController']['check']>;
    };
  }
}

export function installLegacyBridge(container: AppContainer): void {
  if (typeof window === 'undefined') {
    return;
  }

  installLegacyBridgeOn(window, container);
}

export function installLegacyBridgeOn(targetWindow: Window, container: AppContainer): void {
  targetWindow.mkpModernApp = container;
  targetWindow.__MKP_MODERN_BRIDGE__ = {
    getHomeViewModel: (brandId) => container.controllers.homeController.getHomeViewModel(brandId),
    selectPrinterContext: (brandId, printerId, versionType) => container.controllers.homeController.selectPrinterContext(brandId, printerId, versionType),
    getPresetList: (printerId, versionType) => container.controllers.presetsController.getPresetList(printerId, versionType),
    getActivePreset: (printerId, versionType) => container.controllers.presetsController.getActivePreset(printerId, versionType),
    parseUpdateManifest: (manifest) => container.controllers.updatesController.parseManifest(manifest),
    checkUpdates: (currentVersion, manifest) => container.controllers.updatesController.check(currentVersion, manifest)
  };
}
