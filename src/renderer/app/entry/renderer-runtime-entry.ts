import { mountModernRuntime } from './renderer-runtime';

declare global {
  interface Window {
    MKPModernRendererRuntime?: {
      mountModernRuntime?: (targetWindow?: Window) => unknown;
    };
  }
}

if (typeof window !== 'undefined') {
  window.MKPModernRendererRuntime = {
    mountModernRuntime
  };
}

export { mountModernRuntime };
