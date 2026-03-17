import { DefaultResourceService } from '../services/default-resource-service';
import { ReleaseService } from '../services/release-service';

export class ReleaseController {
  public constructor(
    private readonly releaseService: ReleaseService,
    private readonly defaultResourceService: DefaultResourceService
  ) {}

  public prepareRelease(config: unknown) {
    return this.releaseService.prepareReleaseConfig(config);
  }

  public getDefaultPreset(fileName: string) {
    return this.defaultResourceService.readDefaultPreset(fileName);
  }
}
