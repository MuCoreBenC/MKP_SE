import React from 'react';

export default function AboutPage() {
  return (
    <div id="page-about" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full relative">
        <div className="page-header-top">
          <h1 id="title-page-about" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">关于软件</h1>
        </div>
        <div className="page-header-sub"></div>
        <div className="absolute right-8 top-0 bottom-0 flex items-center">
          <div id="about-mini-header" className="flex items-center gap-3 opacity-0 translate-y-2 pointer-events-none transition-all duration-300">
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">支撑面改善工具</div>
              <div className="text-[11px] text-gray-500 leading-tight">MKP SupportE</div>
            </div>
            <img src="assets/images/logo-main.webp" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          </div>
        </div>
      </div>

      <div className="page-content hide-scrollbar relative">
        <div className="max-w-2xl mx-auto pt-8">
          <div id="about-hero-section" className="text-center mb-8 transition-all duration-300 origin-top">
            <img src="assets/images/logo-main.webp" alt="Logo" className="inline-block w-16 h-16 rounded-2xl mb-4 shadow-sm select-none pointer-events-none" />
            <h1 id="about-app-name" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">支撑面改善工具</h1>
            <p className="text-sm text-gray-400 mt-1">MKP SupportE</p>
            <p className="text-gray-500 mt-3">致力于为单喷嘴3D打印提供低成本支撑面改善方案，目标是让底面如顶面般完美。</p>
          </div>

          <div className="grid grid-cols-2 gap-6 items-stretch">
            {/* 核心信息卡片 */}
            <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 transition-colors flex flex-col">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">核心信息</div>
              <div className="flex items-center gap-4 mb-6">
                <img src="assets/images/Jhmodel喵~.webp" alt="Jhmodel喵~" className="w-14 h-14 rounded-full shadow-sm object-cover select-none pointer-events-none" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Jhmodel喵~</div>
                  <div className="text-xs text-gray-500 mt-1">MKP 原创作者 • 核心算法驱动</div>
                </div>
              </div>
              <div className="mb-auto pb-6">
                <button className="flex items-center justify-between p-3.5 rounded-xl theme-bg-subtle transition-all w-full text-left group outline-none cursor-pointer">
                  <div>
                    <div className="text-sm font-medium theme-text flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                      了解工作原理
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">它是如何让底面完美如顶的？</div>
                  </div>
                  <div className="w-6 h-6 rounded-full theme-bg-soft flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-3.5 h-3.5 theme-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </button>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 mb-2 pl-1 uppercase tracking-wide">开源信息 (Open Source)</div>
                <div className="flex flex-col rounded-xl border border-gray-100 dark:border-[#444] overflow-hidden">
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left border-b border-gray-100 dark:border-[#444] group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">GitHub</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">代码仓库 →</span>
                  </button>
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Gitee</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">国内镜像 →</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 社区与生态卡片 */}
            <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 transition-colors flex flex-col h-full">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">社区与生态</div>
              <div className="mb-4">
                <div className="flex flex-col rounded-xl border border-gray-100 dark:border-[#444] overflow-hidden">
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left border-b border-gray-100 dark:border-[#444] group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">📺 Bilibili 视频教程</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">详细教程 →</span>
                  </button>
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left border-b border-gray-100 dark:border-[#444] group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">🎵 抖音官方账号</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">关注动态 →</span>
                  </button>
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">🌐 MakerWorld</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">标准模型下载 →</span>
                  </button>
                </div>
              </div>
              <div className="mb-auto pb-6">
                <div className="flex flex-col rounded-xl border border-gray-100 dark:border-[#444] overflow-hidden">
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left border-b border-gray-100 dark:border-[#444]">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">💬 QQ 1群 (满)</span>
                    <span className="text-xs text-gray-400 font-mono">668350689</span>
                  </button>
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">💬 QQ 2群 (可加)</span>
                    <span className="text-xs text-gray-400 font-mono">123456789</span>
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 mb-2 pl-1 uppercase tracking-wide">获取支持 (Support & Shop)</div>
                <div className="flex flex-col rounded-xl border border-gray-100 dark:border-[#444] overflow-hidden">
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left border-b border-gray-100 dark:border-[#444] group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">🛒 淘宝小店</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">购买定制配件 →</span>
                  </button>
                  <button className="flex items-center justify-between p-3 hover-theme transition-all w-full text-left group">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">⭐ 支持项目</span>
                    <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">查看开发进度 →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 transition-colors">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">特别鸣谢 & 贡献者</div>
            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">喜</div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">姓名/网名</div>
                  <div className="text-xs text-gray-500 mt-0.5">复刻软件 · Electron</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold text-sm">某</div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">某群友</div>
                  <div className="text-xs text-gray-500 mt-0.5">切片参数优化 • 模型修改优化</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}