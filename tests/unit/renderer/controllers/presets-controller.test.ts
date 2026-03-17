import { describe, expect, it, vi } from 'vitest';

import { PresetsController } from '../../../../src/renderer/app/controllers/presets-controller';

describe('PresetsController', () => {
  it('returns preset list from preset service', () => {
    const controller = new PresetsController({
      listAvailablePresets: () => [{ fileName: 'a1_standard.json' }]
    } as never);

    expect(controller.getPresetList('a1', 'standard')).toEqual([{ fileName: 'a1_standard.json' }]);
  });

  it('returns active preset from preset service', () => {
    const controller = new PresetsController({
      getResolvedActivePreset: () => ({ fileName: 'a1_standard.json' })
    } as never);

    expect(controller.getActivePreset('a1', 'standard')).toEqual({ fileName: 'a1_standard.json' });
  });

  it('forwards printer context to preset listing service', () => {
    const listAvailablePresets = vi.fn(() => []);
    const controller = new PresetsController({
      listAvailablePresets,
      getResolvedActivePreset: vi.fn()
    } as never);

    controller.getPresetList('a1', 'quick');

    expect(listAvailablePresets).toHaveBeenCalledWith('a1', 'quick');
  });
});
