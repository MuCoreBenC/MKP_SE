import React, { useEffect, useMemo, useState } from 'react';
import { MKPContextMenu } from '../components/GlobalContextMenu';
import { MKPModal } from '../components/GlobalModal';
import { VERSION_DICT } from '../utils/data';
import {
  buildEntityAvatar,
  normalizeBrandEntity,
  normalizePrinterEntity,
  serializeHomeCatalog,
  sortCatalogItems,
  getFirstSelectablePrinter,
} from '../utils/homeCatalog';

const HOME_VIEW_MODE_KEY = 'mkp_home_view_mode';

function buildUniqueId(baseId, existingIds) {
  let nextId = baseId;
  let counter = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${counter}`;
    counter += 1;
  }

  return nextId;
}

function toSafeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function composePrinterName(brandName, displayName) {
  if (!brandName) {
    return displayName;
  }

  return displayName.startsWith(`${brandName} `) ? displayName : `${brandName} ${displayName}`;
}

function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve(file);
    };
    input.click();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export default function HomePage({
  catalog,
  selectedBrand,
  selectedPrinter,
  selectedVersion,
  onCatalogChange,
  onSelectionChange,
  onNext,
}) {
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem(HOME_VIEW_MODE_KEY) || 'compact',
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem(HOME_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const sortedBrands = useMemo(
    () => sortCatalogItems(catalog?.brands || []),
    [catalog?.brands],
  );
  const currentPrinters = useMemo(
    () => sortCatalogItems(catalog?.printersByBrand?.[selectedBrand] || []),
    [catalog?.printersByBrand, selectedBrand],
  );
  const filteredPrinters = useMemo(() => {
    if (!searchQuery) {
      return currentPrinters;
    }

    const query = searchQuery.toLowerCase();
    return currentPrinters.filter((printer) => {
      return (
        String(printer.name || '').toLowerCase().includes(query) ||
        String(printer.shortName || '').toLowerCase().includes(query)
      );
    });
  }, [currentPrinters, searchQuery]);
  const currentBrandObj = useMemo(
    () => (catalog?.brands || []).find((brand) => brand.id === selectedBrand) || null,
    [catalog?.brands, selectedBrand],
  );

  const persistCatalog = async (nextCatalog) => {
    if (!window.mkpAPI?.saveHomeCatalog) {
      return;
    }

    const result = await window.mkpAPI.saveHomeCatalog(serializeHomeCatalog(nextCatalog));
    if (!result?.success) {
      throw new Error(result?.error || '保存首页目录失败');
    }
  };

  const commitCatalog = async (nextCatalog, nextSelection = {}) => {
    onCatalogChange(nextCatalog, nextSelection);

    try {
      await persistCatalog(nextCatalog);
    } catch (error) {
      await MKPModal.alert({
        title: '保存失败',
        msg: error.message,
        type: 'error',
      });
    }
  };

  const selectBrand = (brandId) => {
    const printerList = catalog?.printersByBrand?.[brandId] || [];
    const hasCurrentPrinter = printerList.some((printer) => printer.id === selectedPrinter);

    if (hasCurrentPrinter) {
      onSelectionChange({
        brandId,
        printerId: selectedPrinter,
        versionType: selectedVersion,
      });
      setSearchQuery('');
      return;
    }

    const fallbackPrinter = getFirstSelectablePrinter(catalog, brandId);
    onSelectionChange({
      brandId,
      printerId: fallbackPrinter?.id || null,
      versionType: selectedVersion,
    });
    setSearchQuery('');
  };

  const updateBrand = async (brandId, updater, nextSelection = {}) => {
    const nextCatalog = {
      ...catalog,
      brands: (catalog?.brands || []).map((brand) =>
        brand.id === brandId ? normalizeBrandEntity(updater(brand), brand) : brand,
      ),
    };

    await commitCatalog(nextCatalog, nextSelection);
  };

  const updatePrinter = async (brandId, printerId, updater, nextSelection = {}) => {
    const nextCatalog = {
      ...catalog,
      printersByBrand: {
        ...(catalog?.printersByBrand || {}),
        [brandId]: (catalog?.printersByBrand?.[brandId] || []).map((printer) =>
          printer.id === printerId
            ? normalizePrinterEntity(updater(printer), brandId, printer)
            : printer,
        ),
      },
    };

    await commitCatalog(nextCatalog, nextSelection);
  };

  const handleImageImport = async (target) => {
    const file = await pickImageFile();
    if (!file) return null;

    const dataUrl = await readFileAsDataUrl(file);
    const result = await window.mkpAPI?.importHomeCatalogImage?.({
      itemType: target.type,
      itemId: target.id,
      dataUrl,
    });

    if (!result?.success || !result.path) {
      throw new Error(result?.error || '导入图片失败');
    }

    return result.path;
  };

  const handleBrandContextMenu = async (event, brand) => {
    event.preventDefault();

    const menuItems = [
      { action: 'toggle-favorite', label: brand.favorite ? '取消收藏' : '收藏品牌' },
      { action: 'toggle-pin', label: brand.pinned ? '取消置顶' : '置顶品牌' },
      { type: 'separator' },
      { action: 'add-brand', label: '新增品牌' },
      { action: 'add-printer', label: '新增机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名显示名称' },
      { action: 'avatar-default', label: '使用字母头像' },
      { action: 'avatar-upload', label: '上传图片' },
      { type: 'separator' },
      {
        action: 'delete',
        label: brand.canDelete ? '删除品牌' : '默认品牌不可删除',
        disabled: !brand.canDelete,
      },
    ];

    const action = await MKPContextMenu.show(event.clientX, event.clientY, menuItems);
    if (!action) return;

    if (action === 'toggle-favorite') {
      await updateBrand(brand.id, (current) => ({ ...current, favorite: !current.favorite }));
      return;
    }

    if (action === 'toggle-pin') {
      await updateBrand(brand.id, (current) => ({ ...current, pinned: !current.pinned }));
      return;
    }

    if (action === 'add-brand') {
      const nextName = await MKPModal.prompt({
        title: '新增品牌',
        msg: '输入新的品牌名称。',
        placeholder: '品牌名称',
        confirmText: '创建',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      const existingIds = new Set((catalog?.brands || []).map((item) => item.id));
      const baseId = toSafeId(trimmedName) || `brand-${Date.now()}`;
      const nextId = buildUniqueId(baseId, existingIds);
      const nextCatalog = {
        ...catalog,
        brands: [
          normalizeBrandEntity({
            id: nextId,
            name: trimmedName,
            shortName: trimmedName,
            favorite: false,
            pinned: true,
            custom: true,
            canDelete: true,
            avatarMode: 'generated',
          }),
          ...(catalog?.brands || []),
        ],
        printersByBrand: {
          ...(catalog?.printersByBrand || {}),
          [nextId]: [],
        },
      };

      await commitCatalog(nextCatalog, {
        brandId: nextId,
        printerId: null,
        versionType: null,
      });
      return;
    }

    if (action === 'add-printer') {
      const nextName = await MKPModal.prompt({
        title: '新增机型',
        msg: `为“${brand.name}”添加一个机型。`,
        placeholder: '机型名称',
        confirmText: '创建',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      const existingIds = new Set(
        (catalog?.printersByBrand?.[brand.id] || []).map((item) => item.id),
      );
      const baseId = toSafeId(trimmedName) || `printer-${Date.now()}`;
      const nextId = buildUniqueId(baseId, existingIds);
      const displayName = composePrinterName(brand.shortName || brand.name, trimmedName);

      const nextCatalog = {
        ...catalog,
        printersByBrand: {
          ...(catalog?.printersByBrand || {}),
          [brand.id]: [
            normalizePrinterEntity(
              {
                id: nextId,
                brandId: brand.id,
                name: displayName,
                shortName: trimmedName,
                favorite: false,
                pinned: true,
                custom: true,
                canDelete: true,
                disabled: false,
                supportedVersions: [],
                avatarMode: 'generated',
              },
              brand.id,
            ),
            ...(catalog?.printersByBrand?.[brand.id] || []),
          ],
        },
      };

      await commitCatalog(nextCatalog, {
        brandId: brand.id,
        printerId: nextId,
        versionType: null,
      });
      return;
    }

    if (action === 'rename') {
      const nextName = await MKPModal.prompt({
        title: '重命名品牌',
        value: brand.name,
        placeholder: '品牌名称',
        confirmText: '保存',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      await updateBrand(brand.id, (current) => ({
        ...current,
        name: trimmedName,
        shortName: current.shortName || trimmedName,
      }));
      return;
    }

    if (action === 'avatar-default') {
      await updateBrand(brand.id, (current) => ({
        ...current,
        image: '',
        avatarMode: 'generated',
      }));
      return;
    }

    if (action === 'avatar-upload') {
      try {
        const imagePath = await handleImageImport({ type: 'brand', id: brand.id });
        if (!imagePath) return;

        await updateBrand(brand.id, (current) => ({
          ...current,
          image: imagePath,
          originalImage: imagePath,
          avatarMode: 'original',
        }));
      } catch (error) {
        await MKPModal.alert({
          title: '导入失败',
          msg: error.message,
          type: 'error',
        });
      }
      return;
    }

    if (action === 'delete' && brand.canDelete) {
      const confirmed = await MKPModal.confirm({
        title: '删除品牌',
        msg: `确定要删除品牌“${brand.name}”吗？其下机型也会一起移除。`,
        type: 'warning',
        confirmText: '删除',
      });
      if (!confirmed) return;

      const nextBrands = (catalog?.brands || []).filter((item) => item.id !== brand.id);
      const nextCatalog = {
        ...catalog,
        brands: nextBrands,
        printersByBrand: Object.fromEntries(
          Object.entries(catalog?.printersByBrand || {}).filter(([brandId]) => brandId !== brand.id),
        ),
      };
      const fallbackBrand = sortCatalogItems(nextBrands)[0] || null;
      const fallbackPrinter = fallbackBrand
        ? getFirstSelectablePrinter(nextCatalog, fallbackBrand.id)
        : null;

      await commitCatalog(nextCatalog, {
        brandId: fallbackBrand?.id || null,
        printerId: fallbackPrinter?.id || null,
        versionType: null,
      });
    }
  };

  const handlePrinterContextMenu = async (event, printer) => {
    event.preventDefault();

    const menuItems = [
      { action: 'toggle-favorite', label: printer.favorite ? '取消收藏' : '收藏机型' },
      { action: 'toggle-pin', label: printer.pinned ? '取消置顶' : '置顶机型' },
      { type: 'separator' },
      { action: 'add-printer', label: '新增机型' },
      { action: 'copy-printer', label: '复制机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名机型名称' },
      { action: 'avatar-upload', label: '上传更换图片' },
      { type: 'separator' },
      {
        action: 'delete',
        label: printer.canDelete ? '删除机型' : '默认机型不可删除',
        disabled: !printer.canDelete,
      },
    ];

    const action = await MKPContextMenu.show(event.clientX, event.clientY, menuItems);
    if (!action) return;

    if (action === 'toggle-favorite') {
      await updatePrinter(printer.brandId, printer.id, (current) => ({
        ...current,
        favorite: !current.favorite,
      }));
      return;
    }

    if (action === 'toggle-pin') {
      await updatePrinter(printer.brandId, printer.id, (current) => ({
        ...current,
        pinned: !current.pinned,
      }));
      return;
    }

    if (action === 'add-printer') {
      const nextName = await MKPModal.prompt({
        title: '新增机型',
        msg: `为“${currentBrandObj?.name || printer.brandId}”添加一个机型。`,
        placeholder: '机型名称',
        confirmText: '创建',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      const existingIds = new Set(
        (catalog?.printersByBrand?.[printer.brandId] || []).map((item) => item.id),
      );
      const baseId = toSafeId(trimmedName) || `printer-${Date.now()}`;
      const nextId = buildUniqueId(baseId, existingIds);
      const displayName = composePrinterName(
        currentBrandObj?.shortName || currentBrandObj?.name || '',
        trimmedName,
      );

      const nextCatalog = {
        ...catalog,
        printersByBrand: {
          ...(catalog?.printersByBrand || {}),
          [printer.brandId]: [
            normalizePrinterEntity(
              {
                id: nextId,
                brandId: printer.brandId,
                name: displayName,
                shortName: trimmedName,
                favorite: false,
                pinned: true,
                custom: true,
                canDelete: true,
                disabled: false,
                supportedVersions: [],
                avatarMode: 'generated',
              },
              printer.brandId,
            ),
            ...(catalog?.printersByBrand?.[printer.brandId] || []),
          ],
        },
      };

      await commitCatalog(nextCatalog, {
        brandId: printer.brandId,
        printerId: nextId,
        versionType: null,
      });
      return;
    }

    if (action === 'copy-printer') {
      const nextName = await MKPModal.prompt({
        title: '复制机型',
        value: `${printer.shortName || printer.name} 副本`,
        placeholder: '新机型名称',
        confirmText: '创建',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      const existingIds = new Set(
        (catalog?.printersByBrand?.[printer.brandId] || []).map((item) => item.id),
      );
      const baseId = toSafeId(trimmedName) || `printer-${Date.now()}`;
      const nextId = buildUniqueId(baseId, existingIds);
      const displayName = composePrinterName(
        currentBrandObj?.shortName || currentBrandObj?.name || '',
        trimmedName,
      );

      const nextCatalog = {
        ...catalog,
        printersByBrand: {
          ...(catalog?.printersByBrand || {}),
          [printer.brandId]: [
            normalizePrinterEntity(
              {
                ...printer,
                id: nextId,
                name: displayName,
                shortName: trimmedName,
                favorite: false,
                pinned: true,
                custom: true,
                canDelete: true,
                disabled: false,
              },
              printer.brandId,
              printer,
            ),
            ...(catalog?.printersByBrand?.[printer.brandId] || []),
          ],
        },
      };

      await commitCatalog(nextCatalog, {
        brandId: printer.brandId,
        printerId: nextId,
        versionType: null,
      });
      return;
    }

    if (action === 'rename') {
      const nextName = await MKPModal.prompt({
        title: '重命名机型',
        value: printer.shortName || printer.name,
        placeholder: '机型名称',
        confirmText: '保存',
      });
      if (!nextName) return;

      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      await updatePrinter(printer.brandId, printer.id, (current) => ({
        ...current,
        name: composePrinterName(
          currentBrandObj?.shortName || currentBrandObj?.name || '',
          trimmedName,
        ),
        shortName: trimmedName,
      }));
      return;
    }

    if (action === 'avatar-upload') {
      try {
        const imagePath = await handleImageImport({ type: 'printer', id: printer.id });
        if (!imagePath) return;

        await updatePrinter(printer.brandId, printer.id, (current) => ({
          ...current,
          image: imagePath,
          originalImage: imagePath,
          avatarMode: 'original',
        }));
      } catch (error) {
        await MKPModal.alert({
          title: '导入失败',
          msg: error.message,
          type: 'error',
        });
      }
      return;
    }

    if (action === 'delete' && printer.canDelete) {
      const confirmed = await MKPModal.confirm({
        title: '删除机型',
        msg: `确定要删除机型“${printer.name}”吗？`,
        type: 'warning',
        confirmText: '删除',
      });
      if (!confirmed) return;

      const nextPrinterList = (catalog?.printersByBrand?.[printer.brandId] || []).filter(
        (item) => item.id !== printer.id,
      );
      const nextCatalog = {
        ...catalog,
        printersByBrand: {
          ...(catalog?.printersByBrand || {}),
          [printer.brandId]: nextPrinterList,
        },
      };
      const fallbackPrinter = getFirstSelectablePrinter(nextCatalog, printer.brandId);

      await commitCatalog(nextCatalog, {
        brandId: printer.brandId,
        printerId: selectedPrinter === printer.id ? fallbackPrinter?.id || null : selectedPrinter,
        versionType: selectedPrinter === printer.id ? null : selectedVersion,
      });
    }
  };

  const renderVersionBadges = (versions) => {
    if (!versions || versions.length === 0) return null;

    return versions.map((version) => {
      const versionInfo = VERSION_DICT[version];
      if (!versionInfo) return null;

      return (
        <span
          key={version}
          className={`home-version-badge ${versionInfo.bgClass} ${versionInfo.textClass}`}
        >
          {versionInfo.name}
        </span>
      );
    });
  };

  return (
    <div id="page-home" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1
            id="title-page-home"
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight"
          >
            选择机型
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onNext}
              className="theme-btn-solid px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <span>下一步</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="page-header-sub"></div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-7xl w-full home-stage">
          <div className="home-stage-panel bg-white dark:bg-[#252526] rounded-[30px] card-shadow border border-transparent dark:border-[#333] transition-colors">
            <div className="home-stage-toolbar">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                  Printer Gallery
                </div>
                <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {currentBrandObj?.name || '未知品牌'} · {filteredPrinters.length} 个机型
                </div>
              </div>
              <div className="home-stage-toolbar-actions">
                <div className="inline-flex rounded-2xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1E1E1E] p-1 shrink-0">
                  <button
                    onClick={() => setViewMode('compact')}
                    className={`release-segment-btn rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      viewMode === 'compact' ? 'active' : ''
                    }`}
                  >
                    简约
                  </button>
                  <button
                    onClick={() => setViewMode('detailed')}
                    className={`release-segment-btn rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      viewMode === 'detailed' ? 'active' : ''
                    }`}
                  >
                    详细
                  </button>
                </div>

                <div className="relative home-stage-search">
                  <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索机型..."
                    className="input-field pl-10 pr-4 py-3 rounded-2xl text-sm w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="home-brand-strip-block">
              <div className="home-brand-strip-head">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">品牌</span>
              </div>
              <div className="home-brand-strip hide-scrollbar">
                {sortedBrands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => selectBrand(brand.id)}
                    onContextMenu={(e) => handleBrandContextMenu(e, brand)}
                    className={`brand-card home-brand-card home-brand-row border text-left ${
                      brand.id === selectedBrand ? 'active' : ''
                    } ${brand.favorite ? 'favorited' : ''}`}
                  >
                    <span className="block min-w-0 home-brand-copy">
                      <span className="block truncate font-medium text-gray-900 dark:text-gray-100 home-brand-primary">
                        {brand.shortName || brand.name}
                      </span>
                      {viewMode === 'detailed' && brand.subtitle && (
                        <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400 home-brand-secondary">
                          {brand.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="home-gallery-shell">
              <div className="home-gallery-head">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  当前视图支持横向浏览
                </div>
              </div>

              <div className="home-gallery-viewport hide-scrollbar">
                {filteredPrinters.length === 0 ? (
                  <div className="home-empty-state mt-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      没有匹配的机型
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      可以清空搜索，或者尝试切换品牌。
                    </div>
                  </div>
                ) : (
                  <div className={`home-printer-grid home-printer-grid-${viewMode}`}>
                    {filteredPrinters.map((printer) => {
                      const isSelected = printer.id === selectedPrinter;
                      const disabledClass = printer.disabled ? 'printer-card-disabled' : '';
                      const printerImage = buildEntityAvatar(printer, printer.brandId);

                      return (
                        <button
                          key={printer.id}
                          disabled={printer.disabled}
                          onClick={() =>
                            onSelectionChange({
                              brandId: printer.brandId,
                              printerId: printer.id,
                              versionType:
                                printer.id === selectedPrinter ? selectedVersion : null,
                            })
                          }
                          onContextMenu={(e) => handlePrinterContextMenu(e, printer)}
                          className={`select-card home-printer-card home-printer-card-${viewMode} ${
                            isSelected ? 'selected' : ''
                          } ${disabledClass}`}
                        >
                          {viewMode === 'compact' ? (
                            <div className="home-printer-card-inner">
                              <div className="home-printer-media">
                                <span className="home-printer-avatar-shell">
                                  <img
                                    className="home-printer-avatar"
                                    src={printerImage}
                                    alt={printer.name}
                                    draggable="false"
                                  />
                                </span>
                              </div>
                              <div className="home-printer-card-caption min-w-0 text-left w-full">
                                <div className="home-printer-name text-gray-900 dark:text-gray-100 truncate">
                                  {printer.name}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 home-printer-version-row">
                                  {renderVersionBadges(printer.supportedVersions)}
                                </div>
                                {printer.disabled && (
                                  <div className="mt-3 home-printer-status">暂不可用</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="home-printer-flip">
                              <div className="home-printer-face home-printer-face-front text-left">
                                <div className="home-printer-media">
                                  <span className="home-printer-avatar-shell">
                                    <img
                                      className="home-printer-avatar"
                                      src={printerImage}
                                      alt={printer.name}
                                      draggable="false"
                                    />
                                  </span>
                                </div>
                                <div className="home-printer-front-copy">
                                  <div className="home-printer-name text-gray-900 dark:text-gray-100">
                                    {printer.name}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {printer.shortName} 系列
                                  </div>
                                </div>
                              </div>

                              <div className="home-printer-face home-printer-face-back text-left">
                                <div>
                                  <div className="home-printer-back-top">
                                    <div className="min-w-0">
                                      <div className="home-printer-back-title truncate">
                                        {printer.name}
                                      </div>
                                    </div>
                                    {printer.disabled && (
                                      <div className="home-printer-status">暂不可用</div>
                                    )}
                                  </div>
                                  <div className="home-printer-back-label">支持版本</div>
                                  <div className="flex flex-wrap gap-2 home-printer-version-row">
                                    {renderVersionBadges(printer.supportedVersions)}
                                    {(!printer.supportedVersions ||
                                      printer.supportedVersions.length === 0) && (
                                      <span className="text-xs text-gray-400">暂无预设</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  点击卡片选中配置
                                </div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
