import { useState } from 'react';

import { useDownloadPageUiStore } from '../../../stores/useDownloadPageUiStore';
import { usePresetActions } from '../../../hooks/usePresetActions';
import type { LocalPresetItem } from '../../../hooks/useLocalPresetList';

type LocalPresetListProps = {
  printerName: string;
  selectedVersion: string | null;
  items: LocalPresetItem[];
  loading: boolean;
};

function formatDate(value?: number) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN');
}

function formatSize(size?: number) {
  if (!size) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function LocalPresetList({ printerName, selectedVersion, items, loading }: LocalPresetListProps) {
  const localSearchQuery = useDownloadPageUiStore((state) => state.localSearchQuery);
  const setLocalSearchQuery = useDownloadPageUiStore((state) => state.setLocalSearchQuery);
  const localSortMode = useDownloadPageUiStore((state) => state.localSortMode);
  const setLocalSortMode = useDownloadPageUiStore((state) => state.setLocalSortMode);
  const isMultiSelectMode = useDownloadPageUiStore((state) => state.isMultiSelectMode);
  const setMultiSelectMode = useDownloadPageUiStore((state) => state.setMultiSelectMode);
  const selectedLocalFiles = useDownloadPageUiStore((state) => state.selectedLocalFiles);
  const setSelectedLocalFiles = useDownloadPageUiStore((state) => state.setSelectedLocalFiles);
  const { applyLocalPreset, duplicateLocalPreset, deleteLocalPreset, togglePinnedPreset } = usePresetActions();
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pendingDuplicateFileName, setPendingDuplicateFileName] = useState<string | null>(null);
  const [pendingDeleteFileName, setPendingDeleteFileName] = useState<string | null>(null);

  function toggleSelectedFile(fileName: string) {
    const nextSet = new Set(selectedLocalFiles);
    if (nextSet.has(fileName)) {
      nextSet.delete(fileName);
    } else {
      nextSet.add(fileName);
    }
    setSelectedLocalFiles(Array.from(nextSet));
  }

  function handleSelectAll() {
    setSelectedLocalFiles(items.map((item) => item.fileName));
  }

  function handleInvertSelection() {
    const currentSet = new Set(selectedLocalFiles);
    setSelectedLocalFiles(
      items
        .map((item) => item.fileName)
        .filter((fileName) => !currentSet.has(fileName))
    );
  }

  async function handleBatchDelete() {
    for (const fileName of selectedLocalFiles) {
      await deleteLocalPreset(fileName);
    }
    setSelectedLocalFiles([]);
    setMultiSelectMode(false);
  }

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">本地预设</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            已存放在您电脑中的配置，可搜索、排序、多选和右键管理。
          </p>
          <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            机型：{printerName || '--'} · 版本：{selectedVersion || '未选择'}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isMultiSelectMode ? (
            <>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-[#1E1E1E] dark:text-gray-400">
                已选 {selectedLocalFiles.length}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 dark:border-[#444] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
              >
                全选
              </button>
              <button
                type="button"
                onClick={handleInvertSelection}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 dark:border-[#444] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
              >
                反选
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedLocalFiles.length === 0}
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-900/20 dark:text-red-300"
              >
                删除
              </button>
            </>
          ) : null}
          <input
            value={localSearchQuery}
            onChange={(event) => setLocalSearchQuery(event.target.value)}
            placeholder="搜索文件名..."
            className="input-field h-10 w-44 rounded-xl border border-gray-200 px-3 text-sm dark:border-[#444] dark:bg-[#252526]"
          />
          <select
            value={localSortMode}
            onChange={(event) => setLocalSortMode(event.target.value as typeof localSortMode)}
            className="input-field h-10 rounded-xl border border-gray-200 px-3 text-sm dark:border-[#444] dark:bg-[#252526]"
          >
            <option value="custom">置顶优先</option>
            <option value="version-desc">版本从新到旧</option>
            <option value="updated-desc">最近修改优先</option>
            <option value="name-asc">名称 A-Z</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (isMultiSelectMode) {
                setSelectedLocalFiles([]);
              }
              setMultiSelectMode(!isMultiSelectMode);
            }}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all ${
              isMultiSelectMode
                ? 'bg-[rgba(var(--primary-rgb),0.12)] text-[rgb(var(--primary-rgb))]'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-[#444] dark:text-gray-300 dark:hover:bg-[#2A2A2A]'
            }`}
          >
            {isMultiSelectMode ? '退出多选' : '批量管理'}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            正在读取本地预设列表...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-4 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
            当前上下文下没有可显示的本地预设。
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedLocalFiles.includes(item.fileName);
            return (
              <div
                key={item.fileName}
                onClick={isMultiSelectMode ? () => toggleSelectedFile(item.fileName) : undefined}
                className={`rounded-2xl border p-4 transition-all ${
                  isMultiSelectMode && isSelected
                    ? 'border-[rgb(var(--primary-rgb))] bg-[rgba(var(--primary-rgb),0.08)]'
                    : item.isApplied
                      ? 'border-[rgb(var(--primary-rgb))] bg-[rgba(var(--primary-rgb),0.08)] dark:bg-[rgba(var(--primary-rgb),0.16)]'
                      : 'border-gray-200 bg-gray-50/60 dark:border-[#333] dark:bg-[#1E1E1E]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isMultiSelectMode) {
                          toggleSelectedFile(item.fileName);
                        } else {
                          togglePinnedPreset(item.fileName);
                        }
                      }}
                      className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                        isMultiSelectMode
                          ? isSelected
                            ? 'bg-[rgb(var(--primary-rgb))] text-white'
                            : 'border border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
                          : item.isPinned
                            ? 'bg-[rgba(var(--primary-rgb),0.12)] text-[rgb(var(--primary-rgb))]'
                            : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-[#252526] dark:hover:text-gray-300'
                      }`}
                      aria-label={isMultiSelectMode ? '切换选择' : (item.isPinned ? '取消置顶' : '置顶')}
                      title={isMultiSelectMode ? '切换选择' : (item.isPinned ? '取消置顶' : '置顶')}
                    >
                      {isMultiSelectMode ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6.75 3.75h10.5v16.5L12 17.25 6.75 20.25V3.75z" />
                        </svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span>{formatDate(item.modifiedAt)}</span>
                        <span>{formatSize(item.size)}</span>
                      </div>
                    </div>
                  </div>
                  {!isMultiSelectMode ? (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDuplicateClick(item.fileName, item.realVersion)}
                        disabled={pendingDuplicateFileName === item.fileName}
                        className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#555] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
                      >
                        {pendingDuplicateFileName === item.fileName ? '复制中...' : '复制'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item.fileName)}
                        disabled={pendingDeleteFileName === item.fileName}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:hover:bg-red-900/10"
                      >
                        {pendingDeleteFileName === item.fileName ? '删除中...' : '删除'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyClick(item.fileName)}
                        disabled={item.isApplied || pendingFileName === item.fileName}
                        className={`inline-flex h-10 min-w-[88px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-all ${
                          item.isApplied
                            ? 'bg-[rgb(var(--primary-rgb))] text-white'
                            : 'theme-btn-soft'
                        } disabled:cursor-default disabled:opacity-100`}
                      >
                        {item.isApplied ? '已应用' : (pendingFileName === item.fileName ? '应用中...' : '应用')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
