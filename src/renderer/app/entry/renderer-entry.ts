import { bootstrapApp } from '../bootstrap/app-bootstrap';
import { installLegacyBridgeOn } from './legacy-bridge';
import type { CatalogDataSource } from '../repositories/catalog-repository';
import type { DefaultResourceDataSource } from '../repositories/default-resource-repository';
import type { PresetDataSource } from '../repositories/preset-repository';

export interface RendererEntryOptions {
  storage: Storage;
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
  windowObject?: Window;
}

export function createRendererApp(options: RendererEntryOptions) {
  const app = bootstrapApp({
    storage: options.storage,
    packageVersion: options.packageVersion,
    presetSources: options.presetSources,
    catalogSources: options.catalogSources,
    defaultResourceSource: options.defaultResourceSource
  });

  const targetWindow = options.windowObject ?? window;
  app.bindStorageSync(targetWindow);
  installLegacyBridgeOn(targetWindow, app.container);

  return app;
}
