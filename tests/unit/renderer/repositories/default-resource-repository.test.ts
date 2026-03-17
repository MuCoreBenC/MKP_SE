import { describe, expect, it, vi } from 'vitest';

import {
  DefaultResourceRepository,
  type DefaultResourceDataSource
} from '../../../../src/renderer/app/repositories/default-resource-repository';
import type { PresetSchema } from '../../../../src/renderer/app/schemas/preset-schema';

describe('DefaultResourceRepository', () => {
  it('reads and validates default preset content from the default layer', () => {
    const dataSource: DefaultResourceDataSource = {
      readPreset: vi.fn(() => ({
        fileName: 'a1_standard.json',
        content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' } satisfies PresetSchema
      })),
      writePreset: vi.fn()
    };
    const repository = new DefaultResourceRepository(dataSource);

    expect(repository.readPreset('a1_standard.json').content.version).toBe('3.0.0-r1');
  });

  it('only persists valid default preset payloads into the default resource layer', () => {
    const dataSource: DefaultResourceDataSource = {
      readPreset: vi.fn(),
      writePreset: vi.fn()
    };
    const repository = new DefaultResourceRepository(dataSource);

    repository.savePreset({
      fileName: 'a1_standard.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' } satisfies PresetSchema
    });

    expect(dataSource.writePreset).toHaveBeenCalledWith({
      fileName: 'a1_standard.json',
      content: { printer: 'a1', type: 'standard', version: '3.0.0-r1' }
    });
    expect(() =>
      repository.savePreset({
        fileName: 'broken.json',
        content: { printer: 'a1', type: 'broken' } as unknown as PresetSchema
      })
    ).toThrow(/Invalid default preset content/);
  });

  it('returns validated preset content when reading from the default layer', () => {
    const dataSource: DefaultResourceDataSource = {
      readPreset: vi.fn(() => ({
        fileName: 'a1_standard.json',
        content: {
          printer: 'a1',
          type: 'standard',
          version: '3.0.0-r1',
          extraField: 'kept'
        } satisfies PresetSchema
      })),
      writePreset: vi.fn()
    };
    const repository = new DefaultResourceRepository(dataSource);

    expect(repository.readPreset('a1_standard.json')).toEqual({
      fileName: 'a1_standard.json',
      content: {
        printer: 'a1',
        type: 'standard',
        version: '3.0.0-r1',
        extraField: 'kept'
      }
    });
  });
});
