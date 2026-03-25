const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeFileToken(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || `item_${Date.now()}`;
}

function getCatalogDirectory(userDataRoot) {
  return path.join(userDataRoot, 'Catalog');
}

function getCatalogFilePath(userDataRoot) {
  return path.join(getCatalogDirectory(userDataRoot), 'home_catalog.json');
}

function getCatalogImagesDirectory(userDataRoot) {
  return path.join(getCatalogDirectory(userDataRoot), 'images');
}

function readHomeCatalog(userDataRoot) {
  const filePath = getCatalogFilePath(userDataRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveHomeCatalog(userDataRoot, data) {
  const filePath = getCatalogFilePath(userDataRoot);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

function removeHomeCatalog(userDataRoot) {
  const catalogDir = getCatalogDirectory(userDataRoot);
  fs.rmSync(catalogDir, { recursive: true, force: true });
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image payload.');
  }
  return Buffer.from(match[2], 'base64');
}

async function importHomeCatalogImage(userDataRoot, payload) {
  const itemType = sanitizeFileToken(payload.itemType || 'item');
  const itemId = sanitizeFileToken(payload.itemId || 'catalog');
  const imagesDir = getCatalogImagesDirectory(userDataRoot);
  ensureDir(imagesDir);

  const buffer = dataUrlToBuffer(payload.dataUrl);
  const fileName = `${itemType}_${itemId}_${Date.now()}.webp`;
  const filePath = path.join(imagesDir, fileName);

  await sharp(buffer)
    .resize(512, 512, {
      fit: 'cover',
      position: 'centre'
    })
    .webp({ quality: 92 })
    .toFile(filePath);

  return filePath;
}

module.exports = {
  getCatalogDirectory,
  getCatalogFilePath,
  getCatalogImagesDirectory,
  importHomeCatalogImage,
  readHomeCatalog,
  removeHomeCatalog,
  saveHomeCatalog,
  sanitizeFileToken
};
