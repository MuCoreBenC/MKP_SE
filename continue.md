## Continue

更新时间: 2026-03-18

## 这份文档现在是什么

- 这不再是流水账 checkpoint 记录。
- 这是一份**从当前状态继续推进的执行计划**，用于回答三个问题：
  - 我们现在到底处于什么阶段
  - 接下来最值得做的事是什么
  - 如何逐步把前端从 legacy DOM 迁到更易维护的架构

## 当前判断

### 阶段定位

- 当前仍处于 **renderer 桥接收口阶段**。
- 目标不是继续堆 legacy DOM patch，而是把 legacy 页面使用的关键状态逐步收敛到 modern runtime / store 上。
- 目前已经证明：最危险的问题不是单个函数错，而是 **legacy 全局状态、modern runtime 状态、页面 DOM 三者不同步**。

### 当前真实现状

- `src/renderer/app/**`、`src/renderer/app/entry/renderer-runtime.ts` 已存在，modern runtime 基础已落地。
- `src/renderer/react-app/**` 已经开始出现，说明项目已经具备逐步迁移到 React 的现实基础，不需要从零开始。
- legacy 页面主逻辑仍大量集中在：
  - `src/renderer/assets/js/home.js`
  - `src/renderer/assets/js/presets.js`
  - `src/renderer/assets/js/params.js`
  - `src/renderer/assets/js/app.js`
- 当前用户面 bug 已经验证：
  - 下载页版本切换时，legacy / modern / DOM 容易分叉
  - 切机型时，版本选择态会残留
  - 校准 / 参数页对 active preset path 非常敏感，最容易暴露 stale context

### 当前完成度（主观）

- 桥接层：`75%~80%`
- 页面层真实行为稳定度：`55%~65%`
- 前端迁移准备度：`40%~50%`
- 真正进入 React 页面替换：**尚未正式开始**，但已经可以规划并启动

## 已完成的高价值成果

### Runtime / Bridge

- 已有稳定 bridge/view/helper：
  - `__getDownloadContextView__`
  - `__getActivePresetView__`
  - `__getParamsPresetView__`
  - `__getCalibrationContextView__`
  - `resolveActivePresetFileName`
  - `resolveDownloadAppliedState`
  - `resolveParamsPresetPath`
  - `resolveParamsDisplayFileName`
- 已打通双向同步骨架：
  - `saveUserConfig -> __syncLegacyContextToModern__`
  - `loadUserConfig -> __hydrateModernContextFromLegacy__`

### 近期修到的真实 GUI bug

- 下载页点击版本卡后，只改 legacy `selectedVersion`，未同步 modern runtime。
- 同步了 modern runtime 后，版本卡容器未立即重绘，导致右侧无框选态。
- 切换机型时，同名版本（如 `standard`）会被错误继承到新机型。

这些都已经通过测试固化并修复。

## 反思：TDD 现在应该怎么用

- TDD 现在**不应该**继续主要用于“源码形状约束”。
- TDD 现在**应该**用于：
  - 固化你在 GUI 里真实看到的 bug
  - 给 legacy -> modern -> React 迁移建立行为护栏
  - 防止三套状态源再次分叉

### 以后采用的 TDD 原则

1. 优先真实 GUI bug，不优先 contract-only 测试。
2. 每次只锁一个清晰的用户可见现象。
3. 先复现，再写最小 failing test，再修最小实现。
4. 除非直接服务于迁移或回归防护，否则不再扩张低收益 source-string 测试。

## 接下来完整计划

## Phase 1：状态一致性收口（当前主线）

### 目标

- 把 `home / presets / params / calibration` 之间最核心的状态链打稳：
  - 机型
  - 版本
  - 已应用 preset
  - preset path
  - dirty / unsaved 状态

### 关注的核心风险

- 切机型后 legacy 清了，modern 没清
- 切版本后 modern 变了，DOM 没重绘
- 页面切换后还在读旧 storage / 旧 global
- 已应用 preset 与当前 version context 不一致

### 待做事项

1. **Home / Presets 继续清残留状态**
   - 切机型后是否同步清空 modern version context
   - 切品牌 / 切机型 / 切版本后是否仍残留旧菜单、旧选择、旧高亮
   - 批量操作后是否仍残留 `selectedLocalFiles`

2. **Calibration / Params 继续查 active preset path**
   - 版本切换但未应用对应 preset 时，页面应该如何表现
   - 校准页是否错误沿用旧 preset path
   - 参数页是否错误显示旧 file label

3. **只修真实 GUI 现象**
   - 以后每个切片都应能回答“用户看到了什么问题”

### 完成标准

- 你手测常用路径时，不再频繁遇到“看起来变了，但页面没跟上”的错乱状态。
- 下载页 / 参数页 / 校准页对同一 active preset 的理解一致。

## Phase 2：统一 renderer 页面状态来源

### 目标

- 把真正的 single source of truth 收到 modern runtime/store，不再依赖 scattered globals。

### 要做什么

1. 梳理 legacy 全局状态：
   - `selectedBrand`
   - `selectedPrinter`
   - `selectedVersion`
   - applied preset 相关映射
   - preset cache

2. 定义清晰的状态归属：
   - 哪些状态必须由 runtime/store 主持
   - 哪些只是 legacy 页面短期 adapter 层缓存

3. legacy 页面改为更多地“读 view / 调 action”，更少地直接读写散落 global

### 完成标准

- 页面层对状态的读取主要经由 shared runtime helper / store adapter
- 同类逻辑不再在 `home.js / presets.js / params.js / app.js` 重复推断

## Phase 3：抽离页面级 adapter，为 React 迁移铺路

### 目标

- 不直接把 legacy DOM 代码硬搬进 React，而是先把业务逻辑和 UI 渲染拆开。

### 要做什么

1. 给 legacy 页面提取 page adapter / controller 层：
   - `home-page-adapter`
   - `presets-page-adapter`
   - `params-page-adapter`
   - `calibration-page-adapter`

2. 把页面里这三类职责分开：
   - 状态读取
   - 业务动作
   - DOM 渲染

3. 保留旧页面可运行，但让 React 将来可以直接复用 adapter 和 store

### 完成标准

- 页面核心业务动作不依赖具体 DOM 结构
- React 页面可以直接调用同一套 action / selector

## Phase 4：逐页迁移到 React（可实现，而且建议这样做）

### 结论先说

- **可以实现，而且应该是渐进式迁移，不是一次性重写。**
- 现有目录已经有：`src/renderer/react-app/`
- 这说明技术上完全可走“legacy 与 React 并存、逐页替换”的路线。

### 推荐迁移方式

- 保留 Electron / preload / main 进程不大动
- 保留 modern runtime/store/service 作为业务后端
- 前端 UI 逐步从：
  - `index.html + assets/js/*.js + 手工 DOM`
  - 迁到 `React + TypeScript + Zustand`

### 为什么这条路最合适

- 不需要大爆炸重写
- 可边修 bug 边迁移
- 现有 TDD / smoke 可以继续当回归护栏
- runtime/store 先打稳后，React 页面会更容易接入

### 推荐迁移顺序

1. **下载预设页（优先）**
   - 状态复杂、bug 多、最能体现 legacy/modern 分叉风险
   - 迁完收益最大

2. **参数页**
   - 表单密集，React 更适合维护 dirty / focus / undo-redo

3. **校准页**
   - 强依赖 active preset path，适合在 runtime 稳定后迁移

4. **首页（机型选择）**
   - DOM 结构较重，但业务边界清楚，适合后续迁移

5. **更新页 / 设置页 / 关于页**
   - 风险低，可在主功能稳定后迁移

### React 迁移的具体执行策略

1. 先保留旧入口 `index.html`
2. 在某个页面容器内部挂 React root
3. 新 React 页面通过 adapter/store 复用老业务
4. 老页面先退化成壳，不立刻删
5. 稳定后再删除旧 DOM/controller 实现

### React 阶段的完成标准

- 下载页至少 1 个核心页面完成 React 替换
- legacy DOM 页面与 React 页面可并存
- 功能行为与现有版本一致
- GUI bug 数显著下降，新增功能开发成本下降

## Phase 5：测试体系重构

### 目标

- 把测试从“源码片段匹配”逐步升级为“行为测试 + 集成测试”。

### 测试策略

1. 保留少量关键 smoke，防止粗暴回归
2. 增加 runtime/store 行为测试
3. 增加页面 adapter/action 测试
4. React 页面落地后，增加 component/integration test
5. 有条件再补 GUI automation，但不作为当前主依赖

### 不再主推的测试方式

- 大量新增低收益 source-string 测试
- 对已稳定 contract 做重复形状约束

## 近期 3 个最高优先级任务

1. **继续修状态一致性真实 bug**
   - 先检查：切机型后，modern runtime 的 version context 是否也被清空

2. **开始定义下载页迁移边界**
   - 明确下载页哪些逻辑归 store，哪些归 adapter，哪些归 UI

3. **把 `continue.md` 维持成 roadmap，而不是流水账**
   - 后续只记录：阶段变化、风险变化、优先级变化、关键已完成项

## 当前最可能仍然潜伏的 bug

- legacy `selectedVersion` 已清空，但 modern runtime 仍保留旧 `versionType`
- 切版本后 active preset path 仍沿用旧分支
- 批量操作后局部 UI 状态残留
- 页面切换时某些入口还在读旧 localStorage / 旧 global
- DOM 已更新一半，但当前容器没有即时重绘

## 明确不做的事

- 现在不做一次性全量 React 重写
- 现在不大改 main 进程 / preload 边界
- 现在不再继续拉长 checkpoint 流水账
- 现在不再优先做低收益 contract-only 测试

## 推荐下一步

- 下一刀先做一个真实 bug 验证：
  - **切机型后，是否同时清空 modern runtime 中的 version context**
- 如果这个问题存在，就先修它。
- 修完后，立即开始设计“下载预设页 React 化的 adapter 边界”。

## 2026-03-18 TDD checkpoint 89

- Followed the new roadmap immediately and checked the hidden consistency risk called out there: after printer switching cleared legacy `selectedVersion`, modern runtime context was not being explicitly cleared in the same `selectPrinter()` flow.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so `selectPrinter()` must now sync `brandId/printerId/versionType: selectedVersion` back through `window.__syncLegacyContextToModern__(...)` before sidebar persistence and downstream rendering continue.
- Updated `src/renderer/assets/js/home.js` so `selectPrinter()` now explicitly calls `window.__syncLegacyContextToModern__({ brandId: selectedBrand, printerId, versionType: selectedVersion })` right after the sidebar brand/model labels are refreshed and before `updateSidebarVersionBadge(...)` / `saveUserConfig()` / downstream rendering.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/calibration-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 89

- Re-test the printer-switch GUI flow again now that both legacy and modern version context are cleared together.
- If the visible behavior is finally stable, stop chasing this seam and move to the next roadmap item: define the adapter boundary for a future React migration of the download page.

## 2026-03-18 TDD checkpoint 91

- Fixed another GUI-reported selection bug in the home/download transition: choosing a brand with no currently-selected printer in that brand should no longer auto-select a fallback printer, especially not a disabled one such as a “暂不可用” model.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so `selectBrand()` now follows the brand-only rule: when the current printer does not belong to the chosen brand, it clears `selectedPrinter` and `selectedVersion`, resets the sidebar model label to `未选择机型`, updates the version badge to the empty state, syncs the cleared brand/printer/version back into modern runtime, and then lets downstream surfaces render as brand-selected but printer-unselected.
- Updated `src/renderer/assets/js/home.js` so `selectBrand()` no longer calls `getFirstSelectablePrinter()` / `selectPrinter(...)` as an implicit fallback on brand switch; it now preserves brand selection while explicitly clearing printer/version selection and downstream context instead.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 91

- Re-test the exact GUI flow you reported: click `Creality`, confirm only the brand changes, confirm `K1C` is not auto-selected, and confirm the sidebar model label/version state remain unselected until the user explicitly picks a usable printer.
- If another issue remains, the next likely seam is whether `renderPrinters(selectedBrand)` visually marks disabled cards clearly enough after the brand-only switch, not whether selection state is still wrong.

## 2026-03-18 TDD checkpoint 92

- Tightened one adjacent guard after the new brand-only selection rule landed: when a brand switch clears printer selection, downstream download/calibration surfaces must stay aligned with that empty state instead of accidentally rendering stale printer-derived content.
- Updated `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the active `selectBrand()` flow now explicitly keeps the `selectedPrinter = null` / `selectedVersion = null` branch and still routes its downstream refresh through `refreshHomeSelectionDownstream(currentPrinter)` with `currentPrinter` resolving from the newly-cleared selection.
- This slice did not require another production code change; the active implementation already matched the intended brand-selected-but-printer-unselected behavior once the previous fix landed.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 92

- Re-test the GUI again from the same path, but now focus on visual clarity: after selecting a brand with no chosen printer, confirm the right-side download area and sidebar clearly show an unselected printer state rather than just silently clearing internals.
- If a new issue appears, the next likely fix is presentational (empty-state copy or disabled-card emphasis), not state-sync logic.

## 2026-03-18 TDD checkpoint 93

- Took the first explicit UX-facing slice after the brand-only selection rule: the download page empty state no longer collapses every missing-selection case into “请先在上方选择版本类型。”.
- Added `tests/unit/renderer/entry/presets-empty-state-smoke.test.ts` and split the empty-state guard into two user-visible branches: no printer selected should show `请先选择机型。`, while printer selected but version missing should still show `请先在上方选择版本类型。`.
- Updated `src/renderer/assets/js/presets.js` so `renderPresetList(printerData, versionType)` now distinguishes `!printerData` from `!versionType` before returning the local-list empty state.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-empty-state-smoke.test.ts tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 93

- Re-test the GUI from the brand-only path and verify the new copy is clear enough: selecting a brand without selecting a printer should now show a printer-first empty-state hint instead of incorrectly blaming version selection.
- If UX still feels ambiguous, the next likely improvement is visual emphasis on the disabled/unselected printer area, not more state-layer fixes.

## 2026-03-18 TDD checkpoint 94

- Applied a small but directly user-visible UI polish after the brand-only selection flow stabilized: the collapsed sidebar model label no longer shows the longer `未选择机型`, which wrapped awkwardly in the narrow left rail.
- Updated `src/renderer/assets/js/home.js` so the brand-only branch in `selectBrand()` now sets `sidebarModelName.textContent = '未选择'` instead of `未选择机型`.
- Re-aligned `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to the new shorter label and re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 94

- Re-test the collapsed sidebar visual state and judge whether the shorter `未选择` label is sufficient.
- If it still looks crowded, the next change should be presentation-level only (font size / truncation / tooltip / collapsed-layout treatment), not another state-flow change.

## 2026-03-18 TDD checkpoint 95

- Traced the next GUI-reported startup bug to the persistence layer rather than the page layer: after a user had explicitly cleared brand/printer/version selection, `saveUserConfig()` could still repopulate the cleared state from the previous stored config by falling back to `previousConfig.brand`, `previousConfig.printer`, and `previousConfig.version`.
- Tightened `tests/unit/renderer/entry/app-storage-sync-smoke.test.ts` so `saveUserConfig()` is no longer allowed to rebuild the current selection from previous config when the live selection has already been cleared.
- Updated `src/renderer/assets/js/app.js` so `saveUserConfig()` now persists the live `selectedBrand`, `selectedPrinter`, and `selectedVersion` as-is (`?? null`) instead of silently inheriting stale values from the prior saved config.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/app-storage-sync-smoke.test.ts tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 95

- Re-test startup behavior after closing and reopening the app: it should now restore only the truly last saved explicit selection, and it should no longer jump back to an old printer like `Creality -> K1C` after the user had already cleared selection by switching to a brand-only state.
- If one more startup issue remains, the next suspect is `loadUserConfig()` or `resolvePersistedVersionForPrinter()` reconstructing a version too aggressively from applied preset/history state.

## 2026-03-18 TDD checkpoint 96

- The first startup-restore fix in `saveUserConfig()` was necessary but not sufficient. The deeper problem was in `loadUserConfig()`: when saved config omitted `brand` or `printer`, the loader simply left the old legacy globals in place, which meant the file-level defaults (and other stale state) could survive startup and look like a remembered selection.
- Tightened `tests/unit/renderer/entry/app-storage-sync-smoke.test.ts` so `loadUserConfig()` must now clear legacy `selectedBrand` and `selectedPrinter` when the saved config does not contain them, instead of only conditionally assigning when the fields are truthy.
- Updated `src/renderer/assets/js/app.js` so `loadUserConfig()` now assigns `selectedBrand = config.brand || null`, `selectedPrinter = config.printer || null`, and resolves `selectedVersion` from the saved config values directly instead of falling back to old in-memory globals.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/app-storage-sync-smoke.test.ts tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 96

- Re-test startup again after a full close/reopen cycle. If the app still restores an unexpected printer/version, the next likely remaining cause is no longer config persistence itself but `resolvePersistedVersionForPrinter()` inferring a version from applied-preset/history state more aggressively than the current UX now wants.

## 2026-03-18 TDD checkpoint 90

- After stabilizing the printer/version reset seam, shifted to the next roadmap item: assess whether the download page can start a gradual React migration without a big-bang rewrite.
- The current scaffold in `src/renderer/react-app/pages/download/DownloadPage.tsx`, `src/renderer/react-app/hooks/useDownloadContext.ts`, `src/renderer/react-app/hooks/useVersionSelection.ts`, and `src/renderer/react-app/hooks/usePresetActions.ts` confirms that migration is feasible right now, but also exposes the main gap: the React side is still mostly a static shell over legacy globals, not yet a reactive page backed by a stable adapter/store boundary.

## Download Page Migration Boundary

### What React can already reuse

- Runtime context: `window.__getDownloadContextView__()`
- Existing action surfaces: `handleApplyLocal`, `handleDownloadOnline`, `checkOnlineUpdates`, shared preset helpers
- Temporary page UI state: `src/renderer/react-app/stores/useDownloadPageUiStore.ts`

### What must be extracted before real replacement

1. **Download Page Adapter**
   - One adapter module should own:
     - version switching
     - local preset list refresh
     - online preset list refresh
     - batch actions
     - applied-preset selection refresh
   - Both legacy DOM page and React page should call the same adapter.

2. **Reactive Context Hook**
   - `useDownloadContext()` currently memoizes once and is not enough for live UI updates.
   - It should move to a subscription-based bridge or a shared store selector so React rerenders when printer/version/applied preset changes.

3. **React-first Version Selection Flow**
   - `useVersionSelection()` should stop directly juggling legacy globals and instead call one shared page action such as `selectDownloadVersion(...)`.
   - That shared action should be the single place that:
     - syncs legacy -> modern
     - resets transient list state
     - refreshes sidebar/download/calibration effects

4. **List Data Hook Layer**
   - `useLocalPresetList()` / `useOnlinePresetList()` should become the primary read path for React lists.
   - Legacy `renderPresetList()` can temporarily remain as fallback, but should no longer be the long-term source of truth.

## Recommended Migration Slice 1

- First real React migration slice should be **version selector only**.
- Keep the rest of the download page legacy for now.
- Replace only the version-card UI with React while reusing the existing container and shared adapter action.
- Success condition:
  - version card selection renders correctly
  - sidebar badge stays aligned
  - calibration/params context stays aligned
  - no regression in local/online preset list behavior

## Recommended Migration Slice 2

- After version selector is stable, migrate **local preset toolbar + transient page UI state**.
- This includes:
  - search text
  - batch mode toggle
  - selected file count
  - sort mode controls

## Recommended Migration Slice 3

- Migrate **local preset list** next.
- This is the highest-value page body because most user-visible download-page complexity lives there.

## Next TDD slice 90

- Before coding React migration, add one behavior-driven guard around the intended shared action boundary: version selection should be owned by a single action path, not separately by legacy DOM click handlers and React hook logic.
- If that seam looks too large for one slice, start with a smaller extraction: define one shared `selectDownloadVersion(printer, versionType)` function and move both legacy and React paths onto it.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock two gallery contracts: `stepHomeGallery()` must still select the next visible printer before scheduling smooth scrolling, and the active `renderPrinters()` implementation must still re-render cards and then schedule the auto-alignment scroll.
- Updated the final active `renderPrinters()` in `src/renderer/assets/js/home.js` so it once again schedules `requestAnimationFrame(() => scrollHomeGalleryToSelected('auto'))` after rebuilding the printer cards.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This slice also exposed that `home.js` still contains several historical duplicate definitions; the active one is the last definition in the file, so future TDD slices should keep targeting the final active block unless we choose to clean up those duplicates deliberately.

## Next TDD slice 56

- Continue along `home.js` with one eye on compact-gallery navigation and one eye on the cost of duplicate legacy definitions; the next worthwhile slice may be either another real behavior gap or a tightly-scoped deduplication if the duplicate blocks start obscuring active behavior too much.
- Keep preferring small behavior-preserving steps with strong smoke coverage over broad cleanup.

## 2026-03-17 TDD checkpoint 57

- Continued along the `home.js` compact-gallery path and used this slice to tighten the active navigation/scroll guards instead of forcing another speculative code edit after the previous real fix.
- Added two more smoke assertions to `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the shared gallery helpers stay honest: `scrollHomeGalleryToSelected()` must bail out when compact mode is inactive or no selected card exists, and `stepHomeGallery()` must bail out cleanly when there are no visible printer cards or no resolvable next card.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This slice did not require another implementation change because the live gallery helpers already matched the intended guard behavior once the previous repaint-scroll fix landed.

## Next TDD slice 57

- Continue along `home.js` and decide whether the next highest-ROI step is another real compact-gallery behavior fix or a tightly-scoped cleanup of duplicate legacy definitions that are now making active behavior harder to reason about.
- Keep biasing toward tiny, test-anchored moves and avoid broad cleanup unless the duplicate definitions start hiding a real bug.

## 2026-03-17 TDD checkpoint 58

- Reassessed the next `home.js` step and decided to stop short of broad deduplication for now; instead, this slice established protective coverage around the fact that multiple historical definitions still exist and that the final one is the active source of truth.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the final active `renderPrinters()` block is explicitly locked to the compact-gallery-aware implementation (including the auto-alignment scroll), while also documenting that `renderBrands`, `buildPrinterCardMarkup`, `renderPrinters`, and `bindContextMenu` still have historical duplicates earlier in the file.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This keeps the next slice safer: if we choose to deduplicate `home.js`, the tests now protect both the expected active implementation and the current duplicate-definition reality before we start cutting code.

## Next TDD slice 58

- If the next slice stays on `home.js`, the best ROI is probably a tightly-scoped deduplication of one definition family at a time, starting with the oldest shadowed `renderPrinters`/`renderBrands` block rather than attempting a big cleanup.
- Alternatively, if we want to avoid code churn for now, shift to another active legacy page with a fresh real behavior gap instead of spending more slices only documenting duplicates.

## 2026-03-17 TDD checkpoint 59

- Took the first real deduplication slice in `home.js`, but kept it deliberately tiny: removed only the oldest fully-shadowed `renderBrands` / `buildPrinterCardMarkup` / `renderPrinters` trio, leaving later historical definitions and the final active block untouched.
- Leaned on the existing compact-gallery and active-definition smoke coverage first, then tightened the duplicate-count assertion in `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the file now explicitly records that those three families have been reduced from four definitions to three, while `bindContextMenu` still has multiple historical copies.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This confirms we can chip away at the duplicate legacy blocks incrementally without disturbing the final active implementation or the modern-first behavior already locked by smoke tests.

## Next TDD slice 59

- Continue deduplicating `home.js` one shadowed definition family at a time, likely the next-oldest `renderBrands/buildPrinterCardMarkup/renderPrinters` block, as long as the active final implementation remains unchanged and smoke coverage stays green.
- If the next removal becomes ambiguous because of neighboring helper differences, stop and switch back to a fresh behavior slice instead of forcing broader cleanup.

## 2026-03-17 TDD checkpoint 60

- Took the second tiny deduplication slice in `home.js` and removed the next-oldest fully-shadowed `renderBrands` / `buildPrinterCardMarkup` / `renderPrinters` trio, again leaving the final active block untouched.
- The existing active-definition/gallery smoke coverage held, and the duplicate-count assertion in `tests/unit/renderer/entry/home-runtime-smoke.test.ts` was tightened again to record the new reality: those three families are now down to two definitions each, while `bindContextMenu` still has historical duplicates.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This confirms the incremental deduplication strategy is still safe: we can keep shaving off shadowed legacy blocks without disturbing the final active implementation or the modern-first behavior already locked by smoke tests.

## Next TDD slice 60

- The next obvious cleanup is the final pre-active `renderBrands/buildPrinterCardMarkup/renderPrinters` trio; if removed cleanly, those families should collapse to a single definition each.
- After that, reassess whether `bindContextMenu` should get the same treatment or whether ROI shifts back to a fresh behavior slice elsewhere.

## 2026-03-17 TDD checkpoint 61

- Completed the third tiny deduplication slice in `home.js` by removing the last pre-active `renderBrands` / `buildPrinterCardMarkup` / `renderPrinters` trio, which collapses those three families down to a single active definition each.
- Tightened the duplicate-count assertion in `tests/unit/renderer/entry/home-runtime-smoke.test.ts` again so it now records the new steady state: `renderBrands`, `buildPrinterCardMarkup`, and `renderPrinters` each exist exactly once, while `bindContextMenu` still has multiple historical copies.
- Kept the active compact-gallery/rendering guard in place but made one assertion less brittle so it checks the active implementation family (`home-printer-grid-${homeViewMode}` plus the auto-scroll scheduling) without overfitting to the full generated class string.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This means the main `home.js` render families are now effectively deduplicated; any further cleanup should likely focus on `bindContextMenu` or shift back to a new behavior slice with better ROI.

## Next TDD slice 61

- Reassess whether cleaning up duplicate `bindContextMenu` definitions is worth the churn; if that path looks messy, switch back to a fresh behavior-driven slice instead of over-optimizing legacy cleanup.
- `home.js` render-family deduplication is now largely done, so future work can focus on either cleaner lifecycle wiring or another legacy page’s real behavior gaps.

## 2026-03-17 TDD checkpoint 62

- Continued the `home.js` cleanup pass and finished deduplicating the remaining shadowed `bindContextMenu()` copies, collapsing that family down to a single active definition just like `renderBrands` / `buildPrinterCardMarkup` / `renderPrinters`.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the duplicate-count guard now records the new steady state: `bindContextMenu` also exists exactly once, while the final active simplified control-surface contract remains locked.
- Added `refreshHomeSelectionSurfaces(brandId)` and switched the selected-brand mutation success paths (`toggleFavoriteFlow`, `togglePinFlow`, `useGeneratedAvatarFlow`, `handleHomeImageInputChange`, `restoreOriginalImageFlow`, `setLabelModeFlow`) to reuse that shared repaint helper before `refreshSelectedBrandDownloadSurface(target)`.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 62

- Continue in `home.js`, but shift from duplicate-definition cleanup to post-mutation lifecycle cleanup: look for the next smallest shared helper around empty downstream clearing, selection-surface refresh, or brand-rename aftermath.
- Prefer helper extraction only where multiple active branches already share semantics, and keep smoke coverage anchored on helper contracts instead of expanding more brittle inline source-string assertions.

## 2026-03-17 TDD checkpoint 63

- Continued the `home.js` post-mutation cleanup pass and extracted `refreshEmptyHomeDownstreamSurfaces()` so the shared “clear download panel + refresh calibration + persist config” semantics now live in one place.
- Updated the empty-brand/empty-selection success branches in `addBrandFlow()` and both active `deleteTargetFlow()` empty-fallback paths to use `refreshHomeSelectionSurfaces(...)` plus the new `refreshEmptyHomeDownstreamSurfaces()` helper instead of repeating inline downstream-clear logic.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock both the new empty-downstream helper contract and the fact that `addBrandFlow()` / `deleteTargetFlow()` now route those empty-home branches through the shared helper.
- Continued the same cleanup for the active `renameTargetFlow()` implementation by routing its shared selected-brand repaint through `refreshHomeSelectionSurfaces(selectedBrand)` before the existing sidebar/download refresh logic.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 63

- Stay on `home.js` and look for the next smallest lifecycle helper opportunity around `selectBrand()` / `selectPrinter()` / `renameTargetFlow()` so selection repaint, downstream clearing, and persistence sequencing become more uniformly shared.
- If the next worthwhile `home.js` helper becomes too abstract, switch back to a fresh behavior-driven slice instead of forcing more cleanup for its own sake.

## 2026-03-17 TDD checkpoint 64

- Continued the `home.js` lifecycle cleanup pass and extracted `refreshHomeSelectionDownstream(printer)` so the shared “render download panel for current printer or empty state + refresh calibration availability” semantics now live in one place.
- Updated the active `selectBrand()` and `selectPrinter()` implementations to use `refreshHomeSelectionSurfaces(selectedBrand)` plus `refreshHomeSelectionDownstream(...)` instead of repeating inline downstream refresh branches, while preserving the existing selection/version/sidebar ordering contract.
- Continued the same helper-first cleanup in `deleteTargetFlow()` by routing the non-selected printer delete repaint through `refreshHomeSelectionSurfaces(selectedBrand)` instead of another duplicated `renderBrands()` / `renderPrinters(selectedBrand)` pair.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the selection-driven and non-selected delete paths now lock onto the shared helper contracts (`refreshHomeSelectionSurfaces`, `refreshHomeSelectionDownstream`, `refreshEmptyHomeDownstreamSurfaces`) rather than brittle inline implementation details.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 64

- Stay on `home.js` and look for the next smallest worthwhile helper around selected-brand rename aftermath, `saveUserConfig()` sequencing, or the remaining duplicated “repaint only” mutation-success branches.
- If the next helper cut becomes too mechanical, switch to a fresh behavior gap in another active legacy page instead of over-optimizing `home.js` cleanup.

## 2026-03-17 TDD checkpoint 65

- Cleaned up the lingering `home.js` confusion around historical duplicate `renameTargetFlow()` / `handleHomeImageInputChange()` definitions by removing another shadowed pair and then re-aligning the smoke suite to the final active contracts.
- Kept the active `home.js` path on the shared helper trajectory: `selectBrand()` / `selectPrinter()` now rely on `refreshHomeSelectionDownstream(...)`, non-selected delete repaint uses `refreshHomeSelectionSurfaces(selectedBrand)`, and selected-brand mutation checks in smoke now consistently target the shared helper-based refresh semantics.
- Updated `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the remaining rename / image-upload / label-mode expectations no longer overfit to older inline refresh text and instead accept the current active helper contract where appropriate.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 65

- Continue on `home.js` only if there is still a clearly worthwhile lifecycle/helper consolidation around rename aftermath or persistence sequencing; otherwise the next best ROI may finally shift back to a fresh behavior-driven slice in another active legacy page.
- Prefer small, behavior-preserving cuts with smoke coverage over chasing every remaining textual duplication now that the major `home.js` helper surfaces are in place.

## 2026-03-17 TDD checkpoint 66

- Closed the lingering `home.js` red-zone around historical duplicate action handlers: removed another shadowed `renameTargetFlow()` / `handleHomeImageInputChange()` pair, then re-aligned the smoke suite so it now extracts the final active blocks more reliably instead of re-matching stale historical text.
- Finished one more small helper-alignment slice in the active `renameTargetFlow()` implementation by routing the selected-brand download refresh through `refreshSelectedBrandDownloadSurface(target)` instead of keeping a one-off inline `window.renderDownloadVersions(getPrinterObj(selectedPrinter))` branch.
- Normalized the remaining `home-runtime-smoke` expectations for selected-brand rename / image-upload / label-mode paths so they now accept the current shared helper contract rather than forcing older inline refresh patterns.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 66

- `home.js` is now close to diminishing returns; only take another helper-cleanup slice there if a very small, obviously shared persistence/repaint path remains.
- Otherwise shift the next TDD cycle back to a fresh behavior gap in another active legacy page (likely `presets.js` or a more realistic entry/integration smoke) instead of over-polishing `home.js` internals.

## 2026-03-17 TDD checkpoint 67

- Shifted the next high-ROI cycle back from `home.js` to `presets.js`, where context-menu handlers still had a few small stale-payload hops left even after the earlier apply/delete cleanup.
- Tightened `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` so `ctxBtnCopy` now explicitly follows the same contract as `ctxBtnApply` / `ctxBtnDelete`: it must pass `null` for the version argument and let `handleDuplicateLocal()` resolve the active version through `getCurrentPresetContext()`.
- Updated `src/renderer/assets/js/presets.js` so `ctxBtnCopy` no longer forwards `target.versionType`, removing another direct stale-payload hop from the local preset context-menu flow.
- Tightened the same smoke suite again so `ctxBtnEdit` now also follows the shared version-resolution strategy by passing `null` into `editAndApplyLocal(...)`, and added a grouped guard that `ctxBtnApply` / `ctxBtnEdit` / `ctxBtnCopy` / `ctxBtnDelete` are now aligned on the same context-first version-resolution policy.
- Updated `src/renderer/assets/js/presets.js` so `ctxBtnEdit` no longer forwards `target.versionType`, keeping the context-menu entry points more consistent before control drops into the downstream helper/apply flow.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 67

- Continue scanning `presets.js` for the remaining small context-menu or helper entry points that still over-trust target payloads where `getCurrentPresetContext()` should be the source of truth.
- If the next `presets.js` cleanup becomes too marginal, switch to a more realistic entry/integration smoke slice rather than stretching source-string cleanup past its useful ROI.

## 2026-03-18 TDD checkpoint 68

- Reassessed ROI after the latest `presets.js` context-first cleanup and shifted the next real implementation slice back to `home.js`, where `useGeneratedAvatarFlow()` still re-rendered selected-brand downloads through an inline `window.renderDownloadVersions(getPrinterObj(selectedPrinter))` path.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the selected-brand avatar-generation path now explicitly stays on the shared helper contract: `refreshHomeSelectionSurfaces(selectedBrand)` plus `refreshSelectedBrandDownloadSurface(target)`, and no longer accepts a direct inline `renderDownloadVersions(getPrinterObj(selectedPrinter))` refresh.
- Updated `src/renderer/assets/js/home.js` so `useGeneratedAvatarFlow()` now uses the same shared selected-brand repaint/download-refresh helper path as the other active brand mutation flows.
- This keeps the post-mutation download refresh semantics in one place and removes one more legacy-style direct refresh hop from the active `home.js` surface.

## Next TDD slice 68

- Continue along `home.js` only for the remaining tiny selected-brand mutation cleanup points, starting with whether `refreshSelectedBrandDownloadSurface(target)` itself should stop resolving the active printer through a fresh `getPrinterObj(selectedPrinter)` lookup.
- If that helper-level cleanup becomes awkward, pivot the next slice to a realistic entry/integration smoke instead of forcing more internal helper churn.

## Planned TDD slice 69

- Tighten `home-runtime-smoke` so `refreshSelectedBrandDownloadSurface(target)` prefers a shared downstream helper/context-aware active-printer resolution rather than inlining `window.renderDownloadVersions(getPrinterObj(selectedPrinter))`.
- Then update `home.js` to route that helper through `refreshHomeSelectionDownstream(...)` with a resolved active printer, keeping calibration/download semantics aligned.

## Planned TDD slice 70

- Re-scan `presets.js` for one more small context-first cleanup, with the best candidate currently being the rename/pin helper layer where active context is still partially reconstructed from target payload plus legacy globals.
- Prefer a tiny behavior-preserving change only if a real shared helper contract is still being bypassed; otherwise keep this slice test-only and move on.

## Planned TDD slice 71

- Add a more realistic renderer entry/integration smoke that locks a minimal `index.html -> init-modern-runtime -> legacy home/presets script` expectation, so future helper refactors are guarded by a less synthetic surface than single-function source-string slices.
- Keep the integration smoke intentionally narrow and read-only so it complements, rather than replaces, the existing per-function contract tests.

## Planned TDD slice 72

- Reassess whether `home.js` or `presets.js` still has one last high-ROI helper/convergence gap after the integration smoke lands.
- Prefer either a final tiny implementation slice uncovered by the new integration guard or a cleanup of `continue.md` / test inventory so the next checkpoint starts from the updated active suite map instead of stale assumptions.

## 2026-03-18 TDD checkpoint 69

- Continued the `home.js` selected-brand mutation cleanup and tightened the helper layer itself instead of only its callers: `refreshSelectedBrandDownloadSurface(target)` no longer directly calls `window.renderDownloadVersions(getPrinterObj(selectedPrinter))`.
- Updated `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that this helper now resolves `activePrinter` and routes the refresh through `refreshHomeSelectionDownstream(activePrinter)`, keeping download/calibration refresh semantics aligned with the rest of the active selection helpers.
- Updated `src/renderer/assets/js/home.js` so `refreshSelectedBrandDownloadSurface(target)` now delegates through `refreshHomeSelectionDownstream(...)`, removing another one-off direct downstream refresh path from the active home-page mutation flow.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.

## Next TDD slice 69

- Reassess whether `home.js` still has any tiny worthwhile helper divergence left after the selected-brand helper cleanup; if not, shift immediately back to `presets.js` or entry integration smoke.
- Keep preferring genuine shared-contract convergence over additional source-string churn.

## 2026-03-18 TDD checkpoint 70

- Shifted back to `presets.js` for one more small context-first cleanup where `togglePinnedPreset()` still persisted pin state using the context-menu snapshot keys even after resolving the active context for re-render.
- Tightened `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` so the pin/unpin path now locks `storagePrinterId` / `storageVersionType` to the shared current preset context first, before falling back to the context-menu payload keys.
- Updated `src/renderer/assets/js/presets.js` so `togglePinnedPreset()` now loads and saves the pinned set with the resolved current-context key pair, keeping persistence and re-render semantics on the same source of truth.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 70

- The next best ROI now looks like a more realistic entry/integration smoke instead of another tiny source-string cleanup in `home.js` or `presets.js`.
- If a clean integration seam proves awkward, fall back to one final small context-first preset helper slice rather than forcing a broad test harness change.

## Planned TDD slice 71

- Add a narrow renderer entry/integration smoke that verifies the active renderer runtime exports/bridge surfaces needed by the legacy `home` / `presets` pages are wired together from the real entry chain.
- Keep the scope small: prove one or two shared bridge helpers are present from the entry surface, rather than trying to simulate the full UI lifecycle.

## Planned TDD slice 72

- Use the new integration smoke to drive one more tiny implementation or contract adjustment if it reveals a genuine gap between entry wiring and page-level assumptions.
- If the integration seam is already green, spend this slice on consolidating the test inventory in `continue.md` so future TDD loops start from the correct active suite map.

## Planned TDD slice 73

- Reassess `presets.js` for any final helper that still mixes current-context resolution with stale target/global keys, but only take it if the slice is as small and clear as the recent `togglePinnedPreset()` cleanup.
- Otherwise keep momentum on the higher-value integration/testing side rather than over-polishing helper internals.

## Planned TDD slice 74

- Decide whether to take one final renderer-page convergence slice or pause implementation churn and leave the branch at a cleaner checkpoint with updated `continue.md` guidance, validated smoke suites, and an explicit next-ROI recommendation.
- Bias toward stopping at a crisp checkpoint if the remaining changes are mostly mechanical rather than behavior-revealing.

## 2026-03-18 TDD checkpoint 71

- Added a narrow renderer entry integration smoke in `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` instead of forcing another tiny helper cleanup in `home.js` / `presets.js`.
- This new slice locks two real entry-chain contracts together: `src/renderer/index.html` still contains the concrete legacy page anchors consumed by download/params flows, and `mountModernRuntime(...)` exposes the bridge helper family (`__getDownloadContextView__`, `__getActivePresetView__`, `__getParamsPresetView__`, `resolveActivePresetFileName`, `resolveParamsDisplayFileName`) that those pages depend on after entry bootstrap.
- The first draft of this smoke intentionally overshot by assuming runtime mount alone would yield an active preset view; the failing test clarified the real contract, so the final assertion now documents the current entry truth: download context is hydrated from runtime state, while active preset/file-name resolution still legitimately falls back until a preset is actually selected/applied.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/renderer-runtime.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/active-preset-view.test.ts tests/unit/renderer/entry/params-preset-view.test.ts tests/unit/renderer/entry/index-runtime-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 71

- Use the new integration smoke to decide whether there is a real entry/runtime gap worth fixing, rather than assuming mount should eagerly synthesize more state than the live app currently provides.
- The most plausible next slice is documentation/coverage around that fallback boundary, not speculative runtime eager-initialization.

## Planned TDD slice 72

- Add one adjacent integration-oriented assertion that the entry/runtime surface keeps download-context hydration and active-preset fallback semantics clearly separated, so future refactors do not accidentally blur those contracts.
- Prefer a test-only slice unless a real inconsistency appears.

## Planned TDD slice 73

- Reassess `presets.js` for any final helper that still bypasses the shared current context in a way the new integration smoke makes riskier or more visible.
- Only take an implementation cut if it is as small and unambiguous as the recent `togglePinnedPreset()` cleanup.

## Planned TDD slice 74

- Review whether the current entry/runtime/home/presets smoke inventory now covers the most important bridge seams, and prune or realign `continue.md` references if any suite naming or scope has drifted.
- Treat this as a checkpoint-hardening slice, not an excuse for broad refactoring.

## Planned TDD slice 75

- Decide whether to stop at a clean checkpoint after the integration-smoke pass or take one final tiny contract slice uncovered by the new coverage.
- Bias toward stopping if the remaining opportunities are mostly mechanical helper cleanup rather than genuine behavior or boundary clarification.

## 2026-03-18 TDD checkpoint 72

- Avoided adding another “shape-only” integration smoke and instead tightened a real runtime behavior boundary in `tests/unit/renderer/entry/active-preset-view.test.ts`.
- Added a context-switch assertion that proves the active preset bridge is not sticky: after both `standard` and `quick` applied-preset mappings exist, `__syncLegacyContextToModern__({ versionType: 'quick' })` must move `__getActivePresetView__()` and `__getParamsPresetView__()` to the quick preset instead of leaving them on the previously selected standard mapping.
- Re-verified this against adjacent runtime bridge tests with `npm.cmd test -- tests/unit/renderer/entry/active-preset-view.test.ts tests/unit/renderer/entry/params-preset-view.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.
- This slice is valuable because it protects a real cross-page behavior seam exposed by the new integration work: download context hydration and active-preset resolution are separate concerns, but they still must converge correctly after legacy-driven context switches.

## Next TDD slice 72

- Prefer another real cross-surface behavior assertion only if it protects a live runtime boundary like this one; do not add source-shape or redundant smoke just to extend the sequence.
- The best next candidate is a `presets.js` or params-side behavior that depends on version switching after active preset mappings diverge.

## Planned TDD slice 73

- Reassess whether the download/params/presets bridge has one more real behavior seam around version switching plus active preset resolution, especially where legacy-triggered context changes should refresh the visible preset/file label consistently.
- Only take the slice if it can be expressed as a stateful behavior test, not a source-string assertion.

## Planned TDD slice 74

- Review the active test inventory and `continue.md` ordering so the newest runtime/integration/behavior checkpoints are easy to follow and old planning fragments do not imply stale priorities.
- This is worthwhile if the next behavior slice is not yet obvious; otherwise leave docs cleanup until the next stop point.

## Planned TDD slice 75

- Decide whether there is one final high-ROI runtime behavior seam worth locking before pausing, or whether the branch is at a good checkpoint already.
- Bias toward stopping if the remaining opportunities require speculative setup rather than clarifying a current live contract.

## 2026-03-18 TDD checkpoint 73

- Continued with another real runtime behavior slice instead of a synthetic smoke: tightened `tests/unit/renderer/entry/calibration-context-view.test.ts` so calibration context must also switch preset path when legacy-driven version context changes.
- The new test sets both `standard` and `quick` applied-preset mappings, confirms calibration starts on the standard preset path, then drives `__syncLegacyContextToModern__({ versionType: 'quick' })` and verifies `__getCalibrationContextView__()` moves to the quick preset path while staying aligned with `__getParamsPresetView__()`.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/calibration-context-view.test.ts tests/unit/renderer/entry/active-preset-view.test.ts tests/unit/renderer/entry/params-preset-view.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.
- This effectively closes the current runtime/entry-phase seam around version switching: download context, active preset, params preset, and calibration preset path are now all explicitly guarded against stale cross-version state after legacy-to-modern context sync.

## Next Phase

- The current runtime bridge phase has reached a solid checkpoint: the highest-value remaining work is no longer another bridge/view behavior test unless a new bug appears.
- Shift the next phase back to page-level behavior in `presets.js` / `params.js` / `home.js`, or spend one cleanup slice normalizing `continue.md` so the active priorities are easier to follow.

## Phase Entry Options

- **Option A:** Return to page-level behavior and find the next real UI/runtime gap in `presets.js` or `params.js`.
- **Option B:** Do one maintenance slice on `continue.md` / test inventory to clean up stale planning fragments before the next coding wave.

## 2026-03-18 TDD checkpoint 74

- Continued into the next phase with another real stateful behavior slice rather than a source-shape assertion: tightened `tests/unit/renderer/entry/params-file-label.test.ts` so params-page-facing file label and preset path helpers must switch with selected version context.
- The new test mounts the real runtime, seeds both `standard` and `quick` applied-preset mappings, verifies that `resolveParamsPresetPath(...)` and `resolveParamsDisplayFileName(...)` initially point at the standard preset, then drives `__syncLegacyContextToModern__({ versionType: 'quick' })` and confirms both helpers switch to the quick preset.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/active-preset-view.test.ts tests/unit/renderer/entry/params-preset-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.
- This closes another real page-facing seam: even before rendering DOM, the params page now has explicit guardrails that its visible file label and backing preset path stay aligned after version switching changes the active preset mapping.

## Next Phase Focus

- The runtime/helper side is now well covered for version-switch convergence; the next high-ROI work should target actual page logic in `params.js` or `presets.js`, not more bridge-helper tests unless a bug demands it.
- Prefer bugs or asymmetries where rendered page state, mutation aftermath, or user-visible refresh behavior still diverges from the now-stable runtime contracts.

## Suggested Next TDD slices

- `params.js`: look for a true page behavior gap around `renderDynamicParamsPage()`, `saveAllDynamicParams()`, or `demoRestoreDefaults()` after version or active-preset changes.
- `presets.js`: if `params.js` has no clean seam, return to context-menu / mutation aftermath only where there is a user-visible stale-state symptom, not just another helper cleanup.

## 2026-03-18 TDD checkpoint 75

- Continued with a short 5-slice TDD burst focused on page-level behavior and contract hardening instead of broad refactors.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` with two additional params-page guards: `demoRestoreDefaults()` must finish `emitActivePresetUpdated(...)` and `broadcastPresetMutation(...)` before `await renderDynamicParamsPage()`, and `saveAllDynamicParams()` must keep `presetPath` as the single resolved anchor for overwrite + cache update.
- Those two params slices were verification-only wins: the active implementation already matched the intended post-save/post-restore order, so no `params.js` code change was needed.
- Tightened `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` and then updated `src/renderer/assets/js/presets.js` so `editAndApplyLocal()` no longer falls back to the legacy global `selectedVersion` once shared current context and explicit args are exhausted; it now passes `null` onward just like the other context-menu entry points.
- Tightened the same smoke suite again and updated `src/renderer/assets/js/presets.js` so `handleDownloadOnline()` also stops re-rendering the local list with a direct `selectedVersion` fallback, keeping its post-download refresh on the same context-first version-resolution policy.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts` and `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts`.

## Next TDD slice 75

- Stay on page-level stale-state and refresh-order issues, not helper-shape churn.
- Best next candidates: one more `presets.js` transient UI-state reset across context switches, or a concrete `params.js` visible stale-label/dirty-state bug after restore/save.

## Planned TDD slice 76

- Re-scan `presets.js` for transient local-list state that should reset on printer/version context changes, but only if the symptom is user-visible and the fix is small.

## Planned TDD slice 77

- Re-scan `params.js` for a real page-state aftermath bug where visible label, dirty-state, or refresh timing can lag the shared mutation signals.

## Planned TDD slice 78

- If no clean behavior bug emerges immediately, take a lightweight `continue.md` / inventory cleanup slice rather than padding source-shape smoke.

## Planned TDD slice 79

- Reassess whether the branch is at a clean checkpoint after the next one or two page-level slices; bias toward stopping if remaining work turns speculative.

## Planned TDD slice 80

- Take one final small TDD slice only if another concrete stale-state or refresh-order bug appears; otherwise hand off at the cleaner checkpoint.

## 2026-03-18 TDD checkpoint 76

- Continued the page-level `presets.js` pass with another small context-first cleanup in the batch action layer instead of pivoting back to helper-shape churn.
- Tightened `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` so `executeBatchDuplicate()` now explicitly follows the same contract as the single-item copy entry points: it must pass `null` for the version argument and let `handleDuplicateLocal()` resolve active version context internally.
- Updated `src/renderer/assets/js/presets.js` so the batch duplicate loop no longer forwards `context.versionType` into `handleDuplicateLocal(...)`, reducing another stale-payload hop in the local preset duplication flow while preserving the final context-based re-render.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## 2026-03-18 TDD checkpoint 77

- Took one adjacent contract-hardening slice in `presets.js` batch actions without forcing unnecessary code churn where the active implementation already matched the intended behavior.
- Tightened `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` so `executeBatchDelete()` is now explicitly guarded to stay anchored on `getCurrentPresetContext()` for both `clearAppliedPresetSelection(...)` and the final `renderPresetList(...)` re-render after clearing selection state and leaving multi-select mode.
- The live `src/renderer/assets/js/presets.js` batch delete implementation already satisfied this shared-context contract, so this slice stayed test-only after verification.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts`.

## Next TDD slice 77

- Continue on page-level stale-state/reset behavior rather than bridge-shape checks.
- Best next candidate is `presets.js` selection-state cleanup across context switches or batch action aftermath, only if it exposes a visible stale-selection symptom.
- If no clean `presets.js` seam appears, pivot to `params.js` for a visible dirty-state or file-label refresh bug after save/restore/version switch.

## 2026-03-18 TDD checkpoint 78

- Continued the page-level `presets.js` pass by tightening version-switch reset behavior instead of forcing another speculative implementation edit.
- Strengthened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` so `renderDownloadVersions()` now has an explicit grouped guard that both render branches reset transient local-list state in the same stable order before re-render: clear selected files, reset local search, restore custom sort mode, clear drag state, exit multi-select mode, hide stale context menu, then call `renderPresetList(...)`.
- The active `src/renderer/assets/js/presets.js` implementation already satisfied this contract, so this slice remained test-only after verification.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts`.

## Next TDD slice 78

- Stay on user-visible page behavior, not bridge/helper shape.
- Best next candidate is `params.js`, especially a visible stale label / dirty-state / post-restore refresh seam that is not yet covered by the existing helper-level version-switch tests.
- If `params.js` has no clean behavior cut, come back to `presets.js` only for another concrete selection-state symptom rather than more source-structure hardening.

## 2026-03-18 TDD checkpoint 79

- Shifted into `params.js` as planned and tightened another page-level dirty-state contract instead of returning to more `presets.js` source-shape work.
- Added a new guard in `tests/unit/renderer/entry/params-runtime-smoke.test.ts` so `saveAllDynamicParams()` must continue clearing dirty UI through `markActiveParamSnapshotSaved(snapshot)` before it emits `params-save` mutation signals; this keeps the visible file label / save button cleanup anchored on the shared saved-snapshot path rather than ad hoc label writes.
- The active `src/renderer/assets/js/params.js` implementation already satisfied that sequencing, so this slice remained test-only after verification.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.

## 2026-03-18 TDD checkpoint 80

- Took one adjacent `params.js` guard around restore-defaults aftermath so the visible dirty-label cleanup stays on the same saved-snapshot + rerender path.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to lock that `demoRestoreDefaults()` continues to route through `pushParamSnapshotToHistory(restoredSnapshot, { markSaved: true })`, then conditionally `applyParamSnapshotToDom(...)` / `renderDynamicParamsPage()` only when the params page is visible, without reintroducing inline `currentEditingFile` dirty-label mutation.
- The live `src/renderer/assets/js/params.js` implementation already matched this shared contract, so this slice also remained test-only.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 80

- `params.js` dirty-state and label-refresh contracts are now much better fenced; the next worthwhile slice should preferably be a real visible behavior gap rather than another ordering-only assertion.
- Best next candidate is a stateful behavior seam around params page navigation / unsaved-change prompt / auto-save-on-leave, if a small reproducible asymmetry exists.
- If that seam stays too synthetic, pause `params.js` and reassess another page-level behavior bug before adding more contract-only coverage.

## 2026-03-18 TDD checkpoint 81

- Continued on `params.js` with the planned navigation/unsaved-change seam instead of drifting back to lower-value helper cleanup.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` so `canNavigateAwayFromParams(nextPage)` must keep the dirty branch on the shared contract: hidden/non-params/no-dirty paths return early, the warning modal decides between `discardActiveParamChanges()` and `saveAllDynamicParams({ skipConfirm: true })`, and no parallel ad hoc save/discard path is reintroduced.
- The active implementation already matched this leave-page contract, so this slice remained test-only after verification.

## 2026-03-18 TDD checkpoint 82

- Added an adjacent keyboard-flow guard in `tests/unit/renderer/entry/params-runtime-smoke.test.ts` so the `Ctrl/Cmd+S` branch inside `bindParamEditors()` stays aligned with the leave-page save path and continues to call `saveAllDynamicParams({ skipConfirm: true })` only when the params page is visible and no blocking modal is open.
- The live `params.js` keyboard handler already satisfied that shared save-path contract, so this slice also stayed test-only.

## 2026-03-18 TDD checkpoint 83

- Tightened one more `params.js` editor-lifecycle guard around undo/redo so history stepping does not drift away from the same visibility/modal gating used by keyboard save.
- Updated `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to lock that `Ctrl/Cmd+Z` and redo shortcuts remain behind the shared `isParamsVisible` / `modalVisible` gate and only then call `stepParamHistory(..., { restoreFocus: false })`.
- The active implementation already matched this contract; no production code change was needed.

## Planned TDD slice 84

- Stay on `params.js`, but only for one more small stateful seam if it is user-visible: ideally whether hidden-page save/undo shortcuts are fully suppressed before any side effects.

## Planned TDD slice 85

- If the keyboard/navigation seam is now sufficiently fenced, stop adding params contract-only coverage and either pivot to another page-level behavior bug or end this burst at a clean checkpoint.

## 2026-03-18 TDD checkpoint 84

- Continued the same `params.js` keyboard/navigation seam with one smaller but user-visible guard: `Escape` should still dismiss params context menus even if the page is hidden or a blocking modal is currently open, while the save/history shortcuts remain gated.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` so `bindParamEditors()` explicitly keeps `if (event.key === 'Escape') hideContextMenus();` before the shared `isParamsVisible || modalVisible` early-return gate.
- The active implementation already matched this behavior, so the slice stayed test-only.

## 2026-03-18 TDD checkpoint 85

- Finished this 5-slice `params.js` burst by tightening one more gate-consistency contract instead of forcing a speculative code edit.
- Updated `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to lock that once `!isParamsVisible || modalVisible` returns early inside `bindParamEditors()`, the keyboard branch cannot fall through into either `saveAllDynamicParams({ skipConfirm: true })` or `stepParamHistory(...)` side effects.
- Re-verified the whole params burst with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next Phase Suggestion

- This `params.js` keyboard/navigation/dirty-state seam is now well fenced; another contract-only slice here will likely have diminishing returns.
- The next high-ROI move should be a fresh page-level behavior gap in another active legacy page (`presets.js`, `home.js`, or a narrow integration path), not more `params.js` source-shape hardening unless a real bug appears.

## 2026-03-18 TDD checkpoint 86

- Switched from abstract contract hardening back to a real GUI-reported behavior bug: after selecting a version on the download page, the visible selection state and downstream calibration/params path context could stay stale.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` so the version-card click callback in `renderDownloadVersions()` must no longer stop at `selectedVersion = versionType`; it now explicitly syncs the chosen `printerId/versionType` back into the modern runtime via `window.__syncLegacyContextToModern__(...)` before sidebar/update-list refresh continues.
- Updated `src/renderer/assets/js/presets.js` so the active download-page version selection callback now calls `window.__syncLegacyContextToModern__({ printerId: resolvedPrinter.id, versionType })` immediately after updating the legacy `selectedVersion` global.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/calibration-context-view.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 86

- Re-test the reported GUI flow manually: choose a version in `下载预设`, confirm the version card gets selected, then enter calibration/params and verify the active preset path no longer falls back to the “请先在【下载预设】页面应用一个配置” empty state when a local preset is already applied.
- If a visible issue still remains, the next likely seam is that the click callback refreshes sidebar/calibration state but does not immediately re-render the version-card container itself after the selected version changes.

## 2026-03-18 TDD checkpoint 87

- Followed the manual GUI retest feedback immediately and confirmed there was still a second bug after checkpoint 86: clicking a different version updated the sidebar badge and modern context, but the version-card container itself did not repaint, so the download page showed no selected card or kept stale selection visuals.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` again so the version-card click callback in `renderDownloadVersions()` must now re-enter `renderDownloadVersions(resolvedPrinter)` after syncing the chosen `versionType` into modern context, before the rest of the sidebar/list refresh continues.
- Updated `src/renderer/assets/js/presets.js` so the active version-card click callback now immediately calls `renderDownloadVersions(resolvedPrinter)` after `window.__syncLegacyContextToModern__(...)`, forcing the card group to repaint against the new selected version instead of waiting for some later external refresh.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/calibration-context-view.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 87

- Re-test the exact GUI flow again: switch between `standard` and `quick`, verify the right-side version card selection follows every click, then enter calibration/params and confirm the active preset path is still available.
- If one more bug remains, the next suspect is no longer context sync but the applied-preset/path layer itself (for example, selected version changing without a matching applied preset for that branch).

## 2026-03-18 TDD checkpoint 88

- Followed the next round of GUI feedback and found another real home→download state bug: switching from one printer to another could keep carrying over the old `selectedVersion` when both printers happened to support the same version label (for example both exposing `standard`), which made the new printer look pre-selected instead of resetting to “未选择”.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so `selectPrinter(printerId, keepVersion)` must now record the previous printer id and clear `selectedVersion` when the printer actually changes, even if the previous version label is still technically supported by the new printer.
- Updated `src/renderer/assets/js/home.js` so `selectPrinter()` now captures `previousPrinterId` before mutating `selectedPrinter`, and resets `selectedVersion` whenever `selectedPrinter !== previousPrinterId`, preserving the old unsupported-version guard while fixing the stale carried-version bug.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 88

- Re-test the GUI flow across printer switches: choose `A1 -> standard`, then switch to another printer that also supports `standard`, and confirm the version card area resets to an unselected state instead of inheriting the old selection.
- If another issue remains after that, the next likely seam is whether printer switching also needs an explicit modern-context sync for the cleared version, not just the legacy `selectedVersion = null` reset.

## React 迁移总计划（新增）

### 目标判断

- 当前 renderer 已经不再适合继续长期停留在 `index.html + assets/js/*.js + 手工 DOM` 的主形态。
- 现阶段 TDD 的价值，已经从“救火修状态”逐步转向“为 React UI 替换建立稳定业务底座与防回归护栏”。
- 因此下一大阶段应明确升级为：**在保留现有 Electron / preload / runtime / service 能力的前提下，逐步迁移到 `React + Vite + TypeScript + Zustand` UI 架构**。

### 迁移目标

1. 保留当前用户端全部核心功能：
   - 机型选择
   - 预设下载 / 应用 / 删除 / 复制 / 批量管理
   - 参数编辑 / 保存 / 恢复默认
   - Z / XY 校准
   - 更新检查 / 下载 / 应用 / 回退
   - 设置 / FAQ / 关于页
2. 保留当前可见交互体验：
   - 卡片选中态
   - 列表刷新节奏
   - 页面切换动画
   - 按钮 loading / success / hint 动画
   - gallery / collapse / hover / badge 反馈
3. 逐步替换 legacy DOM 页面，不做一次性大爆炸重写。
4. 让现有 modern runtime/store/service 继续作为 React UI 的业务后端，而不是推翻重来。

### 推荐技术栈

- `React 18`
- `Vite`
- `TypeScript`
- `Zustand`
- 保留现有 `Tailwind` / 现有 CSS 变量体系
- 动画优先使用：
  - CSS transition / transform
  - 必要时再引入轻量 motion 库
- Electron 保持现有主进程 / preload / IPC 基线不变

### 为什么是 Zustand

- 当前项目已经有明显的“业务状态”和“页面显示状态”分离需求。
- Zustand 适合当前 Electron 单进程渲染层：
  - 轻量
  - 容易和现有 runtime bridge 对接
  - 不强迫重型样板代码
  - 适合逐页迁移与混合阶段并存

### 迁移原则

1. **保业务，不先保实现**：保留功能与行为，不保 legacy DOM 结构。
2. **先共存，后替换**：React 页面与 legacy 页面允许短期共存。
3. **先读后写**：优先把 React 接到现有 runtime 只读 view/helper 上，再接管写路径。
4. **动画逐步复刻**：先保交互顺序和状态反馈，再逐步对齐视觉细节。
5. **每迁一个页面，都必须有退出条件和回归护栏。**

### 当前还缺的计划项（反思补充）

目前原计划更多覆盖了“bridge 收口”和“legacy page 行为修复”，但还缺以下正式计划：

1. **前端框架迁移阶段规划**
   - 以前没有正式定义何时从 legacy DOM 进入 React UI 阶段
   - 现在必须补上

2. **UI 状态分层计划**
   - 哪些状态留在 runtime/store/service
   - 哪些放进 Zustand UI store
   - 哪些保持组件局部状态

3. **视觉/动画迁移计划**
   - 哪些动画必须 1:1 保真
   - 哪些可先降级再恢复

4. **页面迁移顺序计划**
   - 先迁哪页
   - 哪些页必须等别的页稳定后再迁

5. **测试迁移策略**
   - 现有 smoke/契约测试如何继续服务 React 阶段
   - React 页面新增何种组件/集成测试

6. **构建与入口计划**
   - Vite 如何接入 Electron renderer
   - 新旧入口如何共存

7. **发布与回退计划**
   - React 迁移期间如何保证用户端依旧可打包、可运行、可回退

### React 迁移阶段图

#### Stage R0：迁移前冻结

目标：
- 冻结 legacy -> modern runtime 边界
- 冻结页面核心行为清单
- 冻结必须保留的 UI 动效清单

退出条件：
- `home / presets / params / updates` 的关键行为已有 smoke 或 runtime 护栏
- 当前 `continue.md` 已明确“哪些是必须 1:1 保留”的用户可见行为

#### Stage R1：接入 React/Vite 基础骨架

目标：
- 在 renderer 中引入 `React + Vite + TypeScript + Zustand`
- 保持 Electron / preload / runtime 不动
- 新旧入口可共存

输出：
- `src/renderer/react-app/`（或等价目录）
- React 入口
- Vite 构建配置
- 与 Electron renderer 打通

退出条件：
- Electron 可以启动 React renderer
- 不影响现有 legacy 页面可运行性

#### Stage R2：抽 UI 适配层

目标：
- 把现有 bridge/runtime/helper 包装成 React 可消费 hooks / selectors
- 明确 Zustand store 边界

建议新增：
- `useDownloadContext()`
- `useActivePreset()`
- `useParamsPreset()`
- `useCalibrationContext()`
- `useUpdateState()`

退出条件：
- React 页面无需直接读 legacy global 或手工 query DOM

#### Stage R3：首个页面迁移（建议 `presets/download`）

原因：
- 状态边界已较清晰
- 用户价值高
- 能最早体现“看得见”的 UI 改造成果
- 已有较多 TDD 护栏可借用

目标：
- 用 React 重做版本选择 + 本地预设列表 + 在线预设列表
- 保留：
  - 应用态
  - 下载态
  - 当前版本选择
  - 搜索 / 批量 / 排序 / 高亮反馈

退出条件：
- 用户在新页面上能完成完整下载预设主流程
- 旧 `presets.js` 对应主渲染职责可降级为兼容层

#### Stage R4：参数页迁移（`params`）

目标：
- 迁移参数页主容器、分组卡片、字段编辑、dirty 状态、保存/恢复默认
- G-code 编辑器先保功能后精修交互

注意：
- 参数页是最复杂页面之一
- 必须在 R3 后进行

退出条件：
- 参数主流程不再依赖 legacy DOM 构建
- `save / restore / dirty / active preset sync` 均由 React + service 驱动

#### Stage R5：首页迁移（`home`）

目标：
- 迁移品牌条、打印机 gallery、compact/detailed 模式、右键管理入口
- 保持当前 gallery 交互与动画体验

退出条件：
- 机型选择与下游下载区联动完全由 React 页面承接

#### Stage R6：更新/设置/FAQ/关于迁移

目标：
- 迁移较轻页面
- 清理 legacy 页面壳

退出条件：
- 主用户流程页面全部完成 React 化

#### Stage R7：legacy renderer 收尾

目标：
- legacy `assets/js/*.js` 页面逻辑退化为兼容代理或下线
- 保留必要 helper/adapter，但去掉主要 DOM 渲染逻辑

退出条件：
- renderer 主入口完全以 React UI 为主

### 页面迁移优先级

优先顺序建议：

1. `download / presets`
2. `params`
3. `home`
4. `updates`
5. `settings / faq / about`

不建议的顺序：
- 先迁最复杂的 `home`
- 一开始就强做 `params + home` 双页并行

### Zustand 状态规划

#### 应保留在 runtime/service 的状态

- 当前品牌 / 机型 / 版本上下文
- 当前已应用 preset
- 校准上下文
- 更新状态
- manifest / 资源 / 文件读写 / IPC

#### 应放在 Zustand 的 UI 状态

- 当前页面 UI 视图状态
- 本地搜索词
- 批量模式开关
- 批量选择集合
- 当前排序模式
- 浮层 / modal / context-menu 开关
- 动画中态 / loading 态 / success 提示态

#### 应保持组件局部状态

- 输入焦点
- hover
- 临时展开/折叠态
- 某些短生命周期动画开关

### 动画与视觉保真计划

#### 必须优先保留的动画/反馈

- 版本卡片选中反馈
- 应用/下载按钮 loading -> success 状态切换
- 当前使用 badge
- 首页 gallery 选中与滚动对齐
- params 保存成功反馈
- 更新提示 / 红点 / ready prompt

#### 可后续补强的动画

- 微交互 easing 完全一致
- 某些 hover 阴影细节
- 历史 CSS class 的逐像素对齐

### 测试迁移计划

#### 现有测试如何保留

- 现有 runtime/helper/bridge TDD 不删除
- 它们继续作为 React 页面后的业务底座回归护栏

#### React 阶段新增测试

- 组件测试：
  - 版本列表
  - 本地 preset 列表
  - 参数字段组
  - gallery 卡片
- 集成测试：
  - React 页面 + runtime hooks + mock service
- 行为测试：
  - 关键用户流程（下载、应用、保存、恢复默认）

#### 测试门禁

- 每迁一个页面，旧 smoke 不得立刻删除
- 必须先有 React 页面测试，再下掉 legacy DOM 测试中已失效的部分

### 构建与入口计划

- 保留 Electron 主进程不变
- renderer 增加 Vite 构建入口
- 初期允许：
  - `legacy index.html`
  - `react renderer entry`
  共存
- 最终再收敛到 React 主入口

### 风险与应对

#### 风险 1：UI 重做导致业务回归
- 应对：先保 runtime contract，再迁页面

#### 风险 2：动画还原度不够，用户感觉“变味”
- 应对：先列出必须保真动画清单，逐项验收

#### 风险 3：React 和 legacy 并存期间状态双写
- 应对：只允许 runtime/service 做业务真相源，UI 层不创造第二业务源

#### 风险 4：Vite/Electron 入口复杂度上升
- 应对：先做最小接入，不同时重做主进程和构建链

### 迁移前还需要补的计划（当前明确缺口）

1. **React renderer 目录结构最终定稿**
2. **Vite 与 Electron 打包接入方案**
3. **Zustand store 列表与 ownership 文档**
4. **必须 1:1 保真的动画清单**
5. **首个迁移页的验收标准（建议 `presets/download`）**
6. **旧 DOM 页面退场策略**

### 与当前 TDD 的衔接方式

- 当前 TDD 不废弃
- 当前 page-level stale-state 修复，全部视为 React 迁移前的行为冻结工作
- 当开始 React 页面迁移时：
  - 先迁一个页面
  - 继续沿用已有 runtime contract 测试
  - 再补 React 页面层测试

### 进入 React 阶段的建议门槛

满足以下条件后即可正式进入 React UI 迁移：

1. `presets.js` 和 `params.js` 再完成少量真实页面行为收口
2. 当前 UI 主要 stale-state 风险已降到可控
3. `cloud_data` / 启动资源 / runtime bridge 可稳定工作
4. 先明确首个迁移页与验收标准

### 下一阶段建议

1. 继续做 2~4 个真实 page-level TDD 切片，优先 `params.js` / `presets.js`
2. 同时补一份单独的 `React Migration Spec`（若后续需要）
3. 然后进入 `Stage R1 + Stage R2`
4. 首个 React 页面建议选 `download/presets`

## 首个 React 迁移页执行计划：`download / presets`

### 为什么先迁这一页

- 当前业务边界已经相对清楚：
  - `__getDownloadContextView__`
  - `resolveActivePresetFileName`
  - `resolveDownloadAppliedState`
  - `checkOnlineUpdates`
  - `handleApplyLocal`
  - `handleDownloadOnline`
- 已有较完整 TDD 护栏：
  - `presets-runtime-context-smoke.test.ts`
  - `presets-runtime-applied-state-smoke.test.ts`
  - `presets-runtime-version-refresh-smoke.test.ts`
- 用户可见收益高
- 能最快验证 React UI 是否能承接当前主要交互与动画

### 迁移范围（首批）

首批迁移只覆盖 `page-download` 中以下区域：

1. **版本类型选择区**
   - `downloadVersionList`
   - 版本卡片选中态
   - 版本切换逻辑

2. **本地预设区**
   - `localPresetsList`
   - empty state
   - applied state
   - 最新标记
   - 搜索 / 排序 / 多选 / 批量栏
   - context menu 入口

3. **在线预设区**
   - `onlinePresetsList`
   - 检查更新
   - 下载按钮 loading / success

4. **下载页导航反馈**
   - `downloadBtn`
   - `downloadHintWrapper`
   - `step2Badge`

### 暂不迁移（首批排除）

- 校准页 DOM
- 参数页 DOM
- 首页 gallery DOM
- 侧边栏整体 React 化
- 全局页面导航系统 React 化

### React 页面目标结构（建议）

```txt
src/renderer/react-app/
  entry/
    download-page-entry.tsx
  pages/download/
    DownloadPage.tsx
    components/
      VersionSelector.tsx
      LocalPresetToolbar.tsx
      LocalPresetList.tsx
      LocalPresetCard.tsx
      OnlinePresetList.tsx
      OnlinePresetCard.tsx
      EmptyPresetState.tsx
  hooks/
    useDownloadContext.ts
    usePresetList.ts
    useOnlinePresetList.ts
    usePresetActions.ts
  stores/
    useDownloadPageUiStore.ts
```

### Zustand 状态拆分（首批）

#### `useDownloadPageUiStore`

承载：
- `localSearchQuery`
- `localSortMode`
- `isMultiSelectMode`
- `selectedLocalFiles`
- `expandedPresetIds`
- `newlyDownloadedFile`
- `onlineLoading`
- `downloadingFileIds`
- `contextMenuState`

不承载：
- 当前品牌 / 机型 / 版本
- 当前已应用 preset
- 更新模式 / app manifest

这些仍继续来自 runtime / service / helper。

### 运行时接入方式

React 页首批不直接自己发明业务状态，而是消费现有 runtime/helper：

- `window.__getDownloadContextView__()`
- `window.resolveActivePresetFileName(...)`
- `window.resolveDownloadAppliedState(...)`
- `window.mkpAPI.listLocalPresetsDetailed()`
- `window.mkpAPI.readLocalPresetsManifest()`
- `window.mkpAPI.downloadFile()`
- `window.mkpAPI.copyBundledPreset()`
- `window.mkpAPI.deleteFile()`
- `window.mkpAPI.duplicatePreset()`
- `window.mkpAPI.renamePresetDisplay()`

### 兼容策略

#### 迁移阶段 1：挂载式替换

- 在 `page-download` 内增加 React mount 点
- React 接管下载页主体
- legacy `presets.js` 逐步退化为：
  - 兼容导出层
  - 少量未迁移 action 代理层

#### 迁移阶段 2：写路径接管

- React 页面接管：
  - apply
  - download
  - duplicate
  - delete
  - rename
  - pin
  - sort/search/batch

#### 迁移阶段 3：legacy 页面壳收缩

- 只保留 runtime helper 与少量 fallback
- 下线 `renderPresetList()` / `renderVersionCards()` 主 DOM 渲染职责

### 必须 1:1 保留的交互/动画（首批）

1. 版本卡片选中态
2. 本地预设“当前使用” badge
3. 下载按钮 loading -> success 过渡
4. 本地刚下载 flash 高亮
5. 多选模式工具栏开关
6. 搜索栏展开/收起体验
7. CTA disabled / hint 透明度联动
8. collapse 展开/收起节奏

### 首批迁移验收标准

#### 业务验收

- 能切版本
- 能看本地预设
- 能看在线预设
- 能下载预设
- 能应用预设
- 能显示 applied/latest/downloaded 状态
- 能搜索 / 排序 / 批量选择
- 能删除 / 复制 / 重命名 / 置顶

#### 状态验收

- 切版本不会串：
  - downloaded 高亮
  - batch selection
  - search query
- CTA 状态正确
- calibration availability 仍正确刷新

#### 测试验收

- 现有 `presets` runtime smoke 全绿
- 新增 React 组件 / 集成测试全绿
- `npm.cmd run typecheck` 通过

### 首批迁移前还需补的最小准备

1. 明确 React mount 点放在哪里
2. 明确 Vite renderer 入口命名
3. 写出 `useDownloadContext` / `usePresetActions` 的接口草案
4. 明确旧 `presets.js` 在共存期还保留哪些函数

### 迁移前建议再补的最后几条 TDD

- `presets.js` 排序状态是否需要跨上下文 reset
- `presets.js` context-menu 目标是否会在上下文切换后滞留
- `params.js` save/restore 后是否还有 visible stale label/dirtiness 边角

### 可以开始实施的信号

一旦你决定正式进入 React 迁移，下一步就不应再继续无限追加 legacy TDD，而是：

1. 搭 React/Vite 基础骨架
2. 先做 `download/presets` 的 React 页面壳
3. 用现有 runtime contract 把第一个页面跑起来

## 2026-03-18 TDD checkpoint 75

- Continued into real page-level behavior and found a genuine stale-state gap in `presets.js`: the `window.newlyDownloadedFile` highlight marker survived version-context switches, so a file downloaded under one version could stay visually highlighted after the local list re-rendered for another version.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` to lock that `renderDownloadVersions()` now clears `window.newlyDownloadedFile` before either branch of local-list refresh (`renderPresetList(resolvedPrinter, null)` and `renderPresetList(resolvedPrinter, resolvedVersionType)`), instead of letting download-highlight state bleed across version switches.
- Updated `src/renderer/assets/js/presets.js` so `renderDownloadVersions()` now resets `window.newlyDownloadedFile = null` before re-rendering the version-specific local list.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.
- This is a real UX-facing fix: version changes no longer carry over a stale “just downloaded” flash to the wrong preset list.

## Next TDD slice 75

- Keep chasing only page-level stale-state or refresh-order bugs of this kind; avoid dropping back into helper-shape assertions unless a bug requires them.
- The best next candidates are `params.js` save/restore aftermath or another `presets.js` UI state that may survive across context switches incorrectly.

## Planned TDD slice 76

- Re-scan `params.js` for a genuine page-state asymmetry after save/restore, especially around dirty-state reset, current file label, or page refresh order after `emitActivePresetUpdated` / `broadcastPresetMutation`.
- Prefer a slice that can be expressed as a stateful behavior test or a concrete source-order contract tied to a real UI symptom.

## Planned TDD slice 77

- Re-scan `presets.js` for one more user-visible stale UI state that could survive version/printer switches, such as selection, search, or batch-state bleed-through.
- Only take it if the symptom is concrete and the fix is similarly small.

## Planned TDD slice 78

- If no clean page-level bug emerges, take a maintenance slice on `continue.md` to prune stale historical planning fragments so the active roadmap is easier to follow from the latest checkpoint onward.
- Keep this lightweight and avoid mixing it with unrelated code churn.

## Planned TDD slice 79

- Reassess whether the branch is at a good handoff checkpoint after one or two more page-level slices.
- Bias toward stopping once the next remaining items become speculative rather than clearly bug-shaped.

## Planned TDD slice 80

- If another real page-level bug still appears after the above, take one final small TDD slice; otherwise end the cycle with updated `continue.md`, green targeted tests, and a crisp next-phase recommendation.

## 2026-03-18 TDD checkpoint 79

- Continued another 5-slice TDD burst and stayed focused on page-level stale-state / aftermath behavior rather than helper-shape churn.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` to lock that `renderDownloadVersions()` now also resets `localSortMode` to `'custom'` before re-rendering either empty-version or resolved-version local preset contexts.
- Updated `src/renderer/assets/js/presets.js` so version-context switches now clear four transient local-list states together before refresh: `window.newlyDownloadedFile`, `selectedLocalFiles`, `localSearchQuery`, and `localSortMode`.
- Tightened the same smoke suite again so version-context switches must also call `toggleMultiSelectMode(false)` before re-rendering the local list, preventing the batch-management shell from visually/behaviorally leaking into the next context.
- Updated `src/renderer/assets/js/presets.js` accordingly, so switching version context now fully exits batch mode before the next preset list render.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` with two more page-level aftermath guards: `renderDynamicParamsPage()` must rebuild `currentEditingFile.dataset.baseName` from the resolved display name before later dirty decoration, and `demoRestoreDefaults()` must stay on the shared saved-snapshot path (`pushParamSnapshotToHistory(..., { markSaved: true })`) before the page re-renders.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts`.

## Next TDD slice 79

- Keep prioritizing real cross-context stale-state problems in `presets.js`, especially any remaining context-menu or shell state that can visually survive a version/printer switch.
- If `presets.js` no longer yields clean wins, return to `params.js` only for a concrete visible stale-label / dirty-after-restore symptom.

## Planned TDD slice 80

- Re-scan `presets.js` for one last transient shell state or target snapshot that should reset on context change, but only take it if the symptom is clearly user-visible.

## Planned TDD slice 81

- Re-scan `params.js` for a true visible aftermath gap after save/restore, especially where page label, dirty indicator, or active-path refresh can lag the shared mutation signals.

## Planned TDD slice 82

- If no further clean behavior seam appears, take a maintenance pass on `continue.md` to prune duplicate historical planning fragments and leave a cleaner handoff checkpoint.

## Planned TDD slice 83

- Reassess whether the branch is now at a good stopping point for legacy-page TDD and whether the next best ROI has shifted toward the React/Vite migration baseline.

## 2026-03-18 TDD checkpoint 80

- Continued another 5-slice TDD burst and kept the work narrowly focused on cross-context stale UI state plus page-level aftermath contracts.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` so `renderDownloadVersions()` must now hide stale preset context-menu state before either local-list re-render branch, then updated `src/renderer/assets/js/presets.js` to call `hidePresetContextMenu({ immediate: true })` during version-context switches.
- Tightened the same smoke suite again so version-context switches must also clear `draggedCard` before the next local list render, then updated `src/renderer/assets/js/presets.js` accordingly to avoid drag/sort state leaking into the next context.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` with two more page-level contracts: the no-preset branch must rebuild the empty `currentEditingFile` label before `updateParamDirtyUI(null)`, and `saveAllDynamicParams()` must not rewrite that label directly, leaving visible file-name refresh to the shared render/dirty path.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts`.

## Next TDD slice 80

- `presets.js` now looks close to diminishing returns; only keep going there if one last clearly user-visible shell state still leaks across context changes.
- Otherwise shift back to `params.js` for a concrete save/restore aftermath symptom, or stop and treat the branch as a cleaner handoff checkpoint.

## Planned TDD slice 81

- Re-scan `params.js` for one last visible aftermath gap after save/restore, especially around active-path changes, label refresh, or dirty-indicator timing under real page visibility conditions.

## Planned TDD slice 82

- If no strong `params.js` seam emerges, take a maintenance pass on `continue.md` to prune older duplicated planning fragments and keep only the newest checkpoint ladder easy to follow.

## Planned TDD slice 83

- Reassess whether the next best ROI has shifted from legacy-page TDD to React/Vite migration scaffolding, given how much of the legacy stale-state surface is now guarded.

## Planned TDD slice 84

- If one final bug-shaped page-level seam appears, take it; otherwise stop at the cleaner checkpoint with green targeted suites and an explicit migration-ready recommendation.

## 2026-03-18 TDD checkpoint 81

- Reassessed `params.js` aftermath behavior and found one real implementation gap worth taking: `demoRestoreDefaults()` previously forced `await renderDynamicParamsPage()` even when the params page was hidden, doing unnecessary DOM work outside the visible page lifecycle.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` so restore-defaults now has to compute `isParamsVisible` once, gate both `applyParamSnapshotToDom(...)` and `await renderDynamicParamsPage()` behind that visibility check, and still keep success messaging anchored on the resolved `restoredFileName` contract.
- Updated `src/renderer/assets/js/params.js` so restore-defaults now only reapplies DOM snapshot state and re-renders the params page when `#page-params` is actually visible, while still updating cache/store state and emitting the shared mutation signals regardless.
- Tightened the same smoke suite with one adjacent guard that `saveAllDynamicParams()` still leaves visible file-label refresh to the shared render/dirty path rather than writing `currentEditingFile` directly.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/params-preset-view.test.ts tests/unit/renderer/entry/active-preset-view.test.ts`.

## Next TDD slice 81

- The remaining `params.js` wins now look small; only keep going if another clearly visible save/restore aftermath bug appears.
- Otherwise treat legacy-page TDD as near handoff-complete and spend the next slice on checkpoint cleanup or React/Vite migration staging.

## Planned TDD slice 82

- Do a light `continue.md` cleanup so the newest checkpoint ladder is easier to scan than the older duplicated planning fragments.

## Planned TDD slice 83

- Reassess whether the next best ROI has shifted from legacy-page TDD to React/Vite migration scaffolding and typed adapter/hook surfaces.

## Planned TDD slice 84

- If a final bug-shaped page-level seam still appears, take it; otherwise stop at the cleaner checkpoint and pivot the next cycle toward migration work.

## Planned TDD slice 85

- If migration becomes the next phase, start from a narrow scaffold step rather than reopening broad legacy-page churn.

## 2026-03-18 TDD checkpoint 82

- Moved from legacy-page TDD into the first real React-page migration slice instead of reopening more low-ROI DOM cleanup.
- Confirmed the renderer entry chain already mounts the download-page React root from `index.html`, so this slice focused on making that shell slightly more actionable rather than adding another parallel mount path.
- Added `src/renderer/react-app/hooks/usePresetActions.ts` as a typed adapter layer for the first download-page actions (`applyLocalPreset`, `duplicateLocalPreset`, `renameLocalPreset`, `deleteLocalPreset`), keeping React writes pointed at the existing legacy/runtime surfaces for now.
- Updated `src/renderer/react-app/pages/download/components/LocalPresetList.tsx` so unapplied local presets now render a real React-side “应用” button wired through `usePresetActions().applyLocalPreset(...)`, while applied presets keep the existing badge treatment.
- Expanded `src/renderer/react-app/types/window.d.ts` and tightened adjacent React hook types so `npm.cmd run typecheck` stays green while this new adapter layer is introduced.
- Added a first React component test shell in `tests/unit/renderer/react-app/local-preset-list.test.tsx`, but left it effectively dormant for now because the current workspace does not yet include `jsdom`; this is a known migration-test harness gap rather than a product-code blocker.
- Re-verified the migration baseline with `npm.cmd run typecheck` and `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.

## Next TDD slice 82

- Continue the React download-page migration, not legacy-page churn.
- Best next move: wire one more real React action (`duplicate` or `delete`) or add a small read/write adapter for online preset actions.

## Planned TDD slice 83

- Decide whether to install/enable a DOM-capable test environment (`jsdom`) for React component tests, or keep React verification temporarily at typecheck + entry/integration level while the shell is still thin.

## Planned TDD slice 84

- Extend `usePresetActions` or adjacent hooks so the React download page can drive one more true user flow beyond apply, ideally without duplicating legacy business logic.

## Planned TDD slice 85

- Reassess when the React download page is substantial enough to start hiding parts of the legacy download DOM instead of merely coexisting with it.

## Planned TDD slice 86

- Once React download actions cover the critical path, consider adding a dedicated migration spec/checkpoint and formally pivot the branch away from legacy-page TDD.

## 2026-03-18 TDD checkpoint 83

- Continued the React download-page migration with another small real action slice instead of reopening legacy-page TDD.
- Tightened `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` so the renderer source tree now explicitly records that the React download-page shell exposes both `applyLocalPreset` and `duplicateLocalPreset` action wiring through `LocalPresetList.tsx` / `usePresetActions.ts`.
- Updated `src/renderer/react-app/pages/download/components/LocalPresetList.tsx` so local preset cards now expose a second real React-side action button: `复制`, with a small pending state and `usePresetActions().duplicateLocalPreset(...)` wiring.
- Kept `npm.cmd run typecheck` green after the new React action flow and re-verified the migration baseline with `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- The React component test shell remains present but dormant because the workspace still lacks `jsdom`; this is still a harness concern, not a product-code regression.

## Next TDD slice 83

- Continue the React download-page path with one more true action flow, preferably `delete` or a thin online preset action, rather than adding more shell-only UI.

## Planned TDD slice 84

- Add the next typed action adapter and button flow (`delete` is likely the cleanest), keeping all writes delegated to existing legacy/runtime business logic for now.

## Planned TDD slice 85

- Reassess whether the React download page has enough real action coverage to start collapsing pieces of the legacy download DOM or hiding duplicated surfaces.

## Planned TDD slice 86

- Decide whether to enable a DOM-capable test harness (`jsdom`) once the React page has enough behavior to justify component-level tests.

## Planned TDD slice 87

- When the React download page can cover the critical local preset workflow, formalize the pivot away from legacy-page TDD and into migration-stage implementation work.

## 2026-03-18 TDD checkpoint 84

- Continued the React download-page migration with a third real local-preset action instead of adding more passive shell UI.
- Tightened `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` again so the source-tree integration guard now explicitly expects the React local preset list to expose `删除` alongside `应用` / `复制`, and still records that `usePresetActions.ts` owns the corresponding typed adapter entry points.
- Updated `src/renderer/react-app/pages/download/components/LocalPresetList.tsx` so local preset cards now expose a real React-side `删除` button with a minimal pending state wired through `usePresetActions().deleteLocalPreset(...)`.
- Kept `npm.cmd run typecheck` green and re-verified the current migration baseline with `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- At this point the React download-page shell now covers three true local preset actions (`apply`, `duplicate`, `delete`) through typed adapters while still delegating business logic to the existing legacy/runtime layer.

## Next TDD slice 84

- Keep momentum on the React download page and shift to either online preset actions (`check update` / `download`) or one more local action (`rename`) depending on which seam is cleaner.

## Planned TDD slice 85

- Add the first online-preset React action adapter if possible, so the page starts covering both local and online halves of the download workflow.

## Planned TDD slice 86

- Reassess whether to enable a DOM-capable test harness (`jsdom`) once the React shell has enough behavior to justify proper component-level tests.

## Planned TDD slice 87

- Once the React download page covers the critical local + online preset flow, decide whether parts of the legacy download DOM can start being hidden or retired.

## Planned TDD slice 88

- When the download page is sufficiently real, formalize the migration pivot and plan the next page (`params` or download-online completion) accordingly.

## 2026-03-18 TDD checkpoint 85

- Continued the React download-page migration into the online half instead of adding another local-only action.
- Tightened `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` so the source-tree integration guard now also expects `OnlinePresetList.tsx` to expose a `下载` action surface and `usePresetActions.ts` to provide a `downloadOnlinePreset` adapter entry point.
- Updated `src/renderer/react-app/hooks/usePresetActions.ts` with a first minimal online action adapter: `downloadOnlinePreset`, currently routed through `window.mkpAPI.copyBundledPreset(...)` as a low-risk bridge while the React page is still skeletal.
- Updated `src/renderer/react-app/pages/download/components/OnlinePresetList.tsx` so the React download page now exposes a first real online-side action button (`下载`) with a small pending state, rather than only explanatory placeholder text.
- Re-verified with `npm.cmd run typecheck` and `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- At this point the React download page now spans both halves of the workflow: local preset actions (`apply` / `duplicate` / `delete`) and a first online preset download path.

## Next TDD slice 85

- Continue the React download page on the online side, preferably by adding a thin `check update` / online list refresh adapter rather than stacking more placeholder cards.

## Planned TDD slice 86

- Decide whether to introduce a DOM-capable React test harness (`jsdom`) now that the page has enough real action surfaces to justify component-level tests.

## Planned TDD slice 87

- Reassess when the React download page is substantial enough to start hiding pieces of the legacy download DOM instead of merely coexisting.

## Planned TDD slice 88

- Once the download page can drive the critical local + online workflow, formalize the migration pivot and choose the next page or adapter surface accordingly.

## Planned TDD slice 89

- If the React download page stabilizes quickly, consider whether the next best ROI is online list hydration, params-page scaffolding, or test-harness enablement.

## 2026-03-18 TDD checkpoint 86

- Continued the React download-page migration with a first online refresh/write-adjacent slice instead of stopping at a single download button.
- Tightened `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` so the source-tree guard now also expects `OnlinePresetList.tsx` to expose a `检查更新` action surface and `usePresetActions.ts` to own a `refreshOnlinePresets` adapter entry point.
- Updated `src/renderer/react-app/hooks/usePresetActions.ts` with `refreshOnlinePresets()`, currently routed through the existing `window.checkOnlineUpdates()` bridge so React can trigger online refresh without duplicating legacy business logic.
- Updated `src/renderer/react-app/pages/download/components/OnlinePresetList.tsx` so the React online panel now exposes both `检查更新` and `下载` action surfaces, each with a minimal pending state.
- Re-verified with `npm.cmd run typecheck` and `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- The React download page now has meaningful action coverage on both local and online halves, even though the online list itself is still a placeholder shell.

## Next TDD slice 86

- The next highest-ROI choice is no longer another button; it is either enabling a DOM-capable React test harness (`jsdom`) or replacing the online placeholder card with real hydrated data.

## Planned TDD slice 87

- Decide whether to enable `jsdom` for React component tests now that the page has enough real behavior to justify it.

## Planned TDD slice 88

- If test harness enablement is deferred, start hydrating the React online preset list from a real read hook or adapter instead of the current single placeholder item.

## Planned TDD slice 89

- Reassess whether the download page is now substantial enough to begin hiding duplicated legacy surfaces or to plan the next page migration.

## Planned TDD slice 90

- Once the download page has both real actions and real data hydration, formalize the migration pivot and choose between completing download-page Reactization or starting `params` scaffolding.

## 2026-03-18 TDD checkpoint 87

- Continued the React download-page migration with the first true online data-hydration slice instead of adding more placeholder-only UI or button wiring.
- Added `src/renderer/react-app/hooks/useOnlinePresetList.ts`, which reads bundled/local preset manifest data through existing `mkpAPI` sources, filters it by the current React download context, and exposes a sorted online preset list for the selected printer/version.
- Updated `src/renderer/react-app/pages/download/components/OnlinePresetList.tsx` so the panel now renders a real list of online preset items (with latest badge + download CTA) rather than a single hard-coded demo card, while still keeping `检查更新` / `下载` action surfaces wired through the typed adapter layer.
- Expanded `src/renderer/react-app/types/window.d.ts` for the manifest read APIs used by the new hook and tightened `tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts` so the source-tree guard now records that `OnlinePresetList` depends on `useOnlinePresetList` and that the hook reads bundled preset manifest data.
- Re-verified with `npm.cmd run typecheck` and `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- This is the first point where the React online side stops being mostly illustrative and starts becoming a real data-driven GUI surface.

## Next TDD slice 87

- Reassess whether the next best ROI is enabling a DOM-capable React test harness (`jsdom`) or continuing to deepen the data/behavior realism of the React download page.

## Planned TDD slice 88

- If test harness enablement is still deferred, continue improving the React online list with more realistic state (empty/error/loading differentiation, latest semantics, or refresh aftermath).

## Planned TDD slice 89

- Re-evaluate whether the React download page is now substantial enough to begin hiding duplicated legacy download surfaces.

## Planned TDD slice 90

- Once the download page has credible local + online behavior, formalize the migration pivot and decide between finishing download-page Reactization or starting `params` scaffolding.

## Planned TDD slice 91

- If GUI momentum remains strongest on the download page, use the next slice to tighten user-visible polish and test strategy rather than reopening old legacy cleanup work.

## 2026-03-18 TDD checkpoint 88

- Continued the React download-page migration by tightening online list realism instead of adding more action buttons.
- The main win in this slice was that `OnlinePresetList` is now backed by `useOnlinePresetList()` and no longer depends on a single hard-coded demo card; it reads bundled/local preset manifest data, filters by the active printer/version context, and renders a real sorted list with latest badges and download CTA.
- This moves the download-page GUI closer to a genuinely usable mixed React/legacy state: local preset actions are real, and the online half is now meaningfully data-driven rather than illustrative.
- Re-verified the migration baseline with `npm.cmd run typecheck` and `npm.cmd test -- tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts`.
- During this stage, repeated BYOK calls surfaced an external `502 Bad Gateway` response from `aixj.vip` (Cloudflare edge healthy, host failing). This is treated as an external environment/service blocker, not a current repo-code regression.

## External Blocker Note

- BYOK requests are intermittently failing with upstream `502 Bad Gateway` HTML responses from `aixj.vip`.
- Current interpretation: browser/network path is up, but the remote host behind Cloudflare is unhealthy.
- Action for next sessions: do not spend local refactor time assuming this is a renderer-code bug unless evidence appears in app logs or reproducible local fallback paths fail too.

## Next TDD slice 88

- Highest ROI now is either: (A) enrich React online list state semantics (`empty/error/loading/latest` polish and refresh aftermath), or (B) enable `jsdom` so React component tests can start validating real DOM output.

## Planned TDD slice 89

- If test harness enablement is deferred, continue improving the React online list with clearer empty/error/loading behavior and post-refresh state handling.

## Planned TDD slice 90

- Reassess whether the download page is now substantial enough to begin hiding duplicated legacy download surfaces.

## Planned TDD slice 91

- Once the download page has stable local + online behavior, formalize the migration pivot and decide between finishing download-page Reactization or starting `params` scaffolding.

## Planned TDD slice 92

- If GUI progress remains centered on download, use the next slice to improve testability and user-visible polish rather than reopening low-ROI legacy cleanup.


## Next TDD slice 49

- Continue from the new `home.js` smoke baseline and look for a small real behavior gap where home-page selection/rendering still outruns the shared context contract.
- If no clean `home.js` slice appears, reassess whether another active legacy script now offers the better ROI.

## 2026-03-16 TDD checkpoint 50

- Continued hardening the new `home.js` baseline before touching behavior and added smoke coverage around `ensureValidHomeSelection()`.
- Updated `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that home selection revalidation keeps `selectedBrand/selectedPrinter/selectedVersion` consistent together before downstream rendering consumes that state.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.
- This gives the next `home.js` slice a safer contract boundary for changing actual selection/render behavior without regressing the existing cross-page sync assumptions.

## Next TDD slice 50

- Continue from the `home.js` baseline and pick the first real behavior gap, not just another baseline assertion, around selection correction or download-panel refresh behavior.
- If no clean `home.js` implementation slice appears, reassess whether another active legacy script now offers the better ROI.

## 2026-03-16 TDD checkpoint 51

- Took the first real `home.js` behavior slice after the new baseline: `selectBrand()` previously kept an invalid `selectedVersion` when the current printer still belonged to the chosen brand but no longer supported that version.
- Added another smoke assertion to `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that `selectBrand()` now revalidates `selectedVersion` against `currentPrinter.supportedVersions` before handing the printer to `window.renderDownloadVersions(...)`.
- Updated `src/renderer/assets/js/home.js` so `selectBrand()` now clears unsupported versions, refreshes the sidebar badge, and persists the corrected selection before the download panel is re-rendered.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 51

- Continue along `home.js` and look for the next smallest behavior gap around selection correction, sidebar state, or download-panel refresh ordering.
- If the next `home.js` win becomes too small, reassess whether another active legacy script offers better ROI.
