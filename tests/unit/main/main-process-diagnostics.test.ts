import { describe, expect, it } from 'vitest';

const {
  buildCrashLogMessage,
  buildDailyLogFileName,
  buildGuiRelaunchArgs,
  buildLogFilePath,
  buildLogTimestamp,
  buildPrefixedLogLines,
  buildUpdaterFailureLogMessage
} = require('../../../src/main/main_process_diagnostics');

describe('main-process diagnostics helpers', () => {
  it('builds stable daily log names and paths', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');

    expect(buildDailyLogFileName(date)).toBe('mkp_2026-03-18.log');
    expect(buildLogFilePath('C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE', date)).toBe(
      'C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\Logs\\mkp_2026-03-18.log'
    );
  });

  it('prefixes every log line with the same timestamp', () => {
    const date = new Date(2026, 2, 18, 20, 1, 33);

    expect(buildLogTimestamp(date)).toBe('20:01:33');
    expect(buildPrefixedLogLines('[INFO] first\n[WARN] second', date)).toBe(
      '[20:01:33] [INFO] first\n[20:01:33] [WARN] second\n'
    );
  });

  it('relaunches GUI with a clean argument list instead of inheriting CLI or preset args', () => {
    expect(
      buildGuiRelaunchArgs({
        defaultApp: false,
        appPath: 'D:\\trae\\MKP_SE',
        currentArgv: ['MKP SupportE.exe', '--Json', 'C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\Presets\\a1_quick_v3.0.0-r1.json', '--Gcode']
      })
    ).toEqual([]);

    expect(
      buildGuiRelaunchArgs({
        defaultApp: true,
        appPath: 'D:\\trae\\MKP_SE',
        currentArgv: ['electron', 'D:\\trae\\MKP_SE', '--Json', 'preset.json', '--Gcode']
      })
    ).toEqual(['D:\\trae\\MKP_SE']);
  });

  it('formats crash logs with argv, last page, and stack details', () => {
    const error = new TypeError('Module preset.json needs an import assertion of type "json"');
    error.stack = 'TypeError: Module preset.json needs an import assertion of type "json"\n    at load (node:internal/modules/esm/loader:123:45)';

    const message = buildCrashLogMessage('uncaughtException', error, {
      origin: 'uncaughtExceptionMonitor',
      mode: 'gui',
      argv: ['MKP SupportE.exe'],
      execPath: 'C:\\Users\\WZY\\AppData\\Local\\Programs\\MKP SupportE\\MKP SupportE.exe',
      appPath: 'C:\\Users\\WZY\\AppData\\Local\\Programs\\MKP SupportE\\resources\\app',
      lastPage: 'setting',
      lastRendererLog: '[INFO] [UI] Switch tab, page:setting'
    });

    expect(message).toContain('[FATAL] [MainProcess] uncaughtException: Module preset.json needs an import assertion of type "json"');
    expect(message).toContain('[FATAL] [MainProcess] origin=uncaughtExceptionMonitor');
    expect(message).toContain('[FATAL] [MainProcess] mode=gui');
    expect(message).toContain('[FATAL] [MainProcess] lastPage=setting');
    expect(message).toContain('[FATAL] [MainProcess] lastRendererLog=[INFO] [UI] Switch tab, page:setting');
    expect(message).toContain('[FATAL] [MainProcess] stack:');
    expect(message).toContain('node:internal/modules/esm/loader:123:45');
  });

  it('formats non-error rejections without crashing the logger itself', () => {
    const message = buildCrashLogMessage('unhandledRejection', { code: 'E_FAIL', detail: 'missing config' }, {
      mode: 'gui',
      argv: ['MKP SupportE.exe', '--release-center']
    });

    expect(message).toContain('[FATAL] [MainProcess] unhandledRejection: {"code":"E_FAIL","detail":"missing config"}');
    expect(message).toContain('[FATAL] [MainProcess] error_name=NonError');
    expect(message).toContain('[FATAL] [MainProcess] argv=["MKP SupportE.exe","--release-center"]');
  });

  it('compresses updater failures into a single readable log line', () => {
    const error = new Error(
      'Cannot parse GitHub releases feed\nXML:\n<?xml version="1.0" encoding="UTF-8"?><feed>...</feed>'
    );

    expect(buildUpdaterFailureLogMessage(error)).toBe(
      '[WARN] [Updater] Check failed: Cannot parse GitHub releases feed'
    );
  });
});
