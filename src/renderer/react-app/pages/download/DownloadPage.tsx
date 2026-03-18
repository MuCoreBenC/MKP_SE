import { LocalPresetList } from './components/LocalPresetList';
import { LocalPresetToolbar } from './components/LocalPresetToolbar';
import { OnlinePresetList } from './components/OnlinePresetList';
import { VersionSelector } from './components/VersionSelector';
import { useDownloadContext } from '../../hooks/useDownloadContext';
import { usePresetActions } from '../../hooks/usePresetActions';
import { useVersionSelection } from '../../hooks/useVersionSelection';

export function DownloadPage() {
  const context = useDownloadContext();
  const versions = context.printer?.supportedVersions || ['standard'];
  const { pendingVersion, selectVersion } = useVersionSelection();
  const actions = usePresetActions();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-200">
        React 下载页骨架已接入。当前阶段仍与 legacy 页面并存，先复用现有 runtime 上下文。
        <div className="mt-2 text-xs opacity-80">
          已提供 `usePresetActions()` typed adapter，下一步可把 apply / duplicate / rename / delete 逐步接入 React 卡片动作。
        </div>
      </div>
      <VersionSelector
        versions={versions}
        selectedVersion={context.selectedVersionType}
        pendingVersion={pendingVersion}
        onSelectVersion={selectVersion}
      />
      <LocalPresetToolbar />
      <LocalPresetList
        printerName={context.printer?.shortName || context.printer?.name || '--'}
        selectedVersion={context.selectedVersionType}
      />
      <OnlinePresetList selectedVersion={context.selectedVersionType} />
    </div>
  );
}
