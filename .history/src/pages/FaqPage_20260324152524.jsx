import React from 'react';

export default function FaqPage() {
  return (
    <div id="page-faq" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-faq" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">常见问题</h1>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-none">以下是用户最常遇到的问题及解决方法</p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-3xl mx-auto">
          <div className="relative mb-6">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" id="faqSearch" placeholder="搜索问题..." className="input-field w-full pl-11 pr-4 py-3 rounded-xl text-sm" />
          </div>

          <div id="faqList" className="space-y-3"></div>

          <div className="mt-8 p-4 theme-bg-subtle rounded-xl transition-colors">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 theme-text mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/>
              </svg>
              <div>
                <div className="text-sm font-medium theme-text">没有找到您的问题？</div>
                <div className="text-sm theme-text opacity-80 mt-1">请加入我们的QQ群或观看视频教程获取更多帮助</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}