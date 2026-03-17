import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import {
  DefaultResourceRepository,
  type DefaultResourceDataSource
} from '../../../../src/renderer/app/repositories/default-resource-repository';
import { DefaultResourceService } from '../../../../src/renderer/app/services/default-resource-service';

describe('DefaultResourceService', () => {
  it('reads default presets through the repository', () => {
    const dataSource: DefaultResourceDataSource = {
      readPreset: () => ({
        fileName: 'a1_standard.json',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
      }),
      writePreset: vi.fn()
    };
    const service = new DefaultResourceService(new DefaultResourceRepository(dataSource), new AppEventBus());

    expect(service.readDefaultPreset('a1_standard.json').fileName).toBe('a1_standard.json');
  });

  it('emits update signal after saving default preset', () => {
    const dataSource: DefaultResourceDataSource = {
      readPreset: vi.fn(),
      writePreset: vi.fn()
    };
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('preset:content-updated', listener);
    const service = new DefaultResourceService(new DefaultResourceRepository(dataSource), bus);

    service.saveDefaultPreset({
      fileName: 'a1_standard.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
    });

    expect(listener).toHaveBeenCalledWith({
      contextKey: 'a1_standard.json',
      reason: 'default-resource-saved'
    });
  });

  it('returns the repository result when saving a default preset', () => {
    const savedRecord = {
      fileName: 'a1_standard.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r2' }
    } as const;
    const dataSource: DefaultResourceDataSource = {
      readPreset: vi.fn(),
      writePreset: vi.fn(() => savedRecord)
    };
    const service = new DefaultResourceService(new DefaultResourceRepository(dataSource), new AppEventBus());

    expect(service.saveDefaultPreset(savedRecord)).toEqual(savedRecord);
  });
});
