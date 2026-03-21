import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const {
  cleanupLegacyPostprocessArtifacts,
  collectLegacyPostprocessArtifactPaths,
  createFailedPostprocessReportState,
  createPendingPostprocessReportState,
  createPostprocessReportFilePath,
  readPostprocessReportState,
  resolvePostprocessOutputPath,
  writePostprocessReportState
} = require('../../../src/main/postprocess_report_runtime');

const tempDirs: string[] = [];

describe('postprocess report runtime helpers', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('writes processed gcode back to the source path for slicer post-processing flow', () => {
    expect(resolvePostprocessOutputPath('C:\\Temp\\part.gcode')).toBe('C:\\Temp\\part.gcode');
    expect(resolvePostprocessOutputPath('D:\\jobs\\nested\\.227388.7.gcode')).toBe(
      'D:\\jobs\\nested\\.227388.7.gcode'
    );
  });

  it('creates report files in the temp directory with a sanitized base name', () => {
    const reportPath = createPostprocessReportFilePath('D:\\jobs\\nested\\.227388.7.gcode');

    expect(reportPath).toMatch(/mkp_postprocess_report_/);
    expect(reportPath).toMatch(/_\.227388\.7\.json$/);
  });

  it('collects legacy processed outputs and old report files for the same gcode basename', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-postprocess-runtime-'));
    tempDirs.push(tempDir);

    const inputPath = 'D:\\jobs\\nested\\.227388.7.gcode';
    const legacyArtifacts = [
      'D:\\jobs\\nested\\.227388.7_processed.gcode',
      'D:\\jobs\\nested\\.227388.7.gcode_processed.gcode',
      'D:\\jobs\\nested\\.227388.7.gcode_Output.gcode',
      'D:\\jobs\\nested\\.227388.7_Output.gcode',
      path.join(tempDir, 'mkp_postprocess_report_1_999_.227388.7.json')
    ];

    legacyArtifacts.forEach((filePath) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'legacy', 'utf8');
    });
    fs.writeFileSync(path.join(tempDir, 'mkp_postprocess_report_1_999_other.json'), 'keep', 'utf8');

    const collected = collectLegacyPostprocessArtifactPaths(inputPath, { tempDir }).sort();

    expect(collected).toEqual(legacyArtifacts.sort());
  });

  it('removes stale processed outputs and old reports before a fresh export starts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-postprocess-runtime-'));
    tempDirs.push(tempDir);

    const inputPath = path.join(tempDir, 'part.gcode');
    const staleProcessedPath = path.join(tempDir, 'part_processed.gcode');
    const staleFallbackPath = `${inputPath}_processed.gcode`;
    const stalePythonPath = `${inputPath}_Output.gcode`;
    const stalePythonAltPath = path.join(tempDir, 'part_Output.gcode');
    const staleReportPath = path.join(tempDir, 'mkp_postprocess_report_1_999_part.json');
    const unrelatedPath = path.join(tempDir, 'keep.txt');

    [
      inputPath,
      staleProcessedPath,
      staleFallbackPath,
      stalePythonPath,
      stalePythonAltPath,
      staleReportPath,
      unrelatedPath
    ].forEach((filePath) => {
      fs.writeFileSync(filePath, 'data', 'utf8');
    });

    const removedPaths = cleanupLegacyPostprocessArtifacts(inputPath, { tempDir }).sort();

    expect(removedPaths).toEqual([
      staleProcessedPath,
      staleFallbackPath,
      stalePythonAltPath,
      stalePythonPath,
      staleReportPath
    ].sort());
    expect(fs.existsSync(inputPath)).toBe(true);
    expect(fs.existsSync(unrelatedPath)).toBe(true);
    expect(fs.existsSync(staleProcessedPath)).toBe(false);
    expect(fs.existsSync(staleReportPath)).toBe(false);
  });

  it('creates a pending viewer snapshot that auto-closes after 10 seconds and keeps the source meta for the report window', () => {
    const state = createPendingPostprocessReportState({
      configFormat: 'json',
      configPath: 'C:\\preset.json',
      inputPath: 'C:\\part.gcode',
      outputPath: 'C:\\part.gcode',
      runtime: {
        engineRevision: 'test-rev'
      }
    });

    expect(state.status).toBe('running');
    expect(state.inputPath).toBe('C:\\part.gcode');
    expect(state.outputPath).toBe('C:\\part.gcode');
    expect(state.configPath).toBe('C:\\preset.json');
    expect(state.configFormat).toBe('json');
    expect(state.runtime).toEqual({ engineRevision: 'test-rev' });
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0].technical).toContain('Viewer launched before process completion');
    expect(state.ui.autoCloseSeconds).toBe(10);
    expect(state.ui.minimumProgressDurationMs).toBe(1000);
    expect(state.progress).toMatchObject({
      percent: 12,
      phase: 'launching',
      label: '显示后处理窗口'
    });
  });

  it('creates a failed viewer snapshot that disables auto-close and keeps the CLI error message', () => {
    const state = createFailedPostprocessReportState(
      {
        configFormat: 'toml',
        configPath: 'C:\\preset.toml',
        inputPath: 'C:\\part.gcode',
        outputPath: 'C:\\part.gcode'
      },
      new Error('Offset X coordinate -5 exceeds machine minimum 0')
    );

    expect(state.status).toBe('failed');
    expect(state.configFormat).toBe('toml');
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0].technical).toContain('CLI error: Offset X coordinate -5 exceeds machine minimum 0');
    expect(state.ui.autoCloseSeconds).toBe(0);
    expect(state.ui.minimumProgressDurationMs).toBe(1000);
    expect(state.progress).toMatchObject({
      percent: 100,
      phase: 'failed',
      label: '后处理失败'
    });
  });

  it('writes and reads report snapshots without losing structured runtime and UI fields', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-postprocess-runtime-'));
    tempDirs.push(tempDir);
    const reportPath = path.join(tempDir, 'report.json');
    const state = {
      status: 'completed',
      summary: {
        injectedSegments: 2
      },
      runtime: {
        engineRevision: 'rev-1',
        mode: 'cli'
      },
      progress: {
        percent: 42,
        phase: 'scan',
        label: '扫描 G-code'
      },
      ui: {
        autoCloseSeconds: 10,
        minimumProgressDurationMs: 1000
      }
    };

    writePostprocessReportState(reportPath, state);

    expect(readPostprocessReportState(reportPath)).toEqual(state);
  });
});
