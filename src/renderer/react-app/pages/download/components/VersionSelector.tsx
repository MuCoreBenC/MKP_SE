import type { VersionType } from '../../../../app/core/preset';

type VersionSelectorProps = {
  versions: VersionType[];
  selectedVersion: VersionType | null;
  pendingVersion: VersionType | null;
  onSelectVersion: (version: VersionType | null) => void;
};

const VERSION_LABELS: Record<string, string> = {
  standard: '标准版',
  quick: '快速版',
  lite: 'Lite 版'
};

const VERSION_DESCRIPTIONS: Record<string, string> = {
  standard: '适合新手和稳定优先场景，保留完整支撑面流程。',
  quick: '适合已经熟悉装配步骤时的快速使用场景。',
  lite: '轻量配置，保留基础能力，适合测试和极简流程。'
};

export function VersionSelector({ versions, selectedVersion, pendingVersion, onSelectVersion }: VersionSelectorProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm ring-1 ring-gray-200 dark:bg-[#252526] dark:ring-[#333]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">选择版本类型</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">先确定当前机型对应的版本，再管理本地和在线预设。</p>
        </div>
      </div>
      {versions.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-gray-200 bg-gray-50/80 p-5 text-sm text-gray-500 dark:border-[#333] dark:bg-[#1E1E1E] dark:text-gray-400">
          请先在“选择机型”页完成机型选择，再返回这里挑选版本。
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((version) => {
            const active = version === selectedVersion;
            const pending = version === pendingVersion;

            return (
              <div
                key={version}
                onClick={() => onSelectVersion(active ? null : version)}
                className={`cursor-pointer rounded-[26px] border p-5 transition-all ${
                  active
                    ? 'border-[rgb(var(--primary-rgb))] bg-[rgba(var(--primary-rgb),0.08)] shadow-[0_20px_45px_rgba(var(--primary-rgb),0.12)] dark:bg-[rgba(var(--primary-rgb),0.18)]'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#333] dark:bg-[#252526]'
                } ${pending ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {VERSION_LABELS[version] || version}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {VERSION_DESCRIPTIONS[version] || `版本键：${version}`}
                    </div>
                  </div>
                  <span
                    className={`inline-flex h-8 min-w-[72px] items-center justify-center rounded-full px-3 text-xs font-medium ${
                      active
                        ? 'bg-[rgb(var(--primary-rgb))] text-white'
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
      )}
    </section>
  );
}
