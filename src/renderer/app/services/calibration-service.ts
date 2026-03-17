import { AppEventBus } from '../core/app-event-bus';

export interface CalibrationOffsets {
  x: number;
  y: number;
  z: number;
  sourcePresetPath: string;
  sourceVersion?: string;
  updatedAt: string;
}

export interface CalibrationContext {
  printerId: string | null;
  versionType: string | null;
  presetPath: string | null;
}

export class CalibrationService {
  public constructor(private readonly eventBus: AppEventBus) {}

  public isAvailable(context: CalibrationContext): boolean {
    return Boolean(context.printerId && context.versionType && context.presetPath);
  }

  public extractOffsets(presetPath: string, presetContent: Record<string, unknown>): CalibrationOffsets {
    const toolhead = (presetContent.toolhead ?? {}) as Record<string, unknown>;
    const offset = (toolhead.offset ?? {}) as Record<string, unknown>;

    return {
      x: this.asNumber(offset.x),
      y: this.asNumber(offset.y),
      z: this.asNumber(offset.z),
      sourcePresetPath: presetPath,
      sourceVersion: typeof presetContent.version === 'string' ? presetContent.version : undefined,
      updatedAt: new Date().toISOString()
    };
  }

  public applyOffsets(
    presetPath: string,
    presetContent: Record<string, unknown>,
    nextOffsets: Pick<CalibrationOffsets, 'x' | 'y' | 'z'>
  ): { presetContent: Record<string, unknown>; offsets: CalibrationOffsets } {
    const toolhead = this.asRecord(presetContent.toolhead);
    const nextContent: Record<string, unknown> = {
      ...presetContent,
      toolhead: {
        ...toolhead,
        offset: {
          ...this.asRecord(toolhead.offset),
          x: nextOffsets.x,
          y: nextOffsets.y,
          z: nextOffsets.z
        }
      }
    };

    const offsets = this.extractOffsets(presetPath, nextContent);
    this.eventBus.emit('preset:content-updated', {
      contextKey: presetPath,
      reason: 'calibration-updated'
    });

    return {
      presetContent: nextContent,
      offsets
    };
  }

  private asNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
