import { z } from 'zod';

export const appManifestSchema = z.object({
  latestVersion: z.string().min(1),
  updateType: z.enum(['hot_update', 'full_installer']).default('hot_update'),
  downloadUrl: z.string().min(1),
  forceUpdate: z.boolean().default(false),
  releaseDate: z.string().min(1),
  shortDesc: z.string().min(1),
  canRollback: z.boolean().default(false),
  releaseNotes: z.array(z.string()).default([]),
  releaseNotesMarkdown: z.string().default(''),
  history: z.array(z.record(z.string(), z.unknown())).default([])
});

export type AppManifestSchema = z.infer<typeof appManifestSchema>;
