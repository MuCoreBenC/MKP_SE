import React, { useState, useEffect } from 'react';
import { PARAM_GROUP_META, PARAM_FIELD_META, flattenObject, unflattenObject } from '../utils/paramsData';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import GcodeEditor from '../components/GcodeEditor';

export default function ParamsPage() {
  // 1. 核心状态：加载状态、原始数据(用于比对)、表单数据(用于编辑)
  const [isLoading, setIsLoading] = useState(true);
  const [originalData, setOriginalData] = useState(null);
  const [formData, setFormData] = useState({});
  const [currentFile, setCurrentFile] = useState('未选择');

  // 推导状态：是否被修改过 (Dirty)
  const isDirty = originalData && JSON.stringify(formData) !== JSON.stringify(originalData);

  // 2. 模拟初始化加载预设 (原本的 loadActivePreset)
  useEffect(() => {
    const fetchPreset = async () => {
      setIsLoading(true);
      try {
        // 【实际接入时】换成: const res = await window.mkpAPI.readPreset(...)
        // 这里为了演示，我们伪造一份读取回来的 JSON 数据
        const mockJson = {
          version: '3.0.0',
          printer: 'a1',
          type: 'standard',
          _custom_name: '我的超级配置',
          toolhead: {
            speed_limit: 150,
            offset: { x: 0, y: 0, z: -0.2 },
            custom_mount_gcode: "G28\nG1 Z50 F1200\nM104 S255",
          },
          wiping: { have_wiping_components: true }
        };

        const flatData = flattenObject(mockJson);
        setOriginalData(flatData);
        setFormData(flatData);
        setCurrentFile('a1_standard_v3.0.0.json');
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreset();
  }, []);

  // 3. 通用字段更新函数
  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // 4. 保存操作
  const handleSave = async () => {
    if (!isDirty) return;
    
    const confirm = await MKPModal.confirm({
      title: '保存修改',
      msg: `确定要将修改保存至 <span class="font-mono text-xs">${currentFile}</span> 吗？`,
      type: 'info'
    });

    if (confirm) {
      // 还原为嵌套结构
      const finalJson = unflattenObject(formData);
      console.log("准备写入磁盘的 JSON 数据:", finalJson);
      
      // 【实际接入时】 await window.mkpAPI.overwritePreset(path, finalJson)
      
      setOriginalData(formData); // 刷新基准点，消除 dirty 状态
      await MKPModal.alert({ title: '成功', msg: '参数保存成功！', type: 'success' });
    }
  };

  // 5. 渲染单个字段组件 (工厂函数)
  const renderField = (key, value) => {
    const meta = PARAM_FIELD_META[key] || { label: key.split('.').pop(), group: 'advanced' };

    // 布尔值渲染为开关
    if (meta.type === 'boolean' || typeof value === 'boolean') {
      return (
        <label key={key} className="param-row param-row-toggle flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm">
          <div>
            <div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div>
            <div className="text-xs text-gray-500 mt-1">底层字段: {key}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{value ? '已开启' : '已关闭'}</span>
            <input 
              type="checkbox" 
              checked={value} 
              onChange={(e) => handleChange(key, e.target.checked)} 
              className="w-5 h-5 rounded theme-text"
            />
          </div>
        </label>
      );
    }

    // G-code 渲染为我们刚才封装的高级编辑器
    if (meta.type === 'gcode') {
      return (
        <GcodeEditor 
          key={key} 
          value={value} 
          onChange={(newGcode) => handleChange(key, newGcode)} 
        />
      );
    }

    // 默认文本/数字输入框
    return (
      <div key={key} className="param-row flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm">
        <div>
          <div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div>
          <div className="text-xs text-gray-500 mt-1">{meta.unit ? `单位：${meta.unit}` : `底层字段: ${key}`}</div>
        </div>
        <input 
          type={typeof value === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleChange(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-sm text-right w-48 outline-none focus:border-blue-500 dark:text-white transition-colors"
        />
      </div>
    );
  };

  // 6. 将扁平化的数据按照 group 属性进行分组
  const renderGroups = () => {
    const groups = { meta: [], toolhead: [], wiping: [], mount: [], unmount: [], advanced: [] };
    
    Object.keys(formData).forEach(key => {
      const meta = PARAM_FIELD_META[key] || { group: 'advanced' };
      const groupKey = meta.group || 'advanced';
      if (groups[groupKey]) {
        groups[groupKey].push(renderField(key, formData[key]));
      }
    });

    return Object.entries(groups).map(([groupKey, fields]) => {
      if (fields.length === 0) return null;
      const groupMeta = PARAM_GROUP_META[groupKey] || PARAM_GROUP_META.advanced;

      return (
        <section key={groupKey} className="params-group-section p-5 bg-gray-50/50 dark:bg-[#1E1E1E]/50 rounded-2xl border border-gray-200 dark:border-[#444] mb-6">
          <div className="params-group-head flex items-start gap-4 mb-4">
            <div className="params-group-icon w-10 h-10 rounded-xl theme-bg-soft theme-text flex items-center justify-center">
              <Icon name={groupMeta.icon} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{groupMeta.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{groupMeta.desc}</p>
            </div>
          </div>
          <div className="params-group-list flex flex-col gap-2">
            {fields}
          </div>
        </section>
      );
    });
  };

  // ==========================================
  // 页面主体渲染
  // ==========================================
  return (
    <div id="page-params" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">修改参数</h1>
          <div className="flex items-center gap-3">
            <button className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
              <Icon name="setting" className="w-4 h-4" /> 恢复默认
            </button>
            <button 
              onClick={handleSave}
              disabled={!isDirty}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${isDirty ? 'theme-btn-solid shadow-lg' : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-[#444] dark:text-gray-500'}`}
            >
              保存所有修改 {isDirty && '*'}
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
            
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Icon name="info" className="w-5 h-5 text-gray-400" /> JSON 预设参数工作台
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 dark:bg-[#1E1E1E] px-3 py-1.5 rounded-full">
                保存时自动回写 JSON
              </div>
            </div>

            {/* 渲染区域 */}
            {isLoading ? (
               <div className="py-20 text-center text-gray-500">加载中...</div>
            ) : (
               <div className="grid grid-cols-1 gap-6">
                 {renderGroups()}
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}