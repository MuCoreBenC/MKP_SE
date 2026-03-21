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
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">在线预设</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            云端最新的配置文件，下载后将出现在本地预设中。
          </p>
          <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            当前版本上下文：{selectedVersion || '未选择'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={refreshing}
          className="theme-btn-soft inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? '检查中...' : '检查预设'}
        </button>
      </div>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            正在读取在线预设列表...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            当前版本上下文下没有可显示的在线预设。
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.fileName}
              className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-4 transition-colors hover:border-gray-300 dark:border-[#333] dark:bg-[#1E1E1E]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {item.displayTitle}
                    </div>
                    {item.isLatest ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        最新
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">{item.fileName}</span>
                    <span>v{item.realVersion}</span>
                    <span>{item.date || '--'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadClick(item.fileName)}
                  disabled={pendingFileName === item.fileName}
                  className="theme-btn-solid inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingFileName === item.fileName ? '下载中...' : '下载'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
