import React, { useEffect, useState } from 'react';
import {
  PARAM_GROUP_META,
  PARAM_FIELD_META,
  flattenObject,
  unflattenObject,
} from '../utils/paramsData';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import GcodeEditor from '../components/GcodeEditor';
import { useHistoryState } from '../utils/useHistoryState';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

async function resolvePresetPath(currentPresetFile) {
  if (!currentPresetFile || !window.mkpAPI?.getUserDataPath) {
    return null;
  }

  const userDataPath = await window.mkpAPI.getUserDataPath();
  return `${userDataPath}\\Presets\\${currentPresetFile}`;
}

export default function ParamsPage({ currentPrinter, currentVersion, currentPresetFile }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [originalData, setOriginalData] = useState(null);
  const [currentFile, setCurrentFile] = useState('未选择');
  const [currentPath, setCurrentPath] = useState('');

  const {
    present: formData,
    setPresent: setFormData,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useHistoryState({});

  const isDirty =
    originalData && JSON.stringify(formData) !== JSON.stringify(originalData);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      } else if (key === 's') {
        event.preventDefault();
        if (isDirty) {
          void handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, redo, undo, formData]);

  useEffect(() => {
    let ignore = false;

    const fetchPreset = async () => {
      setIsLoading(true);
      setLoadError('');

      if (!currentPrinter || !currentVersion || !currentPresetFile) {
        if (ignore) return;
        setCurrentFile('未选择');
        setCurrentPath('');
        setOriginalData(null);
        resetHistory({});
        setIsLoading(false);
        return;
      }

      try {
        const presetPath = await resolvePresetPath(currentPresetFile);
        if (!presetPath) {
          throw new Error('当前预设路径无效');
        }

        const result = await window.mkpAPI?.readPreset?.(presetPath);
        if (!result?.success || !result.data) {
          throw new Error(result?.error || '读取预设失败');
        }

        await window.mkpAPI?.ensurePresetBackup?.(presetPath);

        const flatData = flattenObject(result.data);
        if (ignore) return;

        setCurrentFile(currentPresetFile);
        setCurrentPath(presetPath);
        setOriginalData(cloneValue(flatData));
        resetHistory(flatData);
      } catch (error) {
        if (ignore) return;
        setCurrentFile(currentPresetFile || '未选择');
        setCurrentPath('');
        setOriginalData(null);
        resetHistory({});
        setLoadError(error.message || '读取预设失败');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    fetchPreset();

    return () => {
      ignore = true;
    };
  }, [currentPresetFile, currentPrinter, currentVersion, resetHistory]);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSave = async () => {
    if (!currentPath || !isDirty) return;

    const confirmed = await MKPModal.confirm({
      title: '保存修改',
      msg: `确定要将修改保存到 <span class="font-mono text-xs">${currentFile}</span> 吗？`,
      type: 'info',
    });

    if (!confirmed) return;

    const finalJson = unflattenObject(formData);
    const result = await window.mkpAPI?.overwritePreset?.(currentPath, finalJson);

    if (!result?.success) {
      await MKPModal.alert({
        title: '保存失败',
        msg: result?.error || '写入预设失败',
        type: 'error',
      });
      return;
    }

    setOriginalData(cloneValue(formData));
    await MKPModal.alert({
      title: '成功',
      msg: '参数保存成功。',
      type: 'success',
    });
  };

  const handleRestoreDefaults = async () => {
    if (!currentPath || !currentPrinter || !currentVersion) return;

    const confirmed = await MKPModal.confirm({
      title: '恢复原版参数？',
      msg: '会优先用本地备份恢复；如果没有备份，则回退到当前机型和版本对应的原版预设。',
      type: 'warning',
      confirmText: '恢复默认',
    });

    if (!confirmed) return;

    try {
      let defaultData = null;
      let sourceLabel = '本地备份';

      const backupResult = await window.mkpAPI?.readPresetBackup?.(currentPath);
      if (backupResult?.success && backupResult.data) {
        defaultData = backupResult.data;
      }

      if (!defaultData) {
        const versionValue =
          formData.version ||
          originalData?.version ||
          currentVersion ||
          '0.0.0';
        const defaultFileName = `${currentPrinter.id}_${currentVersion}_v${versionValue}.json`;

        await window.mkpAPI?.copyBundledPreset?.(defaultFileName);
        const defaultPath = await resolvePresetPath(defaultFileName);
        const defaultResult = await window.mkpAPI?.readPreset?.(defaultPath);
        if (!defaultResult?.success || !defaultResult.data) {
          throw new Error(defaultResult?.error || '读取原版预设失败');
        }

        defaultData = defaultResult.data;
        sourceLabel = '原版预设';
      }

      if (formData._custom_name) {
        defaultData._custom_name = formData._custom_name;
      }

      const writeResult = await window.mkpAPI?.overwritePreset?.(currentPath, defaultData);
      if (!writeResult?.success) {
        throw new Error(writeResult?.error || '恢复写入失败');
      }

      const flatData = flattenObject(defaultData);
      setOriginalData(cloneValue(flatData));
      resetHistory(flatData);

      await MKPModal.alert({
        title: '已恢复',
        msg: `已按${sourceLabel}恢复当前预设内容。`,
        type: 'success',
      });
    } catch (error) {
      await MKPModal.alert({
        title: '恢复失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const renderField = (key, value) => {
    const meta = PARAM_FIELD_META[key] || {
      label: key.split('.').pop(),
      group: 'advanced',
    };

    if (meta.type === 'boolean' || typeof value === 'boolean') {
      return (
        <label
          key={key}
          className="param-row param-row-toggle flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm"
        >
          <div>
            <div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div>
            <div className="text-xs text-gray-500 mt-1">底层: {key}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{value ? '已开启' : '已关闭'}</span>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(event) => handleChange(key, event.target.checked)}
              className="w-5 h-5 rounded theme-text"
            />
          </div>
        </label>
      );
    }

    if (meta.type === 'gcode') {
      return (
        <GcodeEditor
          key={key}
          value={value}
          onChange={(nextValue) => handleChange(key, nextValue)}
        />
      );
    }

    const isNumber = typeof value === 'number';

    return (
      <div
        key={key}
        className="param-row flex justify-between items-center p-4 bg-white dark:bg-[#333] rounded-xl mb-2 shadow-sm"
      >
        <div>
          <div className="font-bold text-gray-900 dark:text-gray-100">{meta.label}</div>
          <div className="text-xs text-gray-500 mt-1">
            {meta.unit ? `单位：${meta.unit}` : `底层: ${key}`}
          </div>
        </div>
        <input
          type={isNumber ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(event) =>
            handleChange(
              key,
              isNumber && event.target.value !== ''
                ? Number(event.target.value)
                : event.target.value,
            )
          }
          className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-sm text-right w-48 outline-none focus:border-blue-500 dark:text-white transition-colors"
        />
      </div>
    );
  };

  const renderGroups = () => {
    const groups = {
      meta: [],
      toolhead: [],
      wiping: [],
      mount: [],
      unmount: [],
      advanced: [],
    };

    Object.keys(formData).forEach((key) => {
      const groupKey = PARAM_FIELD_META[key]?.group || 'advanced';
      if (groups[groupKey]) {
        groups[groupKey].push(renderField(key, formData[key]));
      }
    });

    return Object.entries(groups).map(([groupKey, fields]) => {
      if (fields.length === 0) return null;
      const groupMeta = PARAM_GROUP_META[groupKey] || PARAM_GROUP_META.advanced;

      return (
        <section
          key={groupKey}
          className="params-group-section p-5 bg-gray-50/50 dark:bg-[#1E1E1E]/50 rounded-2xl border border-gray-200 dark:border-[#444] mb-6"
        >
          <div className="params-group-head flex items-start gap-4 mb-4">
            <div className="params-group-icon w-10 h-10 rounded-xl theme-bg-soft theme-text flex items-center justify-center">
              <Icon name={groupMeta.icon} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {groupMeta.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{groupMeta.desc}</p>
            </div>
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
            <div className="flex items-center bg-gray-100 dark:bg-[#333] rounded-xl px-1">
              <button
                disabled={!canUndo}
                onClick={undo}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="撤销 (Ctrl+Z)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
              <div className="w-px h-4 bg-gray-300 dark:bg-[#555]"></div>
              <button
                disabled={!canRedo}
                onClick={redo}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="重做 (Ctrl+Y)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                  />
                </svg>
              </button>
            </div>

            <button
              onClick={handleRestoreDefaults}
              disabled={!currentPath}
              className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              恢复默认
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!isDirty}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isDirty
                  ? 'theme-btn-solid shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-[#444] dark:text-gray-500'
              }`}
            >
              保存修改 {isDirty ? '*' : ''}
            </button>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-xs text-gray-500">
            当前编辑文件：<span className="font-mono theme-text">{currentFile}</span>
          </p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-[#252526] rounded-[28px] card-shadow p-6 mb-5 border border-gray-100 dark:border-[#333]">
            {isLoading ? (
              <div className="py-20 text-center text-gray-500">加载中...</div>
            ) : loadError ? (
              <div className="py-20 text-center text-gray-500">{loadError}</div>
            ) : !currentPath ? (
              <div className="py-20 text-center text-gray-500">
                当前没有已应用的预设，请先去下载页应用一个本地预设。
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">{renderGroups()}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
