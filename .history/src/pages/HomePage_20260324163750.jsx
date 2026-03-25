// src/pages/HomePage.jsx
import React, { useState } from 'react';
import { brands, printersByBrand, VERSION_DICT } from '../utils/data';

export default function HomePage({ onNext }) {
  // 1. 定义页面核心状态
  const [selectedBrand, setSelectedBrand] = useState('bambu');
  const [selectedPrinter, setSelectedPrinter] = useState('a1');
  const [viewMode, setViewMode] = useState('compact'); // 'compact' | 'detailed'
  const [searchQuery, setSearchQuery] = useState('');

  // 2. 动态计算：当前品牌下的机型，并进行搜索过滤
  const currentPrinters = printersByBrand[selectedBrand] || [];
  const filteredPrinters = currentPrinters.filter(printer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return printer.name.toLowerCase().includes(query) || printer.shortName.toLowerCase().includes(query);
  });

  const currentBrandObj = brands.find(b => b.id === selectedBrand);

  // 3. 辅助渲染函数：渲染卡片上的版本徽章
  const renderVersionBadges = (versions) => {
    if (!versions || versions.length === 0) return null;
    return versions.map(v => {
      const vInfo = VERSION_DICT[v];
      if (!vInfo) return null;
      return (
        <span key={v} className={`home-version-badge ${vInfo.bgClass} ${vInfo.textClass}`}>
          {vInfo.name}
        </span>
      );
    });
  };

  return (
    <div id="page-home" className="page flex-1" data-fixed-header="true">
      {/* --- Header 区域不变 --- */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-home" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">选择机型</h1>
          <div className="flex items-center gap-3">
            <button onClick={onNext} className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <span>下一步</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>
        <div className="page-header-sub"></div>
      </div>

      {/* --- 核心业务区 --- */}
      <div className="page-content hide-scrollbar">
        <div className="max-w-7xl w-full home-stage">
          <div className="home-stage-panel bg-white dark:bg-[#252526] rounded-[30px] card-shadow border border-transparent dark:border-[#333] transition-colors">
            
            {/* 顶部工具栏 */}
            <div className="home-stage-toolbar">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">Printer Gallery</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {currentBrandObj?.name || '未知品牌'} · {filteredPrinters.length} 个机型
                </div>
              </div>
              <div className="home-stage-toolbar-actions">
                {/* 🌟 视图切换器：数据驱动！ */}
                <div className="inline-flex rounded-2xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1E1E1E] p-1 shrink-0">
                  <button 
                    onClick={() => setViewMode('compact')} 
                    className={`release-segment-btn rounded-xl px-4 py-2 text-sm font-medium transition-all ${viewMode === 'compact' ? 'active' : ''}`}
                  >简约</button>
                  <button 
                    onClick={() => setViewMode('detailed')} 
                    className={`release-segment-btn rounded-xl px-4 py-2 text-sm font-medium transition-all ${viewMode === 'detailed' ? 'active' : ''}`}
                  >详细</button>
                </div>
                {/* 🌟 搜索框：双向绑定！ */}
                <div className="relative home-stage-search">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                  </svg>
                  <input 
                    type="text" 
                    placeholder="搜索机型..." 
                    className="input-field pl-10 pr-4 py-3 rounded-2xl text-sm w-full" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 🌟 品牌列表 (横向滚动) */}
            <div className="home-brand-strip-block">
              <div className="home-brand-strip-head">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">品牌</span>
              </div>
              <div className="home-brand-strip hide-scrollbar">
                {brands.map(brand => (
                  <button
                    key={brand.id}
                    onClick={() => { setSelectedBrand(brand.id); setSearchQuery(''); }}
                    className={`brand-card home-brand-card home-brand-row border text-left ${brand.id === selectedBrand ? 'active' : ''}`}
                  >
                    <span className="block min-w-0 home-brand-copy">
                      <span className="block truncate font-medium text-gray-900 dark:text-gray-100 home-brand-primary">
                        {brand.shortName || brand.name}
                      </span>
                      {viewMode === 'detailed' && brand.subtitle && (
                        <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400 home-brand-secondary">
                          {brand.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 🌟 机型画廊 */}
            <div className="home-gallery-shell">
              <div className="home-gallery-head">
                <div className="text-sm text-gray-500 dark:text-gray-400">当前视图支持横向浏览</div>
              </div>
              
              <div className="home-gallery-viewport hide-scrollbar">
                {filteredPrinters.length === 0 ? (
                  <div className="home-empty-state mt-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者尝试切换品牌。</div>
                  </div>
                ) : (
                  <div className={`home-printer-grid home-printer-grid-${viewMode}`}>
                    {filteredPrinters.map(printer => {
                      const isSelected = printer.id === selectedPrinter;
                      const isDisabledClass = printer.disabled ? 'printer-card-disabled' : '';

                      return (
                        <button
                          key={printer.id}
                          disabled={printer.disabled}
                          onClick={() => setSelectedPrinter(printer.id)}
                          className={`select-card home-printer-card home-printer-card-${viewMode} ${isSelected ? 'selected' : ''} ${isDisabledClass}`}
                        >
                          {/* ======= 简约模式 UI ======= */}
                          {viewMode === 'compact' ? (
                            <div className="home-printer-card-inner">
                              <div className="home-printer-media">
                                <span className="home-printer-avatar-shell">
                                  <img className="home-printer-avatar" src={printer.image} alt={printer.name} draggable="false" />
                                </span>
                              </div>
                              <div className="home-printer-card-caption min-w-0 text-left w-full">
                                <div className="home-printer-name text-gray-900 dark:text-gray-100 truncate">{printer.name}</div>
                                <div className="mt-3 flex flex-wrap gap-2 home-printer-version-row">
                                  {renderVersionBadges(printer.supportedVersions)}
                                </div>
                                {printer.disabled && <div className="mt-3 home-printer-status">暂不可用</div>}
                              </div>
                            </div>
                          ) : (
                            /* ======= 详细模式 UI (带 3D 翻转) ======= */
                            <div className="home-printer-flip">
                              {/* 正面 */}
                              <div className="home-printer-face home-printer-face-front text-left">
                                <div className="home-printer-media">
                                  <span className="home-printer-avatar-shell">
                                    <img className="home-printer-avatar" src={printer.image} alt={printer.name} draggable="false" />
                                  </span>
                                </div>
                                <div className="home-printer-front-copy">
                                  <div className="home-printer-name text-gray-900 dark:text-gray-100">{printer.name}</div>
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{printer.shortName}系列</div>
                                </div>
                              </div>
                              
                              {/* 背面 */}
                              <div className="home-printer-face home-printer-face-back text-left">
                                <div>
                                  <div className="home-printer-back-top">
                                    <div className="min-w-0">
                                      <div className="home-printer-back-title truncate">{printer.name}</div>
                                    </div>
                                    {printer.disabled && <div className="home-printer-status">暂不可用</div>}
                                  </div>
                                  <div className="home-printer-back-label">支持版本</div>
                                  <div className="flex flex-wrap gap-2 home-printer-version-row">
                                    {renderVersionBadges(printer.supportedVersions)}
                                    {(!printer.supportedVersions || printer.supportedVersions.length === 0) && (
                                      <span className="text-xs text-gray-400">暂无预设</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">点击卡片选中配置</div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}