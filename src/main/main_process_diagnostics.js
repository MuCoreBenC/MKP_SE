const path = require('path');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildDailyLogFileName(date = new Date()) {
  return `mkp_${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.log`;
}

function buildLogTimestamp(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function buildLogFilePath(userDataPath, date = new Date()) {
  return path.join(userDataPath, 'Logs', buildDailyLogFileName(date));
}

function buildPrefixedLogLines(message, date = new Date()) {
  const timestamp = buildLogTimestamp(date);
  const normalized = String(message ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  return `${lines.map((line) => `[${timestamp}] ${line}`).join('\n')}\n`;
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

module.exports = {
  buildCrashLogMessage,
  buildDailyLogFileName,
  buildGuiRelaunchArgs,
  buildLogFilePath,
  buildLogTimestamp,
  buildPrefixedLogLines,
  buildUpdaterFailureLogMessage
};
