import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('postprocess report window smoke', () => {
  it('freezes the current standalone report as a dedicated legacy baseline file', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/postprocess_report_legacy.html', 'utf8');

    expect(html).toContain('<html lang="zh-CN" data-theme-mode="light">');
    expect(html).toContain("const savedMode = localStorage.getItem('themeMode') || 'light';");
    expect(html).toContain("document.documentElement.setAttribute('data-theme-mode', savedMode);");
    expect(html).toContain("const savedColor = localStorage.getItem('appThemeColor') || 'blue';");
    expect(html).toContain("document.documentElement.style.setProperty('--primary-rgb', palette[savedColor]);");
  });

  it('keeps the legacy report responsive inside narrow windows', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/postprocess_report_legacy.html', 'utf8');

    expect(html).toMatch(/body \{[\s\S]*min-width: 0 !important;/);
    expect(html).toMatch(/body \{[\s\S]*overflow: auto;/);
    expect(html).toMatch(/\.report-shell \{[\s\S]*overflow: visible;/);
    expect(html).toMatch(/\.report-summary \{[\s\S]*flex-wrap: wrap;/);
    expect(html).toMatch(/\.report-actions \{[\s\S]*flex: 1 1 220px;[\s\S]*max-width: 100%;/);
  });

  it('keeps the legacy report header logo and live progress shell intact', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/postprocess_report_legacy.html', 'utf8');

    expect(html).toContain('<img src="assets/images/logo-main.webp" alt="MKP logo">');
    expect(html).toContain('id="progressPanel"');
    expect(html).toContain('id="progressFill"');
    expect(html).toContain('id="progressPercent"');
    expect(html).toContain('id="progressLifecycle"');
    expect(html).toContain('data-stage-start="0" data-stage-end="12"');
    expect(html).toContain('data-stage-start="72" data-stage-end="100"');
  });

  it('gives classic-v2 a single-page boot stage and runtime stage inside one renderer html', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/postprocess_report_v2.html', 'utf8');
    const script = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/postprocess-report-v2.js', 'utf8');

    expect(html).toContain('Classic V2 Preview');
    expect(html).toContain('id="prototypeShell"');
    expect(html).toContain('id="bootStage"');
    expect(html).toContain('class="boot-spinner"');
    expect(html).toContain('id="runtimeStage"');
    expect(html).toContain('id="runtimeContent"');
    expect(html).toContain('id="progressPanel"');
    expect(html).toContain('id="progressFill"');
    expect(html).toContain('id="progressPercent"');
    expect(html).toContain('id="viewToggleButton"');
    expect(script).toContain('const MIN_BOOT_STAGE_MS = 520;');
    expect(script).toContain('function scheduleRuntimeStageReveal() {');
    expect(script).toContain('function animateRuntimeResultSwap(updateFn) {');
    expect(script).toContain("refs.viewToggleButton.textContent = expanded ? '收起详细' : '查看详细';");
  });

  it('routes classic-v2 through a single renderer load while legacy still keeps the bootstrap handoff path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function registerPostprocessReportHandlers() {'),
      source.lastIndexOf('if (isPostprocessReportMode) {')
    );

    expect(source).toContain("const POSTPROCESS_REPORT_UI_VARIANT_LEGACY = 'legacy';");
    expect(source).toContain("const POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2 = 'classic-v2';");
    expect(source).toContain('function resolvePostprocessReportUiVariant(argv = process.argv, env = process.env) {');
    expect(source).toContain('return POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2;');
    expect(source).toContain('function getPostprocessReportWindowMetrics(variant = POSTPROCESS_REPORT_UI_VARIANT_LEGACY) {');
    expect(source).toContain('function resolvePostprocessReportRendererPath(variant = POSTPROCESS_REPORT_UI_VARIANT_LEGACY) {');
    expect(source).toContain("../renderer/postprocess_report_legacy.html");
    expect(source).toContain("../renderer/postprocess_report_v2.html");
    expect(source).toContain('function buildPostprocessReportBootstrapDataUrlLegacy() {');
    expect(source).toContain('function buildPostprocessReportBootstrapDataUrlClassicV2() {');
    expect(source).toContain('function buildPostprocessReportBootstrapDataUrl(variant = postprocessReportUiVariant) {');
    expect(block).toContain('const windowMetrics = getPostprocessReportWindowMetrics(postprocessReportUiVariant);');
    expect(block).toContain('const isClassicV2 = postprocessReportUiVariant === POSTPROCESS_REPORT_UI_VARIANT_CLASSIC_V2;');
    expect(block).toContain('const loadLivePostprocessReportPage = () => {');
    expect(block).toContain('postprocessReportWindow.loadFile(resolvePostprocessReportRendererPath(postprocessReportUiVariant));');
    expect(block).toContain('postprocessReportWindow.loadURL(buildPostprocessReportBootstrapDataUrl(postprocessReportUiVariant));');
    expect(block).toContain("if (isClassicV2) {");
    expect(block).toContain('POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS');
    expect(block).toContain("postprocessReportWindow.webContents.on('did-finish-load', () => {");
    expect(block).toContain('postprocessReportWindow.moveTop();');
    expect(block).toContain('postprocessReportWindow.focus();');
    expect(block).toContain("postprocessReportWindow.setAlwaysOnTop(true, 'screen-saver');");
  });

  it('still boots the detached report before heavy CLI processing starts and forwards the selected ui variant', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/main/main.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('} else if (isCliMode) {'),
      source.lastIndexOf('} else if (isReleaseCenterMode) {')
    );

    expect(source).toContain('const POSTPROCESS_REPORT_BOOTSTRAP_DELAY_MS = 560;');
    expect(source).toContain('const POSTPROCESS_REPORT_BOOTSTRAP_SWAP_DELAY_MS = 320;');
    expect(block).toContain('app.whenReady().then(async () => {');
    expect(block).toContain('launchDetachedPostprocessReportViewer(app, reportPath, {');
    expect(block).toContain('uiVariant: postprocessReportUiVariant');
    expect(block).toContain('await waitForMilliseconds(POSTPROCESS_REPORT_BOOTSTRAP_DELAY_MS);');
    expect(block).toContain('const startTime = Date.now();');
  });
});
