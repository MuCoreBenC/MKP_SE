const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toml = require('@iarna/toml');

// MKPSE 目录路径
function getMKPSEDir() {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(homeDir, 'Documents', 'MKPSE');
}

function getMKPSEPresetsDir() {
  return path.join(getMKPSEDir(), 'presets');
}

function ensureMKPSEDirs() {
  const mkpseDir = getMKPSEDir();
  const presetsDir = getMKPSEPresetsDir();
  fs.mkdirSync(mkpseDir, { recursive: true });
  fs.mkdirSync(presetsDir, { recursive: true });
  return { mkpseDir, presetsDir };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readToml(filePath) {
  return toml.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeToml(filePath, data) {
  const tomlString = toml.stringify(data);
  fs.writeFileSync(filePath, tomlString, 'utf8');
}

function parseTomlToFlat(data, prefix = '') {
  const result = {};
  for (const key of Object.keys(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = data[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, parseTomlToFlat(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function flatToToml(flat) {
  const result = {};
  for (const key of Object.keys(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = flat[key];
  }
  return result;
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || `item_${Date.now()}`;
}

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function resolveRuntimePaths(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const cloudDataDir = options.cloudDataDir || path.join(projectRoot, 'cloud_data');
  const srcDir = options.srcDir || path.join(projectRoot, 'src');
  const rendererRoot = path.join(srcDir, 'renderer');

  return {
    projectRoot,
    cloudDataDir,
    srcDir,
    rendererRoot,
    dataJsPath: path.join(rendererRoot, 'assets', 'js', 'data.js'),
    imagesDir: path.join(rendererRoot, 'assets', 'images'),
    presetsDir: path.join(cloudDataDir, 'presets'),
    presetsManifestPath: path.join(cloudDataDir, 'presets', 'presets_manifest.json')
  };
}

function readDataModule(dataJsPath) {
  delete require.cache[require.resolve(dataJsPath)];
  return require(dataJsPath);
}

function getFaqTail(rawSource) {
  const faqStart = rawSource.indexOf('const faqData =');
  if (faqStart < 0) {
    throw new Error('data.js does not contain faqData section.');
  }
  return rawSource.slice(faqStart).trimStart();
}

function serializeJsLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function validateBrandList(brands) {
  if (!Array.isArray(brands)) {
    throw new Error('brands must be an array.');
  }

  const seen = new Set();
  brands.forEach((brand) => {
    const id = String(brand?.id || '').trim();
    if (!/^[a-z][a-z0-9_-]{1,31}$/i.test(id)) {
      throw new Error(`Invalid brand id: ${id || '(empty)'}`);
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate brand id: ${id}`);
    }
    seen.add(id);
  });
}

function validatePrintersByBrand(printersByBrand, brands) {
  if (!printersByBrand || typeof printersByBrand !== 'object') {
    throw new Error('printersByBrand must be an object.');
  }

  const brandIds = new Set(brands.map((brand) => brand.id));
  Object.entries(printersByBrand).forEach(([brandId, printerList]) => {
    if (!brandIds.has(brandId)) {
      throw new Error(`Unknown brand id in printersByBrand: ${brandId}`);
    }
    if (!Array.isArray(printerList)) {
      throw new Error(`printersByBrand.${brandId} must be an array.`);
    }
    const seen = new Set();
    printerList.forEach((printer) => {
      const printerId = String(printer?.id || '').trim();
      if (!/^[a-z][a-z0-9_-]{1,31}$/i.test(printerId)) {
        throw new Error(`Invalid printer id: ${printerId || '(empty)'}`);
      }
      if (seen.has(printerId)) {
        throw new Error(`Duplicate printer id under ${brandId}: ${printerId}`);
      }
      seen.add(printerId);
    });
  });
}

function writeCatalogDataJs(paths, brands, printersByBrand) {
  const rawSource = fs.readFileSync(paths.dataJsPath, 'utf8');
  const faqTail = getFaqTail(rawSource);
  const nextSource = `// ==========================================\n// Default catalog data\n// This section is generated by release center.\n// ==========================================\nconst brands = ${serializeJsLiteral(brands)};\n\n// ==========================================\n// Default printer catalog data\n// This section is generated by release center.\n// ==========================================\nconst printersByBrand = ${serializeJsLiteral(printersByBrand)};\n\n${faqTail}\n`;
  fs.writeFileSync(paths.dataJsPath, nextSource, 'utf8');
}

function bumpManifestVersion(version) {
  const current = String(version || '1.0.0').split('.');
  while (current.length < 3) current.push('0');
  current[2] = String(Number(current[2] || '0') + 1);
  return current.slice(0, 3).join('.');
}

function readDefaultCatalogConfig(options = {}) {
  const paths = resolveRuntimePaths(options);
  const dataModule = readDataModule(paths.dataJsPath);
  const presetsManifest = readJson(paths.presetsManifestPath);

  return {
    brands: dataModule.brands || [],
    printersByBrand: dataModule.printersByBrand || {},
    presetsManifest,
    presets: Array.isArray(presetsManifest.presets) ? presetsManifest.presets : [],
    paths: {
      dataJsPath: paths.dataJsPath,
      imagesDir: paths.imagesDir,
      presetsDir: paths.presetsDir,
      presetsManifestPath: paths.presetsManifestPath
    }
  };
}

function saveDefaultCatalogConfig(payload, options = {}) {
  const paths = resolveRuntimePaths(options);
  const brands = Array.isArray(payload?.brands) ? payload.brands : [];
  const printersByBrand = payload?.printersByBrand && typeof payload.printersByBrand === 'object'
    ? payload.printersByBrand
    : {};

  validateBrandList(brands);
  validatePrintersByBrand(printersByBrand, brands);
  writeCatalogDataJs(paths, brands, printersByBrand);

  return readDefaultCatalogConfig(options);
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image payload.');
  }
  return Buffer.from(match[2], 'base64');
}

async function importDefaultCatalogImage(payload, options = {}) {
  const paths = resolveRuntimePaths(options);
  ensureDir(paths.imagesDir);

  const baseName = sanitizeToken(payload?.fileBaseName || payload?.itemId || payload?.itemType || 'catalog');
  const outputName = `${baseName}_${Date.now()}.webp`;
  const outputPath = path.join(paths.imagesDir, outputName);
  const buffer = dataUrlToBuffer(payload?.dataUrl);

  await sharp(buffer)
    .resize(512, 512, {
      fit: 'cover',
      position: 'centre'
    })
    .webp({ quality: 92 })
    .toFile(outputPath);

  return {
    absolutePath: outputPath,
    relativePath: toPosix(path.relative(paths.rendererRoot, outputPath))
  };
}

function validatePresetFileName(fileName) {
  const normalized = String(fileName || '').trim();
  if (!/^[a-z0-9][a-z0-9_.-]*\.(json|toml)$/i.test(normalized)) {
    throw new Error('Preset file name must be English and end with .json or .toml');
  }
  return normalized;
}

function readDefaultPreset(fileName, options = {}) {
  const paths = resolveRuntimePaths(options);
  const normalizedFileName = validatePresetFileName(fileName);
  
  // 优先从MKPSE目录读取，如果不存在则从默认目录读取
  let filePath = path.join(getMKPSEPresetsDir(), normalizedFileName);
  let useMKPSE = fs.existsSync(filePath);
  
  if (!useMKPSE) {
    filePath = path.join(paths.presetsDir, normalizedFileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Preset file not found: ${normalizedFileName}`);
    }
  }

  const manifest = readJson(paths.presetsManifestPath);
  const entry = Array.isArray(manifest.presets)
    ? manifest.presets.find((item) => item.file === normalizedFileName) || null
    : null;

  const ext = path.extname(normalizedFileName).toLowerCase();
  const data = ext === '.toml' ? readToml(filePath) : readJson(filePath);

  return {
    fileName: normalizedFileName,
    filePath,
    useMKPSE,
    data,
    entry
  };
}

function saveDefaultPreset(payload, options = {}) {
  const paths = resolveRuntimePaths(options);
  ensureMKPSEDirs();
  
  const mkpsePresetsDir = getMKPSEPresetsDir();

  const manifest = readJson(paths.presetsManifestPath);
  const currentEntries = Array.isArray(manifest.presets) ? [...manifest.presets] : [];
  const originalFileName = payload?.originalFileName ? validatePresetFileName(payload.originalFileName) : null;
  const fileName = validatePresetFileName(payload?.fileName);
  
  // 保存到MKPSE目录
  const filePath = path.join(mkpsePresetsDir, fileName);

  const presetData = payload?.data;
  if (!presetData || typeof presetData !== 'object' || Array.isArray(presetData)) {
    throw new Error('Preset data must be an object.');
  }

  const meta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {};
  const presetId = String(meta.id || '').trim().toLowerCase();
  const presetType = String(meta.type || '').trim().toLowerCase();
  const presetVersion = normalizeVersion(meta.version || presetData.version || '');

  if (!/^[a-z][a-z0-9_-]{1,31}$/i.test(presetId)) {
    throw new Error('Preset id must be English.');
  }
  if (!presetType) {
    throw new Error('Preset type is required.');
  }
  if (!presetVersion) {
    throw new Error('Preset version is required.');
  }

  const nextData = {
    ...presetData,
    version: presetVersion
  };

  // 根据文件扩展名选择保存格式
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.toml') {
    writeToml(filePath, nextData);
  } else {
    writeJson(filePath, nextData);
  }

  const nextEntry = {
    id: presetId,
    type: presetType,
    file: fileName,
    version: presetVersion,
    description: String(meta.description || '').trim(),
    releaseNotes: Array.isArray(meta.releaseNotes)
      ? meta.releaseNotes.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    lastModified: String(meta.lastModified || new Date().toISOString().slice(0, 10))
  };

  let replaced = false;
  const filteredEntries = currentEntries.filter((entry) => {
    if (entry.file === fileName || (originalFileName && entry.file === originalFileName)) {
      replaced = true;
      return false;
    }
    return true;
  });

  filteredEntries.push(nextEntry);
  filteredEntries.sort((left, right) => String(left.file || '').localeCompare(String(right.file || ''), 'en', { numeric: true, sensitivity: 'base' }));

  manifest.presets = filteredEntries;
  manifest.version = bumpManifestVersion(manifest.version);
  manifest.lastUpdated = new Date().toISOString().slice(0, 10);
  writeJson(paths.presetsManifestPath, manifest);

  if (originalFileName && originalFileName !== fileName) {
    const originalPath = path.join(mkpsePresetsDir, originalFileName);
    if (fs.existsSync(originalPath)) {
      fs.rmSync(originalPath, { force: true });
    }
  }

  return {
    replaced,
    entry: nextEntry,
    manifestVersion: manifest.version,
    fileName,
    filePath
  };
}

module.exports = {
  importDefaultCatalogImage,
  readDefaultCatalogConfig,
  readDefaultPreset,
  resolveRuntimePaths,
  saveDefaultCatalogConfig,
  saveDefaultPreset,
  getMKPSEDir,
  getMKPSEPresetsDir,
  ensureMKPSEDirs,
  readToml,
  writeToml,
  parseTomlToFlat,
  flatToToml
};
