import { PresetService } from '../services/preset-service';

export class PresetsController {
  public constructor(private readonly presetService: PresetService) {}

  public getPresetList(printerId: string, versionType: 'standard' | 'quick' | 'lite') {
    return this.presetService.listAvailablePresets(printerId, versionType);
  }

  public getActivePreset(printerId: string, versionType: 'standard' | 'quick' | 'lite') {
    return this.presetService.getResolvedActivePreset(printerId, versionType);
  }
}
