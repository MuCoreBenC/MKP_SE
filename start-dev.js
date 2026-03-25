#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const DEV_SERVER_HOST = '127.0.0.1';
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

const vitePackageRoot = path.dirname(require.resolve('vite/package.json'));
const viteCliPath = path.join(vitePackageRoot, 'bin', 'vite.js');

let viteProcess = null;
let electronProcess = null;
let isShuttingDown = false;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveElectronExecutablePath() {
  try {
    const electronExecutablePath = require('electron');
    if (typeof electronExecutablePath !== 'string' || !fs.existsSync(electronExecutablePath)) {
      throw new Error('Electron executable missing');
    }

    return electronExecutablePath;
  } catch (error) {
    throw new Error('Electron 未正确安装，请先运行 npm install。');
  }
}

function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(DEV_SERVER_URL, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(2_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForDevServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await isServerReady()) {
      return;
    }

    if (viteProcess?.exitCode !== null) {
      throw new Error('Vite 开发服务器启动失败。');
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(`等待 Vite 启动超时：${DEV_SERVER_URL}`);
}

function terminateProcessTree(childProcess) {
  if (!childProcess?.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: true
    });
    return;
  }

  childProcess.kill('SIGTERM');
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  terminateProcessTree(electronProcess);
  terminateProcessTree(viteProcess);

  setTimeout(() => {
    process.exit(exitCode);
  }, 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

viteProcess = spawn(
  process.execPath,
  [viteCliPath, '--host', DEV_SERVER_HOST, '--port', String(DEV_SERVER_PORT), '--strictPort'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  }
);

viteProcess.on('error', (error) => {
  console.error(`启动 Vite 失败: ${error.message}`);
  shutdown(1);
});

viteProcess.on('close', (code) => {
  if (!isShuttingDown) {
    console.error(`Vite 进程提前退出，退出码: ${code ?? 1}`);
    shutdown(code ?? 1);
  }
});

try {
  await waitForDevServer();
} catch (error) {
  console.error(error.message);
  shutdown(1);
}

if (!isShuttingDown) {
  const electronExecutablePath = resolveElectronExecutablePath();
  const electronEnv = { ...process.env, VITE_DEV_SERVER_URL: DEV_SERVER_URL };
  const electronArgs = ['src/main/main.js', ...process.argv.slice(2)];
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  electronProcess = spawn(
    electronExecutablePath,
    electronArgs,
    {
      cwd: process.cwd(),
      env: electronEnv,
      stdio: 'inherit'
    }
  );

  electronProcess.on('error', (error) => {
    console.error(`启动 Electron 失败: ${error.message}`);
    shutdown(1);
  });

  electronProcess.on('close', (code) => {
    shutdown(code ?? 0);
  });
}
