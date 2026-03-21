import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('index.html modern runtime smoke', () => {
  it('wires the renderer html entry to the modern runtime bootstrap path', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toMatch(/mountModernRuntime|renderer-runtime\.ts|__MKP_MODERN_RUNTIME__/);
  });

  it('keeps the modern bridge bootstrap reachable from the renderer html entry', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toContain("window.process = window.process || { env: { NODE_ENV: 'production' } };");
    expect(html).toContain('assets/js/generated/renderer-runtime.bundle.js');
    expect(html).toContain('assets/js/generated/react-pages.bundle.js');
    expect(html).toContain('window.MKPModernRendererRuntime?.mountModernRuntime');
    expect(html).toContain('window.MKPReactPagesBundle?.mountRegisteredReactPages');
    expect(html).not.toContain("import { mountModernRuntime } from './app/entry/renderer-runtime.ts';");
    expect(html).toMatch(/mountModernRuntime\(window\)/);
    expect(html).toMatch(/mountRegisteredReactPages\(document\)/);
    expect(html).toMatch(/react-download-page-root/);
    expect(html).toMatch(/react-calibrate-page-root/);
    expect(html).toMatch(/react-params-page-root/);
    expect(html).toMatch(/react-setting-page-root/);
    expect(html).toMatch(/mkp-react-page-root/);
    expect(html).toMatch(/mkp-react-page-legacy-shell/);
    expect(html).toMatch(/bootstrap failed/);
  });

  it('keeps the local preset toolbar on a single row with inline search and overflow sort menu', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toMatch(/class="local-preset-toolbar mb-4"/);
    expect(html).toMatch(/class="local-preset-toolbar__meta"/);
    expect(html).toMatch(/id="localPresetInfoAnchor"[\s\S]*data-tip-title="本地预设说明"/);
    expect(html).toMatch(/本地预设<\/h2>[\s\S]*id="localPresetInfoAnchor"/);
    expect(html).not.toMatch(/id="localBatchSummary"/);
    expect(html).not.toMatch(/已下载到本机的配置/);
    expect(html).toMatch(/class="local-search-shell"/);
    expect(html).toMatch(/id="localSearchWrapper"[\s\S]*class="hidden local-search-inline animate-scale-in origin-right"/);
    expect(html).toMatch(/class="local-search-inline__field"/);
    expect(html).toMatch(/id="btnLocalSearchToggle"/);
    expect(html).toMatch(/data-local-search-toggle-icon/);
    expect(html).toMatch(/id="localSearchWrapper"[\s\S]*id="localSearchInput"[\s\S]*id="btnLocalSearchToggle"/);
    expect(html).toMatch(/id="btnMultiSelect"[\s\S]*viewBox="0 0 1024 1024"/);
    expect(html).toMatch(/321\.28 724\.032a32 32 0 0 1 3\.712 40\.832/);
    expect(html).toMatch(/id="btnLocalToolbarMore"/);
    expect(html).toMatch(/id="localToolbarMenu"[\s\S]*data-floating-surface="true"/);
    expect(html).toMatch(/data-local-sort-option="custom"/);
    expect(html).toMatch(/data-local-sort-option="version-desc"/);
    expect(html).toMatch(/data-local-sort-option="updated-desc"/);
    expect(html).toMatch(/data-local-sort-option="name-asc"/);
    expect(html).toMatch(/id="localHeaderBatchControls"/);
    expect(html).toMatch(/id="btnSelectAllLocal"[\s\S]*>全选</);
    expect(html).toMatch(/id="btnInvertLocal"[\s\S]*>反选</);
    expect(html).toMatch(/id="btnBatchDelete"[\s\S]*>删除</);
    expect(html).not.toMatch(/id="btnBatchDuplicate"/);
    expect(html).not.toMatch(/id="localBatchToolbar"/);
    expect(html).not.toMatch(/id="localSortSelect"/);
    expect(html).not.toMatch(/id="localManagerDivider"/);
    expect(html).not.toMatch(/local-preset-toolbar__head/);
    expect(html).not.toMatch(/local-preset-toolbar__foot/);
    expect(html).not.toMatch(/localSearchWrapper"[\s\S]*local-search-popover/);
    expect(html).toMatch(/id="checkUpdateBtn"[\s\S]*whitespace-nowrap/);
  });
});
