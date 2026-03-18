import { useState } from 'react';

import { useDownloadPageUiStore } from '../../../stores/useDownloadPageUiStore';
import { useLocalPresetList } from '../../../hooks/useLocalPresetList';
import { usePresetActions } from '../../../hooks/usePresetActions';

type LocalPresetListProps = {
  printerName: string;
  selectedVersion: string | null;
};

export function LocalPresetList({ printerName, selectedVersion }: LocalPresetListProps) {
  const localSearchQuery = useDownloadPageUiStore((state) => state.localSearchQuery);
  const selectedLocalFiles = useDownloadPageUiStore((state) => state.selectedLocalFiles);
  const { items, loading } = useLocalPresetList();
  const { applyLocalPreset, duplicateLocalPreset, deleteLocalPreset } = usePresetActions();
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pendingDuplicateFileName, setPendingDuplicateFileName] = useState<string | null>(null);
  const [pendingDeleteFileName, setPendingDeleteFileName] = useState<string | null>(null);

  function handleApplyClick(fileName: string) {
    setPendingFileName(fileName);
    try {
      applyLocalPreset(fileName);
    } finally {
      setPendingFileName(null);
    }
  }

  async function handleDuplicateClick(fileName: string, realVersion: string) {
    setPendingDuplicateFileName(fileName);
    try {
      await duplicateLocalPreset({ fileName, realVersion });
    } finally {
      setPendingDuplicateFileName(null);
    }
  }

  async function handleDeleteClick(fileName: string) {
    setPendingDeleteFileName(fileName);
    try {
      await deleteLocalPreset(fileName);
    } finally {
      setPendingDeleteFileName(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#333] dark:bg-[#252526]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">当前本地预设视图</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            机型：{printerName || '--'} · 版本：{selectedVersion || '未选择'}
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-[#1E1E1E] dark:text-gray-400">
          已选 {selectedLocalFiles.length}
        </span>
      </div>
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
        <div>搜索词：{localSearchQuery || '（空）'}</div>
        <div className="mt-1">当前已加载 {loading ? '...' : items.length} 个本地预设。</div>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            正在读取本地预设列表...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            当前上下文下没有可显示的本地预设。
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.fileName}
              className={`rounded-xl border p-4 transition-all ${
                item.isApplied
                  ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/15'
                  : 'border-gray-200 bg-gray-50/60 dark:border-[#333] dark:bg-[#1E1E1E]'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.displayTitle}
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {item.fileName}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-[#252526] dark:text-gray-400">
                    v{item.realVersion}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDuplicateClick(item.fileName, item.realVersion)}
                    disabled={pendingDuplicateFileName === item.fileName}
                    className="rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#555] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
                  >
                    {pendingDuplicateFileName === item.fileName ? '复制中' : '复制'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item.fileName)}
                    disabled={pendingDeleteFileName === item.fileName}
                    className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-medium text-red-500 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:hover:bg-red-900/10"
                  >
                    {pendingDeleteFileName === item.fileName ? '删除中' : '删除'}
                  </button>
                  {item.isApplied ? (
                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-medium text-white">当前使用</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyClick(item.fileName)}
                      disabled={pendingFileName === item.fileName}
                      className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      {pendingFileName === item.fileName ? '应用中' : '应用'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
