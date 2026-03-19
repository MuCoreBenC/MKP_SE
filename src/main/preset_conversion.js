const fs = require('fs');
const path = require('path');
const { parseToml } = require('./mkp_engine');
const {
  MAX_TOML_PRESET_BYTES,
  assertSafeTomlLikeTextFile
} = require('./file_guards');

const CONVERTED_PRESETS_DIR_NAME = 'ConvertedPresets';
const PRESETS_DIR_NAME = 'Presets';

function getConvertedPresetsDir(userDataPath) {
  if (!userDataPath) {
    throw new Error('userDataPath is required');
  }

  return path.join(path.resolve(userDataPath), PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME);
}

function ensureConvertedPresetsDir(userDataPath) {
  const outputDir = getConvertedPresetsDir(userDataPath);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function sanitizeConvertedPresetBaseName(sourcePath) {
  const rawBaseName = path.basename(String(sourcePath || ''), path.extname(String(sourcePath || ''))) || 'preset';
  const sanitized = rawBaseName.replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_').trim();
  return sanitized || 'preset';
}

function buildConvertedJsonOutputPath(sourcePath, userDataPath) {
  return path.join(
    ensureConvertedPresetsDir(userDataPath),
    `${sanitizeConvertedPresetBaseName(sourcePath)}.json`
  );
}

function formatTimestampForFileName(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
}

function resolveConvertedJsonOutputPath(sourcePath, userDataPath, now = new Date()) {
  const outputDir = ensureConvertedPresetsDir(userDataPath);
  const baseName = sanitizeConvertedPresetBaseName(sourcePath);
  const defaultOutputPath = path.join(outputDir, `${baseName}.json`);

  if (!fs.existsSync(defaultOutputPath)) {
    return defaultOutputPath;
  }

  let attempt = 0;
  while (attempt < 1000) {
    const suffix = attempt === 0
      ? formatTimestampForFileName(now)
      : `${formatTimestampForFileName(now)}-${attempt}`;
    const candidatePath = path.join(outputDir, `${baseName}_${suffix}.json`);
    if (!fs.existsSync(candidatePath)) {
      return candidatePath;
    }
    attempt += 1;
  }

  throw new Error(`Could not resolve a unique converted JSON filename for ${baseName}`);
}

function convertTomlPresetFileToJson(sourcePath, userDataPath) {
  const resolvedSourcePath = path.resolve(String(sourcePath || ''));
  if (!sourcePath || !fs.existsSync(resolvedSourcePath)) {
    throw new Error(`TOML file not found: ${sourcePath || '(empty)'}`);
  }

  if (path.extname(resolvedSourcePath).toLowerCase() !== '.toml') {
    throw new Error('Only .toml preset files can be converted');
  }

  assertSafeTomlLikeTextFile(resolvedSourcePath, {
    label: 'TOML preset',
    maxBytes: MAX_TOML_PRESET_BYTES
  });

  const rawTomlText = fs.readFileSync(resolvedSourcePath, 'utf8');
  const parsed = parseToml(rawTomlText);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Converted TOML content is not a valid JSON object');
  }

  const outputPath = resolveConvertedJsonOutputPath(resolvedSourcePath, userDataPath);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  return {
    sourcePath: resolvedSourcePath,
    outputPath,
    outputDir,
    data: parsed
  };
}

module.exports = {
  CONVERTED_PRESETS_DIR_NAME,
  MAX_TOML_PRESET_BYTES,
  PRESETS_DIR_NAME,
  buildConvertedJsonOutputPath,
  convertTomlPresetFileToJson,
  ensureConvertedPresetsDir,
  formatTimestampForFileName,
  getConvertedPresetsDir,
  resolveConvertedJsonOutputPath,
  sanitizeConvertedPresetBaseName
};
