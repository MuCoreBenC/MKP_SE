import { z } from 'zod';

export const releaseConfigSchema = z.object({
  version: z.string().min(1),
  releaseDate: z.string().min(1),
  shortDesc: z.string().min(1),
  releaseNotesMarkdown: z.string(),
  updateType: z.enum(['hot_update', 'full_installer']),
  forceUpdate: z.boolean(),
  canRollback: z.boolean(),
  selectedBuildMode: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
});

export type ReleaseConfigSchema = z.infer<typeof releaseConfigSchema>;
