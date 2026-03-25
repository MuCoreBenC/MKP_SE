import React from 'react';
import { Icon } from '../Icons';

const navItems = [
  {
    page: 'home',
    icon: 'home',
    buttonId: 'btn-nav-home',
    iconId: 'icon-nav-home',
    textId: 'text-nav-home',
    label: '选择机型'
  },
  {
    page: 'download',
    icon: 'download',
    buttonId: 'btn-nav-download',
    iconId: 'icon-nav-download',
    textId: 'text-nav-download',
    label: '下载预设'
  },
  {
    page: 'calibrate',
    icon: 'calibrate',
    buttonId: 'btn-nav-calibrate',
    iconId: 'icon-nav-calibrate',
    textId: 'text-nav-calibrate',
    label: '校准偏移'
  },
  {
    page: 'params',
    icon: 'params',
    buttonId: 'btn-nav-params',
    iconId: 'icon-nav-params',
    textId: 'text-nav-params',
    label: '修改参数'
  },
  {
    page: 'versions',
    icon: 'versions',
    buttonId: 'btn-nav-versions',
    iconId: 'icon-nav-versions',
    textId: 'text-nav-versions',
    label: '版本控制'
  },
  {
    page: 'faq',
    icon: 'faq',
    buttonId: 'btn-nav-faq',
    iconId: 'icon-nav-faq',
    textId: 'text-nav-faq',
    label: '常见问题'
  },
  {
    page: 'about',
    icon: 'about',
    buttonId: 'btn-nav-about',
    iconId: 'icon-nav-about',
    textId: 'text-nav-about',
    label: '关于软件'
  }
];

export default function Sidebar({
  activePage = 'home',
  onPageChange,
  isCollapsed = false,
  onToggleCollapse,
  brandName = 'Bambu Lab',
  modelName = 'A1',
  versionBadge = '未选择',
  hasUpdate = false,
  currentTheme = 'light',
  onToggleDarkMode
}) {
  const sidebarWidth = isCollapsed ? '64px' : '200px';

  const themeNames = {
    light: '浅色模式',
    dark: '深色模式',
    oled: 'OLED黑',
    system: '跟随系统'
  };

  const getNavItemClass = (pageId) => {
    const baseClass =
      'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors';
    return activePage === pageId ? `${baseClass} active` : baseClass;
  };

  return (
    <div
      id="sidebarWrapper"
      className="sidebar-wrapper relative flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      <aside
        id="sidebar"
        style={{ width: sidebarWidth }}
        className="h-screen bg-white border-r border-gray-200 dark:border-[#333] flex flex-col duration-300 ease-in-out overflow-hidden transition-all whitespace-nowrap"
      >
        <div className="sidebar-header-bar px-3 py-2 border-b border-gray-100 dark:border-[#333] flex items-center transition-colors">
          <button
            id="btn-toggle-sidebar"
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-gray-100 dark:hover:bg-[#2A2D2E] transition-colors"
            title="折叠侧边栏"
          >
            <div id="icon-toggle-sidebar" className="relative flex-shrink-0">
              <Icon
                name="menu"
                className="w-5 h-5 flex-shrink-0 text-gray-700 dark:text-gray-300"
              />
            </div>
            <span
              id="text-toggle-sidebar"
              className="sidebar-text font-semibold text-gray-800 dark:text-gray-200"
            >
              MKP SupportE
            </span>
          </button>
        </div>

        <div className="py-4 sidebar-content border-b border-gray-100 dark:border-[#333] flex flex-col items-center justify-center min-h-[84px] cursor-default pointer-events-none transition-colors">
          <div className="flex items-center justify-center whitespace-nowrap overflow-hidden">
            <div
              id="brandWrapper"
              className="transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-end"
              style={{ maxWidth: '90px', opacity: 1 }}
            >
              <span id="sidebarBrand" className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {brandName}
              </span>
              <span id="sidebarBrandSpace" className="w-1.5 inline-block flex-shrink-0"></span>
            </div>
            <span
              id="sidebarModelName"
              className="text-sm font-bold theme-text inline-block align-middle relative transition-transform duration-300"
            >
              {modelName}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-center overflow-hidden w-full">
            <span
              id="sidebarVersionBadge"
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-[#333] text-gray-400 dark:text-gray-500 whitespace-nowrap duration-300 transition-colors"
            >
              {versionBadge}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            {navItems.map(({ page, icon, buttonId, iconId, textId, label }) => (
              <button
                key={page}
                id={buttonId}
                className={getNavItemClass(page)}
                onClick={() => onPageChange(page)}
              >
                <div id={iconId} className="relative flex-shrink-0">
                  <Icon name={icon} />
                  {page === 'versions' && hasUpdate ? (
                    <span className="mkp-badge-dot show pulse"></span>
                  ) : null}
                </div>
                <span id={textId} className="sidebar-text">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </nav>

        <div className="px-3 py-3 border-t border-gray-100 dark:border-[#333] flex flex-col gap-1 transition-colors">
          <button
            id="btn-nav-darkmode"
            onClick={onToggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-[#2A2D2E] transition-colors"
          >
            <div
              id="icon-nav-darkmode"
              className="relative flex-shrink-0 text-gray-700 dark:text-gray-300"
            >
              <Icon name="darkmode" className="w-5 h-5 flex-shrink-0 dark-icon-sun" />
            </div>
            <span
              id="text-nav-darkmode"
              className="sidebar-text text-gray-700 dark:text-gray-300"
            >
              {themeNames[currentTheme] || '外观模式'}
            </span>
          </button>

          <button
            id="btn-nav-theme"
            className={getNavItemClass('setting')}
            onClick={() => onPageChange('setting')}
          >
            <div
              id="icon-nav-theme"
              className="relative flex-shrink-0 text-gray-700 dark:text-gray-300"
            >
              <Icon name="setting" />
            </div>
            <span id="text-nav-theme" className="sidebar-text text-gray-700 dark:text-gray-300">
              软件设置
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
