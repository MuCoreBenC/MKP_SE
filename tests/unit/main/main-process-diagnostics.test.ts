import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const {
  buildSupportBundle,
  buildScopedDailyLogFileName,
  buildScopedLogFilePath,
  buildCrashLogMessage,
  buildDailyLogFileName,
  buildGuiRelaunchArgs,
  buildLogFilePath,
  buildLogTimestamp,
  buildPrefixedLogLines,
  collectScopedLogExcerpt,
  buildUpdaterFailureLogMessage
} = require('../../../src/main/main_process_diagnostics');

const tempDirs: string[] = [];
const mainSource = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe('main-process diagnostics helpers', () => {
  it('builds stable daily log names and paths', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');

    expect(buildDailyLogFileName(date)).toBe('mkp_2026-03-18.log');
    expect(buildLogFilePath('C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE', date)).toBe(
      'C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\Logs\\mkp_2026-03-18.log'
    );
  });

  it('builds separate GUI and CLI daily log names and paths', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');

    expect(buildScopedDailyLogFileName('gui', date)).toBe('mkpse_gui_2026-03-18.log');
    expect(buildScopedDailyLogFileName('cli', date)).toBe('mkpse_cli_2026-03-18.log');
    expect(buildScopedLogFilePath('C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE', 'cli', date)).toBe(
      'C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\Logs\\mkpse_cli_2026-03-18.log'
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

  it('collects GUI and CLI excerpts separately and falls back to splitting the legacy mixed log', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'mkp-diag-'));
    tempDirs.push(tempDir);
    const logDir = path.join(tempDir, 'Logs');
    mkdirSync(logDir, { recursive: true });

    writeFileSync(
      buildLogFilePath(tempDir, date),
      [
        '[12:34:50] [INFO] [MainProcess] bootstrap mode=gui',
        '[12:34:51] [UI] Switch tab, page:setting',
        '[12:34:52] [INFO] [CLI] start {"inputPath":"D:\\\\jobs\\\\part.gcode"}',
        '[12:34:53] [ERROR] [CLI] failed message="missing config" stack=""'
      ].join('\n'),
      'utf8'
    );

    const guiExcerpt = collectScopedLogExcerpt({
      userDataPath: tempDir,
      scope: 'gui',
      date,
      maxLines: 20
    });
    const cliExcerpt = collectScopedLogExcerpt({
      userDataPath: tempDir,
      scope: 'cli',
      date,
      maxLines: 20
    });

    expect(guiExcerpt.source).toBe('legacy');
    expect(guiExcerpt.content).toContain('[INFO] [MainProcess] bootstrap mode=gui');
    expect(guiExcerpt.content).toContain('[UI] Switch tab, page:setting');
    expect(guiExcerpt.content).not.toContain('[CLI]');

    expect(cliExcerpt.source).toBe('legacy');
    expect(cliExcerpt.content).toContain('[INFO] [CLI] start');
    expect(cliExcerpt.content).toContain('[ERROR] [CLI] failed message="missing config"');
    expect(cliExcerpt.content).not.toContain('bootstrap mode=gui');
  });

  it('prefers scoped log files over the legacy mixed daily log when both exist', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'mkp-diag-'));
    tempDirs.push(tempDir);
    const logDir = path.join(tempDir, 'Logs');
    mkdirSync(logDir, { recursive: true });

    writeFileSync(buildLogFilePath(tempDir, date), '[12:34:50] [INFO] [CLI] legacy line', 'utf8');
    writeFileSync(buildScopedLogFilePath(tempDir, 'gui', date), '[12:35:00] [INFO] [MainProcess] scoped gui line', 'utf8');

    const guiExcerpt = collectScopedLogExcerpt({
      userDataPath: tempDir,
      scope: 'gui',
      date,
      maxLines: 20
    });

    expect(guiExcerpt.source).toBe('scoped');
    expect(guiExcerpt.content).toContain('scoped gui line');
    expect(guiExcerpt.content).not.toContain('legacy line');
  });

  it('keeps only the latest CLI session and reports when the exported excerpt is truncated', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'mkp-diag-'));
    tempDirs.push(tempDir);
    const logDir = path.join(tempDir, 'Logs');
    mkdirSync(logDir, { recursive: true });

    writeFileSync(
      buildScopedLogFilePath(tempDir, 'cli', date),
      [
        '[12:34:00] [INFO] [CLI] start {"inputPath":"old.gcode"}',
        '[12:34:01] [INFO] [CLI] step 1/2 kind=info title=old technical=a',
        '[12:34:10] [INFO] [CLI] start {"inputPath":"new.gcode"}',
        '[12:34:11] [INFO] [CLI] step 1/4 kind=info title=new technical=a',
        '[12:34:12] [INFO] [CLI] step 2/4 kind=info title=new technical=b',
        '[12:34:13] [INFO] [CLI] step 3/4 kind=info title=new technical=c',
        '[12:34:14] [INFO] [CLI] step 4/4 kind=info title=new technical=d'
      ].join('\n'),
      'utf8'
    );

    const cliExcerpt = collectScopedLogExcerpt({
      userDataPath: tempDir,
      scope: 'cli',
      date,
      maxLines: 3,
      latestSessionOnly: true
    });

    expect(cliExcerpt.source).toBe('scoped');
    expect(cliExcerpt.content).not.toContain('old.gcode');
    expect(cliExcerpt.content).toContain('new.gcode');
    expect(cliExcerpt.totalLines).toBe(5);
    expect(cliExcerpt.retainedLines).toBe(3);
    expect(cliExcerpt.truncated).toBe(true);
    expect(cliExcerpt.latestSessionOnly).toBe(true);
    expect(cliExcerpt.issueDetected).toBe(false);
  });

  it('keeps a longer CLI excerpt when the latest session contains a real issue', () => {
    const date = new Date('2026-03-18T12:34:56.000Z');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'mkp-diag-'));
    tempDirs.push(tempDir);
    const logDir = path.join(tempDir, 'Logs');
    mkdirSync(logDir, { recursive: true });

    writeFileSync(
      buildScopedLogFilePath(tempDir, 'cli', date),
      [
        '[12:34:00] [INFO] [CLI] start {"inputPath":"old.gcode"}',
        '[12:34:01] [INFO] [CLI] report status=completed durationMs=7 input=old.gcode output=old_out.gcode',
        '[12:34:10] [INFO] [CLI] start {"inputPath":"failed.gcode"}',
        '[12:34:11] [INFO] [CLI] step 1/5 kind=info title=scan technical=a',
        '[12:34:12] [INFO] [CLI] step 2/5 kind=info title=prepare technical=b',
        '[12:34:13] [INFO] [CLI] step 3/5 kind=error title=inject technical=pressure tower missing',
        '[12:34:14] [INFO] [CLI] step 4/5 kind=info title=context technical=layer=1827',
        '[12:34:15] [INFO] [CLI] report status=failed durationMs=91 input=failed.gcode output=N/A'
      ].join('\n'),
      'utf8'
    );

    const cliExcerpt = collectScopedLogExcerpt({
      userDataPath: tempDir,
      scope: 'cli',
      date,
      maxLines: 2,
      maxIssueLines: 5,
      latestSessionOnly: true
    });

    expect(cliExcerpt.source).toBe('scoped');
    expect(cliExcerpt.content).not.toContain('old.gcode');
    expect(cliExcerpt.content).toContain('failed.gcode');
    expect(cliExcerpt.content).toContain('kind=error');
    expect(cliExcerpt.content).toContain('status=failed');
    expect(cliExcerpt.totalLines).toBe(6);
    expect(cliExcerpt.retainedLines).toBe(5);
    expect(cliExcerpt.truncated).toBe(true);
    expect(cliExcerpt.latestSessionOnly).toBe(true);
    expect(cliExcerpt.issueDetected).toBe(true);
  });

  it('builds a compact three-file support bundle with a stable issue fingerprint and request copy', () => {
    const date = new Date(2026, 2, 20, 9, 8, 7);
    const bundle = buildSupportBundle({
      appVersion: '0.2.10',
      runtime: {
        platform: 'win32',
        arch: 'x64'
      },
      lastPage: 'setting',
      lastRendererLog: '[INFO] [UI] Switch tab, page:setting',
      guiLogExcerpt: '[09:08:00] [FATAL] [MainProcess] unhandledRejection: missing config',
      cliLogExcerpt: '[09:08:05] [INFO] [CLI] report status=completed durationMs=42',
      guiLogMeta: {
        totalLines: 1,
        retainedLines: 1,
        truncated: false,
        latestSessionOnly: false,
        issueDetected: true
      },
      cliLogMeta: {
        totalLines: 89,
        retainedLines: 89,
        truncated: false,
        latestSessionOnly: true,
        issueDetected: false
      }
    }, {
      date
    });

    expect(bundle.fingerprint).toMatch(/^MKPSE-GUI-[A-F0-9]{8}$/);
    expect(bundle.folderName).toContain(bundle.fingerprint);
    expect(bundle.summary).toContain('GUI 最近一次异常');
    expect(bundle.summary).toContain('CLI 最近一次处理：已完成');
    expect(bundle.files.map((file: { name: string }) => file.name)).toEqual([
      'README_MKPSE_求助.txt',
      'mkpse_gui.log',
      'mkpse_cli.log'
    ]);
    expect(bundle.files[0].content).toContain(`问题指纹: ${bundle.fingerprint}`);
    expect(bundle.files[0].content).toContain('一句结论: GUI 最近一次异常');
    expect(bundle.files[0].content).toContain('我在 MKPSE (MKP SupportE) v0.2.10 (win32 x64) 上遇到问题');
    expect(bundle.files[1].content).toContain('unhandledRejection: missing config');
    expect(bundle.files[1].content).toContain('# retained lines: 1/1');
    expect(bundle.files[2].content).toContain('report status=completed');
    expect(bundle.files[2].content).toContain('# latest session only: yes');
    expect(bundle.files[2].content).toContain('# retained lines: 89/89');
  });

  it('dedupes support-bundle export requests in the main process so repeated clicks reuse one in-flight export', () => {
    expect(mainSource).toContain('let supportBundleExportPromise = null;');
    expect(mainSource).toMatch(/if \(supportBundleExportPromise\) \{\s*return supportBundleExportPromise;\s*\}/);
    expect(mainSource).toMatch(/supportBundleExportPromise = \(async \(\) => \{/);
    expect(mainSource).toMatch(/return exportSupportBundleToDesktop\(\);/);
    expect(mainSource).toMatch(/finally \{\s*supportBundleExportPromise = null;\s*\}/);
  });

  it('reuses the latest exported support bundle for one minute instead of creating a new folder each time', () => {
    expect(mainSource).toContain('const SUPPORT_BUNDLE_REUSE_WINDOW_MS = 60 * 1000;');
    expect(mainSource).toContain('let lastSupportBundleExportResult = null;');
    expect(mainSource).toContain('function getReusableSupportBundleExportResult(');
    expect(mainSource).toMatch(/const reusableSupportBundleExportResult = getReusableSupportBundleExportResult\(\);/);
    expect(mainSource).toMatch(/if \(reusableSupportBundleExportResult\) \{\s*return reusableSupportBundleExportResult;\s*\}/);
    expect(mainSource).toMatch(/reused: true/);
    expect(mainSource).toMatch(/ipcMain\.handle\('open-last-support-bundle-folder'/);
    expect(mainSource).toMatch(/shell\.showItemInFolder\(lastSupportBundleExportResult\.readmePath\)/);
  });
});
