# Tower-Only Parity Plan

Updated: 2026-03-19

## 1. Goal

This plan locks the current product and engine direction to one line only:

- JS post-processing must reproduce the old Python 5.8.5 slow-line wiping-tower flow first.
- The shipping product must default to wiping tower and must not guide users into silicone wipe or non-tower flow.
- Lollipop / fast-line stays parked as a future internal hook only.
- Bambu Studio / Orca wipe-tower source is reference material for ideas and UX only, not the current implementation target.

## 2. Locked Decisions

- Truth source for current release work:
  - trusted 5.8.5 Python exports
  - `main585.py`
  - current JS output only as a temporary baseline
- Current release target:
  - old 5.8.5 slow-line wiping tower
  - no silicone-wipe product path
  - no visible lollipop option
- Deferred targets:
  - 5.9.0 wall-buffer / move-walls behavior
  - 6.x lollipop logic
  - forcing Bambu Studio to generate an internal prime tower for single-color MKP use
- Wipe-tower placement UX should be implemented inside MKP, not by hacking Bambu/Orca into showing a fake native tower.

## 3. Current Unfinished Bugs

### P0

- The params page still exposes `switch_tower_type` and still shows the lollipop / fast-line option.
- The params page still exposes `have_wiping_components` with wording that implies users may switch away from wipe tower.
- Public product behavior is not yet fully hard-locked to "tower-only"; old preset fields can still describe non-tower branches.
- User-facing config and runtime language still contains mixed semantics from the old "components vs tower" era.

### P1

- 5.8.5 sample-level parity is not yet frozen by a full trusted diff workflow.
- Wipe-tower position editing still lacks a safe visual editor with printable-range clamping.
- The current advanced plan for wipe-tower placement exists only conceptually and is not yet TDD-backed.

### P2

- The future lollipop hook is still present in code and tests; it is parked correctly, but the release-facing surface is not yet fully hidden.
- The Orca/Bambu-inspired advanced wipe-tower parameter set has been researched but not yet translated into a safe MKP-specific feature set.

## 4. Scope Split

### In Current Slice

- Lock product behavior to wiping-tower-only.
- Continue 5.8.5 engine parity.
- Keep sample-driven regression as the primary acceptance gate.
- Add safe wipe-tower positioning rules.
- Design and later implement an MKP-native bed preview / drag editor for the tower.

### Out Of Current Slice

- Direct source-port of Bambu / Orca wipe-tower generator code.
- Any release-visible lollipop mode.
- Any release-visible silicone wipe alternative.
- 5.9.0 wall-buffer behavior as a default path.
- Any attempt to make Bambu Studio show a native prime tower for single-color MKP use.

## 5. Source References

- Python 5.8.5 source:
  - `d:\trae\MKP_SE\main585.py`
  - `D:\trae\MKP_SE_python_validation\MKPSupport_git\main.py`
- Trusted Python export:
  - `D:\trae\MKP_SE_python_validation\585python支撑涂胶测试.gcode`
- Older non-target reference:
  - `D:\trae\MKP_SE_python_validation\旧版python支撑涂胶测试.gcode`
- Current JS engine:
  - `d:\trae\MKP_SE\src\main\mkp_engine.js`
- Current renderer params page:
  - `d:\trae\MKP_SE\src\renderer\assets\js\params.js`
- Existing test anchors:
  - `d:\trae\MKP_SE\tests\unit\main\mkp-engine.test.ts`
  - `d:\trae\MKP_SE\tests\unit\renderer\entry\params-runtime-smoke.test.ts`

## 6. Execution Phases

### Phase A: Product Gating Cleanup

Objective:
- Make the shipping product clearly tower-only.

Work:
- Remove or hide the visible lollipop selector from the params page.
- Remove or hide the visible "disable tower / components path" choice from the params page.
- Normalize legacy preset input so public runtime behavior still resolves to wipe tower.
- Keep any future fast-line hooks internal only.
- Rewrite user-facing wording so the UI no longer suggests silicone wipe as a current supported alternative.

Acceptance:
- UI no longer exposes lollipop.
- UI no longer suggests turning off wipe tower.
- Loading an old preset still results in tower-only effective behavior.

### Phase B: 5.8.5 Engine Parity Freeze

Objective:
- Finish parity against the trusted 5.8.5 flow before any new product feature work.

Work:
- Compare current JS output against the trusted 5.8.5 export on the same source G-code.
- Identify each remaining mismatch by block order, marker counts, and travel/extrusion safety.
- Add failing tests for each confirmed mismatch before changing engine logic.
- Fix only 5.8.5 behavior, not 5.9.0 or 6.x behavior.

Acceptance:
- Marker counts match the trusted sample.
- Tower preparation and replay order match the trusted sample.
- No unintended XY+E extrusion exists on tower-prep travel.
- Resume path after tower replay is structurally identical on the known sample.

### Phase C: Safe Tower Position Rules

Objective:
- Prevent invalid coordinates even before the visual editor lands.

Work:
- Define the machine / plate reachable range for the tower footprint.
- Clamp saved X/Y coordinates into a safe range.
- Reject impossible tower positions during save or processing.
- Log a clear diagnostic when a preset value is corrected or rejected.

Acceptance:
- Users cannot save a tower position outside the allowed area.
- Runtime report shows the corrected or effective tower position.

### Phase D: Visual Tower Position Editor

Objective:
- Replace raw coordinate editing with a beginner-safe interaction.

Work:
- Add a low-profile expandable advanced section at the bottom of the page.
- Render an MKP-native bed preview that visually matches the Bambu / Orca mental model.
- Show the wipe tower footprint on the bed.
- Allow drag-to-move with live X/Y coordinate display.
- Show safe bounds and prevent dragging outside them.
- Write the final coordinate back into the preset.

Acceptance:
- Users can drag the tower instead of typing blind coordinates.
- Out-of-range movement is blocked visually.
- The saved coordinate matches the dragged coordinate.

### Phase E: Packaging Gate

Objective:
- Do not package until both product gating and 5.8.5 parity are stable.

Work:
- Run the full targeted test set.
- Run the sample parity workflow.
- If parity is clean, ask for one fresh Bambu Studio export only if an external verification is still needed.
- Package only after the trusted sample and the public product direction both pass.

Acceptance:
- Tests green.
- Trusted sample parity accepted.
- No release-visible lollipop / non-tower path remains.

## 7. TDD Execution

### Cycle 1: Renderer Product Gating

Red:
- Add renderer tests that fail if:
  - `params.js` still exposes the lollipop option
  - `params.js` still exposes a release-facing tower disable path
  - default visible wiping strategy is anything other than wipe tower

Green:
- Change the params schema and rendering logic so only the tower-only public path remains.

Refactor:
- Separate public wipe-strategy fields from internal compatibility fields.

Primary tests:
- `tests/unit/renderer/entry/params-runtime-smoke.test.ts`

### Cycle 2: Config Normalization And Runtime Gating

Red:
- Add engine tests that fail if:
  - legacy `have_wiping_components = false` can still produce a public non-tower release path
  - fast-line values affect release behavior without an internal opt-in
  - runtime report does not show the effective tower-only resolution

Green:
- Normalize all public runtime inputs to tower-only behavior.

Refactor:
- Centralize "effective public wiping strategy" resolution in one helper.

Primary tests:
- `tests/unit/main/mkp-engine.test.ts`
- `tests/unit/main/postprocess-report-runtime.test.ts`

### Cycle 3: 5.8.5 Sample Parity

Red:
- For each confirmed mismatch from the trusted sample:
  - add a focused failing unit or sample-inspired regression test
  - assert exact order, exact marker presence, and travel safety

Green:
- Fix the engine with the smallest 5.8.5-specific change.

Refactor:
- Extract parsing / replay helpers only after the failing sample case is green.

Primary tests:
- `tests/unit/main/mkp-engine.test.ts`

### Cycle 4: Safe Tower Coordinates

Red:
- Add tests that fail if:
  - out-of-range tower coordinates are accepted unchanged
  - clamping is inconsistent
  - diagnostics do not report the effective coordinate

Green:
- Add clamping and validation logic.

Refactor:
- Move bed-range math into dedicated helpers for reuse by the future visual editor.

Primary tests:
- new renderer or main-process coordinate tests
- existing diagnostics tests if runtime report is extended

### Cycle 5: Visual Editor

Red:
- Add UI tests for:
  - rendering the tower footprint
  - drag updates
  - bound blocking
  - save-back behavior

Green:
- Implement the editor with the smallest interactive surface first.

Refactor:
- Reuse the same coordinate helpers used by runtime clamping.

Primary tests:
- new renderer entry tests for the bed editor

## 8. Test Command Set

Use this targeted suite during the current slice:

```powershell
npx vitest run tests/unit/main/mkp-engine.test.ts tests/unit/main/postprocess-report-runtime.test.ts tests/unit/main/main-process-diagnostics.test.ts tests/unit/renderer/entry/params-runtime-smoke.test.ts
```

When the visual editor starts landing, extend the command with its renderer test file.

## 9. Manual Validation Gates

After Phase A:
- Confirm the params page no longer shows lollipop.
- Confirm the params page no longer implies users can switch away from wipe tower.

After Phase B:
- Re-run the trusted 5.8.5 sample comparison.
- Confirm the exported G-code still has no unintended path extrusion when traveling to the tower.

After Phase C / D:
- Try obviously invalid coordinates.
- Confirm the editor or save path clamps them safely.

## 10. Stop Conditions

Do not stop the implementation slice until one of these is true:

- JS output matches the trusted 5.8.5 Python export on the accepted sample workflow.
- The remaining mismatch list is extremely short, isolated, and documented.
- A user-side fresh export is needed because the next truth source can only come from Bambu Studio itself.

## 11. Later Branches

These are explicitly postponed:

- 5.9.0 wall-buffer parity as a separate branch.
- 6.x lollipop as a separate branch.
- Additional wipe-tower styles inspired by Orca / Bambu advanced tower settings.
- Any discussion of exposing silicone wipe again.
