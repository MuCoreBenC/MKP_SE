import { AppEventBus } from '../core/app-event-bus';
import { ParamEditorStore, type ParamEditorMode, type ParamEditorSnapshot } from '../stores/param-editor-store';

export class ParamEditorService {
  public constructor(
    private readonly paramEditorStore: ParamEditorStore,
    private readonly eventBus: AppEventBus
  ) {}

  public loadPreset(presetPath: string, snapshot: Record<string, unknown>): ParamEditorSnapshot {
    return this.paramEditorStore.load(presetPath, snapshot);
  }

  public updateDraft(snapshot: Record<string, unknown>): ParamEditorSnapshot {
    return this.paramEditorStore.updateSnapshot(snapshot);
  }

  public switchMode(mode: ParamEditorMode): ParamEditorSnapshot {
    return this.paramEditorStore.setMode(mode);
  }

  public save(): ParamEditorSnapshot {
    const snapshot = this.paramEditorStore.save();
    this.eventBus.emit('preset:content-updated', {
      contextKey: snapshot.presetPath ?? 'unknown',
      reason: 'params-saved'
    });
    return snapshot;
  }

  public restoreDefaults(defaultSnapshot: Record<string, unknown>): ParamEditorSnapshot {
    this.paramEditorStore.load(this.paramEditorStore.getSnapshot().presetPath ?? 'unknown', defaultSnapshot);
    const snapshot = this.paramEditorStore.save();
    this.eventBus.emit('preset:content-updated', {
      contextKey: snapshot.presetPath ?? 'unknown',
      reason: 'params-restored-defaults'
    });
    return snapshot;
  }

  public notifyExternalMutation(timestamp: number): ParamEditorSnapshot {
    return this.paramEditorStore.markExternalMutation(timestamp);
  }
}
