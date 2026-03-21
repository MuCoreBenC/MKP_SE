import { describe, expect, it } from 'vitest';

import { buildScriptCommandView } from '../../../../src/renderer/app/entry/renderer-runtime';

describe('buildScriptCommandView', () => {
  it('builds command from modern params preset view when available', () => {
    const view = buildScriptCommandView(
      {
        __getParamsPresetView__: () => ({ absolutePath: 'C:\\data\\a1_standard.json' })
      } as unknown as Window,
      'C:\\app\\mkp.exe',
      'C:\\legacy\\preset.json'
    );

    expect(view).toBe('"C:\\app\\mkp.exe" --Json "C:\\data\\a1_standard.json" --Gcode');
  });

  it('falls back to legacy preset path when modern params preset view is unavailable', () => {
    const view = buildScriptCommandView(
      {} as Window,
      'C:\\app\\mkp.exe',
      'C:\\legacy\\preset.json'
    );

    expect(view).toBe('"C:\\app\\mkp.exe" --Json "C:\\legacy\\preset.json" --Gcode');
  });

  it('prepends the app path when running through electron in default-app development mode', () => {
    const view = buildScriptCommandView(
      {
        __getParamsPresetView__: () => ({ absolutePath: 'C:\\data\\a1_standard.json' })
      } as unknown as Window,
      {
        exePath: 'D:\\trae\\MKP_SE\\node_modules\\electron\\dist\\electron.exe',
        appPath: 'D:\\trae\\MKP_SE',
        defaultApp: true
      },
      'C:\\legacy\\preset.json'
    );

    expect(view).toBe('"D:\\trae\\MKP_SE\\node_modules\\electron\\dist\\electron.exe" "D:\\trae\\MKP_SE" --Json "C:\\data\\a1_standard.json" --Gcode');
  });
});
