import React from 'react';

export default function VersionsPage() {
  return (
    <div id="page-versions" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-versions" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">版本控制</h1>
          <button id="btn-page-check-update" onClick={() => {}} className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            检查更新
          </button>
        </div>
        <div className="page-header-sub"></div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl">
          <div id="updateReadyPrompt" className="hidden animate-scale-in w-full mb-6">
            <div className="bg-white dark:bg-[#252526] p-4 rounded-2xl card-shadow border border-green-100 dark:border-green-900/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">新版本已准备就绪</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">软件将在下次完全关闭时自动安装</p>
                </div>
              </div>
              <button id="btn-prompt-restart" onClick={() => {}} className="theme-btn-solid px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                点击重启立即更新
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
              <input type="text" id="versionSearch" placeholder="搜索版本号或更新说明..." className="input-field w-full pl-11 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
            <button id="btn-toggle-history" onClick={() => {}} className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-all">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span id="expandBtnText">历史版本</span>
            </button>
          </div>
          
          <div id="versionList" className="space-y-3"></div>
        </div>
      </div>
    </div>
  );
}