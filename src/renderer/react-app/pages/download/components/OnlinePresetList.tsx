import { useState } from 'react';

import { usePresetActions } from '../../../hooks/usePresetActions';
import { useOnlinePresetList } from '../../../hooks/useOnlinePresetList';

type OnlinePresetListProps = {
  selectedVersion: string | null;
};

export function OnlinePresetList({ selectedVersion }: OnlinePresetListProps) {
  const { downloadOnlinePreset, refreshOnlinePresets } = usePresetActions();
  const { items, loading } = useOnlinePresetList();
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleDownloadClick(fileName: string) {
    setPendingFileName(fileName);
    try {
      await downloadOnlinePreset({ fileName });
    } finally {
      setPendingFileName(null);
    }
  }

  async function handleRefreshClick() {
    setRefreshing(true);
    try {
      await refreshOnlinePresets();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#333] dark:bg-[#252526]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">在线预设（React 骨架）</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          当前版本上下文：{selectedVersion || '未选择'}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#555] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
          >
            {refreshing ? '检查中' : '检查更新'}
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
        <div>在线预设列表已开始接入真实数据源，当前优先读取 bundled/local manifest。</div>
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-[#333] dark:bg-[#252526]">正在读取在线预设列表...</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-[#333] dark:bg-[#252526]">当前版本上下文下没有可显示的在线预设。</div>
          ) : (
            items.map((item) => (
              <div key={item.fileName} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-[#333] dark:bg-[#252526]">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.displayTitle}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.fileName}</div>
                </div>
                <div className="flex items-center gap-2">
                  {item.isLatest ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">最新</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDownloadClick(item.fileName)}
                    disabled={pendingFileName === item.fileName}
                    className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    {pendingFileName === item.fileName ? '下载中' : '下载'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
