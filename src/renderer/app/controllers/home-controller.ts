import { CatalogService } from '../services/catalog-service';
import { UserConfigService } from '../services/user-config-service';

export class HomeController {
  public constructor(
    private readonly catalogService: CatalogService,
    private readonly userConfigService: UserConfigService
  ) {}

  public getHomeViewModel(selectedBrandId: string) {
    return {
      brands: this.catalogService.listBrands(),
      printers: this.catalogService.listPrintersByBrand(selectedBrandId)
    };
  }

  public selectPrinterContext(brandId: string, printerId: string, versionType: 'standard' | 'quick' | 'lite'): void {
    this.userConfigService.selectContext(brandId, printerId, versionType);
  }
}
