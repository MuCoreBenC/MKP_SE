import { z } from 'zod';

export const presetSchema = z.object({
  printer: z.string().min(1).optional(),
  printerId: z.string().min(1).optional(),
  machine: z.string().min(1).optional(),
  type: z.enum(['standard', 'quick', 'lite']).optional(),
  versionType: z.enum(['standard', 'quick', 'lite']).optional(),
  version: z.string().min(1).optional(),
  presetVersion: z.string().min(1).optional(),
  preset_version: z.string().min(1).optional(),
  profileVersion: z.string().min(1).optional(),
  profile_version: z.string().min(1).optional(),
  _custom_name: z.string().min(1).optional(),
  meta: z
    .object({
      version: z.string().min(1).optional(),
      displayName: z.string().min(1).optional()
    })
    .partial()
    .optional(),
  info: z
    .object({
      version: z.string().min(1).optional()
    })
    .partial()
    .optional(),
  toolhead: z
    .object({
      offset: z
        .object({
          x: z.number().optional(),
          y: z.number().optional(),
          z: z.number().optional()
        })
        .partial()
        .optional()
    })
    .passthrough()
    .optional()
}).passthrough();

export type PresetSchema = z.infer<typeof presetSchema>;
