import { buildContextKey, type VersionType } from '../core/preset';
import { UserConfigStore } from './user-config-store';

export interface PresetSessionSnapshot {
  brandId: string;
  printerId: string;
  versionType: VersionType;
  contextKey: string;
  activeFileName: string | null;
}

export class PresetSessionStore {
  public constructor(private readonly userConfigStore: UserConfigStore) {}

  public getSnapshot(): PresetSessionSnapshot {
    const config = this.userConfigStore.getSnapshot();
    const contextKey = buildContextKey(config.selectedPrinterId, config.selectedVersionType);

    return {
      brandId: config.selectedBrandId,
      printerId: config.selectedPrinterId,
      versionType: config.selectedVersionType,
      contextKey,
      activeFileName: config.appliedPresetByContext[contextKey] ?? null
    };
  }

  public selectContext(brandId: string, printerId: string, versionType: VersionType): PresetSessionSnapshot {
    this.userConfigStore.selectContext(brandId, printerId, versionType);
    return this.getSnapshot();
  }

  public setAppliedPreset(fileName: string): PresetSessionSnapshot {
    const snapshot = this.getSnapshot();
    this.userConfigStore.setAppliedPreset(snapshot.printerId, snapshot.versionType, fileName);
    return this.getSnapshot();
  }
}
