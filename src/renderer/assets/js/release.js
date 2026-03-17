(function() {
  const MODE_LABELS = {
    '1': '最小热更新',
    '2': '标准热更新',
    '3': '完整热更新',
    '4': '全量安装包'
  };

  const state = {
    loaded: false,
    activePanel: 'release',
    previewMode: 'edit',
    editorExpanded: false,
    currentInfo: null,
    lastSummary: '',
    selectedMode: '2',
    configLoaded: false,
    config: {
      brands: [],
      printersByBrand: {},
      presets: [],
      paths: {},
      selectedBrandId: null,
      selectedPrinterId: null,
      selectedEntityType: 'brand',
      activePresetFile: null,
      activePresetOriginalFile: null,
      activePresetEntry: null
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toAssetUrl(value) {
    return String(value || '').trim() || 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="28" fill="#dbeafe"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="42" font-family="Segoe UI, Arial" fill="#2563eb">MKP</text></svg>');
  }

  function appendConsole(message) {
    const output = $('releaseConsoleOutput');
    if (!output) return;
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    output.textContent += `[${stamp}] ${message}\n`;
    output.scrollTop = output.scrollHeight;
  }

  function setStatus(text, tone = 'idle') {
    const pill = $('releaseStatusPill');
    if (!pill) return;
    const palette = {
      idle: 'bg-gray-100 text-gray-500',
      success: 'bg-emerald-50 text-emerald-600',
      warning: 'bg-amber-50 text-amber-700',
      error: 'bg-rose-50 text-rose-600'
    };
    pill.className = `mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${palette[tone] || palette.idle}`;
    pill.textContent = text;
  }

  function setBuildBadge(text, tone = 'idle') {
    const badge = $('releaseBuildBadge');
    if (!badge) return;
    const palette = {
      idle: 'bg-gray-100 text-gray-500',
      running: 'bg-blue-50 text-blue-600',
      success: 'bg-emerald-50 text-emerald-600',
      error: 'bg-rose-50 text-rose-600'
    };
    badge.className = `mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${palette[tone] || palette.idle}`;
    badge.textContent = text;
  }

  function formatInlineMarkdown(text) {
    let safe = escapeHtml(text);
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return safe;
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    const html = [];
    let listType = null;

    const closeList = () => {
      if (!listType) return;
      html.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        html.push('<div class="markdown-spacer"></div>');
        return;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = Math.min(6, heading[1].length);
        html.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
        return;
      }

      const bullet = line.match(/^[-*+]\s+(.+)$/);
      if (bullet) {
        if (listType !== 'ul') {
          closeList();
          listType = 'ul';
          html.push('<ul>');
        }
        html.push(`<li>${formatInlineMarkdown(bullet[1])}</li>`);
        return;
      }

      const ordered = line.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        if (listType !== 'ol') {
          closeList();
          listType = 'ol';
          html.push('<ol>');
        }
        html.push(`<li>${formatInlineMarkdown(ordered[1])}</li>`);
        return;
      }

      closeList();
      html.push(`<p>${formatInlineMarkdown(line)}</p>`);
    });

    closeList();
    return html.join('');
  }

  function renderPathsInfo(info) {
    const container = $('releasePathsInfo');
    if (!container || !info?.paths) return;
    const rows = [
      ['项目目录', info.paths.projectRoot],
      ['cloud_data', info.paths.cloudDataDir],
      ['上传目录', info.paths.uploadCloudDataDir],
      ['默认机型表', state.config.paths?.dataJsPath || '--'],
      ['默认预设目录', state.config.paths?.presetsDir || '--']
    ];

    container.innerHTML = rows.map(([label, value]) => `
      <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">${escapeHtml(label)}</div>
        <div class="mt-2 break-all font-mono text-[12px] text-gray-600">${escapeHtml(value || '--')}</div>
      </div>
    `).join('');
  }

  function fillReleaseForm(info) {
    $('releaseVersionInput').value = info.version || '';
    $('releaseDateInput').value = info.releaseDate || new Date().toISOString().slice(0, 10);
    $('releaseShortDescInput').value = info.shortDesc || '';
    $('releaseForceUpdateInput').checked = !!info.forceUpdate;
    $('releaseCanRollbackInput').checked = info.canRollback !== false;
    $('releaseNotesInput').value = info.releaseNotesMarkdown || '';
    renderReleasePreview();
    renderPathsInfo(info);
  }

  function collectReleasePayload() {
    return {
      version: $('releaseVersionInput').value.trim(),
      releaseDate: $('releaseDateInput').value,
      shortDesc: $('releaseShortDescInput').value.trim(),
      forceUpdate: $('releaseForceUpdateInput').checked,
      canRollback: $('releaseCanRollbackInput').checked,
      releaseNotesMarkdown: $('releaseNotesInput').value
    };
  }

  function setPreviewMode(mode) {
    state.previewMode = mode === 'preview' ? 'preview' : 'edit';
    $('btnMarkdownEditMode').classList.toggle('active', state.previewMode === 'edit');
    $('btnMarkdownPreviewMode').classList.toggle('active', state.previewMode === 'preview');
    $('releaseNotesInput').classList.toggle('hidden', state.previewMode !== 'edit');
    $('releaseMarkdownPreview').classList.toggle('hidden', state.previewMode !== 'preview');
  }

  function setEditorExpanded(expanded) {
    state.editorExpanded = !!expanded;
    $('releaseEditorCard').classList.toggle('is-expanded', state.editorExpanded);
    $('releaseEditorSurface').classList.toggle('is-expanded', state.editorExpanded);
    $('releaseNotesInput').classList.toggle('is-expanded', state.editorExpanded);
    $('releaseMarkdownPreview').classList.toggle('is-expanded', state.editorExpanded);
    $('btnToggleEditorSize').textContent = state.editorExpanded ? '收起编辑区' : '展开编辑区';
  }

  function renderReleasePreview() {
    const preview = $('releaseMarkdownPreview');
    const input = $('releaseNotesInput');
    if (!preview || !input) return;
    preview.innerHTML = renderMarkdown(input.value) || '<p>暂无内容</p>';
  }

  function updateSelectedModeUI() {
    document.querySelectorAll('.release-mode-btn').forEach((button) => {
      const selected = button.dataset.releaseMode === state.selectedMode;
      button.classList.toggle('selected', selected);
      button.classList.toggle('border-blue-200', selected);
      button.classList.toggle('bg-blue-50/80', selected);
      const check = button.querySelector('.release-mode-check');
      if (check) {
        check.classList.toggle('border-blue-500', selected);
      }
    });
    $('selectedReleaseModeLabel').textContent = MODE_LABELS[state.selectedMode] || state.selectedMode;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  async function openReleasePath(target) {
    const result = await window.mkpAPI.openReleasePath(target);
    if (!result?.success) {
      throw new Error(result?.error || '打开路径失败');
    }
    appendConsole(`已打开 ${result.path}`);
  }

  async function loadReleaseInfo() {
    setStatus('正在读取发版信息...', 'idle');
    const result = await window.mkpAPI.readReleaseInfo();
    if (!result?.success) {
      setStatus(`读取失败: ${result?.error || '未知错误'}`, 'error');
      appendConsole(`读取发版信息失败: ${result?.error || '未知错误'}`);
      return;
    }

    state.currentInfo = result.data;
    fillReleaseForm(result.data);
    renderPathsInfo(result.data);
    setStatus(`已读取当前版本 v${result.data.version}`, 'success');
    appendConsole(`已加载当前发版信息 v${result.data.version}`);
  }

  async function saveReleaseInfo(options = {}) {
    const result = await window.mkpAPI.saveReleaseInfo(collectReleasePayload());
    if (!result?.success) {
      setStatus(`保存失败: ${result?.error || '未知错误'}`, 'error');
      appendConsole(`保存发版信息失败: ${result?.error || '未知错误'}`);
      if (!options.quiet) window.alert(result?.error || '保存失败');
      return null;
    }

    state.currentInfo = {
      ...(state.currentInfo || {}),
      ...result.data
    };
    setStatus(`已保存 v${result.data.version}`, 'success');
    appendConsole(`发版信息已保存，版本 v${result.data.version}`);
    return result.data;
  }

  async function runBuild(mode) {
    const modeLabel = MODE_LABELS[String(mode)] || String(mode);
    const saved = await saveReleaseInfo({ quiet: true });
    if (!saved) return;

    setBuildBadge(`执行中: ${modeLabel}`, 'running');
    appendConsole(`开始执行 ${modeLabel}`);

    try {
      const result = await window.mkpAPI.runReleaseBuild(String(mode));
      if (!result?.success) {
        throw new Error(result?.error || '打包失败');
      }

      const data = result.data || {};
      const summary = [
        `模式: ${modeLabel}`,
        data.version ? `版本: v${data.version}` : '',
        data.patchPath ? `补丁: ${data.patchPath}` : '',
        data.uploadCloudDataDir ? `上传目录: ${data.uploadCloudDataDir}` : '',
        data.distDir ? `安装包目录: ${data.distDir}` : '',
        Number.isFinite(data.changedCount) ? `包含文件: ${data.changedCount}` : ''
      ].filter(Boolean);

      state.lastSummary = summary.join('\n');
      summary.forEach((line) => appendConsole(line));
      setBuildBadge(`${modeLabel}完成`, 'success');
      setStatus(`${modeLabel}执行完成`, 'success');
    } catch (error) {
      setBuildBadge(`${modeLabel}失败`, 'error');
      setStatus(`${modeLabel}失败`, 'error');
      appendConsole(`打包失败: ${error.message}`);
      window.alert(error.message);
    }
  }

  function sanitizeId(value, prefix) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || `${prefix}_${Date.now()}`;
  }

  function getConfigBrands() {
    return Array.isArray(state.config.brands) ? state.config.brands : [];
  }

  function getConfigPrinters(brandId = state.config.selectedBrandId) {
    return Array.isArray(state.config.printersByBrand?.[brandId]) ? state.config.printersByBrand[brandId] : [];
  }

  function getSelectedBrand() {
    return getConfigBrands().find((brand) => brand.id === state.config.selectedBrandId) || null;
  }

  function getSelectedPrinter() {
    return getConfigPrinters().find((printer) => printer.id === state.config.selectedPrinterId) || null;
  }

  function setActivePanel(panel) {
    state.activePanel = panel === 'config' ? 'config' : 'release';
    $('panelReleaseCenter').classList.toggle('hidden', state.activePanel !== 'release');
    $('panelDefaultResources').classList.toggle('hidden', state.activePanel !== 'config');
    $('tabReleaseCenter').classList.toggle('active', state.activePanel === 'release');
    $('tabDefaultResources').classList.toggle('active', state.activePanel === 'config');
  }

  function renderConfigBrandList() {
    const container = $('configBrandList');
    if (!container) return;
    const brands = getConfigBrands();

    container.innerHTML = brands.map((brand) => {
      const printerCount = getConfigPrinters(brand.id).length;
      const active = brand.id === state.config.selectedBrandId;
      return `
        <button type="button" class="brand-card home-brand-card w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left ${active ? 'active border-gray-200' : 'border-gray-200/80'}" data-config-brand="${escapeHtml(brand.id)}">
          <span class="home-brand-avatar-shell"><img class="home-brand-avatar" src="${escapeHtml(toAssetUrl(brand.image))}" alt="${escapeHtml(brand.name)}"></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-gray-900">${escapeHtml(brand.name)}</span>
            <span class="mt-1 block truncate text-xs text-gray-500">${escapeHtml(brand.subtitle || `${printerCount} 个机型`)}</span>
          </span>
        </button>
      `;
    }).join('');
  }

  function renderConfigPrinterList() {
    const container = $('configPrinterList');
    if (!container) return;
    const printers = getConfigPrinters();

    if (!state.config.selectedBrandId) {
      container.innerHTML = '<div class="home-empty-state md:col-span-2 xl:col-span-3">请先选择品牌。</div>';
      return;
    }

    if (!printers.length) {
      container.innerHTML = '<div class="home-empty-state md:col-span-2 xl:col-span-3">当前品牌还没有默认机型。</div>';
      return;
    }

    container.innerHTML = printers.map((printer) => {
      const active = printer.id === state.config.selectedPrinterId;
      const versions = Array.isArray(printer.supportedVersions) ? printer.supportedVersions.join(', ') : '';
      return `
        <button type="button" class="select-card home-printer-card rounded-2xl border p-4 text-left ${active ? 'selected' : 'border-gray-200'}" data-config-printer="${escapeHtml(printer.id)}">
          <div class="home-printer-media">
            <span class="home-printer-avatar-shell"><img class="home-printer-avatar" src="${escapeHtml(toAssetUrl(printer.image))}" alt="${escapeHtml(printer.shortName || printer.name)}"></span>
          </div>
          <div class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(printer.shortName || printer.name)}</div>
          <div class="mt-1 text-xs text-gray-500 truncate">${escapeHtml(printer.name || '')}</div>
          <div class="mt-3 text-[11px] text-gray-400 truncate">${escapeHtml(versions || '未配置版本')}</div>
        </button>
      `;
    }).join('');
  }

  function renderConfigEditor() {
    const brand = getSelectedBrand();
    const printer = getSelectedPrinter();
    const isPrinter = state.config.selectedEntityType === 'printer' && !!printer;
    const entity = isPrinter ? printer : brand;
    const imagePreview = $('configEntityImagePreview');
    const imagePath = $('configEntityImagePath');

    $('configEditorKind').textContent = entity ? (isPrinter ? '机型编辑' : '品牌编辑') : '未选择';
    $('configEntityIdInput').value = entity?.id || '';
    $('configEntityNameInput').value = isPrinter ? (entity?.shortName || '') : (entity?.name || '');
    $('configEntitySubtitleInput').value = isPrinter ? (entity?.name || '') : (entity?.subtitle || '');
    $('configEntityVersionsInput').value = isPrinter ? (Array.isArray(entity?.supportedVersions) ? entity.supportedVersions.join(',') : '') : '';
    $('configEntityPresetsInput').value = isPrinter ? JSON.stringify(entity?.defaultPresets || {}, null, 2) : '';
    $('configEntityVersionsInput').disabled = !isPrinter;
    $('configEntityPresetsInput').disabled = !isPrinter;
    $('btnDeleteConfigEntity').disabled = !entity;
    if (imagePreview) imagePreview.src = toAssetUrl(entity?.image);
    if (imagePath) imagePath.textContent = entity?.image || '未设置';
  }

  async function loadReleaseConfig() {
    const result = await window.mkpAPI.readReleaseConfig();
    if (!result?.success) {
      setStatus(`默认资源读取失败: ${result?.error || '未知错误'}`, 'error');
      appendConsole(`默认资源读取失败: ${result?.error || '未知错误'}`);
      return;
    }

    state.configLoaded = true;
    state.config.brands = cloneValue(result.data.brands || []);
    state.config.printersByBrand = cloneValue(result.data.printersByBrand || {});
    state.config.presets = cloneValue(result.data.presets || []);
    state.config.paths = cloneValue(result.data.paths || {});
    state.config.selectedBrandId = state.config.selectedBrandId || state.config.brands[0]?.id || null;
    state.config.selectedPrinterId = getConfigPrinters(state.config.selectedBrandId)[0]?.id || null;
    state.config.selectedEntityType = 'brand';
    renderConfigBrandList();
    renderConfigPrinterList();
    renderConfigEditor();
    renderPresetList();
    renderPathsInfo(state.currentInfo || { paths: {} });
    appendConsole('已加载默认资源配置');
  }

  function updateCurrentEntityFromEditor() {
    const brand = getSelectedBrand();
    const printer = getSelectedPrinter();
    const isPrinter = state.config.selectedEntityType === 'printer' && !!printer;
    const entity = isPrinter ? printer : brand;
    if (!entity) return;

    const nextId = sanitizeId($('configEntityIdInput').value, isPrinter ? 'printer' : 'brand');
    if (isPrinter && entity.id !== nextId) {
      entity.id = nextId;
      state.config.selectedPrinterId = nextId;
    }
    if (!isPrinter && entity.id !== nextId) {
      const previousId = entity.id;
      entity.id = nextId;
      state.config.printersByBrand[nextId] = (state.config.printersByBrand[previousId] || []).map((item) => ({
        ...item,
        brandId: nextId
      }));
      delete state.config.printersByBrand[previousId];
      state.config.selectedBrandId = nextId;
    }

    if (isPrinter) {
      entity.shortName = $('configEntityNameInput').value.trim();
      entity.name = $('configEntitySubtitleInput').value.trim() || entity.shortName;
      entity.supportedVersions = $('configEntityVersionsInput').value.split(',').map((item) => item.trim()).filter(Boolean);
      try {
        entity.defaultPresets = $('configEntityPresetsInput').value.trim() ? JSON.parse($('configEntityPresetsInput').value) : {};
      } catch (error) {}
    } else {
      entity.name = $('configEntityNameInput').value.trim();
      entity.shortName = entity.name;
      entity.subtitle = $('configEntitySubtitleInput').value.trim();
    }
  }

  async function saveCatalogConfig() {
    updateCurrentEntityFromEditor();
    const result = await window.mkpAPI.saveReleaseConfigCatalog({
      brands: state.config.brands,
      printersByBrand: state.config.printersByBrand
    });

    if (!result?.success) {
      setStatus(`默认机型数据保存失败: ${result?.error || '未知错误'}`, 'error');
      window.alert(result?.error || '默认机型数据保存失败');
      return;
    }

    state.config.brands = cloneValue(result.data.brands || []);
    state.config.printersByBrand = cloneValue(result.data.printersByBrand || {});
    state.config.presets = cloneValue(result.data.presets || state.config.presets);
    state.config.paths = cloneValue(result.data.paths || state.config.paths);
    renderConfigBrandList();
    renderConfigPrinterList();
    renderConfigEditor();
    renderPathsInfo(state.currentInfo || { paths: {} });
    setStatus('默认机型数据已保存到 data.js', 'success');
    appendConsole('默认机型数据已写入 data.js');
  }

  function addConfigBrand() {
    const input = window.prompt('请输入新品牌的显示名称');
    if (!input) return;
    const name = input.trim();
    if (!name) return;
    const id = sanitizeId(name, 'brand');
    state.config.brands.push({
      id,
      name,
      shortName: name,
      subtitle: '',
      favorite: false,
      image: ''
    });
    state.config.printersByBrand[id] = [];
    state.config.selectedBrandId = id;
    state.config.selectedPrinterId = null;
    state.config.selectedEntityType = 'brand';
    renderConfigBrandList();
    renderConfigPrinterList();
    renderConfigEditor();
  }

  function addConfigPrinter() {
    if (!state.config.selectedBrandId) {
      window.alert('请先选择一个品牌。');
      return;
    }
    const input = window.prompt('请输入新机型的显示名称');
    if (!input) return;
    const shortName = input.trim();
    if (!shortName) return;
    const printer = {
      id: sanitizeId(shortName, state.config.selectedBrandId),
      name: shortName,
      shortName,
      image: '',
      favorite: false,
      disabled: false,
      supportedVersions: ['standard'],
      defaultPresets: {}
    };
    getConfigPrinters().push(printer);
    state.config.selectedPrinterId = printer.id;
    state.config.selectedEntityType = 'printer';
    renderConfigPrinterList();
    renderConfigEditor();
  }

  function deleteCurrentConfigEntity() {
    if (state.config.selectedEntityType === 'printer' && state.config.selectedPrinterId) {
      const printers = getConfigPrinters();
      const index = printers.findIndex((item) => item.id === state.config.selectedPrinterId);
      if (index >= 0) printers.splice(index, 1);
      state.config.selectedPrinterId = printers[0]?.id || null;
      state.config.selectedEntityType = state.config.selectedPrinterId ? 'printer' : 'brand';
      renderConfigPrinterList();
      renderConfigEditor();
      return;
    }

    if (state.config.selectedBrandId) {
      state.config.brands = state.config.brands.filter((brand) => brand.id !== state.config.selectedBrandId);
      delete state.config.printersByBrand[state.config.selectedBrandId];
      state.config.selectedBrandId = state.config.brands[0]?.id || null;
      state.config.selectedPrinterId = getConfigPrinters(state.config.selectedBrandId)[0]?.id || null;
      state.config.selectedEntityType = state.config.selectedPrinterId ? 'printer' : 'brand';
      renderConfigBrandList();
      renderConfigPrinterList();
      renderConfigEditor();
    }
  }

  async function importConfigImage(file) {
    if (!file) return;
    const readerResult = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

    const target = state.config.selectedEntityType === 'printer' ? getSelectedPrinter() : getSelectedBrand();
    if (!target) return;

    const result = await window.mkpAPI.importReleaseConfigImage({
      itemType: state.config.selectedEntityType,
      itemId: target.id,
      fileBaseName: target.id,
      dataUrl: readerResult
    });

    if (!result?.success) {
      window.alert(result?.error || '图片导入失败');
      return;
    }

    target.image = result.data.relativePath;
    renderConfigBrandList();
    renderConfigPrinterList();
    renderConfigEditor();
    appendConsole(`默认资源图片已处理为 webp: ${result.data.relativePath}`);
  }

  function getFilteredPresets() {
    const keyword = $('presetSearchInput')?.value?.trim().toLowerCase() || '';
    const list = Array.isArray(state.config.presets) ? state.config.presets : [];
    if (!keyword) return list;
    return list.filter((item) => [item.file, item.id, item.type, item.version, item.description].join(' ').toLowerCase().includes(keyword));
  }

  function renderPresetList() {
    const container = $('configPresetList');
    if (!container) return;
    const presets = getFilteredPresets();

    if (!presets.length) {
      container.innerHTML = '<div class="home-empty-state">没有匹配的默认预设。</div>';
      return;
    }

    container.innerHTML = presets.map((item) => `
      <button type="button" class="brand-card home-brand-card w-full rounded-2xl border px-3 py-3 text-left ${item.file === state.config.activePresetFile ? 'active border-gray-200' : 'border-gray-200/80'}" data-preset-file="${escapeHtml(item.file)}">
        <div class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(item.file)}</div>
        <div class="mt-1 text-xs text-gray-500 truncate">${escapeHtml(`${item.id} · ${item.type} · ${item.version || '--'}`)}</div>
      </button>
    `).join('');
  }

  function fillPresetEditor(entry, data, originalFileName) {
    state.config.activePresetFile = entry?.file || null;
    state.config.activePresetOriginalFile = originalFileName || entry?.file || null;
    state.config.activePresetEntry = entry ? cloneValue(entry) : null;
    $('presetFileNameInput').value = entry?.file || '';
    $('presetIdInput').value = entry?.id || '';
    $('presetTypeInput').value = entry?.type || '';
    $('presetVersionInput').value = entry?.version || data?.version || '';
    $('presetDescriptionInput').value = entry?.description || '';
    $('presetReleaseNotesInput').value = Array.isArray(entry?.releaseNotes) ? entry.releaseNotes.join('\n') : '';
    $('presetJsonEditor').value = JSON.stringify(data || {}, null, 2);
    renderPresetList();
  }

  async function selectPreset(fileName) {
    const result = await window.mkpAPI.readReleaseConfigPreset(fileName);
    if (!result?.success) {
      window.alert(result?.error || '读取预设失败');
      return;
    }
    fillPresetEditor(result.data.entry, result.data.data, result.data.fileName);
    appendConsole(`已打开默认预设 ${result.data.fileName}`);
  }

  function createEmptyPreset() {
    fillPresetEditor({
      file: '',
      id: '',
      type: '',
      version: '',
      description: '',
      releaseNotes: []
    }, {
      version: '',
      presets: {}
    }, null);
  }

  function duplicatePreset() {
    const currentName = $('presetFileNameInput').value.trim();
    if (!currentName) {
      window.alert('请先选择一个预设。');
      return;
    }
    let currentJson = {};
    try {
      currentJson = JSON.parse($('presetJsonEditor').value || '{}');
    } catch (error) {
      window.alert(`当前 JSON 格式错误，无法复制: ${error.message}`);
      return;
    }
    const nextName = window.prompt('请输入新的预设文件名（英文，需以 .json 结尾）', currentName.replace(/\.json$/i, '_copy.json'));
    if (!nextName) return;
    fillPresetEditor({
      file: nextName.trim(),
      id: $('presetIdInput').value.trim(),
      type: $('presetTypeInput').value.trim(),
      version: $('presetVersionInput').value.trim(),
      description: $('presetDescriptionInput').value.trim(),
      releaseNotes: $('presetReleaseNotesInput').value.split('\n').map((item) => item.trim()).filter(Boolean)
    }, currentJson, null);
  }

  async function savePreset() {
    let parsedJson;
    try {
      parsedJson = JSON.parse($('presetJsonEditor').value || '{}');
    } catch (error) {
      window.alert(`JSON 格式错误: ${error.message}`);
      return;
    }

    const payload = {
      originalFileName: state.config.activePresetOriginalFile,
      fileName: $('presetFileNameInput').value.trim(),
      meta: {
        id: $('presetIdInput').value.trim(),
        type: $('presetTypeInput').value.trim(),
        version: $('presetVersionInput').value.trim(),
        description: $('presetDescriptionInput').value.trim(),
        releaseNotes: $('presetReleaseNotesInput').value.split('\n').map((item) => item.trim()).filter(Boolean)
      },
      data: parsedJson
    };

    const result = await window.mkpAPI.saveReleaseConfigPreset(payload);
    if (!result?.success) {
      window.alert(result?.error || '默认预设保存失败');
      return;
    }

    appendConsole(`默认预设已保存: ${result.data.fileName}`);
    await loadReleaseConfig();
    await selectPreset(result.data.fileName);
    setStatus('默认预设已写入 cloud_data/presets', 'success');
  }

  function bindEvents() {
    $('tabReleaseCenter').addEventListener('click', () => setActivePanel('release'));
    $('tabDefaultResources').addEventListener('click', () => setActivePanel('config'));
    $('btnReloadReleaseInfo').addEventListener('click', async () => {
      await loadReleaseInfo();
      await loadReleaseConfig();
    });

    $('btnOpenManifest').addEventListener('click', async () => {
      try { await openReleasePath('manifest'); } catch (error) { window.alert(error.message); }
    });
    $('btnOpenCloudOutput').addEventListener('click', async () => {
      try { await openReleasePath('cloud'); } catch (error) { window.alert(error.message); }
    });
    $('btnOpenDistOutput').addEventListener('click', async () => {
      try { await openReleasePath('dist'); } catch (error) { window.alert(error.message); }
    });
    $('btnOpenReleaseReadme').addEventListener('click', async () => {
      try { await openReleasePath('readme'); } catch (error) { window.alert(error.message); }
    });

    $('btnMarkdownEditMode').addEventListener('click', () => setPreviewMode('edit'));
    $('btnMarkdownPreviewMode').addEventListener('click', () => {
      renderReleasePreview();
      setPreviewMode('preview');
    });
    $('btnToggleEditorSize').addEventListener('click', () => setEditorExpanded(!state.editorExpanded));
    $('releaseNotesInput').addEventListener('input', renderReleasePreview);
    $('btnSaveReleaseInfo').addEventListener('click', async () => { await saveReleaseInfo(); });
    $('btnRunSelectedMode').addEventListener('click', async () => { await runBuild(state.selectedMode); });
    $('btnCopyReleaseSummary').addEventListener('click', async () => {
      if (!state.lastSummary) {
        window.alert('当前还没有可复制的打包摘要。');
        return;
      }
      await copyText(state.lastSummary);
      appendConsole('已复制打包摘要');
    });

    document.querySelectorAll('.release-mode-btn').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedMode = button.dataset.releaseMode || '2';
        updateSelectedModeUI();
      });
    });

    $('btnAddConfigBrand').addEventListener('click', addConfigBrand);
    $('btnAddConfigPrinter').addEventListener('click', addConfigPrinter);
    $('btnDeleteConfigEntity').addEventListener('click', deleteCurrentConfigEntity);
    $('btnSaveConfigCatalog').addEventListener('click', async () => { await saveCatalogConfig(); });
    $('btnUploadConfigImage').addEventListener('click', () => $('releaseConfigImageInput').click());
    $('releaseConfigImageInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      await importConfigImage(file);
    });

    ['configEntityNameInput', 'configEntitySubtitleInput', 'configEntityVersionsInput', 'configEntityPresetsInput'].forEach((id) => {
      $(id).addEventListener('input', () => {
        updateCurrentEntityFromEditor();
        renderConfigBrandList();
        renderConfigPrinterList();
      });
    });
    $('configEntityIdInput').addEventListener('blur', () => {
      updateCurrentEntityFromEditor();
      renderConfigBrandList();
      renderConfigPrinterList();
      renderConfigEditor();
    });

    $('configBrandList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-config-brand]');
      if (!button) return;
      state.config.selectedBrandId = button.dataset.configBrand;
      state.config.selectedPrinterId = getConfigPrinters(state.config.selectedBrandId)[0]?.id || null;
      state.config.selectedEntityType = 'brand';
      renderConfigBrandList();
      renderConfigPrinterList();
      renderConfigEditor();
    });

    $('configPrinterList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-config-printer]');
      if (!button) return;
      state.config.selectedPrinterId = button.dataset.configPrinter;
      state.config.selectedEntityType = 'printer';
      renderConfigPrinterList();
      renderConfigEditor();
    });

    $('presetSearchInput').addEventListener('input', renderPresetList);
    $('configPresetList').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-preset-file]');
      if (!button) return;
      await selectPreset(button.dataset.presetFile);
    });
    $('btnCreatePreset').addEventListener('click', createEmptyPreset);
    $('btnDuplicatePreset').addEventListener('click', duplicatePreset);
    $('btnSavePreset').addEventListener('click', async () => { await savePreset(); });

    document.addEventListener('keydown', async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (state.activePanel === 'config' && $('presetJsonEditor') === document.activeElement) {
          await savePreset();
        } else if (state.activePanel === 'config') {
          await saveCatalogConfig();
        } else {
          await saveReleaseInfo();
        }
      }
    });
  }

  async function init() {
    if (state.loaded) return;
    state.loaded = true;
    setActivePanel('release');
    setPreviewMode('edit');
    setEditorExpanded(false);
    updateSelectedModeUI();
    bindEvents();
    renderReleasePreview();
    await loadReleaseInfo();
    await loadReleaseConfig();
    if (state.config.presets[0]?.file) {
      await selectPreset(state.config.presets[0].file);
    } else {
      createEmptyPreset();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
