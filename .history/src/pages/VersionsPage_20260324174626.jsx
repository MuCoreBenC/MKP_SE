import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';

// ==========================================
// 💡 1. 文本高亮引擎 (复用 FAQ 页面的神器)
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
// 💡 2. 模拟的更新日志数据 (实际项目中从主进程或云端获取)
// ==========================================
const mockVersionsData = [
  {
    version: '0.2.0',
    date: '2024-06-15',
    isLatest: true,
    type: 'Major', // Major | Patch | Fix
    notes: [
      '重构了全新的 React 架构，性能提升 300%',
      '优化了 G-code 编辑器，支持原生右键插行与历史时光机撤销',
      '新增极致纯粹的 OLED 黑夜主题',
      '彻底移除了冗余的 DOM 操作代码，UI 更加丝滑'
    ]
  },
  {
    version: '0.1.5',
    date: '2024-05-20',
    isLatest: false,
    type: 'Patch',
    notes: [
      '修复了 Z 轴偏移计算的浮点数精度丢失问题',
      '更新了 Bambu Lab A1 mini 的默认预设模型',
      '优化了检查更新时的网络容灾重试逻辑'
    ]
  },
  {
    version: '0.1.0',
    date: '2024-04-10',
    isLatest: false,
    type: 'Initial',
    notes: [
      '支撑面改善工具 MKP SupportE 初代版本发布',
      '支持基础的 X/Y/Z 轴可视化校准网格',
      '支持多源云端预设同步与自动覆盖'
    ]
  }
];

// ==========================================
// 💡 3. 单个版本卡片组件
// ==========================================
function VersionCard({ item, isExpanded, onToggle, searchQuery }) {
  // 根据类型显示不同的颜色标签
  const typeColors = {
    Major: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Patch: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Fix: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Initial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  };

  return (
    <div className={`collapse-item bg-white dark:bg-[#252526] rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden transition-colors hover:shadow-sm hover:border-gray-300 dark:hover:border-[#444] ${isExpanded ? 'expanded' : ''}`}>
      
      {/* 头部可点击区 */}
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
              {item.isLatest && <span className="px-2 py-0.5 rounded text-[10px] font-medium theme-bg-soft theme-text">最新版本</span>}
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${typeColors[item.type] || typeColors.Patch}`}>
                {item.type}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">发布于 {item.date}</div>
          </div>
        </div>
        
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#1e1e1e] group-hover:bg-gray-100 dark:group-hover:bg-[#2a2a2a] transition-colors flex-shrink-0">
          <svg className={`collapse-arrow w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'icon-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>

      {/* 详情折叠区 */}
      <div className={`collapse-wrapper ${isExpanded ? 'is-open is-expanded' : ''}`}>
        <div className="collapse-inner">
          <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-[#333] mx-5">
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {item.notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
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
  
  // 维护一个 Set，里面存着当前展开的版本号（默认只展开最新的）
  const [expandedItems, setExpandedItems] = useState(new Set([mockVersionsData[0].version]));
  
  // 状态：是否正在检查更新、是否有新版本已准备就绪
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  // 根据搜索词实时过滤数据
  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return mockVersionsData;
    const query = searchQuery.toLowerCase();
    return mockVersionsData.filter(item => 
      item.version.toLowerCase().includes(query) || 
      item.notes.some(note => note.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // 控制单个卡片的展开/收起
  const toggleItem = (version) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedItems(newExpanded);
  };

  // 一键展开/收起所有过滤后的卡片
  const isAllExpanded = expandedItems.size === filteredVersions.length && filteredVersions.length > 0;
  const toggleAllHistory = () => {
    if (isAllExpanded) {
      setExpandedItems(new Set()); // 全部收起
    } else {
      setExpandedItems(new Set(filteredVersions.map(v => v.version))); // 全部展开
    }
  };

  // 模拟检查更新逻辑
  const handleCheckUpdate = async () => {
    if (isChecking) return;
    setIsChecking(true);
    
    // 模拟网络请求延迟
    setTimeout(async () => {
      setIsChecking(false);
      setIsUpdateReady(true);
      await MKPModal.alert({
        title: '发现新版本',
        msg: '发现全新的 <b>v0.2.1</b> 版本！<br>更新包已在后台静默下载完毕，将在下次启动时应用，或者您也可以点击立即重启。',
        type: 'success'
      });
    }, 1500);
  };

  // 模拟重启逻辑
  const handleRestart = () => {
    // 实际项目中：window.mkpAPI.restartApp()
    console.log('执行软重启以应用更新...');
  };

  return (
    <div id="page-versions" className="page flex-1" data-fixed-header="true">
      {/* 头部 */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">版本控制</h1>
          <button 
            onClick={handleCheckUpdate} 
            disabled={isChecking || isUpdateReady}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${isUpdateReady ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default' : 'theme-btn-solid active:scale-95'}`}
          >
            {isChecking ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : isUpdateReady ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            ) : (
              <Icon name="download" className="w-4 h-4" />
            )}
            {isChecking ? '检查中...' : isUpdateReady ? '已准备就绪' : '检查更新'}
          </button>
        </div>
        <div className="page-header-sub"></div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl">
          
          {/* 🌟 核心：新版本准备就绪提示横幅 (完美复原) */}
          {isUpdateReady && (
            <div className="animate-scale-in w-full mb-6">
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
                <button 
                  onClick={handleRestart} 
                  className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-all shadow-sm active:scale-95"
                >
                  <Icon name="setting" className="w-4 h-4" /> {/* 可以替换为重启图标 */}
                  点击重启立即更新
                </button>
              </div>
            </div>
          )}

          {/* 搜索与工具栏 */}
          <div className="flex items-center gap-3 mb-5">
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
          <div className="space-y-3 pb-8">
            {filteredVersions.length > 0 ? (
              filteredVersions.map(item => {
                // 如果有搜索词，自动展开包含搜索词的卡片
                const isExpanded = expandedItems.has(item.version) || searchQuery.trim().length > 0;
                
                return (
                  <VersionCard 
                    key={item.version} 
                    item={item} 
                    isExpanded={isExpanded} 
                    onToggle={() => toggleItem(item.version)}
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