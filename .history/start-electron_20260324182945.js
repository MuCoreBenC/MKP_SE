#!/usr/bin/env node

import { spawn } from 'node:child_process';

// 直接使用 npx 运行 Electron
const electronProcess = spawn('npx', ['electron@latest', 'src/main/main.js'], {
  stdio: 'inherit',
  shell: true
});

electronProcess.on('error', (error) => {
  console.error('启动 Electron 失败:', error.message);
  process.exit(1);
});

electronProcess.on('close', (code) => {
  console.log(`Electron 进程退出，退出码: ${code}`);
  process.exit(code);
});
