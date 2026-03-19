import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');
const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');

describe('calibration page runtime smoke', () => {
  it('uses a compact XY calibration layout without the redundant corner X label', () => {
    expect(htmlSource).toContain('class="xy-main-column"');
    expect(htmlSource).not.toContain('class="xy-axis-corner-label"');
    expect(styleSource).toContain('.xy-main-column {');
    expect(styleSource).not.toContain('.xy-axis-corner-label {');
  });

  it('adds shared calibration card scrolling and centers the XY editor after action clicks', () => {
    expect(appSource).toMatch(/function scrollCalibrationCardIntoView\(cardId, options = \{\}\) \{/);
    expect(appSource).toMatch(/scrollCalibrationCardIntoView\('xyCalibrationCard', \{ block: 'center' \}\);/);
    expect(appSource).toMatch(/scrollCalibrationCardIntoView\('xyCalibrationCard', \{ block: 'center', delay: 20 \}\);/);
    expect(appSource).toMatch(/scrollCalibrationCardIntoView\('zCalibrationCard', \{ block: 'start' \}\);/);
    expect(appSource).toMatch(/scrollCalibrationCardIntoView\('zCalibrationCard', \{ block: 'start', delay: 20 \}\);/);
  });

  it('uses calibration-specific head and action wrappers so the top-right buttons can sit tighter without stretching the page', () => {
    expect(htmlSource).toContain('class="calibration-card-head"');
    expect(htmlSource).toContain('class="calibration-card-actions"');
    expect(styleSource).toContain('.calibration-card-head {');
    expect(styleSource).toContain('.calibration-card-actions {');
  });
});
