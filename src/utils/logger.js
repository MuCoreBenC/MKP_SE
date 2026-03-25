// src/utils/logger.js

export const Logger = {
  _format(level, message, data) {
    const extra = data ? ` | 附加数据: ${JSON.stringify(data)}` : '';
    const payload = `[${level}] ${message}${extra}`;

    if (level === 'ERROR') {
      console.error(payload);
    } else if (level === 'WARN') {
      console.warn(payload);
    } else {
      console.log(payload);
    }

    // 依然兼容你底层的 Electron API
    if (window.mkpAPI && typeof window.mkpAPI.writeLog === 'function') {
      window.mkpAPI.writeLog(payload);
    }
  },
  info(message, data) {
    this._format('INFO', message, data);
  },
  warn(message, data) {
    this._format('WARN', message, data);
  },
  error(message, data) {
    this._format('ERROR', message, data);
  }
};

// 为了兼容你以前那些直接写 window.Logger 的旧代码
window.Logger = Logger;