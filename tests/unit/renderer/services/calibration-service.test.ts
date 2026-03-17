import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { CalibrationService } from '../../../../src/renderer/app/services/calibration-service';

describe('CalibrationService', () => {
  it('extracts x y z offsets from the active preset content', () => {
    const service = new CalibrationService(new AppEventBus());

    const offsets = service.extractOffsets('C:\\preset.json', {
      version: '3.0.0-r1',
      toolhead: {
        offset: {
          x: 0.1,
          y: -0.2,
          z: 3.8
        }
      }
    });

    expect(offsets.x).toBe(0.1);
    expect(offsets.y).toBe(-0.2);
    expect(offsets.z).toBe(3.8);
    expect(offsets.sourcePresetPath).toBe('C:\\preset.json');
    expect(offsets.sourceVersion).toBe('3.0.0-r1');
  });

  it('writes calibration offsets back and emits content updated event', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('preset:content-updated', listener);
    const service = new CalibrationService(bus);

    const result = service.applyOffsets(
      'C:\\preset.json',
      {
        toolhead: {
          offset: {
            x: 0,
            y: 0,
            z: 3.5
          }
        }
      },
      {
        x: 0.3,
        y: 0.4,
        z: 4.1
      }
    );

    expect(result.presetContent).toEqual({
      toolhead: {
        offset: {
          x: 0.3,
          y: 0.4,
          z: 4.1
        }
      }
    });
    expect(result.offsets.z).toBe(4.1);
    expect(listener).toHaveBeenCalledWith({
      contextKey: 'C:\\preset.json',
      reason: 'calibration-updated'
    });
  });

  it('is disabled when preset context is incomplete', () => {
    const service = new CalibrationService(new AppEventBus());

    expect(service.isAvailable({ printerId: 'a1', versionType: 'standard', presetPath: 'C:\\preset.json' })).toBe(true);
    expect(service.isAvailable({ printerId: 'a1', versionType: null, presetPath: 'C:\\preset.json' })).toBe(false);
    expect(service.isAvailable({ printerId: null, versionType: 'standard', presetPath: 'C:\\preset.json' })).toBe(false);
  });

  it('falls back to zero when offset values are missing or invalid', () => {
    const service = new CalibrationService(new AppEventBus());

    const offsets = service.extractOffsets('C:\\preset.json', {
      toolhead: {
        offset: {
          x: 'bad',
          y: null,
          z: Number.NaN
        }
      }
    });

    expect(offsets.x).toBe(0);
    expect(offsets.y).toBe(0);
    expect(offsets.z).toBe(0);
  });
});
