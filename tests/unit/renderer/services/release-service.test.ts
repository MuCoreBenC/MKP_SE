import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';
import { ReleaseService } from '../../../../src/renderer/app/services/release-service';
import { SchemaValidationService } from '../../../../src/renderer/app/services/schema-validation-service';

describe('ReleaseService', () => {
  it('validates release config before preparation', () => {
    const service = new ReleaseService(new SchemaValidationService(), new AppEventBus());

    expect(
      service.prepareReleaseConfig({
        version: '0.2.10',
        releaseDate: '2026-03-15',
        shortDesc: 'Release',
        releaseNotesMarkdown: '# 0.2.10',
        updateType: 'hot_update',
        forceUpdate: false,
        canRollback: true,
        selectedBuildMode: 2
      }).version
    ).toBe('0.2.10');
  });

  it('rejects invalid release config payloads', () => {
    const service = new ReleaseService(new SchemaValidationService(), new AppEventBus());

    expect(() => service.prepareReleaseConfig({ version: '0.2.10' })).toThrow(/Invalid release config/);
  });

  it('emits a release preparation signal', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('sync:message-received', listener);
    const service = new ReleaseService(new SchemaValidationService(), bus);

    service.prepareReleaseConfig({
      version: '0.2.10',
      releaseDate: '2026-03-15',
      shortDesc: 'Release',
      releaseNotesMarkdown: '# 0.2.10',
      updateType: 'hot_update',
      forceUpdate: false,
      canRollback: true,
      selectedBuildMode: 2
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'release-config-prepared',
      sourceWindowId: 'release-service'
    });
  });

  it('accepts all supported build modes', () => {
    const service = new ReleaseService(new SchemaValidationService(), new AppEventBus());

    expect(
      service.prepareReleaseConfig({
        version: '0.2.10',
        releaseDate: '2026-03-16',
        shortDesc: 'Hotfix',
        releaseNotesMarkdown: '',
        updateType: 'full_installer',
        forceUpdate: true,
        canRollback: false,
        selectedBuildMode: 4
      }).selectedBuildMode
    ).toBe(4);
  });

  it('does not emit release events when validation fails', () => {
    const bus = new AppEventBus();
    const listener = vi.fn();
    bus.on('sync:message-received', listener);
    const service = new ReleaseService(new SchemaValidationService(), bus);

    expect(() =>
      service.prepareReleaseConfig({
        version: '0.2.10',
        releaseDate: '2026-03-16',
        shortDesc: 'Broken payload',
        releaseNotesMarkdown: '',
        updateType: 'hot_update',
        forceUpdate: false,
        canRollback: false,
        selectedBuildMode: 5
      })
    ).toThrow(/Invalid release config/);

    expect(listener).not.toHaveBeenCalled();
  });
});
