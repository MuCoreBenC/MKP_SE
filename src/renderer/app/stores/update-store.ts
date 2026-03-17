import type { AppManifestSchema } from '../schemas/app-manifest-schema';

export interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  remoteManifest: AppManifestSchema | null;
  remoteCheckedAt: string | null;
}

export class UpdateStore {
  private state: UpdateState;

  public constructor(currentVersion: string) {
    this.state = {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      remoteManifest: null,
      remoteCheckedAt: null
    };
  }

  public getSnapshot(): UpdateState {
    return {
      ...this.state,
      remoteManifest: this.state.remoteManifest ? { ...this.state.remoteManifest } : null
    };
  }

  public setRemoteState(latestVersion: string, hasUpdate: boolean, remoteManifest: AppManifestSchema): UpdateState {
    this.state = {
      ...this.state,
      latestVersion,
      hasUpdate,
      remoteManifest,
      remoteCheckedAt: new Date().toISOString()
    };

    return this.getSnapshot();
  }
}
