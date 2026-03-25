import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';
import {
  APP_UPDATE_STATE_KEY,
  buildPatchUrlCandidates,
  compareVersions,
  computeAppUpdateState,
  getAppManifestUrls,
  normalizeAppVersion,
  parseManifestToVersionEntries,
} from '../utils/versioning';

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightText({ text, query }) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return <>{text}</>;

  const splitRegex = new RegExp(`(${escapeRegExp(safeQuery)})`, 'gi');
  const matchRegex = new RegExp(`^${escapeRegExp(safeQuery)}$`, 'i');
  const parts = String(text || '').split(splitRegex);

  return (
    <>
      {parts.map((part, index) =>
        matchRegex.test(part) ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-[2px] px-0.5 mx-[1px] font-bold bg-yellow-200/80 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-200"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function createFallbackCurrentVersionItem(currentVersion) {
  return [
    {
      version: normalizeAppVersion(currentVersion),
      date: '',
      desc: '当前运行版本',
      status: 'RUNNING',
      current: true,
      canRollback: false,
      details: ['本地没有可用的更新清单，已回退到当前版本信息。'],
      downloadUrl: '',
    },
  ];
}

function classifySeverity(currentVersion, targetVersion, status) {
  if (status !== 'AVAILABLE') {
    return 'Patch';
  }

  const [currentMajor = '0', currentMinor = '0'] =
    normalizeAppVersion(currentVersion).split('.');
  const [targetMajor = '0', targetMinor = '0'] =
    normalizeAppVersion(targetVersion).split('.');

  if (targetMajor !== currentMajor) return 'Major';
  if (targetMinor !== currentMinor) return 'Minor';
  return 'Patch';
}

function mapVersionEntryToCard(item, currentVersion) {
  const version = normalizeAppVersion(item.version);
  const comparison = compareVersions(version, currentVersion);
  const status = comparison > 0 ? 'AVAILABLE' : item.current ? 'RUNNING' : 'LEGACY';

  return {
    version,
    date: item.date || '',
    isCurrent: item.current,
    status,
    severity: classifySeverity(currentVersion, version, status),
    type:
      status === 'AVAILABLE'
        ? '可更新版本'
        : item.current
          ? '当前运行'
          : '历史版本',
    notes: item.details?.length ? item.details : [item.desc || '常规更新'],
    downloadUrl: item.downloadUrl || '',
    canRollback: item.canRollback !== false,
  };
}

function storeAppUpdateState(state) {
  localStorage.setItem(APP_UPDATE_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(
    new CustomEvent('mkp-app-update-state-changed', {
      detail: state,
    }),
  );
}

async function fetchAppManifestWithFallback() {
  for (const url of getAppManifestUrls()) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return await response.json();
    } catch (error) {}
  }

  return await window.mkpAPI?.readLocalManifest?.();
}

async function saveRemoteManifest(manifest) {
  if (!manifest || !window.mkpAPI?.saveLocalManifest) {
    return;
  }

  await window.mkpAPI.saveLocalManifest(JSON.stringify(manifest, null, 2));
}

async function getCurrentAppVersion() {
  if (window.mkpAPI?.getAppVersion) {
    return normalizeAppVersion(await window.mkpAPI.getAppVersion());
  }

  return '0.0.0';
}

function VersionCard({
  item,
  isExpanded,
  onToggle,
  onApplyUpdate,
  onRollback,
  searchQuery,
  busyVersion,
}) {
  const severityStyles = {
    Major: {
      card: 'border-2 border-blue-400 dark:border-blue-500 shadow-md bg-blue-50/30 dark:bg-blue-900/10',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-black',
      btn: 'bg-blue-500 hover:bg-blue-600 text-white shadow-md active:scale-95',
    },
    Minor: {
      card: 'border-2 border-emerald-300 dark:border-emerald-600/50 shadow-sm bg-white dark:bg-[#252526]',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold',
      btn: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95',
    },
    Patch: {
      card: 'border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252526] hover:border-gray-300 dark:hover:border-[#444]',
      badge: 'bg-gray-100 text-gray-600 dark:bg-[#333] dark:text-gray-300 font-medium',
      btn: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#333] dark:text-gray-300 dark:hover:bg-[#444]',
    },
  };

  const style = severityStyles[item.severity] || severityStyles.Patch;
  const isBusy = busyVersion === item.version;

  return (
    <div
      className={`collapse-item rounded-xl overflow-hidden transition-all duration-300 ${style.card} ${
        isExpanded ? 'expanded' : ''
      }`}
    >
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left outline-none group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:theme-text transition-colors">
                <HighlightText text={`v${item.version}`} query={searchQuery} />
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] tracking-wide ${style.badge}`}>
                {item.type}
              </span>
              {item.isCurrent ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold theme-bg-solid shadow-sm">
                  当前运行
                </span>
              ) : null}
              {item.status === 'AVAILABLE' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse">
                  待更新
                </span>
              ) : null}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              发布于 {item.date || '--'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {item.status === 'AVAILABLE' ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onApplyUpdate(item);
              }}
              disabled={isBusy}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${style.btn} flex items-center gap-1.5 disabled:opacity-60`}
            >
              {isBusy ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  下载中...
                </>
              ) : (
                <>
                  <Icon name="download" className="w-3.5 h-3.5" />
                  立即更新
                </>
              )}
            </button>
          ) : !item.isCurrent ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRollback(item);
              }}
              disabled={!item.downloadUrl || isBusy}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${style.btn} disabled:opacity-50`}
            >
              {isBusy ? '处理中...' : '回退'}
            </button>
          ) : null}

          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#1e1e1e] group-hover:bg-gray-100 dark:group-hover:bg-[#2a2a2a] transition-colors">
            <svg
              className={`collapse-arrow w-4 h-4 text-gray-500 transition-transform duration-300 ${
                isExpanded ? 'icon-rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      <div className={`collapse-wrapper ${isExpanded ? 'is-open is-expanded' : ''}`}>
        <div className="collapse-inner">
          <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-[#333] mx-5">
            <div className="text-xs font-bold text-gray-400 mb-2">更新日志：</div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {item.notes.map((note, index) => (
                <li key={`${item.version}-note-${index}`} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
                  <span>
                    <HighlightText text={note} query={searchQuery} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VersionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [busyVersion, setBusyVersion] = useState('');
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [versionsData, setVersionsData] = useState([]);
  const [expandedItems, setExpandedItems] = useState(new Set());

  const hydrateFromManifest = async (manifestOverride = null) => {
    const version = await getCurrentAppVersion();
    const manifest = manifestOverride || (await window.mkpAPI?.readLocalManifest?.());
    const entries = manifest
      ? parseManifestToVersionEntries(manifest, version)
      : createFallbackCurrentVersionItem(version);

    setCurrentVersion(version);
    setVersionsData(entries.map((item) => mapVersionEntryToCard(item, version)));
    setExpandedItems(new Set(entries.slice(0, 1).map((item) => normalizeAppVersion(item.version))));

    const nextState = manifest
      ? computeAppUpdateState(manifest, version)
      : computeAppUpdateState({ latestVersion: version }, version);
    storeAppUpdateState(nextState);
  };

  useEffect(() => {
    void hydrateFromManifest();
  }, []);

  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return versionsData;
    const query = searchQuery.toLowerCase();

    return versionsData.filter((item) => {
      return (
        item.version.toLowerCase().includes(query) ||
        item.notes.some((note) => String(note || '').toLowerCase().includes(query))
      );
    });
  }, [searchQuery, versionsData]);

  const toggleItem = (version) => {
    setExpandedItems((previous) => {
      const next = new Set(previous);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const isAllExpanded =
    filteredVersions.length > 0 &&
    filteredVersions.every((item) => expandedItems.has(item.version));

  const toggleAllHistory = () => {
    if (isAllExpanded) {
      setExpandedItems(new Set());
      return;
    }

    setExpandedItems(new Set(filteredVersions.map((item) => item.version)));
  };

  const applyUpdateFlow = async (item, { rollback = false } = {}) => {
    if (!item.downloadUrl) {
      await MKPModal.alert({
        title: rollback ? '回退不可用' : '更新不可用',
        msg: '当前版本没有可用的补丁地址。',
        type: 'warning',
      });
      return;
    }

    if (rollback) {
      const confirmed = await MKPModal.confirm({
        title: `确认回退至 v${item.version}？`,
        msg: '回退后将覆盖当前版本的所有代码，请确认当前环境允许回退。',
        type: 'warning',
        confirmText: '确认回退',
      });
      if (!confirmed) return;
    }

    setBusyVersion(item.version);

    try {
      const result = await window.mkpAPI?.applyHotUpdate?.({
        urls: buildPatchUrlCandidates(item.downloadUrl),
        expectedVersion: item.version,
      });

      if (!result?.success) {
        throw new Error(result?.error || '补丁应用失败');
      }

      const confirmed = await MKPModal.confirm({
        title: rollback ? '回退完成' : '更新已准备就绪',
        msg: rollback
          ? `已成功回退到 v${item.version}，现在重启软件即可生效。`
          : `补丁已应用到 v${result.version || item.version}，现在重启软件即可生效。`,
        type: 'success',
        confirmText: '立即重启',
        cancelText: '稍后重启',
      });

      if (confirmed) {
        await window.mkpAPI?.restartApp?.();
      }
    } catch (error) {
      await MKPModal.alert({
        title: rollback ? '回退失败' : '更新失败',
        msg: error.message,
        type: 'error',
      });
    } finally {
      setBusyVersion('');
    }
  };

  const handleCheckUpdate = async () => {
    if (isChecking) return;

    setIsChecking(true);

    try {
      const remoteManifest = await fetchAppManifestWithFallback();
      if (!remoteManifest) {
        throw new Error('无法获取可用的版本清单。');
      }

      await saveRemoteManifest(remoteManifest);
      const freshCurrentVersion = await getCurrentAppVersion();
      await hydrateFromManifest(remoteManifest);

      const nextState = computeAppUpdateState(remoteManifest, freshCurrentVersion);
      storeAppUpdateState(nextState);

      if (!nextState.hasUpdate) {
        await MKPModal.alert({
          title: '已是最新版本',
          msg: `当前运行的 v${freshCurrentVersion} 已经是最新版本。`,
          type: 'success',
        });
        return;
      }

      const latestItem = parseManifestToVersionEntries(remoteManifest, freshCurrentVersion)
        .map((item) => mapVersionEntryToCard(item, freshCurrentVersion))
        .find((item) => item.status === 'AVAILABLE');

      if (!latestItem) return;

      const confirmed = await MKPModal.confirm({
        title: `发现新版本 v${latestItem.version}`,
        msg: latestItem.notes[0] || '检测到新的应用版本。',
        type: 'info',
        confirmText: '立即更新',
        cancelText: '稍后再说',
      });

      if (confirmed) {
        await applyUpdateFlow(latestItem);
      }
    } catch (error) {
      await MKPModal.alert({
        title: '检查失败',
        msg: error.message,
        type: 'error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div id="page-versions" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            版本控制
          </h1>
          <button
            onClick={() => void handleCheckUpdate()}
            disabled={isChecking}
            className="px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all theme-btn-solid active:scale-95 disabled:opacity-70"
          >
            {isChecking ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                检查中...
              </>
            ) : (
              <>
                <Icon name="download" className="w-4 h-4" />
                检查更新
              </>
            )}
          </button>
        </div>
        <div className="page-header-sub">
          <p className="text-sm text-gray-500">获取最新功能，或回退至历史版本。</p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                placeholder="搜索版本号或更新说明..."
                className="input-field w-full pl-11 pr-4 py-2.5 rounded-xl text-sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <button
              onClick={toggleAllHistory}
              className={`btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-all ${
                isAllExpanded ? 'bg-gray-100 dark:bg-[#333]' : ''
              }`}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${
                  isAllExpanded ? 'text-blue-500 rotate-180' : 'text-gray-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{isAllExpanded ? '收起全部' : '展开全部'}</span>
            </button>
          </div>

          <div className="space-y-4 pb-12">
            {filteredVersions.length > 0 ? (
              filteredVersions.map((item) => {
                const isExpanded =
                  expandedItems.has(item.version) || searchQuery.trim().length > 0;

                return (
                  <VersionCard
                    key={item.version}
                    item={item}
                    isExpanded={isExpanded}
                    onToggle={() => toggleItem(item.version)}
                    onApplyUpdate={(target) => void applyUpdateFlow(target)}
                    onRollback={(target) => void applyUpdateFlow(target, { rollback: true })}
                    searchQuery={searchQuery}
                    busyVersion={busyVersion}
                  />
                );
              })
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Icon
                  name="info"
                  className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
                />
                <p className="text-sm">未找到相关的版本记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
