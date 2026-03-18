import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

describe('home.js modern runtime smoke', () => {
  it('revalidates selected printer/version together before downstream rendering consumes home selection state', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function ensureValidHomeSelection()'),
      source.lastIndexOf('function getBrandAvatar(')
    );

    expect(block).toMatch(/const selectedPrinterLocation = findPrinterLocation\(selectedPrinter\);/);
    expect(block).toMatch(/if \(selectedPrinter && \(!selectedPrinterLocation \|\| selectedPrinterLocation\.brandId !== selectedBrandObj\.id\)\) \{/);
    expect(block).toMatch(/selectedPrinter = fallbackPrinter\?\.id \|\| null;/);
    expect(block).toMatch(/selectedBrand = fallbackBrand\?\.id \|\| null;/);
    expect(block).toMatch(/const currentPrinter = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/if \(currentPrinter && selectedVersion/);
    expect(block).toMatch(/selectedVersion = null;/);
  });

  it('preserves an explicit brand-only restore state instead of auto-picking the first printer on startup', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function ensureValidHomeSelection()'),
      source.lastIndexOf('function getBrandAvatar(')
    );

    expect(block).not.toMatch(/if \(!selectedPrinterLocation \|\| selectedPrinterLocation\.brandId !== selectedBrandObj\.id\) \{/);
    expect(block).toMatch(/if \(selectedBrandObj\) \{[\s\S]*if \(selectedPrinter && \(!selectedPrinterLocation \|\| selectedPrinterLocation\.brandId !== selectedBrandObj\.id\)\) \{/);
  });

  it('keeps selectPrinter on the legacy-to-modern sync path before rendering download versions', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function selectPrinter('),
      source.lastIndexOf('function generateCustomIdentifier(')
    );

    expect(block).toMatch(/selectedPrinter = printerId;/);
    expect(block).toMatch(/const selectedPrinterObj = getPrinterObj\(printerId\);/);
    expect(block).toMatch(/saveUserConfig\(\);/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(selectedPrinterObj\);/);
  });

  it('updates sidebar brand, model, and version badge before rendering downloads in selectPrinter', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function selectPrinter('),
      source.lastIndexOf('function generateCustomIdentifier(')
    );

    expect(block).toMatch(/const sidebarBrand = document\.getElementById\('sidebarBrand'\);/);
    expect(block).toMatch(/const sidebarModelName = document\.getElementById\('sidebarModelName'\);/);
    expect(block).toMatch(/if \(sidebarBrand && matchedBrand\) \{[\s\S]*sidebarBrand\.textContent = matchedBrand\.shortName \|\| matchedBrand\.name;[\s\S]*\}/);
    expect(block).toMatch(/if \(sidebarModelName\) \{[\s\S]*sidebarModelName\.textContent = selectedPrinterObj\.shortName \|\| selectedPrinterObj\.name;[\s\S]*\}/);
    expect(block).toMatch(/updateSidebarVersionBadge\(selectedVersion\);[\s\S]*saveUserConfig\(\);[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshHomeSelectionDownstream\(selectedPrinterObj\);/);
  });

  it('clears the carried version when switching to a different printer even if both printers support the same version label', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function selectPrinter('),
      source.lastIndexOf('function generateCustomIdentifier(')
    );

    expect(block).not.toMatch(/if \(!keepVersion \|\| \(selectedVersion && supportedVersions\.length > 0 && !supportedVersions\.includes\(selectedVersion\)\)\) \{/);
    expect(block).toMatch(/const previousPrinterId = selectedPrinter;/);
    expect(block).toMatch(/selectedPrinter = printerId;/);
    expect(block).toMatch(/if \(!keepVersion \|\| selectedPrinter !== previousPrinterId \|\| \(selectedVersion && supportedVersions\.length > 0 && !supportedVersions\.includes\(selectedVersion\)\)\) \{/);
    expect(block).toMatch(/selectedVersion = null;/);
  });

  it('syncs cleared version context back into the modern runtime before downstream rendering in selectPrinter', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function selectPrinter('),
      source.lastIndexOf('function generateCustomIdentifier(')
    );

    expect(block).toMatch(/selectedVersion = null;/);
    expect(block).toMatch(/__syncLegacyContextToModern__\([\s\S]*printerId,[\s\S]*versionType: selectedVersion[\s\S]*\)/);
    expect(block).toMatch(/__syncLegacyContextToModern__[\s\S]*updateSidebarVersionBadge\(selectedVersion\);[\s\S]*saveUserConfig\(\);[\s\S]*refreshHomeSelectionDownstream\(selectedPrinterObj\);/);
  });

  it('revalidates the current version against the selected printer in selectBrand before rendering download versions', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/const currentPrinter = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/if \(currentPrinter && selectedVersion && Array\.isArray\(currentPrinter\.supportedVersions\) && !currentPrinter\.supportedVersions\.includes\(selectedVersion\)\) \{/);
    expect(block).toMatch(/selectedVersion = null;/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
  });

  it('updates the sidebar brand before delegating to fallback selectPrinter in selectBrand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/const sidebarBrand = document\.getElementById\('sidebarBrand'\);/);
    expect(block).toMatch(/if \(sidebarBrand\) \{[\s\S]*sidebarBrand\.textContent = brand\.shortName \|\| brand\.name;[\s\S]*\}/);
    expect(block).not.toMatch(/selectPrinter\(fallbackPrinter\.id, true\)/);
  });

  it('does not auto-select a fallback printer when brand selection changes and no current printer belongs to that brand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/const printerList = getPrinterListByBrand\(brand\.id\);/);
    expect(block).toMatch(/const hasCurrentPrinter = printerList\.some\(\(printer\) => printer\.id === selectedPrinter\);/);
    expect(block).toMatch(/if \(!hasCurrentPrinter\) \{[\s\S]*selectedPrinter = null;[\s\S]*selectedVersion = null;[\s\S]*\}/);
    expect(block).toMatch(/if \(!hasCurrentPrinter\) \{[\s\S]*sidebarModelName\.textContent = '未选择';[\s\S]*\}/);
    expect(block).toMatch(/if \(!hasCurrentPrinter\) \{[\s\S]*updateSidebarVersionBadge\(selectedVersion\);[\s\S]*\}/);
    expect(block).not.toMatch(/const fallbackPrinter = getFirstSelectablePrinter\(brand\.id\);/);
  });

  it('refreshes the cleared version badge before re-persisting and rendering downloads in selectBrand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/selectedVersion = null;[\s\S]*updateSidebarVersionBadge\(selectedVersion\);[\s\S]*saveUserConfig\(\);[\s\S]*refreshHomeSelectionDownstream\(currentPrinter\);/);
  });

  it('keeps the non-fallback selectBrand path persisting and repainting home surfaces before rendering downloads', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/saveUserConfig\(\);[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);/);
    expect(block).toMatch(/refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*const currentPrinter = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
  });

  it('clears downstream download surfaces when selectBrand lands on a brand without a selectable printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/if \(!hasCurrentPrinter\) \{[\s\S]*selectedPrinter = null;[\s\S]*selectedVersion = null;[\s\S]*\}/);
    expect(block).toMatch(/const currentPrinter = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
    expect(block).toMatch(/if \(!hasCurrentPrinter\) \{[\s\S]*selectedPrinter = null;[\s\S]*\}/);
  });

  it('still persists and repaints the selected empty brand before clearing downstream download surfaces in selectBrand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/saveUserConfig\(\);[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*const currentPrinter = selectedPrinter \? getPrinterObj\(selectedPrinter\) : null;/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
  });

  it('keeps calibration refresh after either selectBrand download branch', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );

    expect(block).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
  });

  it('keeps selection-driven downstream refreshes on shared helpers', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const selectBrandBlock = source.slice(
      source.lastIndexOf('async function selectBrand('),
      source.lastIndexOf('function selectPrinter(')
    );
    const selectPrinterBlock = source.slice(
      source.lastIndexOf('function selectPrinter('),
      source.lastIndexOf('function generateCustomIdentifier(')
    );

    expect(selectBrandBlock).toMatch(/refreshHomeSelectionSurfaces\(selectedBrand\);/);
    expect(selectBrandBlock).toMatch(/refreshHomeSelectionDownstream\(currentPrinter\);/);
    expect(selectPrinterBlock).toMatch(/refreshHomeSelectionSurfaces\(selectedBrand\);/);
    expect(selectPrinterBlock).toMatch(/refreshHomeSelectionDownstream\(selectedPrinterObj\);/);
  });

  it('selects the next visible printer before scheduling compact-gallery scrolling in stepHomeGallery', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function stepHomeGallery(direction) {'),
      source.lastIndexOf('function renderPrinters(brandId = selectedBrand) {')
    );

    expect(block).toMatch(/const cards = getVisibleHomePrinterCards\(\);/);
    expect(block).toMatch(/const currentIndex = Math\.max\(0, cards\.findIndex\(\(card\) => card\.dataset\.printerId === selectedPrinter\)\);/);
    expect(block).toMatch(/const nextIndex = \(currentIndex \+ direction \+ cards\.length\) % cards\.length;/);
    expect(block).toMatch(/selectPrinter\(nextCard\.dataset\.printerId, true\);[\s\S]*requestAnimationFrame\(\(\) => scrollHomeGalleryToSelected\('smooth'\)\);/);
  });

  it('guards compact-gallery scrolling when no selected card is present', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function scrollHomeGalleryToSelected(behavior = \'smooth\') {'),
      source.lastIndexOf('function stepHomeGallery(direction) {')
    );

    expect(block).toMatch(/if \(homeViewMode !== 'compact'\) return;/);
    expect(block).toMatch(/const printerGrid = document\.getElementById\('printerGrid'\);/);
    expect(block).toMatch(/const selectedCard = printerGrid\?\.querySelector\('\.home-printer-card\.selected'\);/);
    expect(block).toMatch(/if \(!printerGrid \|\| !selectedCard\) return;/);
    expect(block).toMatch(/selectedCard\.scrollIntoView\(\{[\s\S]*behavior,[\s\S]*inline: 'center'[\s\S]*\}\);/);
  });

  it('bails out of stepHomeGallery when there are no visible printer cards', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function stepHomeGallery(direction) {'),
      source.lastIndexOf('function renderPrinters(brandId = selectedBrand) {')
    );

    expect(block).toMatch(/const cards = getVisibleHomePrinterCards\(\);/);
    expect(block).toMatch(/if \(!cards\.length\) return;/);
    expect(block).toMatch(/const nextCard = cards\[nextIndex\];/);
    expect(block).toMatch(/if \(!nextCard\?\.dataset\?\.printerId\) return;/);
  });

  it('re-renders printers and then schedules selected-card scrolling through renderPrinters', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(source.lastIndexOf('function renderPrinters(brandId = selectedBrand) {'));

    expect(block).toMatch(/function renderPrinters\(brandId = selectedBrand\) \{/);
    expect(block).toContain("home-printer-grid home-printer-grid-${homeViewMode}");
    expect(block).toMatch(/filteredPrinters\.forEach\(\(printer\) => \{/);
    expect(block).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]*scrollHomeGalleryToSelected\('auto'\);[\s\S]*\}\);/);
  });

  it('keeps the final active renderPrinters definition as the compact-gallery aware implementation', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const activeBlock = source.slice(source.lastIndexOf('function renderPrinters(brandId = selectedBrand) {'));

    expect(activeBlock).toMatch(/home-printer-grid home-printer-grid-\$\{homeViewMode\}/);
    expect(activeBlock).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]*scrollHomeGalleryToSelected\('auto'\);[\s\S]*\}\);/);
  });

  it('still contains historical duplicate render/render-bind definitions before the final active block', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');

    expect((source.match(/function renderBrands\(/g) || []).length).toBe(1);
    expect((source.match(/function buildPrinterCardMarkup\(/g) || []).length).toBe(1);
    expect((source.match(/function renderPrinters\(brandId = selectedBrand\)/g) || []).length).toBe(1);
    expect((source.match(/function bindContextMenu\(/g) || []).length).toBe(1);
  });

  it('keeps the final active bindContextMenu definition on the simplified control surface', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(source.lastIndexOf('function bindContextMenu() {'));

    expect(block).toMatch(/const compactBtn = document\.getElementById\('homeViewCompactBtn'\);/);
    expect(block).toMatch(/const detailedBtn = document\.getElementById\('homeViewDetailedBtn'\);/);
    expect(block).not.toMatch(/const prevBtn = document\.getElementById\('homeGalleryPrevBtn'\);/);
    expect(block).not.toMatch(/const nextBtn = document\.getElementById\('homeGalleryNextBtn'\);/);
    expect(block).not.toMatch(/const viewport = document\.getElementById\('homeGalleryViewport'\);/);
    expect(block).toMatch(/compactBtn\.addEventListener\('click', \(\) => setHomeViewMode\('compact'\)\);/);
    expect((source.match(/function bindContextMenu\(/g) || []).length).toBe(1);
  });

  it('clears downstream home surfaces when deleting the selected printer leaves no fallback printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function deleteTargetFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function handleHomeImageInputChange(event) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(selectedPrinter === location\.printer\.id\) \{/);
    expect(block).toMatch(/selectedPrinter = null;/);
    expect(block).toMatch(/selectedBrand = location\.brandId;/);
    expect(block).toMatch(/refreshHomeSelectionSurfaces\(location\.brandId\);/);
    expect(block).toMatch(/refreshEmptyHomeDownstreamSurfaces\(\);/);
  });

  it('keeps non-selected delete repaint on the shared selection-surface helper', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function deleteTargetFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function handleHomeImageInputChange(event) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/else \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*saveUserConfig\(\);[\s\S]*\}/);
  });

  it('clears downstream home surfaces when deleting a brand leaves no fallback brand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function deleteTargetFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('return;\n  }\n\n  const location = findPrinterLocation');
    const block = rest.slice(0, end);

    expect(block).toMatch(/const fallbackBrand = getFirstAvailableBrand\(\);/);
    expect(block).toMatch(/selectedBrand = fallbackBrand\?\.id \|\| null;/);
    expect(block).toMatch(/selectedPrinter = selectedBrand \? getFirstSelectablePrinter\(selectedBrand\)\?\.id \|\| null : null;/);
    expect(block).toMatch(/refreshHomeSelectionSurfaces\(selectedBrand\);/);
    expect(block).toMatch(/if \(selectedPrinter\) \s*\{[\s\S]*selectPrinter\(selectedPrinter, true\);[\s\S]*\}/);
    expect(block).toMatch(/else \s*\{[\s\S]*refreshEmptyHomeDownstreamSurfaces\(\);[\s\S]*\}/);
  });

  it('clears downstream home surfaces when addBrandFlow selects a new empty brand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function addBrandFlow() {'),
      source.lastIndexOf('async function addPrinterFlow(brandId) {')
    );

    expect(block).toMatch(/selectedBrand = id;/);
    expect(block).toMatch(/selectedPrinter = null;/);
    expect(block).toMatch(/refreshHomeSelectionSurfaces\(id\);/);
    expect(block).toMatch(/refreshEmptyHomeDownstreamSurfaces\(\);/);
  });

  it('keeps empty-home downstream clearing aligned on one shared helper', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const helperBlock = source.slice(
      source.lastIndexOf('function refreshEmptyHomeDownstreamSurfaces() {'),
      source.lastIndexOf('async function handleHomeImageInputChange(event) {')
    );

    expect(helperBlock).toMatch(/if \(typeof window\.renderDownloadVersions === 'function'\) \{[\s\S]*window\.renderDownloadVersions\(null\);[\s\S]*\}/);
    expect(helperBlock).toMatch(/if \(typeof window\.refreshCalibrationAvailability === 'function'\) \{[\s\S]*window\.refreshCalibrationAvailability\(\);[\s\S]*\}/);
    expect(helperBlock).toMatch(/saveUserConfig\(\);/);
  });

  it('routes empty-home downstream clears through the shared helper', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');

    const addBrandBlock = source.slice(
      source.lastIndexOf('async function addBrandFlow() {'),
      source.lastIndexOf('async function addPrinterFlow(brandId) {')
    );
    const deleteBlock = source.slice(
      source.lastIndexOf('async function deleteTargetFlow(target) {'),
      source.lastIndexOf('async function handleHomeImageInputChange(event) {')
    );

    expect(addBrandBlock).toMatch(/refreshEmptyHomeDownstreamSurfaces\(\);/);
    expect(deleteBlock).toMatch(/refreshEmptyHomeDownstreamSurfaces\(\);/);
  });

  it('refreshes sidebarBrand when renameTargetFlow renames the selected brand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('async function renameTargetFlow(target) {'),
      source.lastIndexOf('async function deleteTargetFlow(target) {')
    );

    expect(block).toMatch(/if \(isBrand\) \{[\s\S]*item\.name = displayName;[\s\S]*item\.shortName = displayName;[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*sidebarBrand\.textContent = item\.shortName \|\| item\.name;[\s\S]*saveUserConfig\(\);[\s\S]*\}/);
  });

  it('re-renders download versions when renameTargetFlow renames the selected brand with an active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function renameTargetFlow(target) {');
    const nextDelete = source.indexOf('async function deleteTargetFlow(target) {', start);
    const block = source.slice(start, nextDelete);

    expect(block).toMatch(/if \(isBrand && item\.id === selectedBrand\) \{[\s\S]*sidebarBrand\.textContent = item\.shortName \|\| item\.name;[\s\S]*\}/);
    expect(block).toMatch(/refreshSelectedBrandDownloadSurface\(target\);/);
  });

  it('re-renders download versions when handleHomeImageInputChange updates the selected brand with an active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function handleHomeImageInputChange(event) {');
    const nextHeader = source.indexOf('function updateHomeHeader(brandId = selectedBrand) {', start);
    const block = source.slice(start, nextHeader);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.image = result\.path;[\s\S]*brand\.avatarMode = 'custom';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('re-renders download versions when useGeneratedAvatarFlow updates the selected brand with an active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function useGeneratedAvatarFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('function getRestoreOriginalImageMenuState(item, itemType) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.avatarMode = 'generated';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
    expect(block).not.toMatch(/window\.renderDownloadVersions\(getPrinterObj\(selectedPrinter\)\)/);
  });

  it('re-renders download versions when restoreOriginalImageFlow updates the selected brand with an active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function restoreOriginalImageFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function setLabelModeFlow(target, mode) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.image = originalImage;[\s\S]*brand\.avatarMode = 'original';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('re-renders download versions when setLabelModeFlow updates the selected brand with an active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function setLabelModeFlow(target, mode) {');
    const rest = source.slice(start);
    const end = rest.indexOf('function getRestoreOriginalImageMenuState(item, itemType) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.labelMode = nextMode;[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('does not rely only on printer-specific selectPrinter when setLabelModeFlow updates the selected brand', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function setLabelModeFlow(target, mode) {');
    const rest = source.slice(start);
    const end = rest.indexOf('function getRestoreOriginalImageMenuState(item, itemType) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/refreshSelectedBrandDownloadSurface\(target\);/);
    expect(block).toMatch(/if \(selectedPrinter && typeof selectPrinter === 'function' && target\.type === 'printer' && target\.printerId === selectedPrinter\)/);
  });

  it('keeps brand avatar generation changes on the shared selected-brand download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function useGeneratedAvatarFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function handleHomeImageInputChange(event) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.avatarMode = 'generated';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps brand original-image restore changes on the shared selected-brand download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function restoreOriginalImageFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function setLabelModeFlow(target, mode) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.image = originalImage;[\s\S]*brand\.avatarMode = 'original';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps selected-brand label mode changes on the shared download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function setLabelModeFlow(target, mode) {');
    const rest = source.slice(start);
    const end = rest.indexOf('function getRestoreOriginalImageMenuState(item, itemType) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.labelMode = nextMode;[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps selected-brand mutations aligned on the same download-refresh guard', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');

    const ranges = [
      [
        source.lastIndexOf('async function toggleFavoriteFlow(target) {'),
        source.lastIndexOf('async function togglePinFlow(target) {')
      ],
      [
        source.lastIndexOf('async function togglePinFlow(target) {'),
        source.lastIndexOf('async function useGeneratedAvatarFlow(target) {')
      ],
      [
        source.lastIndexOf('async function useGeneratedAvatarFlow(target) {'),
        source.lastIndexOf('async function handleHomeImageInputChange(event) {')
      ],
      [
        source.lastIndexOf('async function handleHomeImageInputChange(event) {'),
        source.lastIndexOf('async function handleHomeContextAction(action) {')
      ],
      [
        source.lastIndexOf('async function restoreOriginalImageFlow(target) {'),
        source.lastIndexOf('async function setLabelModeFlow(target, mode) {')
      ],
      [
        source.lastIndexOf('async function setLabelModeFlow(target, mode) {'),
        source.lastIndexOf('function getRestoreOriginalImageMenuState(entity, itemType) {')
      ]
    ];

    const guards = ranges
      .filter(([start, end]) => start >= 0 && end > start)
      .map(([start, end]) => source.slice(start, end));

    guards.forEach((block) => {
      expect(block).toMatch(/refreshHomeSelectionSurfaces\(selectedBrand\);/);
      expect(block).toMatch(/refreshSelectedBrandDownloadSurface\(target\);/);
    });
  });

  it('routes refreshSelectedBrandDownloadSurface through the shared downstream helper with the active printer', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const block = source.slice(
      source.lastIndexOf('function refreshSelectedBrandDownloadSurface(target) {'),
      source.lastIndexOf('function refreshHomeSelectionSurfaces(brandId = selectedBrand) {')
    );

    expect(block).toMatch(/if \(target\?\.type === 'brand' && target\.brandId === selectedBrand && selectedPrinter\) \{/);
    expect(block).toMatch(/const activePrinter = getPrinterObj\(selectedPrinter\);/);
    expect(block).toMatch(/refreshHomeSelectionDownstream\(activePrinter\);/);
    expect(block).not.toMatch(/window\.renderDownloadVersions\(getPrinterObj\(selectedPrinter\)\)/);
  });

  it('keeps selected-brand favorite toggles on the shared download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function toggleFavoriteFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function togglePinFlow(target) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.favorite = !brand\.favorite;[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps selected-brand pin toggles on the shared download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function togglePinFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function useGeneratedAvatarFlow(target) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.pinned = !brand\.pinned;[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps selected-brand image upload changes on the shared download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function handleHomeImageInputChange(event) {');
    const rest = source.slice(start);
    const end = rest.indexOf('function updateHomeHeader(brandId = selectedBrand) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(target\.type === 'brand'\) \{[\s\S]*brand\.avatarMode = 'custom';[\s\S]*\}/);
    expect(block).toMatch(/if \(await persistCatalogWithFeedback\(\)\) \{[\s\S]*refreshHomeSelectionSurfaces\(selectedBrand\);[\s\S]*refreshSelectedBrandDownloadSurface\(target\);[\s\S]*\}/);
  });

  it('keeps selected-brand rename changes on the shared download refresh path', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');
    const start = source.lastIndexOf('async function renameTargetFlow(target) {');
    const rest = source.slice(start);
    const end = rest.indexOf('async function deleteTargetFlow(target) {');
    const block = rest.slice(0, end);

    expect(block).toMatch(/if \(isBrand && item\.id === selectedBrand\) \{[\s\S]*sidebarBrand\.textContent = item\.shortName \|\| item\.name;[\s\S]*(refreshSelectedBrandDownloadSurface\(target\)|window\.renderDownloadVersions\(getPrinterObj\(selectedPrinter\)\));[\s\S]*\}/);
  });

  it('exposes a shared sidebar selection sync helper for startup and storage-driven restores', () => {
    const source = readFileSync('D:/trae/MKP_SE/src/renderer/assets/js/home.js', 'utf8');

    expect(source).toMatch(/function syncSidebarSelectionState\(\) \{/);
    expect(source).toMatch(/sidebarBrand\.textContent = brand \? \(brand\.shortName \|\| brand\.name\) : '未选择品牌';/);
    expect(source).toMatch(/sidebarModelName\.textContent = printer \? \(printer\.shortName \|\| printer\.name\) : '未选择';/);
    expect(source).toMatch(/window\.syncSidebarSelectionState = syncSidebarSelectionState;/);
  });

  it('lets selected detailed-mode printer cards keep the hover flip interaction', () => {
    const styleSource = readFileSync('D:/trae/MKP_SE/src/renderer/assets/css/style.css', 'utf8');

    expect(styleSource).toMatch(/#page-home \.home-printer-card-detailed:hover \.home-printer-flip \{\s*transform: rotateY\(180deg\);\s*\}/);
    expect(styleSource).toMatch(/#page-home \.home-printer-card-detailed\.selected:hover \.home-printer-flip \{\s*transform: rotateY\(180deg\);\s*\}/);
  });
});
