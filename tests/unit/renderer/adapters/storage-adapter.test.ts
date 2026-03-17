import { describe, expect, it, vi } from 'vitest';

import { StorageAdapter, type KeyValueStorageLike } from '../../../../src/renderer/app/adapters/storage-adapter';

describe('StorageAdapter', () => {
  it('reads fallback when key does not exist or json is invalid', () => {
    const storage: KeyValueStorageLike = {
      getItem: vi.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('{broken'),
      setItem: vi.fn()
    };
    const adapter = new StorageAdapter(storage);

    expect(adapter.readJson('missing', { ok: true })).toEqual({ ok: true });
    expect(adapter.readJson('broken', { ok: true })).toEqual({ ok: true });
  });

  it('writes serialized json payloads', () => {
    const storage: KeyValueStorageLike = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };
    const adapter = new StorageAdapter(storage);

    adapter.writeJson('mkp:test', { a: 1 });

    expect(storage.setItem).toHaveBeenCalledWith('mkp:test', JSON.stringify({ a: 1 }));
  });

  it('returns parsed json payload when stored data is valid', () => {
    const storage: KeyValueStorageLike = {
      getItem: vi.fn(() => JSON.stringify({ ok: true, count: 2 })),
      setItem: vi.fn()
    };
    const adapter = new StorageAdapter(storage);

    expect(adapter.readJson('mkp:test', { ok: false, count: 0 })).toEqual({ ok: true, count: 2 });
  });
});
