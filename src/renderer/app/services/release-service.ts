import { AppEventBus } from '../core/app-event-bus';
import { releaseConfigSchema, type ReleaseConfigSchema } from '../schemas/release-config-schema';
import { SchemaValidationService } from './schema-validation-service';

export class ReleaseService {
  public constructor(
    private readonly schemaValidationService: SchemaValidationService,
    private readonly eventBus: AppEventBus
  ) {}

  public validateReleaseConfig(config: unknown): ReleaseConfigSchema {
    return this.schemaValidationService.parse(releaseConfigSchema, config, 'Invalid release config');
  }

  public prepareReleaseConfig(config: unknown): ReleaseConfigSchema {
    const validated = this.validateReleaseConfig(config);
    this.eventBus.emit('sync:message-received', {
      type: 'release-config-prepared',
      sourceWindowId: 'release-service'
    });
    return validated;
  }
}
