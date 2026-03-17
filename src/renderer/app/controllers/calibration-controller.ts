import { CalibrationService } from '../services/calibration-service';

export class CalibrationController {
  public constructor(private readonly calibrationService: CalibrationService) {}

  public getCalibrationViewModel(
    context: { printerId: string | null; versionType: string | null; presetPath: string | null },
    presetContent: Record<string, unknown>
  ) {
    return {
      enabled: this.calibrationService.isAvailable(context),
      offsets: context.presetPath ? this.calibrationService.extractOffsets(context.presetPath, presetContent) : null
    };
  }
}
