import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const {
  MAX_IMAGE_DATA_BYTES,
  MAX_TOML_PRESET_BYTES,
  assertSafeTomlLikeTextFile,
  decodeAndValidateImageDataUrl
} = require('../../../src/main/file_guards');

const tempDirs: string[] = [];

describe('main file guards', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('accepts a small text TOML file for conversion', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-file-guards-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'preset.toml');

    fs.writeFileSync(sourcePath, '[wiping]\nwiper_x = 20\n', 'utf8');

    expect(() => assertSafeTomlLikeTextFile(sourcePath)).not.toThrow();
  });

  it('rejects a renamed archive before the TOML parser touches it', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-file-guards-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'fake.toml');

    fs.writeFileSync(sourcePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]));

    expect(() => assertSafeTomlLikeTextFile(sourcePath)).toThrow(/archive/i);
  });

  it('rejects oversized TOML-like files before loading them into memory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkp-file-guards-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'huge.toml');

    fs.writeFileSync(sourcePath, 'a'.repeat(MAX_TOML_PRESET_BYTES + 1), 'utf8');

    expect(() => assertSafeTomlLikeTextFile(sourcePath)).toThrow(/too large/i);
  });

  it('accepts a real PNG data URL for image imports', () => {
    const result = decodeAndValidateImageDataUrl(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr2QAAAAASUVORK5CYII=',
      { label: 'Test image' }
    );

    expect(result.mimeType).toBe('image/png');
    expect(result.buffer.length).toBeGreaterThan(16);
  });

  it('falls back to the detected image type when the data URL only declares octet-stream', () => {
    const result = decodeAndValidateImageDataUrl(
      'data:application/octet-stream;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr2QAAAAASUVORK5CYII=',
      { label: 'Octet image' }
    );

    expect(result.mimeType).toBe('image/png');
  });

  it('rejects image payloads whose bytes do not match the selected type', () => {
    const fakeZipDataUrl = `data:image/png;base64,${Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]).toString('base64')}`;

    expect(() => decodeAndValidateImageDataUrl(fakeZipDataUrl, { label: 'Fake image' })).toThrow(/content/i);
  });

  it('rejects oversized image payloads before downstream image decoding runs', () => {
    const oversized = `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_DATA_BYTES + 1, 0xff).toString('base64')}`;

    expect(() => decodeAndValidateImageDataUrl(oversized, { label: 'Huge image' })).toThrow(/too large/i);
  });
});
