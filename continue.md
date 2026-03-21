## Continue

Updated: 2026-03-21

- Done: 5.8.5 old Python parity remains the main path; CLI now only accepts JSON presets.
- Done: Settings includes manual `TOML -> JSON` conversion into `MKP SupportE\\Presets\\ConvertedPresets`.
- Done: File selection guards now block oversized or fake-extension inputs for TOML/image flows.
- Done: Frontend hardening pass 1 finished: deduped `updates.js` and `home.js`, replaced silent catches in `app.js` and `index.html` with logs.
- Done: Tower placement preview now uses bottom-left origin, integer snapping, real footprint preview, and P1/X1 front-L dead-zone rules.
- Done: Params restore-defaults flow now uses a draft-vs-saved single source of truth in `params.js`, removing DOM readback drift from dirty-state calculation.
- Done: Restore/save dirty regression smoke coverage expanded for `currentFullSerialized`, canonical clean rerender baselines, and checkbox/gcode-mode snapshot capture.
- Done: Params runtime now has only one save implementation path; `legacySaveAllDynamicParams` has been physically removed from source.
- Done: Dead params-page helper chains were removed from source: history-preview focus helpers, dead gcode-history stepping helpers, and unused snapshot push helpers.
- Done: Params-page cleanup checklist is closed with smoke coverage locking the removals.
- Done: Main-process engine contract is aligned again: normalized `towerGeometry` objects are accepted by builder helpers, and stale geometry assertions were updated to the shared renderer/engine formula.
- Done: Quality gate is green again: `npm test` now passes with `83` files and `512` tests.
- Done: Smart diagnostics export now writes a compact three-file bundle into desktop `mkpse_log`, with `README_MKPSE_姹傚姪.txt`, `mkpse_gui.log`, `mkpse_cli.log`, plus a stable `MKPSE-*` issue fingerprint and QQ-group request copy.
- Done: Main-process logging is now scoped by runtime path: active logs write to `mkpse_gui_YYYY-MM-DD.log` / `mkpse_cli_YYYY-MM-DD.log`, while diagnostics export still falls back to legacy mixed `mkp_YYYY-MM-DD.log` when needed.
- Done: Settings-page diagnostics export now waits on `ipcRenderer.invoke('export-bug-report')`, shows modal feedback, and points users to the desktop `mkpse_log` folder.
- Done: Diagnostics export now has duplicate-trigger protection on both sides: renderer ignores re-entry while the export/modal is in flight, and main-process `export-bug-report` reuses one in-flight promise so repeated clicks cannot fan out into many folders or Explorer windows.
- Done: Diagnostics export now has a 60-second reuse window after a successful export. Re-clicking within 1 minute returns the last `mkpse_log` result instead of creating a new folder, and the renderer explicitly tells the user when the existing bundle was reused.
- Done: Reused diagnostics exports can now jump back to the existing folder explicitly: the reused-success modal changes its confirm action to `打开文件夹`, and main-process `open-last-support-bundle-folder` reveals the cached bundle instead of silently doing nothing.
- Done: `mkpse_cli.log` export is now issue-aware instead of fixed-length only: it keeps only the latest CLI session, stays concise on normal completed runs, automatically expands retention when the latest session contains `kind=error` / `status=failed` / warning signals, and writes retention metadata like `retained lines: 89/89` into the exported log header.
- Verify: `npm.cmd test -- tests/unit/main/main-process-diagnostics.test.ts` passed.
- Verify: `npm.cmd test -- tests/unit/renderer/entry/settings-runtime-smoke.test.ts` passed.
- Verify: `npm.cmd test -- tests/unit/renderer/entry/app-runtime-smoke.test.ts` passed.
- Verify: `npm.cmd run typecheck` passed.
- Verify: `npm.cmd test` passed with `83` files and `512` tests.
- Current: The current鏁存敼娓呭崟 is closed. Future work can move to optional structural refactors or new features rather than cleanup debt from this round.

### Recent

- Done: React runtime white-screen root cause was traced to `BrowserUserConfigStorage` reading the same `SYNC_KEYS.userConfig` key that cross-window sync later overwrote with message envelopes.
- Done: Modern user-config persistence is now isolated behind `mkp:state:user-config`, while startup read logic can still migrate old sync-envelope payloads and legacy `mkp_user_config` records without crashing.
- Done: Startup now hard-recovers from corrupt or fake user-config payloads by ignoring invalid objects, rebuilding a safe default config, and persisting the repaired state instead of throwing during `mountModernRuntime()`.
- Verify: `npx vitest run tests/unit/renderer/services/user-config-service.test.ts tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts --reporter=verbose` passed with the new sync-envelope / corrupt-config recovery coverage.
- Verify: `npm.cmd run build:renderer-bundles` passed after the user-config recovery changes.
- Verify: `npm.cmd run build` passed and produced `dist/MKP SupportE Setup 0.2.10.exe`.
- Done: Postprocess progress UI now has a redesign note in `docs/POSTPROCESS_REPORT_UI_REDESIGN_PLAN.md`, with the target narrowed to a simpler installer/tool-window style.
- Done: Postprocess report routing was split into `legacy` and `classic-v2`; the old UI was frozen into dedicated baseline files so experiments no longer overwrite it.
- Done: Detached CLI report launching now forwards a `--postprocess-report-ui` variant flag, and the report window resolves bootstrap/renderer/layout through a shared variant router.
- Done: A first `classic-v2` prototype now exists with a minimal boot screen and a simpler first-screen progress layout, while details stay behind expand.
- Done: Default postprocess report routing now prefers `classic-v2`, with `legacy` still available as an explicit rollback path.
- Done: Download-page React now uses a formal browser-safe bundle path: `vite.react-pages.config.ts` builds `assets/js/generated/react-pages.bundle.js`, `index.html` loads the compiled bundle instead of importing raw `tsx`, and the page only switches to React after a successful first commit.
- Done: Download-page runtime now has a no-white-screen fallback path: the legacy shell is still attached as a visible safety net, React mounts into `#react-download-page-root`, and the bundle entry flips visibility only after `ReadySignal`; render errors fall back through `DownloadPageErrorBoundary`.
- Done: The download-page bundle/fallback protocol is now a shared React page foundation in `src/renderer/react-app/runtime/react-page-runtime.tsx`, with `createReactPageMount`, `ReadySignal`, `LegacyShellBridge`, and a bundle-level `mountRegisteredReactPages(document)` registry.
- Done: `calibrate / params / setting` are now migrated onto the shared React page foundation in safe legacy-hosted mode: each page has a hidden React root plus a visible legacy shell, and React only takes over after the shell has been adopted into the root.
- Done: Source-mode updater bootstrap was hardened in `src/main/main.js`: `electron-updater` is now lazy-required through `getAutoUpdater()`, and background update checks are skipped outside packaged GUI runtime via `checkForUpdatesInBackground()`.
- Done: `tsconfig.json` now includes renderer `tsx` and `d.ts` sources, so React page regressions are checked by `tsc` instead of slipping past because only `*.ts` was included before.
- Verify: `npm run build:react-pages` passed.
- Verify: `npx tsc -p tsconfig.json --noEmit` passed.
- Verify: `npx vitest run tests/unit/renderer/react-app/local-preset-list.test.tsx tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/index-runtime-smoke.test.ts --reporter=verbose` passed.
- Verify: `npx vitest run tests/unit/main/main-source-smoke.test.ts tests/unit/renderer/entry/renderer-entry-integration-smoke.test.ts tests/unit/renderer/entry/index-runtime-smoke.test.ts --reporter=verbose` passed.
- Verify: `npm run pack` passed and `electron-builder` included the generated React bundle in `dist/win-unpacked`.
- Verify: `node --check src/main/main.js` passed.
- Note: Shell-level `npm start` verification is still environment-limited in this sandbox because `require('electron')` resolves to the package stub path instead of live Electron main-process APIs here, so static/runtime smoke checks were used to validate the source-mode bootstrap changes.
- Verify: `node --check src/main/postprocess_report_runtime.js` passed.
- Verify: `node --check src/renderer/assets/js/postprocess-report-v2.js` passed.
- Verify: `npx vitest run tests/unit/main/postprocess-report-window-smoke.test.ts` passed.
