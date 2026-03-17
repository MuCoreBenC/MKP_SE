import { presetSchema, type PresetSchema } from '../schemas/preset-schema';
import { SchemaValidationService } from '../services/schema-validation-service';

export interface DefaultPresetRecord {
  fileName: string;
  content: PresetSchema;
}

export interface DefaultResourceDataSource {
  readPreset(fileName: string): DefaultPresetRecord;
  writePreset(record: DefaultPresetRecord): void;
}

export class DefaultResourceRepository {
  public constructor(
    private readonly dataSource: DefaultResourceDataSource,
    private readonly schemaValidationService = new SchemaValidationService()
  ) {}

  public readPreset(fileName: string): DefaultPresetRecord {
    const record = this.dataSource.readPreset(fileName);
    return {
      ...record,
      content: this.schemaValidationService.parse(presetSchema, record.content, 'Invalid default preset content')
    };
  }

  public savePreset(record: DefaultPresetRecord): DefaultPresetRecord {
    const validated: DefaultPresetRecord = {
      ...record,
      content: this.schemaValidationService.parse(presetSchema, record.content, 'Invalid default preset content')
    };

    this.dataSource.writePreset(validated);
    return validated;
  }
}
