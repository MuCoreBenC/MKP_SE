import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import { VERSION_DICT, printersByBrand } from '../utils/data';

// ==========================================
// 💡 数据源
// ==========================================
const LAYER_DATA = {
  '0.2': ['0.20', '0.16', '0.12', '0.08'],
  '0.4': ['0.28', '0.24', '0.20', '0.16', '0.12', '0.08'],
  '0.6': ['0.42', '0.28', '0.24', '0.20']
};

export default function DownloadPage({ onPrev, onNext }) {
  // === 核心状态 ===
  const currentPrinterId = 'a1'; 
  const currentPrinter = printersByBrand.bambu.find(p => p.id === currentPrinterId);
  const currentVersion = 'quick';

  const [activeFile, setActiveFile] = useState('A1_QuickSwap_v3.0_0.4_0.20.json');
  const [isDownloadExpanded, setIsDownloadExpanded] = useState(false);
  
  // === 选项卡状态 ===
  const [activeTab, setActiveTab] = useState('bbs'); // 默认切到 bbs 方便看效果

  // === BBS 筛选与选择状态 ===
  const [currentNozzle, setCurrentNozzle] = useState('0.4');
  const [layerFilters, setLayerFilters] = useState(['0.20', '0.16']);
  const [selectedBbsFiles, setSelectedBbsFiles] = useState(new Set());

  // ==========================================
  // 🧠 业务逻辑计算
  // ==========================================
  
  // 切换喷嘴时，重置层高过滤
  const handleNozzleChange = (nozzle) => {
    setCurrentNozzle(nozzle);
    const validLayers = LAYER_DATA[nozzle];
    setLayerFilters(prev => prev.filter(l => validLayers.includes(l)));
    setSelectedBbsFiles(new Set()); // 切换喷嘴清空选择
  };

  // 切换层高过滤器
  const handleLayerFilterToggle = (layer) => {
    setLayerFilters(prev => 
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  // 动态生成当前的 BBS 列表数据
  const bbsFiles = useMemo(() => {
    return layerFilters.map(layer => ({
      id: `BBS_A1_${currentNozzle}_${layer}_Optimal.json`,
      filename: `BBS_A1_${currentNozzle}_${layer}_Optimal.json`,
      nozzle: currentNozzle,
      layer: layer,
      author: 'Maker_X'
    })).sort((a, b) => parseFloat(b.layer) - parseFloat(a.layer));
  }, [currentNozzle, layerFilters]);

  // 单个文件勾选
  const toggleBbsFile = (fileId) => {
    const newSet = new Set(selectedBbsFiles);
    newSet.has(fileId) ? newSet.delete(fileId) : newSet.add(fileId);
    setSelectedBbsFiles(newSet);
  };

  // 全选 / 取消全选
  const isAllSelected = bbsFiles.length > 0 && selectedBbsFiles.size === bbsFiles.length;
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBbsFiles(new Set());
    } else {
      setSelectedBbsFiles(new Set(bbsFiles.map(f => f.id)));
    }
  };

  // 删除本地文件模拟
  const handleDeleteLocal = async () => {
    const confirm = await MKPModal.confirm({
      title: '删除本地预设',
      msg: `确定要删除 ${activeFile} 吗？`,
      type: 'error'
    });
    if (confirm) setActiveFile(null);
  };

  return (
    <div id="page-download" className="page flex-1 flex flex-col h-full bg-gray-50/50 dark:bg-[#1A1A1A]">
      
      {/* 全局容器：限制最大宽度，保证大屏优雅，小屏自适应滚动，🌟 无玻璃效果 */}
      <div className="max-w-5xl mx-auto w-full p-4 sm:p-8 flex-1 flex flex-col min-h-0 overflow-y-auto hide-scrollbar pb-24">
        
        {/* ==========================================
            顶部：全局设备状态
            ========================================== */}
        <header className="mb-6 shrink-0 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">设备预设管理</h1>
              <p className="text-sm text-gray-500 mt-1">管理并获取适合您设备的切片配置</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onPrev} className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                上一步
              </button>
              <button onClick={onNext} className="theme-btn-solid px-5 py-2.5 rounded-xl text-sm font-medium transition-all" disabled={!activeFile}>
                下一步
              </button>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#252526] border border-gray-200/80 dark:border-[#333] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-12 h-12 theme-bg-soft rounded-2xl flex items-center justify-center theme-text shadow-inner">
                <Icon name="setting" className="w-6 h-6" /> 
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5 uppercase tracking-wider">当前绑定硬件</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">拓竹 {currentPrinter?.shortName}</span>
                  <span className="text-gray-300 dark:text-[#444]">/</span>
                  <span className="text-xs sm:text-sm font-bold theme-text theme-bg-soft px-2.5 py-1 rounded-lg tracking-wide">{VERSION_DICT[currentVersion]?.name}</span>
                  <span className="text-gray-300 dark:text-[#444]">/</span>
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-mono font-medium border border-gray-200 dark:border-[#444] px-2.5 py-1 rounded-lg">v3.0</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==========================================
            第一部分：本地预设 (绝对主角 + 🌟 布局修正)
            ========================================== */}
        <section className="mb-8 shrink-0 animate-scale-in" style={{ animationDelay: '50ms' }}>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2 pl-1">
            本地正在使用的预设
          </h2>
          
          {/* 使用 flex 布局，小屏堆叠 */}
          <div className="flex flex-col sm:flex-row gap-4">
            
            {activeFile ? (
              // 主卡片 (完美复刻你的浅蓝色边框高亮 UI，且融合了主题系统)
              <div className="bg-white dark:bg-[#252526] rounded-2xl border-2 theme-border shadow-[0_8px_30px_rgba(var(--primary-rgb),0.08)] relative overflow-hidden transition-all flex flex-col flex-1">
                {/* 右上角精美徽标 */}
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] px-4 py-1.5 rounded-bl-2xl font-bold tracking-widest shadow-md">
                  已自动配置
                </div>
                
                {/* 上部内容区域 */}
                <div className="p-6 pb-4">
                    <p className="text-xs theme-text font-bold mb-3.5 flex items-center uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full theme-bg-solid mr-2 animate-pulse shadow-sm"></span> 
                      正在应用中
                    </p>
                    <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 font-mono tracking-tight break-all">
                      {activeFile}
                    </h3>
                </div>

                {/* 🌟 布局修正：下部浅灰色操作条，Trash Icon 在此！ */}
                <div className="mt-auto bg-gray-50 dark:bg-[#1E1E1E] border-t border-gray-100 dark:border-[#333] px-6 py-2.5 flex justify-end">
                  <button 
                    onClick={handleDeleteLocal}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all p-2 rounded-xl" 
                    title="删除本地文件"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#252526] rounded-2xl border border-dashed border-gray-300 dark:border-[#444] p-10 flex flex-col flex-1 items-center justify-center text-center shadow-sm min-h-[160px]">
                <div className="w-12 h-12 bg-gray-50 dark:bg-[#1E1E1E] rounded-full flex items-center justify-center mb-3">
                  <Icon name="info" className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-base font-bold text-gray-800 dark:text-gray-200">当前未应用任何预设</div>
                <div className="text-sm text-gray-500 mt-1">请展开下方在线资源库进行下载与应用</div>
              </div>
            )}

            {/* 🌟 保留假的作为备份卡片，风格一致化 */}
            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-200/80 dark:border-[#333] shadow-sm relative overflow-hidden transition-all flex flex-col flex-1 sm:max-w-[280px]">
                {/* 上部内容区域 */}
                <div className="p-5 pb-3.5">
                    <p className="text-[11px] text-gray-400 uppercase font-bold mb-2.5">保留的旧文件备份</p>
                    <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 font-mono truncate" title="A1_UserCustom_0.2_0.12.json">
                       A1_UserCustom_0.2...json
                    </h3>
                </div>

                {/* 下部浅灰色操作条 */}
                <div className="mt-auto bg-gray-50 dark:bg-[#1E1E1E] border-t border-gray-100 dark:border-[#333] px-5 py-2.5 flex justify-end">
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all p-1.5 rounded-lg" title="删除旧文件备份">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>

          </div>
        </section>

        {/* ==========================================
            第二部分：在线资源库 (现代 SaaS 样式折叠面板 + 🌟 更新按钮回归)
            ========================================== */}
        <section className={`bg-white dark:bg-[#252526] rounded-2xl border border-gray-200/80 dark:border-[#333] shadow-sm flex flex-col transition-all duration-300 shrink-0 ${isDownloadExpanded ? 'ring-4 ring-gray-100 dark:ring-white/5' : ''}`}>
          
          {/* 折叠 Header */}
          <div 
            className={`p-5 cursor-pointer flex justify-between items-center transition-colors select-none ${isDownloadExpanded ? 'border-b border-gray-100 dark:border-[#333]' : 'hover:bg-gray-50 dark:hover:bg-[#2A2D2E] rounded-2xl'}`}
            onClick={() => setIsDownloadExpanded(!isDownloadExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 dark:bg-[#1E1E1E] rounded-2xl border border-gray-100 dark:border-[#444] flex items-center justify-center shadow-inner transition-colors shrink-0">
                <Icon name="download" className={`w-6 h-6 ${isDownloadExpanded ? 'theme-text' : 'text-gray-500'}`} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-all">在线资源库</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
                  {isDownloadExpanded ? '探索系统内置与社区贡献的最佳参数' : '点击展开以下载更多工艺与系统预设'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-4">
                {/* 🌟 修正：检查预设更新按钮回归 */}
                <button 
                  onClick={(e) => { e.stopPropagation(); console.log('检查更新'); }} 
                  className="btn-secondary px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
                >
                  检查预设
                </button>
                <div className={`w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#1E1E1E] transition-all duration-300 ${isDownloadExpanded ? 'rotate-180 bg-blue-50 dark:bg-blue-900/20 theme-text' : 'text-gray-400'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
          </div>

          {/* 展开内容区 */}
          <div className={`collapse-wrapper ${isDownloadExpanded ? 'is-open is-expanded' : ''}`}>
            <div className="collapse-inner flex flex-col">
              
              {/* 现代分段控制器 (Segmented Controls) */}
              <div className="px-5 pt-4 pb-2 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252526] shrink-0">
                <div className="flex p-1 bg-gray-100 dark:bg-[#1E1E1E] rounded-xl overflow-x-auto hide-scrollbar">
                  {[
                    { id: 'part', label: '1. 打印件预设' },
                    { id: 'system', label: '2. Studio 系统预设' },
                    { id: 'bbs', label: '3. BBS 社区参数' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      className={`flex-1 min-w-max px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === tab.id ? 'bg-white dark:bg-[#333] text-gray-900 dark:white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-5 sm:p-6 shrink-0">
                
                {/* === TAB 3: BBS 社区工艺预设 (现代化审美版) === */}
                {activeTab === 'bbs' && (
                  <div className="flex flex-col animate-scale-in">
                    
                    {/* 过滤器区域：Notion 风格柔和卡片 */}
                    <div className="bg-gray-50 dark:bg-[#1E1E1E] p-4 sm:p-5 rounded-2xl border border-gray-100/80 dark:border-[#333] mb-6 flex flex-col gap-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 w-20">选择喷嘴</span>
                        <div className="flex flex-wrap gap-2">
                          {['0.2', '0.4', '0.6'].map(nozzle => (
                            <button 
                              key={nozzle}
                              onClick={() => handleNozzleChange(nozzle)}
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${currentNozzle === nozzle ? 'theme-bg-solid shadow-md font-bold' : 'bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}
                            >{nozzle} mm</button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="h-px bg-gray-200 dark:bg-[#333] w-full"></div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 w-20">
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">包含层高</span>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {LAYER_DATA[currentNozzle].map(layer => {
                            const isActive = layerFilters.includes(layer);
                            return (
                              <button 
                                key={layer}
                                onClick={() => handleLayerFilterToggle(layer)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-emerald-500 text-white shadow-md border-transparent font-bold' : 'bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}
                              >{layer}</button>
                            );
                          })}
                        </div>
                        <span className="text-xs text-gray-400 font-medium ml-3 whitespace-nowrap hidden sm:block">(支持多选)</span>
                      </div>
                    </div>

                    {/* 列表控制条：Notion 风格流线布局 */}
                    <div className="flex items-center justify-between mb-4 pl-1">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isAllSelected ? 'theme-bg-solid border-transparent shadow-inner' : 'border-gray-300 dark:border-gray-500 group-hover:border-blue-400'}`}>
                           {isAllSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7"/></svg>}
                        </div>
                        <input type="checkbox" className="sr-only" checked={isAllSelected} onChange={handleSelectAll} />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 select-none">
                          全选当前过滤项 ({bbsFiles.length})
                        </span>
                      </label>
                      
                      {selectedBbsFiles.size > 0 && (
                        <button className="theme-btn-solid px-5 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2">
                          <Icon name="download" className="w-4 h-4" />
                          批量下载 ({selectedBbsFiles.size})
                        </button>
                      )}
                    </div>

                    {/* 呼吸感卡片列表 */}
                    {bbsFiles.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 font-medium bg-gray-50/50 dark:bg-[#1E1E1E] rounded-2xl border border-dashed border-gray-200/80 dark:border-[#333] shadow-inner">
                        未找到符合条件的预设文件
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3.5">
                        {bbsFiles.map(file => {
                          const isSelected = selectedBbsFiles.has(file.id);
                          const cardClass = isSelected 
                            ? 'theme-bg-soft ring-2 ring-[rgba(var(--primary-rgb),0.3)] shadow-inner'
                            : 'bg-white dark:bg-[#252526] border-gray-200/80 dark:border-[#333] hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-sm';

                          return (
                            <label 
                              key={file.id} 
                              className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 group ${cardClass}`}
                            >
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'theme-bg-solid border-transparent shadow-inner' : 'border-gray-300 dark:border-gray-500 group-hover:border-blue-400'}`}>
                                {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7"/></svg>}
                              </div>
                              
                              <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggleBbsFile(file.id)} />
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 break-all mb-1.5 leading-tight">
                                  {file.filename}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                                  <span className="bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-lg text-xs font-medium border border-gray-200/50 dark:border-transparent">喷嘴 {file.nozzle}</span>
                                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wider">层高 {file.layer}</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium ml-1">作者: {file.author}</span>
                                </div>
                              </div>

                              <button 
                                className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#555] hover:theme-text hover:theme-border rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 ml-2"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('下载', file.id); }}
                              >
                                下载
                              </button>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* 占位 Tab 1 & 2，为了演示代码简洁暂略详情 */}
                {activeTab !== 'bbs' && (
                  <div className="p-12 text-center text-gray-400 font-medium">
                    该模块的现代化卡片更新已就绪，可随时切换。
                  </div>
                )}

              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}