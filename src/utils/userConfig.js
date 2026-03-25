export const USER_CONFIG_KEY = 'mkp_user_config';

export function readUserConfig() {
  try {
    return JSON.parse(localStorage.getItem(USER_CONFIG_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

export function getCurrentScriptKey(printerId, versionType) {
  return `mkp_current_script_${printerId}_${versionType}`;
}

export function resolvePersistedVersionForPrinter(
  printerId,
  preferredVersion = null,
  printersByBrand = {},
  config = {},
) {
  if (!printerId) return null;

  const printer = Object.values(printersByBrand)
    .flat()
    .find((item) => item.id === printerId);
  const supportedVersions = Array.isArray(printer?.supportedVersions)
    ? printer.supportedVersions
    : [];

  if (supportedVersions.length === 0) {
    return preferredVersion || null;
  }

  if (preferredVersion && supportedVersions.includes(preferredVersion)) {
    return preferredVersion;
  }

  const appliedReleases =
    config && typeof config.appliedReleases === 'object' ? config.appliedReleases : {};

  for (const version of supportedVersions) {
    const currentKey = `${printerId}_${version}`;
    if (localStorage.getItem(getCurrentScriptKey(printerId, version)) || appliedReleases[currentKey]) {
      return version;
    }
  }

  return null;
}

export function writeUserConfig({
  brandId,
  printerId,
  versionType,
  appliedReleases = {},
  printersByBrand = {},
}) {
  const previousConfig = readUserConfig();
  const mergedAppliedReleases = {
    ...(previousConfig.appliedReleases || {}),
    ...appliedReleases,
  };
  const resolvedPrinter = printerId || previousConfig.printer || null;
  const resolvedBrand = brandId || previousConfig.brand || null;
  const resolvedVersion = resolvePersistedVersionForPrinter(
    resolvedPrinter,
    versionType || previousConfig.version || null,
    printersByBrand,
    { appliedReleases: mergedAppliedReleases },
  );

  const config = {
    brand: resolvedBrand,
    printer: resolvedPrinter,
    version: resolvedVersion,
    appliedReleases: mergedAppliedReleases,
  };

  localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(config));
  return config;
}
