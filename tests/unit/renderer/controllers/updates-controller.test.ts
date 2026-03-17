import { describe, expect, it, vi } from 'vitest';

import { UpdatesController } from '../../../../src/renderer/app/controllers/updates-controller';

describe('UpdatesController', () => {
  it('delegates update checks to the update service', () => {
    const checkForUpdates = vi.fn(() => ({ hasUpdate: true }));
    const controller = new UpdatesController({ checkForUpdates } as never);

    expect(controller.check('0.2.10', { latestVersion: '0.2.11' })).toEqual({ hasUpdate: true });
    expect(checkForUpdates).toHaveBeenCalledWith('0.2.10', { latestVersion: '0.2.11' });
  });

  it('parses manifests through the update service', () => {
    const parseManifest = vi.fn(() => ({ latestVersion: '0.2.11' }));
    const controller = new UpdatesController({ checkForUpdates: vi.fn(), parseManifest } as never);

    expect(controller.parseManifest({ latestVersion: '0.2.11' })).toEqual({ latestVersion: '0.2.11' });
    expect(parseManifest).toHaveBeenCalledWith({ latestVersion: '0.2.11' });
  });

  it('preserves update service errors during checks', () => {
    const error = new Error('manifest unavailable');
    const controller = new UpdatesController({
      checkForUpdates: vi.fn(() => {
        throw error;
      }),
      parseManifest: vi.fn()
    } as never);

    expect(() => controller.check('0.2.10', { latestVersion: '0.2.11' })).toThrow(error);
  });
});
