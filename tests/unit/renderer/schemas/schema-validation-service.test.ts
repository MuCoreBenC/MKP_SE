import { describe, expect, it } from 'vitest';

import { presetSchema } from '../../../../src/renderer/app/schemas/preset-schema';
import { userConfigSchema } from '../../../../src/renderer/app/schemas/user-config-schema';
import { SchemaValidationService } from '../../../../src/renderer/app/services/schema-validation-service';

describe('SchemaValidationService', () => {
  it('accepts valid user config and preset payloads', () => {
    const service = new SchemaValidationService();

    expect(
      service.parse(userConfigSchema, {
        selectedBrandId: 'bambu',
        selectedPrinterId: 'a1',
        selectedVersionType: 'standard',
        appliedPresetByContext: {},
        onboardingEnabled: true,
        updateMode: 'manual',
        themeMode: 'system',
        dockAnimationEnabled: true,
        dockBaseSize: 38,
        dockMaxScale: 1.5,
        updatedAt: '2026-03-15T00:00:00.000Z'
      }, 'Invalid user config').selectedPrinterId
    ).toBe('a1');

    expect(
      service.parse(presetSchema, {
        printer: 'a1',
        type: 'standard',
        version: '3.0.0-r1',
        toolhead: { offset: { x: 0, y: 0, z: 3.8 } }
      }, 'Invalid preset content').version
    ).toBe('3.0.0-r1');
  });

  it('rejects invalid schema payloads before business logic runs', () => {
    const service = new SchemaValidationService();

    expect(() => service.parse(userConfigSchema, { selectedPrinterId: 'a1' }, 'Invalid user config')).toThrow(
      /Invalid user config/
    );
    expect(() => service.parse(presetSchema, { printer: 'a1', type: 'broken' }, 'Invalid preset content')).toThrow(
      /Invalid preset content/
    );
  });
});
