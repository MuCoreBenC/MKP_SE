import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import { VERSION_DICT, printersByBrand } from '../utils/data';

// ==========================================
// 💡 模拟数据源
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
  const currentVersion = 'quick'; // 假设新用户选择了快拆版

  const [activeFile, setActiveFile] = useState('A1_QuickSwap_v3.0_0.4_0.20.json');
  
  // === UI 折叠与选项卡状态 ===
  const [isDownloadExpanded, setIsDownloadExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('part'); // 'part' | 'system' | 'bbs'

  // === BBS 筛选状态 ===
  const [currentNozzle, setCurrentNozzle] = useState('0.4');
  const [selectedLayers, setSelectedLayers] = useState(['0.20']);

  // === 动作处理 ===
  const handleNozzleChange = (nozzle) => {
    setCurrentNozzle(nozzle);
    // 切换喷嘴时，过滤掉当前不支持的层高，防止空数据
    const validLayers = LAYER_DATA[nozzle];
    setSelectedLayers(prev => prev.filter(l => validLayers.includes(l)));
  };

  const handleLayerToggle = (layer) => {
    setSelectedLayers(prev => 
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  const handleDeleteLocal = async () => {
    const confirm = await MKPModal.confirm({
      title: '删除本地预设',
      msg: `确定要删除 ${activeFile} 吗？`,
      type: 'error'
    });
    if (confirm) {
      setActiveFile(null); // 模拟删除
      MKPModal.alert({ title: '已删除', msg: '本地文件已移除。', type: 'success' });
    }
  };

  return (
    <div id="page-download" className="page flex-1 flex flex-col h-full" data-fixed-header="false">
      
      <div className="max-w-5xl mx-auto w-full p-8 pb-20 flex-1 flex flex-col min-h-0 hide-scrollbar">
        
        {/* ==========================================
            顶部：全局设备状态
            ========================================== */}
        <header className="mb-6 flex-shrink-0 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">设备预设管理</h1>
            <div className="flex items-center gap-3">
              <button onClick={onPrev} className="btn-secondary px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
                <span>上一步</span>
              </button>
              <button onClick={onNext} className="theme-btn-solid px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all" disabled={!activeFile}>
                <span>下一步</span>
              </button>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#333] rounded-2xl p-4 flex items-center justify-between shadow-sm transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 theme-bg-soft rounded-full flex items-center justify-center theme-text">
                <Icon name="setting" className="w-6 h-6" /> {/* 可以换成打印机图标 */}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">当前绑定硬件</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">拓竹 {currentPrinter?.shortName}</span>
                  <span className="text-gray-300 dark:text-[#444]">|</span>
                  <span className="text-sm font-medium theme-text theme-bg-soft px-2.5 py-0.5 rounded-md">{VERSION_DICT[currentVersion]?.name}</span>
                  <span className="text-gray-300 dark:text-[#444]">|</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono border border-gray-200 dark:border-[#444] px-2 py-0.5 rounded-md">v3.0</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==========================================
            第一部分：本地预设 (绝对主角)
            ========================================== */}
        <section className="mb-6 flex-shrink-0 animate-scale-in" style={{ animationDelay: '50ms' }}>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
            <Icon name="info" className="w-4 h-4 mr-1.5" />
            本地正在使用的预设
          </h2>
          
          <div className="flex gap-4">
            {activeFile ? (
              // 核心卡片 (完美复刻你的浅蓝色边框高亮 UI，且融合了主题系统)
              <div className="bg-white dark:bg-[#252526] rounded-2xl border-2 theme-border shadow-[0_4px_20px_rgba(var(--primary-rgb),0.12)] p-6 flex-1 relative overflow-hidden transition-colors">
                
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] px-3.5 py-1.5 rounded-bl-xl font-bold tracking-wider shadow-sm">
                  已为您自动配置
                </div>
                
                <div className="flex items-start justify-between mt-1">
                  <div>
                    <p className="text-xs theme-text font-bold mb-2 flex items-center">
                      <span className="w-2 h-2 rounded-full theme-bg-solid mr-1.5 animate-pulse"></span> 本地应用中
                    </p>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 font-mono tracking-tight">
                      {activeFile}
                    </h3>
                  </div>
                  <button 
                    onClick={handleDeleteLocal}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors p-2 rounded-lg mt-4" 
                    title="删除本地文件"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-[#1E1E1E] rounded-2xl border border-dashed border-gray-200 dark:border-[#444] p-8 flex-1 flex flex-col items-center justify-center text-center">
                <Icon name="info" className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                <div className="text-sm font-medium text-gray-500">当前未应用任何预设</div>
                <div className="text-xs text-gray-400 mt-1">请展开下方在线资源库进行下载</div>
              </div>
            )}
          </div>
        </section>

        {/* ==========================================
            第二部分：下载资源库 (可折叠面板 + 3个选项卡)
            ========================================== */}
        <section className={`collapse-item bg-white dark:bg-[#252526] rounded-2xl border border-gray-200 dark:border-[#333] shadow-sm flex flex-col transition-all duration-300 ${isDownloadExpanded ? 'expanded flex-1 min-h-0' : 'flex-shrink-0'}`}>
          
          {/* 折叠 Header */}
          <div 
            className="p-5 bg-gray-50 dark:bg-[#2A2D2E] border-b border-gray-200 dark:border-[#333] cursor-pointer flex justify-between items-center hover:bg-gray-100 dark:hover:bg-[#333] transition-colors select-none rounded-t-2xl" 
            onClick={() => setIsDownloadExpanded(!isDownloadExpanded)}
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white dark:bg-[#252526] rounded-xl border border-gray-200 dark:border-[#444] flex items-center justify-center mr-4 shadow-sm">
                <Icon name="download" className="w-5 h-5 theme-text" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">获取更多在线预设</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isDownloadExpanded ? '打印件专属 / 系统内置 / BBS 社区参数' : '点击展开以下载更多工艺与系统预设'}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] shadow-sm transition-transform duration-300">
              <svg className={`w-4 h-4 text-gray-500 transition-transform duration-400 ${isDownloadExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {/* 可折叠内容区 (复用 CSS 的 grid-template-rows: 0fr/1fr 引擎) */}
          <div className={`collapse-wrapper ${isDownloadExpanded ? 'is-open is-expanded flex-1 min-h-0' : ''}`}>
            <div className="collapse-inner flex flex-col h-full">
              
              {/* Tabs 导航栏 */}
              <div className="flex border-b border-gray-200 dark:border-[#333] px-2 pt-2 bg-white dark:bg-[#252526] shrink-0">
                {[
                  { id: 'part', label: '1. 打印件版本预设' },
                  { id: 'system', label: '2. Studio 系统预设' },
                  { id: 'bbs', label: '3. BBS 工艺参数库' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    className={`px-6 py-3.5 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id ? 'theme-border theme-text' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tabs 内容区 */}
              <div className="p-0 bg-white dark:bg-[#252526] flex-1 overflow-y-auto relative rounded-b-2xl">
                
                {/* TAB 1: 打印件版本预设 */}
                {activeTab === 'part' && (
                  <div className="p-6 animate-scale-in">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                      <span className="theme-bg-soft theme-text px-2 py-0.5 rounded text-xs mr-2 font-bold">{VERSION_DICT[currentVersion]?.name}系列</span> 
                      匹配您设备的专属基础配置
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 border-2 theme-border bg-[rgba(var(--primary-rgb),0.05)] rounded-xl">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 dark:text-gray-100">v3.0 官方推荐版</span>
                            <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider">LATEST</span>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">A1_QuickSwap_v3.0_Base.json</p>
                        </div>
                        <button className="px-5 py-2 theme-btn-solid text-sm font-bold rounded-lg shadow-sm active:scale-95">下 载</button>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-[#444] hover:border-gray-300 dark:hover:border-gray-500 rounded-xl transition-colors">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-300 mb-1">v2.5 稳定版 <span className="text-xs text-gray-400 font-normal ml-2">2023-08更新</span></div>
                          <p className="text-xs text-gray-400 font-mono">A1_QuickSwap_v2.5_Base.json</p>
                        </div>
                        <button className="px-5 py-2 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#555] text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:theme-text hover:theme-border transition-colors">下 载</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: 系统内置预设 */}
                {activeTab === 'system' && (
                  <div className="p-6 animate-scale-in">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Bambu Studio 原厂内置预设 (A1 机型)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {['0.20mm Standard @BBL A1', '0.16mm Optimal @BBL A1', '0.12mm Fine @BBL A1'].map(name => (
                        <div key={name} className="border border-gray-200 dark:border-[#444] p-4 rounded-xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors flex justify-between items-center group cursor-pointer">
                          <div>
                            <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{name}</div>
                            <p className="text-xs text-gray-400 mt-1">系统默认配置提取</p>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 theme-text text-sm font-bold transition-opacity">应 用</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: BBS 社区工艺预设 */}
                {activeTab === 'bbs' && (
                  <div className="flex flex-col h-full animate-scale-in">
                    {/* 筛选栏 */}
                    <div className="p-5 border-b border-gray-100 dark:border-[#333] bg-gray-50/50 dark:bg-[#1E1E1E]">
                      <div className="flex gap-8 items-start">
                        {/* 喷嘴单选 */}
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-3">选择喷嘴：</span>
                          <div className="flex gap-2">
                            {['0.2', '0.4', '0.6'].map(nozzle => (
                              <button 
                                key={nozzle}
                                onClick={() => handleNozzleChange(nozzle)}
                                className={`px-4 py-1.5 rounded-lg border text-sm transition-colors ${currentNozzle === nozzle ? 'theme-btn-solid font-bold shadow-sm' : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#252526] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                              >{nozzle} mm</button>
                            ))}
                          </div>
                        </div>
                        <div className="w-px h-8 bg-gray-200 dark:bg-[#444]"></div>
                        {/* 层高多选 */}
                        <div className="flex items-center flex-1">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-3">选择层高：</span>
                          <div className="flex flex-wrap gap-2">
                            {LAYER_DATA[currentNozzle].map(layer => {
                              const isActive = selectedLayers.includes(layer);
                              return (
                                <button 
                                  key={layer}
                                  onClick={() => handleLayerToggle(layer)}
                                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${isActive ? 'theme-bg-solid border-transparent text-white shadow-sm font-medium' : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#252526] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                                >{layer}</button>
                              );
                            })}
                          </div>
                          <span className="text-xs text-gray-400 ml-3">(支持多选批量下载)</span>
                        </div>
                      </div>
                    </div>

                    {/* 列表渲染 */}
                    <div className="flex-1 overflow-y-auto">
                      {selectedLayers.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">请选择上方的层高以查看预设</div>
                      ) : (
                        <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#333]">
                          {/* 模拟数据列表 */}
                          {[...selectedLayers].sort((a,b) => b - a).map(layer => (
                            <div key={layer} className="flex items-center justify-between p-4 hover:bg-[rgba(var(--primary-rgb),0.03)] transition-colors group">
                              <div className="flex items-center gap-4">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded theme-text cursor-pointer border-gray-300" />
                                <div>
                                  <div className="font-mono text-gray-900 dark:text-gray-100 font-medium mb-1">BBS_A1_{currentNozzle}_{layer}_Optimal.json</div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">喷嘴 {currentNozzle}</span>
                                    <span className="theme-bg-soft theme-text px-2 py-0.5 rounded font-medium">层高 {layer}</span>
                                    <span className="text-gray-400 flex items-center ml-2">
                                      Maker_X · <Icon name="logo_douyin" className="w-3 h-3 mx-1 text-gray-400" /> 1k+ 下载
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#555] hover:theme-border hover:theme-text text-gray-600 dark:text-gray-200 rounded-lg text-xs font-medium transition-all shadow-sm">
                                单独下载
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 底部批量操作栏 */}
                    <div className="p-4 bg-gray-50 dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#333] flex justify-between items-center shrink-0">
                      <span className="text-sm text-gray-600 dark:text-gray-300">已勾选 <span className="font-bold theme-text mx-1 text-base">{selectedLayers.length}</span> 个工艺预设</span>
                      <button 
                        disabled={selectedLayers.length === 0} 
                        className="px-6 py-2.5 theme-btn-solid font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        批量下载勾选项
                      </button>
                    </div>
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