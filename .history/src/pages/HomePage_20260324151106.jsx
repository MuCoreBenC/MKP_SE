import React from 'react';

export default function HomePage({ onNext }) {
  return (
    <div id="page-home" className="page flex-1" data-fixed-header="true">
      {/* 页面独立 Header */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-home" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">选择机型</h1>
          <div className="flex items-center gap-3">
            <button 
              id="btn-home-next" 
              onClick={onNext} 
              className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <span>下一步</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>
        <div className="page-header-sub"></div>
      </div>

      {/* 页面核心内容 */}
      <div className="page-content hide-scrollbar">
        <div className="max-w-7xl w-full home-stage">
          <div className="home-stage-panel bg-white dark:bg-[#252526] rounded-[30px] card-shadow border border-transparent dark:border-[#333] transition-colors">
            
            {/* 工具栏 */}
            <div className="home-stage-toolbar">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">Printer Gallery</div>
                <div id="currentBrandTitle" className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">Bambu Lab · 4 个机型</div>
              </div>
              <div className="home-stage-toolbar-actions">
                <div className="inline-flex rounded-2xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1E1E1E] p-1 shrink-0">
                  <button id="homeViewCompactBtn" type="button" className="release-segment-btn active rounded-xl px-4 py-2 text-sm font-medium transition-all">简约</button>
                  <button id="homeViewDetailedBtn" type="button" className="release-segment-btn rounded-xl px-4 py-2 text-sm font-medium transition-all">详细</button>
                </div>
                <div className="relative home-stage-search">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                  </svg>
                  <input type="text" id="printerSearch" placeholder="搜索机型..." className="input-field pl-10 pr-4 py-3 rounded-2xl text-sm w-full" />
                </div>
              </div>
            </div>

            {/* 品牌列表容器 */}
            <div className="home-brand-strip-block">
              <div className="home-brand-strip-head">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">品牌</span>
              </div>
              <div id="brandList" className="home-brand-strip hide-scrollbar">
                {/* 动态渲染的品牌数据将挂载在这里 */}
              </div>
            </div>

            {/* 机型画廊容器 */}
            <div className="home-gallery-shell">
              <div className="home-gallery-head">
                <div className="text-sm text-gray-500 dark:text-gray-400">右键品牌或机型可继续管理，当前视图支持横向浏览</div>
                <div className="home-gallery-actions">
                  <button id="homeGalleryPrevBtn" type="button" className="home-gallery-nav" aria-label="上一张">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <button id="homeGalleryNextBtn" type="button" className="home-gallery-nav" aria-label="下一张">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
              <div id="homeGalleryViewport" className="home-gallery-viewport hide-scrollbar">
                <div id="printerGrid" className="home-printer-grid">
                  {/* 动态渲染的机型卡片将挂载在这里 */}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}