# MKP Engine Migration Plan

## Scope
- Migrate the post-processing engine and the 4 calibration G-code generation modes out of [`main585.py`](d:/trae/MKP_SE/main585.py) into the Electron/Node runtime.
- Keep JSON as the primary config format.
- Keep TOML as a compatibility input/output format during migration.
- Treat the old Tk GUI as semantic reference only, not as an implementation unit to port line by line.

## Locked Decisions
- Migration scope is "post-processing + calibration", not a full Tk GUI rewrite.
- `EngineConfig` is the shared contract for CLI, main process, renderer, and future React pages.
- JSON is the canonical storage/editing format. TOML remains a compatible edge format.
- Template-driven internals such as `wipingGcode` and `towerBaseLayerGcode` remain editable as advanced settings, not hidden forever.
- A support surface is considered valid for glueing only when the slicer already exposes a target path:
  - Bambu: `; FEATURE: Support interface`
  - Orca: support-surface `; FEATURE: Ironing`
- Do not infer glueing targets from upper-layer print paths.

## Target Engine Shape
- `presetMeta`
- `toolhead`
- `wiping`
- `templates`
- `machine`
- `postProcessing`
- `calibration`

## Advanced Config Notes
- `postProcessing.ironingPathOffsetMm`
  - Default: `0`
  - Positive values expand the ironing-derived glue path.
  - Negative values shrink the ironing-derived glue path.
  - Any expansion must be clipped back to the support-surface boundary and must never exceed the valid support region.
  - Migration rollout should treat this as an advanced or experimental option. A shrink-only implementation is acceptable before full boundary clipping lands.

## Completed
- CLI dual-entry flow exists in [`src/main/main.js`](d:/trae/MKP_SE/src/main/main.js) with `--Json` / `--Toml` plus `--Gcode`.
- Config normalization already exists in [`src/main/mkp_engine.js`](d:/trae/MKP_SE/src/main/mkp_engine.js).
- Seed helpers already exist for:
  - XYZE offset processing
  - support extrusion multiplier
  - thick-bridge handling
  - AUTO fan replay
  - nozzle cooldown and dry time recovery
  - wiping-tower base template expansion
  - pseudo-random wipe sequence
- Main-process tests already cover the current seed behavior in [`tests/unit/main/mkp-engine.test.ts`](d:/trae/MKP_SE/tests/unit/main/mkp-engine.test.ts).
- First migration slice completed on 2026-03-18:
  - ported Python `delete_wipe()` behavior as `deleteWipe()`
  - ported `check_validity_interface_set()` behavior as `hasValidInterfaceSet()`
  - integrated interface cleanup into `processGcodeContent()`
  - started replay support for `;ZJUMP_START`
  - skipped mount/unmount injection for invalid interface segments
- Second migration slice completed on 2026-03-18:
  - normalized advanced config seed `postProcessing.ironingPathOffsetMm`
  - gated Orca ironing reuse behind support-surface detection rules
  - distinguished support-surface ironing from top-surface ironing in the JS scan stage
  - cancelled excessive Orca ironing segments and emitted `Skip Ironing` recovery moves
  - added TDD coverage for the new Orca scan/recovery behavior
- Third migration slice completed on 2026-03-18:
  - added structured post-processing trace output from the JS engine
  - added technical trace export formatting for the detached report viewer
  - added a detached post-processing report window with auto-close, detail toggle, human/code views, and export actions

## Next
1. Split the engine more clearly into `config`, `helpers`, `scan`, `replay`, `calibration`, and `cli facade` responsibilities.
2. Port the remaining scan-stage parity items from Python:
   - Bambu support-interface extraction details
   - richer Orca support-surface ironing parity beyond the current seed rules
   - configurable ironing-path offset with boundary clipping
   - machine/slicer detection and bounds semantics
3. Deepen replay parity:
   - tower follow-up layer generation
   - silicone wipe / ooze cleanup branches
   - pressure rebuild and stabilization waits
   - richer step-level diagnostics for replay branches inside the new report viewer
4. Start calibration parity:
   - `Precise`
   - `Rough`
   - `ZOffset`
   - `Repetition`
5. Expose stable main-process APIs for renderer/GUI consumption once the config contract is less fluid.

## Current Repair Slice: Python Two-Stage Tower Recovery
- Goal: stop treating wiping-tower recovery as a single inline block and match the Python two-pass state machine.
- Why: the current JS output can still leave unwanted extrusion on the way to the tower and can rebuild only part of the tower shell because it resumes too early.
- TDD rule: tests define the 5-step recovery order first, then `mkp_engine.js` is allowed to change.

### 5-step repair sequence
1. Scan and clean a valid support-interface or support-surface segment.
   - Reuse `deleteWipe()` / `hasValidInterfaceSet()` parity.
   - Replay the glue path with `E` stripped in normal mode.
2. Finish the first-pass glue block without printing the tower shell.
   - Keep mount, cooldown, glue replay, unmount, and `;Prepare for next tower`.
   - Keep the dry-wipe preparation travel after the marker.
   - Do not emit `; FEATURE: Inner wall`, `;Leaving Wiping Tower`, or `resume print height` in tower mode.
3. Arm a pending tower recovery state when `;Prepare for next tower` appears.
   - This is a state transition only.
   - Repeated markers before the next layer-progress update should still collapse into one pending recovery.
4. Inject the follow-up tower shell only when `; update layer progress` is reached.
   - Use the latest parsed `; Z_HEIGHT:` and `; LAYER_HEIGHT:` values.
   - Emit the full Python-like tower shell before the raw `; update layer progress` line.
5. Hand control back to the slicer-native recovery path unchanged.
   - After `;Leaving Wiping Tower`, keep the original travel, Z restore, and prime moves.
   - Do not invent a separate JS-side `resume print height` branch for tower mode.

### TDD checkpoints for this slice
- First-pass glue recovery stops at `;Prepare for next tower` plus dry-wipe travel.
- Delayed tower injection fires before `; update layer progress`.
- The full default tower shell still prints in slow-line mode.
- Tower-mode unmount filtering still delays refill until after dry-wipe travel.
- Original slicer recovery travel and prime remain after leaving the tower.

## Current Delivery Goal
- Finish the normal `Support interface` branch first.
- Keep Orca ironing-path expansion out of this repair slice until the base support-interface path is stable.
- Treat "no `XY+E` extrusion on the trip to the wiping tower" as a release-blocking rule.

## End-to-End Flow To Implement And Verify
1. Normalize preset input into `EngineConfig`.
2. Parse runtime state from raw G-code:
   - `Z_HEIGHT`
   - `LAYER_HEIGHT`
   - `travel_speed`
   - `retraction_length`
   - `nozzle_temperature`
   - fan speed
3. Detect only slicer-declared normal support targets for this slice:
   - Bambu `; FEATURE: Support interface`
4. Close each candidate segment with Python-compatible boundaries:
   - next `; FEATURE:`
   - `; CHANGE_LAYER`
   - `;LAYER_CHANGE`
   - `; layer num/total_layer_count`
5. Clean and validate the segment:
   - `deleteWipe()`
   - `;ZJUMP_START`
   - `hasValidInterfaceSet()`
6. Queue the cleaned segment instead of injecting immediately.
7. Emit the first-pass glue block only when `; layer num/total_layer_count` is reached:
   - mount
   - cooldown if enabled
   - replay the support-interface path with `E` stripped
   - unmount
   - `;Prepare for next tower`
   - dry-wipe travel
   - no inline tower shell
8. In second-pass recovery, arm a pending tower state when `;Prepare for next tower` appears.
9. Inject the tower shell only when `; update layer progress` is reached.
10. Preserve slicer-native travel, Z restore, and prime after tower leave.
11. Write processed G-code and structured report output.

## TDD Matrix
### Unit TDD
- Config normalization:
  - JSON/TOML parity
  - legacy wiping-tower toggle compatibility
  - legacy template upgrade
- Scan-stage behavior:
  - `Support interface` detection
  - multi-block aggregation within one layer
  - invalid segment rejection
  - `deleteWipe()` cleanup and `;ZJUMP_START`
- Replay-stage behavior:
  - glue replay strips `E`
  - z-jump travel between sub-segments
  - AUTO fan replay
  - cooldown and dry-time recovery
- Tower recovery behavior:
  - first pass stops at `;Prepare for next tower`
  - no `resume print height` in tower mode
  - delayed tower shell before `; update layer progress`
  - slow-line vs fast-line speed selection
  - no `XY+E` extrusion between tower-prepare marker and glue-block end

### Integration TDD
- CLI parsing:
  - `--Json`
  - `--Toml`
  - missing args fail clearly
- Structured report generation:
  - engine revision
  - config snapshot
  - replay/decision steps
- Output hygiene:
  - stale processed artifacts removed before a new run
  - exported file is from the current run, not an old leftover

### Real-Sample Regression TDD
- Use the real AppData preset.
- Run at least 2 user G-code samples through the source engine.
- For each sample verify:
  - support-interface injection exists
  - `;Prepare for next tower` exists when tower mode is active
  - no `XY+E` extrusion exists between `;Prepare for next tower` and `; ===== MKP Support Electron Glueing End =====`
  - tower shell appears before `; update layer progress`
  - slicer recovery travel still exists after tower leave

## Test Rounds
### Round 1: Fast TDD Loop
- Command:
  - `npx vitest run tests/unit/main/mkp-engine.test.ts tests/unit/main/postprocess-report-runtime.test.ts tests/unit/main/main-process-diagnostics.test.ts`
- Goal:
  - lock Python parity for support-interface timing and tower recovery order
- Exit criteria:
  - all tests green

### Round 2: Source-Level Real Sample Verification
- Inputs:
  - real AppData preset
  - `.227388.15.gcode`
  - `.227388.16.gcode`
- Goal:
  - prove the source engine handles real user data, not only synthetic samples
- Exit criteria:
  - no `XY+E` extrusion on the tower-prep travel segment
  - tower recovery markers appear in the correct order

### Round 3: Packaged App Smoke Verification
- Goal:
  - confirm the installed build is actually running the current engine revision
- Required checks:
  - main-process log shows `bootstrap mode=cli`
  - CLI step log lines are visible
  - exported G-code is freshly generated
  - packaged output matches source-build expectations for the same preset and sample

## Acceptance Criteria For This Slice
- Normal `Support interface` replay is stable.
- Glue injection happens at `; layer num/total_layer_count`, not immediately on feature exit.
- Tower mode never leaves `XY+E` extrusion on the trip to the wiping tower.
- Tower shell is emitted in the delayed second-pass stage before `; update layer progress`.
- Unit tests plus real-sample source checks pass before rebuild.

## Latest Validation Status
- 2026-03-19 Round 1:
  - `npx vitest run tests/unit/main/mkp-engine.test.ts tests/unit/main/postprocess-report-runtime.test.ts tests/unit/main/main-process-diagnostics.test.ts`
  - Result: `47 passed`
- 2026-03-19 Round 2:
  - real preset + `.227388.15.gcode`
  - real preset + `.227388.16.gcode`
  - Result:
    - support-interface injection detected in both samples
    - tower shell appears before `; update layer progress`
    - `XY+E` extrusion count between `;Prepare for next tower` and glue-block end is `0` for both samples

## Test Strategy
- Keep extending [`tests/unit/main/mkp-engine.test.ts`](d:/trae/MKP_SE/tests/unit/main/mkp-engine.test.ts) as the primary engine spec.
- Prioritize behavior tests over source-shape tests.
- Required coverage still to add:
  - `delete_wipe` edge cases around trailing wipe tails and mid-segment wipe markers
  - Orca ironing extraction and cancellation
  - support-surface detection vs top-surface ironing detection
  - advanced `ironingPathOffsetMm` config normalization and later geometry clipping
  - structured CLI failures for bad args/configs
  - 4 calibration modes and returned metadata

## Current Risks
- `processGcodeContent()` still mixes scan and replay concerns in one file/function cluster.
- Orca ironing semantics are not yet close to Python parity.
- Replay timing/feed semantics around `;ZJUMP_START` are started but not fully parity-checked against Python.
- Calibration generation is still missing from the JS engine.
