import { describe, expect, it } from 'vitest';

import { UpdateStore } from '../../../../src/renderer/app/stores/update-store';

describe('UpdateStore', () => {
  it('keeps local current version separate from remote manifest state', () => {
    const store = new UpdateStore('0.2.10');

    store.setRemoteState('0.2.11', true, {
      latestVersion: '0.2.11',
      updateType: 'hot_update',
      downloadUrl: 'https://example.com/patch.zip',
      forceUpdate: false,
      releaseDate: '2026-03-15',
      shortDesc: 'Bug fixes',
      canRollback: true,
      releaseNotes: [],
      releaseNotesMarkdown: '',
      history: []
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.currentVersion).toBe('0.2.10');
    expect(snapshot.latestVersion).toBe('0.2.11');
    expect(snapshot.hasUpdate).toBe(true);
    expect(snapshot.remoteManifest?.latestVersion).toBe('0.2.11');
  });

  it('returns a defensive copy of the remote manifest snapshot', () => {
    const store = new UpdateStore('0.2.10');

    store.setRemoteState('0.2.11', true, {
      latestVersion: '0.2.11',
      updateType: 'hot_update',
      downloadUrl: 'https://example.com/patch.zip',
      forceUpdate: false,
      releaseDate: '2026-03-15',
      shortDesc: 'Bug fixes',
      canRollback: true,
      releaseNotes: [],
      releaseNotesMarkdown: '',
      history: []
    });

    const snapshot = store.getSnapshot();
    if (!snapshot.remoteManifest) {
      throw new Error('Expected remote manifest to exist.');
    }

    snapshot.remoteManifest.latestVersion = '9.9.9';

    expect(store.getSnapshot().remoteManifest?.latestVersion).toBe('0.2.11');
  });
});
