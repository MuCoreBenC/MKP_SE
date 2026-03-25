import React from 'react';

// 这里接收从外层传入的状态（比如当前激活的页面、当前机型、折叠状态等）
export default function Sidebar({ 
  activePage = 'home', 
  onPageChange,
  isCollapsed = false,
  onToggleCollapse,
  brandName = 'Bambu Lab',
  modelName = 'A1',
  versionBadge = '未选择',
  onToggleDarkMode
}) {
  
  // 动态计算侧边栏宽度
  const sidebarWidth = isCollapsed ? '64px' : '200px';

  // 辅助函数：根据当前页面是否激活，返回对应的 className
  const getNavItemClass = (pageId) => {
    const baseClass = "nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors";
    const activeClass = "active"; // 继承你原本 css 里的 active 样式
    return activePage === pageId ? `${baseClass} ${activeClass}` : baseClass;
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
        {/* 顶部折叠按钮区 */}
        <div className="sidebar-header-bar px-3 py-2 border-b border-gray-100 dark:border-[#333] flex items-center transition-colors">
          <button 
            id="btn-toggle-sidebar" 
            onClick={onToggleCollapse} 
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-gray-100 dark:hover:bg-[#2A2D2E] transition-colors" 
            title="折叠侧边栏"
          >
            <div id="icon-toggle-sidebar" className="relative flex-shrink-0">
              <svg id="menuIcon" className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
              </svg>
            </div>
            <span id="text-toggle-sidebar" className="sidebar-text font-semibold text-gray-800 dark:text-gray-200">
              MKP SupportE
            </span>
          </button>
        </div>

        {/* 品牌与机型显示区 */}
        <div className="py-4 sidebar-content border-b border-gray-100 dark:border-[#333] flex flex-col items-center justify-center min-h-[84px] cursor-default pointer-events-none transition-colors">
          <div className="flex items-center justify-center whitespace-nowrap overflow-hidden">
            <div id="brandWrapper" className="transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-end" style={{ maxWidth: '90px', opacity: 1 }}>
              <span id="sidebarBrand" className="text-sm font-medium text-gray-500 dark:text-gray-400">{brandName}</span>
              <span id="sidebarBrandSpace" className="w-1.5 inline-block flex-shrink-0"></span>
            </div>
            <span id="sidebarModelName" className="text-sm font-bold theme-text inline-block align-middle relative transition-transform duration-300">
              {modelName}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-center overflow-hidden w-full">
            <span id="sidebarVersionBadge" className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-[#333] text-gray-400 dark:text-gray-500 whitespace-nowrap duration-300 transition-colors">
              {versionBadge}
            </span>
          </div>
        </div>

        {/* 核心导航菜单区 */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            
            <button id="btn-nav-home" className={getNavItemClass('home')} onClick={() => onPageChange('home')}>
              <div id="icon-nav-home" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              </div>
              <span id="text-nav-home" className="sidebar-text">选择机型</span>
            </button>

            <button id="btn-nav-download" className={getNavItemClass('download')} onClick={() => onPageChange('download')}>
              <div id="icon-nav-download" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              </div>
              <span id="text-nav-download" className="sidebar-text">下载预设</span>
            </button>

            <button id="btn-nav-calibrate" className={getNavItemClass('calibrate')} onClick={() => onPageChange('calibrate')}>
              <div id="icon-nav-calibrate" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"/></svg>
              </div>
              <span id="text-nav-calibrate" className="sidebar-text">校准偏移</span>
            </button>

            <button id="btn-nav-params" className={getNavItemClass('params')} onClick={() => onPageChange('params')}>
              <div id="icon-nav-params" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <span id="text-nav-params" className="sidebar-text">修改参数</span>
            </button>

            <button id="btn-nav-versions" className={getNavItemClass('versions')} onClick={() => onPageChange('versions')}>
              <div id="icon-nav-versions" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <span id="text-nav-versions" className="sidebar-text">版本控制</span>
            </button>

            <button id="btn-nav-faq" className={getNavItemClass('faq')} onClick={() => onPageChange('faq')}>
              <div id="icon-nav-faq" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <span id="text-nav-faq" className="sidebar-text">常见问题</span>
            </button>

            <button id="btn-nav-about" className={getNavItemClass('about')} onClick={() => onPageChange('about')}>
              <div id="icon-nav-about" className="relative flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <span id="text-nav-about" className="sidebar-text">关于软件</span>
            </button>

          </div>
        </nav>

        {/* 底部设置区 */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-[#333] flex flex-col gap-1 transition-colors">
          <button id="btn-nav-darkmode" onClick={onToggleDarkMode} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-gray-50 dark:hover:bg-[#2A2D2E] transition-colors">
            <div id="icon-nav-darkmode" className="relative flex-shrink-0 text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
            </div>
            <span id="text-nav-darkmode" className="sidebar-text text-gray-700 dark:text-gray-300">外观模式</span>
          </button>
          
          <button id="btn-nav-theme" className={getNavItemClass('setting')} onClick={() => onPageChange('setting')}>
            <div id="icon-nav-theme" className="relative flex-shrink-0 text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25l7.22-7.22a3.75 3.75 0 003.978 3.978l-7.448 7.448zM15 15l-3-3m0 0l-3-3m3 3l3 3m3 3l3 3"/></svg>
            </div>
            <span id="text-nav-theme" className="sidebar-text text-gray-700 dark:text-gray-300">软件设置</span>
          </button>
        </div>

      </aside>
    </div>
  );
}