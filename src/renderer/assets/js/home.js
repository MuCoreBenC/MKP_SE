const DEFAULT_HOME_CATALOG = JSON.parse(JSON.stringify({
  brands,
  printersByBrand
}));

const HOME_CONTEXT_MENU_ID = 'homeCatalogContextMenu';
const HOME_IMAGE_INPUT_ID = 'homeCatalogImageInput';
const HOME_VIEW_MODE_KEY = 'mkp_home_view_mode';

let brandPrefixSyncFrame = 0;
let homeCatalogReadyPromise = null;
let homeCatalogLoaded = false;
let homeContextTarget = null;
let pendingImageTarget = null;
let homeViewMode = localStorage.getItem(HOME_VIEW_MODE_KEY) || 'compact';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isEnglishIdentifier(value) {
  return /^[a-z][a-z0-9_-]{1,31}$/i.test(String(value || '').trim());
}

function toCatalogFileUrl(filePath) {
  if (!filePath) return '';
  if (/^(data:|https?:|assets\/)/i.test(filePath)) return filePath;
  if (/^[a-zA-Z]:\\/.test(filePath)) {
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
  return filePath;
}

function createLetterAvatarDataUri(text, seed = '') {
  const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];
  const key = `${seed}_${text}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }
  const bg = palette[Math.abs(hash) % palette.length];
  const label = String(text || '?').trim().replace(/\s+/g, ' ').slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill="${bg}"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, Arial, sans-serif" font-size="180" font-weight="700" fill="#ffffff">${escapeHtml(label)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeBrandEntity(brand, fallback = {}) {
  const base = {
    ...(fallback && typeof fallback === 'object' ? cloneValue(fallback) : {}),
    ...(brand && typeof brand === 'object' ? cloneValue(brand) : {})
  };

  return {
    ...base,
    id: String(base.id || '').trim(),
    name: String(base.name || '').trim(),
    shortName: String(base.shortName || base.name || '').trim(),
    subtitle: String(base.subtitle || '').trim(),
    favorite: !!base.favorite,
    pinned: !!base.pinned,
    image: String(base.image || '').trim(),
    originalImage: String(base.originalImage || base.image || '').trim(),
    avatarMode: String(base.avatarMode || (base.image ? 'original' : 'generated')).trim(),
    labelMode: base.labelMode === 'full' ? 'full' : 'short',
    custom: !!base.custom,
    canDelete: !!(base.canDelete ?? base.custom)
  };
}

function normalizePrinterEntity(printer, brandId, fallback = {}) {
  const base = {
    ...(fallback && typeof fallback === 'object' ? cloneValue(fallback) : {}),
    ...(printer && typeof printer === 'object' ? cloneValue(printer) : {})
  };

  const fallbackVersions = Array.isArray(fallback.supportedVersions) ? [...fallback.supportedVersions] : [];
  const baseVersions = Array.isArray(base.supportedVersions) ? [...base.supportedVersions] : fallbackVersions;
  const fallbackPresets = fallback.defaultPresets && typeof fallback.defaultPresets === 'object'
    ? { ...fallback.defaultPresets }
    : {};
  const basePresets = base.defaultPresets && typeof base.defaultPresets === 'object'
    ? { ...base.defaultPresets }
    : fallbackPresets;

  return {
    ...base,
    id: String(base.id || '').trim(),
    brandId: String(brandId || base.brandId || '').trim(),
    name: String(base.name || '').trim(),
    shortName: String(base.shortName || base.name || '').trim(),
    image: String(base.image || '').trim(),
    originalImage: String(base.originalImage || base.image || '').trim(),
    avatarMode: String(base.avatarMode || (base.image ? 'original' : 'generated')).trim(),
    labelMode: base.labelMode === 'full' ? 'full' : 'short',
    favorite: !!base.favorite,
    pinned: !!base.pinned,
    disabled: !!base.disabled,
    custom: !!base.custom,
    canDelete: !!(base.canDelete ?? base.custom),
    supportedVersions: baseVersions,
    defaultPresets: basePresets
  };
}

function composePrinterName(brandId, displayName) {
  const brand = brands.find((item) => item.id === brandId);
  const prefix = brand?.shortName || brand?.name || '';
  return prefix ? `${prefix} ${displayName}` : displayName;
}

function sortCatalogItems(items) {
  return [...items].sort((left, right) => {
    if (!!left.pinned !== !!right.pinned) return left.pinned ? -1 : 1;
    if (!!left.favorite !== !!right.favorite) return left.favorite ? -1 : 1;
    return String(left.name || left.shortName || '').localeCompare(
      String(right.name || right.shortName || ''),
      'zh-CN',
      { numeric: true, sensitivity: 'base' }
    );
  });
}

function buildMergedHomeCatalog(savedCatalog) {
  const baseBrands = DEFAULT_HOME_CATALOG.brands.map((brand) => normalizeBrandEntity({
    ...cloneValue(brand),
    pinned: false,
    custom: false,
    canDelete: false
  }));

  const basePrinters = {};
  Object.entries(DEFAULT_HOME_CATALOG.printersByBrand).forEach(([brandId, printerList]) => {
    basePrinters[brandId] = printerList.map((printer) => normalizePrinterEntity({
      ...cloneValue(printer),
      brandId,
      pinned: false,
      custom: false,
      canDelete: false
    }, brandId));
  });

  if (!savedCatalog || typeof savedCatalog !== 'object') {
    return {
      brands: baseBrands,
      printersByBrand: basePrinters
    };
  }

  const savedBrands = Array.isArray(savedCatalog.brands) ? savedCatalog.brands : [];
  const savedBrandMap = new Map(savedBrands.map((item) => [item.id, item]));

  const mergedBrands = baseBrands.map((brand) => {
    const saved = savedBrandMap.get(brand.id);
    return saved ? normalizeBrandEntity(saved, brand) : brand;
  });

  savedBrands.forEach((brand) => {
    if (!brand?.id || mergedBrands.some((item) => item.id === brand.id)) return;
    mergedBrands.push(normalizeBrandEntity({ ...brand, custom: true, canDelete: true }));
  });

  const savedPrintersByBrand = savedCatalog.printersByBrand && typeof savedCatalog.printersByBrand === 'object'
    ? savedCatalog.printersByBrand
    : {};

  const mergedPrinters = {};
  const allBrandIds = new Set([
    ...Object.keys(basePrinters),
    ...Object.keys(savedPrintersByBrand),
    ...mergedBrands.map((brand) => brand.id)
  ]);

  allBrandIds.forEach((brandId) => {
    const baseList = Array.isArray(basePrinters[brandId]) ? basePrinters[brandId] : [];
    const savedList = Array.isArray(savedPrintersByBrand[brandId]) ? savedPrintersByBrand[brandId] : [];
    const savedMap = new Map(savedList.map((item) => [item.id, item]));

    const mergedList = baseList.map((printer) => {
      const saved = savedMap.get(printer.id);
      return saved ? normalizePrinterEntity(saved, brandId, printer) : printer;
    });

    savedList.forEach((printer) => {
      if (!printer?.id || mergedList.some((item) => item.id === printer.id)) return;
      mergedList.push(normalizePrinterEntity({ ...printer, custom: true, canDelete: true }, brandId));
    });

    mergedPrinters[brandId] = mergedList;
  });

  return {
    brands: mergedBrands,
    printersByBrand: mergedPrinters
  };
}

function applyHomeCatalogState(catalog) {
  brands.splice(0, brands.length, ...catalog.brands.map((brand) => normalizeBrandEntity(brand)));

  Object.keys(printersByBrand).forEach((brandId) => {
    delete printersByBrand[brandId];
  });

  Object.entries(catalog.printersByBrand).forEach(([brandId, printerList]) => {
    printersByBrand[brandId] = printerList.map((printer) => normalizePrinterEntity(printer, brandId));
  });
}

function serializeHomeCatalog() {
  return {
    version: 1,
    brands: brands.map((brand) => normalizeBrandEntity(brand)),
    printersByBrand: Object.fromEntries(
      Object.entries(printersByBrand).map(([brandId, printerList]) => [
        brandId,
        printerList.map((printer) => normalizePrinterEntity(printer, brandId))
      ])
    )
  };
}

async function persistHomeCatalog() {
  if (!window.mkpAPI?.saveHomeCatalog) return;
  const result = await window.mkpAPI.saveHomeCatalog(serializeHomeCatalog());
  if (!result?.success) {
    throw new Error(result?.error || '保存首页目录失败');
  }
}

async function ensureHomeCatalogReady() {
  if (homeCatalogLoaded) return true;
  if (homeCatalogReadyPromise) return homeCatalogReadyPromise;

  homeCatalogReadyPromise = (async () => {
    const result = await window.mkpAPI?.readHomeCatalog?.();
    const merged = buildMergedHomeCatalog(result?.success ? result.data : null);
    applyHomeCatalogState(merged);
    homeCatalogLoaded = true;
    return true;
  })();

  try {
    await homeCatalogReadyPromise;
  } finally {
    homeCatalogReadyPromise = null;
  }
  return true;
}

function syncBrandPrefixVisibility() {
  const appRoot = document.getElementById('mainApp');
  if (!appRoot) return;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const shouldCompact = viewportWidth <= 1002 || (viewportWidth <= 1133 && !sidebarCollapsed);
  appRoot.classList.toggle('compact-brand-prefix', shouldCompact);
}

function requestBrandPrefixVisibilitySync() {
  if (brandPrefixSyncFrame) {
    cancelAnimationFrame(brandPrefixSyncFrame);
  }

  brandPrefixSyncFrame = requestAnimationFrame(() => {
    brandPrefixSyncFrame = 0;
    syncBrandPrefixVisibility();
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.getElementById('sidebarWrapper');
  if (!sidebar || !wrapper) return;

  sidebarCollapsed = !sidebarCollapsed;
  Logger.info(`Toggle UI: sidebar, collapsed:${sidebarCollapsed}`);

  sidebar.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  wrapper.classList.toggle('sidebar-wrapper-collapsed', sidebarCollapsed);
  requestBrandPrefixVisibilitySync();
}

function updateSidebarVersionBadge(version) {
  const badge = document.getElementById('sidebarVersionBadge');
  if (!badge) return;

  const theme = VERSION_THEMES[version];
  if (theme) {
    badge.textContent = theme.title;
    badge.style.setProperty('background-color', theme.bg, 'important');
    badge.style.setProperty('color', theme.text, 'important');
  } else {
    badge.textContent = '未选择';
    badge.style.removeProperty('background-color');
    badge.style.removeProperty('color');
  }
}

function getBrandById(brandId) {
  return brands.find((brand) => brand.id === brandId) || null;
}

function getDefaultBrandById(brandId) {
  return DEFAULT_HOME_CATALOG.brands.find((brand) => brand.id === brandId) || null;
}

function getPrinterListByBrand(brandId) {
  if (!brandId) return [];
  if (!Array.isArray(printersByBrand[brandId])) {
    printersByBrand[brandId] = [];
  }
  return printersByBrand[brandId];
}

function findPrinterLocation(printerId) {
  if (!printerId) return null;
  for (const [brandId, printerList] of Object.entries(printersByBrand)) {
    const printer = (printerList || []).find((item) => item.id === printerId);
    if (printer) {
      return { brandId, printer };
    }
  }
  return null;
}

function getDefaultPrinterById(printerId) {
  for (const printerList of Object.values(DEFAULT_HOME_CATALOG.printersByBrand)) {
    const printer = (printerList || []).find((item) => item.id === printerId);
    if (printer) return printer;
  }
  return null;
}

function getEntityPrimaryName(entity) {
  if (!entity) return '';
  return entity.labelMode === 'full'
    ? (entity.name || entity.shortName || entity.id)
    : (entity.shortName || entity.name || entity.id);
}

function getEntitySecondaryName(entity) {
  if (!entity) return '';
  const primary = getEntityPrimaryName(entity);
  const secondary = entity.labelMode === 'full'
    ? (entity.shortName || '')
    : (entity.name || '');
  return secondary && secondary !== primary ? secondary : '';
}

function getEntityOriginalImage(entity, itemType) {
  if (!entity) return '';
  if (entity.originalImage) return entity.originalImage;
  const fallback = itemType === 'brand'
    ? getDefaultBrandById(entity.id)
    : getDefaultPrinterById(entity.id);
  return String(fallback?.image || '').trim();
}

function canRestoreOriginalImage(entity, itemType) {
  return !!getEntityOriginalImage(entity, itemType);
}

function applyHomeViewMode() {
  const page = document.getElementById('page-home');
  if (!page) return;
  page.classList.toggle('home-view-compact', homeViewMode === 'compact');
  page.classList.toggle('home-view-detailed', homeViewMode !== 'compact');

  const compactBtn = document.getElementById('homeViewCompactBtn');
  const detailedBtn = document.getElementById('homeViewDetailedBtn');
  if (compactBtn) compactBtn.classList.toggle('active', homeViewMode === 'compact');
  if (detailedBtn) detailedBtn.classList.toggle('active', homeViewMode !== 'compact');
}

function setHomeViewMode(mode) {
  homeViewMode = mode === 'detailed' ? 'detailed' : 'compact';
  localStorage.setItem(HOME_VIEW_MODE_KEY, homeViewMode);
  applyHomeViewMode();
  renderBrands();
  renderPrinters(selectedBrand);
}

function getFirstAvailableBrand() {
  return sortCatalogItems(brands)[0] || null;
}

function getFirstSelectablePrinter(brandId) {
  const printerList = sortCatalogItems(getPrinterListByBrand(brandId));
  return printerList.find((printer) => !printer.disabled) || printerList[0] || null;
}

function ensureValidHomeSelection() {
  const selectedBrandObj = getBrandById(selectedBrand);
  const selectedPrinterLocation = findPrinterLocation(selectedPrinter);

  if (selectedBrandObj) {
    if (!selectedPrinterLocation || selectedPrinterLocation.brandId !== selectedBrandObj.id) {
      const fallbackPrinter = getFirstSelectablePrinter(selectedBrandObj.id);
      selectedPrinter = fallbackPrinter?.id || null;
    }
  } else if (selectedPrinterLocation) {
    selectedBrand = selectedPrinterLocation.brandId;
  } else {
    const fallbackBrand = getFirstAvailableBrand();
    selectedBrand = fallbackBrand?.id || null;
    selectedPrinter = selectedBrand ? getFirstSelectablePrinter(selectedBrand)?.id || null : null;
  }

  const currentPrinter = selectedPrinter ? getPrinterObj(selectedPrinter) : null;
  if (currentPrinter && selectedVersion && Array.isArray(currentPrinter.supportedVersions) && !currentPrinter.supportedVersions.includes(selectedVersion)) {
    selectedVersion = null;
  }
}

function getBrandAvatar(brand) {
  if (brand.avatarMode === 'generated') {
    return createLetterAvatarDataUri(getEntityPrimaryName(brand) || 'B', brand.id);
  }
  return toCatalogFileUrl(brand.image || getEntityOriginalImage(brand, 'brand')) || createLetterAvatarDataUri(getEntityPrimaryName(brand) || 'B', brand.id);
}

function getPrinterAvatar(printer) {
  if (printer.avatarMode === 'generated') {
    return createLetterAvatarDataUri(getEntityPrimaryName(printer) || 'P', printer.id);
  }
  return toCatalogFileUrl(printer.image || getEntityOriginalImage(printer, 'printer')) || createLetterAvatarDataUri(getEntityPrimaryName(printer) || 'P', printer.id);
}

function getVersionTagMarkup(printer) {
  const versions = Array.isArray(printer.supportedVersions) ? printer.supportedVersions : [];
  if (versions.length === 0) {
    return '<span class="home-version-badge home-version-badge-muted">未配置版本</span>';
  }

  return versions.map((versionType) => {
    const theme = VERSION_THEMES[versionType];
    const label = theme?.title || versionType;
    const style = theme
      ? `style="background:${escapeHtml(theme.bg)};color:${escapeHtml(theme.text)}"`
      : '';
    return `<span class="home-version-badge" ${style}>${escapeHtml(label)}</span>`;
  }).join('');
}

function getMetaBadgeMarkup(item) {
  const badges = [];
  if (item.pinned) badges.push('<span class="home-meta-badge">置顶</span>');
  if (item.favorite) badges.push('<span class="home-meta-badge">收藏</span>');
  if (item.custom) badges.push('<span class="home-meta-badge home-meta-badge-soft">自定义</span>');
  return badges.join('');
}

function updateHomeHeader(brandId = selectedBrand) {
  const brand = getBrandById(brandId);
  const title = document.getElementById('currentBrandTitle');
  if (!title) return;

  if (!brand) {
    title.textContent = '未选择品牌';
    return;
  }

  const printerCount = getPrinterListByBrand(brand.id).length;
  title.textContent = `${brand.name} · ${printerCount} 个机型`;
}

function renderBrands() {
  ensureValidHomeSelection();

  const brandList = document.getElementById('brandList');
  if (!brandList) return;

  const sortedBrands = sortCatalogItems(brands);
  brandList.innerHTML = '';

  sortedBrands.forEach((brand) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `brand-card home-brand-card w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left ${
      brand.id === selectedBrand ? 'active border-gray-200 dark:border-[#3a3a3a]' : 'border-gray-200/80 dark:border-[#333333]'
    }`;
    card.dataset.brandId = brand.id;

    card.innerHTML = `
      <span class="home-brand-avatar-shell">
        <img class="home-brand-avatar" src="${escapeHtml(getBrandAvatar(brand))}" alt="${escapeHtml(brand.name)}" draggable="false">
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="font-medium text-gray-900 dark:text-gray-100 truncate">${escapeHtml(brand.name)}</span>
        </span>
        <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(brand.subtitle || brand.shortName || '点击查看机型')}</span>
        <span class="mt-2 flex flex-wrap gap-1">${getMetaBadgeMarkup(brand)}</span>
      </span>
    `;

    card.addEventListener('click', () => {
      void selectBrand(brand.id);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'brand', brandId: brand.id });
    });

    brandList.appendChild(card);
  });

  updateHomeHeader(selectedBrand);
  requestBrandPrefixVisibilitySync();
}

function buildPrinterCardMarkup(printer) {
  const disabledText = printer.disabled ? '<div class="home-printer-status">暂不可用</div>' : '';
  const title = printer.shortName || printer.name;
  const secondary = printer.name && printer.name !== printer.shortName
    ? printer.name
    : composePrinterName(printer.brandId, printer.shortName || printer.name || printer.id);

  return `
    <div class="home-printer-media">
      <span class="home-printer-avatar-shell">
        <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
      </span>
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(title)}</div>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(secondary)}</div>
        </div>
        ${disabledText}
      </div>
      <div class="mt-3 flex flex-wrap gap-1">${getVersionTagMarkup(printer)}</div>
      <div class="mt-3 flex flex-wrap gap-1">${getMetaBadgeMarkup(printer)}</div>
    </div>
  `;
}

function renderPrinters(brandId = selectedBrand) {
  ensureValidHomeSelection();

  const printerGrid = document.getElementById('printerGrid');
  if (!printerGrid) return;

  const brand = getBrandById(brandId);
  if (!brand) {
    printerGrid.innerHTML = '<div class="col-span-3 home-empty-state">没有可显示的机型</div>';
    return;
  }

  const searchValue = (document.getElementById('printerSearch')?.value || '').trim().toLowerCase();
  const sortedPrinters = sortCatalogItems(getPrinterListByBrand(brand.id));
  const filteredPrinters = sortedPrinters.filter((printer) => {
    if (!searchValue) return true;
    const haystack = [
      printer.id,
      printer.name,
      printer.shortName,
      brand.name,
      brand.shortName
    ].join(' ').toLowerCase();
    return haystack.includes(searchValue);
  });

  updateHomeHeader(brand.id);
  printerGrid.innerHTML = '';

  if (filteredPrinters.length === 0) {
    printerGrid.innerHTML = `
      <div class="col-span-3 home-empty-state">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者右键品牌新增机型。</div>
      </div>
    `;
    return;
  }

  filteredPrinters.forEach((printer) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card home-printer-card rounded-2xl border p-4 text-left ${printer.id === selectedPrinter ? 'selected' : 'border-gray-200 dark:border-[#333333]'}`;
    card.dataset.printerId = printer.id;
    card.innerHTML = buildPrinterCardMarkup(printer);

    if (printer.disabled) {
      card.classList.add('printer-card-disabled');
      card.disabled = true;
    } else {
      card.addEventListener('click', () => {
        selectPrinter(printer.id, true);
      });
    }

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'printer', printerId: printer.id, brandId: brand.id });
    });

    printerGrid.appendChild(card);
  });
}

function updateHomeHeader(brandId = selectedBrand) {
  const brand = getBrandById(brandId);
  const title = document.getElementById('currentBrandTitle');
  if (!title) return;

  if (!brand) {
    title.textContent = '未选择品牌';
    return;
  }

  const displayName = getEntityPrimaryName(brand) || brand.name || brand.shortName || brand.id;
  const printerCount = getPrinterListByBrand(brand.id).length;
  title.textContent = `${displayName} · ${printerCount} 个机型`;
}

function renderBrands() {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const brandList = document.getElementById('brandList');
  if (!brandList) return;

  brandList.innerHTML = sortCatalogItems(brands).map((brand) => {
    const secondaryName = homeViewMode === 'detailed'
      ? (getEntitySecondaryName(brand) || brand.subtitle || '')
      : '';
    const badgeMarkup = homeViewMode === 'detailed' ? getMetaBadgeMarkup(brand) : '';

    return `
      <button
        type="button"
        class="brand-card home-brand-card home-brand-row border text-left ${brand.id === selectedBrand ? 'active' : ''}"
        data-brand-id="${escapeHtml(brand.id)}"
      >
        <span class="block min-w-0 home-brand-copy">
          <span class="block truncate font-medium text-gray-900 dark:text-gray-100 home-brand-primary">${escapeHtml(getEntityPrimaryName(brand))}</span>
          ${secondaryName ? `<span class="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400 home-brand-secondary">${escapeHtml(secondaryName)}</span>` : ''}
          ${badgeMarkup ? `<span class="mt-2 flex flex-wrap gap-1 home-brand-badges">${badgeMarkup}</span>` : ''}
        </span>
      </button>
    `;
  }).join('');

  brandList.querySelectorAll('[data-brand-id]').forEach((card) => {
    card.addEventListener('click', () => {
      void selectBrand(card.dataset.brandId);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'brand', brandId: card.dataset.brandId });
    });
  });

  updateHomeHeader(selectedBrand);
  requestBrandPrefixVisibilitySync();
}

function buildPrinterCardMarkup(printer) {
  const title = getEntityPrimaryName(printer);
  const secondary = getEntitySecondaryName(printer);
  const versionMarkup = getVersionTagMarkup(printer);
  const badgeMarkup = getMetaBadgeMarkup(printer);
  const disabledMarkup = printer.disabled ? '<div class="home-printer-status">暂不可用</div>' : '';

  if (homeViewMode === 'detailed') {
    return `
      <div class="home-printer-flip">
        <div class="home-printer-face home-printer-face-front">
          <div class="home-printer-media">
            <span class="home-printer-avatar-shell">
              <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
            </span>
          </div>
          <div class="home-printer-front-copy">
            <div class="home-printer-name text-gray-900 dark:text-gray-100">${escapeHtml(title)}</div>
            ${secondary ? `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(secondary)}</div>` : ''}
          </div>
        </div>

        <div class="home-printer-face home-printer-face-back">
          <div>
            <div class="home-printer-back-top">
              <div class="min-w-0">
                <div class="home-printer-back-title truncate">${escapeHtml(title)}</div>
                ${secondary ? `<div class="home-printer-back-subtitle">${escapeHtml(secondary)}</div>` : ''}
              </div>
              ${disabledMarkup}
            </div>

            <div class="home-printer-back-label">支持版本</div>
            <div class="flex flex-wrap gap-2 home-printer-version-row">${versionMarkup}</div>

            ${badgeMarkup ? `
              <div class="home-printer-back-label">附加状态</div>
              <div class="flex flex-wrap gap-2 home-printer-back-meta">${badgeMarkup}</div>
            ` : ''}
          </div>

          <div class="text-xs text-gray-400 dark:text-gray-500">点击卡片选中，右键可管理该机型</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="home-printer-card-inner">
      <div class="home-printer-media">
        <span class="home-printer-avatar-shell">
          <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
        </span>
      </div>
      <div class="home-printer-card-caption min-w-0">
        <div class="home-printer-name text-gray-900 dark:text-gray-100 truncate">${escapeHtml(title)}</div>
        <div class="mt-3 flex flex-wrap gap-2 home-printer-version-row">${versionMarkup}</div>
        ${printer.disabled ? '<div class="mt-3 home-printer-status">暂不可用</div>' : ''}
      </div>
    </div>
  `;
}

function getVisibleHomePrinterCards() {
  return Array.from(document.querySelectorAll('#printerGrid .home-printer-card[data-printer-id]'));
}

function scrollHomeGalleryToSelected(behavior = 'smooth') {
  if (homeViewMode !== 'compact') return;

  const printerGrid = document.getElementById('printerGrid');
  const selectedCard = printerGrid?.querySelector('.home-printer-card.selected');
  if (!printerGrid || !selectedCard) return;

  selectedCard.scrollIntoView({
    behavior,
    block: 'nearest',
    inline: 'center'
  });
}

function stepHomeGallery(direction) {
  const cards = getVisibleHomePrinterCards();
  if (!cards.length) return;

  const currentIndex = Math.max(0, cards.findIndex((card) => card.dataset.printerId === selectedPrinter));
  const nextIndex = (currentIndex + direction + cards.length) % cards.length;
  const nextCard = cards[nextIndex];
  if (!nextCard?.dataset?.printerId) return;

  selectPrinter(nextCard.dataset.printerId, true);
  requestAnimationFrame(() => scrollHomeGalleryToSelected('smooth'));
}

function renderPrinters(brandId = selectedBrand) {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const printerGrid = document.getElementById('printerGrid');
  if (!printerGrid) return;

  const brand = getBrandById(brandId);
  if (!brand) {
    printerGrid.className = 'home-printer-grid home-printer-grid-empty';
    printerGrid.innerHTML = '<div class="home-empty-state">没有可显示的机型</div>';
    return;
  }

  const searchValue = (document.getElementById('printerSearch')?.value || '').trim().toLowerCase();
  const filteredPrinters = sortCatalogItems(getPrinterListByBrand(brand.id)).filter((printer) => {
    if (!searchValue) return true;
    return [printer.id, printer.name, printer.shortName, brand.name, brand.shortName]
      .join(' ')
      .toLowerCase()
      .includes(searchValue);
  });

  updateHomeHeader(brand.id);
  printerGrid.className = `home-printer-grid home-printer-grid-${homeViewMode}`;
  printerGrid.innerHTML = '';

  if (!filteredPrinters.length) {
    printerGrid.innerHTML = `
      <div class="home-empty-state">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者右键品牌新增机型。</div>
      </div>
    `;
    return;
  }

  filteredPrinters.forEach((printer) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card home-printer-card home-printer-card-${homeViewMode} ${printer.id === selectedPrinter ? 'selected' : ''}`;
    card.dataset.printerId = printer.id;
    card.innerHTML = buildPrinterCardMarkup(printer);

    if (printer.disabled) {
      card.classList.add('printer-card-disabled');
      card.disabled = true;
    } else {
      card.addEventListener('click', () => {
        selectPrinter(printer.id, true);
      });
    }

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'printer', printerId: printer.id, brandId: brand.id });
    });

    printerGrid.appendChild(card);
  });

  requestAnimationFrame(() => {
    scrollHomeGalleryToSelected('auto');
  });
}

function bindContextMenu() {
  if (window.__homeCatalogContextMenuBound) return;
  window.__homeCatalogContextMenuBound = true;

  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  const imageInput = document.getElementById(HOME_IMAGE_INPUT_ID);
  const compactBtn = document.getElementById('homeViewCompactBtn');
  const detailedBtn = document.getElementById('homeViewDetailedBtn');
  const prevBtn = document.getElementById('homeGalleryPrevBtn');
  const nextBtn = document.getElementById('homeGalleryNextBtn');
  const viewport = document.getElementById('homeGalleryViewport');
  if (!menu) return;

  if (typeof window.bindFloatingSurfaceAutoDismiss === 'function') {
    window.bindFloatingSurfaceAutoDismiss();
  }

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    void handleHomeContextAction(button.dataset.action);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest(`#${HOME_CONTEXT_MENU_ID}`)) {
      closeHomeCatalogContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHomeCatalogContextMenu();
    }
  });

  if (imageInput) {
    imageInput.addEventListener('change', (event) => {
      void handleHomeImageInputChange(event);
    });
  }

  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      setHomeViewMode('compact');
      requestAnimationFrame(() => scrollHomeGalleryToSelected('auto'));
    });
  }

  if (detailedBtn) {
    detailedBtn.addEventListener('click', () => {
      setHomeViewMode('detailed');
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stepHomeGallery(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stepHomeGallery(1);
    });
  }

  if (viewport) {
    viewport.addEventListener('wheel', (event) => {
      const printerGrid = document.getElementById('printerGrid');
      if (homeViewMode !== 'compact' || !printerGrid) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      printerGrid.scrollBy({
        left: event.deltaY,
        behavior: 'auto'
      });
    }, { passive: false });
  }

  applyHomeViewMode();
}

window.renderBrands = renderBrands;
window.renderPrinters = renderPrinters;
window.bindContextMenu = bindContextMenu;

function filterPrinters() {
  renderPrinters(selectedBrand);
}

async function selectBrand(brandId) {
  const brand = getBrandById(brandId);
  if (!brand) return;

  selectedBrand = brand.id;
  const printerList = getPrinterListByBrand(brand.id);
  const hasCurrentPrinter = printerList.some((printer) => printer.id === selectedPrinter);

  if (!hasCurrentPrinter) {
    const fallbackPrinter = getFirstSelectablePrinter(brand.id);
    if (fallbackPrinter) {
      selectPrinter(fallbackPrinter.id, true);
      return;
    }
  }

  const sidebarBrand = document.getElementById('sidebarBrand');
  if (sidebarBrand) {
    sidebarBrand.textContent = brand.shortName || brand.name;
  }

  saveUserConfig();
  renderBrands();
  renderPrinters(selectedBrand);

  const currentPrinter = selectedPrinter ? getPrinterObj(selectedPrinter) : null;
  if (currentPrinter && typeof window.renderDownloadVersions === 'function') {
    window.renderDownloadVersions(currentPrinter);
  }
  if (typeof window.refreshCalibrationAvailability === 'function') {
    window.refreshCalibrationAvailability();
  }
}

function selectPrinter(printerId, keepVersion = false) {
  Logger.info(`[O202] Select printer, p:${printerId}`);
  if (typeof clearOnlineListUI === 'function') clearOnlineListUI();

  selectedPrinter = printerId;
  const selectedPrinterObj = getPrinterObj(printerId);
  if (!selectedPrinterObj) return;

  const matchedBrand = brands.find((brand) => (printersByBrand[brand.id] || []).some((printer) => printer.id === printerId));
  if (matchedBrand) {
    selectedBrand = matchedBrand.id;
  }

  const supportedVersions = Array.isArray(selectedPrinterObj.supportedVersions) ? selectedPrinterObj.supportedVersions : [];
  if (!keepVersion || (selectedVersion && supportedVersions.length > 0 && !supportedVersions.includes(selectedVersion))) {
    selectedVersion = null;
  }

  const sidebarBrand = document.getElementById('sidebarBrand');
  const sidebarModelName = document.getElementById('sidebarModelName');

  if (sidebarBrand && matchedBrand) {
    sidebarBrand.textContent = matchedBrand.shortName || matchedBrand.name;
  }
  if (sidebarModelName) {
    sidebarModelName.textContent = selectedPrinterObj.shortName || selectedPrinterObj.name;
  }

  updateSidebarVersionBadge(selectedVersion);
  saveUserConfig();
  renderBrands();
  renderPrinters(selectedBrand);
  if (typeof window.renderDownloadVersions === 'function') {
    window.renderDownloadVersions(selectedPrinterObj);
  }
  if (typeof window.refreshCalibrationAvailability === 'function') {
    window.refreshCalibrationAvailability();
  }
}

function generateCustomIdentifier(prefix, seedText) {
  const raw = String(seedText || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = raw && isEnglishIdentifier(raw) ? raw : `${prefix}_${Date.now()}`;
  return `${prefix}_${base}_${Date.now().toString(36)}`.slice(0, 31);
}

function buildHomeContextItems(target) {
  if (!target) return [];

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return [];

    return [
      { action: 'toggle-favorite', label: brand.favorite ? '取消收藏' : '收藏品牌' },
      { action: 'toggle-pin', label: brand.pinned ? '取消置顶' : '置顶品牌' },
      { type: 'separator' },
      { action: 'add-brand', label: '新增品牌' },
      { action: 'add-printer', label: '新增机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名显示名' },
      { action: 'avatar-default', label: '使用字母头像' },
      { action: 'avatar-upload', label: '上传图片' },
      { type: 'separator' },
      { action: 'delete', label: brand.canDelete ? '删除品牌' : '默认品牌不可删除', disabled: !brand.canDelete }
    ];
  }

  const printer = getPrinterObj(target.printerId);
  if (!printer) return [];

  return [
    { action: 'toggle-favorite', label: printer.favorite ? '取消收藏' : '收藏机型' },
    { action: 'toggle-pin', label: printer.pinned ? '取消置顶' : '置顶机型' },
    { type: 'separator' },
    { action: 'add-printer', label: '新增机型' },
    { action: 'copy-printer', label: '复制机型' },
    { type: 'separator' },
    { action: 'rename', label: '重命名显示名' },
    { action: 'avatar-default', label: '使用字母头像' },
    { action: 'avatar-upload', label: '上传图片' },
    { type: 'separator' },
    { action: 'delete', label: printer.canDelete ? '删除机型' : '默认机型不可删除', disabled: !printer.canDelete }
  ];
}

function renderHomeContextMenu(target) {
  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  if (!menu) return;

  const items = buildHomeContextItems(target);
  menu.innerHTML = items.map((item) => {
    if (item.type === 'separator') {
      return '<div class="home-context-separator"></div>';
    }

    const disabledAttr = item.disabled ? 'disabled' : '';
    const disabledClass = item.disabled ? 'home-context-item-disabled' : '';
    return `
      <button type="button" class="param-context-item home-context-item ${disabledClass}" data-action="${escapeHtml(item.action)}" ${disabledAttr}>
        ${escapeHtml(item.label)}
      </button>
    `;
  }).join('');
}

function openHomeCatalogContextMenu(event, target) {
  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  if (!menu) return;

  homeContextTarget = target;
  renderHomeContextMenu(target);
  positionFloatingMenu(menu, event.clientX, event.clientY, { keepVisible: true, minWidth: 188 });
  showFloatingSurface(menu);
}

function closeHomeCatalogContextMenu(options = {}) {
  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  if (!menu) return;
  hideFloatingSurface(menu, options);
}

async function promptRequiredDisplayName(options) {
  while (true) {
    const value = await MKPModal.prompt(options);
    if (value === null) return null;
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    await MKPModal.alert({
      title: '名称不能为空',
      msg: '请输入要显示的名称。',
      type: 'warning'
    });
  }
}

async function persistCatalogWithFeedback() {
  try {
    await persistHomeCatalog();
    return true;
  } catch (error) {
    Logger.error(`[HomeCatalog] 保存失败: ${error.message}`);
    await MKPModal.alert({
      title: '保存失败',
      msg: escapeHtml(error.message || '首页目录保存失败。'),
      type: 'error'
    });
    return false;
  }
}

async function addBrandFlow() {
  const displayName = await promptRequiredDisplayName({
    title: '新增品牌',
    msg: '请输入品牌显示名称。默认品牌不会被覆盖，新品牌会单独保存。',
    placeholder: '例如：Bambu 自定义',
    confirmText: '创建'
  });
  if (!displayName) return;

  const id = generateCustomIdentifier('brand', displayName);
  const newBrand = normalizeBrandEntity({
    id,
    name: displayName,
    shortName: displayName,
    subtitle: '自定义品牌',
    image: '',
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  });

  brands.push(newBrand);
  printersByBrand[id] = [];

  if (await persistCatalogWithFeedback()) {
    selectedBrand = id;
    selectedPrinter = null;
    renderBrands();
    renderPrinters(id);
    saveUserConfig();
  }
}

function createPrinterTemplate(brandId) {
  const currentInBrand = getPrinterListByBrand(brandId).find((printer) => printer.id === selectedPrinter);
  const source = currentInBrand || getFirstSelectablePrinter(brandId);

  if (source) {
    return normalizePrinterEntity({
      ...cloneValue(source),
      favorite: false,
      pinned: false,
      disabled: false,
      image: '',
      custom: true,
      canDelete: true
    }, brandId, source);
  }

  return normalizePrinterEntity({
    id: '',
    brandId,
    name: '',
    shortName: '',
    image: '',
    favorite: false,
    pinned: false,
    disabled: false,
    custom: true,
    canDelete: true,
    supportedVersions: ['standard'],
    defaultPresets: {}
  }, brandId);
}

async function addPrinterFlow(brandId) {
  const brand = getBrandById(brandId);
  if (!brand) return;

  const displayName = await promptRequiredDisplayName({
    title: '新增机型',
    msg: `将在“${escapeHtml(brand.name)}”下创建一个新机型，请先填写显示名称。`,
    placeholder: '例如：A1 Pro',
    confirmText: '创建'
  });
  if (!displayName) return;

  const template = createPrinterTemplate(brandId);
  const newPrinter = normalizePrinterEntity({
    ...template,
    id: generateCustomIdentifier(brandId, displayName),
    brandId,
    shortName: displayName,
    name: composePrinterName(brandId, displayName),
    image: '',
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  }, brandId, template);

  getPrinterListByBrand(brandId).push(newPrinter);

  if (await persistCatalogWithFeedback()) {
    selectedBrand = brandId;
    selectPrinter(newPrinter.id, true);
  }
}

async function copyPrinterFlow(printerId) {
  const location = findPrinterLocation(printerId);
  if (!location) return;

  const displayName = await promptRequiredDisplayName({
    title: '复制机型',
    msg: `正在复制“${escapeHtml(location.printer.shortName || location.printer.name)}”，请先输入新的显示名称。`,
    placeholder: '例如：A1 我的版本',
    confirmText: '复制'
  });
  if (!displayName) return;

  const cloned = normalizePrinterEntity({
    ...cloneValue(location.printer),
    id: generateCustomIdentifier(location.brandId, displayName),
    brandId: location.brandId,
    shortName: displayName,
    name: composePrinterName(location.brandId, displayName),
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  }, location.brandId, location.printer);

  getPrinterListByBrand(location.brandId).push(cloned);

  if (await persistCatalogWithFeedback()) {
    selectedBrand = location.brandId;
    selectPrinter(cloned.id, true);
  }
}

async function renameTargetFlow(target) {
  if (!target) return;

  const isBrand = target.type === 'brand';
  const item = isBrand ? getBrandById(target.brandId) : getPrinterObj(target.printerId);
  if (!item) return;

  const originalName = isBrand
    ? (item.name || item.shortName)
    : (item.shortName || item.name);

  const displayName = await promptRequiredDisplayName({
    title: isBrand ? '重命名品牌' : '重命名机型',
    msg: `原名称：${escapeHtml(originalName)}<br>只会修改显示名称，不会改内部英文 ID 和文件名。`,
    value: originalName,
    placeholder: '请输入新的显示名称',
    confirmText: '保存'
  });
  if (!displayName) return;

  if (isBrand) {
    item.name = displayName;
    item.shortName = displayName;
  } else {
    item.shortName = displayName;
    item.name = composePrinterName(item.brandId, displayName);
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
    if (!isBrand && item.id === selectedPrinter) {
      selectPrinter(item.id, true);
    } else {
      saveUserConfig();
    }
  }
}

async function deleteTargetFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand || !brand.canDelete) return;

    const confirmed = await MKPModal.confirm({
      title: '删除品牌',
      msg: `确定删除“${escapeHtml(brand.name)}”以及该品牌下的全部自定义机型吗？此操作不会影响默认品牌。`,
      type: 'warning',
      confirmText: '删除'
    });
    if (!confirmed) return;

    const brandIndex = brands.findIndex((item) => item.id === brand.id);
    if (brandIndex >= 0) {
      brands.splice(brandIndex, 1);
    }
    delete printersByBrand[brand.id];

    if (await persistCatalogWithFeedback()) {
      const fallbackBrand = getFirstAvailableBrand();
      selectedBrand = fallbackBrand?.id || null;
      selectedPrinter = selectedBrand ? getFirstSelectablePrinter(selectedBrand)?.id || null : null;
      renderBrands();
      renderPrinters(selectedBrand);
      if (selectedPrinter) {
        selectPrinter(selectedPrinter, true);
      } else {
        saveUserConfig();
      }
    }
    return;
  }

  const location = findPrinterLocation(target.printerId);
  if (!location || !location.printer.canDelete) return;

  const confirmed = await MKPModal.confirm({
    title: '删除机型',
    msg: `确定删除“${escapeHtml(location.printer.shortName || location.printer.name)}”吗？默认机型不会被删除。`,
    type: 'warning',
    confirmText: '删除'
  });
  if (!confirmed) return;

  const printerList = getPrinterListByBrand(location.brandId);
  const printerIndex = printerList.findIndex((item) => item.id === location.printer.id);
  if (printerIndex >= 0) {
    printerList.splice(printerIndex, 1);
  }

  if (await persistCatalogWithFeedback()) {
    if (selectedPrinter === location.printer.id) {
      const fallbackPrinter = getFirstSelectablePrinter(location.brandId);
      if (fallbackPrinter) {
        selectPrinter(fallbackPrinter.id, true);
      } else {
        selectedPrinter = null;
        selectedBrand = location.brandId;
        renderBrands();
        renderPrinters(location.brandId);
        saveUserConfig();
      }
    } else {
      renderBrands();
      renderPrinters(selectedBrand);
      saveUserConfig();
    }
  }
}

async function toggleFavoriteFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    brand.favorite = !brand.favorite;
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    printer.favorite = !printer.favorite;
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
  }
}

async function togglePinFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    brand.pinned = !brand.pinned;
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    printer.pinned = !printer.pinned;
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
  }
}

async function useGeneratedAvatarFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    brand.image = '';
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    printer.image = '';
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
  }
}

function pickImageUploadForTarget(target) {
  const input = document.getElementById(HOME_IMAGE_INPUT_ID);
  if (!input || !target) return;
  pendingImageTarget = target;
  input.value = '';
  input.click();
}

async function handleHomeImageInputChange(event) {
  const file = event.target?.files?.[0];
  const target = pendingImageTarget;
  pendingImageTarget = null;
  if (!file || !target) return;

  if (!window.mkpAPI?.importHomeCatalogImage) {
    await MKPModal.alert({
      title: '当前环境不支持',
      msg: '当前环境不支持导入首页图片。',
      type: 'error'
    });
    return;
  }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

    const itemId = target.type === 'brand' ? target.brandId : target.printerId;
    const result = await window.mkpAPI.importHomeCatalogImage({
      itemType: target.type,
      itemId,
      dataUrl
    });

    if (!result?.success || !result.path) {
      throw new Error(result?.error || '图片导入失败');
    }

    if (target.type === 'brand') {
      const brand = getBrandById(target.brandId);
      if (!brand) return;
      brand.image = result.path;
    } else {
      const printer = getPrinterObj(target.printerId);
      if (!printer) return;
      printer.image = result.path;
    }

    if (await persistCatalogWithFeedback()) {
      renderBrands();
      renderPrinters(selectedBrand);
    }
  } catch (error) {
    Logger.error(`[HomeCatalog] 图片导入失败: ${error.message}`);
    await MKPModal.alert({
      title: '图片导入失败',
      msg: escapeHtml(error.message || '图片处理失败。'),
      type: 'error'
    });
  } finally {
    event.target.value = '';
  }
}

async function handleHomeContextAction(action) {
  const target = homeContextTarget;
  closeHomeCatalogContextMenu();

  switch (action) {
    case 'toggle-favorite':
      await toggleFavoriteFlow(target);
      break;
    case 'toggle-pin':
      await togglePinFlow(target);
      break;
    case 'add-brand':
      await addBrandFlow();
      break;
    case 'add-printer':
      await addPrinterFlow(target?.brandId || selectedBrand);
      break;
    case 'copy-printer':
      if (target?.printerId) {
        await copyPrinterFlow(target.printerId);
      }
      break;
    case 'rename':
      await renameTargetFlow(target);
      break;
    case 'avatar-default':
      await useGeneratedAvatarFlow(target);
      break;
    case 'avatar-upload':
      pickImageUploadForTarget(target);
      break;
    case 'delete':
      await deleteTargetFlow(target);
      break;
    default:
      break;
  }
}

function bindContextMenu() {
  if (window.__homeCatalogContextMenuBound) return;
  window.__homeCatalogContextMenuBound = true;

  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  const imageInput = document.getElementById(HOME_IMAGE_INPUT_ID);
  if (!menu) return;

  if (typeof window.bindFloatingSurfaceAutoDismiss === 'function') {
    window.bindFloatingSurfaceAutoDismiss();
  }

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    void handleHomeContextAction(button.dataset.action);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest(`#${HOME_CONTEXT_MENU_ID}`)) {
      closeHomeCatalogContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHomeCatalogContextMenu();
    }
  });

  if (imageInput) {
    imageInput.addEventListener('change', (event) => {
      void handleHomeImageInputChange(event);
    });
  }
}

async function restoreOriginalImageFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    const originalImage = getEntityOriginalImage(brand, 'brand');
    if (!originalImage) return;
    brand.image = originalImage;
    brand.avatarMode = 'original';
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    const originalImage = getEntityOriginalImage(printer, 'printer');
    if (!originalImage) return;
    printer.image = originalImage;
    printer.avatarMode = 'original';
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
  }
}

async function setLabelModeFlow(target, mode) {
  if (!target) return;
  const nextMode = mode === 'full' ? 'full' : 'short';

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    brand.labelMode = nextMode;
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    printer.labelMode = nextMode;
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
    if (selectedPrinter && typeof selectPrinter === 'function' && target.type === 'printer' && target.printerId === selectedPrinter) {
      selectPrinter(selectedPrinter, true);
    }
  }
}

function buildHomeContextItems(target) {
  if (!target) return [];

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return [];

    return [
      { action: 'toggle-favorite', label: brand.favorite ? '取消收藏' : '收藏品牌' },
      { action: 'toggle-pin', label: brand.pinned ? '取消置顶' : '置顶品牌' },
      { type: 'separator' },
      { action: 'display-short', label: brand.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: brand.labelMode === 'short' },
      { action: 'display-full', label: brand.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: brand.labelMode === 'full' },
      { type: 'separator' },
      { action: 'add-brand', label: '新增品牌' },
      { action: 'add-printer', label: '新增机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名显示名' },
      { action: 'avatar-default', label: '使用字母头像' },
      { action: 'restore-original-image', label: canRestoreOriginalImage(brand, 'brand') ? '恢复原本图片' : '没有原本图片', disabled: !canRestoreOriginalImage(brand, 'brand') || brand.avatarMode !== 'generated' },
      { action: 'avatar-upload', label: '上传图片' },
      { type: 'separator' },
      { action: 'delete', label: brand.canDelete ? '删除品牌' : '默认品牌不可删除', disabled: !brand.canDelete }
    ];
  }

  const printer = getPrinterObj(target.printerId);
  if (!printer) return [];

  return [
    { action: 'toggle-favorite', label: printer.favorite ? '取消收藏' : '收藏机型' },
    { action: 'toggle-pin', label: printer.pinned ? '取消置顶' : '置顶机型' },
    { type: 'separator' },
    { action: 'display-short', label: printer.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: printer.labelMode === 'short' },
    { action: 'display-full', label: printer.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: printer.labelMode === 'full' },
    { type: 'separator' },
    { action: 'add-printer', label: '新增机型' },
    { action: 'copy-printer', label: '复制机型' },
    { type: 'separator' },
    { action: 'rename', label: '重命名显示名' },
    { action: 'avatar-default', label: '使用字母头像' },
    { action: 'restore-original-image', label: canRestoreOriginalImage(printer, 'printer') ? '恢复原本图片' : '没有原本图片', disabled: !canRestoreOriginalImage(printer, 'printer') || printer.avatarMode !== 'generated' },
    { action: 'avatar-upload', label: '上传图片' },
    { type: 'separator' },
    { action: 'delete', label: printer.canDelete ? '删除机型' : '默认机型不可删除', disabled: !printer.canDelete }
  ];
}

async function useGeneratedAvatarFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return;
    brand.avatarMode = 'generated';
  } else {
    const printer = getPrinterObj(target.printerId);
    if (!printer) return;
    printer.avatarMode = 'generated';
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
  }
}

async function handleHomeImageInputChange(event) {
  const file = event.target?.files?.[0];
  const target = pendingImageTarget;
  pendingImageTarget = null;
  if (!file || !target) return;

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

    const itemId = target.type === 'brand' ? target.brandId : target.printerId;
    const result = await window.mkpAPI.importHomeCatalogImage({
      itemType: target.type,
      itemId,
      dataUrl
    });

    if (!result?.success || !result.path) {
      throw new Error(result?.error || '图片导入失败');
    }

    if (target.type === 'brand') {
      const brand = getBrandById(target.brandId);
      if (!brand) return;
      brand.image = result.path;
      if (!brand.originalImage) {
        brand.originalImage = getEntityOriginalImage(brand, 'brand');
      }
      brand.avatarMode = 'custom';
    } else {
      const printer = getPrinterObj(target.printerId);
      if (!printer) return;
      printer.image = result.path;
      if (!printer.originalImage) {
        printer.originalImage = getEntityOriginalImage(printer, 'printer');
      }
      printer.avatarMode = 'custom';
    }

    if (await persistCatalogWithFeedback()) {
      renderBrands();
      renderPrinters(selectedBrand);
    }
  } catch (error) {
    Logger.error(`[HomeCatalog] 图片导入失败: ${error.message}`);
    await MKPModal.alert({
      title: '图片导入失败',
      msg: escapeHtml(error.message || '图片处理失败。'),
      type: 'error'
    });
  } finally {
    event.target.value = '';
  }
}

async function handleHomeContextAction(action) {
  const target = homeContextTarget;
  closeHomeCatalogContextMenu();

  switch (action) {
    case 'toggle-favorite':
      await toggleFavoriteFlow(target);
      break;
    case 'toggle-pin':
      await togglePinFlow(target);
      break;
    case 'display-short':
      await setLabelModeFlow(target, 'short');
      break;
    case 'display-full':
      await setLabelModeFlow(target, 'full');
      break;
    case 'add-brand':
      await addBrandFlow();
      break;
    case 'add-printer':
      await addPrinterFlow(target?.brandId || selectedBrand);
      break;
    case 'copy-printer':
      if (target?.printerId) {
        await copyPrinterFlow(target.printerId);
      }
      break;
    case 'rename':
      await renameTargetFlow(target);
      break;
    case 'avatar-default':
      await useGeneratedAvatarFlow(target);
      break;
    case 'restore-original-image':
      await restoreOriginalImageFlow(target);
      break;
    case 'avatar-upload':
      pickImageUploadForTarget(target);
      break;
    case 'delete':
      await deleteTargetFlow(target);
      break;
    default:
      break;
  }
}

function updateHomeHeader(brandId = selectedBrand) {
  const brand = getBrandById(brandId);
  const title = document.getElementById('currentBrandTitle');
  if (!title) return;

  if (!brand) {
    title.textContent = '未选择品牌';
    return;
  }

  title.textContent = `${brand.name || brand.shortName} · ${getPrinterListByBrand(brand.id).length} 个机型`;
}

function renderBrands() {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const brandList = document.getElementById('brandList');
  if (!brandList) return;

  brandList.innerHTML = sortCatalogItems(brands).map((brand) => {
    const secondaryName = getEntitySecondaryName(brand) || brand.subtitle || '';
    return `
      <button type="button" class="brand-card home-brand-card home-brand-row w-full rounded-2xl border px-3 py-3 text-left ${brand.id === selectedBrand ? 'active border-gray-200 dark:border-[#3a3a3a]' : 'border-gray-200/80 dark:border-[#333333]'}" data-brand-id="${escapeHtml(brand.id)}">
        <span class="block min-w-0">
          <span class="block truncate font-medium text-gray-900 dark:text-gray-100">${escapeHtml(getEntityPrimaryName(brand))}</span>
          ${secondaryName ? `<span class="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">${escapeHtml(secondaryName)}</span>` : ''}
          <span class="mt-2 flex flex-wrap gap-1">${getMetaBadgeMarkup(brand)}</span>
        </span>
      </button>
    `;
  }).join('');

  brandList.querySelectorAll('[data-brand-id]').forEach((card) => {
    card.addEventListener('click', () => {
      void selectBrand(card.dataset.brandId);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'brand', brandId: card.dataset.brandId });
    });
  });

  updateHomeHeader(selectedBrand);
  requestBrandPrefixVisibilitySync();
}

function buildPrinterCardMarkup(printer) {
  const title = getEntityPrimaryName(printer);
  const secondary = homeViewMode === 'detailed' ? getEntitySecondaryName(printer) : '';

  return `
    <div class="home-printer-media">
      <span class="home-printer-avatar-shell">
        <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
      </span>
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(title)}</div>
          ${secondary && secondary !== title ? `<div class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(secondary)}</div>` : ''}
        </div>
        ${printer.disabled ? '<div class="home-printer-status">暂不可用</div>' : ''}
      </div>
      <div class="mt-3 flex flex-wrap gap-1">${getVersionTagMarkup(printer)}</div>
      <div class="mt-3 flex flex-wrap gap-1">${getMetaBadgeMarkup(printer)}</div>
    </div>
  `;
}

function renderPrinters(brandId = selectedBrand) {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const printerGrid = document.getElementById('printerGrid');
  if (!printerGrid) return;

  const brand = getBrandById(brandId);
  if (!brand) {
    printerGrid.innerHTML = '<div class="col-span-3 home-empty-state">没有可显示的机型</div>';
    return;
  }

  const searchValue = (document.getElementById('printerSearch')?.value || '').trim().toLowerCase();
  const filteredPrinters = sortCatalogItems(getPrinterListByBrand(brand.id)).filter((printer) => {
    if (!searchValue) return true;
    return [printer.id, printer.name, printer.shortName, brand.name, brand.shortName].join(' ').toLowerCase().includes(searchValue);
  });

  printerGrid.className = `grid ${homeViewMode === 'compact' ? 'grid-cols-3 gap-5' : 'grid-cols-3 gap-4'} pb-2`;
  printerGrid.innerHTML = filteredPrinters.length
    ? ''
    : '<div class="col-span-3 home-empty-state"><div class="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div><div class="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者右键品牌新增机型。</div></div>';

  filteredPrinters.forEach((printer) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card home-printer-card home-printer-card-${homeViewMode} rounded-2xl border p-4 text-left ${printer.id === selectedPrinter ? 'selected' : 'border-gray-200 dark:border-[#333333]'}`;
    card.dataset.printerId = printer.id;
    card.innerHTML = buildPrinterCardMarkup(printer);

    if (printer.disabled) {
      card.classList.add('printer-card-disabled');
      card.disabled = true;
    } else {
      card.addEventListener('click', () => {
        selectPrinter(printer.id, true);
      });
    }

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'printer', printerId: printer.id, brandId: brand.id });
    });

    printerGrid.appendChild(card);
  });
}

function bindContextMenu() {
  if (window.__homeCatalogContextMenuBound) return;
  window.__homeCatalogContextMenuBound = true;

  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  const imageInput = document.getElementById(HOME_IMAGE_INPUT_ID);
  const compactBtn = document.getElementById('homeViewCompactBtn');
  const detailedBtn = document.getElementById('homeViewDetailedBtn');
  if (!menu) return;

  if (typeof window.bindFloatingSurfaceAutoDismiss === 'function') {
    window.bindFloatingSurfaceAutoDismiss();
  }

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    void handleHomeContextAction(button.dataset.action);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest(`#${HOME_CONTEXT_MENU_ID}`)) {
      closeHomeCatalogContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHomeCatalogContextMenu();
    }
  });

  if (imageInput) {
    imageInput.addEventListener('change', (event) => {
      void handleHomeImageInputChange(event);
    });
  }

  if (compactBtn) {
    compactBtn.addEventListener('click', () => setHomeViewMode('compact'));
  }
  if (detailedBtn) {
    detailedBtn.addEventListener('click', () => setHomeViewMode('detailed'));
  }

  applyHomeViewMode();
}

window.ensureHomeCatalogReady = ensureHomeCatalogReady;
window.toggleSidebar = toggleSidebar;
window.updateSidebarVersionBadge = updateSidebarVersionBadge;
window.renderBrands = renderBrands;
window.renderPrinters = renderPrinters;
window.filterPrinters = filterPrinters;
window.selectBrand = selectBrand;
window.selectPrinter = selectPrinter;
window.bindContextMenu = bindContextMenu;

function getRestoreOriginalImageMenuState(entity, itemType) {
  if (!canRestoreOriginalImage(entity, itemType)) {
    return {
      label: '没有原本图片',
      disabled: true
    };
  }

  if (entity?.avatarMode === 'original') {
    return {
      label: '当前已使用原本图片',
      disabled: true
    };
  }

  return {
    label: '恢复原本图片',
    disabled: false
  };
}

function getVersionTagMarkup(printer) {
  const versions = Array.isArray(printer.supportedVersions) ? printer.supportedVersions : [];
  if (versions.length === 0) {
    return '<span class="home-version-badge home-version-badge-muted">未配置版本</span>';
  }

  return versions.map((versionType) => {
    const theme = VERSION_THEMES[versionType];
    const label = theme?.title || versionType;
    const style = theme
      ? `style="background:${escapeHtml(theme.bg)};color:${escapeHtml(theme.text)}"`
      : '';
    return `<span class="home-version-badge" ${style}>${escapeHtml(label)}</span>`;
  }).join('');
}

function getMetaBadgeMarkup(item) {
  const badges = [];
  if (item.pinned) badges.push('<span class="home-meta-badge">置顶</span>');
  if (item.favorite) badges.push('<span class="home-meta-badge">收藏</span>');
  if (item.custom) badges.push('<span class="home-meta-badge home-meta-badge-soft">自定义</span>');
  return badges.join('');
}

async function promptRequiredDisplayName(options) {
  while (true) {
    const value = await MKPModal.prompt(options);
    if (value === null) return null;
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    await MKPModal.alert({
      title: '名称不能为空',
      msg: '请输入要显示的名称。',
      type: 'warning'
    });
  }
}

async function persistCatalogWithFeedback() {
  try {
    await persistHomeCatalog();
    return true;
  } catch (error) {
    Logger.error(`[HomeCatalog] 保存失败: ${error.message}`);
    await MKPModal.alert({
      title: '保存失败',
      msg: escapeHtml(error.message || '首页目录保存失败。'),
      type: 'error'
    });
    return false;
  }
}

async function addBrandFlow() {
  const displayName = await promptRequiredDisplayName({
    title: '新增品牌',
    msg: '请输入品牌显示名称。默认品牌不会被覆盖，新品牌会单独保存。',
    placeholder: '例如：Bambu 自定义',
    confirmText: '创建'
  });
  if (!displayName) return;

  const id = generateCustomIdentifier('brand', displayName);
  const newBrand = normalizeBrandEntity({
    id,
    name: displayName,
    shortName: displayName,
    subtitle: '自定义品牌',
    image: '',
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  });

  brands.push(newBrand);
  printersByBrand[id] = [];

  if (await persistCatalogWithFeedback()) {
    selectedBrand = id;
    selectedPrinter = null;
    renderBrands();
    renderPrinters(id);
    saveUserConfig();
  }
}

async function addPrinterFlow(brandId) {
  const brand = getBrandById(brandId);
  if (!brand) return;

  const displayName = await promptRequiredDisplayName({
    title: '新增机型',
    msg: `将在“${escapeHtml(brand.name || brand.shortName)}”下创建一个新机型，请先填写显示名称。`,
    placeholder: '例如：A1 Pro',
    confirmText: '创建'
  });
  if (!displayName) return;

  const template = createPrinterTemplate(brandId);
  const newPrinter = normalizePrinterEntity({
    ...template,
    id: generateCustomIdentifier(brandId, displayName),
    brandId,
    shortName: displayName,
    name: composePrinterName(brandId, displayName),
    image: '',
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  }, brandId, template);

  getPrinterListByBrand(brandId).push(newPrinter);

  if (await persistCatalogWithFeedback()) {
    selectedBrand = brandId;
    selectPrinter(newPrinter.id, true);
  }
}

async function copyPrinterFlow(printerId) {
  const location = findPrinterLocation(printerId);
  if (!location) return;

  const displayName = await promptRequiredDisplayName({
    title: '复制机型',
    msg: `正在复制“${escapeHtml(location.printer.shortName || location.printer.name)}”，请先输入新的显示名称。`,
    placeholder: '例如：A1 我的版本',
    confirmText: '复制'
  });
  if (!displayName) return;

  const cloned = normalizePrinterEntity({
    ...cloneValue(location.printer),
    id: generateCustomIdentifier(location.brandId, displayName),
    brandId: location.brandId,
    shortName: displayName,
    name: composePrinterName(location.brandId, displayName),
    favorite: false,
    pinned: true,
    custom: true,
    canDelete: true
  }, location.brandId, location.printer);

  getPrinterListByBrand(location.brandId).push(cloned);

  if (await persistCatalogWithFeedback()) {
    selectedBrand = location.brandId;
    selectPrinter(cloned.id, true);
  }
}

async function renameTargetFlow(target) {
  if (!target) return;

  const isBrand = target.type === 'brand';
  const item = isBrand ? getBrandById(target.brandId) : getPrinterObj(target.printerId);
  if (!item) return;

  const originalName = isBrand
    ? (item.name || item.shortName)
    : (item.shortName || item.name);

  const displayName = await promptRequiredDisplayName({
    title: isBrand ? '重命名品牌' : '重命名机型',
    msg: `原名称：${escapeHtml(originalName)}<br>这里只会修改显示名称，不会改内部英文 ID 和文件名。`,
    value: originalName,
    placeholder: '请输入新的显示名称',
    confirmText: '保存'
  });
  if (!displayName) return;

  if (isBrand) {
    item.name = displayName;
    item.shortName = displayName;
  } else {
    item.shortName = displayName;
    item.name = composePrinterName(item.brandId, displayName);
  }

  if (await persistCatalogWithFeedback()) {
    renderBrands();
    renderPrinters(selectedBrand);
    if (!isBrand && item.id === selectedPrinter) {
      selectPrinter(item.id, true);
    } else {
      saveUserConfig();
    }
  }
}

async function deleteTargetFlow(target) {
  if (!target) return;

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand || !brand.canDelete) return;

    const confirmed = await MKPModal.confirm({
      title: '删除品牌',
      msg: `确定删除“${escapeHtml(brand.name || brand.shortName)}”以及该品牌下的全部自定义机型吗？此操作不会影响默认品牌。`,
      type: 'warning',
      confirmText: '删除'
    });
    if (!confirmed) return;

    const brandIndex = brands.findIndex((item) => item.id === brand.id);
    if (brandIndex >= 0) {
      brands.splice(brandIndex, 1);
    }
    delete printersByBrand[brand.id];

    if (await persistCatalogWithFeedback()) {
      const fallbackBrand = getFirstAvailableBrand();
      selectedBrand = fallbackBrand?.id || null;
      selectedPrinter = selectedBrand ? getFirstSelectablePrinter(selectedBrand)?.id || null : null;
      renderBrands();
      renderPrinters(selectedBrand);
      if (selectedPrinter) {
        selectPrinter(selectedPrinter, true);
      } else {
        saveUserConfig();
      }
    }
    return;
  }

  const location = findPrinterLocation(target.printerId);
  if (!location || !location.printer.canDelete) return;

  const confirmed = await MKPModal.confirm({
    title: '删除机型',
    msg: `确定删除“${escapeHtml(location.printer.shortName || location.printer.name)}”吗？默认机型不会被删除。`,
    type: 'warning',
    confirmText: '删除'
  });
  if (!confirmed) return;

  const printerList = getPrinterListByBrand(location.brandId);
  const printerIndex = printerList.findIndex((item) => item.id === location.printer.id);
  if (printerIndex >= 0) {
    printerList.splice(printerIndex, 1);
  }

  if (await persistCatalogWithFeedback()) {
    if (selectedPrinter === location.printer.id) {
      const fallbackPrinter = getFirstSelectablePrinter(location.brandId);
      if (fallbackPrinter) {
        selectPrinter(fallbackPrinter.id, true);
      } else {
        selectedPrinter = null;
        selectedBrand = location.brandId;
        renderBrands();
        renderPrinters(location.brandId);
        saveUserConfig();
      }
    } else {
      renderBrands();
      renderPrinters(selectedBrand);
      saveUserConfig();
    }
  }
}

async function handleHomeImageInputChange(event) {
  const file = event.target?.files?.[0];
  const target = pendingImageTarget;
  pendingImageTarget = null;
  if (!file || !target) return;

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

    const itemId = target.type === 'brand' ? target.brandId : target.printerId;
    const result = await window.mkpAPI.importHomeCatalogImage({
      itemType: target.type,
      itemId,
      dataUrl
    });

    if (!result?.success || !result.path) {
      throw new Error(result?.error || '图片导入失败');
    }

    if (target.type === 'brand') {
      const brand = getBrandById(target.brandId);
      if (!brand) return;
      brand.image = result.path;
      if (!brand.originalImage) {
        brand.originalImage = getEntityOriginalImage(brand, 'brand');
      }
      brand.avatarMode = 'custom';
    } else {
      const printer = getPrinterObj(target.printerId);
      if (!printer) return;
      printer.image = result.path;
      if (!printer.originalImage) {
        printer.originalImage = getEntityOriginalImage(printer, 'printer');
      }
      printer.avatarMode = 'custom';
    }

    if (await persistCatalogWithFeedback()) {
      renderBrands();
      renderPrinters(selectedBrand);
    }
  } catch (error) {
    Logger.error(`[HomeCatalog] 图片导入失败: ${error.message}`);
    await MKPModal.alert({
      title: '图片导入失败',
      msg: escapeHtml(error.message || '图片处理失败。'),
      type: 'error'
    });
  } finally {
    event.target.value = '';
  }
}

function buildHomeContextItems(target) {
  if (!target) return [];

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return [];
    const restoreItem = getRestoreOriginalImageMenuState(brand, 'brand');

    return [
      { action: 'toggle-favorite', label: brand.favorite ? '取消收藏' : '收藏品牌' },
      { action: 'toggle-pin', label: brand.pinned ? '取消置顶' : '置顶品牌' },
      { type: 'separator' },
      { action: 'display-short', label: brand.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: brand.labelMode === 'short' },
      { action: 'display-full', label: brand.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: brand.labelMode === 'full' },
      { type: 'separator' },
      { action: 'add-brand', label: '新增品牌' },
      { action: 'add-printer', label: '新增机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名显示名称' },
      { action: 'avatar-default', label: '使用字母头像' },
      { action: 'restore-original-image', label: restoreItem.label, disabled: restoreItem.disabled },
      { action: 'avatar-upload', label: '上传图片' },
      { type: 'separator' },
      { action: 'delete', label: brand.canDelete ? '删除品牌' : '默认品牌不可删除', disabled: !brand.canDelete }
    ];
  }

  const printer = getPrinterObj(target.printerId);
  if (!printer) return [];
  const restoreItem = getRestoreOriginalImageMenuState(printer, 'printer');

  return [
    { action: 'toggle-favorite', label: printer.favorite ? '取消收藏' : '收藏机型' },
    { action: 'toggle-pin', label: printer.pinned ? '取消置顶' : '置顶机型' },
    { type: 'separator' },
    { action: 'display-short', label: printer.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: printer.labelMode === 'short' },
    { action: 'display-full', label: printer.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: printer.labelMode === 'full' },
    { type: 'separator' },
    { action: 'add-printer', label: '新增机型' },
    { action: 'copy-printer', label: '复制机型' },
    { type: 'separator' },
    { action: 'rename', label: '重命名显示名称' },
    { action: 'avatar-default', label: '使用字母头像' },
    { action: 'restore-original-image', label: restoreItem.label, disabled: restoreItem.disabled },
    { action: 'avatar-upload', label: '上传图片' },
    { type: 'separator' },
    { action: 'delete', label: printer.canDelete ? '删除机型' : '默认机型不可删除', disabled: !printer.canDelete }
  ];
}

function updateHomeHeader(brandId = selectedBrand) {
  const brand = getBrandById(brandId);
  const title = document.getElementById('currentBrandTitle');
  if (!title) return;

  if (!brand) {
    title.textContent = '未选择品牌';
    return;
  }

  const displayName = getEntityPrimaryName(brand) || brand.name || brand.shortName || brand.id;
  const printerCount = getPrinterListByBrand(brand.id).length;
  title.textContent = `${displayName} · ${printerCount} 个机型`;
}

function renderBrands() {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const brandList = document.getElementById('brandList');
  if (!brandList) return;

  brandList.innerHTML = sortCatalogItems(brands).map((brand) => {
    const secondaryName = homeViewMode === 'detailed'
      ? (getEntitySecondaryName(brand) || brand.subtitle || '')
      : '';
    const badgeMarkup = homeViewMode === 'detailed' ? getMetaBadgeMarkup(brand) : '';
    return `
      <button type="button" class="brand-card home-brand-card home-brand-row w-full rounded-2xl border px-3 py-3 text-left ${brand.id === selectedBrand ? 'active border-gray-200 dark:border-[#3a3a3a]' : 'border-gray-200/80 dark:border-[#333333]'}" data-brand-id="${escapeHtml(brand.id)}">
        <span class="block min-w-0 home-brand-copy">
          <span class="block truncate font-medium text-gray-900 dark:text-gray-100 home-brand-primary">${escapeHtml(getEntityPrimaryName(brand))}</span>
          ${secondaryName ? `<span class="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400 home-brand-secondary">${escapeHtml(secondaryName)}</span>` : ''}
          ${badgeMarkup ? `<span class="mt-2 flex flex-wrap gap-1 home-brand-badges">${badgeMarkup}</span>` : ''}
        </span>
      </button>
    `;
  }).join('');

  brandList.querySelectorAll('[data-brand-id]').forEach((card) => {
    card.addEventListener('click', () => {
      void selectBrand(card.dataset.brandId);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'brand', brandId: card.dataset.brandId });
    });
  });

  updateHomeHeader(selectedBrand);
  requestBrandPrefixVisibilitySync();
}

function buildPrinterCardMarkup(printer) {
  const title = getEntityPrimaryName(printer);
  const secondary = homeViewMode === 'detailed' ? getEntitySecondaryName(printer) : '';
  const badgeMarkup = getMetaBadgeMarkup(printer);

  return `
    <div class="home-printer-media">
      <span class="home-printer-avatar-shell">
        <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
      </span>
    </div>
    <div class="min-w-0 flex-1 home-printer-copy">
      <div class="flex items-start justify-between gap-3 home-printer-title-line">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate home-printer-name">${escapeHtml(title)}</div>
          ${secondary && secondary !== title ? `<div class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate home-printer-secondary">${escapeHtml(secondary)}</div>` : ''}
        </div>
        ${printer.disabled ? '<div class="home-printer-status">暂不可用</div>' : ''}
      </div>
      <div class="mt-3 flex flex-wrap gap-1 home-printer-version-row">${getVersionTagMarkup(printer)}</div>
      ${badgeMarkup ? `<div class="mt-3 flex flex-wrap gap-1 home-printer-meta-row">${badgeMarkup}</div>` : ''}
    </div>
  `;
}

function renderPrinters(brandId = selectedBrand) {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const printerGrid = document.getElementById('printerGrid');
  if (!printerGrid) return;

  const brand = getBrandById(brandId);
  if (!brand) {
    printerGrid.innerHTML = '<div class="col-span-3 home-empty-state">没有可显示的机型</div>';
    return;
  }

  const searchValue = (document.getElementById('printerSearch')?.value || '').trim().toLowerCase();
  const filteredPrinters = sortCatalogItems(getPrinterListByBrand(brand.id)).filter((printer) => {
    if (!searchValue) return true;
    return [printer.id, printer.name, printer.shortName, brand.name, brand.shortName].join(' ').toLowerCase().includes(searchValue);
  });

  printerGrid.className = `grid ${homeViewMode === 'compact' ? 'grid-cols-3 gap-5' : 'grid-cols-3 gap-4'} pb-2 home-printer-grid home-printer-grid-${homeViewMode}`;
  printerGrid.innerHTML = filteredPrinters.length
    ? ''
    : '<div class="col-span-3 home-empty-state"><div class="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div><div class="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者右键品牌新增机型。</div></div>';

  filteredPrinters.forEach((printer) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card home-printer-card home-printer-card-${homeViewMode} rounded-2xl border p-4 text-left ${printer.id === selectedPrinter ? 'selected' : 'border-gray-200 dark:border-[#333333]'}`;
    card.dataset.printerId = printer.id;
    card.innerHTML = buildPrinterCardMarkup(printer);

    if (printer.disabled) {
      card.classList.add('printer-card-disabled');
      card.disabled = true;
    } else {
      card.addEventListener('click', () => {
        selectPrinter(printer.id, true);
      });
    }

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'printer', printerId: printer.id, brandId: brand.id });
    });

    printerGrid.appendChild(card);
  });
}
