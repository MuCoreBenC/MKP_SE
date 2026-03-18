import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { mountModernRuntime } from '../../../../src/renderer/app/entry/renderer-runtime';

function createWindowStub() {
  const storage = new Map<string, string>();

  return {
    APP_REAL_VERSION: '0.2.10',
    brands: [
      { id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true }
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

    expect(html).toContain("id=\"downloadVersionList\"");
    expect(html).toContain("id=\"localPresetsList\"");
    expect(html).toContain("id=\"currentEditingFile\"");
  });

  it('keeps the React download-page entry and local preset list action shell wired into the renderer source tree', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const localPresetListSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/download/components/LocalPresetList.tsx', 'utf8');
    const onlinePresetListSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/download/components/OnlinePresetList.tsx', 'utf8');
    const actionHookSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/hooks/usePresetActions.ts', 'utf8');
    const onlineListHookSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/hooks/useOnlinePresetList.ts', 'utf8');

    expect(html).toContain('react-download-page-root');
    expect(localPresetListSource).toContain('applyLocalPreset');
    expect(localPresetListSource).toContain('应用');
    expect(localPresetListSource).toContain('复制');
    expect(localPresetListSource).toContain('删除');
    expect(onlinePresetListSource).toContain('下载');
    expect(onlinePresetListSource).toContain('检查更新');
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
});
