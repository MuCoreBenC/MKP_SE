import { ReadySignal } from '../../runtime/react-page-runtime';

function navigateToPage(page: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const target = document.querySelector(`[data-page='${page}']`) as HTMLButtonElement | null;
  target?.click();
}

function invokeWindowHandler(name: string, ...args: unknown[]) {
  const fn = (window as unknown as Record<string, unknown>)[name];
  if (typeof fn === 'function') {
    return (fn as (...handlerArgs: unknown[]) => unknown)(...args);
  }

  console.warn(`[MKP React Pages] calibrate handler unavailable: ${name}`);
  return undefined;
}

export function CalibratePage({ markReady }: { markReady: () => void }) {
  return (
    <ReadySignal onReady={markReady}>
      <>
        <div className="page-header page-header-fixed-shell w-full" data-react-page="calibrate">
          <div className="page-header-top">
            <h1 id="title-page-calibrate" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              校准偏移
            </h1>
            <div className="flex items-center gap-3">
              <button
                id="btn-calibrate-prev"
                type="button"
                onClick={() => navigateToPage('download')}
                className="btn-secondary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>上一步</span>
              </button>
            </div>
          </div>
          <div className="page-header-sub" />
        </div>

        <div className="page-content hide-scrollbar">
          <div className="max-w-4xl">
            <div className="mb-5 rounded-xl border border-transparent bg-white p-5 card-shadow transition-colors dark:border-[#333] dark:bg-[#252526]">
              <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">脚本路径：主页-&gt;其他-&gt;后处理脚本</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="scriptPath"
                  className="input-field input-readonly flex-1 rounded-lg px-4 py-2.5 text-sm"
                  readOnly
                  title="后处理脚本路径"
                  placeholder="请先选择机型和版本"
                />
                <button
                  id="scriptCopyBtn"
                  type="button"
                  onClick={() => invokeWindowHandler('copyPath')}
                  className="theme-btn-soft flex h-9 min-w-[36px] items-center justify-center rounded-lg px-2 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div
              id="zCalibrationCard"
              className="mb-5 rounded-xl border border-transparent bg-white p-5 card-shadow transition-colors dark:border-[#333] dark:bg-[#252526]"
            >
              <div className="calibration-card-head">
                <div className="calibration-card-title text-sm font-medium text-gray-700 dark:text-gray-300">Z轴偏移校准</div>
                <div className="calibration-card-actions">
                  <button
                    id="zDirectEditBtn"
                    type="button"
                    onClick={() => invokeWindowHandler('openZGridDirectly')}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-[#444] dark:bg-[#252526] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
                  >
                    不打开模型直接修改
                  </button>

                  <button
                    id="zOpenBtn"
                    type="button"
                    onClick={() => invokeWindowHandler('openZModel')}
                    className="theme-btn-solid flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>打开校准模型</span>
                  </button>
                </div>
              </div>
              <div id="zCalibrationArea">
                <div id="zProgress" className="hidden mb-4">
                  <div className="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-[#333]">
                    <div className="h-full w-full animate-pulse rounded-full theme-bg-solid" />
                  </div>
                </div>
                <div
                  id="zPlaceholder"
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 dark:border-[#444] dark:bg-[#1E1E1E]"
                >
                  <svg className="mb-2 h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                    />
                  </svg>

                  <div id="zCurrentOffsetSummary" className="hidden mb-3 text-2xl font-black tracking-tight theme-text">
                    当前预设的Z偏移值为：<span id="currentZOffsetDisplay">--</span>
                  </div>

                  <span className="text-sm text-gray-400 dark:text-gray-500">点击右上方打开校准模型按钮加载可视化校准网格</span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">点击后请耐心等待3mf打开...</span>
                </div>
                <div id="zGridSelector" className="hidden">
                  <div className="flex flex-col items-center">
                    <div id="zGrid" className="mb-4 flex items-center justify-center gap-1" />
                    <div className="z-value-compare flex items-center justify-center gap-4 py-4">
                      <div className="z-value-column text-center">
                        <div className="mb-1 text-xs text-gray-400">原始值</div>
                        <div id="zOriginal" className="z-value-number text-3xl font-semibold text-gray-400">
                          3.3
                        </div>
                      </div>
                      <div className="z-value-arrow-column">
                        <div id="zBadge" className="hidden mb-1 rounded-full px-2 py-0.5 text-xs font-medium theme-bg-soft theme-text">
                          -0.2
                        </div>
                        <svg className="z-value-arrow h-8 w-8 theme-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </div>
                      <div className="z-value-column text-center">
                        <div className="mb-1 text-xs text-gray-400">修改后</div>
                        <div id="zNewValue" className="z-value-number text-3xl font-bold theme-text">
                          3.1
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <button
                        id="saveZOffsetBtn"
                        type="button"
                        onClick={(event) => invokeWindowHandler('saveZOffset', event.currentTarget)}
                        className="theme-btn-solid rounded-lg px-6 py-2.5 text-sm font-medium transition-all"
                      >
                        保存并应用 Z 轴偏移
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              id="xyCalibrationCard"
              className="rounded-xl border border-transparent bg-white p-5 card-shadow transition-colors dark:border-[#333] dark:bg-[#252526]"
            >
              <div className="calibration-card-head">
                <div className="calibration-card-title text-sm font-medium text-gray-700 dark:text-gray-300">XY轴偏移校准</div>
                <div className="calibration-card-actions">
                  <button
                    id="xyDirectEditBtn"
                    type="button"
                    onClick={() => invokeWindowHandler('openXYGridDirectly')}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-[#444] dark:bg-[#252526] dark:text-gray-300 dark:hover:bg-[#2A2A2A]"
                  >
                    不打开模型直接修改
                  </button>
                  <button
                    id="xyOpenBtn"
                    type="button"
                    onClick={() => invokeWindowHandler('openXYModel')}
                    className="theme-btn-solid flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>打开校准模型</span>
                  </button>
                </div>
              </div>
              <div id="xyCalibrationArea">
                <div id="xyProgress" className="hidden mb-4">
                  <div className="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-[#333]">
                    <div className="h-full w-full animate-pulse rounded-full theme-bg-solid" />
                  </div>
                </div>
                <div
                  id="xyPlaceholder"
                  className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 dark:border-[#444] dark:bg-[#1E1E1E]"
                >
                  <svg className="mb-2 h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                    />
                  </svg>
                  <div id="xyCurrentOffsetSummary" className="hidden mb-3 text-center text-xl font-black tracking-tight theme-text">
                    当前预设的XY偏移值为：X <span id="currentXOffsetDisplay">--</span> / Y <span id="currentYOffsetDisplay">--</span>
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500">点击右上方打开校准模型按钮加载可视化校准网格</span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">点击后请耐心等待3mf打开...</span>
                </div>
                <div id="xyGridSelector" className="hidden">
                  <div className="xy-stage py-2">
                    <div id="xyYGrid" className="xy-y-axis" />
                    <div className="xy-main-column">
                      <div className="xy-summary-card">
                        <div className="xy-summary-row">
                          <div className="xy-summary-label">X</div>
                          <div className="xy-summary-values">
                            <div className="xy-summary-value">
                              <div className="xy-summary-caption">原始值</div>
                              <div id="xyOriginalX" className="xy-summary-number">
                                0.00
                              </div>
                            </div>
                            <div className="xy-summary-arrow-wrap">
                              <div id="xyBadgeX" className="hidden rounded-full px-2 py-0.5 text-xs font-medium theme-bg-soft theme-text">
                                +0.00
                              </div>
                              <svg className="xy-summary-arrow h-7 w-7 theme-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </div>
                            <div className="xy-summary-value">
                              <div className="xy-summary-caption">修改后</div>
                              <div id="xyNewX" className="xy-summary-number theme-text">
                                0.00
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="xy-summary-divider" />
                        <div className="xy-summary-row">
                          <div className="xy-summary-label">Y</div>
                          <div className="xy-summary-values">
                            <div className="xy-summary-value">
                              <div className="xy-summary-caption">原始值</div>
                              <div id="xyOriginalY" className="xy-summary-number">
                                0.00
                              </div>
                            </div>
                            <div className="xy-summary-arrow-wrap">
                              <div id="xyBadgeY" className="hidden rounded-full px-2 py-0.5 text-xs font-medium theme-bg-soft theme-text">
                                +0.00
                              </div>
                              <svg className="xy-summary-arrow h-7 w-7 theme-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </div>
                            <div className="xy-summary-value">
                              <div className="xy-summary-caption">修改后</div>
                              <div id="xyNewY" className="xy-summary-number theme-text">
                                0.00
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div id="xyXGrid" className="xy-x-axis" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <button
                      id="saveXYOffsetBtn"
                      type="button"
                      onClick={(event) => invokeWindowHandler('saveXYOffset', event.currentTarget)}
                      className="theme-btn-solid rounded-lg px-6 py-2.5 text-sm font-medium transition-all"
                    >
                      保存并应用 XY 轴偏移
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    </ReadySignal>
  );
}
