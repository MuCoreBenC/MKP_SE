// src/pages/ParamsPage.jsx
import React, { useState, useEffect } from 'react';
import { PARAM_GROUP_META, PARAM_FIELD_META, flattenObject, unflattenObject } from '../utils/paramsData';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import GcodeEditor from '../components/GcodeEditor';
import { useHistoryState } from '../utils/useHistoryState'; // 引入时光机 Hook

export default function ParamsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [originalData, setOriginalData] = useState(null);
  const [currentFile, setCurrentFile] = useState('未选择');

  // 🌟 1. 启动时光机！接管表单数据
  const { 
    present: formData, 
    setPresent: setFormData, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    reset: resetHistory
  } = useHistoryState({});

  // 脏状态推导 (与原始数据进行深度对比)
  const isDirty = originalData && JSON.stringify(formData) !== JSON.stringify(originalData);

  // 🌟 2. 挂载全局键盘监听 (完美复刻你的 handleParamKeydown)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 必须加上 isMac 判断，兼顾 Mac 的 Cmd 键和 Win 的 Ctrl 键
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo(); // 撤销
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo(); // 重做
      } else if (key === 's') {
        e.preventDefault();
        if (isDirty) handleSave(); // 保存
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, isDirty, formData]); // 依赖项必须包含这些，保证拿到最新的函数闭包

  // 3. 初始化加载数据
  useEffect(() => {
    const fetchPreset = async () => {
      setIsLoading(true);
      try {
        // 伪造一份你的复杂 JSON 结构
        const mockJson = {
          version: '3.0.0', printer: 'a1', type: 'standard', _custom_name: '我的超级配置',
          toolhead: { speed_limit: 150, offset: { x: 0, y: 0, z: -0.2 }, custom_mount_gcode: "G28\nG1 Z50 F1200\nM104 S255" },
          wiping: { have_wiping_components: true }
        };

        const flatData = flattenObject(mockJson);
        setOriginalData(flatData);
        resetHistory(flatData); // 写入时光机的初始状态！
        setCurrentFile('a1_standard_v3.0.0.json');
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreset();
  }, [resetHistory]);

  // 4. 字段更新处理器
  const handleChange = (key, value) => {
    // 触发时光机快照！
    setFormData({ ...formData, [key]: value });
  };

  // 5. 保存引擎
  const handleSave = async () => {
    if (!isDirty) return;
    
    const confirm = await MKPModal.confirm({
      title: '保存修改',
      msg: `确定要将修改保存至 <span class="font-mono text-xs">${currentFile}</span> 吗？`,
      type: 'info'
    });

    if (confirm) {
      const finalJson = unflattenObject(formData);
      console.log("准备写入磁盘的 JSON 数据:", finalJson);
      
      setOriginalData(formData); // 刷新基准点
      await MKPModal.alert({ title: '成功', msg: '参数保存成功！', type: 'success' });
    }
  };

  // 6. 恢复默认功能
  const handleRestoreDefaults = async () => {
    const confirm = await MKPModal.confirm({
      title: '恢复原版参数？',
      msg: '会用当前机型、类型和版本对应的原版预设覆盖当前内容。<br><br>可以通过 Ctrl+Z 撤销此操作。',
      type: 'warning',
      confirmText: '恢复默认'
    });

    if (confirm) {
      // 我们用最初的 originalData 作为“默认数据”进行还原
      // 这次更改会被推入时光机，所以按 Ctrl+Z 就能还原到恢复默认前！
      setFormData(originalData); 
    }
  };

  // ==========================================
  // 渲染函数 (与上一版基本一致，补充了撤销重做按钮)
  // ==========================================
  const renderField = (key, value) => {
    const meta = PARAM_FIELD_META[key] || { label: key.split('.').pop(), group: 'advanced' };

    if (meta.type === 'boolean' || typeof value === 'boolean') {
      return (
        <label key={key} className="param-row param-row-toggle flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm">
          <div><div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div><div className="text-xs text-gray-500 mt-1">底层: {key}</div></div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{value ? '已开启' : '已关闭'}</span>
            <input type="checkbox" checked={value} onChange={(e) => handleChange(key, e.target.checked)} className="w-5 h-5 rounded theme-text" />
          </div>
        </label>
      );
    }

    if (meta.type === 'gcode') {
      return <GcodeEditor key={key} value={value} onChange={(val) => handleChange(key, val)} />;
    }

    return (
      <div key={key} className="param-row flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm">
        <div><div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div><div className="text-xs text-gray-500 mt-1">{meta.unit ? `单位：${meta.unit}` : `底层: ${key}`}</div></div>
        <input type={typeof value === 'number' ? 'number' : 'text'} value={value} onChange={(e) => handleChange(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-sm text-right w-48 outline-none focus:border-blue-500 dark:text-white transition-colors" />
      </div>
    );
  };

  const renderGroups = () => {
    const groups = { meta: [], toolhead: [], wiping: [], mount: [], unmount: [], advanced: [] };
    Object.keys(formData).forEach(key => {
      const groupKey = PARAM_FIELD_META[key]?.group || 'advanced';
      if (groups[groupKey]) groups[groupKey].push(renderField(key, formData[key]));
    });

    return Object.entries(groups).map(([groupKey, fields]) => {
      if (fields.length === 0) return null;
      const groupMeta = PARAM_GROUP_META[groupKey] || PARAM_GROUP_META.advanced;
      return (
        <section key={groupKey} className="params-group-section p-5 bg-gray-50/50 dark:bg-[#1E1E1E]/50 rounded-2xl border border-gray-200 dark:border-[#444] mb-6">
          <div className="params-group-head flex items-start gap-4 mb-4">
            <div className="params-group-icon w-10 h-10 rounded-xl theme-bg-soft theme-text flex items-center justify-center"><Icon name={groupMeta.icon} className="w-6 h-6" /></div>
            <div><h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{groupMeta.title}</h3><p className="text-xs text-gray-500 mt-1">{groupMeta.desc}</p></div>
          </div>
          <div className="params-group-list flex flex-col gap-2">{fields}</div>
        </section>
      );
    });
  };

  return (
    <div id="page-params" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">修改参数</h1>
          <div className="flex items-center gap-3">
            
            {/* 🌟 时光机控制器：可视化撤销重做！ */}
            <div className="flex items-center bg-gray-100 dark:bg-[#333] rounded-xl px-1">
              <button disabled={!canUndo} onClick={undo} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="撤销 (Ctrl+Z)">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              </button>
              <div className="w-px h-4 bg-gray-300 dark:bg-[#555]"></div>
              <button disabled={!canRedo} onClick={redo} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="重做 (Ctrl+Y)">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg>
              </button>
            </div>

            <button onClick={handleRestoreDefaults} className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
              恢复默认
            </button>
            <button onClick={handleSave} disabled={!isDirty} className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${isDirty ? 'theme-btn-solid shadow-lg' : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-[#444] dark:text-gray-500'}`}>
              保存修改 {isDirty && '*'}
            </button>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-xs text-gray-500">当前编辑文件：<span className="font-mono theme-text">{currentFile}</span></p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-[#252526] rounded-[28px] card-shadow p-6 mb-5 border border-gray-100 dark:border-[#333]">
            {isLoading ? <div className="py-20 text-center text-gray-500">加载中...</div> : <div className="grid grid-cols-1 gap-6">{renderGroups()}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}