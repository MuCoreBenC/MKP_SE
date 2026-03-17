import { AppEventBus } from '../core/app-event-bus';
import {
  DefaultResourceRepository,
  type DefaultPresetRecord
} from '../repositories/default-resource-repository';

export class DefaultResourceService {
  public constructor(
    private readonly defaultResourceRepository: DefaultResourceRepository,
    private readonly eventBus: AppEventBus
  ) {}

  public readDefaultPreset(fileName: string): DefaultPresetRecord {
    return this.defaultResourceRepository.readPreset(fileName);
  }

  public saveDefaultPreset(record: DefaultPresetRecord): DefaultPresetRecord {
    const saved = this.defaultResourceRepository.savePreset(record);
    this.eventBus.emit('preset:content-updated', {
      contextKey: saved.fileName,
      reason: 'default-resource-saved'
    });
    return saved;
  }
}
