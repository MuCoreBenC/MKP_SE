export const MODE_LABELS = {
  '1': '最小热更新',
  '2': '标准热更新',
  '3': '完整热更新',
  '4': '全量安装包',
};

export function parseReleaseMarkdown(markdown) {
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatInline = (value) => {
    let safe = escapeHtml(value);
    safe = safe.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return safe;
  };

  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const html = [];
  let listType = null;
  let inCodeBlock = false;
  let codeLines = [];

  const closeList = () => {
    if (!listType) return;
    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = null;
  };

  const closeCodeBlock = () => {
    if (!inCodeBlock) return;
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    inCodeBlock = false;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      closeList();
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line) {
      closeList();
      html.push('<div class="markdown-spacer"></div>');
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(6, headingMatch[1].length);
      html.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${formatInline(bulletMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${formatInline(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  closeList();
  closeCodeBlock();
  return html.join('') || '<p>暂无内容</p>';
}

export function buildReleaseSummary(result, mode) {
  const modeLabel = MODE_LABELS[String(mode)] || String(mode);
  const data = result?.data || result || {};

  return [
    `模式: ${modeLabel}`,
    data.version ? `版本: v${data.version}` : '',
    data.patchPath ? `补丁: ${data.patchPath}` : '',
    data.uploadCloudDataDir ? `上传目录: ${data.uploadCloudDataDir}` : '',
    data.distDir ? `安装包目录: ${data.distDir}` : '',
    Number.isFinite(data.changedCount) ? `包含文件: ${data.changedCount}` : '',
  ].filter(Boolean);
}

export function filterReleasePresets(presets, query) {
  const list = Array.isArray(presets) ? presets : [];
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) {
    return list;
  }

  return list.filter((item) =>
    [item?.file, item?.id, item?.type, item?.version, item?.description]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

export function createEmptyPresetDraft() {
  return {
    originalFileName: null,
    fileName: '',
    id: '',
    type: '',
    version: '',
    description: '',
    releaseNotesText: '',
    jsonText: '{\n  "version": "",\n  "presets": {}\n}',
  };
}

export function sanitizeReleaseId(value, prefix) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || `${prefix}_${Date.now()}`;
}

export function resolveReleaseConfigSelection(config, previousSelection = {}) {
  const brands = Array.isArray(config?.brands) ? config.brands : [];
  const printersByBrand =
    config?.printersByBrand && typeof config.printersByBrand === 'object'
      ? config.printersByBrand
      : {};

  const fallbackBrandId = brands[0]?.id || null;
  const requestedBrandId =
    brands.find((item) => item.id === previousSelection.brandId)?.id || fallbackBrandId;
  const printers = Array.isArray(printersByBrand[requestedBrandId])
    ? printersByBrand[requestedBrandId]
    : [];
  const fallbackPrinterId = printers[0]?.id || null;
  const requestedPrinterId =
    printers.find((item) => item.id === previousSelection.printerId)?.id || fallbackPrinterId;
  const nextType =
    previousSelection.type === 'printer' && requestedPrinterId ? 'printer' : 'brand';

  return {
    type: nextType,
    brandId: requestedBrandId,
    printerId: requestedPrinterId,
  };
}

export function applyReleaseEntityDraft(
  config,
  selection,
  entityForm,
  options = {},
) {
  const nextConfig = {
    ...(config && typeof config === 'object' ? config : {}),
    brands: Array.isArray(config?.brands) ? [...config.brands] : [],
    printersByBrand:
      config?.printersByBrand && typeof config.printersByBrand === 'object'
        ? { ...config.printersByBrand }
        : {},
  };

  const shouldCommitId = options.commitId === true;
  const currentBrand =
    nextConfig.brands.find((item) => item.id === selection?.brandId) || null;

  if (selection?.type === 'printer' && selection?.brandId && selection?.printerId) {
    const currentPrinters = Array.isArray(nextConfig.printersByBrand[selection.brandId])
      ? [...nextConfig.printersByBrand[selection.brandId]]
      : [];
    const currentPrinter =
      currentPrinters.find((item) => item.id === selection.printerId) || null;

    if (!currentPrinter) {
      return {
        nextConfig,
        nextSelection: selection,
      };
    }

    let nextDefaultPresets = currentPrinter.defaultPresets || {};
    if (String(entityForm?.presetsText || '').trim()) {
      try {
        nextDefaultPresets = JSON.parse(entityForm.presetsText);
      } catch (error) {
        if (options.strictPresets === true) {
          throw error;
        }
      }
    } else {
      nextDefaultPresets = {};
    }

    const nextPrinterId = shouldCommitId
      ? sanitizeReleaseId(
          entityForm?.id || entityForm?.name || currentPrinter.id,
          'printer',
        )
      : currentPrinter.id;

    nextConfig.printersByBrand[selection.brandId] = currentPrinters.map((item) =>
      item.id === currentPrinter.id
        ? {
            ...item,
            id: nextPrinterId,
            shortName: String(entityForm?.name || '').trim(),
            name:
              String(entityForm?.subtitle || '').trim()
              || String(entityForm?.name || '').trim(),
            image: entityForm?.image || item.image || '',
            supportedVersions: String(entityForm?.versions || '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
            defaultPresets: nextDefaultPresets,
          }
        : item,
    );

    return {
      nextConfig,
      nextSelection: {
        type: 'printer',
        brandId: selection.brandId,
        printerId: nextPrinterId,
      },
    };
  }

  if (!currentBrand) {
    return {
      nextConfig,
      nextSelection: selection,
    };
  }

  const nextBrandId = shouldCommitId
    ? sanitizeReleaseId(entityForm?.id || entityForm?.name || currentBrand.id, 'brand')
    : currentBrand.id;

  nextConfig.brands = nextConfig.brands.map((item) =>
    item.id === currentBrand.id
      ? {
          ...item,
          id: nextBrandId,
          name: String(entityForm?.name || '').trim(),
          shortName: String(entityForm?.name || '').trim(),
          subtitle: String(entityForm?.subtitle || '').trim(),
          image: entityForm?.image || item.image || '',
        }
      : item,
  );

  if (currentBrand.id !== nextBrandId) {
    nextConfig.printersByBrand[nextBrandId] =
      nextConfig.printersByBrand[currentBrand.id] || [];
    delete nextConfig.printersByBrand[currentBrand.id];
  }

  return {
    nextConfig,
    nextSelection: {
      type: 'brand',
      brandId: nextBrandId,
      printerId: selection?.printerId || null,
    },
  };
}
