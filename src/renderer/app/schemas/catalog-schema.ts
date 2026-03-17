import { z } from 'zod';

export const catalogBrandSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  subtitle: z.string().default(''),
  imageRef: z.string().min(1).default(''),
  favorite: z.boolean().default(false),
  pinned: z.boolean().default(false),
  disabled: z.boolean().default(false),
  builtin: z.boolean().default(true),
  canDelete: z.boolean().default(false),
  sortOrder: z.number().default(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const catalogPrinterSchema = z.object({
  id: z.string().min(1),
  brandId: z.string().min(1),
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  subtitle: z.string().default(''),
  imageRef: z.string().min(1).default(''),
  supportedVersionTypes: z.array(z.enum(['standard', 'quick', 'lite'])),
  defaultPresetRefs: z.partialRecord(z.enum(['standard', 'quick', 'lite']), z.string()).default({}),
  favorite: z.boolean().default(false),
  pinned: z.boolean().default(false),
  disabled: z.boolean().default(false),
  builtin: z.boolean().default(true),
  canDelete: z.boolean().default(false),
  sortOrder: z.number().default(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type CatalogBrandSchema = z.infer<typeof catalogBrandSchema>;
export type CatalogPrinterSchema = z.infer<typeof catalogPrinterSchema>;
