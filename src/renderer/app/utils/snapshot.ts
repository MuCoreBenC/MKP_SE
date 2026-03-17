import { createHash } from 'node:crypto';

export function createSnapshotHash(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}
