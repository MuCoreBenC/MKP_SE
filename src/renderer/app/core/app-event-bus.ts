export interface AppEventMap {
  'context:changed': {
    brandId: string;
    printerId: string;
    versionType: string;
    contextKey: string;
  };
  'preset:applied': {
    contextKey: string;
    activeFileName: string;
    resolvedVersion: string;
  };
  'preset:content-updated': {
    contextKey: string;
    sourceWindowId?: string;
    reason: string;
  };
  'sync:message-received': {
    type: string;
    sourceWindowId: string;
  };
  'update:state-changed': {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
  };
}

type EventHandler<T> = (payload: T) => void;

export class AppEventBus {
  private readonly listeners = new Map<keyof AppEventMap, Set<EventHandler<unknown>>>();

  public on<TEvent extends keyof AppEventMap>(
    eventName: TEvent,
    handler: EventHandler<AppEventMap[TEvent]>
  ): () => void {
    const handlers = this.listeners.get(eventName) ?? new Set<EventHandler<unknown>>();
    handlers.add(handler as EventHandler<unknown>);
    this.listeners.set(eventName, handlers);

    return () => {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  public emit<TEvent extends keyof AppEventMap>(eventName: TEvent, payload: AppEventMap[TEvent]): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      (handler as EventHandler<AppEventMap[TEvent]>)(payload);
    }
  }
}
