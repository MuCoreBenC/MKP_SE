import { describe, expect, it, vi } from 'vitest';

import { PresetRepository, type PresetDataSource } from '../../../../src/renderer/app/repositories/preset-repository';

function createSource(records: PresetDataSource['list'] extends () => infer T ? T : never) {
  const state = [...records];

  return {
    state,
    source: {
      list: vi.fn(() => [...state]),
      write: vi.fn((record) => {
        state.push(record);
      })
    } satisfies PresetDataSource
  };
}

describe('PresetRepository', () => {
  it('lists presets by context and prioritizes version over filename', () => {
    const builtin = createSource([
      {
        fileName: 'z-name.json',
        absolutePath: 'builtin/z-name.json',
        storageLayer: 'builtin',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
      }
    ]);
    const user = createSource([
      {
        fileName: 'a-name.json',
        absolutePath: 'user/a-name.json',
        storageLayer: 'user',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r2' }
      }
    ]);
    const repository = new PresetRepository(builtin.source, user.source);

    const result = repository.listByContext('a1', 'standard');

    expect(result.map((item) => item.fileName)).toEqual(['a-name.json', 'z-name.json']);
  });

  it('resolves active preset from builtin and user layers', () => {
    const builtin = createSource([
      {
        fileName: 'a1_standard_v3.0.0-r1.json',
        absolutePath: 'builtin/a1_standard_v3.0.0-r1.json',
        storageLayer: 'builtin',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
      }
    ]);
    const user = createSource([]);
    const repository = new PresetRepository(builtin.source, user.source);

    expect(repository.resolveActivePreset('a1', 'standard', 'a1_standard_v3.0.0-r1.json')?.absolutePath).toBe(
      'builtin/a1_standard_v3.0.0-r1.json'
    );
  });

  it('writes saved presets into the user layer only', () => {
    const builtin = createSource([]);
    const user = createSource([]);
    const repository = new PresetRepository(builtin.source, user.source);

    const saved = repository.saveUserPreset({
      fileName: 'custom.json',
      absolutePath: 'user/custom.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r3' }
    });

    expect(saved.storageLayer).toBe('user');
    expect(user.source.write).toHaveBeenCalledWith(saved);
    expect(builtin.source.write).not.toHaveBeenCalled();
  });
});
