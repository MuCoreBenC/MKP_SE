import { describe, expect, it } from 'vitest';

import { ParamEditorStore } from '../../../../src/renderer/app/stores/param-editor-store';

describe('ParamEditorStore', () => {
  it('keeps one shared truth across mode switches and tracks dirty state', () => {
    const store = new ParamEditorStore();

    store.load('C:\\preset.json', { toolhead: { offset: { z: 3.8 } } });
    store.updateSnapshot({ toolhead: { offset: { z: 4 } } });
    const snapshot = store.setMode('text');

    expect(snapshot.mode).toBe('text');
    expect(snapshot.dirty).toBe(true);
    expect(snapshot.currentSnapshot).toEqual({ toolhead: { offset: { z: 4 } } });
    expect(snapshot.savedSnapshot).toEqual({ toolhead: { offset: { z: 3.8 } } });
  });

  it('supports undo redo and save over the same history line', () => {
    const store = new ParamEditorStore();

    store.load('C:\\preset.json', { a: 1 });
    store.updateSnapshot({ a: 2 });
    store.updateSnapshot({ a: 3 });

    expect(store.undo().currentSnapshot).toEqual({ a: 2 });
    expect(store.redo().currentSnapshot).toEqual({ a: 3 });
    expect(store.save().dirty).toBe(false);
  });

  it('restores the saved snapshot as a new history entry', () => {
    const store = new ParamEditorStore();

    store.load('C:\\preset.json', { a: 1 });
    store.updateSnapshot({ a: 2 });
    store.save();
    store.updateSnapshot({ a: 3 });

    const snapshot = store.restoreSavedSnapshot();

    expect(snapshot.currentSnapshot).toEqual({ a: 2 });
    expect(snapshot.savedSnapshot).toEqual({ a: 2 });
    expect(snapshot.dirty).toBe(false);
    expect(snapshot.historyLength).toBe(4);
  });
});
