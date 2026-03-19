const MKP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MKP_ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

function mkpFormatBytes(bytes) {
  const numeric = Number(bytes) || 0;
  if (numeric <= 0) return '0 B';
  if (numeric < 1024) return `${numeric} B`;
  if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)} KB`;
  return `${(numeric / (1024 * 1024)).toFixed(1)} MB`;
}

function mkpNormalizeImageMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function mkpDetectImageMimeTypeFromBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) {
    return null;
  }

  if (
    bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes[0] === 0x47
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  if (
    bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

async function mkpAssertImageFileSafe(file, label = '图片') {
  if (!file) {
    throw new Error(`未选择${label}文件`);
  }

  if (Number(file.size) > MKP_IMAGE_MAX_BYTES) {
    throw new Error(`${label}过大，最大只允许 ${mkpFormatBytes(MKP_IMAGE_MAX_BYTES)}`);
  }

  const prefixBytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const sniffedMimeType = mkpDetectImageMimeTypeFromBytes(prefixBytes);
  if (!sniffedMimeType) {
    throw new Error(`${label}内容不是受支持的 PNG/JPEG/WEBP/GIF 图片`);
  }

  const declaredMimeType = mkpNormalizeImageMimeType(file.type);
  if (declaredMimeType && !MKP_ALLOWED_IMAGE_MIME_TYPES.has(declaredMimeType)) {
    throw new Error(`${label}类型不受支持：${file.type}`);
  }

  if (declaredMimeType && declaredMimeType !== sniffedMimeType) {
    throw new Error(`${label}内容与文件类型不匹配，请不要只改后缀名`);
  }

  return {
    mimeType: sniffedMimeType,
    size: Number(file.size) || 0
  };
}

window.MKPFileGuards = {
  IMAGE_MAX_BYTES: MKP_IMAGE_MAX_BYTES,
  assertImageFileSafe: mkpAssertImageFileSafe,
  formatBytes: mkpFormatBytes
};
