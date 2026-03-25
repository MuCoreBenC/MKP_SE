import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';

// ==========================================
// 💡 1. 文本高亮引擎 (保持不变)
// ==========================================
const HighlightText = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 text-yellow-900 rounded-[2px] px-0.5 mx-[1px] bg-opacity-80 dark:bg-yellow-500/30 dark:text-yellow-200 font-bold bg-transparent">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};

// ==========================================
// 💡 2. 本地历史版本数据
// severity: 'Major' (大更新) | 'Minor' (新功能) | 'Patch' (小修复)
// ==========================================
const localHistoryData = [
  {
    version: '0.2.0',
    date: '2024-06-15',
    isCurrent: true,
    severity: 'Major', 
    type: '核心升级',
    notes: [
      '重构了全新的 React 架构，性能提升 300%',
      '优化了 G-code 编辑器，支持原生右键插行与撤销',
      '彻底移除了冗余的 DOM 操作代码，UI 更加丝滑'
    ]
  },
  {
    version: '0.1.5',
    date: '2024-05-20',
    isCurrent: false,
    severity: 'Patch',
    type: '修复补丁',
    notes: [
      '修复了 Z 轴偏移计算的浮点数精度丢失问题',
      '优化了检查更新时的网络容灾重试逻辑'
    ]
  }
];

// ==========================================
// 💡 3. 单个版本卡片组件 (带视觉层级区分)
// ==========================================
function VersionCard({ item, isExpanded, onToggle, onApplyUpdate, searchQuery }) {
  // 🌟 核心设计：根据更新大小，定义完全不同的视觉表现 (深浅、边框、背景)
  const severityStyles = {
    // 🔴 大更新：极度醒目，强烈的品牌色边框和柔和背景
    Major: {
      card: 'border-2 border-blue-400 dark:border-blue-500 shadow-md bg-blue-50/30 dark:bg-blue-900/10',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-black',
      btn: 'bg-blue-500 hover:bg-blue-600 text-white shadow-md active:scale-95',
    },
    // 🟢 中更新：较醒目，绿色系
    Minor: {
      card: 'border-2 border-emerald-300 dark:border-emerald-600/50 shadow-sm bg-white dark:bg-[#252526]',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold',
      btn: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95',
    },
    // ⚪ 小更新/历史版本：最克制，灰色系
    Patch: {
      card: 'border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252526] hover:border-gray-300 dark:hover:border-[#444]',
      badge: 'bg-gray-100 text-gray-600 dark:bg-[#333] dark:text-gray-300 font-medium',
      btn: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#333] dark:text-gray-300 dark:hover:bg-[#444]',
    }
  };

  const style = severityStyles[item.severity] || severityStyles.Patch;
  const [isDownloading, setIsDownloading] = useState(false);

  // 处理点击“立即更新”
  const handleUpdateClick = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    await onApplyUpdate(item);
    setIsDownloading(false);
  };

  return (
    <div className={`collapse-item rounded-xl overflow-hidden transition-all duration-300 ${style.card} ${isExpanded ? 'expanded' : ''}`}>
      
      <button 
        className="w-full px-5 py-4 flex items-center justify-between text-left outline-none group" 
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:theme-text transition-colors">
                <HighlightText text={`v${item.version}`} query={searchQuery} />
              </span>
              
              {/* 版本类型徽章 (颜色深浅区分) */}
              <span className={`px-2.5 py-0.5 rounded text-[11px] tracking-wide ${style.badge}`}>
                {item.severity === 'Major' ? '🔥 ' : ''}{item.type}
              </span>

              {/* 状态徽章 */}
              {item.isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-bold theme-bg-solid shadow-sm">当前运行</span>}
              {item.status === 'AVAILABLE' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse">待更新</span>}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">发布于 {item.date}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* 操作按钮 (仅当有新版本时显示“立即更新”，如果是老版本则显示“回退”) */}
          {item.status === 'AVAILABLE' ? (
             <button 
               onClick={handleUpdateClick}
               disabled={isDownloading}
               className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${style.btn} flex items-center gap-1.5`}
             >
               {isDownloading ? (
                 <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 下载中...</>
               ) : (
                 <><Icon name="download" className="w-3.5 h-3.5" /> 立即更新</>
               )}
             </button>
          ) : !item.isCurrent && (
             <button 
               onClick={(e) => { e.stopPropagation(); MKPModal.confirm({title: '确认回退？', msg: `是否回退到 v${item.version}？`})}}
               className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${style.btn}`}
             >
               回退
             </button>
          )}

          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#1e1e1e] group-hover:bg-gray-100 dark:group-hover:bg-[#2a2a2a] transition-colors">
            <svg className={`collapse-arrow w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'icon-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>
      </button>

      {/* 详情折叠区 */}
      <div className={`collapse-wrapper ${isExpanded ? 'is-open is-expanded' : ''}`}>
        <div className="collapse-inner">
          <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-[#333] mx-5">
            <div className="text-xs font-bold text-gray-400 mb-2">更新日志：</div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {item.notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
                  <span><HighlightText text={note} query={searchQuery} /></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 💡 4. 主页面组件
// ==========================================
export default function VersionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  
  // 版本列表数据状态 (初始化为本地已安装的记录)
  const [versionsData, setVersionsData] = useState(localHistoryData);
  
  // 维护当前展开的卡片集合
  const [expandedItems, setExpandedItems] = useState(new Set([localHistoryData[0].version]));

// ==========================================
  // 🚀 核心逻辑：安静地检查更新 (已修复重复添加 Bug)
  // ==========================================
  const handleCheckUpdate = () => {
    if (isChecking) return;
    setIsChecking(true);
    
    // 模拟网络请求：1.5秒后，拿到云端数据
    setTimeout(() => {
      setIsChecking(false);
      
      // 假设云端有一个“史诗级大更新”
      const newVersionFromServer = {
        version: '0.3.0',
        date: '2024-06-20',
        isCurrent: false,
        status: 'AVAILABLE', 
        severity: 'Major',   
        type: '全新架构重构',
        notes: [
          '这是云端下发的全新大版本',
          '完全支持静默更新，将控制权交还给用户',
          '加入了全新极简黑夜模式'
        ]
      };

      // 🌟 修复 Bug 的关键：判断如果列表里已经有这个版本了，就啥也不做！
      setVersionsData(prev => {
        const isExist = prev.some(v => v.version === newVersionFromServer.version);
        if (isExist) {
          // 如果之前已经拉取过了，你可以考虑在这里加个小提示，比如：
          // MKPModal.alert({ title: '检查完毕', msg: '当前已经是最新状态，无需重复获取。', type: 'info' });
          return prev; 
        }
        return [newVersionFromServer, ...prev]; // 如果没有，才插到最前面
      });
      
      // 展开新版本的卡片
      setExpandedItems(prev => new Set(prev).add(newVersionFromServer.version));

    }, 1500);
  };

  // ==========================================
  // 🚀 核心逻辑：用户主动决定应用更新
  // ==========================================
  const handleApplyUpdate = async (item) => {
    // 此时按钮显示“下载中...”
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟下载补丁过程

    // 下载完毕后，我们才极其克制地弹出一个确认重启的框
    const confirmed = await MKPModal.confirm({
      title: '更新已准备就绪',
      msg: `版本 <b>v${item.version}</b> 的更新包已下载完毕。<br><br>是否立即重启软件以应用更新？（若选择取消，将在下次启动时自动应用）`,
      type: 'success',
      confirmText: '立即重启',
      cancelText: '稍后生效'
    });

    if (confirmed) {
      console.log('执行软重启... window.mkpAPI.restartApp()');
      // window.mkpAPI.restartApp();
    } else {
      // 用户选择稍后，我们可以把卡片状态改一下
      setVersionsData(prev => prev.map(v => 
        v.version === item.version ? { ...v, status: 'PENDING_RESTART' } : v
      ));
    }
  };

  // 根据搜索词实时过滤
  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return versionsData;
    const query = searchQuery.toLowerCase();
    return versionsData.filter(item => 
      item.version.toLowerCase().includes(query) || 
      item.notes.some(note => note.toLowerCase().includes(query))
    );
  }, [searchQuery, versionsData]);

  const toggleItem = (version) => {
    const newExpanded = new Set(expandedItems);
    newExpanded.has(version) ? newExpanded.delete(version) : newExpanded.add(version);
    setExpandedItems(newExpanded);
  };

  const isAllExpanded = expandedItems.size === filteredVersions.length && filteredVersions.length > 0;
  const toggleAllHistory = () => {
    if (isAllExpanded) {
      setExpandedItems(new Set()); 
    } else {
      setExpandedItems(new Set(filteredVersions.map(v => v.version))); 
    }
  };

  return (
    <div id="page-versions" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">版本控制</h1>
          
          {/* 安静的检查更新按钮，不再控制全局弹窗 */}
          <button 
            onClick={handleCheckUpdate} 
            disabled={isChecking}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all theme-btn-solid active:scale-95 disabled:opacity-70`}
          >
            {isChecking ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 检查中...</>
            ) : (
              <><Icon name="download" className="w-4 h-4" /> 检查更新</>
            )}
          </button>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500">获取最新功能，或回退至历史版本。</p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl">
          
          {/* 搜索与工具栏 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
              <input 
                type="text" 
                placeholder="搜索版本号或更新说明..." 
                className="input-field w-full pl-11 pr-4 py-2.5 rounded-xl text-sm" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={toggleAllHistory} 
              className={`btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-all ${isAllExpanded ? 'bg-gray-100 dark:bg-[#333]' : ''}`}
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${isAllExpanded ? 'text-blue-500 rotate-180' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>{isAllExpanded ? '收起全部' : '展开全部'}</span>
            </button>
          </div>
          
          {/* 版本列表 */}
          <div className="space-y-4 pb-12">
            {filteredVersions.length > 0 ? (
              filteredVersions.map(item => {
                const isExpanded = expandedItems.has(item.version) || searchQuery.trim().length > 0;
                return (
                  <VersionCard 
                    key={item.version} 
                    item={item} 
                    isExpanded={isExpanded} 
                    onToggle={() => toggleItem(item.version)}
                    onApplyUpdate={handleApplyUpdate}
                    searchQuery={searchQuery}
                  />
                );
              })
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Icon name="info" className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">未找到相关的版本记录</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}