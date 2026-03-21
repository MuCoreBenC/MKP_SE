import { LocalPresetList } from './components/LocalPresetList';
import { OnlinePresetList } from './components/OnlinePresetList';
import { VersionSelector } from './components/VersionSelector';
import { useDownloadContext } from '../../hooks/useDownloadContext';
import { useLocalPresetList } from '../../hooks/useLocalPresetList';
import { useVersionSelection } from '../../hooks/useVersionSelection';
import type { VersionType } from '../../../app/core/preset';

export function DownloadPage() {
  const context = useDownloadContext();
  const versions = (context.printer?.supportedVersions || []) as VersionType[];
  const { items: localItems, loading: localLoading } = useLocalPresetList();
  const { pendingVersion, selectVersion } = useVersionSelection();
  const hasLocalPreset = localItems.length > 0;
  const canProceed = !!context.printer?.id && !!context.selectedVersionType && !localLoading && hasLocalPreset;
  const hintText = !context.printer?.id
    ? '请先选择机型'
    : !context.selectedVersionType
      ? '请先选择版本类型'
      : !hasLocalPreset
        ? '请先准备本地预设'
        : '';

  function navigateToPage(page: string) {
    if (typeof document === 'undefined') {
      return;
    }

    const target = document.querySelector(`[data-page='${page}']`) as HTMLButtonElement | null;
    target?.click();
  }

  return (
    <>
      <div className="page-header page-header-fixed-shell w-full">
        <div className="page-header-top">
          <h1 id="title-page-download" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            模型预设
          </h1>
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToPage('home')}
              className="btn-secondary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              <span>上一步</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToPage('calibrate')}
              disabled={!canProceed}
              className="theme-btn-solid flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>下一步</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <div
              className={`absolute -bottom-6 right-1 flex items-center gap-1 text-amber-500 transition-opacity duration-300 ${
                canProceed ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px]">{hintText}</span>
            </div>
          </div>
        </div>
        <div className="page-header-sub">
          <p className="text-sm leading-none text-gray-500 dark:text-gray-400">
            选择版本类型和发布日期以获取对应的预设配置
          </p>
        </div>
      </div>

      <div className="page-content hide-scrollbar">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <VersionSelector
            versions={versions}
            selectedVersion={context.selectedVersionType}
            pendingVersion={pendingVersion}
            onSelectVersion={selectVersion}
          />
          <LocalPresetList
            printerName={context.printer?.shortName || context.printer?.name || '--'}
            selectedVersion={context.selectedVersionType}
            items={localItems}
            loading={localLoading}
          />
          <OnlinePresetList selectedVersion={context.selectedVersionType} />
        </div>
      </div>
    </>
  );
}
