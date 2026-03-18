type VersionSelectorProps = {
  versions: string[];
  selectedVersion: string | null;
  pendingVersion: string | null;
  onSelectVersion: (version: string | null) => void;
};

const VERSION_LABELS: Record<string, string> = {
  standard: '标准版',
  quick: '快速版',
  lite: 'Lite 版'
};

export function VersionSelector({ versions, selectedVersion, pendingVersion, onSelectVersion }: VersionSelectorProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">选择版本类型</h2>
        <p className="text-xs text-gray-500">React 迁移骨架已接入，当前仍复用现有 runtime 状态。</p>
      </div>
      <div className="flex flex-col gap-3">
        {versions.map((version) => {
          const active = version === selectedVersion;
          const pending = version === pendingVersion;
          return (
            <div
              key={version}
              onClick={() => onSelectVersion(active ? null : version)}
              className={`rounded-xl border p-4 transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-[#333] dark:bg-[#252526]'
              } ${pending ? 'opacity-70' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {VERSION_LABELS[version] || version}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">版本键：{version}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    active
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-[#1E1E1E] dark:text-gray-400'
                  }`}
                >
                  {pending ? '切换中' : active ? '当前选择' : '可选'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
