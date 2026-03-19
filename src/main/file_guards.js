const fs = require('fs');

const MAX_TOML_PRESET_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_DATA_BYTES = 10 * 1024 * 1024;
const TEXT_SNIFF_BYTES = 4096;

const ARCHIVE_SIGNATURES = [
  { label: 'ZIP archive', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { label: 'ZIP archive', bytes: [0x50, 0x4b, 0x05, 0x06] },
  { label: 'ZIP archive', bytes: [0x50, 0x4b, 0x07, 0x08] },
  { label: 'GZip archive', bytes: [0x1f, 0x8b] },
  { label: 'RAR archive', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { label: '7z archive', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] }
];

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

function matchesSignature(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((value, index) => buffer[index] === value);
}

function detectArchiveSignature(buffer) {
  for (const signature of ARCHIVE_SIGNATURES) {
    if (matchesSignature(buffer, signature.bytes)) {
      return signature.label;
    }
  }
  return null;
}

function readFilePrefixSync(filePath, maxBytes = TEXT_SNIFF_BYTES) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const targetBytes = Math.max(1, Number(maxBytes) || TEXT_SNIFF_BYTES);
    const buffer = Buffer.alloc(targetBytes);
    const bytesRead = fs.readSync(fd, buffer, 0, targetBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function looksLikeBinaryText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  let suspiciousCount = 0;
  for (const byte of buffer.values()) {
    if (byte === 0x00) {
      return true;
    }

    const isAllowedWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    const isAsciiText = byte >= 0x20;
    if (!isAllowedWhitespace && !isAsciiText) {
      suspiciousCount += 1;
    }
  }

  return suspiciousCount > Math.max(4, Math.floor(buffer.length * 0.08));
}

function formatByteLimit(bytes) {
  const megabytes = Number(bytes) / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function assertSafeTomlLikeTextFile(filePath, options = {}) {
  const maxBytes = Number(options.maxBytes) || MAX_TOML_PRESET_BYTES;
  const label = String(options.label || 'Text file');
  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    throw new Error(`${label} is not a regular file`);
  }

  if (stat.size > maxBytes) {
    throw new Error(`${label} is too large to be a preset (${formatByteLimit(maxBytes)} limit)`);
  }

  const prefix = readFilePrefixSync(filePath, options.sniffBytes || TEXT_SNIFF_BYTES);
  const archiveLabel = detectArchiveSignature(prefix);
  if (archiveLabel) {
    throw new Error(`${label} appears to be a ${archiveLabel}, not a TOML text preset`);
  }

  if (looksLikeBinaryText(prefix)) {
    throw new Error(`${label} contains binary bytes and cannot be parsed as TOML text`);
  }
}

function decodeBase64DataUrl(dataUrl, label = 'Image payload') {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw new Error(`${label} is not a valid base64 data URL`);
  }

  return {
    mimeType: String(match[1] || '').toLowerCase(),
    buffer: Buffer.from(match[2], 'base64')
  };
}

function detectImageFormatFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (
    buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x47
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  if (
    buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

function normalizeComparableMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function decodeAndValidateImageDataUrl(dataUrl, options = {}) {
  const label = String(options.label || 'Image payload');
  const maxBytes = Number(options.maxBytes) || MAX_IMAGE_DATA_BYTES;
  const { mimeType, buffer } = decodeBase64DataUrl(dataUrl, label);
  const normalizedMimeType = normalizeComparableMimeType(mimeType);
  const genericMimeType = normalizedMimeType === 'application/octet-stream';

  if (!genericMimeType && !ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error(`${label} type ${mimeType || '(empty)'} is not supported`);
  }

  if (buffer.length === 0) {
    throw new Error(`${label} is empty`);
  }

  if (buffer.length > maxBytes) {
    throw new Error(`${label} is too large (${formatByteLimit(maxBytes)} limit)`);
  }

  const detectedMimeType = detectImageFormatFromBuffer(buffer);
  if (!detectedMimeType) {
    throw new Error(`${label} content is not a supported PNG/JPEG/WEBP/GIF image`);
  }

  if (!genericMimeType && normalizeComparableMimeType(detectedMimeType) !== normalizedMimeType) {
    throw new Error(`${label} content does not match the selected file type`);
  }

  return {
    buffer,
    mimeType: genericMimeType ? detectedMimeType : normalizedMimeType
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_DATA_BYTES,
  MAX_TOML_PRESET_BYTES,
  assertSafeTomlLikeTextFile,
  decodeAndValidateImageDataUrl,
  detectArchiveSignature,
  detectImageFormatFromBuffer,
  formatByteLimit,
  looksLikeBinaryText,
  readFilePrefixSync
};
