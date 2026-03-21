import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';
import { USER_CONFIG_STORAGE_KEY } from '../../../../src/renderer/app/services/user-config-service';
import { SYNC_KEYS } from '../../../../src/renderer/app/sync/cross-window-sync-service';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [
      { id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu牌', favorite: true }
    ],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: 'assets/images/a1.webp',
          favorite: true,
          supportedVersions: ['standard', 'quick'],
          defaultPresets: {
            standard: 'a1_standard_v3.0.0-r1.json',
            quick: 'a1_quick_v3.0.0-r1.json'
          }
        }
      ]
    },
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      })
    },
    addEventListener: vi.fn()
  } as unknown as Window & typeof globalThis;
}

describe('renderer entry integration smoke', () => {
  it('keeps index.html download and params anchors aligned with modern runtime bridge helpers', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toContain('id="downloadVersionList"');
    expect(html).toContain('id="localPresetsList"');
    expect(html).toContain('id="currentEditingFile"');
  });

  it('keeps the download page runtime wired to the bundled React loader with legacy fallback protection', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const downloadPageSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/download/DownloadPage.tsx', 'utf8');
    const reactEntrySource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/entry/react-pages-entry.tsx', 'utf8');
    const reactRuntimeSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/runtime/react-page-runtime.tsx', 'utf8');
    const localPresetListSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/download/components/LocalPresetList.tsx', 'utf8');
    const onlinePresetListSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/download/components/OnlinePresetList.tsx', 'utf8');
    const actionHookSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/hooks/usePresetActions.ts', 'utf8');
    const onlineListHookSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/hooks/useOnlinePresetList.ts', 'utf8');

    expect(html).toContain('id="page-download" class="page flex-1 hidden" data-fixed-header="true">');
    expect(html).toContain('id="react-download-page-root" class="mkp-react-page-root hidden"');
    expect(html).toContain('id="downloadLegacyShell"');
    expect(html).toContain('attachDownloadPageLegacyShell');
    expect(html).toContain('id="react-calibrate-page-root" class="mkp-react-page-root hidden"');
    expect(html).toContain('id="calibrateLegacyShell" class="mkp-react-page-legacy-shell hidden"');
    expect(html).toContain('id="react-params-page-root" class="mkp-react-page-root hidden"');
    expect(html).toContain('id="paramsLegacyShell" class="mkp-react-page-legacy-shell"');
    expect(html).toContain('id="react-setting-page-root" class="mkp-react-page-root hidden"');
    expect(html).toContain('id="settingLegacyShell" class="mkp-react-page-legacy-shell"');
    expect(html).toContain('assets/js/generated/renderer-runtime.bundle.js');
    expect(html).toContain('assets/js/generated/react-pages.bundle.js');
    expect(html).toContain("window.process = window.process || { env: { NODE_ENV: 'production' } };");
    expect(html).toContain('window.MKPModernRendererRuntime?.mountModernRuntime');
    expect(html).toContain('mountRegisteredReactPages(document);');
    expect(html).not.toContain("import { mountDownloadReactPage } from './react-app/entry/download-page-entry.tsx';");
    expect(html).not.toContain("import { mountModernRuntime } from './app/entry/renderer-runtime.ts';");
    expect(downloadPageSource).toContain('page-header page-header-fixed-shell');
    expect(downloadPageSource).toContain('page-content hide-scrollbar');
    expect(reactEntrySource).toContain('mountDownloadReactPage');
    expect(reactEntrySource).toContain('mountCalibrateReactPage');
    expect(reactEntrySource).toContain('mountParamsReactPage');
    expect(reactEntrySource).toContain('mountSettingReactPage');
    expect(reactEntrySource).toContain('mountRegisteredReactPages');
    expect(reactRuntimeSource).toContain('ReactPageErrorBoundary');
    expect(reactEntrySource).toContain('ReadySignal');
    expect(reactRuntimeSource).toContain('LegacyShellBridge');
    expect(reactRuntimeSource).toContain('createReactPageMount');
    expect(reactEntrySource).toContain('window.MKPReactPagesBundle');
    expect(localPresetListSource).toContain('applyLocalPreset');
    expect(localPresetListSource).toContain('应用');
    expect(localPresetListSource).toContain('复制');
    expect(localPresetListSource).toContain('删除');
    expect(onlinePresetListSource).toContain('下载');
    expect(onlinePresetListSource).toContain('检查预设');
    expect(onlinePresetListSource).toContain('useOnlinePresetList');
    expect(onlinePresetListSource).toContain('正在读取在线预设列表');
    expect(onlinePresetListSource).toContain('当前版本上下文下没有可显示的在线预设');
    expect(onlinePresetListSource).toContain('最新');
    expect(actionHookSource).toContain('duplicateLocalPreset');
    expect(actionHookSource).toContain('deleteLocalPreset');
    expect(actionHookSource).toContain('downloadOnlinePreset');
    expect(actionHookSource).toContain('refreshOnlinePresets');
    expect(onlineListHookSource).toContain('readBundledPresetsManifest');
  });

  it('mounts the bridge helpers consumed by legacy download and params pages from the runtime entry surface', () => {
    const targetWindow = createWindowStub();

    mountModernRuntime(targetWindow);

    expect(targetWindow.__getDownloadContextView__?.()).toMatchObject({
      printer: expect.objectContaining({ id: 'a1', brandId: 'bambu' }),
      selectedVersionType: 'standard'
    });
    expect(targetWindow.__getActivePresetView__?.()).toBeNull();
    expect(targetWindow.__getParamsPresetView__?.()).toEqual(targetWindow.__getActivePresetView__?.());
    expect(targetWindow.resolveActivePresetFileName?.(targetWindow, 'legacy.json')).toBe('legacy.json');
    expect(targetWindow.resolveParamsDisplayFileName?.(targetWindow, 'C:\\legacy\\fallback.json')).toBe('fallback.json');
  });

  it('recovers from corrupted persisted user config and sync-envelope user config payloads without breaking bootstrap', () => {
    const corruptedStorage = new Map<string, string>([
      [USER_CONFIG_STORAGE_KEY, JSON.stringify({ broken: true })],
      [
        SYNC_KEYS.userConfig,
        JSON.stringify({
          type: 'user-config-updated',
          sourceWindowId: 'renderer_other',
          timestamp: 1742083200000,
          payload: {
            selectedBrandId: 'bambu',
            selectedPrinterId: 'a1',
            selectedVersionType: 'quick',
            appliedPresetByContext: {},
            onboardingEnabled: true,
            updateMode: 'manual',
            themeMode: 'system',
            dockAnimationEnabled: true,
            dockBaseSize: 38,
            dockMaxScale: 1.5,
            updatedAt: '2026-03-15T00:00:00.000Z'
          }
        })
      ]
    ]);
    const targetWindow = createWindowStub();
    targetWindow.localStorage = {
      getItem: vi.fn((key: string) => corruptedStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        corruptedStorage.set(key, value);
      })
    } as unknown as Storage;

    expect(() => mountModernRuntime(targetWindow)).not.toThrow();
    expect(targetWindow.__getDownloadContextView__?.()).toMatchObject({
      selectedVersionType: 'quick'
    });
  });
});
