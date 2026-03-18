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
