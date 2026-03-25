import React from 'react';

export default function DownloadPage({ onPrev, onNext }) {
  return (
    <div id="page-download" className="page flex-1" data-fixed-header="true">
      {/* 页面头部 */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-download" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">模型预设</h1>
          <div className="flex items-center gap-3 relative">
            <button 
              id="btn-download-prev" 
              onClick={onPrev} 
              className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
              <span>上一步</span>
            </button>
            <button 
              id="downloadBtn" 
              onClick={onNext} 
              className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all" 
              disabled
            >
              <span>下一步</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
            <div id="downloadHintWrapper" className="absolute -bottom-6 right-1 flex items-center gap-1 text-amber-500 transition-opacity duration-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className="text-[11px]">请完成选择</span>
            </div>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-none">选择版本类型和发布日期以获取对应的预设配置</p>
        </div>
      </div>
      
      {/* 页面主体内容 */}
      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl flex flex-col">
          <div className="max-w-4xl space-y-8">
            
            {/* 上半部分：选择版本类型 */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">选择版本类型</h2>
                  <p className="text-xs text-gray-500">根据您的打印机配置选择合适的版本</p>
                </div>
              </div>
              <div id="downloadVersionList" className="flex flex-col gap-3">
                {/* 后续动态渲染的标准版/快拆版卡片会挂载在这里 */}
              </div>
            </div>

            {/* 下半部分：本地与在线预设 */}
            <div>
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <svg id="step2Badge" className="w-6 h-6 text-gray-400 flex-shrink-0 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">本地预设</h2>
                      <p className="text-xs text-gray-500">已存储在您电脑中的配置，进入批量模式后可排序和拖拽</p>
                    </div>
                  </div>
                  
                  {/* 本地预设工具栏操作按钮 (批量、搜索等) */}
                  <div className="flex items-center gap-1.5">
                    <div id="localSearchWrapper" className="hidden relative animate-scale-in origin-right">
                      <input type="text" id="localSearchInput" placeholder="搜索文件名.." className="input-field w-36 pl-8 pr-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252526]" />
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-[#333]" title="搜索本地文件">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </button>
                    <button id="btnMultiSelect" className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-[#333]" title="批量管理">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    </button>
                    <select id="localSortSelect" className="input-field hidden text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252526] text-gray-600 dark:text-gray-300">
                      <option value="custom">自定义</option>
                      <option value="version-desc">版本</option>
                      <option value="updated-desc">最近</option>
                      <option value="name-asc">名称</option>
                    </select>
                    <div id="localManagerDivider" className="hidden w-px h-4 bg-gray-200 dark:bg-[#444] mx-1"></div>
                    <button id="checkUpdateBtn" className="relative text-sm font-medium flex items-center gap-1.5 px-4 py-1.5 rounded-lg theme-btn-soft transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      <span>检查预设</span>
                    </button>
                  </div>
                </div>

                <div id="localPresetsContainer" className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-200 dark:border-[#333] shadow-sm overflow-hidden duration-300 transition-colors">
                  <div id="localEmptyState" className="p-8 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">请先在上方选择版本类型。</p>
                  </div>
                  <div id="localPresetsList" className="hidden flex-col divide-y divide-gray-100 dark:divide-[#333]"></div>
                </div>
              </div>

              {/* 在线预设区块 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">在线预设</h2>
                    <p className="text-xs text-gray-500">云端最新的配置文件，下载后将出现在本地预设中</p>
                  </div>
                </div>
                <div id="onlinePresetsContainer" className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-200 dark:border-[#333] shadow-sm overflow-hidden duration-300 transition-colors">
                  <div id="onlineEmptyState" className="p-8 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">点击上方的"检查更新"获取云端预设</p>
                  </div>
                  <div id="onlinePresetsList" className="hidden flex-col divide-y divide-gray-100 dark:divide-[#333]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}