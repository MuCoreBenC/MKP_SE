const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildDailyLogFileName(date = new Date()) {
  return `mkp_${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.log`;
}

function normalizeLogScope(scope = 'gui') {
  return String(scope || '').trim().toLowerCase() === 'cli' ? 'cli' : 'gui';
}

function buildScopedDailyLogFileName(scope = 'gui', date = new Date()) {
  return `mkpse_${normalizeLogScope(scope)}_${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.log`;
}

function buildLogTimestamp(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function buildLogFilePath(userDataPath, date = new Date()) {
  return path.join(userDataPath, 'Logs', buildDailyLogFileName(date));
}

function buildScopedLogFilePath(userDataPath, scope = 'gui', date = new Date()) {
  return path.join(userDataPath, 'Logs', buildScopedDailyLogFileName(scope, date));
}

function buildPrefixedLogLines(message, date = new Date()) {
  const timestamp = buildLogTimestamp(date);
  const normalized = String(message ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  return `${lines.map((line) => `[${timestamp}] ${line}`).join('\n')}\n`;
}

function normalizeLogContent(content = '') {
  return String(content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function sliceTrailingLines(content = '', maxLines = 240) {
  const normalized = normalizeLogContent(content);
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (maxLines <= 0) {
    return '';
  }

  return lines.slice(-maxLines).join('\n');
}

function splitLegacyMixedLogContent(content = '') {
  const lines = normalizeLogContent(content).split('\n');
  const buckets = {
    gui: [],
    cli: []
  };
  let lastScope = 'gui';

  lines.forEach((line) => {
    if (line === '') {
      if (buckets[lastScope].length > 0) {
        buckets[lastScope].push('');
      }
      return;
    }

    const nextScope = line.includes('[CLI]') ? 'cli' : 'gui';
    buckets[nextScope].push(line);
    lastScope = nextScope;
  });

  return {
    gui: sliceTrailingLines(buckets.gui.join('\n'), Number.MAX_SAFE_INTEGER),
    cli: sliceTrailingLines(buckets.cli.join('\n'), Number.MAX_SAFE_INTEGER)
  };
}

function normalizeExcerptLines(content = '') {
  const lines = normalizeLogContent(content).split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function joinExcerptLines(lines = []) {
  return lines.join('\n');
}

function isCliSessionStartLine(line = '') {
  return /\[INFO\]\s+\[CLI\]\s+start\b/i.test(String(line || ''));
}

function findLatestCliSessionLines(lines = []) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (isCliSessionStartLine(lines[index])) {
      return lines.slice(index);
    }
  }
  return lines.slice();
}

function doesGuiLineIndicateIssue(line = '') {
  return /\[(FATAL|ERROR|WARN)\]/i.test(String(line || ''));
}

function doesCliLineIndicateFatal(line = '') {
  return /\[FATAL\]/i.test(String(line || ''));
}

function doesCliLineIndicateError(line = '') {
  const normalized = String(line || '');
  return /\[ERROR\]/i.test(normalized)
    || /\bkind=error\b/i.test(normalized)
    || /\breport status=failed\b/i.test(normalized)
    || /\bCLI error:/i.test(normalized);
}

function doesCliLineIndicateWarning(line = '') {
  const normalized = String(line || '');
  return /\[WARN\]/i.test(normalized)
    || /\bkind=warn\b/i.test(normalized);
}

function doesCliLineIndicateIssue(line = '') {
  return doesCliLineIndicateFatal(line)
    || doesCliLineIndicateError(line)
    || doesCliLineIndicateWarning(line);
}

function selectExcerptLines(lines = [], maxLines = 240, options = {}) {
  const safeMaxLines = Number.isFinite(maxLines) ? Math.max(1, Number(maxLines)) : 240;
  const totalLines = Array.isArray(lines) ? lines.length : 0;

  if (totalLines === 0) {
    return {
      lines: [],
      totalLines: 0,
      retainedLines: 0,
      truncated: false
    };
  }

  if (totalLines <= safeMaxLines) {
    return {
      lines: lines.slice(),
      totalLines,
      retainedLines: totalLines,
      truncated: false
    };
  }

  if (options.preserveFirstLine === true && safeMaxLines > 1) {
    return {
      lines: [lines[0], ...lines.slice(-(safeMaxLines - 1))],
      totalLines,
      retainedLines: safeMaxLines,
      truncated: true
    };
  }

  return {
    lines: lines.slice(-safeMaxLines),
    totalLines,
    retainedLines: safeMaxLines,
    truncated: true
  };
}

function buildCollectedExcerpt(scope, source, filePath, content, options = {}) {
  const normalizedScope = normalizeLogScope(scope);
  const maxLines = Number.isFinite(options.maxLines) ? Math.max(1, Number(options.maxLines)) : 240;
  const maxIssueLines = Number.isFinite(options.maxIssueLines)
    ? Math.max(maxLines, Number(options.maxIssueLines))
    : maxLines;
  const latestSessionOnly = normalizedScope === 'cli' && options.latestSessionOnly === true;
  const allLines = normalizeExcerptLines(content);
  const scopedLines = latestSessionOnly ? findLatestCliSessionLines(allLines) : allLines;
  const issueDetected = normalizedScope === 'cli'
    ? scopedLines.some((line) => doesCliLineIndicateIssue(line))
    : scopedLines.some((line) => doesGuiLineIndicateIssue(line));
  const effectiveMaxLines = issueDetected ? maxIssueLines : maxLines;
  const selection = selectExcerptLines(scopedLines, effectiveMaxLines, {
    preserveFirstLine: latestSessionOnly
  });

  return {
    scope: normalizedScope,
    source,
    filePath,
    content: joinExcerptLines(selection.lines),
    totalLines: selection.totalLines,
    retainedLines: selection.retainedLines,
    truncated: selection.truncated,
    latestSessionOnly,
    issueDetected
  };
}

function collectScopedLogExcerpt(options = {}) {
  const scope = normalizeLogScope(options.scope);
  const date = options.date instanceof Date ? options.date : new Date();
  const userDataPath = String(options.userDataPath || '').trim();

  if (!userDataPath) {
    return buildCollectedExcerpt(scope, 'empty', null, '', options);
  }

  const scopedPath = buildScopedLogFilePath(userDataPath, scope, date);
  if (fs.existsSync(scopedPath)) {
    return buildCollectedExcerpt(scope, 'scoped', scopedPath, fs.readFileSync(scopedPath, 'utf8'), options);
  }

  const legacyPath = buildLogFilePath(userDataPath, date);
  if (fs.existsSync(legacyPath)) {
    const buckets = splitLegacyMixedLogContent(fs.readFileSync(legacyPath, 'utf8'));
    return buildCollectedExcerpt(scope, 'legacy', legacyPath, buckets[scope], options);
  }

  return buildCollectedExcerpt(scope, 'empty', null, '', options);
}

function buildGuiRelaunchArgs(options = {}) {
  const defaultApp = options.defaultApp === true;
  const appPath = typeof options.appPath === 'string' ? options.appPath.trim() : '';
  return defaultApp && appPath ? [appPath] : [];
}

function normalizeErrorLike(errorLike) {
  if (errorLike instanceof Error) {
    return {
      name: errorLike.name || 'Error',
      message: errorLike.message || String(errorLike),
      stack: errorLike.stack || null
    };
  }

  if (errorLike && typeof errorLike === 'object') {
    let fallbackMessage = '[object Object]';
    try {
      fallbackMessage = JSON.stringify(errorLike);
    } catch (serializationError) {}

    return {
      name: typeof errorLike.name === 'string' && errorLike.name.trim() ? errorLike.name.trim() : 'NonError',
      message: typeof errorLike.message === 'string' && errorLike.message.trim()
        ? errorLike.message.trim()
        : fallbackMessage,
      stack: typeof errorLike.stack === 'string' && errorLike.stack.trim() ? errorLike.stack : null
    };
  }

  return {
    name: 'NonError',
    message: String(errorLike),
    stack: null
  };
}

function buildCrashLogMessage(kind, errorLike, context = {}) {
  const error = normalizeErrorLike(errorLike);
  const lines = [
    `[FATAL] [MainProcess] ${kind}: ${error.message}`
  ];

  if (error.name && error.name !== 'Error') {
    lines.push(`[FATAL] [MainProcess] error_name=${error.name}`);
  }

  if (context.origin) {
    lines.push(`[FATAL] [MainProcess] origin=${context.origin}`);
  }

  if (context.mode) {
    lines.push(`[FATAL] [MainProcess] mode=${context.mode}`);
  }

  if (Array.isArray(context.argv)) {
    lines.push(`[FATAL] [MainProcess] argv=${JSON.stringify(context.argv)}`);
  }

  if (context.execPath) {
    lines.push(`[FATAL] [MainProcess] execPath=${context.execPath}`);
  }

  if (context.appPath) {
    lines.push(`[FATAL] [MainProcess] appPath=${context.appPath}`);
  }

  if (context.lastPage) {
    lines.push(`[FATAL] [MainProcess] lastPage=${context.lastPage}`);
  }

  if (context.lastRendererLog) {
    lines.push(`[FATAL] [MainProcess] lastRendererLog=${context.lastRendererLog}`);
  }

  if (context.extra && typeof context.extra === 'object') {
    try {
      lines.push(`[FATAL] [MainProcess] extra=${JSON.stringify(context.extra)}`);
    } catch (serializationError) {
      lines.push('[FATAL] [MainProcess] extra=[unserializable]');
    }
  }

  if (error.stack) {
    lines.push('[FATAL] [MainProcess] stack:');
    lines.push(error.stack);
  }

  return lines.join('\n');
}

function buildUpdaterFailureLogMessage(errorLike) {
  const error = normalizeErrorLike(errorLike);
  const compactMessage = String(error.message || 'Unknown updater error')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || 'Unknown updater error';

  return `[WARN] [Updater] Check failed: ${compactMessage}`;
}

function buildSupportExportFolderName(date = new Date(), fingerprint = 'MKPSE-GEN-UNKNOWN') {
  const safeFingerprint = String(fingerprint || 'MKPSE-GEN-UNKNOWN')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase() || 'MKPSE-GEN-UNKNOWN';
  return [
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`,
    `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`,
    safeFingerprint
  ].join('_');
}

function compactDiagnosticLine(line = '') {
  const normalized = normalizeLogContent(line)
    .split('\n')
    .map((entry) => entry.trim())
    .find(Boolean) || '';

  if (!normalized) {
    return '';
  }

  const compact = normalized
    .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
    .replace(/argv=\[[^\]]*\]/g, 'argv=[...]')
    .replace(/[A-Za-z]:\\[^"' )]+/g, '<path>')
    .replace(/\/(?:Users|home|var|tmp|private|Volumes)[^"' )]*/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim();

  return compact.length > 120 ? `${compact.slice(0, 117).trimEnd()}...` : compact;
}

function findLastMatchingLine(content = '', matcher = () => false) {
  const lines = normalizeLogContent(content).split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (matcher(lines[index])) {
      return lines[index];
    }
  }
  return '';
}

function buildGuiDiagnosticHeadline(snapshot = {}) {
  const guiLogExcerpt = String(snapshot.guiLogExcerpt || '');
  const fatalLine = findLastMatchingLine(guiLogExcerpt, (line) => line.includes('[FATAL]'));
  if (fatalLine) {
    return {
      severity: 'fatal',
      line: compactDiagnosticLine(fatalLine),
      summary: `GUI 最近一次异常：${compactDiagnosticLine(fatalLine)}`
    };
  }

  const errorLine = findLastMatchingLine(guiLogExcerpt, (line) => line.includes('[ERROR]'));
  if (errorLine) {
    return {
      severity: 'error',
      line: compactDiagnosticLine(errorLine),
      summary: `GUI 最近一次异常：${compactDiagnosticLine(errorLine)}`
    };
  }

  const warnLine = findLastMatchingLine(guiLogExcerpt, (line) => line.includes('[WARN]'));
  if (warnLine) {
    return {
      severity: 'warn',
      line: compactDiagnosticLine(warnLine),
      summary: `GUI 最近一次告警：${compactDiagnosticLine(warnLine)}`
    };
  }

  if (snapshot.lastPage) {
    return {
      severity: 'info',
      line: String(snapshot.lastPage),
      summary: `GUI 最近一次状态：停留在 ${String(snapshot.lastPage)} 页面`
    };
  }

  if (snapshot.lastRendererLog) {
    return {
      severity: 'info',
      line: compactDiagnosticLine(snapshot.lastRendererLog),
      summary: `GUI 最近一次状态：${compactDiagnosticLine(snapshot.lastRendererLog)}`
    };
  }

  return {
    severity: 'none',
    line: '',
    summary: 'GUI 最近一次状态：未发现异常'
  };
}

function buildCliDiagnosticHeadline(snapshot = {}) {
  const cliLogExcerpt = String(snapshot.cliLogExcerpt || '');
  const fatalLine = findLastMatchingLine(cliLogExcerpt, (line) => doesCliLineIndicateFatal(line));
  if (fatalLine) {
    return {
      severity: 'fatal',
      line: compactDiagnosticLine(fatalLine),
      summary: `CLI 最近一次异常：${compactDiagnosticLine(fatalLine)}`
    };
  }

  const errorLine = findLastMatchingLine(cliLogExcerpt, (line) => doesCliLineIndicateError(line));
  if (errorLine) {
    return {
      severity: 'error',
      line: compactDiagnosticLine(errorLine),
      summary: `CLI 最近一次异常：${compactDiagnosticLine(errorLine)}`
    };
  }

  const warnLine = findLastMatchingLine(cliLogExcerpt, (line) => doesCliLineIndicateWarning(line));
  if (warnLine) {
    return {
      severity: 'warn',
      line: compactDiagnosticLine(warnLine),
      summary: `CLI 最近一次告警：${compactDiagnosticLine(warnLine)}`
    };
  }

  if (/report status=completed|wrote output=/i.test(cliLogExcerpt)) {
    return {
      severity: 'info',
      line: 'completed',
      summary: 'CLI 最近一次处理：已完成'
    };
  }

  if (/\[INFO\]\s+\[CLI\]\s+start/i.test(cliLogExcerpt)) {
    return {
      severity: 'info',
      line: 'started',
      summary: 'CLI 最近一次处理：已启动，未发现完成记录'
    };
  }

  return {
    severity: 'none',
    line: '',
    summary: 'CLI 最近一次处理：暂无记录'
  };
}

function resolveFingerprintScope(guiHeadline, cliHeadline) {
  if (cliHeadline && ['fatal', 'error', 'warn'].includes(cliHeadline.severity)) {
    return 'CLI';
  }

  if (guiHeadline && ['fatal', 'error', 'warn'].includes(guiHeadline.severity)) {
    return 'GUI';
  }

  return 'GEN';
}

function buildIssueFingerprint(snapshot = {}) {
  const guiHeadline = buildGuiDiagnosticHeadline(snapshot);
  const cliHeadline = buildCliDiagnosticHeadline(snapshot);
  const scope = resolveFingerprintScope(guiHeadline, cliHeadline);
  const runtime = snapshot.runtime && typeof snapshot.runtime === 'object' ? snapshot.runtime : {};
  const signatureSource = JSON.stringify({
    scope,
    appVersion: snapshot.appVersion || runtime.appVersion || '',
    platform: runtime.platform || '',
    arch: runtime.arch || '',
    lastPage: snapshot.lastPage || '',
    lastRendererLog: compactDiagnosticLine(snapshot.lastRendererLog || ''),
    gui: guiHeadline.line,
    cli: cliHeadline.line
  });
  const digest = crypto.createHash('sha1').update(signatureSource).digest('hex').slice(0, 8).toUpperCase();
  return `MKPSE-${scope}-${digest}`;
}

function buildDiagnosticSummary(snapshot = {}) {
  const guiHeadline = buildGuiDiagnosticHeadline(snapshot);
  const cliHeadline = buildCliDiagnosticHeadline(snapshot);
  return `${guiHeadline.summary}；${cliHeadline.summary}。`;
}

function buildSupportRequestText(snapshot = {}, fingerprint = '', summary = '') {
  const runtime = snapshot.runtime && typeof snapshot.runtime === 'object' ? snapshot.runtime : {};
  const appVersion = snapshot.appVersion || runtime.appVersion || '未知版本';
  const runtimeLabel = [runtime.platform, runtime.arch].filter(Boolean).join(' ') || '未知环境';
  const conciseSummary = String(summary || '').trim();
  return `我在 MKPSE (MKP SupportE) v${appVersion} (${runtimeLabel}) 上遇到问题，问题指纹为 ${fingerprint}。${conciseSummary} 诊断包里已附上 mkpse_gui.log 和 mkpse_cli.log，请协助排查。`;
}

function buildSupportLogFileContent(scope = 'gui', excerpt = '', meta = {}) {
  const normalizedScope = normalizeLogScope(scope);
  const label = normalizedScope.toUpperCase();
  const body = sliceTrailingLines(excerpt, Number.MAX_SAFE_INTEGER);
  const headerLines = [`# MKPSE ${label} log excerpt`];
  const totalLines = Number.isFinite(meta.totalLines) ? Math.max(0, Number(meta.totalLines)) : null;
  const retainedLines = Number.isFinite(meta.retainedLines) ? Math.max(0, Number(meta.retainedLines)) : null;

  if (retainedLines !== null || totalLines !== null) {
    const safeRetainedLines = retainedLines ?? 0;
    const safeTotalLines = totalLines ?? safeRetainedLines;
    headerLines.push(
      `# retained lines: ${safeRetainedLines}/${Math.max(safeRetainedLines, safeTotalLines)}${meta.truncated ? ' (truncated)' : ''}`
    );
  }

  if (meta.latestSessionOnly === true) {
    headerLines.push('# latest session only: yes');
  }

  if (typeof meta.issueDetected === 'boolean') {
    headerLines.push(`# issue detected: ${meta.issueDetected ? 'yes' : 'no'}`);
  }

  if (!body) {
    return `${headerLines.join('\n')}\n# No ${normalizedScope} log lines were captured for this export.\n`;
  }

  return `${headerLines.join('\n')}\n${body}\n`;
}

function buildSupportBundle(snapshot = {}, options = {}) {
  const date = options.date instanceof Date ? options.date : new Date();
  const fingerprint = buildIssueFingerprint(snapshot);
  const summary = buildDiagnosticSummary(snapshot);
  const requestText = buildSupportRequestText(snapshot, fingerprint, summary);

  return {
    fingerprint,
    summary,
    folderName: buildSupportExportFolderName(date, fingerprint),
    files: [
      {
        name: 'README_MKPSE_求助.txt',
        content: [
          'MKPSE 智能诊断包',
          `导出时间: ${date.toLocaleString('zh-CN')}`,
          `问题指纹: ${fingerprint}`,
          `一句结论: ${summary}`,
          '',
          '建议发群文本:',
          requestText,
          '',
          '说明:',
          '本次导出只包含摘要、GUI 日志节选、CLI 日志节选，不包含模型数据。'
        ].join('\n')
      },
      {
        name: 'mkpse_gui.log',
        content: buildSupportLogFileContent('gui', snapshot.guiLogExcerpt, snapshot.guiLogMeta)
      },
      {
        name: 'mkpse_cli.log',
        content: buildSupportLogFileContent('cli', snapshot.cliLogExcerpt, snapshot.cliLogMeta)
      }
    ]
  };
}

module.exports = {
  buildSupportBundle,
  buildCrashLogMessage,
  buildDailyLogFileName,
  buildGuiRelaunchArgs,
  buildLogFilePath,
  buildLogTimestamp,
  buildScopedDailyLogFileName,
  buildScopedLogFilePath,
  buildPrefixedLogLines,
  collectScopedLogExcerpt,
  buildUpdaterFailureLogMessage
};
