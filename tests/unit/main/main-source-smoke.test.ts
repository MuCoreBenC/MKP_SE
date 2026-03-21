import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('main.js source smoke', () => {
  it('guards duplicate-preset against null version types before composing the copied file name', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');

    expect(source).toMatch(/ipcMain\.handle\('duplicate-preset'/);
    expect(source).toMatch(/let resolvedVersionType = typeof versionType === 'string' \? versionType\.trim\(\) : '';/);
    expect(source).toMatch(/resolvedVersionType\.toLowerCase\(\) === 'null'/);
    expect(source).toMatch(/new RegExp\(`\^\$\{escapedPrinterId\}_\(\[\^_\]\+\)_v`, 'i'\)/);
    expect(source).toMatch(/if \(!resolvedVersionType\) \{\s*resolvedVersionType = 'standard';\s*\}/);
    expect(source).toMatch(/const newFileName = `\$\{normalizedPrinterId\}_\$\{resolvedVersionType\}_v\$\{realVersion\}_\$\{ts\}\.json`;/);
  });

  it('exposes presetType from json content so malformed legacy duplicate files can still render in the right version tab', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');

    expect(source).toMatch(/ipcMain\.handle\('list-local-presets-detailed'/);
    expect(source).toMatch(/presetType: jsonData && typeof jsonData\.type === 'string' \? jsonData\.type : null,/);
  });

  it('lazy-loads electron-updater and skips source-mode auto checks before packaged startup is ready', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');

    expect(source).not.toMatch(/const \{ autoUpdater \} = require\('electron-updater'\);/);
    expect(source).toMatch(/function isUpdaterSupportedRuntime\(\)/);
    expect(source).toMatch(/resolveMainProcessMode\(\) === 'gui' && app\.isPackaged && process\.defaultApp !== true/);
    expect(source).toMatch(/function getAutoUpdater\(\)/);
    expect(source).toMatch(/require\('electron-updater'\)/);
    expect(source).toMatch(/\[INFO\] \[Updater\] Skip auto-check/);
    expect(source).toMatch(/checkForUpdatesInBackground\(\);/);
  });
});
