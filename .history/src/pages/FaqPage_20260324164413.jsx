import React, { useState } from 'react';
import { Icon, CustomIcon } from '../components/Icons'; // 引入我们强大的图标库！

// ==========================================
// 💡 将数据与组件写在一起，把字符串变成了真正的 React 元素 (JSX)
// 这样就能直接调用传入的 onNavigate 函数进行页面跳转！
// ==========================================
const getFaqData = (onNavigate) => [
  {
    id: 1,
    question: '如何开始使用支撑面改善工具？',
    // 专门增加一个纯文本字段，让搜索极其精准，不会搜到 HTML 标签！
    searchText: '如何开始使用支撑面改善工具 下载预设 后处理脚本 校准',
    answer: (
      <>
        <p>1. 首先在<span className="text-blue-600 font-medium">选择机型</span>页面选择您的 3D 打印机型号</p>
        <p>2. 进入<span onClick={() => onNavigate('download')} className="text-blue-500 hover:text-blue-600 cursor-pointer font-medium hover:underline transition-all">下载预设</span>页面，应用或下载对应的 JSON 预设文件</p>
        <p>3. 在切片软件中配置后处理脚本路径</p>
        <p>4. 在本软件中进行 Z 轴和 XY 轴校准，获取最佳打印效果</p>
      </>
    )
  },
  {
    id: 2,
    question: 'Z 轴偏移校准的原理是什么？',
    searchText: 'Z轴偏移校准的原理是什么 物理距离 象脚 撞床',
    answer: (
      <>
        <p>Z 轴偏移校准用于微调打印头与打印床之间的极限物理距离。正确的 Z 轴偏移可以确保：</p>
        <p>• 支撑接触面能够完美粘附并容易拆除</p>
        <p>• 避免因过度挤压导致的底层“象脚”或撞床风险</p>
        <p className="text-gray-500 italic">警告：请勿随意大幅度调整负值补偿，以免损坏打印机热床。</p>
      </>
    )
  },
  {
    id: 3,
    question: 'XY 轴偏移校准有什么作用？',
    searchText: 'XY轴偏移校准有什么作用 水平位置 接触精度 痕迹',
    answer: (
      <>
        <p>XY 轴偏移校准用于调整支撑结构与模型之间的水平位置关系。主要作用包括：</p>
        <p>• 确保支撑结构位于正确的位置</p>
        <p>• 提高支撑与模型的接触精度</p>
        <p>• 减少支撑拆除后的残留痕迹</p>
      </>
    )
  },
  {
    id: 4,
    question: '后处理脚本如何配置？',
    searchText: '后处理脚本如何配置 Bambu Studio OrcaSlicer 工艺 其他 复制路径',
    answer: (
      <>
        <p>在 Bambu Studio 或 OrcaSlicer 中配置后处理脚本：</p>
        <p>1. 打开切片软件，进入<span className="text-blue-600 font-medium">工艺 → 其他</span></p>
        <p>2. 找到<span className="text-blue-600 font-medium">后处理脚本</span>选项框</p>
        <p>3. 点击本软件右上角的<span className="text-blue-600 font-medium">复制路径</span>按钮，将包含 <code>--Json</code> 和 <code>--Gcode</code> 参数的完整命令粘贴进去</p>
        <p>4. 保存设置并重新切片即可生效</p>
      </>
    )
  },
  {
    id: 5,
    question: '版本之间有什么区别？',
    searchText: '版本之间有什么区别 标准版 快拆版 Lite版',
    answer: (
      <>
        <p><span className="font-medium text-gray-900 dark:text-gray-100">标准版：</span>适用于原厂标准喷嘴配置的打印机</p>
        <p><span className="font-medium text-gray-900 dark:text-gray-100">快拆版：</span>针对使用第三方快拆喷嘴的物理高度落差进行了专项补偿优化</p>
        <p><span className="font-medium text-gray-900 dark:text-gray-100">Lite 版：</span>精简版参数，适用于性能受限的旧款机型</p>
        <p className="text-gray-500 italic">请严格根据您的打印机实际物理配置选择对应版本。</p>
      </>
    )
  },
  {
    id: 6,
    question: '如何更新到最新预设？',
    searchText: '如何更新到最新预设 软件设置 检查更新 微调包',
    answer: (
      <>
        <p>1. 进入<span onClick={() => onNavigate('setting')} className="text-blue-500 hover:text-blue-600 cursor-pointer font-medium hover:underline transition-all">软件设置</span>页面</p>
        <p>2. 点击<span className="text-blue-600 font-medium">检查更新</span>按钮</p>
        <p>3. 软件会自动向云端请求最新的 <code>-r</code> 优化微调包，并在后台安全替换您的本地旧文件</p>
        <p className="text-gray-500 italic">建议定期检查更新以获取最新的打印调优参数。</p>
      </>
    )
  },
  {
    id: 7,
    question: '遇到问题如何获取官方帮助？',
    searchText: '遇到问题如何获取官方帮助 QQ群 B站动态',
    answer: (
      <>
        <p>如果您在使用过程中遇到任何问题、或者想分享您的完美参数，欢迎加入我们的官方交流社区：</p>
        <div className="flex flex-wrap gap-3 mt-3">
          {/* 原生的 onclick="navTo('link:qq')" 被改成了安全的 React onClick */}
          <button 
            onClick={() => window.open('https://qm.qq.com/cgi-bin/qm/qr?k=JEQTF6AQ1PUgHFek0-D6lAUJMEKrsJj_&jump_from=webapi&authKey=FPWUUquvsNzy7b8djT9PAFiZ8pjAZMflI6SJTFXMRIEKDWuFF2DavQMjgWm9GgZK', '_blank')} 
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#252526] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#333] rounded-xl transition-all duration-200 text-xs font-medium active:scale-95 shadow-sm"
          >
            <CustomIcon name="logo_qq" className="w-4 h-4" /> {/* 直接调用图标组件！ */}
            加入官方 QQ 群
          </button>

          <button 
            onClick={() => window.open('https://space.bilibili.com/1475765743', '_blank')} 
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#252526] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#333] rounded-xl transition-all duration-200 text-xs font-medium active:scale-95 shadow-sm"
          >
            <CustomIcon name="logo_bilibili" className="w-4 h-4" />
            关注 B站动态
          </button>
        </div>
      </>
    )
  }
];

// ==========================================
// 💡 单个手风琴组件 (自带展开/折叠状态)
// ==========================================
function FaqItem({ item }) {
  // 仅用一行代码，取代原生 JS 里繁琐的 classList.add/remove 操作！
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`collapse-item faq-item bg-white dark:bg-[#252526] rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden transition-colors hover:shadow-sm hover:border-gray-300 dark:hover:border-[#444] ${isOpen ? 'expanded' : ''}`}>
      
      {/* 标题触发器 */}
      <button 
        className="faq-question w-full px-5 py-4 flex items-center justify-between text-left outline-none group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:theme-text transition-colors">
          {item.question}
        </span>
        
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#1e1e1e] group-hover:bg-gray-100 dark:group-hover:bg-[#2a2a2a] transition-colors flex-shrink-0">
          <svg className={`collapse-arrow w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'icon-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>

      {/* 内容展开区 (使用我们之前写入全局 CSS 的 0fr/1fr 网格动画引擎) */}
      <div className={`collapse-wrapper ${isOpen ? 'is-open is-expanded' : ''}`}>
        <div className="collapse-inner">
          <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-[#333] mt-1">
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
              {item.answer}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ==========================================
// 💡 主页面组件
// ==========================================
export default function FaqPage({ onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const faqData = getFaqData(onNavigate);

  // 极其清爽的实时搜索过滤逻辑
  const filteredFaqs = faqData.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return item.searchText.toLowerCase().includes(query);
  });

  return (
    <div id="page-faq" className="page flex-1" data-fixed-header="true">
      {/* --- 页面头部 --- */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 id="title-page-faq" className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">常见问题</h1>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-none">以下是用户最常遇到的问题及解决方法</p>
        </div>
      </div>

      {/* --- 核心内容区 --- */}
      <div className="page-content hide-scrollbar">
        <div className="max-w-3xl mx-auto">
          
          {/* 搜索框 (双向绑定) */}
          <div className="relative mb-6">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input 
              type="text" 
              placeholder="搜索问题..." 
              className="input-field w-full pl-11 pr-4 py-3 rounded-xl text-sm" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 动态列表渲染 */}
          <div id="faqList" className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map(item => (
                <FaqItem key={item.id} item={item} />
              ))
            ) : (
              /* 空状态 UI */
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-sm">未找到相关问题</p>
                <p className="text-xs text-gray-400 mt-1">请尝试其他关键词</p>
              </div>
            )}
          </div>

          {/* 底部引导横幅 */}
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