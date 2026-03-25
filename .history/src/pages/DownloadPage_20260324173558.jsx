import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import { MKPContextMenu } from '../components/GlobalContextMenu';
import { VERSION_DICT, printersByBrand } from '../utils/data';

// 模拟的 API (实际项目中你会调用 window.mkpAPI)
const mockLocalFiles = [
  { fileName: 'a1_standard_v3.0.0.json', displayTitle: 'A1 官方原版', version: '3.0.0', size: 10240, modifiedAt: Date.now() },
  { fileName: 'a1_standard_v3.0.0_copy.json', displayTitle: '我的超强修改版', version: '3.0.0', size: 11240, modifiedAt: Date.now() - 86400000 },
];
const mockOnlineFiles = [
  { id: 'v3.1.0', fileName: 'a1_standard_v3.1.0.json', version: '3.1.0', date: '2024-05-01', changes: ['修复了悬垂打印质量', '优化了擦嘴速度'], isLatest: true }
];

export default function DownloadPage({ onPrev, onNext }) {
  // ==========================================
  // 1. 核心状态管理 (State)
  // ==========================================
  // 从全局或 localStorage 读取当前机型 (这里暂且写死为 'a1' 用于演示)
  const currentPrinterId = 'a1'; 
  const currentPrinter = printersByBrand.bambu.find(p => p.id === currentPrinterId);
  
  const [selectedVersion, setSelectedVersion] = useState('standard');
  const [localPresets, setLocalPresets] = useState([]);
  const [onlinePresets, setOnlinePresets] = useState([]);
  
  // 批量管理系统状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('updated-desc');
  const [pinnedFiles, setPinnedFiles] = useState(new Set()); // 置顶文件
  const [activeFile, setActiveFile] = useState('a1_standard_v3.0.0.json'); // 当前正在使用的文件

  const [isFetchingOnline, setIsFetchingOnline] = useState(false);

  // 初始化加载本地数据
  useEffect(() => {
    // 实际项目中从 window.mkpAPI 获取
    setLocalPresets(mockLocalFiles);
  }, [selectedVersion]);

  // ==========================================
  // 2. 数据派生与过滤 (Data Derivation)
  // ==========================================
  // 使用 useMemo 缓存计算结果：只要依赖项变化，自动重新过滤和排序！
  const processedLocalPresets = useMemo(() => {
    let result = [...localPresets];

    // 1. 搜索过滤
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.displayTitle.toLowerCase().includes(q) || p.fileName.toLowerCase().includes(q));
    }

    // 2. 排序引擎
    result.sort((a, b) => {
      // 置顶优先
      const aPinned = pinnedFiles.has(a.fileName);
      const bPinned = pinnedFiles.has(b.fileName);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      // 按规则排序
      if (sortMode === 'name-asc') return a.displayTitle.localeCompare(b.displayTitle, 'zh-CN');
      if (sortMode === 'updated-desc') return b.modifiedAt - a.modifiedAt;
      return 0; // custom 略
    });

    return result;
  }, [localPresets, searchQuery, sortMode, pinnedFiles]);

  // ==========================================
  // 3. 业务交互逻辑 (Actions)
  // ==========================================
  // 切换文件多选状态
  const toggleFileSelection = (fileName) => {
    const newSet = new Set(selectedFiles);
    if (newSet.has(fileName)) newSet.delete(fileName);
    else newSet.add(fileName);
    setSelectedFiles(newSet);
  };

  // 全选/反选
  const handleSelectAll = () => {
    if (selectedFiles.size === processedLocalPresets.length) {
      setSelectedFiles(new Set()); // 全部取消
    } else {
      setSelectedFiles(new Set(processedLocalPresets.map(p => p.fileName))); // 全选当前可见
    }
  };

  // 获取云端数据
  const handleCheckOnline = async () => {
    setIsFetchingOnline(true);
    // 模拟网络请求
    setTimeout(() => {
      setOnlinePresets(mockOnlineFiles);
      setIsFetchingOnline(false);
    }, 800);
  };

  // 右键菜单引擎
  const handleContextMenu = async (e, preset) => {
    e.preventDefault();
    const isPinned = pinnedFiles.has(preset.fileName);
    const isActive = activeFile === preset.fileName;

    const menuItems = [
      { action: 'apply', label: '立即应用', disabled: isActive },
      { action: 'edit', label: '编辑参数' },
      { action: 'copy', label: '复制副本' },
      { type: 'separator' },
      { action: 'pin', label: isPinned ? '取消置顶' : '置顶此配置' },
      { action: 'rename', label: '重命名显示名' },
      { action: 'explore', label: '在资源管理器中显示' },
      { type: 'separator' },
      { action: 'delete', label: '删除配置' }
    ];

    const action = await MKPContextMenu.show(e.clientX, e.clientY, menuItems);
    
    if (action === 'apply') setActiveFile(preset.fileName);
    if (action === 'pin') {
      const newPinned = new Set(pinnedFiles);
      isPinned ? newPinned.delete(preset.fileName) : newPinned.add(preset.fileName);
      setPinnedFiles(newPinned);
    }
    if (action === 'delete') {
      const confirm = await MKPModal.confirm({ title: '删除配置', msg: `确定要删除 ${preset.displayTitle} 吗？`, type: 'error' });
      if (confirm) setLocalPresets(prev => prev.filter(p => p.fileName !== preset.fileName));
    }
    if (action === 'rename') {
      const newName = await MKPModal.prompt({ title: '重命名', value: preset.displayTitle });
      if (newName) {
        setLocalPresets(prev => prev.map(p => p.fileName === preset.fileName ? { ...p, displayTitle: newName } : p));
      }
    }
  };

  // ==========================================
  // 4. 视图渲染区 (View)
  // ==========================================
  return (
    <div id="page-download" className="page flex-1" data-fixed-header="true">
      {/* --- 页面头部 --- */}
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">模型预设</h1>
          <div className="flex items-center gap-3">
            <button onClick={onPrev} className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
              <span>上一步</span>
            </button>
            <button onClick={onNext} className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all" disabled={!activeFile}>
              <span>下一步</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500">选择版本类型和发布日期以获取对应的预设配置</p>
        </div>
      </div>
      
      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl flex flex-col space-y-8 pb-12">
          
          {/* --- 第一块：选择版本类型 --- */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Icon name="info" className="w-6 h-6 text-gray-400" />
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">选择版本类型</h2>
                <p className="text-xs text-gray-500">为 {currentPrinter?.name} 选择合适的配置版本</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              {currentPrinter?.supportedVersions.map(v => {
                const vInfo = VERSION_DICT[v];
                const isSelected = selectedVersion === v;
                return (
                  <div 
                    key={v}
                    onClick={() => setSelectedVersion(v)}
                    className={`version-card group bg-white dark:bg-[#252526] rounded-xl border p-4 cursor-pointer transition-all duration-200 ${isSelected ? 'selected theme-border bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${vInfo.bgClass} ${vInfo.textClass}`}>
                        <Icon name="setting" className="w-6 h-6" /> {/* 替换为你专属的图标 */}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{vInfo.name}</div>
                        <div className="text-xs text-gray-500">官方稳定版本，适合日常打印</div>
                      </div>
                      {/* 选中打勾 */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-transparent theme-bg-solid' : 'border-gray-200 dark:border-[#444]'}`}>
                        {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* --- 第二块：本地预设列表 --- */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Icon name="setting" className="w-6 h-6 text-gray-400 theme-text" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">本地预设</h2>
                  <p className="text-xs text-gray-500">已存储在您电脑中的配置</p>
                </div>
              </div>
              
              {/* 工具栏 */}
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="搜索文件名.." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-36 px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252526]" 
                />
                
                <button 
                  onClick={() => setIsMultiSelectMode(!isMultiSelectMode)} 
                  className={`p-1.5 rounded-md transition-colors ${isMultiSelectMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                  title="批量管理"
                >
                  <Icon name="setting" className="w-4 h-4" />
                </button>

                {!isMultiSelectMode && (
                  <button onClick={handleCheckOnline} className="theme-btn-soft px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                    <Icon name="download" className="w-4 h-4" /> 检查预设
                  </button>
                )}
              </div>
            </div>

            {/* 批量操作工具栏 */}
            {isMultiSelectMode && (
              <div className="mb-4 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1E1E1E] px-4 py-3 flex items-center justify-between animate-scale-in">
                <div className="text-xs text-gray-500">已选中 {selectedFiles.size} 个预设</div>
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444]">全选/反选</button>
                  <button disabled={selectedFiles.size === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium theme-btn-soft disabled:opacity-50">复制选中</button>
                  <button disabled={selectedFiles.size === 0} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 disabled:opacity-50">删除选中</button>
                </div>
              </div>
            )}

            {/* 列表渲染 */}
            <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-200 dark:border-[#333] shadow-sm overflow-hidden">
              {processedLocalPresets.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">暂无本地预设，请检查更新。</div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#333]">
                  {processedLocalPresets.map(preset => {
                    const isSelected = selectedFiles.has(preset.fileName);
                    const isActive = activeFile === preset.fileName;
                    const isPinned = pinnedFiles.has(preset.fileName);
                    
                    return (
                      <div 
                        key={preset.fileName} 
                        onContextMenu={(e) => handleContextMenu(e, preset)}
                        className={`group px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/20 border-l-2 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-[#2A2D2E]'}`}
                        onClick={() => isMultiSelectMode && toggleFileSelection(preset.fileName)}
                      >
                        <div className="flex items-center gap-3">
                          {/* 多选框 */}
                          {isMultiSelectMode && (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                            </div>
                          )}
                          
                          <div className="font-bold text-gray-900 dark:text-gray-100">{preset.displayTitle}</div>
                          {isPinned && <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-200">置顶</span>}
                          {isActive && <span className="px-2 py-0.5 rounded text-[10px] theme-btn-solid shadow-sm">当前使用</span>}
                        </div>

                        {!isMultiSelectMode && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveFile(preset.fileName); }}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${isActive ? 'theme-btn-solid' : 'theme-btn-soft'}`}
                          >
                            {isActive ? '已应用' : '应用'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* --- 第三块：在线预设 (按需展示) --- */}
          {onlinePresets.length > 0 && (
            <div className="animate-scale-in">
              <div className="flex items-center gap-3 mb-4">
                <Icon name="download" className="w-6 h-6 text-gray-400" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">云端预设</h2>
                  <p className="text-xs text-gray-500">点击下载到本地</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#252526] rounded-2xl border border-gray-200 dark:border-[#333] shadow-sm overflow-hidden">
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#333]">
                  {onlinePresets.map(preset => (
                    <div key={preset.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          v{preset.version}
                          {preset.isLatest && <span className="px-2 py-0.5 rounded text-[10px] theme-bg-soft theme-text">最新</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">更新于 {preset.date}</div>
                      </div>
                      <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-[#333] dark:border-[#444] dark:text-gray-200 dark:hover:bg-[#444] rounded-lg px-4 py-1.5 text-xs font-medium transition-all active:scale-95">
                        下载
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}