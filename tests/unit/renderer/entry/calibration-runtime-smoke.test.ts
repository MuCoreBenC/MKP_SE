import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const htmlSource = readFileSync('D:/trae/MKP_SE/src/renderer/index.html', 'utf8');
const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');
const appSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/app.js', 'utf8');
const calibratePageSource = readFileSync('D:/trae/MKP_SE/src/renderer/react-app/pages/calibrate/CalibratePage.tsx', 'utf8');

describe('calibration page runtime smoke', () => {
  it('uses a compact XY calibration layout without the redundant corner X label in the React calibrate page', () => {
    expect(calibratePageSource).toContain('className="xy-main-column"');
    expect(calibratePageSource).not.toContain('xy-axis-corner-label');
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

  it('uses calibration-specific head and action wrappers in the React calibrate page so the top-right buttons can sit tighter without stretching the page', () => {
    expect(calibratePageSource).toContain('className="calibration-card-head"');
    expect(calibratePageSource).toContain('className="calibration-card-actions"');
    expect(styleSource).toContain('.calibration-card-head {');
    expect(styleSource).toContain('.calibration-card-actions {');
  });

  it('gives the z calibration dock blocks one unified recessed surface without touching the dedicated dock animation hooks', () => {
    expect(styleSource).toMatch(/\.z-block-box \{[\s\S]*background: rgba\(217, 217, 217, 0\.92\);/);
    expect(styleSource).toMatch(/\.z-block-box \{[\s\S]*0 1px 2px rgba\(15, 23, 42, 0\.05\),[\s\S]*0 10px 20px rgba\(15, 23, 42, 0\.07\);/);
    expect(styleSource).toContain('.z-block-item:hover .z-block-box {');
    expect(styleSource).toContain('.z-block-box.theme-text {');
    expect(styleSource).toContain('.z-block-dot {');
    expect(styleSource).toContain('.dark .z-block-box {');
    expect(styleSource).toContain('.dark .z-block-dot {');
    expect(styleSource).toContain('#zGrid.enable-dock-anim .z-block-item {');
    expect(styleSource).toContain('#zGrid.enable-dock-anim .z-block-box {');
    expect(styleSource).toContain('#zGrid.enable-dock-anim .z-block-text {');
    expect(appSource).toContain('class="z-block-dot absolute inset-0 m-auto w-2 h-2 rounded-full"');
    expect(appSource).toContain('group-hover:border-gray-400 dark:group-hover:border-gray-300');
  });

  it('renders calibrate from React instead of the legacy shell bridge while keeping legacy hook ids intact', () => {
    expect(htmlSource).toContain('id="react-calibrate-page-root" class="mkp-react-page-root hidden"');
    expect(htmlSource).toContain('id="calibrateLegacyShell" class="mkp-react-page-legacy-shell hidden"');
    expect(calibratePageSource).toContain('data-react-page="calibrate"');
    expect(calibratePageSource).toContain('id="scriptPath"');
    expect(calibratePageSource).toContain('id="zCalibrationCard"');
    expect(calibratePageSource).toContain('id="xyCalibrationCard"');
    expect(calibratePageSource).toContain('id="saveZOffsetBtn"');
    expect(calibratePageSource).toContain('id="saveXYOffsetBtn"');
    expect(calibratePageSource).not.toContain('LegacyShellBridge');
    expect(appSource).toContain("document.getElementById('saveZOffsetBtn')");
    expect(appSource).toContain("document.getElementById('saveXYOffsetBtn')");
    expect(appSource).toContain('window.copyPath = copyPath;');
    expect(appSource).toContain('window.saveZOffset = saveZOffset;');
  });
});
