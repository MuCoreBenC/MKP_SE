import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const {
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
} = require('../../../src/main/preset_conversion');

const tempDirs: string[] = [];

describe('preset conversion helpers', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('keeps converted JSON outputs inside a dedicated subfolder under the normal presets directory', () => {
    expect(getConvertedPresetsDir('C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE')).toBe(
      `C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\${PRESETS_DIR_NAME}\\${CONVERTED_PRESETS_DIR_NAME}`
    );
  });

  it('builds stable converted JSON names from the source TOML basename', () => {
    expect(sanitizeConvertedPresetBaseName('D:\\configs\\A1M.toml')).toBe('A1M');
    expect(buildConvertedJsonOutputPath('D:\\configs\\A1M.toml', 'C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE')).toBe(
      `C:\\Users\\WZY\\AppData\\Roaming\\MKP SupportE\\${PRESETS_DIR_NAME}\\${CONVERTED_PRESETS_DIR_NAME}\\A1M.json`
    );
  });

  it('keeps the original converted file name when there is no duplicate yet', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);

    expect(resolveConvertedJsonOutputPath('D:\\configs\\A1M.toml', tempDir)).toBe(
      path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME, 'A1M.json')
    );
  });

  it('adds a timestamp suffix only when the converted json name already exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const convertedDir = ensureConvertedPresetsDir(tempDir);
    const existingPath = path.join(convertedDir, 'A1M.json');
    const fixedNow = new Date(2026, 2, 19, 20, 15, 33, 45);
    fs.writeFileSync(existingPath, '{}\n', 'utf8');

    expect(formatTimestampForFileName(fixedNow)).toBe('20260319-201533-045');
    expect(resolveConvertedJsonOutputPath('D:\\configs\\A1M.toml', tempDir, fixedNow)).toBe(
      path.join(convertedDir, 'A1M_20260319-201533-045.json')
    );
  });

  it('creates the dedicated conversion folder on demand', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);

    const convertedDir = ensureConvertedPresetsDir(tempDir);

    expect(convertedDir).toBe(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME));
    expect(fs.existsSync(convertedDir)).toBe(true);
  });

  it('converts TOML presets into GUI-friendly snake_case JSON files inside the dedicated folder', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'A1M.toml');

    fs.writeFileSync(
      sourcePath,
      [
        '[toolhead]',
        'speed_limit = 70',
        'custom_mount_gcode = """',
        ';CustomLock',
        'M400',
        '"""',
        '',
        '[wiping]',
        'have_wiping_components = true',
        'wiper_x = 20',
        'wiper_y = 30'
      ].join('\n'),
      'utf8'
    );

    const result = convertTomlPresetFileToJson(sourcePath, tempDir);
    const writtenJson = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(result.outputDir).toBe(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME));
    expect(result.outputPath).toBe(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME, 'A1M.json'));
    expect(writtenJson).toEqual({
      toolhead: {
        speed_limit: 70,
        custom_mount_gcode: ';CustomLock\nM400'
      },
      wiping: {
        have_wiping_components: true,
        wiper_x: 20,
        wiper_y: 30
      }
    });
  });

  it('keeps older converted files and writes a timestamp-suffixed json when the base name already exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'A1M.toml');
    const convertedDir = ensureConvertedPresetsDir(tempDir);
    const originalJsonPath = path.join(convertedDir, 'A1M.json');

    fs.writeFileSync(originalJsonPath, '{\n  "old": true\n}\n', 'utf8');
    fs.writeFileSync(
      sourcePath,
      [
        '[toolhead]',
        'speed_limit = 88'
      ].join('\n'),
      'utf8'
    );

    const realDate = Date;
    const fixedNow = new Date(2026, 2, 19, 20, 16, 2, 7);

    global.Date = class extends Date {
      constructor(
        ...args:
          | []
          | [string | number | Date]
          | [number, number, number, number?, number?, number?, number?]
      ) {
        if (args.length === 0) {
          super(fixedNow);
          return;
        }
        if (args.length === 1) {
          super(args[0]);
          return;
        }
        const [year, month, date, hours, minutes, seconds, ms] = args;
        super(year, month, date, hours, minutes, seconds, ms);
      }

      static now() {
        return fixedNow.getTime();
      }
    } as DateConstructor;

    try {
      const result = convertTomlPresetFileToJson(sourcePath, tempDir);

      expect(result.outputPath).toBe(path.join(convertedDir, 'A1M_20260319-201602-007.json'));
      expect(JSON.parse(fs.readFileSync(originalJsonPath, 'utf8'))).toEqual({ old: true });
      expect(JSON.parse(fs.readFileSync(result.outputPath, 'utf8'))).toEqual({
        toolhead: {
          speed_limit: 88
        }
      });
    } finally {
      global.Date = realDate;
    }
  });

  it('rejects non-toml inputs before writing any output file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'A1M.json');
    fs.writeFileSync(sourcePath, '{}', 'utf8');

    expect(() => convertTomlPresetFileToJson(sourcePath, tempDir)).toThrow(/Only \.toml preset files can be converted/);
    expect(fs.existsSync(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME, 'A1M.json'))).toBe(false);
  });

  it('rejects renamed archive payloads even when the file extension says .toml', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'A1M.toml');
    fs.writeFileSync(sourcePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]));

    expect(() => convertTomlPresetFileToJson(sourcePath, tempDir)).toThrow(/archive/i);
    expect(fs.existsSync(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME, 'A1M.json'))).toBe(false);
  });

  it('rejects oversized toml payloads before parsing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-preset-convert-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'A1M.toml');
    fs.writeFileSync(sourcePath, 'a'.repeat(MAX_TOML_PRESET_BYTES + 1), 'utf8');

    expect(() => convertTomlPresetFileToJson(sourcePath, tempDir)).toThrow(/too large/i);
    expect(fs.existsSync(path.join(tempDir, PRESETS_DIR_NAME, CONVERTED_PRESETS_DIR_NAME, 'A1M.json'))).toBe(false);
  });
});
