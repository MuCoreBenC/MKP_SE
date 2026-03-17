import { AppEventBus } from '../core/app-event-bus';
import { CatalogRepository } from '../repositories/catalog-repository';
import type { CatalogBrandSchema, CatalogPrinterSchema } from '../schemas/catalog-schema';

export class CatalogService {
  public constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly eventBus: AppEventBus
  ) {}

  public listBrands(): CatalogBrandSchema[] {
    return this.catalogRepository.listBrands();
  }

  public listPrintersByBrand(brandId: string): CatalogPrinterSchema[] {
    return this.catalogRepository.listPrintersByBrand(brandId);
  }

  public saveUserCatalog(brands: CatalogBrandSchema[], printers: CatalogPrinterSchema[]): void {
    this.catalogRepository.saveUserCatalog({ brands, printers });
    const primaryBrandId = brands[0]?.id ?? 'unknown';
    const primaryPrinter = printers.find((printer) => printer.brandId === primaryBrandId);

    this.eventBus.emit('context:changed', {
      brandId: primaryBrandId,
      printerId: primaryPrinter?.id ?? 'unknown',
      versionType: primaryPrinter?.supportedVersionTypes[0] ?? 'standard',
      contextKey: 'catalog-updated'
    });
  }
}
