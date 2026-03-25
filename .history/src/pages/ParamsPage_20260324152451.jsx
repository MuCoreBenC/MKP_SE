import React from 'react';

export default function ParamsPage() {
  return (
    <div id="page-params" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-params" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">修改参数</h1>
          <div className="flex items-center gap-3">
            <button id="btn-restore-defaults" onClick={() => {}} className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              恢复默认
            </button>
            <button id="saveParamsBtn" onClick={() => {}} className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              保存所有修改
            </button>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-xs text-gray-500 leading-none">当前编辑文件：<span id="currentEditingFile" className="font-mono theme-text">未选择</span></p>
        </div>
      </div>
      <div className="page-content hide-scrollbar">
        <div className="max-w-6xl">
          <div className="bg-white dark:bg-[#252526] rounded-[28px] card-shadow p-6 mb-5 border border-gray-100 dark:border-[#333] transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
                  JSON 预设参数工作台
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-3xl">按模块查看和修改当前预设。常用参数会用中文名称展示，鼠标悬停问号可查看说明；G-code 会按行拆开，便于逐步微调。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#1E1E1E]">右键支持复制 / 粘贴 / 剪切 / 撤销 / 删除</span>
                <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#1E1E1E]">保存时自动回写 JSON</span>
              </div>
            </div>
            <div id="dynamicParamsContainer" className="grid grid-cols-1 gap-6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}