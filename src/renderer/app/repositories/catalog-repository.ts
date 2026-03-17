import { catalogBrandSchema, catalogPrinterSchema, type CatalogBrandSchema, type CatalogPrinterSchema } from '../schemas/catalog-schema';
import { SchemaValidationService } from '../services/schema-validation-service';

export interface CatalogRecordSet {
  brands: CatalogBrandSchema[];
  printers: CatalogPrinterSchema[];
}

export interface CatalogDataSource {
  read(): CatalogRecordSet;
  write?(records: CatalogRecordSet): void;
}

function mergeById<T extends { id: string }>(builtinItems: T[], userItems: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of builtinItems) {
    merged.set(item.id, item);
  }

  for (const item of userItems) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

export class CatalogRepository {
  public constructor(
    private readonly builtinSource: CatalogDataSource,
    private readonly userSource: CatalogDataSource,
    private readonly schemaValidationService = new SchemaValidationService()
  ) {}

  public listBrands(): CatalogBrandSchema[] {
    const builtin = this.validate(this.builtinSource.read());
    const user = this.validate(this.userSource.read());

    return mergeById(builtin.brands, user.brands).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  public listPrintersByBrand(brandId: string): CatalogPrinterSchema[] {
    const builtin = this.validate(this.builtinSource.read());
    const user = this.validate(this.userSource.read());

    return mergeById(
      builtin.printers.filter((printer) => printer.brandId === brandId),
      user.printers.filter((printer) => printer.brandId === brandId)
    ).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  public saveUserCatalog(records: CatalogRecordSet): void {
    const validated = this.validate(records);
    this.userSource.write?.(validated);
  }

  private validate(records: CatalogRecordSet): CatalogRecordSet {
    return {
      brands: records.brands.map((brand) => this.schemaValidationService.parse(catalogBrandSchema, brand, 'Invalid catalog brand')),
      printers: records.printers.map((printer) =>
        this.schemaValidationService.parse(catalogPrinterSchema, printer, 'Invalid catalog printer')
      )
    };
  }
}
