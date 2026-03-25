import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import { Logger } from '../utils/logger';

const MODE_LABELS = {
  '1': '最小热更新',
  '2': '标准热更新',
  '3': '完整热更新',
  '4': '全量安装包'
};

// 极简版 Markdown 解析器 (复用你原有的正则逻辑)
const parseMarkdown = (text) => {
  if (!text) return '<p>暂无内容</p>';
  let safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  const lines = safe.split('\n');
  return lines.map((line, idx) => {
    if (!line.trim()) return '<div class="markdown-spacer"></div>';
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.match(/^[-*+]\s+(.+)$/)) return `<li>${line.slice(2)}</li>`;
    return `<p>${line}</p>`;
  }).join('');
};

export default function ReleasePage() {
  // ==========================================
  // 1. 顶层导航与 UI 状态
  // ==========================================
  const [activePanel, setActivePanel] = useState('release'); // 'release' | 'config'
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // 2. Release Center (发版中心) 状态
  // ==========================================
  const [releaseForm, setReleaseForm] = useState({
    version: '', releaseDate: new Date().toISOString().slice(0, 10), shortDesc: '',
    forceUpdate: false, canRollback: true, releaseNotesMarkdown: ''
  });
  const [previewMode, setPreviewMode] = useState('edit'); // 'edit' | 'preview'
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState('2');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [statusText, setStatusText] = useState({ text: '就绪', tone: 'idle' });
  const consoleRef = useRef(null);

  // 自动滚动 Console
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleLogs]);

  const appendConsole = (msg) => {
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setConsoleLogs(prev => [...prev, `[${stamp}] ${msg}`]);
  };

  // ==========================================
  // 3. Default Resources (默认资源配置) 状态
  // ==========================================
  const [configData, setConfigData] = useState({
    brands: [], printersByBrand: {}, presets: [], paths: {}
  });
  const [selectedEntity, setSelectedEntity] = useState({ type: 'brand', brandId: null, printerId: null });
  const [activePresetFile, setActivePresetFile] = useState(null);
  const [presetJsonText, setPresetJsonText] = useState('{}');

  // ==========================================
  // 4. 数据初始化
  // ==========================================
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      appendConsole("开始读取发版配置...");
      try {
        // 模拟 API 请求
        // const releaseRes = await window.mkpAPI.readReleaseInfo();
        // const configRes = await window.mkpAPI.readReleaseConfig();
        
        // 伪造数据用于演示
        setReleaseForm(prev => ({ ...prev, version: '0.2.0', releaseNotesMarkdown: '## 新版本发布\n- 修复Bug\n- 性能优化' }));
        setConfigData({
          brands: [{ id: 'bambu', name: '拓竹' }],
          printersByBrand: { bambu: [{ id: 'a1', name: 'Bambu Lab A1' }] },
          presets: [{ file: 'a1_v3.json', id: 'a1', version: '3.0.0' }],
          paths: { projectRoot: 'C:/MKP' }
        });
        setSelectedEntity({ type: 'brand', brandId: 'bambu', printerId: 'a1' });
        appendConsole("数据加载完成。");
      } catch (e) {
        appendConsole(`加载失败: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  // ==========================================
  // 5. 业务操作 (发版)
  // ==========================================
  const handleRunBuild = async () => {
    const modeLabel = MODE_LABELS[selectedMode];
    appendConsole(`开始执行 ${modeLabel}`);
    setStatusText({ text: `执行中: ${modeLabel}`, tone: 'running' });
    
    // 模拟打包过程
    setTimeout(() => {
      appendConsole(`[Success] 打包完成！输出目录: ${configData.paths.projectRoot}/dist`);
      setStatusText({ text: `${modeLabel} 完成`, tone: 'success' });
      MKPModal.alert({ title: '打包成功', msg: '安装包已生成！', type: 'success' });
    }, 2000);
  };

  // ==========================================
  // 6. UI 渲染辅助
  // ==========================================
  const currentEntityData = selectedEntity.type === 'printer' 
    ? configData.printersByBrand[selectedEntity.brandId]?.find(p => p.id === selectedEntity.printerId)
    : configData.brands.find(b => b.id === selectedEntity.brandId);

  return (
    <div className="page flex-1 flex flex-col bg-gray-50 dark:bg-[#1e1e1e] h-full overflow-hidden">
      
      {/* 顶部标签栏 */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-[#252526] border-b border-gray-200 dark:border-[#333] shrink-0">
        <h1 className="text-xl font-bold mr-4">后台管理控制台</h1>
        <button 
          onClick={() => setActivePanel('release')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePanel === 'release' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
        >发版中心 (Release)</button>
        <button 
          onClick={() => setActivePanel('config')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePanel === 'config' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
        >默认资源与配置 (Config)</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">加载后台数据中...</div>
        ) : (
          <>
            {/* ========================================== */}
            {/* 🔴 发版中心 面板 */}
            {/* ========================================== */}
            {activePanel === 'release' && (
              <div className="max-w-5xl mx-auto space-y-6">
                
                {/* 表单区域 */}
                <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-[#333]">
                  <h2 className="text-lg font-bold mb-4">版本信息配置</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">版本号 (Version)</label>
                      <input type="text" value={releaseForm.version} onChange={e => setReleaseForm({...releaseForm, version: e.target.value})} className="input-field w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">发布日期</label>
                      <input type="date" value={releaseForm.releaseDate} onChange={e => setReleaseForm({...releaseForm, releaseDate: e.target.value})} className="input-field w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                  </div>
                  
                  {/* Markdown 编辑器 */}
                  <div className="border border-gray-200 dark:border-[#444] rounded-xl overflow-hidden mt-4">
                    <div className="bg-gray-50 dark:bg-[#1e1e1e] flex items-center p-2 gap-2 border-b border-gray-200 dark:border-[#444]">
                      <button onClick={() => setPreviewMode('edit')} className={`px-3 py-1 rounded text-xs font-medium ${previewMode === 'edit' ? 'bg-white dark:bg-[#333] shadow-sm' : 'text-gray-500'}`}>编辑 (Markdown)</button>
                      <button onClick={() => setPreviewMode('preview')} className={`px-3 py-1 rounded text-xs font-medium ${previewMode === 'preview' ? 'bg-white dark:bg-[#333] shadow-sm' : 'text-gray-500'}`}>预览</button>
                    </div>
                    <div className={`p-4 ${isEditorExpanded ? 'h-96' : 'h-48'} overflow-y-auto bg-white dark:bg-[#252526]`}>
                      {previewMode === 'edit' ? (
                        <textarea 
                          className="w-full h-full outline-none resize-none bg-transparent text-sm font-mono dark:text-gray-200"
                          value={releaseForm.releaseNotesMarkdown}
                          onChange={e => setReleaseForm({...releaseForm, releaseNotesMarkdown: e.target.value})}
                        />
                      ) : (
                        <div className="release-preview text-sm dark:text-gray-200" dangerouslySetInnerHTML={{ __html: parseMarkdown(releaseForm.releaseNotesMarkdown) }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* 打包构建控制台 */}
                <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-[#333]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">构建与下发 (Build & Deploy)</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusText.tone === 'running' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{statusText.text}</span>
                  </div>
                  
                  <div className="flex gap-3 mb-4">
                    {Object.entries(MODE_LABELS).map(([val, label]) => (
                      <button 
                        key={val} 
                        onClick={() => setSelectedMode(val)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${selectedMode === val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-400'}`}
                      >{label}</button>
                    ))}
                  </div>

                  <button onClick={handleRunBuild} className="w-full py-3 rounded-xl theme-btn-solid font-bold text-sm shadow-md active:scale-[0.98] transition-transform">
                    执行打包构建
                  </button>

                  {/* 模拟 Console 输出 */}
                  <div className="mt-4 bg-[#1e1e1e] text-green-400 font-mono text-xs p-4 rounded-xl h-40 overflow-y-auto" ref={consoleRef}>
                    {consoleLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* ========================================== */}
            {/* 🔵 资源与配置 面板 */}
            {/* ========================================== */}
            {activePanel === 'config' && (
              <div className="max-w-6xl mx-auto flex gap-6 h-[75vh]">
                
                {/* 左侧：层级列表 (品牌 -> 机型) */}
                <div className="w-1/3 flex flex-col gap-4 bg-white dark:bg-[#252526] p-4 rounded-2xl border border-gray-200 dark:border-[#333] overflow-y-auto">
                  <h3 className="font-bold text-sm mb-2 text-gray-500">实体层级 (Brands & Printers)</h3>
                  
                  {configData.brands.map(brand => (
                    <div key={brand.id}>
                      {/* 品牌卡片 */}
                      <div 
                        onClick={() => setSelectedEntity({ type: 'brand', brandId: brand.id, printerId: null })}
                        className={`p-3 rounded-xl border cursor-pointer ${selectedEntity.brandId === brand.id && selectedEntity.type === 'brand' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                      >
                        <div className="font-bold">{brand.name}</div>
                      </div>
                      
                      {/* 品牌下的机型列表 */}
                      {selectedEntity.brandId === brand.id && (
                        <div className="ml-6 mt-2 flex flex-col gap-2 border-l-2 border-gray-100 dark:border-[#444] pl-4">
                          {configData.printersByBrand[brand.id]?.map(printer => (
                            <div 
                              key={printer.id}
                              onClick={() => setSelectedEntity({ type: 'printer', brandId: brand.id, printerId: printer.id })}
                              className={`p-2 rounded-lg border text-sm cursor-pointer ${selectedEntity.printerId === printer.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                            >
                              {printer.name}
                            </div>
                          ))}
                          <button className="text-xs text-blue-500 text-left py-1 hover:underline">+ 新增机型</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="text-sm font-medium theme-btn-soft py-2 rounded-xl mt-4">+ 新增品牌</button>
                </div>

                {/* 右侧：属性编辑器 & JSON 编辑器 */}
                <div className="flex-1 bg-white dark:bg-[#252526] p-6 rounded-2xl border border-gray-200 dark:border-[#333] flex flex-col overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4 border-b pb-2 dark:border-[#444]">
                    {selectedEntity.type === 'brand' ? '品牌属性编辑' : '机型属性编辑'}
                  </h3>
                  
                  {currentEntityData ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ID (内部标识)</label>
                        <input type="text" value={currentEntityData.id} readOnly className="input-field w-full px-3 py-2 rounded-lg border text-sm bg-gray-50 text-gray-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">显示名称 (Name)</label>
                        <input type="text" value={currentEntityData.name} className="input-field w-full px-3 py-2 rounded-lg border text-sm" />
                      </div>
                      
                      {selectedEntity.type === 'printer' && (
                        <div className="mt-8">
                          <label className="block text-xs font-bold text-blue-500 mb-2">默认预设 JSON (Default Presets)</label>
                          <textarea 
                            className="w-full h-48 p-3 bg-gray-50 dark:bg-[#1e1e1e] font-mono text-xs rounded-xl border dark:border-[#444] outline-none focus:border-blue-500"
                            value={presetJsonText}
                            onChange={e => setPresetJsonText(e.target.value)}
                            placeholder="{}"
                          />
                          <button className="mt-3 theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium">保存 Config / Preset</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm text-center py-20">请在左侧选择实体</div>
                  )}
                </div>

              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}