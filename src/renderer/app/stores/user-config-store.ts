import { buildContextKey, type VersionType } from '../core/preset';

export interface UserConfig {
  selectedBrandId: string;
  selectedPrinterId: string;
  selectedVersionType: VersionType;
  appliedPresetByContext: Record<string, string>;
  onboardingEnabled: boolean;
  updateMode: 'manual' | 'auto';
  themeMode: 'light' | 'dark' | 'system';
  dockAnimationEnabled: boolean;
  dockBaseSize: number;
  dockMaxScale: number;
  updatedAt: string;
}

export interface UserConfigStorage {
  read(): UserConfig | null;
  write(config: UserConfig): void;
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  selectedBrandId: 'bambu',
  selectedPrinterId: 'a1',
  selectedVersionType: 'standard',
  appliedPresetByContext: {},
  onboardingEnabled: true,
  updateMode: 'manual',
  themeMode: 'system',
  dockAnimationEnabled: true,
  dockBaseSize: 38,
  dockMaxScale: 1.5,
  updatedAt: new Date(0).toISOString()
};

function nowIsoString(): string {
  return new Date().toISOString();
}

export class UserConfigStore {
  private config: UserConfig;
  private readonly listeners = new Set<(config: UserConfig) => void>();

  public constructor(private readonly storage: UserConfigStorage) {
    this.config = this.hydrate(storage.read());
  }

  public getSnapshot(): UserConfig {
    return {
      ...this.config,
      appliedPresetByContext: { ...this.config.appliedPresetByContext }
    };
  }

  public selectContext(brandId: string, printerId: string, versionType: VersionType): UserConfig {
    this.config = {
      ...this.config,
      selectedBrandId: brandId,
      selectedPrinterId: printerId,
      selectedVersionType: versionType,
      updatedAt: nowIsoString()
    };

    this.persist();
    this.notify();
    return this.getSnapshot();
  }

  public setAppliedPreset(printerId: string, versionType: VersionType, fileName: string): UserConfig {
    const contextKey = buildContextKey(printerId, versionType);
    this.config = {
      ...this.config,
      appliedPresetByContext: {
        ...this.config.appliedPresetByContext,
        [contextKey]: fileName
      },
      updatedAt: nowIsoString()
    };

    this.persist();
    this.notify();
    return this.getSnapshot();
  }

  public setUpdateMode(updateMode: UserConfig['updateMode']): UserConfig {
    this.config = {
      ...this.config,
      updateMode,
      updatedAt: nowIsoString()
    };

    this.persist();
    this.notify();
    return this.getSnapshot();
  }

  public subscribe(listener: (config: UserConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private hydrate(input: UserConfig | null): UserConfig {
    const selectedVersionType = input?.selectedVersionType ?? DEFAULT_USER_CONFIG.selectedVersionType;

    return {
      ...DEFAULT_USER_CONFIG,
      ...input,
      selectedVersionType,
      appliedPresetByContext: { ...DEFAULT_USER_CONFIG.appliedPresetByContext, ...input?.appliedPresetByContext },
      updatedAt: input?.updatedAt ?? nowIsoString()
    };
  }

  private persist(): void {
    this.storage.write(this.config);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}
