import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { ParamEditorService } from '../../../../src/renderer/app/services/param-editor-service';
import { ParamEditorStore } from '../../../../src/renderer/app/stores/param-editor-store';

describe('ParamEditorService', () => {
  it('emits content update when saving edited params', () => {
    const eventBus = new AppEventBus();
    const listener = vi.fn();
    eventBus.on('preset:content-updated', listener);

    const service = new ParamEditorService(new ParamEditorStore(), eventBus);
    service.loadPreset('C:\\preset.json', { toolhead: { offset: { z: 3.8 } } });
    service.updateDraft({ toolhead: { offset: { z: 4 } } });
    const snapshot = service.save();

    expect(snapshot.dirty).toBe(false);
    expect(listener).toHaveBeenCalledWith({
      contextKey: 'C:\\preset.json',
      reason: 'params-saved'
    });
  });

  it('marks external mutation without overwriting current draft', () => {
    const service = new ParamEditorService(new ParamEditorStore(), new AppEventBus());

    service.loadPreset('C:\\preset.json', { a: 1 });
    service.updateDraft({ a: 2 });
    const snapshot = service.notifyExternalMutation(1710000000000);

    expect(snapshot.currentSnapshot).toEqual({ a: 2 });
    expect(snapshot.lastExternalMutationAt).toBe(1710000000000);
    expect(snapshot.dirty).toBe(true);
  });

  it('restores defaults using the current preset path and emits a restore event', () => {
    const eventBus = new AppEventBus();
    const listener = vi.fn();
    eventBus.on('preset:content-updated', listener);

    const service = new ParamEditorService(new ParamEditorStore(), eventBus);
    service.loadPreset('C:\\preset.json', { toolhead: { offset: { z: 3.8 } } });
    service.updateDraft({ toolhead: { offset: { z: 4.2 } } });

    const snapshot = service.restoreDefaults({ toolhead: { offset: { z: 3.5 } } });

    expect(snapshot.presetPath).toBe('C:\\preset.json');
    expect(snapshot.currentSnapshot).toEqual({ toolhead: { offset: { z: 3.5 } } });
    expect(snapshot.savedSnapshot).toEqual({ toolhead: { offset: { z: 3.5 } } });
    expect(snapshot.dirty).toBe(false);
    expect(listener).toHaveBeenCalledWith({
      contextKey: 'C:\\preset.json',
      reason: 'params-restored-defaults'
    });
  });
});
