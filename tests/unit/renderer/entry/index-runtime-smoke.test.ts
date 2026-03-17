import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('index.html modern runtime smoke', () => {
  it('wires the renderer html entry to the modern runtime bootstrap path', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toMatch(/mountModernRuntime|renderer-runtime\.ts|__MKP_MODERN_RUNTIME__/);
  });

  it('keeps the modern bridge bootstrap reachable from the renderer html entry', () => {
    const html = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');

    expect(html).toMatch(/type="module"/);
    expect(html).toMatch(/mountModernRuntime\(window\)/);
    expect(html).toMatch(/bootstrap failed/);
  });
});
