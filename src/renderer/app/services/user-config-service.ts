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

export class BrowserUserConfigStorage implements UserConfigStorage {
  public constructor(
    private readonly storageAdapter: StorageAdapter,
    private readonly schemaValidationService = new SchemaValidationService()
  ) {}

  public read(): UserConfig {
    const value = this.storageAdapter.readJson<UserConfig>(SYNC_KEYS.userConfig, DEFAULT_USER_CONFIG);
    return this.schemaValidationService.parse(userConfigSchema, value, 'Invalid user config');
  }

  public write(config: UserConfig): void {
    const validated = this.schemaValidationService.parse(userConfigSchema, config, 'Invalid user config');
    this.storageAdapter.writeJson(SYNC_KEYS.userConfig, validated);
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
