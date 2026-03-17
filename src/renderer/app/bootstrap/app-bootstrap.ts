import { createAppContainer, type AppContainer, type AppContainerOptions } from '../core/app-container';

export interface AppBootstrapResult {
  container: AppContainer;
  bindStorageSync(storageEventSource: { addEventListener: (type: string, handler: (event: StorageEvent) => void) => void }): void;
}

export function bootstrapApp(options: AppContainerOptions): AppBootstrapResult {
  const container = createAppContainer(options);

  return {
    container,
    bindStorageSync(storageEventSource) {
      storageEventSource.addEventListener('storage', (event) => {
        container.syncService.handleStorageEvent({
          key: event.key,
          newValue: event.newValue
        });
      });
    }
  };
}
