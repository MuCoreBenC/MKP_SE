import { brands, printersByBrand } from './data.js';

export const DEFAULT_HOME_CATALOG = {
  brands,
  printersByBrand,
};

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

export function toCatalogFileUrl(filePath) {
  if (!filePath) return '';
  if (/^(data:|https?:|assets\/|file:\/\/\/)/i.test(filePath)) return filePath;
  if (/^[a-zA-Z]:\\/.test(filePath)) {
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
  return filePath;
}

export function createLetterAvatarDataUri(text, seed = '') {
  const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];
  const key = `${seed}_${text}`;
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }

  const background = palette[Math.abs(hash) % palette.length];
  const label = String(text || '?').trim().replace(/\s+/g, ' ').slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill="${background}"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, Arial, sans-serif" font-size="180" font-weight="700" fill="#ffffff">${escapeHtml(label)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function normalizeBrandEntity(brand, fallback = {}) {
  const base = {
    ...(fallback && typeof fallback === 'object' ? cloneValue(fallback) : {}),
    ...(brand && typeof brand === 'object' ? cloneValue(brand) : {}),
  };

  return {
    ...base,
    id: String(base.id || '').trim(),
    name: String(base.name || '').trim(),
    shortName: String(base.shortName || base.name || '').trim(),
    subtitle: String(base.subtitle || '').trim(),
    favorite: !!base.favorite,
    pinned: !!base.pinned,
    image: toCatalogFileUrl(String(base.image || '').trim()),
    originalImage: toCatalogFileUrl(String(base.originalImage || base.image || '').trim()),
    avatarMode: String(base.avatarMode || (base.image ? 'original' : 'generated')).trim(),
    labelMode: base.labelMode === 'full' ? 'full' : 'short',
    custom: !!base.custom,
    canDelete: !!(base.canDelete ?? base.custom),
  };
}

export function normalizePrinterEntity(printer, brandId, fallback = {}) {
  const base = {
    ...(fallback && typeof fallback === 'object' ? cloneValue(fallback) : {}),
    ...(printer && typeof printer === 'object' ? cloneValue(printer) : {}),
  };

  const fallbackVersions = Array.isArray(fallback.supportedVersions)
    ? [...fallback.supportedVersions]
    : [];
  const baseVersions = Array.isArray(base.supportedVersions)
    ? [...base.supportedVersions]
    : fallbackVersions;
  const fallbackPresets =
    fallback.defaultPresets && typeof fallback.defaultPresets === 'object'
      ? { ...fallback.defaultPresets }
      : {};
  const basePresets =
    base.defaultPresets && typeof base.defaultPresets === 'object'
      ? { ...base.defaultPresets }
      : fallbackPresets;

  return {
    ...base,
    id: String(base.id || '').trim(),
    brandId: String(brandId || base.brandId || '').trim(),
    name: String(base.name || '').trim(),
    shortName: String(base.shortName || base.name || '').trim(),
    image: toCatalogFileUrl(String(base.image || '').trim()),
    originalImage: toCatalogFileUrl(String(base.originalImage || base.image || '').trim()),
    avatarMode: String(base.avatarMode || (base.image ? 'original' : 'generated')).trim(),
    labelMode: base.labelMode === 'full' ? 'full' : 'short',
    favorite: !!base.favorite,
    pinned: !!base.pinned,
    disabled: !!base.disabled,
    custom: !!base.custom,
    canDelete: !!(base.canDelete ?? base.custom),
    supportedVersions: baseVersions,
    defaultPresets: basePresets,
  };
}

export function sortCatalogItems(items) {
  return [...items].sort((left, right) => {
    if (!!left.pinned !== !!right.pinned) return left.pinned ? -1 : 1;
    if (!!left.favorite !== !!right.favorite) return left.favorite ? -1 : 1;

    return String(left.name || left.shortName || '').localeCompare(
      String(right.name || right.shortName || ''),
      'zh-CN',
      { numeric: true, sensitivity: 'base' },
    );
  });
}

export function buildMergedHomeCatalog(savedCatalog) {
  const baseBrands = DEFAULT_HOME_CATALOG.brands.map((brand) =>
    normalizeBrandEntity({
      ...cloneValue(brand),
      pinned: false,
      custom: false,
      canDelete: false,
    }),
  );

  const basePrinters = {};
  Object.entries(DEFAULT_HOME_CATALOG.printersByBrand).forEach(([brandId, printerList]) => {
    basePrinters[brandId] = printerList.map((printer) =>
      normalizePrinterEntity(
        {
          ...cloneValue(printer),
          brandId,
          pinned: false,
          custom: false,
          canDelete: false,
        },
        brandId,
      ),
    );
  });

  if (!savedCatalog || typeof savedCatalog !== 'object') {
    return {
      brands: baseBrands,
      printersByBrand: basePrinters,
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

  const savedPrintersByBrand =
    savedCatalog.printersByBrand && typeof savedCatalog.printersByBrand === 'object'
      ? savedCatalog.printersByBrand
      : {};

  const mergedPrinters = {};
  const allBrandIds = new Set([
    ...Object.keys(basePrinters),
    ...Object.keys(savedPrintersByBrand),
    ...mergedBrands.map((brand) => brand.id),
  ]);

  allBrandIds.forEach((brandId) => {
    const baseList = Array.isArray(basePrinters[brandId]) ? basePrinters[brandId] : [];
    const savedList = Array.isArray(savedPrintersByBrand[brandId])
      ? savedPrintersByBrand[brandId]
      : [];
    const savedMap = new Map(savedList.map((item) => [item.id, item]));

    const mergedList = baseList.map((printer) => {
      const saved = savedMap.get(printer.id);
      return saved ? normalizePrinterEntity(saved, brandId, printer) : printer;
    });

    savedList.forEach((printer) => {
      if (!printer?.id || mergedList.some((item) => item.id === printer.id)) return;
      mergedList.push(
        normalizePrinterEntity({ ...printer, custom: true, canDelete: true }, brandId),
      );
    });

    mergedPrinters[brandId] = mergedList;
  });

  return {
    brands: mergedBrands,
    printersByBrand: mergedPrinters,
  };
}

export function serializeHomeCatalog(catalog) {
  return {
    version: 1,
    brands: (catalog?.brands || []).map((brand) => normalizeBrandEntity(brand)),
    printersByBrand: Object.fromEntries(
      Object.entries(catalog?.printersByBrand || {}).map(([brandId, printerList]) => [
        brandId,
        (printerList || []).map((printer) => normalizePrinterEntity(printer, brandId)),
      ]),
    ),
  };
}

export function findPrinterLocation(catalog, printerId) {
  if (!printerId) return null;

  for (const [brandId, printerList] of Object.entries(catalog?.printersByBrand || {})) {
    const printer = (printerList || []).find((item) => item.id === printerId);
    if (printer) {
      return { brandId, printer };
    }
  }

  return null;
}

export function getFirstSelectablePrinter(catalog, brandId) {
  const printerList = sortCatalogItems(catalog?.printersByBrand?.[brandId] || []);
  return printerList.find((printer) => !printer.disabled) || printerList[0] || null;
}

export function ensureValidSelection(catalog, selection) {
  const brandsList = catalog?.brands || [];
  const selectedBrand = selection?.brandId || brandsList[0]?.id || null;
  const selectedPrinter = selection?.printerId || null;
  const selectedVersion = selection?.versionType || null;

  const brand =
    brandsList.find((item) => item.id === selectedBrand) || sortCatalogItems(brandsList)[0] || null;
  const printerLocation = findPrinterLocation(catalog, selectedPrinter);

  let nextBrandId = brand?.id || printerLocation?.brandId || null;
  let nextPrinterId = selectedPrinter;

  if (!printerLocation || printerLocation.brandId !== nextBrandId) {
    const fallbackPrinter = nextBrandId ? getFirstSelectablePrinter(catalog, nextBrandId) : null;
    nextPrinterId = fallbackPrinter?.id || null;
  }

  const currentPrinter = nextPrinterId ? findPrinterLocation(catalog, nextPrinterId)?.printer : null;
  const supportedVersions = Array.isArray(currentPrinter?.supportedVersions)
    ? currentPrinter.supportedVersions
    : [];

  return {
    brandId: nextBrandId,
    printerId: nextPrinterId,
    versionType:
      selectedVersion && supportedVersions.includes(selectedVersion) ? selectedVersion : null,
  };
}

export function buildEntityAvatar(entity, fallbackSeed = '') {
  const image = toCatalogFileUrl(entity?.image || '');
  if (image && entity?.avatarMode !== 'generated') {
    return image;
  }

  return createLetterAvatarDataUri(entity?.shortName || entity?.name || '?', fallbackSeed);
}
