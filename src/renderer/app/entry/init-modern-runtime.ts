import { createRendererApp, type RendererEntryOptions } from './renderer-entry';
import type { AppBootstrapResult } from '../bootstrap/app-bootstrap';

export type InitModernRuntimeOptions = Omit<RendererEntryOptions, 'storage' | 'windowObject'> & {
  storage?: Storage;
  windowObject?: Window;
};

export function initModernRuntime(options: InitModernRuntimeOptions): AppBootstrapResult {
  const targetWindow: Window = options.windowObject ?? window;

  return createRendererApp({
    storage: options.storage ?? targetWindow.localStorage,
    packageVersion: options.packageVersion,
    presetSources: options.presetSources,
    catalogSources: options.catalogSources,
    defaultResourceSource: options.defaultResourceSource,
    windowObject: targetWindow
  });
}
