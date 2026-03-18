## Continue

Updated: 2026-03-18

### Done
- JS post-processing core, detached report viewer, and main-engine TDD are in place.
- Main-process diagnostics now log startup, uncaught exceptions, unhandled rejections, and safe GUI restarts.
- G-code diff pinned 3 core gaps: preset mismatch, per-feature glue injection, and full-file duplication outside the pure engine path.
- Added `switch_tower_type` TDD + params UI exposure so presets now default to slow-line tower mode and can switch to lollipop fast mode.
- Added follow-up wiping-tower helper coverage so slow-line now caps to `35mm/s` and fast-line uses the full configured tower speed.
- Hooked follow-up wiping-tower generation into the real post-glue recovery path, with end-to-end tests for slow-line and fast-line recovery output.

### Current
- CLI post-processing now writes back to the source `.gcode`; updater failures are compacted; default slow-line wiping tower recovery now reuses the full Python template and current layer thickness.

### Next
- Continue layer-bucket glue specs, then add preset/header validation before chasing the duplicated full-file output path.
