import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('updates.js modern runtime smoke', () => {
  it('wires legacy updates page logic to modern runtime update helpers', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');

    expect(source).toMatch(/__parseUpdateManifestForLegacy__|__checkAppUpdateForLegacy__/);
    expect(source).toMatch(/__getAppUpdateStateView__/);
    expect(source).toMatch(/__getUpdateModeView__|__setUpdateModeForLegacy__/);
    expect(source).toMatch(/__getCachedUpdateManifestView__/);
  });

  it('uses modern currentVersion state in the final active update badge flow before falling back to APP_REAL_VERSION', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalBadgeBlock = source.slice(source.lastIndexOf('function hydrateCachedAppUpdateBadge()'));
    const finalSilentCheckBlock = source.slice(source.lastIndexOf('async function silentCheckForUpdate('));

    expect(finalBadgeBlock).toMatch(/currentVersion/);
    expect(finalBadgeBlock).toMatch(/cached\.currentVersion\s*\|\|\s*APP_REAL_VERSION/);
    expect(finalSilentCheckBlock).toMatch(/cachedState\.currentVersion\s*\|\|\s*APP_REAL_VERSION/);
  });

  it('prefers modern update mode in the final active init flow before consulting the legacy init key', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalInitBlock = source.slice(
      source.lastIndexOf('function initUpdateModeSetting()'),
      source.lastIndexOf('async function silentCheckForUpdate(')
    );

    expect(finalInitBlock).toMatch(/const modernMode = readModernUpdateMode\(\)/);
    expect(finalInitBlock).toMatch(/let savedMode = modernMode;/);
    expect(finalInitBlock).toMatch(/if\s*\(modernMode\)\s*\{/);
    expect(finalInitBlock).toMatch(/else\s*\{[\s\S]*localStorage\.getItem\(APP_UPDATE_MODE_KEY\)/);
    expect(finalInitBlock).toMatch(/else\s*\{[\s\S]*APP_UPDATE_MODE_INIT_V2_KEY/);
  });

  it('prefers modern hasUpdate state in the final badge bootstrap before falling back to legacy cached version comparison', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalBadgeBlock = source.slice(
      source.lastIndexOf('function hydrateCachedAppUpdateBadge()'),
      source.lastIndexOf('async function loadLocalManifest()')
    );
    const finalSilentCheckBlock = source.slice(source.lastIndexOf('async function silentCheckForUpdate('));

    expect(finalBadgeBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(finalBadgeBlock).toMatch(/if \(modernState\) \{/);
    expect(finalBadgeBlock).toMatch(/applyAppUpdateBadge\(\!\!modernState\.hasUpdate\)/);
    expect(finalBadgeBlock).toMatch(/readLegacyAppUpdateState/);
    expect(finalSilentCheckBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(finalSilentCheckBlock).toMatch(/applyAppUpdateBadge\(\!\!modernState\.hasUpdate\)/);
    expect(finalSilentCheckBlock).toMatch(/readLegacyAppUpdateState/);
  });

  it('avoids duplicate legacy update-state cache writes when modern update state is already available', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const persistBlock = source.slice(
      source.lastIndexOf('function persistAppUpdateState('),
      source.lastIndexOf('function readModernAppUpdateState(')
    );

    expect(persistBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(persistBlock).toMatch(/if\s*\(modernState\)\s*\{\s*return state;/);
    expect(persistBlock).toMatch(/localStorage\.setItem\(APP_UPDATE_STATE_KEY,\s*JSON\.stringify\(state\)\)/);
  });

  it('treats any modern update-state snapshot as authoritative before writing legacy cache', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const persistBlock = source.slice(
      source.lastIndexOf('function persistAppUpdateState('),
      source.lastIndexOf('function readModernAppUpdateState(')
    );

    expect(persistBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(persistBlock).toMatch(/if\s*\(modernState\)\s*\{\s*return state;/);
  });

  it('accepts any modern update-state view snapshot in readModernAppUpdateState instead of requiring latestVersion', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const modernStateBlock = source.slice(
      source.lastIndexOf('function readModernAppUpdateState()'),
      source.lastIndexOf('function readModernUpdateMode()')
    );

    expect(modernStateBlock).toMatch(/const view = typeof window\.__getAppUpdateStateView__ === 'function'/);
    expect(modernStateBlock).toMatch(/if \(!view\) \{/);
    expect(modernStateBlock).not.toMatch(/if \(!view\?\.latestVersion\)/);
  });

  it('treats any modern update-state snapshot as authoritative in readAppUpdateState', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const readStateBlock = source.slice(
      source.lastIndexOf('function readAppUpdateState()'),
      source.lastIndexOf('function readLegacyAppUpdateState()')
    );

    expect(readStateBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(readStateBlock).toMatch(/if \(modernState\) \{/);
    expect(readStateBlock).toMatch(/return modernState;/);
    expect(readStateBlock).not.toMatch(/modernState\?\.latestVersion/);
  });

  it('avoids duplicate legacy update-mode writes when the modern update-mode bridge is available', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const saveBlock = source.slice(
      source.lastIndexOf('function saveUpdateMode('),
      source.lastIndexOf('function initUpdateModeSetting()')
    );

    expect(saveBlock).toMatch(/if\s*\(typeof window\.__setUpdateModeForLegacy__ === 'function'\)\s*\{/);
    expect(saveBlock).toMatch(/window\.__setUpdateModeForLegacy__\(mode\);\s*silentCheckForUpdate\(mode,\s*\{\s*force:\s*true\s*\}\);\s*return;/);
    expect(saveBlock).toMatch(/localStorage\.setItem\(APP_UPDATE_MODE_KEY,\s*mode\)/);
    expect(saveBlock).toMatch(/localStorage\.setItem\(APP_UPDATE_MODE_INIT_V2_KEY,\s*'true'\)/);
  });

  it('avoids duplicate legacy update-mode cache writes during init when modern mode is already available', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const initBlock = source.slice(
      source.lastIndexOf('function initUpdateModeSetting()'),
      source.lastIndexOf('async function silentCheckForUpdate(')
    );

    expect(initBlock).toMatch(/const modernMode = readModernUpdateMode\(\)/);
    expect(initBlock).toMatch(/if\s*\(modernMode\)\s*\{\s*savedMode = modernMode;\s*\}/);
    expect(initBlock).toMatch(/else\s*\{[\s\S]*localStorage\.setItem\(APP_UPDATE_MODE_KEY,\s*savedMode\)/);
    expect(initBlock).toMatch(/else\s*\{[\s\S]*APP_UPDATE_MODE_INIT_V2_KEY/);
  });

  it('uses the resolved modern manifest description in parseManifestToUI before falling back to the legacy raw manifest', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const parseBlock = source.slice(
      source.lastIndexOf('function parseManifestToUI('),
      source.lastIndexOf('function persistAppUpdateState(')
    );

    expect(parseBlock).toMatch(/const resolvedManifest = resolveModernUpdateManifest\(manifest\)/);
    expect(parseBlock).toMatch(/desc:\s*resolvedManifest\.shortDesc\s*\|\|/);
  });

  it('preserves the manual-mode early return in the final active silent update check flow', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalSilentCheckBlock = source.slice(source.lastIndexOf('async function silentCheckForUpdate('));

    expect(finalSilentCheckBlock).toMatch(/if\s*\(mode === 'manual'\)\s*\{/);
    expect(finalSilentCheckBlock).toMatch(/hydrateCachedAppUpdateBadge\(\);\s*return;/);
  });

  it('uses the resolved modern manifest fields in the final active manual update check flow', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const manualCheckBlock = source.slice(
      source.lastIndexOf('async function manualCheckAppUpdate('),
      source.lastIndexOf('window.saveUpdateMode = saveUpdateMode;')
    );

    expect(manualCheckBlock).toMatch(/const resolvedManifest = resolveModernUpdateManifest\(remoteManifest\) \|\| remoteManifest/);
    expect(manualCheckBlock).toMatch(/saveCloudManifestToLocal\(resolvedManifest\)/);
    expect(manualCheckBlock).toMatch(/normalizeAppVersion\(resolvedManifest\.latestVersion\)/);
    expect(manualCheckBlock).toMatch(/resolvedManifest\.shortDesc/);
    expect(manualCheckBlock).toMatch(/parseManifestToUI\(resolvedManifest,\s*currentAppVersion\)/);
    expect(manualCheckBlock).toMatch(/syncAppUpdateState\(resolvedManifest,\s*currentAppVersion\)/);
    expect(manualCheckBlock).toMatch(/buildPatchUrlCandidates\(resolvedManifest\.downloadUrl\)/);
  });

  it('uses the resolved modern manifest throughout the final active silent update check fetch flow', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalSilentCheckBlock = source.slice(source.lastIndexOf('async function silentCheckForUpdate('));

    expect(finalSilentCheckBlock).toMatch(/const resolvedManifest = resolveModernUpdateManifest\(manifest\) \|\| manifest/);
    expect(finalSilentCheckBlock).toMatch(/saveCloudManifestToLocal\(resolvedManifest\)/);
    expect(finalSilentCheckBlock).toMatch(/syncAppUpdateState\(resolvedManifest,\s*currentVersion\)/);
    expect(finalSilentCheckBlock).toMatch(/parseManifestToUI\(resolvedManifest,\s*currentVersion\)/);
  });

  it('treats any modern update-state snapshot as authoritative in the final silent check bootstrap path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');
    const finalSilentCheckBlock = source.slice(source.lastIndexOf('async function silentCheckForUpdate('));

    expect(finalSilentCheckBlock).toMatch(/const modernState = readModernAppUpdateState\(\)/);
    expect(finalSilentCheckBlock).toMatch(/const cachedState = modernState \|\| readLegacyAppUpdateState\(\)/);
  });

  it('keeps modern manifest parsing and modern update-state reading on the same legacy bridge helper family', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/updates.js', 'utf8');

    expect(source).toMatch(/__parseUpdateManifestForLegacy__/);
    expect(source).toMatch(/__checkAppUpdateForLegacy__/);
    expect(source).toMatch(/__getAppUpdateStateView__/);
    expect(source).toMatch(/__getCachedUpdateManifestView__/);
  });
});
