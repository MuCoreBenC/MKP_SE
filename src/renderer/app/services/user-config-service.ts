import { AppEventBus } from '../core/app-event-bus';
import type { VersionType } from '../core/preset';
import { StorageAdapter } from '../adapters/storage-adapter';
import { userConfigSchema } from '../schemas/user-config-schema';
import { PresetSessionStore } from '../stores/preset-session-store';
import {
  DEFAULT_USER_CONFIG,
  UserConfigStore,
  type UserConfig,
  type UserConfigStorage
} from '../stores/user-config-store';
import { CrossWindowSyncService, SYNC_KEYS } from '../sync/cross-window-sync-service';
import { SchemaValidationService } from './schema-validation-service';

export const USER_CONFIG_STORAGE_KEY = 'mkp:state:user-config';
const LEGACY_USER_CONFIG_STORAGE_KEY = 'mkp_user_config';
const LEGACY_ONBOARDING_KEY = 'showOnboarding';
const LEGACY_UPDATE_MODE_KEY = 'update_mode';
const LEGACY_THEME_MODE_KEY = 'themeMode';
const LEGACY_DOCK_ANIMATION_KEY = 'setting_dock_anim';
const LEGACY_DOCK_SIZE_KEY = 'setting_dock_size';
const LEGACY_DOCK_SCALE_KEY = 'setting_dock_scale';

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isPlainRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((result, [key, entryValue]) => {
    if (typeof key === 'string' && key.trim() && typeof entryValue === 'string' && entryValue.trim()) {
      result[key] = entryValue;
    }

    return result;
  }, {});
}

function coerceNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function coerceVersionType(value: unknown, fallback: UserConfig['selectedVersionType']): UserConfig['selectedVersionType'] {
  return value === 'standard' || value === 'quick' || value === 'lite'
    ? value
    : fallback;
}

function coerceUpdateMode(value: unknown, fallback: UserConfig['updateMode']): UserConfig['updateMode'] {
  return value === 'manual' || value === 'auto'
    ? value
    : fallback;
}

function coerceThemeMode(value: unknown, fallback: UserConfig['themeMode']): UserConfig['themeMode'] {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : fallback;
}

function coerceTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value
    : fallback;
}

function unwrapSyncPayload(value: unknown): unknown {
  if (
    isPlainRecord(value)
    && 'payload' in value
    && 'type' in value
    && 'sourceWindowId' in value
  ) {
    return value.payload;
  }

  return value;
}

function hasUserConfigLikeShape(value: PlainRecord): boolean {
  const knownKeys = [
    'selectedBrandId',
    'selectedPrinterId',
    'selectedVersionType',
    'appliedPresetByContext',
    'onboardingEnabled',
    'updateMode',
    'themeMode',
    'dockAnimationEnabled',
    'dockBaseSize',
    'dockMaxScale',
    'updatedAt',
    'brand',
    'printer',
    'version',
    'appliedReleases'
  ];

  return knownKeys.some((key) => key in value);
}

export class BrowserUserConfigStorage implements UserConfigStorage {
  public constructor(
    private readonly storageAdapter: StorageAdapter,
    private readonly schemaValidationService = new SchemaValidationService()
  ) {}

  public read(): UserConfig {
    const persisted = this.readCandidate(USER_CONFIG_STORAGE_KEY, 'persisted');
    if (persisted) {
      return persisted;
    }

    const migratedSyncPayload = this.readCandidate(SYNC_KEYS.userConfig, 'sync');
    if (migratedSyncPayload) {
      this.persistValidated(migratedSyncPayload);
      return migratedSyncPayload;
    }

    const migratedLegacyPayload = this.readCandidate(LEGACY_USER_CONFIG_STORAGE_KEY, 'legacy');
    if (migratedLegacyPayload) {
      this.persistValidated(migratedLegacyPayload);
      return migratedLegacyPayload;
    }

    const fallback = this.buildRecoveryConfig();
    this.persistValidated(fallback);
    console.warn('[MKP Modern Runtime] user config missing or invalid, reset to default config');
    return fallback;
  }

  public write(config: UserConfig): void {
    const validated = this.schemaValidationService.parse(userConfigSchema, config, 'Invalid user config');
    this.persistValidated(validated);
  }

  private persistValidated(config: UserConfig): void {
    this.storageAdapter.writeJson(USER_CONFIG_STORAGE_KEY, config);
  }

  private readCandidate(key: string, source: 'persisted' | 'sync' | 'legacy'): UserConfig | null {
    const value = this.storageAdapter.readJson<unknown>(key, null);
    if (value === null) {
      return null;
    }

    const normalized = this.normalizeCandidate(value);
    if (normalized) {
      return normalized;
    }

    console.warn(`[MKP Modern Runtime] ignored invalid ${source} user config payload`);
    return null;
  }

  private normalizeCandidate(value: unknown): UserConfig | null {
    const unwrapped = unwrapSyncPayload(value);
    const validatedDirectly = this.tryParseUserConfig(unwrapped);
    if (validatedDirectly) {
      return validatedDirectly;
    }

    if (!isPlainRecord(unwrapped)) {
      return null;
    }

    if (!hasUserConfigLikeShape(unwrapped)) {
      return null;
    }

    return this.tryParseUserConfig({
      selectedBrandId: coerceNonEmptyString(
        unwrapped.selectedBrandId ?? unwrapped.brand,
        DEFAULT_USER_CONFIG.selectedBrandId
      ),
      selectedPrinterId: coerceNonEmptyString(
        unwrapped.selectedPrinterId ?? unwrapped.printer,
        DEFAULT_USER_CONFIG.selectedPrinterId
      ),
      selectedVersionType: coerceVersionType(
        unwrapped.selectedVersionType ?? unwrapped.version,
        DEFAULT_USER_CONFIG.selectedVersionType
      ),
      appliedPresetByContext: normalizeStringMap(
        unwrapped.appliedPresetByContext ?? unwrapped.appliedReleases
      ),
      onboardingEnabled: coerceBoolean(
        unwrapped.onboardingEnabled,
        this.readLegacyOnboardingEnabled()
      ),
      updateMode: coerceUpdateMode(
        unwrapped.updateMode,
        this.readLegacyUpdateMode()
      ),
      themeMode: coerceThemeMode(
        unwrapped.themeMode,
        this.readLegacyThemeMode()
      ),
      dockAnimationEnabled: coerceBoolean(
        unwrapped.dockAnimationEnabled,
        this.readLegacyDockAnimationEnabled()
      ),
      dockBaseSize: coerceFiniteNumber(
        unwrapped.dockBaseSize,
        this.readLegacyDockBaseSize()
      ),
      dockMaxScale: coerceFiniteNumber(
        unwrapped.dockMaxScale,
        this.readLegacyDockMaxScale()
      ),
      updatedAt: coerceTimestamp(
        unwrapped.updatedAt,
        new Date().toISOString()
      )
    });
  }

  private tryParseUserConfig(value: unknown): UserConfig | null {
    const result = userConfigSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private buildRecoveryConfig(): UserConfig {
    return {
      ...DEFAULT_USER_CONFIG,
      onboardingEnabled: this.readLegacyOnboardingEnabled(),
      updateMode: this.readLegacyUpdateMode(),
      themeMode: this.readLegacyThemeMode(),
      dockAnimationEnabled: this.readLegacyDockAnimationEnabled(),
      dockBaseSize: this.readLegacyDockBaseSize(),
      dockMaxScale: this.readLegacyDockMaxScale(),
      updatedAt: new Date().toISOString()
    };
  }

  private readLegacyOnboardingEnabled(): boolean {
    return this.storageAdapter.readJson<boolean>(LEGACY_ONBOARDING_KEY, DEFAULT_USER_CONFIG.onboardingEnabled);
  }

  private readLegacyUpdateMode(): UserConfig['updateMode'] {
    return coerceUpdateMode(
      this.storageAdapter.readString(LEGACY_UPDATE_MODE_KEY, null),
      DEFAULT_USER_CONFIG.updateMode
    );
  }

  private readLegacyThemeMode(): UserConfig['themeMode'] {
    return coerceThemeMode(
      this.storageAdapter.readString(LEGACY_THEME_MODE_KEY, null),
      DEFAULT_USER_CONFIG.themeMode
    );
  }

  private readLegacyDockAnimationEnabled(): boolean {
    const rawValue = this.storageAdapter.readString(LEGACY_DOCK_ANIMATION_KEY, null);
    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    return DEFAULT_USER_CONFIG.dockAnimationEnabled;
  }

  private readLegacyDockBaseSize(): number {
    return coerceFiniteNumber(
      this.storageAdapter.readString(LEGACY_DOCK_SIZE_KEY, null),
      DEFAULT_USER_CONFIG.dockBaseSize
    );
  }

  private readLegacyDockMaxScale(): number {
    return coerceFiniteNumber(
      this.storageAdapter.readString(LEGACY_DOCK_SCALE_KEY, null),
      DEFAULT_USER_CONFIG.dockMaxScale
    );
  }
}

export class UserConfigService {
  public constructor(
    private readonly userConfigStore: UserConfigStore,
    private readonly presetSessionStore: PresetSessionStore,
    private readonly eventBus: AppEventBus,
    private readonly syncService: CrossWindowSyncService
  ) {}

  public selectContext(brandId: string, printerId: string, versionType: VersionType): void {
    const snapshot = this.presetSessionStore.selectContext(brandId, printerId, versionType);

    this.eventBus.emit('context:changed', {
      brandId: snapshot.brandId,
      printerId: snapshot.printerId,
      versionType: snapshot.versionType,
      contextKey: snapshot.contextKey
    });

    this.syncService.broadcast(
      SYNC_KEYS.activeContext,
      this.syncService.createMessage('context-changed', {
        brandId: snapshot.brandId,
        printerId: snapshot.printerId,
        versionType: snapshot.versionType,
        contextKey: snapshot.contextKey
      })
    );

    this.syncService.broadcast(
      SYNC_KEYS.userConfig,
      this.syncService.createMessage('user-config-updated', this.userConfigStore.getSnapshot())
    );
  }

  public setUpdateMode(updateMode: UserConfig['updateMode']): void {
    this.userConfigStore.setUpdateMode(updateMode);

    this.syncService.broadcast(
      SYNC_KEYS.userConfig,
      this.syncService.createMessage('user-config-updated', this.userConfigStore.getSnapshot())
    );
  }
}
