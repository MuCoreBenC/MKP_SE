import { readFileSync } from 'node:fs';

export const presetsSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/presets.js', 'utf8');

export function getPresetsBlock(startMarker: string, endMarker: string) {
  return presetsSource.slice(presetsSource.lastIndexOf(startMarker), presetsSource.lastIndexOf(endMarker));
}
