function normalizeDevServerUrl(devServerUrl) {
  return String(devServerUrl || '').trim().replace(/\/+$/, '');
}

function buildDevServerPageUrl(devServerUrl, pageName = 'index.html') {
  const normalizedBaseUrl = normalizeDevServerUrl(devServerUrl);
  if (!normalizedBaseUrl) {
    return '';
  }

  if (!pageName || pageName === 'index.html') {
    return normalizedBaseUrl;
  }

  return new URL(pageName, `${normalizedBaseUrl}/`).toString();
}

function resolveWindowEntryTarget({
  devServerUrl,
  distHtmlPath,
  legacyHtmlPath,
  pageName = 'index.html',
  fsExistsSync = null,
}) {
  const existsSync = typeof fsExistsSync === 'function' ? fsExistsSync : () => false;

  if (devServerUrl) {
    return {
      kind: 'url',
      target: buildDevServerPageUrl(devServerUrl, pageName),
    };
  }

  if (distHtmlPath && existsSync(distHtmlPath)) {
    return {
      kind: 'file',
      target: distHtmlPath,
    };
  }

  return {
    kind: 'file',
    target: legacyHtmlPath,
  };
}

module.exports = {
  buildDevServerPageUrl,
  resolveWindowEntryTarget,
};
