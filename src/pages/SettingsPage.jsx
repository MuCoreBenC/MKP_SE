import React from 'react';
import { THEME_PALETTE } from '../utils/themeConstants';

const modeBtnBaseClass =
  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 dark:border-[#333] cursor-pointer relative z-10 hover:border-gray-300 dark:hover:border-[#555] transition-colors outline-none';

export default function SettingsPage({
  currentTheme = 'light',
  onChangeTheme,
  currentColor = 'blue',
  onChangeColor,
}) {
  const getModeBtnClass = (mode) => {
    if (currentTheme === mode) {
      return `${modeBtnBaseClass} theme-border theme-bg-soft`;
    }

    return `${modeBtnBaseClass} border-transparent bg-transparent`;
  };

  const getModeTextClass = (mode) => {
    const baseClass = 'text-xs font-medium transition-colors';
    return currentTheme === mode
      ? `${baseClass} theme-text`
      : `${baseClass} text-gray-700 dark:text-gray-300`;
  };

  return (
    <div id="page-setting" className="page flex-1" data-fixed-header="true">
      <div
        className="page-header w-full border-b border-gray-200 dark:border-[#333]"
        style={{ paddingBottom: 0 }}
      >
        <div className="page-header-top flex items-center justify-between">
          <h1
            id="title-page-settings"
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight"
          >
            软件设置
          </h1>
        </div>
        <div className="mt-4 flex items-center gap-6 text-sm font-medium pb-3 relative z-10">
          <button type="button" className="settings-nav-item active theme-text transition-colors">
            常规与启动
          </button>
          <button
            type="button"
            className="settings-nav-item text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            外观与主题
          </button>
          <button
            type="button"
            className="settings-nav-item text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            更新与关于
          </button>
        </div>
      </div>

      <div className="page-content hide-scrollbar" id="settingsPageContent">
        <div className="space-y-8 max-w-4xl">
          <div id="setting-startup" className="settings-section">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              常规与启动
            </h3>
            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-100 dark:border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 transition-colors">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-[#333]">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    显示欢迎界面
                  </div>
                  <div className="text-xs text-gray-500 mt-1">每次启动时显示新手引导界面</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    id="showOnboarding"
                    className="sr-only peer"
                    defaultChecked
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#3E3E42] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 theme-peer-checked transition-all"></div>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      停靠动画 (Dock)
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      启用类似操作系统的任务栏缩放动画
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input type="checkbox" id="settingMacAnim" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-[#3E3E42] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 theme-peer-checked transition-all"></div>
                  </label>
                </div>
                <div className="mt-4 bg-gray-50 dark:bg-[#1E1E1E] rounded-xl border border-gray-100 dark:border-[#333] p-5">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        图标尺寸
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-medium">小</span>
                        <input
                          type="range"
                          id="settingDockSizeRange"
                          min="33"
                          max="43"
                          step="1"
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-[#333] transition-all hover:brightness-110"
                          style={{ accentColor: 'rgb(var(--primary-rgb))' }}
                        />
                        <span className="text-xs text-gray-400 font-medium">大</span>
                      </div>
                    </div>
                    <div>
                      <div id="dockScaleContainer" className="transition-all duration-300">
                        <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          停靠缩放倍数
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 font-medium">小</span>
                          <input
                            type="range"
                            id="settingDockScaleRange"
                            min="1.2"
                            max="1.8"
                            step="0.1"
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:brightness-110"
                            style={{ accentColor: 'rgb(var(--primary-rgb))' }}
                          />
                          <span className="text-xs text-gray-400 font-medium">大</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="setting-appearance" className="settings-section pt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              外观与主题
            </h3>

            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-100 dark:border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 mb-6 transition-colors">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                外观模式
              </div>
              <div className="grid grid-cols-4 gap-3 max-w-[640px]">
                <button
                  type="button"
                  className={getModeBtnClass('light')}
                  onClick={(event) => onChangeTheme?.('light', event)}
                >
                  <div className="w-full h-12 rounded-md bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden flex flex-col">
                    <div className="h-2.5 bg-[#ffffff] border-b border-[#e5e7eb]"></div>
                    <div className="flex-1 flex">
                      <div className="w-1/3 bg-[#f9fafb] border-r border-[#e5e7eb]"></div>
                      <div className="flex-1 bg-[#ffffff]"></div>
                    </div>
                  </div>
                  <span className={getModeTextClass('light')}>浅色</span>
                </button>

                <button
                  type="button"
                  className={getModeBtnClass('dark')}
                  onClick={(event) => onChangeTheme?.('dark', event)}
                >
                  <div className="w-full h-12 rounded-md bg-[#1a1a1a] border border-[#333] overflow-hidden flex flex-col">
                    <div className="h-2.5 bg-[#222] border-b border-[#333]"></div>
                    <div className="flex-1 flex">
                      <div className="w-1/3 bg-[#111] border-r border-[#333]"></div>
                      <div className="flex-1 bg-[#1a1a1a]"></div>
                    </div>
                  </div>
                  <span className={getModeTextClass('dark')}>深色</span>
                </button>

                <button
                  type="button"
                  className={getModeBtnClass('oled')}
                  onClick={(event) => onChangeTheme?.('oled', event)}
                >
                  <div className="w-full h-12 rounded-md bg-[#000000] border border-gray-200 dark:border-[#1a1a1a] overflow-hidden flex flex-col">
                    <div className="h-2.5 bg-[#111] border-b border-gray-200 dark:border-[#1a1a1a]"></div>
                    <div className="flex-1 flex">
                      <div className="w-1/3 bg-[#0a0a0a] border-r border-gray-200 dark:border-[#1a1a1a]"></div>
                      <div className="flex-1 bg-[#000000]"></div>
                    </div>
                  </div>
                  <span className={getModeTextClass('oled')}>OLED黑</span>
                </button>

                <button
                  type="button"
                  className={getModeBtnClass('system')}
                  onClick={(event) => onChangeTheme?.('system', event)}
                >
                  <div className="w-full h-12 rounded-md border border-[#e5e7eb] dark:border-[#333] overflow-hidden flex">
                    <div className="flex-1 bg-[#f3f4f6] flex flex-col border-r border-[#e5e7eb] dark:border-[#333]">
                      <div className="h-2.5 bg-[#ffffff] border-b border-[#e5e7eb] dark:border-[#333]"></div>
                      <div className="flex-1 bg-[#ffffff]"></div>
                    </div>
                    <div className="flex-1 bg-[#1a1a1a] flex flex-col">
                      <div className="h-2.5 bg-[#222] border-b border-[#333]"></div>
                      <div className="flex-1 bg-[#1a1a1a]"></div>
                    </div>
                  </div>
                  <span className={getModeTextClass('system')}>跟随系统</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-100 dark:border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 mb-6 transition-colors">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                全局色彩方案
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                选择软件的主色调，将应用于侧边栏、按钮、高亮文本及更新通知弹窗。
              </p>

              <div id="globalThemePalette" className="flex items-center gap-4 flex-wrap">
                {Object.entries(THEME_PALETTE).map(([key, colorData]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChangeColor?.(key)}
                    className={`global-color-btn color-picker-btn ${
                      currentColor === key ? 'active' : ''
                    }`}
                    style={{ color: colorData.hex, backgroundColor: colorData.hex }}
                    title={colorData.name}
                  ></button>
                ))}

                <button
                  type="button"
                  className={`global-color-btn color-picker-btn follow-theme-btn relative flex items-center justify-center outline-none group ${
                    currentColor === 'custom' ? 'active' : ''
                  }`}
                  onClick={() => onChangeColor?.('custom')}
                  title="自定义颜色"
                >
                  <svg
                    className="w-4 h-4 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-100 dark:border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 transition-colors">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                版本专属图标颜色
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                为不同类型的版本指定专属颜色，便于在列表中快速区分。您也可以让它跟随全局主题色。
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2A2D2E] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors theme-standard-bg theme-standard-text">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      标准版
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="version-color-btn color-picker-btn follow-theme-btn flex items-center justify-center"
                      title="跟随全局主题"
                    >
                      <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="version-color-btn color-picker-btn"
                      style={{ color: '#3B82F6', backgroundColor: '#3B82F6' }}
                    ></button>
                    <button
                      type="button"
                      className="version-color-btn color-picker-btn"
                      style={{ color: '#10B981', backgroundColor: '#10B981' }}
                    ></button>
                    <button
                      type="button"
                      className="version-color-btn color-picker-btn"
                      style={{ color: '#F43F5E', backgroundColor: '#F43F5E' }}
                    ></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="setting-update" className="settings-section pt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              更新与关于
            </h3>
            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-100 dark:border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 transition-colors">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-[#333]">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    当前版本 <span id="settingsCurrentVersion" className="theme-text font-bold">v0.1.1</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">核心框架: Electron v29.0.0</div>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary px-4 py-2 text-sm rounded-lg transition-all">
                    关于我们
                  </button>
                  <button type="button" className="theme-btn-solid px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    检查更新
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input type="radio" name="updateMode" value="auto" className="custom-radio" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                      自动下载并安装
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      发现新版本时在后台静默下载，并在下次启动时自动安装
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group mt-4">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="radio"
                      name="updateMode"
                      value="manual"
                      className="custom-radio"
                      defaultChecked
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                      有新版本时仅提醒我
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      只在界面上显示红点提示，由我手动决定何时下载
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
