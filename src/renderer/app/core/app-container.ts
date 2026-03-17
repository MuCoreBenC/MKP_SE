import { StorageAdapter, type KeyValueStorageLike } from '../adapters/storage-adapter';
import { AppEventBus } from './app-event-bus';
import { CalibrationController } from '../controllers/calibration-controller';
import { HomeController } from '../controllers/home-controller';
import { ParamsController } from '../controllers/params-controller';
import { PresetsController } from '../controllers/presets-controller';
import { ReleaseController } from '../controllers/release-controller';
import { UpdatesController } from '../controllers/updates-controller';
import { CatalogRepository, type CatalogDataSource } from '../repositories/catalog-repository';
import { DefaultResourceRepository, type DefaultResourceDataSource } from '../repositories/default-resource-repository';
import { PresetRepository, type PresetDataSource } from '../repositories/preset-repository';
import { CatalogService } from '../services/catalog-service';
import { CalibrationService } from '../services/calibration-service';
import { DefaultResourceService } from '../services/default-resource-service';
import { ParamEditorService } from '../services/param-editor-service';
import { PresetService } from '../services/preset-service';
import { ReleaseService } from '../services/release-service';
import { BrowserUserConfigStorage, UserConfigService } from '../services/user-config-service';
import { SchemaValidationService } from '../services/schema-validation-service';
import { UpdateService } from '../services/update-service';
import { VersionService } from '../services/version-service';
import { ParamEditorStore } from '../stores/param-editor-store';
import { PresetSessionStore } from '../stores/preset-session-store';
import { UpdateStore } from '../stores/update-store';
import { UserConfigStore } from '../stores/user-config-store';
import { CrossWindowSyncService } from '../sync/cross-window-sync-service';

export interface AppContainerOptions {
  storage: KeyValueStorageLike;
  windowId?: string;
  packageVersion: string;
  presetSources: {
    builtin: PresetDataSource;
    user: PresetDataSource;
  };
  catalogSources: {
    builtin: CatalogDataSource;
    user: CatalogDataSource;
  };
  defaultResourceSource: DefaultResourceDataSource;
}

export interface AppContainer {
  eventBus: AppEventBus;
  schemaValidationService: SchemaValidationService;
  stores: {
    userConfigStore: UserConfigStore;
    presetSessionStore: PresetSessionStore;
    paramEditorStore: ParamEditorStore;
    updateStore: UpdateStore;
  };
  services: {
    userConfigService: UserConfigService;
    presetService: PresetService;
    paramEditorService: ParamEditorService;
    calibrationService: CalibrationService;
    catalogService: CatalogService;
    updateService: UpdateService;
    releaseService: ReleaseService;
    defaultResourceService: DefaultResourceService;
    versionService: VersionService;
  };
  controllers: {
    homeController: HomeController;
    presetsController: PresetsController;
    calibrationController: CalibrationController;
    paramsController: ParamsController;
    updatesController: UpdatesController;
    releaseController: ReleaseController;
  };
  syncService: CrossWindowSyncService;
}

export function createAppContainer(options: AppContainerOptions): AppContainer {
  const eventBus = new AppEventBus();
  const schemaValidationService = new SchemaValidationService();
  const storageAdapter = new StorageAdapter(options.storage);
  const userConfigStorage = new BrowserUserConfigStorage(storageAdapter, schemaValidationService);
  const userConfigStore = new UserConfigStore(userConfigStorage);
  const presetSessionStore = new PresetSessionStore(userConfigStore);
  const paramEditorStore = new ParamEditorStore();
  const versionService = new VersionService();
  const updateStore = new UpdateStore(versionService.getCurrentVersion(options.packageVersion));
  const syncService = new CrossWindowSyncService(options.storage, eventBus, options.windowId ?? 'renderer_main');

  const presetRepository = new PresetRepository(options.presetSources.builtin, options.presetSources.user, schemaValidationService);
  const catalogRepository = new CatalogRepository(options.catalogSources.builtin, options.catalogSources.user, schemaValidationService);
  const defaultResourceRepository = new DefaultResourceRepository(options.defaultResourceSource, schemaValidationService);

  const userConfigService = new UserConfigService(userConfigStore, presetSessionStore, eventBus, syncService);
  const presetService = new PresetService(userConfigStore, presetRepository, presetSessionStore, eventBus);
  const paramEditorService = new ParamEditorService(paramEditorStore, eventBus);
  const calibrationService = new CalibrationService(eventBus);
  const catalogService = new CatalogService(catalogRepository, eventBus);
  const updateService = new UpdateService(versionService, schemaValidationService, eventBus, updateStore, syncService);
  const releaseService = new ReleaseService(schemaValidationService, eventBus);
  const defaultResourceService = new DefaultResourceService(defaultResourceRepository, eventBus);
  const homeController = new HomeController(catalogService, userConfigService);
  const presetsController = new PresetsController(presetService);
  const calibrationController = new CalibrationController(calibrationService);
  const paramsController = new ParamsController(paramEditorService);
  const updatesController = new UpdatesController(updateService);
  const releaseController = new ReleaseController(releaseService, defaultResourceService);

  return {
    eventBus,
    schemaValidationService,
    stores: {
      userConfigStore,
      presetSessionStore,
      paramEditorStore,
      updateStore
    },
    services: {
      userConfigService,
      presetService,
      paramEditorService,
      calibrationService,
      catalogService,
      updateService,
      releaseService,
      defaultResourceService,
      versionService
    },
    controllers: {
      homeController,
      presetsController,
      calibrationController,
      paramsController,
      updatesController,
      releaseController
    },
    syncService
  };
}
