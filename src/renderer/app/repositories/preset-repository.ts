import { compareVersions } from '../core/version';
import { extractPresetMeta, type PresetContent, type VersionType } from '../core/preset';
import { presetSchema } from '../schemas/preset-schema';
import { SchemaValidationService } from '../services/schema-validation-service';

export type StorageLayer = 'builtin' | 'user';

export interface PresetRecord {
  fileName: string;
  absolutePath: string;
  storageLayer: StorageLayer;
  content: PresetContent;
}

export interface PresetDataSource {
  list(): PresetRecord[];
  write(record: PresetRecord): void;
}

export class PresetRepository {
  public constructor(
    private readonly builtinSource: PresetDataSource,
    private readonly userSource: PresetDataSource,
    private readonly schemaValidationService = new SchemaValidationService()
  ) {}

  public listByContext(printerId: string, versionType: VersionType): PresetRecord[] {
    return [...this.builtinSource.list(), ...this.userSource.list()]
      .filter((record) => {
        const content = this.schemaValidationService.parse(presetSchema, record.content, 'Invalid preset content');
        const meta = extractPresetMeta(record.fileName, content);
        return meta.printerId === printerId && meta.versionType === versionType;
      })
      .sort((left, right) => {
        const leftMeta = extractPresetMeta(
          left.fileName,
          this.schemaValidationService.parse(presetSchema, left.content, 'Invalid preset content')
        );
        const rightMeta = extractPresetMeta(
          right.fileName,
          this.schemaValidationService.parse(presetSchema, right.content, 'Invalid preset content')
        );

        const versionCompare = compareVersions(rightMeta.contentVersion, leftMeta.contentVersion);
        if (versionCompare !== 0) {
          return versionCompare;
        }

        if (left.storageLayer === right.storageLayer) {
          return left.fileName.localeCompare(right.fileName);
        }

        return left.storageLayer === 'user' ? -1 : 1;
      });
  }

  public resolveActivePreset(printerId: string, versionType: VersionType, fileName: string): PresetRecord | null {
    return this.listByContext(printerId, versionType).find((record) => record.fileName === fileName) ?? null;
  }

  public saveUserPreset(record: Omit<PresetRecord, 'storageLayer'>): PresetRecord {
    const content = this.schemaValidationService.parse(presetSchema, record.content, 'Invalid preset content');
    const nextRecord: PresetRecord = {
      ...record,
      content,
      storageLayer: 'user'
    };

    this.userSource.write(nextRecord);
    return nextRecord;
  }
}
