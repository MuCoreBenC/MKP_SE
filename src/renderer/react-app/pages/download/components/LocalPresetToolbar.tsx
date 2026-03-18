import { useDownloadPageUiStore } from '../../../stores/useDownloadPageUiStore';

export function LocalPresetToolbar() {
  const localSearchQuery = useDownloadPageUiStore((state) => state.localSearchQuery);
  const setLocalSearchQuery = useDownloadPageUiStore((state) => state.setLocalSearchQuery);
  const localSortMode = useDownloadPageUiStore((state) => state.localSortMode);
  const setLocalSortMode = useDownloadPageUiStore((state) => state.setLocalSortMode);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">本地预设（React 骨架）</h3>
        <p className="text-xs text-gray-500">当前阶段先接入 UI 骨架，后续逐步接管真实动作。</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={localSearchQuery}
          onChange={(event) => setLocalSearchQuery(event.target.value)}
          placeholder="搜索本地预设..."
          className="input-field w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-xs dark:border-[#444] dark:bg-[#252526]"
        />
        <select
          value={localSortMode}
          onChange={(event) => setLocalSortMode(event.target.value as typeof localSortMode)}
          className="input-field rounded-lg border border-gray-200 px-3 py-1.5 text-xs dark:border-[#444] dark:bg-[#252526]"
        >
          <option value="custom">自定义</option>
          <option value="version-desc">版本</option>
          <option value="updated-desc">最近</option>
          <option value="name-asc">名称</option>
        </select>
      </div>
    </div>
  );
}
