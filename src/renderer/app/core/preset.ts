export type VersionType = 'standard' | 'quick' | 'lite';

export interface PresetContent {
  printer?: string;
  printerId?: string;
  machine?: string;
  type?: string;
  versionType?: string;
  version?: string;
  presetVersion?: string;
  preset_version?: string;
  profileVersion?: string;
  profile_version?: string;
  meta?: {
    version?: string;
    displayName?: string;
  };
  info?: {
    version?: string;
  };
  _custom_name?: string;
  [key: string]: unknown;
}

export interface PresetManifestEntry {
  id: string;
  type: VersionType;
  version: string;
  file: string;
  description?: string;
}

export interface PresetFileMeta {
  fileName: string;
  printerId: string;
  versionType: VersionType;
  contentVersion: string;
  displayName: string;
}

const SUPPORTED_VERSION_TYPES: VersionType[] = ['standard', 'quick', 'lite'];

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeVersion(version: unknown): string | null {
  if (typeof version !== 'string' && typeof version !== 'number') {
    return null;
  }

  const normalized = String(version).trim().replace(/^v/i, '');
  return normalized || null;
}

export function resolveVersionType(value: unknown): VersionType {
  if (typeof value !== 'string') {
    throw new Error('Version type is required.');
  }

  const normalized = value.trim().toLowerCase() as VersionType;
  if (!SUPPORTED_VERSION_TYPES.includes(normalized)) {
    throw new Error(`Unsupported version type: ${value}`);
  }

  return normalized;
}

export function extractPresetVersion(content: PresetContent, manifestEntry?: PresetManifestEntry): string {
  const resolved = normalizeVersion(
    firstString(
      content.version,
      content.presetVersion,
      content.preset_version,
      content.profileVersion,
      content.profile_version,
      content.meta?.version,
      content.info?.version,
      manifestEntry?.version
    )
  );

  if (!resolved) {
    throw new Error('Preset version is missing from content and manifest.');
  }

  return resolved;
}

export function extractPresetMeta(
  fileName: string,
  content: PresetContent,
  manifestEntry?: PresetManifestEntry
): PresetFileMeta {
  const printerId = firstString(content.printer, content.printerId, content.machine, manifestEntry?.id);
  if (!printerId) {
    throw new Error('Printer id is required for preset metadata extraction.');
  }

  const versionType = resolveVersionType(firstString(content.type, content.versionType, manifestEntry?.type));
  const contentVersion = extractPresetVersion(content, manifestEntry);
  const displayName = firstString(content._custom_name, content.meta?.displayName, fileName) ?? fileName;

  return {
    fileName,
    printerId,
    versionType,
    contentVersion,
    displayName
  };
}

export function buildContextKey(printerId: string, versionType: VersionType): string {
  const normalizedPrinterId = firstString(printerId);
  if (!normalizedPrinterId) {
    throw new Error('Printer id is required for context key.');
  }

  return `${normalizedPrinterId}_${resolveVersionType(versionType)}`;
}
