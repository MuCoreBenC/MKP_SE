import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const {
  cleanupLegacyPostprocessArtifacts,
  collectLegacyPostprocessArtifactPaths,
  createPostprocessReportFilePath,
  resolvePostprocessOutputPath
} = require('../../../src/main/postprocess_report_runtime');

const tempDirs = [];

describe('postprocess report runtime helpers', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
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
});
