function buildHomeContextItems(target) {
  if (!target) return [];

  if (target.type === 'brand') {
    const brand = getBrandById(target.brandId);
    if (!brand) return [];
    const restoreItem = getRestoreOriginalImageMenuState(brand, 'brand');

    return [
      { action: 'toggle-favorite', label: brand.favorite ? '取消收藏' : '收藏品牌' },
      { action: 'toggle-pin', label: brand.pinned ? '取消置顶' : '置顶品牌' },
      { type: 'separator' },
      { action: 'display-short', label: brand.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: brand.labelMode === 'short' },
      { action: 'display-full', label: brand.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: brand.labelMode === 'full' },
      { type: 'separator' },
      { action: 'add-brand', label: '新增品牌' },
      { action: 'add-printer', label: '新增机型' },
      { type: 'separator' },
      { action: 'rename', label: '重命名显示名称' },
      { action: 'avatar-default', label: '使用字母头像' },
      { action: 'restore-original-image', label: restoreItem.label, disabled: restoreItem.disabled },
      { action: 'avatar-upload', label: '上传图片' },
      { type: 'separator' },
      { action: 'delete', label: brand.canDelete ? '删除品牌' : '默认品牌不可删除', disabled: !brand.canDelete }
    ];
  }

  const printer = getPrinterObj(target.printerId);
  if (!printer) return [];
  const restoreItem = getRestoreOriginalImageMenuState(printer, 'printer');

  return [
    { action: 'toggle-favorite', label: printer.favorite ? '取消收藏' : '收藏机型' },
    { action: 'toggle-pin', label: printer.pinned ? '取消置顶' : '置顶机型' },
    { type: 'separator' },
    { action: 'display-short', label: printer.labelMode === 'short' ? '当前显示简称' : '显示简称', disabled: printer.labelMode === 'short' },
    { action: 'display-full', label: printer.labelMode === 'full' ? '当前显示全称' : '显示全称', disabled: printer.labelMode === 'full' },
    { type: 'separator' },
    { action: 'add-printer', label: '新增机型' },
    { action: 'copy-printer', label: '复制机型' },
    { type: 'separator' },
    { action: 'rename', label: '重命名显示名称' },
    { action: 'avatar-default', label: '使用字母头像' },
    { action: 'restore-original-image', label: restoreItem.label, disabled: restoreItem.disabled },
    { action: 'avatar-upload', label: '上传图片' },
    { type: 'separator' },
    { action: 'delete', label: printer.canDelete ? '删除机型' : '默认机型不可删除', disabled: !printer.canDelete }
  ];
}

function updateHomeHeader(brandId = selectedBrand) {
  const brand = getBrandById(brandId);
  const title = document.getElementById('currentBrandTitle');
  if (!title) return;

  if (!brand) {
    title.textContent = '未选择品牌';
    return;
  }

  const displayName = getEntityPrimaryName(brand) || brand.name || brand.shortName || brand.id;
  const printerCount = getPrinterListByBrand(brand.id).length;
  title.textContent = `${displayName} · ${printerCount} 个机型`;
}

function renderBrands() {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const brandList = document.getElementById('brandList');
  if (!brandList) return;

  brandList.innerHTML = sortCatalogItems(brands).map((brand) => {
    const secondaryName = homeViewMode === 'detailed'
      ? (getEntitySecondaryName(brand) || brand.subtitle || '')
      : '';
    const badgeMarkup = homeViewMode === 'detailed' ? getMetaBadgeMarkup(brand) : '';

    return `
      <button
        type="button"
        class="brand-card home-brand-card home-brand-row border text-left ${brand.id === selectedBrand ? 'active' : ''}"
        data-brand-id="${escapeHtml(brand.id)}"
      >
        <span class="block min-w-0 home-brand-copy">
          <span class="block truncate font-medium text-gray-900 dark:text-gray-100 home-brand-primary">${escapeHtml(getEntityPrimaryName(brand))}</span>
          ${secondaryName ? `<span class="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400 home-brand-secondary">${escapeHtml(secondaryName)}</span>` : ''}
          ${badgeMarkup ? `<span class="mt-2 flex flex-wrap gap-1 home-brand-badges">${badgeMarkup}</span>` : ''}
        </span>
      </button>
    `;
  }).join('');

  brandList.querySelectorAll('[data-brand-id]').forEach((card) => {
    card.addEventListener('click', () => {
      void selectBrand(card.dataset.brandId);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'brand', brandId: card.dataset.brandId });
    });
  });

  updateHomeHeader(selectedBrand);
  requestBrandPrefixVisibilitySync();
}

function buildPrinterCardMarkup(printer) {
  const title = getEntityPrimaryName(printer);
  const secondary = getEntitySecondaryName(printer);
  const versionMarkup = getVersionTagMarkup(printer);
  const badgeMarkup = getMetaBadgeMarkup(printer);
  const disabledMarkup = printer.disabled ? '<div class="home-printer-status">暂不可用</div>' : '';

  if (homeViewMode === 'detailed') {
    return `
      <div class="home-printer-flip">
        <div class="home-printer-face home-printer-face-front">
          <div class="home-printer-media">
            <span class="home-printer-avatar-shell">
              <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
            </span>
          </div>
          <div class="home-printer-front-copy">
            <div class="home-printer-name text-gray-900 dark:text-gray-100">${escapeHtml(title)}</div>
            ${secondary ? `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(secondary)}</div>` : ''}
          </div>
        </div>

        <div class="home-printer-face home-printer-face-back">
          <div>
            <div class="home-printer-back-top">
              <div class="min-w-0">
                <div class="home-printer-back-title truncate">${escapeHtml(title)}</div>
                ${secondary ? `<div class="home-printer-back-subtitle">${escapeHtml(secondary)}</div>` : ''}
              </div>
              ${disabledMarkup}
            </div>

            <div class="home-printer-back-label">支持版本</div>
            <div class="flex flex-wrap gap-2 home-printer-version-row">${versionMarkup}</div>

            ${badgeMarkup ? `
              <div class="home-printer-back-label">附加状态</div>
              <div class="flex flex-wrap gap-2 home-printer-back-meta">${badgeMarkup}</div>
            ` : ''}
          </div>

          <div class="text-xs text-gray-400 dark:text-gray-500">点击卡片选中，右键可管理该机型</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="home-printer-card-inner">
      <div class="home-printer-media">
        <span class="home-printer-avatar-shell">
          <img class="home-printer-avatar" src="${escapeHtml(getPrinterAvatar(printer))}" alt="${escapeHtml(title)}" draggable="false">
        </span>
      </div>
      <div class="home-printer-card-caption min-w-0">
        <div class="home-printer-name text-gray-900 dark:text-gray-100 truncate">${escapeHtml(title)}</div>
        <div class="mt-3 flex flex-wrap gap-2 home-printer-version-row">${versionMarkup}</div>
        ${printer.disabled ? '<div class="mt-3 home-printer-status">暂不可用</div>' : ''}
      </div>
    </div>
  `;
}

function getVisibleHomePrinterCards() {
  return Array.from(document.querySelectorAll('#printerGrid .home-printer-card[data-printer-id]'));
}

function scrollHomeGalleryToSelected(behavior = 'smooth') {
  if (homeViewMode !== 'compact') return;

  const printerGrid = document.getElementById('printerGrid');
  const selectedCard = printerGrid?.querySelector('.home-printer-card.selected');
  if (!printerGrid || !selectedCard) return;

  selectedCard.scrollIntoView({
    behavior,
    block: 'nearest',
    inline: 'center'
  });
}

function stepHomeGallery(direction) {
  const cards = getVisibleHomePrinterCards();
  if (!cards.length) return;

  const currentIndex = Math.max(0, cards.findIndex((card) => card.dataset.printerId === selectedPrinter));
  const nextIndex = (currentIndex + direction + cards.length) % cards.length;
  const nextCard = cards[nextIndex];
  if (!nextCard?.dataset?.printerId) return;

  selectPrinter(nextCard.dataset.printerId, true);
  requestAnimationFrame(() => scrollHomeGalleryToSelected('smooth'));
}

function renderPrinters(brandId = selectedBrand) {
  ensureValidHomeSelection();
  applyHomeViewMode();

  const printerGrid = document.getElementById('printerGrid');
  if (!printerGrid) return;

  const brand = getBrandById(brandId);
  if (!brand) {
    printerGrid.className = 'home-printer-grid home-printer-grid-empty';
    printerGrid.innerHTML = '<div class="home-empty-state">没有可显示的机型</div>';
    return;
  }

  const searchValue = (document.getElementById('printerSearch')?.value || '').trim().toLowerCase();
  const filteredPrinters = sortCatalogItems(getPrinterListByBrand(brand.id)).filter((printer) => {
    if (!searchValue) return true;
    return [printer.id, printer.name, printer.shortName, brand.name, brand.shortName]
      .join(' ')
      .toLowerCase()
      .includes(searchValue);
  });

  updateHomeHeader(brand.id);
  printerGrid.className = `home-printer-grid home-printer-grid-${homeViewMode}`;
  printerGrid.innerHTML = '';

  if (!filteredPrinters.length) {
    printerGrid.innerHTML = `
      <div class="home-empty-state">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">没有匹配的机型</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">可以清空搜索，或者右键品牌新增机型。</div>
      </div>
    `;
    return;
  }

  filteredPrinters.forEach((printer) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card home-printer-card home-printer-card-${homeViewMode} ${printer.id === selectedPrinter ? 'selected' : ''}`;
    card.dataset.printerId = printer.id;
    card.innerHTML = buildPrinterCardMarkup(printer);

    if (printer.disabled) {
      card.classList.add('printer-card-disabled');
      card.disabled = true;
    } else {
      card.addEventListener('click', () => {
        selectPrinter(printer.id, true);
      });
    }

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openHomeCatalogContextMenu(event, { type: 'printer', printerId: printer.id, brandId: brand.id });
    });

    printerGrid.appendChild(card);
  });

  requestAnimationFrame(() => {
    scrollHomeGalleryToSelected('auto');
  });
}

function bindContextMenu() {
  if (window.__homeCatalogContextMenuBound) return;
  window.__homeCatalogContextMenuBound = true;

  const menu = document.getElementById(HOME_CONTEXT_MENU_ID);
  const imageInput = document.getElementById(HOME_IMAGE_INPUT_ID);
  const compactBtn = document.getElementById('homeViewCompactBtn');
  const detailedBtn = document.getElementById('homeViewDetailedBtn');
  const prevBtn = document.getElementById('homeGalleryPrevBtn');
  const nextBtn = document.getElementById('homeGalleryNextBtn');
  const viewport = document.getElementById('homeGalleryViewport');
  if (!menu) return;

  if (typeof window.bindFloatingSurfaceAutoDismiss === 'function') {
    window.bindFloatingSurfaceAutoDismiss();
  }

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    void handleHomeContextAction(button.dataset.action);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest(`#${HOME_CONTEXT_MENU_ID}`)) {
      closeHomeCatalogContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHomeCatalogContextMenu();
    }
  });

  if (imageInput) {
    imageInput.addEventListener('change', (event) => {
      void handleHomeImageInputChange(event);
    });
  }

  if (compactBtn) {
    compactBtn.addEventListener('click', () => {
      setHomeViewMode('compact');
      requestAnimationFrame(() => scrollHomeGalleryToSelected('auto'));
    });
  }

  if (detailedBtn) {
    detailedBtn.addEventListener('click', () => {
      setHomeViewMode('detailed');
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stepHomeGallery(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stepHomeGallery(1);
    });
  }

  if (viewport) {
    viewport.addEventListener('wheel', (event) => {
      const printerGrid = document.getElementById('printerGrid');
      if (homeViewMode !== 'compact' || !printerGrid) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      printerGrid.scrollBy({
        left: event.deltaY,
        behavior: 'auto'
      });
    }, { passive: false });
  }

  applyHomeViewMode();
}

window.renderBrands = renderBrands;
window.renderPrinters = renderPrinters;
window.bindContextMenu = bindContextMenu;
