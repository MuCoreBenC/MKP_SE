import React from 'react';

export default function CalibrationPage({ onPrev }) {
  return (
    <div id="page-calibrate" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-calibrate" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">校准偏移</h1>
          <div className="flex items-center gap-3">
            <button 
              id="btn-calibrate-prev" 
              onClick={onPrev} 
              className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
              <span>上一步</span>
            </button>
          </div>
        </div>
        <div className="page-header-sub"></div>
      </div>
      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl">
          
          {/* 脚本路径复制区 */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 mb-5 transition-colors">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">脚本路径：主页-&gt;其他-&gt;后处理脚本</div>
            <div className="flex items-center gap-2">
              <input type="text" id="scriptPath" className="input-field input-readonly flex-1 px-4 py-2.5 rounded-lg text-sm" readOnly title="后处理脚本路径" placeholder="请先选择机型和版本" />
              <button id="scriptCopyBtn" className="theme-btn-soft h-9 min-w-[36px] px-2 rounded-lg flex items-center justify-center transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
                  </svg>
              </button>
            </div>
          </div>

          {/* Z轴偏移校准卡片 */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 mb-5 transition-colors" id="zCalibrationCard">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Z轴偏移校准</div>
              <div className="flex items-center gap-3">
                <button id="zDirectEditBtn" className="bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all shadow-sm">
                  不打开模型直接修改
                </button>
                <button id="zOpenBtn" className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>打开校准模型</span>
                </button>
              </div>
            </div>
            
            <div id="zCalibrationArea">
              <div id="zProgress" className="hidden mb-4">
                <div className="h-1 bg-gray-100 dark:bg-[#333] rounded-full overflow-hidden">
                  <div className="h-full theme-bg-solid rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div id="zPlaceholder" className="py-8 bg-gray-50 dark:bg-[#1E1E1E] rounded-xl border border-dashed border-gray-200 dark:border-[#444] flex flex-col items-center justify-center">
                <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
                </svg>
                <div id="zCurrentOffsetSummary" className="hidden text-2xl font-black theme-text mb-3 tracking-tight">
                  当前预设的Z偏移值为：<span id="currentZOffsetDisplay">--</span>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">点击右上方打开校准模型按钮加载可视化校准网格</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">点击后请耐心等待3mf打开...</span>
              </div>
            </div>
          </div>

          {/* XY轴偏移校准卡片 */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 transition-colors" id="xyCalibrationCard">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">XY轴偏移校准</div>
              <div className="flex items-center gap-3">
                <button id="xyDirectEditBtn" className="bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all shadow-sm">
                  不打开模型直接修改
                </button>
                <button id="xyOpenBtn" className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>打开校准模型</span>
                </button>
              </div>
            </div>
            
            <div id="xyCalibrationArea">
              <div id="xyProgress" className="hidden mb-4">
                <div className="h-1 bg-gray-100 dark:bg-[#333] rounded-full overflow-hidden">
                  <div className="h-full theme-bg-solid rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div id="xyPlaceholder" className="h-48 bg-gray-50 dark:bg-[#1E1E1E] rounded-xl border border-dashed border-gray-200 dark:border-[#444] flex flex-col items-center justify-center">
                <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
                </svg>
                <div id="xyCurrentOffsetSummary" className="hidden text-xl font-black theme-text mb-3 tracking-tight text-center">
                  当前预设的XY偏移值为：X <span id="currentXOffsetDisplay">--</span> / Y <span id="currentYOffsetDisplay">--</span>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">点击右上方打开校准模型按钮加载可视化校准网格</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">点击后请耐心等待3mf打开...</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}