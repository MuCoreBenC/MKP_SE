import { describe, expect, it } from 'vitest';

const {
  createPostprocessReportFilePath,
  resolvePostprocessOutputPath
} = require('../../../src/main/postprocess_report_runtime');

describe('postprocess report runtime helpers', () => {
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
});
