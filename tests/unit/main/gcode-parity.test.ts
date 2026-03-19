import { describe, expect, it } from 'vitest';

const {
  DEFAULT_GCODE_PARITY_MARKERS,
  collectGcodeParitySummary,
  compareGcodeParity
} = require('../../../src/main/gcode_parity');

describe('gcode parity helpers', () => {
  it('collects marker counts and first indexes from a single gcode snapshot', () => {
    const summary = collectGcodeParitySummary(
      [
        '; post_process = "mkp.exe"',
        '; Z_HEIGHT: 0.20',
        '; Current Layer Thickness:0.2',
        ';Pre-glue preparation',
        ';Rising Nozzle a little',
        ';Mounting Toolhead',
        ';Toolhead Mounted',
        ';Glueing Started',
        ';Inposition',
        ';Glueing Finished',
        ';Prepare for next tower',
        ';Tower_Layer_Gcode'
      ].join('\n')
    );

    expect(summary.lineCount).toBe(12);
    expect(summary.markerStats.find((item: any) => item.marker === ';Mounting Toolhead')).toEqual({
      marker: ';Mounting Toolhead',
      count: 1,
      firstIndex: 5,
      lastIndex: 5
    });
    expect(summary.markerStats.find((item: any) => item.marker === '; Current Layer Thickness:')).toEqual({
      marker: '; Current Layer Thickness:',
      count: 1,
      firstIndex: 2,
      lastIndex: 2
    });
    expect(summary.markerStats.find((item: any) => item.marker === ';Walls Ahead!')?.count).toBe(0);
  });

  it('reports line deltas, count deltas, and first-index shifts between python and js style outputs', () => {
    const reference = [
      '; Z_HEIGHT: 0.20',
      ';Mounting Toolhead',
      ';Toolhead Mounted',
      ';Glueing Finished',
      ';Prepare for next tower'
    ].join('\n');
    const candidate = [
      '; Z_HEIGHT: 0.20',
      '; ===== MKP Support Electron Glueing Start =====',
      ';Mounting Toolhead',
      ';Glueing Finished',
      ';Prepare for next tower',
      ';Tower_Layer_Gcode'
    ].join('\n');

    const comparison = compareGcodeParity(reference, candidate, [
      '; ===== MKP Support Electron Glueing Start =====',
      ';Mounting Toolhead',
      ';Toolhead Mounted',
      ';Glueing Finished',
      ';Prepare for next tower',
      ';Tower_Layer_Gcode'
    ]);

    expect(comparison.lineCountDelta).toBe(1);
    expect(comparison.markerDiffs).toContainEqual({
      marker: ';Toolhead Mounted',
      referenceCount: 1,
      candidateCount: 0,
      countDelta: -1,
      referenceFirstIndex: 2,
      candidateFirstIndex: -1,
      firstIndexDelta: -3
    });
    expect(comparison.markerDiffs).toContainEqual({
      marker: '; ===== MKP Support Electron Glueing Start =====',
      referenceCount: 0,
      candidateCount: 1,
      countDelta: 1,
      referenceFirstIndex: -1,
      candidateFirstIndex: 1,
      firstIndexDelta: 2
    });
    expect(comparison.mismatches.length).toBeGreaterThan(0);
  });

  it('ships a default marker set that covers current tower-only parity checkpoints', () => {
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain('; Current Layer Thickness:');
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain(';Pre-glue preparation');
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain(';Toolhead Mounted');
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain(';Prepare for next tower');
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain(';Tower_Layer_Gcode');
    expect(DEFAULT_GCODE_PARITY_MARKERS).toContain(';MKP thick bridge');
  });
});
