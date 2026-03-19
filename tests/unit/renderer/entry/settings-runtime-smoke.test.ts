import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
const uiTextSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/ui-text.js', 'utf8');

describe('settings TOML conversion runtime smoke', () => {
  it('renders a dedicated advanced conversion card separate from the bug-report card', () => {
    expect(htmlSource).toContain('id="setting-toml-conversion-card"');
    expect(htmlSource).toContain('class="settings-inline-card-shell"');
    expect(htmlSource).toContain('class="settings-inline-card-copy settings-inline-card-copy-compact"');
    expect(htmlSource).toContain('class="settings-inline-card-actions"');
    expect(htmlSource).toContain('id="btn-setting-convert-toml"');
    expect(htmlSource).toContain('onclick="convertTomlPresetToJson(this)"');
    expect(htmlSource).toContain('id="btn-setting-open-converted"');
    expect(htmlSource).toContain('onclick="openTomlJsonConversionFolder(this)"');
    expect(htmlSource).toContain('id="settingTomlConvertOutputPath"');
    expect(htmlSource).toContain('id="settingTomlConvertStatus"');

    expect(htmlSource).toContain('id="setting-bug-report-card"');
    expect(htmlSource).toContain('id="settingBugReportTitle"');
    expect(htmlSource).toContain('id="settingBugReportDesc"');

    const conversionCard = htmlSource.match(
      /<div id="setting-toml-conversion-card"[\s\S]*?<\/div>\s*<\/div>/
    )?.[0];

    expect(conversionCard).toBeTruthy();
    expect(conversionCard).not.toContain('遇到 Bug 或卡顿？');
    expect(conversionCard).not.toContain('settingBugReportTitle');
    expect(conversionCard).not.toContain('settingBugReportDesc');
  });

  it('initializes and binds the TOML conversion actions through mkpAPI', () => {
    expect(appSource).toMatch(/await initTomlPresetConversionSetting\(\);/);
    expect(appSource).toMatch(/async function initTomlPresetConversionSetting\(\) \{/);
    expect(appSource).toMatch(/window\.mkpAPI\?\.getConvertedPresetsFolder/);
    expect(appSource).toMatch(/async function convertTomlPresetToJson\(btnElement\) \{/);
    expect(appSource).toMatch(/window\.mkpAPI\?\.convertTomlPresetToJson/);
    expect(appSource).toMatch(/async function openTomlJsonConversionFolder\(btnElement\) \{/);
    expect(appSource).toMatch(/window\.mkpAPI\?\.openConvertedPresetsFolder/);
    expect(appSource).toContain("setButtonStatus(btnElement, '122px', '转换中...', SPIN_ICON, 'btn-expand-theme')");
    expect(appSource).toMatch(/if \(result\?\.canceled\) \{[\s\S]*reset\.unlock\(\);[\s\S]*return;[\s\S]*\}/);
    expect(appSource).toContain('btn.innerHTML = origHtml;');
  });

  it('updates the bug-report copy through dedicated ids instead of broad mt-6 selectors', () => {
    expect(uiTextSource).toContain("document.getElementById('settingBugReportTitle')");
    expect(uiTextSource).toContain("document.getElementById('settingBugReportDesc')");
    expect(uiTextSource).not.toContain("document.querySelector('#setting-update .mt-6 .text-sm.font-medium')");
    expect(uiTextSource).not.toContain("document.querySelector('#setting-update .mt-6 .text-xs.text-gray-500')");
  });

  it('uses a stable two-column card layout so button width changes do not reflow the description block', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/\.settings-inline-card-shell \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) 320px;/);
    expect(styleSource).toMatch(/\.settings-inline-card-copy-compact \{\s*max-width: 430px;/);
    expect(styleSource).toMatch(/\.settings-inline-card-actions \{[\s\S]*width: 320px;[\s\S]*justify-content: flex-end;/);
    expect(styleSource).toMatch(/\.settings-inline-card-actions > button \{\s*white-space: nowrap;\s*\}/);
  });

  it('uses the shared flat app switch markup in settings so toggle visuals stay consistent with the params page', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');
    const paramsSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/params.js', 'utf8');

    expect(htmlSource).toMatch(/<label class="mkp-switch">[\s\S]*id="showOnboarding"[\s\S]*class="mkp-switch-input"[\s\S]*class="mkp-switch-track"/);
    expect(htmlSource).toMatch(/<label class="mkp-switch">[\s\S]*id="settingMacAnim"[\s\S]*class="mkp-switch-input"[\s\S]*class="mkp-switch-track"/);
    expect(paramsSource).toMatch(/class="mkp-switch mkp-switch-compact"/);
    expect(paramsSource).toMatch(/class="dynamic-param-input mkp-switch-input"/);
    expect(paramsSource).toMatch(/class="mkp-switch-track"/);
    expect(styleSource).toMatch(/\.mkp-switch \{/);
    expect(styleSource).toMatch(/\.mkp-switch-input:checked \+ \.mkp-switch-track \{/);
    expect(styleSource).toMatch(/\.mkp-switch-input:checked \+ \.mkp-switch-track::after \{/);
    expect(styleSource).not.toContain('theme-peer-checked');
  });

  it('reuses the params page section-nav shell for the settings header tabs instead of keeping a separate nav style', () => {
    expect(htmlSource).toContain('id="settingsSectionNav"');
    expect(htmlSource).toContain('class="page-header-sub params-page-header-sub"');
    expect(htmlSource).toContain('class="params-section-nav"');
    expect(htmlSource).toContain('id="tab-setting-startup" onclick="scrollToSetting(\'setting-startup\')" class="params-nav-item active theme-text transition-colors"');
    expect(htmlSource).toContain('id="tab-setting-appearance" onclick="scrollToSetting(\'setting-appearance\')" class="params-nav-item text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"');
    expect(htmlSource).toContain('id="tab-setting-update" onclick="scrollToSetting(\'setting-update\')" class="params-nav-item text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"');
    expect(appSource).toMatch(/const navItems = document\.querySelectorAll\('#settingsSectionNav \.params-nav-item'\);/);
  });
});
