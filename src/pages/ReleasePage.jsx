import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MKPModal } from '../components/GlobalModal';
import {
  applyReleaseEntityDraft,
  MODE_LABELS,
  buildReleaseSummary,
  createEmptyPresetDraft,
  filterReleasePresets,
  parseReleaseMarkdown,
  resolveReleaseConfigSelection,
  sanitizeReleaseId,
} from '../utils/releaseEditor';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFallbackAsset() {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="28" fill="#dbeafe"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="42" font-family="Segoe UI, Arial" fill="#2563eb">MKP</text></svg>',
  )}`;
}

function toAssetUrl(value) {
  return String(value || '').trim() || createFallbackAsset();
}

function getStatusClass(tone) {
  const palette = {
    idle: 'bg-gray-100 text-gray-600 dark:bg-[#333] dark:text-gray-300',
    running: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  };

  return palette[tone] || palette.idle;
}

function buildEntityForm(entityType, entity) {
  const isPrinter = entityType === 'printer' && !!entity;

  return {
    id: entity?.id || '',
    name: isPrinter ? entity?.shortName || '' : entity?.name || '',
    subtitle: isPrinter ? entity?.name || '' : entity?.subtitle || '',
    versions: isPrinter ? (entity?.supportedVersions || []).join(',') : '',
    presetsText: isPrinter ? JSON.stringify(entity?.defaultPresets || {}, null, 2) : '',
    image: entity?.image || '',
  };
}

function buildPresetDraft(result) {
  const entry = result?.entry || null;
  const data = result?.data || {};

  return {
    originalFileName: result?.fileName || entry?.file || null,
    fileName: entry?.file || '',
    id: entry?.id || '',
    type: entry?.type || '',
    version: entry?.version || data?.version || '',
    description: entry?.description || '',
    releaseNotesText: Array.isArray(entry?.releaseNotes) ? entry.releaseNotes.join('\n') : '',
    jsonText: JSON.stringify(data || {}, null, 2),
  };
}

async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function ReleasePage() {
  const [activePanel, setActivePanel] = useState('release');
  const [isLoading, setIsLoading] = useState(true);
  const [releaseInfo, setReleaseInfo] = useState({ paths: {} });
  const [releaseForm, setReleaseForm] = useState({
    version: '',
    releaseDate: new Date().toISOString().slice(0, 10),
    shortDesc: '',
    forceUpdate: false,
    canRollback: true,
    releaseNotesMarkdown: '',
  });
  const [previewMode, setPreviewMode] = useState('edit');
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState('2');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [pageStatus, setPageStatus] = useState({ text: '就绪', tone: 'idle' });
  const [buildStatus, setBuildStatus] = useState({ text: '未执行', tone: 'idle' });
  const [lastSummary, setLastSummary] = useState('');
  const [configData, setConfigData] = useState({
    brands: [],
    printersByBrand: {},
    presets: [],
    paths: {},
  });
  const [selectedEntity, setSelectedEntity] = useState({
    type: 'brand',
    brandId: null,
    printerId: null,
  });
  const [entityForm, setEntityForm] = useState(buildEntityForm('brand', null));
  const [presetSearchQuery, setPresetSearchQuery] = useState('');
  const [activePresetFile, setActivePresetFile] = useState(null);
  const [presetDraft, setPresetDraft] = useState(createEmptyPresetDraft());

  const consoleRef = useRef(null);
  const configImageInputRef = useRef(null);
  const presetJsonRef = useRef(null);

  const appendConsole = (message) => {
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setConsoleLogs((previous) => [...previous, `[${stamp}] ${message}`]);
  };

  const currentBrand = useMemo(
    () => configData.brands.find((item) => item.id === selectedEntity.brandId) || null,
    [configData.brands, selectedEntity.brandId],
  );

  const currentPrinters = useMemo(
    () => configData.printersByBrand[selectedEntity.brandId] || [],
    [configData.printersByBrand, selectedEntity.brandId],
  );

  const currentPrinter = useMemo(
    () => currentPrinters.find((item) => item.id === selectedEntity.printerId) || null,
    [currentPrinters, selectedEntity.printerId],
  );

  const currentEntity =
    selectedEntity.type === 'printer' && currentPrinter ? currentPrinter : currentBrand;

  const filteredPresets = useMemo(
    () => filterReleasePresets(configData.presets, presetSearchQuery),
    [configData.presets, presetSearchQuery],
  );

  const pathRows = useMemo(
    () => [
      ['项目目录', releaseInfo.paths?.projectRoot],
      ['cloud_data', releaseInfo.paths?.cloudDataDir],
      ['上传目录', releaseInfo.paths?.uploadCloudDataDir],
      ['默认机型表', configData.paths?.dataJsPath],
      ['默认预设目录', configData.paths?.presetsDir],
    ],
    [configData.paths, releaseInfo.paths],
  );

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  useEffect(() => {
    setEntityForm(buildEntityForm(selectedEntity.type, currentEntity));
  }, [selectedEntity.brandId, selectedEntity.printerId, selectedEntity.type]);

  const updateEntityDraft = (patch, options = {}) => {
    const nextForm = { ...entityForm, ...patch };
    setEntityForm(nextForm);

    if (!currentEntity) {
      return;
    }

    const { nextConfig, nextSelection } = applyReleaseEntityDraft(
      configData,
      selectedEntity,
      nextForm,
      options,
    );

    setConfigData(nextConfig);
    setSelectedEntity(nextSelection);

    if (options.commitId === true) {
      const syncedEntity =
        nextSelection.type === 'printer'
          ? (nextConfig.printersByBrand[nextSelection.brandId] || []).find(
              (item) => item.id === nextSelection.printerId,
            ) || null
          : nextConfig.brands.find((item) => item.id === nextSelection.brandId) || null;

      setEntityForm(buildEntityForm(nextSelection.type, syncedEntity));
    }
  };

  const loadReleaseInfo = async () => {
    setPageStatus({ text: '正在读取发布信息...', tone: 'idle' });

    const result = await window.mkpAPI?.readReleaseInfo?.();
    if (!result?.success) {
      const message = result?.error || '读取发布信息失败';
      setPageStatus({ text: `读取失败: ${message}`, tone: 'error' });
      appendConsole(`读取发布信息失败: ${message}`);
      return false;
    }

    const data = result.data || {};
    setReleaseInfo(data);
    setReleaseForm({
      version: data.version || '',
      releaseDate: data.releaseDate || new Date().toISOString().slice(0, 10),
      shortDesc: data.shortDesc || '',
      forceUpdate: !!data.forceUpdate,
      canRollback: data.canRollback !== false,
      releaseNotesMarkdown: data.releaseNotesMarkdown || '',
    });
    setPageStatus({
      text: `已读取当前版本 v${data.version || '--'}`,
      tone: 'success',
    });
    appendConsole(`已加载当前发布信息 v${data.version || '--'}`);
    return true;
  };

  const handleSelectPreset = async (fileName, { quiet = false } = {}) => {
    const result = await window.mkpAPI?.readReleaseConfigPreset?.(fileName);
    if (!result?.success) {
      if (!quiet) {
        await MKPModal.alert({
          title: '读取预设失败',
          msg: result?.error || '读取默认预设失败',
          type: 'error',
        });
      }
      return false;
    }

    setActivePresetFile(result.data.fileName);
    setPresetDraft(buildPresetDraft(result.data));
    appendConsole(`已打开默认预设 ${result.data.fileName}`);
    return true;
  };

  const hydrateConfigData = async (data, options = {}) => {
    const nextConfig = {
      brands: cloneValue(data?.brands || []),
      printersByBrand: cloneValue(data?.printersByBrand || {}),
      presets: cloneValue(data?.presets || []),
      paths: cloneValue(data?.paths || {}),
    };

    setConfigData(nextConfig);

    const nextSelection = resolveReleaseConfigSelection(
      nextConfig,
      options.preferredSelection || selectedEntity,
    );
    setSelectedEntity(nextSelection);

    const preferredPresetFile =
      options.preferredPresetFile &&
      nextConfig.presets.some((item) => item.file === options.preferredPresetFile)
        ? options.preferredPresetFile
        : activePresetFile && nextConfig.presets.some((item) => item.file === activePresetFile)
          ? activePresetFile
          : nextConfig.presets[0]?.file || null;

    if (preferredPresetFile) {
      const loaded = await handleSelectPreset(preferredPresetFile, { quiet: true });
      if (!loaded) {
        setActivePresetFile(null);
        setPresetDraft(createEmptyPresetDraft());
      }
    } else {
      setActivePresetFile(null);
      setPresetDraft(createEmptyPresetDraft());
    }
  };

  const loadReleaseConfig = async (options = {}) => {
    const result = await window.mkpAPI?.readReleaseConfig?.();
    if (!result?.success) {
      const message = result?.error || '读取默认资源失败';
      setPageStatus({ text: `资源读取失败: ${message}`, tone: 'error' });
      appendConsole(`默认资源读取失败: ${message}`);
      return false;
    }

    await hydrateConfigData(result.data, options);
    appendConsole('已加载默认资源配置');
    return true;
  };

  useEffect(() => {
    let ignore = false;

    const initData = async () => {
      setIsLoading(true);
      setConsoleLogs([]);
      appendConsole('开始读取发布配置...');

      try {
        const releaseLoaded = await loadReleaseInfo();
        const configLoaded = await loadReleaseConfig();

        if (ignore) return;
        if (releaseLoaded && configLoaded) {
          appendConsole('数据加载完成。');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void initData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (!isCmdOrCtrl || event.key.toLowerCase() !== 's') {
        return;
      }

      event.preventDefault();

      if (activePanel === 'config' && document.activeElement === presetJsonRef.current) {
        void handleSavePreset();
        return;
      }

      if (activePanel === 'config') {
        void handleSaveConfig();
        return;
      }

      void handleSaveReleaseInfo({ quiet: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, releaseForm, entityForm, presetDraft, configData, selectedEntity]);

  const handleOpenPath = async (target) => {
    try {
      const result = await window.mkpAPI?.openReleasePath?.(target);
      if (!result?.success) {
        throw new Error(result?.error || '打开路径失败');
      }
      appendConsole(`已打开 ${result.path}`);
    } catch (error) {
      await MKPModal.alert({
        title: '打开失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const handleSaveReleaseInfo = async ({ quiet = false } = {}) => {
    const result = await window.mkpAPI?.saveReleaseInfo?.({
      version: releaseForm.version.trim(),
      releaseDate: releaseForm.releaseDate,
      shortDesc: releaseForm.shortDesc.trim(),
      forceUpdate: releaseForm.forceUpdate,
      canRollback: releaseForm.canRollback,
      releaseNotesMarkdown: releaseForm.releaseNotesMarkdown,
    });

    if (!result?.success) {
      const message = result?.error || '保存失败';
      setPageStatus({ text: `保存失败: ${message}`, tone: 'error' });
      appendConsole(`保存发布信息失败: ${message}`);
      if (!quiet) {
        await MKPModal.alert({
          title: '保存失败',
          msg: message,
          type: 'error',
        });
      }
      return null;
    }

    setReleaseInfo((previous) => ({
      ...previous,
      ...result.data,
    }));
    setPageStatus({
      text: `已保存 v${result.data.version}`,
      tone: 'success',
    });
    appendConsole(`发布信息已保存，版本 v${result.data.version}`);
    return result.data;
  };

  const handleRunBuild = async () => {
    const modeLabel = MODE_LABELS[String(selectedMode)] || String(selectedMode);
    const saved = await handleSaveReleaseInfo({ quiet: true });
    if (!saved) return;

    setBuildStatus({ text: `执行中: ${modeLabel}`, tone: 'running' });
    appendConsole(`开始执行 ${modeLabel}`);

    try {
      const result = await window.mkpAPI?.runReleaseBuild?.(String(selectedMode));
      if (!result?.success) {
        throw new Error(result?.error || '打包失败');
      }

      const lines = buildReleaseSummary(result, selectedMode);
      setLastSummary(lines.join('\n'));
      lines.forEach((line) => appendConsole(line));
      setBuildStatus({ text: `${modeLabel}完成`, tone: 'success' });
      setPageStatus({ text: `${modeLabel}执行完成`, tone: 'success' });
    } catch (error) {
      setBuildStatus({ text: `${modeLabel}失败`, tone: 'error' });
      setPageStatus({ text: `${modeLabel}失败`, tone: 'error' });
      appendConsole(`打包失败: ${error.message}`);
      await MKPModal.alert({
        title: '打包失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const applyEntityFormToConfig = () => {
    if (selectedEntity.type === 'printer' && currentPrinter) {
      const nextId = sanitizeReleaseId(
        entityForm.id || entityForm.name || currentPrinter.id,
        'printer',
      );
      const printerList = configData.printersByBrand[selectedEntity.brandId] || [];
      const duplicatePrinter = printerList.find(
        (item) => item.id === nextId && item.id !== currentPrinter.id,
      );
      if (duplicatePrinter) {
        throw new Error(`当前品牌下已存在机型 ID: ${nextId}`);
      }

      return applyReleaseEntityDraft(configData, selectedEntity, entityForm, {
        commitId: true,
      });
    }

    if (!currentBrand) {
      return {
        nextConfig: cloneValue(configData),
        nextSelection: selectedEntity,
      };
    }

    const nextId = sanitizeReleaseId(entityForm.id || entityForm.name || currentBrand.id, 'brand');
    const duplicateBrand = configData.brands.find(
      (item) => item.id === nextId && item.id !== currentBrand.id,
    );
    if (duplicateBrand) {
      throw new Error(`已存在品牌 ID: ${nextId}`);
    }

    return applyReleaseEntityDraft(configData, selectedEntity, entityForm, {
      commitId: true,
    });
  };

  const handleSaveConfig = async () => {
    try {
      const { nextConfig, nextSelection } = applyEntityFormToConfig();
      const result = await window.mkpAPI?.saveReleaseConfigCatalog?.({
        brands: nextConfig.brands,
        printersByBrand: nextConfig.printersByBrand,
      });

      if (!result?.success) {
        throw new Error(result?.error || '默认机型数据保存失败');
      }

      await hydrateConfigData(result.data, {
        preferredSelection: nextSelection,
        preferredPresetFile: activePresetFile,
      });
      setPageStatus({ text: '默认机型数据已保存到 data.js', tone: 'success' });
      appendConsole('默认机型数据已写入 data.js');
    } catch (error) {
      setPageStatus({ text: `保存失败: ${error.message}`, tone: 'error' });
      await MKPModal.alert({
        title: '保存失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const handleAddBrand = async () => {
    const name = await MKPModal.prompt({
      title: '新增品牌',
      msg: '请输入新的品牌显示名称。',
      placeholder: '例如：Bambu Lab',
      confirmText: '创建',
    });
    if (!name?.trim()) return;

    const trimmed = name.trim();
    const nextId = sanitizeReleaseId(trimmed, 'brand');
    if (configData.brands.some((item) => item.id === nextId)) {
      await MKPModal.alert({
        title: '创建失败',
        msg: `已存在品牌 ID: ${nextId}`,
        type: 'warning',
      });
      return;
    }

    setConfigData((previous) => ({
      ...previous,
      brands: [
        ...previous.brands,
        {
          id: nextId,
          name: trimmed,
          shortName: trimmed,
          subtitle: '',
          favorite: false,
          image: '',
        },
      ],
      printersByBrand: {
        ...previous.printersByBrand,
        [nextId]: [],
      },
    }));
    setSelectedEntity({ type: 'brand', brandId: nextId, printerId: null });
    appendConsole(`新增品牌草稿 ${trimmed}`);
  };

  const handleAddPrinter = async () => {
    if (!selectedEntity.brandId) {
      await MKPModal.alert({
        title: '提示',
        msg: '请先选择一个品牌。',
        type: 'warning',
      });
      return;
    }

    const shortName = await MKPModal.prompt({
      title: '新增机型',
      msg: '请输入新的机型简称。',
      placeholder: '例如：A1',
      confirmText: '创建',
    });
    if (!shortName?.trim()) return;

    const trimmed = shortName.trim();
    const nextId = sanitizeReleaseId(trimmed, selectedEntity.brandId);
    if ((configData.printersByBrand[selectedEntity.brandId] || []).some((item) => item.id === nextId)) {
      await MKPModal.alert({
        title: '创建失败',
        msg: `当前品牌下已存在机型 ID: ${nextId}`,
        type: 'warning',
      });
      return;
    }

    setConfigData((previous) => ({
      ...previous,
      printersByBrand: {
        ...previous.printersByBrand,
        [selectedEntity.brandId]: [
          ...(previous.printersByBrand[selectedEntity.brandId] || []),
          {
            id: nextId,
            name: trimmed,
            shortName: trimmed,
            image: '',
            favorite: false,
            disabled: false,
            supportedVersions: ['standard'],
            defaultPresets: {},
          },
        ],
      },
    }));
    setSelectedEntity({
      type: 'printer',
      brandId: selectedEntity.brandId,
      printerId: nextId,
    });
    appendConsole(`新增机型草稿 ${trimmed}`);
  };

  const handleDeleteCurrentEntity = async () => {
    if (!currentEntity) return;

    const confirmed = await MKPModal.confirm({
      title: selectedEntity.type === 'printer' ? '删除机型' : '删除品牌',
      msg:
        selectedEntity.type === 'printer'
          ? `确定要删除机型 ${currentEntity.shortName || currentEntity.name} 吗？`
          : `确定要删除品牌 ${currentEntity.name} 吗？这会同时移除它下面的机型。`,
      type: 'warning',
      confirmText: '删除',
    });
    if (!confirmed) return;

    if (selectedEntity.type === 'printer' && currentPrinter) {
      const nextPrinters = (configData.printersByBrand[selectedEntity.brandId] || []).filter(
        (item) => item.id !== currentPrinter.id,
      );
      setConfigData((previous) => ({
        ...previous,
        printersByBrand: {
          ...previous.printersByBrand,
          [selectedEntity.brandId]: nextPrinters,
        },
      }));
      setSelectedEntity({
        type: nextPrinters[0] ? 'printer' : 'brand',
        brandId: selectedEntity.brandId,
        printerId: nextPrinters[0]?.id || null,
      });
      appendConsole(`已移除机型草稿 ${currentPrinter.shortName || currentPrinter.name}`);
      return;
    }

    if (currentBrand) {
      const nextBrands = configData.brands.filter((item) => item.id !== currentBrand.id);
      const nextBrandId = nextBrands[0]?.id || null;
      const nextPrinterId = (configData.printersByBrand[nextBrandId] || [])[0]?.id || null;

      setConfigData((previous) => {
        const nextPrintersByBrand = { ...previous.printersByBrand };
        delete nextPrintersByBrand[currentBrand.id];
        return {
          ...previous,
          brands: nextBrands,
          printersByBrand: nextPrintersByBrand,
        };
      });
      setSelectedEntity({
        type: nextBrandId ? (nextPrinterId ? 'printer' : 'brand') : 'brand',
        brandId: nextBrandId,
        printerId: nextPrinterId,
      });
      appendConsole(`已移除品牌草稿 ${currentBrand.name}`);
    }
  };

  const handleImportImage = async (file) => {
    if (!file || !currentEntity) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await window.mkpAPI?.importReleaseConfigImage?.({
        itemType: selectedEntity.type,
        itemId: currentEntity.id,
        fileBaseName: currentEntity.id,
        dataUrl,
      });

      if (!result?.success) {
        throw new Error(result?.error || '图片导入失败');
      }

      setEntityForm((previous) => ({
        ...previous,
        image: result.data.relativePath,
      }));
      setConfigData((previous) => {
        if (selectedEntity.type === 'printer' && currentPrinter) {
          return {
            ...previous,
            printersByBrand: {
              ...previous.printersByBrand,
              [selectedEntity.brandId]: (previous.printersByBrand[selectedEntity.brandId] || []).map((item) =>
                item.id === currentPrinter.id
                  ? { ...item, image: result.data.relativePath }
                  : item,
              ),
            },
          };
        }

        return {
          ...previous,
          brands: previous.brands.map((item) =>
            item.id === currentBrand?.id
              ? { ...item, image: result.data.relativePath }
              : item,
          ),
        };
      });
      appendConsole(`默认资源图片已处理为 webp: ${result.data.relativePath}`);
    } catch (error) {
      await MKPModal.alert({
        title: '导入失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const handleCreatePreset = () => {
    setActivePresetFile(null);
    setPresetDraft(createEmptyPresetDraft());
  };

  const handleDuplicatePreset = async () => {
    if (!presetDraft.fileName.trim()) {
      await MKPModal.alert({
        title: '提示',
        msg: '请先选择一个默认预设。',
        type: 'warning',
      });
      return;
    }

    try {
      JSON.parse(presetDraft.jsonText || '{}');
    } catch (error) {
      await MKPModal.alert({
        title: '复制失败',
        msg: `当前 JSON 格式错误，无法复制：${error.message}`,
        type: 'error',
      });
      return;
    }

    const nextName = await MKPModal.prompt({
      title: '复制默认预设',
      msg: '请输入新的预设文件名，需以 .json 结尾。',
      value: presetDraft.fileName.replace(/\.json$/i, '_copy.json'),
      placeholder: '例如：a1_standard_copy.json',
      confirmText: '生成副本',
    });
    if (!nextName?.trim()) return;

    setActivePresetFile(null);
    setPresetDraft((previous) => ({
      ...previous,
      originalFileName: null,
      fileName: nextName.trim(),
    }));
  };

  const handleSavePreset = async () => {
    let parsedJson = {};
    try {
      parsedJson = JSON.parse(presetDraft.jsonText || '{}');
    } catch (error) {
      await MKPModal.alert({
        title: 'JSON 格式错误',
        msg: error.message,
        type: 'error',
      });
      return;
    }

    const result = await window.mkpAPI?.saveReleaseConfigPreset?.({
      originalFileName: presetDraft.originalFileName,
      fileName: presetDraft.fileName.trim(),
      meta: {
        id: presetDraft.id.trim(),
        type: presetDraft.type.trim(),
        version: presetDraft.version.trim(),
        description: presetDraft.description.trim(),
        releaseNotes: presetDraft.releaseNotesText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      },
      data: parsedJson,
    });

    if (!result?.success) {
      await MKPModal.alert({
        title: '保存失败',
        msg: result?.error || '默认预设保存失败',
        type: 'error',
      });
      return;
    }

    appendConsole(`默认预设已保存 ${result.data.fileName}`);
    await loadReleaseConfig({
      preferredSelection: selectedEntity,
      preferredPresetFile: result.data.fileName,
    });
    setPageStatus({
      text: '默认预设已写入 cloud_data/presets',
      tone: 'success',
    });
  };

  const renderReleasePanel = () => (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-[#333]">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold">版本信息配置</h2>
            <p className="text-xs text-gray-500 mt-1">
              直接读写 `package.json` 与 `cloud_data/app_manifest.json`
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleOpenPath('manifest')}
              className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium"
            >
              打开 Manifest
            </button>
            <button
              onClick={() => void handleOpenPath('cloud')}
              className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium"
            >
              打开 cloud_data
            </button>
            <button
              onClick={() => void handleOpenPath('dist')}
              className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium"
            >
              打开 dist
            </button>
            <button
              onClick={() => void handleOpenPath('readme')}
              className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium"
            >
              打开说明
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">版本号 (Version)</label>
            <input
              type="text"
              value={releaseForm.version}
              onChange={(event) =>
                setReleaseForm((previous) => ({
                  ...previous,
                  version: event.target.value,
                }))
              }
              className="input-field w-full px-3 py-2 rounded-lg border text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">发布日期</label>
            <input
              type="date"
              value={releaseForm.releaseDate}
              onChange={(event) =>
                setReleaseForm((previous) => ({
                  ...previous,
                  releaseDate: event.target.value,
                }))
              }
              className="input-field w-full px-3 py-2 rounded-lg border text-sm"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">一句话说明</label>
          <input
            type="text"
            value={releaseForm.shortDesc}
            onChange={(event) =>
              setReleaseForm((previous) => ({
                ...previous,
                shortDesc: event.target.value,
              }))
            }
            className="input-field w-full px-3 py-2 rounded-lg border text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 mb-2">
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={releaseForm.forceUpdate}
              onChange={(event) =>
                setReleaseForm((previous) => ({
                  ...previous,
                  forceUpdate: event.target.checked,
                }))
              }
              className="w-4 h-4"
            />
            强制更新
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={releaseForm.canRollback}
              onChange={(event) =>
                setReleaseForm((previous) => ({
                  ...previous,
                  canRollback: event.target.checked,
                }))
              }
              className="w-4 h-4"
            />
            允许回退
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-[#333]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">发布说明 Markdown</h2>
            <p className="text-xs text-gray-500 mt-1">支持标题、列表、粗体、代码块预览。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode('edit')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                previewMode === 'edit'
                  ? 'bg-gray-100 dark:bg-[#333] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              编辑
            </button>
            <button
              onClick={() => setPreviewMode('preview')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                previewMode === 'preview'
                  ? 'bg-gray-100 dark:bg-[#333] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              预览
            </button>
            <button
              onClick={() => setIsEditorExpanded((previous) => !previous)}
              className="btn-secondary px-3 py-1 rounded text-xs font-medium"
            >
              {isEditorExpanded ? '收起编辑区' : '展开编辑区'}
            </button>
          </div>
        </div>

        <div
          className={`border border-gray-200 dark:border-[#444] rounded-xl overflow-hidden ${
            isEditorExpanded ? 'min-h-[24rem]' : ''
          }`}
        >
          <div
            className={`p-4 bg-white dark:bg-[#252526] ${
              isEditorExpanded ? 'h-96' : 'h-56'
            } overflow-y-auto`}
          >
            {previewMode === 'edit' ? (
              <textarea
                className="w-full h-full outline-none resize-none bg-transparent text-sm font-mono dark:text-gray-200"
                value={releaseForm.releaseNotesMarkdown}
                onChange={(event) =>
                  setReleaseForm((previous) => ({
                    ...previous,
                    releaseNotesMarkdown: event.target.value,
                  }))
                }
              />
            ) : (
              <div
                className="release-preview text-sm dark:text-gray-200"
                dangerouslySetInnerHTML={{
                  __html:
                    parseReleaseMarkdown(releaseForm.releaseNotesMarkdown) ||
                    '<p>暂无内容</p>',
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-[#333]">
        <div className="flex justify-between items-center mb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold">构建与下发 (Build & Deploy)</h2>
            <p className="text-xs text-gray-500 mt-1">直接调用主进程里的 `runReleaseBuild`</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(buildStatus.tone)}`}>
            {buildStatus.text}
          </span>
        </div>

        <div className="flex gap-3 mb-4">
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSelectedMode(value)}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                selectedMode === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => void handleRunBuild()}
            className="theme-btn-solid px-5 py-3 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-transform"
          >
            执行打包构建
          </button>
          <button
            onClick={() => void handleSaveReleaseInfo()}
            className="btn-secondary px-5 py-3 rounded-xl text-sm font-medium"
          >
            保存发布信息
          </button>
          <button
            onClick={async () => {
              if (!lastSummary) {
                await MKPModal.alert({
                  title: '提示',
                  msg: '当前还没有可复制的打包摘要。',
                  type: 'warning',
                });
                return;
              }
              await copyText(lastSummary);
              appendConsole('已复制打包摘要');
            }}
            className="btn-secondary px-5 py-3 rounded-xl text-sm font-medium"
          >
            复制摘要
          </button>
        </div>

        <div
          className="mt-4 bg-[#1e1e1e] text-green-400 font-mono text-xs p-4 rounded-xl h-44 overflow-y-auto"
          ref={consoleRef}
        >
          {consoleLogs.map((log, index) => (
            <div key={`${log}-${index}`}>{log}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pathRows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252526] px-4 py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {label}
            </div>
            <div className="mt-2 break-all font-mono text-[12px] text-gray-600 dark:text-gray-300">
              {value || '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfigPanel = () => (
    <div className="max-w-7xl mx-auto flex gap-6 h-[78vh]">
      <div className="w-[340px] flex flex-col gap-4 bg-white dark:bg-[#252526] p-4 rounded-2xl border border-gray-200 dark:border-[#333] overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-500">实体层级 (Brands & Printers)</h3>
            <div className="flex gap-2">
              <button
                onClick={() => void handleAddBrand()}
                className="theme-btn-soft px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                + 品牌
              </button>
              <button
                onClick={() => void handleAddPrinter()}
                className="theme-btn-soft px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                + 机型
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {configData.brands.map((brand) => {
              const isBrandSelected =
                selectedEntity.type === 'brand' && selectedEntity.brandId === brand.id;
              const brandPrinters = configData.printersByBrand[brand.id] || [];

              return (
                <div key={brand.id}>
                  <button
                    onClick={() =>
                      setSelectedEntity({
                        type: 'brand',
                        brandId: brand.id,
                        printerId: null,
                      })
                    }
                    className={`w-full p-3 rounded-xl border text-left transition-colors ${
                      isBrandSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-100 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#333]'
                    }`}
                  >
                    <div className="font-bold text-gray-900 dark:text-gray-100">{brand.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {brand.subtitle || `${brandPrinters.length} 个机型`}
                    </div>
                  </button>

                  <div className="ml-6 mt-2 flex flex-col gap-2 border-l-2 border-gray-100 dark:border-[#444] pl-4">
                    {brandPrinters.map((printer) => (
                      <button
                        key={printer.id}
                        onClick={() =>
                          setSelectedEntity({
                            type: 'printer',
                            brandId: brand.id,
                            printerId: printer.id,
                          })
                        }
                        className={`p-2 rounded-lg border text-sm text-left transition-colors ${
                          selectedEntity.type === 'printer' && selectedEntity.printerId === printer.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#333]'
                        }`}
                      >
                        {printer.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-[#333] pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-500">默认预设 (Presets)</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCreatePreset}
                className="theme-btn-soft px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                新建
              </button>
              <button
                onClick={() => void handleDuplicatePreset()}
                className="theme-btn-soft px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                复制
              </button>
            </div>
          </div>

          <input
            type="text"
            value={presetSearchQuery}
            onChange={(event) => setPresetSearchQuery(event.target.value)}
            placeholder="搜索预设文件..."
            className="input-field w-full px-3 py-2 rounded-lg border text-sm mb-3"
          />

          <div className="space-y-2">
            {filteredPresets.length > 0 ? (
              filteredPresets.map((item) => (
                <button
                  key={item.file}
                  onClick={() => void handleSelectPreset(item.file)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                    item.file === activePresetFile
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200/80 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#333]'
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {item.file}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    {item.id} / {item.type} / {item.version || '--'}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-sm text-gray-500 py-6">没有匹配的默认预设</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl border border-gray-200 dark:border-[#333]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-lg">
                {selectedEntity.type === 'brand' ? '品牌属性编辑' : '机型属性编辑'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                当前仅修改内存草稿，点击“保存 Config”后才会写回 `data.js`
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => configImageInputRef.current?.click()}
                disabled={!currentEntity}
                className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                上传图片
              </button>
              <button
                onClick={() => void handleDeleteCurrentEntity()}
                disabled={!currentEntity}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 disabled:opacity-50"
              >
                删除实体
              </button>
              <button
                onClick={() => void handleSaveConfig()}
                className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium"
              >
                保存 Config
              </button>
            </div>
          </div>

          {currentEntity ? (
            <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-36 h-36 rounded-2xl border border-gray-200 dark:border-[#444] bg-gray-50 dark:bg-[#1e1e1e] overflow-hidden flex items-center justify-center">
                  <img
                    src={toAssetUrl(entityForm.image)}
                    alt={entityForm.name || currentEntity.name || currentEntity.id}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-3 text-xs break-all text-gray-500">
                  {entityForm.image || '未设置图片'}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ID (内部标识)</label>
                  <input
                    type="text"
                    value={entityForm.id}
                    onChange={(event) => updateEntityDraft({ id: event.target.value })}
                    onBlur={() => updateEntityDraft({}, { commitId: true })}
                    className="input-field w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {selectedEntity.type === 'brand' ? '显示名称' : '机型简称'}
                  </label>
                  <input
                    type="text"
                    value={entityForm.name}
                    onChange={(event) => updateEntityDraft({ name: event.target.value })}
                    className="input-field w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {selectedEntity.type === 'brand' ? '副标题' : '完整名称'}
                  </label>
                  <input
                    type="text"
                    value={entityForm.subtitle}
                    onChange={(event) => updateEntityDraft({ subtitle: event.target.value })}
                    className="input-field w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>

                {selectedEntity.type === 'printer' ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">支持版本 (逗号分隔)</label>
                      <input
                        type="text"
                        value={entityForm.versions}
                        onChange={(event) => updateEntityDraft({ versions: event.target.value })}
                        className="input-field w-full px-3 py-2 rounded-lg border text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">默认预设映射 JSON</label>
                      <textarea
                        value={entityForm.presetsText}
                        onChange={(event) => updateEntityDraft({ presetsText: event.target.value })}
                        className="w-full h-36 p-3 bg-gray-50 dark:bg-[#1e1e1e] font-mono text-xs rounded-xl border dark:border-[#444] outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm text-center py-20">请在左侧选择实体</div>
          )}

          <input
            ref={configImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void handleImportImage(file);
            }}
          />
        </div>

        <div className="bg-white dark:bg-[#252526] p-6 rounded-2xl border border-gray-200 dark:border-[#333]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-lg">默认预设编辑器</h3>
              <p className="text-xs text-gray-500 mt-1">
                直接读写 `cloud_data/presets` 和 `presets_manifest.json`
              </p>
            </div>
            <button
              onClick={() => void handleSavePreset()}
              className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium"
            >
              保存 Preset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">文件名</label>
              <input
                type="text"
                value={presetDraft.fileName}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    fileName: event.target.value,
                  }))
                }
                className="input-field w-full px-3 py-2 rounded-lg border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ID</label>
              <input
                type="text"
                value={presetDraft.id}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    id: event.target.value,
                  }))
                }
                className="input-field w-full px-3 py-2 rounded-lg border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">类型</label>
              <input
                type="text"
                value={presetDraft.type}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
                className="input-field w-full px-3 py-2 rounded-lg border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">版本</label>
              <input
                type="text"
                value={presetDraft.version}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    version: event.target.value,
                  }))
                }
                className="input-field w-full px-3 py-2 rounded-lg border text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">描述</label>
            <input
              type="text"
              value={presetDraft.description}
              onChange={(event) =>
                setPresetDraft((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="input-field w-full px-3 py-2 rounded-lg border text-sm"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">发布说明</label>
              <textarea
                value={presetDraft.releaseNotesText}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    releaseNotesText: event.target.value,
                  }))
                }
                className="w-full h-[22rem] p-3 bg-gray-50 dark:bg-[#1e1e1e] font-mono text-xs rounded-xl border dark:border-[#444] outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">预设 JSON</label>
              <textarea
                ref={presetJsonRef}
                value={presetDraft.jsonText}
                onChange={(event) =>
                  setPresetDraft((previous) => ({
                    ...previous,
                    jsonText: event.target.value,
                  }))
                }
                className="w-full h-[22rem] p-3 bg-gray-50 dark:bg-[#1e1e1e] font-mono text-xs rounded-xl border dark:border-[#444] outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page flex-1 flex flex-col bg-gray-50 dark:bg-[#1e1e1e] h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-[#252526] border-b border-gray-200 dark:border-[#333] shrink-0">
        <h1 className="text-xl font-bold mr-4">后台管理控制台</h1>
        <button
          onClick={() => setActivePanel('release')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'release'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'
          }`}
        >
          发布中心 (Release)
        </button>
        <button
          onClick={() => setActivePanel('config')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'config'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'
          }`}
        >
          默认资源与配置 (Config)
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(pageStatus.tone)}`}>
            {pageStatus.text}
          </span>
          <button
            onClick={() => {
              void loadReleaseInfo();
              void loadReleaseConfig({ preferredSelection: selectedEntity });
            }}
            className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium"
          >
            重新载入
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">加载后台数据中...</div>
        ) : activePanel === 'release' ? (
          renderReleasePanel()
        ) : (
          renderConfigPanel()
        )}
      </div>
    </div>
  );
}
