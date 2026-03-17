import { UpdateService } from '../services/update-service';

export class UpdatesController {
  public constructor(private readonly updateService: UpdateService) {}

  public parseManifest(manifest: unknown) {
    return this.updateService.parseManifest(manifest);
  }

  public check(currentVersion: string, manifest: unknown) {
    return this.updateService.checkForUpdates(currentVersion, manifest);
  }
}
