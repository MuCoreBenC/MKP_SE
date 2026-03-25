import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import HomePage from './pages/HomePage';
import DownloadPage from './pages/DownloadPage';
import CalibrationPage from './pages/CalibrationPage';
import ParamsPage from './pages/ParamsPage';
import VersionsPage from './pages/VersionsPage';
import ReleasePage from './pages/ReleasePage';
import FaqPage from './pages/FaqPage';
import AboutPage from './pages/AboutPage';
import SettingsPage from './pages/SettingsPage';
import GlobalContextMenu from './components/GlobalContextMenu';
import GlobalModal, { MKPModal } from './components/GlobalModal';
import { THEME_PALETTE } from './utils/themeConstants';
import { Logger } from './utils/logger';
import { VERSION_DICT } from './utils/data';
import {
  buildMergedHomeCatalog,
  ensureValidSelection,
  findPrinterLocation,
} from './utils/homeCatalog';
import { APP_UPDATE_STATE_KEY } from './utils/versioning';
import {
  getCurrentScriptKey,
  readUserConfig,
  resolvePersistedVersionForPrinter,
  writeUserConfig,
} from './utils/userConfig';

function readStoredAppUpdateState() {
  try {
    return JSON.parse(localStorage.getItem(APP_UPDATE_STATE_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

function resolveSelectionFromConfig(catalog, config) {
  const resolvedVersion = resolvePersistedVersionForPrinter(
    config?.printer || null,
    config?.version || null,
    catalog.printersByBrand,
    config || {},
  );

  return ensureValidSelection(catalog, {
    brandId: config?.brand || null,
    printerId: config?.printer || null,
    versionType: resolvedVersion,
  });
}

export default function App() {
  void MKPModal;
  void Logger;

  const defaultCatalog = useMemo(() => buildMergedHomeCatalog(null), []);
  const initialConfig = useMemo(() => readUserConfig(), []);
  const initialSelection = useMemo(
    () => resolveSelectionFromConfig(defaultCatalog, initialConfig),
    [defaultCatalog, initialConfig],
  );

  const [activePage, setActivePage] = useState('setting');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [catalog, setCatalog] = useState(defaultCatalog);
  const [selectedBrand, setSelectedBrand] = useState(initialSelection.brandId);
  const [selectedPrinter, setSelectedPrinter] = useState(initialSelection.printerId);
  const [selectedVersion, setSelectedVersion] = useState(initialSelection.versionType);
  const [appliedReleases, setAppliedReleases] = useState(
    () => initialConfig.appliedReleases || {},
  );
  const [currentPresetFile, setCurrentPresetFile] = useState(() => {
    if (!initialSelection.printerId || !initialSelection.versionType) {
      return '';
    }

    return (
      localStorage.getItem(
        getCurrentScriptKey(initialSelection.printerId, initialSelection.versionType),
      ) || ''
    );
  });
  const [hasAppUpdate, setHasAppUpdate] = useState(() => {
    const state = readStoredAppUpdateState();
    return !!state?.hasUpdate;
  });

  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'light');
  const [themeColor, setThemeColor] = useState(() => {
    const savedColor = localStorage.getItem('appThemeColor');
    return savedColor === 'custom' || THEME_PALETTE[savedColor] ? savedColor : 'blue';
  });

  useEffect(() => {
    let ignore = false;

    const hydrateCatalog = async () => {
      try {
        const result = await window.mkpAPI?.readHomeCatalog?.();
        const nextCatalog = buildMergedHomeCatalog(result?.success ? result.data : null);
        const nextConfig = readUserConfig();
        const nextSelection = resolveSelectionFromConfig(nextCatalog, {
          ...nextConfig,
          appliedReleases: nextConfig.appliedReleases || appliedReleases,
        });

        if (ignore) return;

        setCatalog(nextCatalog);
        setSelectedBrand(nextSelection.brandId);
        setSelectedPrinter(nextSelection.printerId);
        setSelectedVersion(nextSelection.versionType);
      } catch (error) {
        if (!ignore) {
          setCatalog(defaultCatalog);
        }
      }
    };

    hydrateCatalog();

    return () => {
      ignore = true;
    };
  }, [appliedReleases, defaultCatalog]);

  useEffect(() => {
    const html = document.documentElement;
    const isDark =
      themeMode === 'dark' ||
      themeMode === 'oled' ||
      (themeMode === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    html.setAttribute('data-theme-mode', themeMode);
    html.classList.toggle('dark', isDark);
    html.classList.toggle('oled', themeMode === 'oled');
    localStorage.setItem('themeMode', themeMode);

    if (themeMode === 'dark' || themeMode === 'oled') {
      localStorage.setItem('preferredDarkMode', themeMode);
    }

    if (window.mkpAPI?.setNativeTheme) {
      window.mkpAPI.setNativeTheme(themeMode === 'oled' ? 'dark' : themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    let rgbValue = THEME_PALETTE.blue.rgb;

    if (themeColor === 'custom') {
      rgbValue = localStorage.getItem('customThemeRgb') || rgbValue;
    } else if (THEME_PALETTE[themeColor]) {
      rgbValue = THEME_PALETTE[themeColor].rgb;
    }

    document.documentElement.style.setProperty('--primary-rgb', rgbValue);
    localStorage.setItem('appThemeColor', themeColor);
  }, [themeColor]);

  useEffect(() => {
    const syncAppUpdate = (event) => {
      if (event?.detail) {
        setHasAppUpdate(!!event.detail.hasUpdate);
        return;
      }

      const state = readStoredAppUpdateState();
      setHasAppUpdate(!!state?.hasUpdate);
    };

    syncAppUpdate();
    window.addEventListener('storage', syncAppUpdate);
    window.addEventListener('mkp-app-update-state-changed', syncAppUpdate);

    return () => {
      window.removeEventListener('storage', syncAppUpdate);
      window.removeEventListener('mkp-app-update-state-changed', syncAppUpdate);
    };
  }, []);

  useEffect(() => {
    if (!selectedPrinter || !selectedVersion) {
      setCurrentPresetFile('');
      return;
    }

    setCurrentPresetFile(localStorage.getItem(getCurrentScriptKey(selectedPrinter, selectedVersion)) || '');
  }, [selectedPrinter, selectedVersion]);

  useEffect(() => {
    writeUserConfig({
      brandId: selectedBrand,
      printerId: selectedPrinter,
      versionType: selectedVersion,
      appliedReleases,
      printersByBrand: catalog.printersByBrand,
    });
  }, [appliedReleases, catalog.printersByBrand, selectedBrand, selectedPrinter, selectedVersion]);

  const applySelection = useCallback(
    (nextCatalog, nextSelection) => {
      const safeSelection = resolveSelectionFromConfig(nextCatalog, {
        brand: nextSelection.brandId ?? selectedBrand,
        printer: nextSelection.printerId ?? selectedPrinter,
        version: nextSelection.versionType ?? selectedVersion,
        appliedReleases,
      });

      setSelectedBrand(safeSelection.brandId);
      setSelectedPrinter(safeSelection.printerId);
      setSelectedVersion(safeSelection.versionType);
    },
    [appliedReleases, selectedBrand, selectedPrinter, selectedVersion],
  );

  const handleCatalogChange = useCallback(
    (nextCatalog, nextSelection = {}) => {
      setCatalog(nextCatalog);
      applySelection(nextCatalog, nextSelection);
    },
    [applySelection],
  );

  const handleSelectionChange = useCallback(
    (nextSelection) => {
      applySelection(catalog, nextSelection);
    },
    [applySelection, catalog],
  );

  const handlePresetApplied = useCallback(
    ({ fileName, versionType }) => {
      if (!selectedPrinter || !versionType) {
        return;
      }

      const currentKey = getCurrentScriptKey(selectedPrinter, versionType);
      localStorage.setItem(currentKey, fileName);
      setCurrentPresetFile(fileName);
      setSelectedVersion(versionType);
      setAppliedReleases((previous) => ({
        ...previous,
        [`${selectedPrinter}_${versionType}`]: fileName,
      }));
    },
    [selectedPrinter],
  );

  const handlePresetFilesRemoved = useCallback(
    (fileNames, versionType = selectedVersion) => {
      if (!selectedPrinter || !versionType) {
        return;
      }

      const currentKey = getCurrentScriptKey(selectedPrinter, versionType);
      const activeFile = localStorage.getItem(currentKey);
      if (!activeFile || !fileNames.includes(activeFile)) {
        return;
      }

      localStorage.removeItem(currentKey);
      setCurrentPresetFile('');
      setAppliedReleases((previous) => {
        const next = { ...previous };
        delete next[`${selectedPrinter}_${versionType}`];
        return next;
      });
    },
    [selectedPrinter, selectedVersion],
  );

  const changeThemeWithAnimation = (newMode, event) => {
    if (themeMode === newMode) return;

    if (!document.startViewTransition) {
      setThemeMode(newMode);
      return;
    }

    const x =
      event && event.clientX !== undefined ? event.clientX : window.innerWidth / 2;
    const y =
      event && event.clientY !== undefined ? event.clientY : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(() => {
      setThemeMode(newMode);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-out',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  };

  const toggleDarkMode = (event) => {
    const isCurrentlyDark = themeMode === 'dark' || themeMode === 'oled';
    const preferredDark = localStorage.getItem('preferredDarkMode') || 'dark';
    changeThemeWithAnimation(isCurrentlyDark ? 'light' : preferredDark, event);
  };

  const currentPrinterLocation = findPrinterLocation(catalog, selectedPrinter);
  const currentPrinter = currentPrinterLocation?.printer || null;
  const activeBrandId = currentPrinterLocation?.brandId || selectedBrand;
  const currentBrand = catalog.brands.find((item) => item.id === activeBrandId) || null;
  const versionBadge = selectedVersion
    ? VERSION_DICT[selectedVersion]?.name || selectedVersion
    : '未选择';

  return (
    <div id="mainApp" className="flex h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        brandName={currentBrand?.shortName || currentBrand?.name || '品牌'}
        modelName={currentPrinter?.shortName || currentPrinter?.name || '机型'}
        versionBadge={versionBadge}
        hasUpdate={hasAppUpdate}
        currentTheme={themeMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="flex-1 overflow-hidden flex flex-col transition-colors">
        {activePage === 'home' && (
          <HomePage
            catalog={catalog}
            selectedBrand={selectedBrand}
            selectedPrinter={selectedPrinter}
            selectedVersion={selectedVersion}
            onCatalogChange={handleCatalogChange}
            onSelectionChange={handleSelectionChange}
            onNext={() => setActivePage('download')}
          />
        )}
        {activePage === 'download' && (
          <DownloadPage
            currentPrinter={currentPrinter}
            currentVersion={selectedVersion}
            currentPresetFile={currentPresetFile}
            onChangeVersion={(versionType) => handleSelectionChange({ versionType })}
            onApplyPreset={handlePresetApplied}
            onDeletePresets={handlePresetFilesRemoved}
            onOpenParams={() => setActivePage('params')}
            onPrev={() => setActivePage('home')}
            onNext={() => setActivePage('calibrate')}
          />
        )}
        {activePage === 'calibrate' && (
          <CalibrationPage onPrev={() => setActivePage('download')} />
        )}
        {activePage === 'params' && (
          <ParamsPage
            currentPrinter={currentPrinter}
            currentVersion={selectedVersion}
            currentPresetFile={currentPresetFile}
          />
        )}
        {activePage === 'versions' && <VersionsPage />}
        {activePage === 'release' && <ReleasePage />}
        {activePage === 'faq' && <FaqPage onNavigate={setActivePage} />}
        {activePage === 'about' && <AboutPage />}
        {activePage === 'setting' && (
          <SettingsPage
            currentTheme={themeMode}
            onChangeTheme={changeThemeWithAnimation}
            currentColor={themeColor}
            onChangeColor={setThemeColor}
          />
        )}
      </main>

      <GlobalModal />
      <GlobalContextMenu />
    </div>
  );
}
