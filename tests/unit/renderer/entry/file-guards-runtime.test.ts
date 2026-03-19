import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('renderer file guard runtime smoke', () => {
  it('loads the shared file-guard helper into both main renderer entry pages', () => {
    const indexSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
    const releaseSource = readFileSync('D:/trae/MKP_SE/src/renderer/release_center.html', 'utf8');

    expect(indexSource).toContain('assets/js/file-guards.js');
    expect(releaseSource).toContain('assets/js/file-guards.js');
  });

  it('defines a shared image guard that checks file size and real image bytes instead of trusting extensions alone', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/file-guards.js', 'utf8');

    expect(source).toMatch(/const MKP_IMAGE_MAX_BYTES = 10 \* 1024 \* 1024;/);
    expect(source).toMatch(/async function mkpAssertImageFileSafe\(file, label = '.*?'\) \{/);
    expect(source).toMatch(/file\.slice\(0, 32\)\.arrayBuffer\(\)/);
    expect(source).toMatch(/mkpDetectImageMimeTypeFromBytes/);
    expect(source).toMatch(/do not just change the extension|请不要只改后缀名/);
    expect(source).toMatch(/window\.MKPFileGuards = \{/);
  });

  it('uses the shared image guard before reading home or release images into FileReader memory', () => {
    const homeSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const releaseSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/release.js', 'utf8');

    expect(homeSource).toMatch(/await window\.MKPFileGuards\?\.assertImageFileSafe\?\.\(file, '.*?'\);/);
    expect(releaseSource).toMatch(/await window\.MKPFileGuards\?\.assertImageFileSafe\?\.\(file, '.*?'\);/);
  });
});
