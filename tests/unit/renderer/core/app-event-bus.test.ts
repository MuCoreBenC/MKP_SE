import { describe, expect, it, vi } from 'vitest';

import { AppEventBus } from '../../../../src/renderer/app/core/app-event-bus';

describe('AppEventBus', () => {
  it('subscribes, emits and unsubscribes typed events', () => {
    const bus = new AppEventBus();
    const handler = vi.fn();

    const off = bus.on('preset:applied', handler);
    bus.emit('preset:applied', {
      contextKey: 'a1_standard',
      activeFileName: 'a1_standard_v3.0.0-r1.json',
      resolvedVersion: '3.0.0-r1'
    });
    off();
    bus.emit('preset:applied', {
      contextKey: 'a1_standard',
      activeFileName: 'a1_standard_v3.0.0-r2.json',
      resolvedVersion: '3.0.0-r2'
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      contextKey: 'a1_standard',
      activeFileName: 'a1_standard_v3.0.0-r1.json',
      resolvedVersion: '3.0.0-r1'
    });
  });
});
