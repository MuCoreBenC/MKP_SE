import { AppEventBus } from '../core/app-event-bus';
import { appManifestSchema, type AppManifestSchema } from '../schemas/app-manifest-schema';
import { UpdateStore } from '../stores/update-store';
import { CrossWindowSyncService, SYNC_KEYS } from '../sync/cross-window-sync-service';
import { SchemaValidationService } from './schema-validation-service';
import { VersionService } from './version-service';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  manifest: AppManifestSchema;
}

export class UpdateService {
  public constructor(
    private readonly versionService: VersionService,
    private readonly schemaValidationService: SchemaValidationService,
    private readonly eventBus: AppEventBus,
    private readonly updateStore?: UpdateStore,
    private readonly syncService?: CrossWindowSyncService
  ) {}

  public parseManifest(manifest: unknown): AppManifestSchema {
    return this.schemaValidationService.parse(appManifestSchema, manifest, 'Invalid app manifest');
  }

  public checkForUpdates(currentVersion: string, manifest: unknown): UpdateCheckResult {
    const resolvedCurrentVersion = this.versionService.getCurrentVersion(currentVersion);
    const parsedManifest = this.parseManifest(manifest);
    const latestVersion = this.versionService.getCurrentVersion(parsedManifest.latestVersion);
    const hasUpdate = this.versionService.hasNewerVersion(resolvedCurrentVersion, latestVersion);

    const state = this.updateStore?.setRemoteState(latestVersion, hasUpdate, parsedManifest);

    this.eventBus.emit('update:state-changed', {
      currentVersion: resolvedCurrentVersion,
      latestVersion,
      hasUpdate
    });

    if (this.syncService) {
      this.syncService.broadcast(
        SYNC_KEYS.updateState,
        this.syncService.createMessage('update-state-changed', {
          currentVersion: resolvedCurrentVersion,
          latestVersion,
          hasUpdate
        })
      );
    }

    return {
      currentVersion: resolvedCurrentVersion,
      latestVersion,
      hasUpdate,
      manifest: state?.remoteManifest ?? parsedManifest
    };
  }
}
