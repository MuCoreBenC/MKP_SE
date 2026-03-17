## Continue

更新时间: 2026-03-16

## 当前进度判断

- **阶段**：仍处于 `renderer legacy page -> modern runtime/store/service` 的桥接收口阶段，尚未进入大规模替换 DOM/controller 的阶段。
- **整体完成度（主观）**：renderer 侧桥接基础约 `70%~75%`，其中“只读状态接入”明显领先，“写路径统一/页面生命周期闭环”次之，“更真实集成 smoke”还偏少。
- **当前工作重心**：不是再造新能力，而是把 legacy 页面里“已存在 modern helper/view 的地方”逐段收口到 single source of truth。

## 已完成的关键里程碑

- 已落地 modern renderer 基础骨架：`src/renderer/app/**` 与 `src/renderer/app/entry/renderer-runtime.ts` 已接入，`src/renderer/index.html` 已走最小真实入口链路。
- 已打通 legacy 与 modern context 双向同步：`saveUserConfig -> __syncLegacyContextToModern__`、`loadUserConfig -> __hydrateModernContextFromLegacy__`。
- 已暴露并稳定一批 runtime 只读 helper/view：
  - `__getDownloadContextView__`
  - `__getActivePresetView__`
  - `__getParamsPresetView__`
  - `__getCalibrationContextView__`
  - `__getAppUpdateStateView__`
  - `__getCachedUpdateManifestView__`
  - `__getUpdateModeView__`
  - `__setUpdateModeForLegacy__`
  - `resolveActivePresetFileName`
  - `resolveDownloadAppliedState`
  - `resolveParamsPresetPath`
  - `resolveParamsDisplayFileName`
- `updates.js` 已完成一轮较深的 modern-first 收口：
  - manifest 解析 / update check 优先走 modern bridge
  - update state / cached manifest / update mode 优先走 modern runtime view
  - final active 路径里对 `modernState.latestVersion` 的字段级门禁已基本清完
- `params.js` 已完成一轮中等深度收口：
  - current preset path / file label / empty state / save / restore defaults 基本已走 shared helper
  - `loadActivePreset()` 已优先复用共享 cache helper
- `presets.js` 已完成一轮中等深度收口：
  - active file / applied state / current page context 基本收敛到 shared helper
  - context-menu / mutation 成功后的多条 re-render 路径已开始优先走 shared current context
- `app.js` 已完成一轮补漏式收口：下载、同步、删除等局部路径已优先走 `__getDownloadContextView__()`。
- `home.js` 刚建立 smoke baseline，下一阶段准备从真实行为缺口切入。

## 测试基线

- `tests/unit/renderer/entry` 已覆盖 `home / presets / params / updates / runtime bridge / context sync` 的主干 smoke 与契约测试。
- 当前目录下已有 `home-runtime-smoke.test.ts`、`presets-runtime-context-smoke.test.ts`、`presets-runtime-applied-state-smoke.test.ts`、`presets-runtime-version-refresh-smoke.test.ts`、`params-runtime-smoke.test.ts`、`updates-runtime-smoke.test.ts`。
- 当前可确认：`npm.cmd run typecheck` 通过，近期所有定向 TDD 切片测试均通过。

## 最近高价值进展（精简）

- `updates.js`：把 modern update-state 视为完整 snapshot，而不是只在 `latestVersion` 存在时才信任。
- `params.js`：继续压实 shared path / display / cache helper 语义，减少 inline fallback 分叉。
- `presets.js`：持续清理 context-menu 与 mutation 路径里的 stale payload 透传。
- `home.js`：补上 `ensureValidHomeSelection()` 与 `selectPrinter()` 的 smoke baseline，为后续真实行为改动做护栏。

## 还没完成、但最值得做的事

1. **home.js 真实行为缺口**
   - 从 `selectPrinter()` / `ensureValidHomeSelection()` 出发，找“home 选中状态修正后，下载区/版本区/侧边栏刷新顺序”里的最小问题。
   - 这是当前最值得切的新战场。

2. **presets.js 剩余尾巴**
   - 继续清理 context-menu action / helper 调用里还在下传 stale payload 的点。
   - 但 ROI 已开始下降，只有在发现真实行为偏差时才继续切。

3. **params.js 页面闭环**
   - 如果要回到 `params.js`，优先找真实行为问题（刷新、恢复、dirty state），不要只做契约已满足的收紧。

4. **更真实的入口集成 smoke**
   - 逐步从单函数 smoke 走向 `index.html -> init-modern-runtime -> legacy scripts` 的更接近真实链路。

## 不建议现在做的事

- 不建议立刻大改 `main` 进程分层。
- 不建议现在大面积重写 legacy 页面 DOM 逻辑。
- 不建议继续无差别拉长 `continue.md` checkpoint 流水账。

## 下一阶段建议计划（精简）

1. 以 `home.js` 为下一主线，先找一个真实行为缺口并做最小 TDD 修复。
2. 若 `home.js` 暂时没有干净切口，再回到 `presets.js` 处理最后几处 stale payload 透传。
3. 在再做 3~5 个小切片后，补一轮更真实的 entry integration smoke，而不是继续只堆单函数 smoke。
4. 等 renderer 主路径更稳后，再进入 controller/DOM 生命周期闭环与 main/IPC 边界整理。

## 文档

- `docs/SOFTWARE_MASTER_PLAN_2026-03.md`
- `docs/PRD_FROM_SCRATCH.md`
- `docs/ARCHITECTURE_FROM_SCRATCH.md`
- `docs/DATA_MODEL_FROM_SCRATCH.md`
- `docs/STATE_SYNC_SPEC.md`
- `docs/TEST_PLAN_FROM_SCRATCH.md`
- `docs/RELEASE_PROCESS_FROM_SCRATCH.md`
- `docs/MODULE_REFACTOR_PLAN.md`
- `docs/ROADMAP_EXECUTION_PLAN.md`
- `docs/MILESTONE_BREAKDOWN.md`
- `docs/IMPLEMENTATION_BACKLOG.md`
- `docs/RISK_REGISTER.md`
- Updated that remaining duplicated active-path block in `src/renderer/assets/js/updates.js` to use `if (modernState)` so badge hydration semantics stay consistent across the repeated historical definitions.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/updates-runtime-smoke.test.ts tests/unit/renderer/entry/update-state-view.test.ts tests/unit/renderer/entry/update-mode-view.test.ts tests/unit/renderer/entry/update-bridge-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 39

- The obvious small `updates.js` field-gate cleanup now looks largely exhausted; reassess whether the next best ROI has shifted to `params.js` or another active legacy script.
- If `updates.js` gets another slice, prefer a real behavior gap over more duplicate-block cleanup.

## 2026-03-16 TDD checkpoint 40

- Shifted the next high-ROI TDD slice back to `params.js` after `updates.js` field-gate cleanup was largely exhausted.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to lock that the active `renderDynamicParamsPage()` path now relies on the shared `resolveParamsDisplayFileName(window, presetPath)` contract without reintroducing a separate `modernPresetView?.fileName` fallback in the non-helper branch.
- Updated `src/renderer/assets/js/params.js` so `renderDynamicParamsPage()` now falls back from `resolveParamsDisplayFileName(...)` directly to `presetPath.split('\\').pop()`, keeping display-name semantics collapsed onto one shared modern-first helper.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-empty-state.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 40

- Continue scanning `params.js` for remaining places where display-name or path semantics still mix direct inline fallback logic with an existing shared runtime helper.
- If no similarly small `params.js` slice remains, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 41

- Continued the `params.js` modern-first cleanup pass and found `loadActivePreset()` still wrote directly to `window.presetCache` instead of reusing the shared cache helper surface.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to lock that `loadActivePreset()` now prefers `window.updatePresetCacheSnapshot(path, result.data)` and only falls back to direct `window.presetCache = ...` assignment when the helper is unavailable.
- Updated `src/renderer/assets/js/params.js` so the active `loadActivePreset()` path now routes cache writes through `updatePresetCacheSnapshot` first, keeping the old direct cache assignment only as fallback.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-empty-state.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 41

- Continue scanning `params.js` for remaining places where preset path/display/cache semantics still bypass an existing shared runtime/helper contract.
- If the next `params.js` win becomes too marginal, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 42

- Continued the `params.js` pass with a smaller contract-locking slice rather than forcing another low-value implementation change.
- Tightened `tests/unit/renderer/entry/params-runtime-smoke.test.ts` to keep `demoRestoreDefaults()` anchored on the shared `presetPath` semantics through cache update, mutation broadcast, and subsequent `renderDynamicParamsPage()` refresh.
- Re-verified the active params-page baseline with `npm.cmd test -- tests/unit/renderer/entry/params-runtime-smoke.test.ts tests/unit/renderer/entry/params-preset-path.test.ts tests/unit/renderer/entry/params-file-label.test.ts tests/unit/renderer/entry/params-empty-state.test.ts` and `npm.cmd run typecheck`.
- This keeps the next params-page refactor honest without adding speculative code churn where the active implementation already matched the intended helper contract.

## Next TDD slice 42

- Reassess whether `params.js` still has a genuinely worthwhile implementation gap, not just another contract already satisfied by the live code.
- If not, shift the next TDD slice to the next highest-value active legacy script with a real modern-first behavior gap.

## 2026-03-16 TDD checkpoint 43

- Reassessed ROI across active legacy scripts and shifted the next worthwhile slice to `presets.js`, where `handleApplyLocal()` still defaulted `versionType` directly from the legacy global at the function signature.
- Tightened the new split smoke coverage in `tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts` and `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to keep `handleApplyLocal()` anchored on shared current-context resolution before falling back to legacy globals, while still reusing `resolveActivePresetFileName(...)` for reapply detection.
- Updated `src/renderer/assets/js/presets.js` so `handleApplyLocal()` now defaults `versionType` to `null` and derives `resolvedVersionType` inside the function from shared current context first, keeping legacy global fallback only as the last resort.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 43

- Continue scanning `presets.js` for remaining function defaults or immediate lookups that still bypass shared current context/helper contracts.
- If the next `presets.js` win becomes too small, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 44

- Continued the `presets.js` modern-first cleanup pass and found `handleDuplicateLocal()` still re-rendered through a direct `getPrinterObj(printerId)` lookup and raw `versionType` argument.
- Added another smoke assertion to `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to lock that the duplicate-success path now prefers `getCurrentPresetContext()` for both `printerData` and `resolvedVersionType` before falling back to explicit args.
- Updated `src/renderer/assets/js/presets.js` so `handleDuplicateLocal()` now resolves `printerData` and `resolvedVersionType` from shared current context first, then re-renders the local list with that context-aware pair.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 44

- Continue scanning `presets.js` for remaining immediate re-render or mutation paths that still bypass shared current context/helper contracts.
- If the next `presets.js` win becomes too small, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 45

- Continued the `presets.js` modern-first cleanup pass and found `togglePinnedPreset()` still re-rendered the list using only the context-menu snapshot instead of preferring the shared current preset context.
- Added another smoke assertion to `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to lock that the pin/unpin re-render path now derives `resolvedPrinterData` and `resolvedVersionType` from `getCurrentPresetContext()` before falling back to the context-menu payload.
- Updated `src/renderer/assets/js/presets.js` so `togglePinnedPreset()` now re-renders with shared current context first, while still preserving the original `printerData/versionType` for persistence keys.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 45

- Continue scanning `presets.js` for the last small mutation/re-render paths that still prefer stale local payloads over shared current context/helper contracts.
- If the next `presets.js` win becomes too marginal, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 46

- Continued the `presets.js` modern-first cleanup pass and found `handleRenameLocal()` still re-rendered directly from `target.printerData/target.versionType` after a successful rename.
- Added another smoke assertion to `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to lock that the rename-success re-render path now prefers `getCurrentPresetContext()` for `resolvedPrinterData` and `resolvedVersionType` before falling back to the context-menu target.
- Updated `src/renderer/assets/js/presets.js` so `handleRenameLocal()` now resolves shared current context first and re-renders with that context-aware pair after rename succeeds.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 46

- Continue scanning `presets.js` for the remaining stale-payload re-render paths; the obvious next check is whether any context-menu action still bypasses `getCurrentPresetContext()` after mutation success.
- If the next `presets.js` win becomes too marginal, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 47

- Continued the `presets.js` context-menu cleanup pass and found `ctxBtnApply` still passed `target.versionType` directly even though `handleApplyLocal()` now resolves shared current context on its own.
- Added another smoke assertion to `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to lock that the `ctxBtnApply` branch now passes `null` for the version argument and lets `handleApplyLocal()` derive `resolvedVersionType` internally.
- Updated `src/renderer/assets/js/presets.js` so the context-menu apply action no longer forwards stale `target.versionType`, reducing one more direct stale-payload hop in the local preset mutation flow.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## Next TDD slice 47

- Continue scanning `presets.js` for remaining context-menu or mutation branches that still pass stale payload fields a shared helper can now resolve internally.
- If the next `presets.js` win becomes too marginal, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 48

- Continued the `presets.js` context-menu cleanup pass and found `ctxBtnDelete` still forwarded `target.versionType` even though `handleDeleteLocal()` already resolves shared current context internally.
- Added another smoke assertion to `tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts` to lock that the `ctxBtnDelete` branch now passes `null` for the version argument and lets `handleDeleteLocal()` derive the active version through shared current context.
- Updated `src/renderer/assets/js/presets.js` so the context-menu delete action no longer forwards stale `target.versionType`, removing another direct stale-payload hop from the local preset mutation path.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/active-file-resolution.test.ts tests/unit/renderer/entry/active-preset-file-name.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-view.test.ts` and `npm.cmd run typecheck`.

## 2026-03-16 TDD checkpoint 52

- Continued the `presets.js` TDD pass after splitting the oversized smoke file into themed suites, keeping coverage focused instead of growing another catch-all file.
- Tightened `tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts` to lock two more contracts in the active `renderDownloadVersions()` implementation: version-card selection still updates `updateSidebarVersionBadge(versionType)` before clearing online UI, and the empty-version branch still disables the download CTA while showing its hint.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/presets-runtime-version-refresh-smoke.test.ts tests/unit/renderer/entry/presets-runtime-context-smoke.test.ts tests/unit/renderer/entry/presets-runtime-applied-state-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/download-applied-state.test.ts tests/unit/renderer/entry/download-context-resolver.test.ts`.
- Updated the test inventory to reflect that `presets-runtime-smoke.test.ts` has been replaced by the split context/applied-state/version-refresh suites.

## Next TDD slice 52

- Continue from the split `presets.js` smoke suites and look for the next smallest real behavior gap, preferably in `home.js` or another active legacy page rather than adding low-signal duplicate source-string assertions.
- Keep `continue.md` synchronized with the split smoke suite names so future checkpoints do not point back at the removed monolithic test file.

## 2026-03-17 TDD checkpoint 53

- Shifted the next small real behavior slice to `home.js` and tightened the `selectBrand()` fallback path instead of adding another low-value `presets.js` source-string assertion.
- Updated `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that the fallback-printer branch in `selectBrand()` now makes the delegation explicit: it marks `delegatedToFallbackPrinter`, hands control to `selectPrinter(fallbackPrinter.id, true)`, and exits before the rest of `selectBrand()` can run.
- Updated `src/renderer/assets/js/home.js` so `selectBrand()` now uses an explicit `delegatedToFallbackPrinter` guard before the later `saveUserConfig()` / `renderBrands()` / `renderPrinters()` / `renderDownloadVersions()` path, making the fallback handoff structurally obvious and less fragile.
- Verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.

## Next TDD slice 53

- Continue along `home.js` and look for the next smallest real behavior gap around fallback selection, sidebar state, or downstream panel refresh ordering.
- Prefer another implementation gap over adding more smoke assertions that only restate already-stable source structure.

## 2026-03-17 TDD checkpoint 54

- Continued along `home.js` after the fallback handoff cleanup and spent this slice on tightening the active ordering contracts instead of forcing another speculative implementation change.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that the non-fallback `selectBrand()` path still persists and repaints home surfaces before resolving `currentPrinter` and rendering the download panel.
- Added another adjacent guard in `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to keep `selectPrinter()` on the same ordering contract: sidebar brand/model state and `updateSidebarVersionBadge(selectedVersion)` must update before `saveUserConfig()` and the later `window.renderDownloadVersions(selectedPrinterObj)` call.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.
- This slice did not require another `home.js` implementation change because the live code already matched the intended modern-first ordering contract once the previous fallback delegation refactor landed.

## Next TDD slice 54

- Continue along `home.js` and look for the next small behavior gap where implementation still diverges, not just another ordering contract already satisfied by the active code.
- Good candidates remain around fallback selection with empty brands, compact-gallery navigation, or stale sidebar/download refresh interactions after catalog mutation success.

## 2026-03-17 TDD checkpoint 55

- Continued along the `home.js` fallback-selection path and found a real behavior gap: when `selectBrand()` lands on a brand that has no selectable printer, it repainted the home surfaces but did not explicitly clear the downstream download panel.
- Tightened `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that the empty-brand branch now keeps the shared `saveUserConfig()` / `renderBrands()` / `renderPrinters(selectedBrand)` sequence, then explicitly calls `window.renderDownloadVersions(null)` before the common calibration refresh.
- Updated `src/renderer/assets/js/home.js` so `selectBrand()` now mirrors other empty-selection flows and clears downstream download surfaces when `currentPrinter` is absent after brand selection.
- Added two adjacent guard assertions in `tests/unit/renderer/entry/home-runtime-smoke.test.ts` so the empty-brand path stays explicit about repainting the selected brand before clearing downloads, and about keeping `refreshCalibrationAvailability()` after either download-render branch.
- Re-verified with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts`.

## Next TDD slice 55

- Continue along `home.js` and look for the next smallest real behavior gap, with compact-gallery navigation and catalog-mutation aftermath still looking like the best remaining ROI.
- Prefer slices that close an actual branch asymmetry like this one, rather than only restating already-green ordering contracts.

## 2026-03-17 TDD checkpoint 56

- Continued into the `home.js` compact-gallery path and found another real gap in the final active implementation: the last `renderPrinters()` definition no longer scheduled `scrollHomeGalleryToSelected('auto')`, so compact mode could lose automatic selected-card alignment after a repaint.
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

## Next TDD slice 48

- Continue scanning `presets.js` for any remaining context-menu or helper calls that still pass stale payload fields a downstream shared-context resolver already owns.
- If the next `presets.js` win becomes too marginal, reassess the next highest-value active legacy script.

## 2026-03-16 TDD checkpoint 49

- Reassessed ROI after the latest `presets.js` cleanup and started a fresh smoke baseline for `home.js`, where the next worthwhile behavior gaps are more likely to live.
- Added `tests/unit/renderer/entry/home-runtime-smoke.test.ts` to lock that `selectPrinter()` stays on the legacy-to-modern sync path by calling `saveUserConfig()` before handing the selected printer object to `window.renderDownloadVersions(...)`.
- Verified the new cross-page baseline with `npm.cmd test -- tests/unit/renderer/entry/home-runtime-smoke.test.ts tests/unit/renderer/entry/download-context-view.test.ts tests/unit/renderer/entry/legacy-context-sync.test.ts` and `npm.cmd run typecheck`.
- This gives the next TDD slices a safe place to tighten `home.js` behavior without losing the already established `download-context` / legacy-context-sync contract.

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
