import { describe, expect, it, vi } from 'vitest';

import { ParamsController } from '../../../../src/renderer/app/controllers/params-controller';

describe('ParamsController', () => {
  it('loads editor state through the param editor service', () => {
    const loadPreset = vi.fn(() => ({ presetPath: 'C:\\preset.json' }));
    const controller = new ParamsController({ loadPreset, save: vi.fn() } as never);

    expect(controller.loadEditor('C:\\preset.json', { a: 1 })).toEqual({ presetPath: 'C:\\preset.json' });
    expect(loadPreset).toHaveBeenCalledWith('C:\\preset.json', { a: 1 });
  });

  it('saves editor state through the param editor service', () => {
    const save = vi.fn(() => ({ dirty: false }));
    const controller = new ParamsController({ loadPreset: vi.fn(), save } as never);

    expect(controller.saveEditor()).toEqual({ dirty: false });
    expect(save).toHaveBeenCalled();
  });

  it('preserves the editor service error when save fails', () => {
    const error = new Error('disk full');
    const controller = new ParamsController({ loadPreset: vi.fn(), save: vi.fn(() => {
      throw error;
    }) } as never);

    expect(() => controller.saveEditor()).toThrow(error);
  });
});
