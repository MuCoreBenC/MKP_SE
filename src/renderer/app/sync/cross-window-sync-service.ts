import { AppEventBus } from '../core/app-event-bus';

export interface SyncMessage<TPayload = Record<string, unknown>> {
  type: string;
  sourceWindowId: string;
  timestamp: number;
  payload: TPayload;
}

export interface StorageLike {
  setItem(key: string, value: string): void;
}

export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
}

export const SYNC_KEYS = {
  userConfig: 'mkp:config:user',
  activeContext: 'mkp:context:active',
  activePresetByContext: 'mkp:preset:active-by-context',
  presetMutationSignal: 'mkp:signal:preset-mutation',
  updateState: 'mkp:update:state'
} as const;

export class CrossWindowSyncService {
  public constructor(
    private readonly storage: StorageLike,
    private readonly eventBus: AppEventBus,
    private readonly windowId: string
  ) {}

  public broadcast<TPayload>(key: string, message: SyncMessage<TPayload>): void {
    this.storage.setItem(key, JSON.stringify(message));
  }

  public createMessage<TPayload>(type: string, payload: TPayload): SyncMessage<TPayload> {
    return {
      type,
      sourceWindowId: this.windowId,
      timestamp: Date.now(),
      payload
    };
  }

  public handleStorageEvent(event: StorageEventLike): SyncMessage | null {
    if (!event.key || !event.newValue) {
      return null;
    }

    const message = this.parseMessage(event.newValue);
    if (!message || message.sourceWindowId === this.windowId) {
      return null;
    }

    this.eventBus.emit('sync:message-received', {
      type: message.type,
      sourceWindowId: message.sourceWindowId
    });

    if (event.key === SYNC_KEYS.presetMutationSignal) {
      const payload = message.payload as { contextKey?: string; reason?: string };
      this.eventBus.emit('preset:content-updated', {
        contextKey: payload.contextKey ?? 'unknown',
        sourceWindowId: message.sourceWindowId,
        reason: payload.reason ?? 'external-update'
      });
    }

    if (event.key === SYNC_KEYS.activeContext) {
      const payload = message.payload as {
        brandId?: string;
        printerId?: string;
        versionType?: string;
        contextKey?: string;
      };
      this.eventBus.emit('context:changed', {
        brandId: payload.brandId ?? 'unknown',
        printerId: payload.printerId ?? 'unknown',
        versionType: payload.versionType ?? 'standard',
        contextKey: payload.contextKey ?? 'unknown'
      });
    }

    if (event.key === SYNC_KEYS.updateState) {
      const payload = message.payload as {
        currentVersion?: string;
        latestVersion?: string;
        hasUpdate?: boolean;
      };
      this.eventBus.emit('update:state-changed', {
        currentVersion: payload.currentVersion ?? 'unknown',
        latestVersion: payload.latestVersion ?? 'unknown',
        hasUpdate: payload.hasUpdate ?? false
      });
    }

    return message;
  }

  private parseMessage(rawValue: string): SyncMessage | null {
    try {
      const parsed = JSON.parse(rawValue) as SyncMessage;
      if (!parsed || typeof parsed.type !== 'string' || typeof parsed.sourceWindowId !== 'string') {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }
}
