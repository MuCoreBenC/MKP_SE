import { createSnapshotHash } from '../utils/snapshot';

export type ParamEditorMode = 'structured' | 'text';

export interface ParamEditorFocus {
  type: 'field' | 'text';
  key: string;
}

export interface ParamEditorSnapshot {
  presetPath: string | null;
  mode: ParamEditorMode;
  dirty: boolean;
  currentSnapshot: Record<string, unknown>;
  savedSnapshot: Record<string, unknown>;
  currentSnapshotHash: string;
  savedSnapshotHash: string;
  historyIndex: number;
  historyLength: number;
  lastFocus: ParamEditorFocus | null;
  lastExternalMutationAt: number | null;
}

function cloneSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
}

function buildState(
  presetPath: string | null,
  currentSnapshot: Record<string, unknown>,
  savedSnapshot: Record<string, unknown>,
  history: Array<Record<string, unknown>>,
  historyIndex: number,
  mode: ParamEditorMode,
  lastFocus: ParamEditorFocus | null,
  lastExternalMutationAt: number | null
): ParamEditorSnapshot {
  const currentSnapshotHash = createSnapshotHash(currentSnapshot);
  const savedSnapshotHash = createSnapshotHash(savedSnapshot);

  return {
    presetPath,
    mode,
    dirty: currentSnapshotHash !== savedSnapshotHash,
    currentSnapshot,
    savedSnapshot,
    currentSnapshotHash,
    savedSnapshotHash,
    historyIndex,
    historyLength: history.length,
    lastFocus,
    lastExternalMutationAt
  };
}

export class ParamEditorStore {
  private presetPath: string | null = null;
  private mode: ParamEditorMode = 'structured';
  private lastFocus: ParamEditorFocus | null = null;
  private lastExternalMutationAt: number | null = null;
  private savedSnapshot: Record<string, unknown> = {};
  private history: Array<Record<string, unknown>> = [this.savedSnapshot];
  private historyIndex = 0;

  public load(presetPath: string, snapshot: Record<string, unknown>): ParamEditorSnapshot {
    this.presetPath = presetPath;
    this.savedSnapshot = cloneSnapshot(snapshot);
    this.history = [cloneSnapshot(snapshot)];
    this.historyIndex = 0;
    this.lastExternalMutationAt = null;

    return this.getSnapshot();
  }

  public updateSnapshot(snapshot: Record<string, unknown>): ParamEditorSnapshot {
    const nextSnapshot = cloneSnapshot(snapshot);
    const currentSnapshotHash = createSnapshotHash(this.history[this.historyIndex]);
    const nextSnapshotHash = createSnapshotHash(nextSnapshot);

    if (currentSnapshotHash === nextSnapshotHash) {
      return this.getSnapshot();
    }

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(nextSnapshot);
    this.historyIndex = this.history.length - 1;

    return this.getSnapshot();
  }

  public save(): ParamEditorSnapshot {
    this.savedSnapshot = cloneSnapshot(this.history[this.historyIndex]);
    return this.getSnapshot();
  }

  public restoreSavedSnapshot(): ParamEditorSnapshot {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(cloneSnapshot(this.savedSnapshot));
    this.historyIndex = this.history.length - 1;
    return this.getSnapshot();
  }

  public undo(): ParamEditorSnapshot {
    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
    }

    return this.getSnapshot();
  }

  public redo(): ParamEditorSnapshot {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
    }

    return this.getSnapshot();
  }

  public setMode(mode: ParamEditorMode): ParamEditorSnapshot {
    this.mode = mode;
    return this.getSnapshot();
  }

  public setFocus(focus: ParamEditorFocus | null): ParamEditorSnapshot {
    this.lastFocus = focus;
    return this.getSnapshot();
  }

  public markExternalMutation(timestamp: number): ParamEditorSnapshot {
    this.lastExternalMutationAt = timestamp;
    return this.getSnapshot();
  }

  public getSnapshot(): ParamEditorSnapshot {
    return buildState(
      this.presetPath,
      cloneSnapshot(this.history[this.historyIndex]),
      cloneSnapshot(this.savedSnapshot),
      this.history,
      this.historyIndex,
      this.mode,
      this.lastFocus,
      this.lastExternalMutationAt
    );
  }
}
