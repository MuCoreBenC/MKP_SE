import { z } from 'zod';

const versionTypeSchema = z.enum(['standard', 'quick', 'lite']);

export const userConfigSchema = z.object({
  selectedBrandId: z.string().min(1),
  selectedPrinterId: z.string().min(1),
  selectedVersionType: versionTypeSchema,
  appliedPresetByContext: z.record(z.string(), z.string()),
  onboardingEnabled: z.boolean(),
  updateMode: z.enum(['manual', 'auto']),
  themeMode: z.enum(['light', 'dark', 'system']),
  dockAnimationEnabled: z.boolean(),
  dockBaseSize: z.number(),
  dockMaxScale: z.number(),
  updatedAt: z.string().min(1)
});

export type UserConfigSchema = z.infer<typeof userConfigSchema>;
