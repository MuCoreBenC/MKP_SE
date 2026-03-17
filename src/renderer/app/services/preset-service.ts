import {
  buildContextKey,
  extractPresetMeta,
  type PresetContent,
  type PresetFileMeta,
  type PresetManifestEntry,
  type VersionType
} from '../core/preset';
import { AppEventBus } from '../core/app-event-bus';
import { compareVersions } from '../core/version';
import { PresetRepository, type PresetRecord } from '../repositories/preset-repository';
import { PresetSessionStore } from '../stores/preset-session-store';
import { UserConfigStore } from '../stores/user-config-store';

export interface ActivePresetSession {
  contextKey: string;
  printerId: string;
  versionType: VersionType;
  activeFileName: string;
  resolvedVersion: string;
}

export class PresetService {
  public constructor(
    private readonly userConfigStore: UserConfigStore,
    private readonly presetRepository?: PresetRepository,
    private readonly presetSessionStore?: PresetSessionStore,
    private readonly eventBus?: AppEventBus
  ) {}

  public resolvePresetMeta(
    fileName: string,
    content: PresetContent,
    manifestEntry?: PresetManifestEntry
  ): PresetFileMeta {
    return extractPresetMeta(fileName, content, manifestEntry);
  }

  public pickLatestPreset(
    candidates: Array<{ fileName: string; content: PresetContent; manifestEntry?: PresetManifestEntry }>
  ): PresetFileMeta {
    if (candidates.length === 0) {
      throw new Error('At least one preset candidate is required.');
    }

    const metas = candidates.map((candidate) =>
      this.resolvePresetMeta(candidate.fileName, candidate.content, candidate.manifestEntry)
    );

    return metas.sort((left, right) => compareVersions(right.contentVersion, left.contentVersion))[0];
  }

  public applyPreset(
    printerId: string,
    versionType: VersionType,
    fileName: string,
    content: PresetContent,
    manifestEntry?: PresetManifestEntry
  ): ActivePresetSession {
    const meta = this.resolvePresetMeta(fileName, content, manifestEntry);

    if (meta.printerId !== printerId || meta.versionType !== versionType) {
      throw new Error('Preset metadata does not match the active context.');
    }

    this.userConfigStore.setAppliedPreset(printerId, versionType, fileName);
    this.presetSessionStore?.setAppliedPreset(fileName);

    const session = {
      contextKey: buildContextKey(printerId, versionType),
      printerId,
      versionType,
      activeFileName: fileName,
      resolvedVersion: meta.contentVersion
    };

    this.eventBus?.emit('preset:applied', {
      contextKey: session.contextKey,
      activeFileName: session.activeFileName,
      resolvedVersion: session.resolvedVersion
    });

    return session;
  }

  public getActivePreset(printerId: string, versionType: VersionType): string | null {
    const snapshot = this.userConfigStore.getSnapshot();
    const contextKey = buildContextKey(printerId, versionType);
    return snapshot.appliedPresetByContext[contextKey] ?? null;
  }

  public listAvailablePresets(printerId: string, versionType: VersionType): PresetRecord[] {
    if (!this.presetRepository) {
      throw new Error('Preset repository is not configured.');
    }

    return this.presetRepository.listByContext(printerId, versionType);
  }

  public getResolvedActivePreset(printerId: string, versionType: VersionType): PresetRecord | null {
    if (!this.presetRepository) {
      throw new Error('Preset repository is not configured.');
    }

    const activeFileName = this.getActivePreset(printerId, versionType);
    if (!activeFileName) {
      return null;
    }

    return this.presetRepository.resolveActivePreset(printerId, versionType, activeFileName);
  }

  public savePreset(record: Omit<PresetRecord, 'storageLayer'>): PresetRecord {
    if (!this.presetRepository) {
      throw new Error('Preset repository is not configured.');
    }

    const savedRecord = this.presetRepository.saveUserPreset(record);
    this.eventBus?.emit('preset:content-updated', {
      contextKey: savedRecord.absolutePath,
      reason: 'preset-saved'
    });
    return savedRecord;
  }
}
