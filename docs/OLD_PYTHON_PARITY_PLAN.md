# Old Python Parity Plan

## Goal
- Make the JS post-processing engine reproduce the old machine-validated Python output as closely as possible.
- Treat "same behavior on the printer" as the first acceptance gate.
- Treat "same emitted G-code on the known sample" as the stronger regression gate whenever we have a trusted old export.

## Reference Split
- `main585.py`
  - Use as the 5.8.5 reference for:
  - support-interface extraction
  - glue replay timing
  - mount / unmount flow
  - two-stage wiping-tower replay
- `旧版python支撑涂胶测试.gcode`
  - Use as the 5.9.0 behavior reference for:
  - wall buffering / wall release order
  - `;Walls Ahead!`
  - `;Different Extrusion!`
  - `;Walls Released`
- `585python支撑涂胶测试.gcode`
  - Use as the machine-exported confirmation for 5.8.5 behavior.
  - It confirms the 5.8.5 path has:
    - `52` support-interface blocks
    - `27` `;Prepare for next tower`
    - `54` `;Tower_Layer_Gcode`
    - no wall-buffer markers
- `main6.2.5.py`
  - Use only as a clue for naming and intent.
  - Do not treat it as the truth source because the wall logic is commented out there.

## Truth Priority
1. Trusted old Python exports that were known to print correctly on the machine.
2. `main585.py` for behavior that is clearly present in source and matches trusted exports.
3. Newer Python source comments only as reverse-engineering hints.
4. Current JS output only as a temporary working baseline.

## Locked Scope
- Current target is the old slow-line wiping-tower flow.
- Do not make lollipop / fast-line logic the default target in this parity slice.
- Do not block this slice on Orca ironing expansion or newer wipe variants.
- Keep a future lollipop / fast-line interface only as an opt-in placeholder until we have trusted sample G-code for that branch.

## Known Gaps
- Current JS source output is already close on the base glue+tower flow.
- The new 5.8.5 export confirms the current default JS direction should stay on the no-wall-buffer path.
- Current JS source output still does not reproduce the 5.9.0 wall-buffer behavior.
- The strongest visible parity gap is the absence of:
  - `;Walls Ahead!`
  - `;Different Extrusion!`
  - `;Walls Released`
- Raw Bambu output and current JS keep the original wall order.
- The trusted 5.9.0 export delays some wall-like blocks and releases them later.

## Reverse-Engineered 5.9.0 Behavior
- The trigger is not fully recoverable from source because the exact 5.9.0 code is unavailable.
- From the trusted export, the best current model is:
  - a layer contains a valid support-interface section
  - later in the same layer, a wall-like recovery block appears
  - that wall-like block is buffered instead of emitted immediately
  - a non-wall feature such as `Internal solid infill` is allowed to print first
  - the buffered wall block is then released later with explicit markers
- "Wall-like" currently means:
  - `; FEATURE: Inner wall`
  - `; FEATURE: Outer wall`
  - `; FEATURE: Gap infill`
  - `; FEATURE: Overhang wall`

## Delivery Phases
### Phase 1: Freeze the parity target
- Keep the current trusted sample pair under validation:
  - old Python export: `D:\trae\MKP_SE_python_validation\旧版python支撑涂胶测试.gcode`
  - current repo output: `D:\trae\MKP_SE_python_validation\js_source_from_repo_against_old_target.gcode`
- Document every remaining structural mismatch before adding new code.

### Phase 2: TDD the 5.8.5 base flow
- Keep the existing tests for:
  - support-interface extraction
  - layer-boundary glue injection
  - no `XY+E` extrusion on tower-prep travel
  - delayed tower replay before `; update layer progress`
- Keep 5.9.0 wall buffering disabled by default while 5.8.5 parity is the release target.

### Phase 3: TDD the 5.9.0 wall-buffer flow
- Add synthetic regression tests for:
  - buffering a wall-like block that appears after support-interface work on the same layer
  - keeping the non-wall block in place
  - releasing the buffered wall block later with the old markers
  - preserving wipe / G3 / prime sequences inside the released block
- Add sample-inspired assertions for:
  - the first known `Internal solid infill` / delayed `Inner wall` pattern
  - the later `Gap infill` / delayed wall release pattern

### Phase 4: Sample-level parity verification
- Re-generate repo output from the same raw Bambu G-code.
- Compare against the trusted old export.
- First compare critical markers and block order.
- Then compare the full file after normalizing harmless whitespace differences.

## TDD Checklist
### Unit TDD
- Detect when a wall-like recovery block should be buffered.
- Do not emit the buffered wall block at its original location.
- Emit `;Walls Ahead!` when buffering starts.
- Emit `;Different Extrusion!` when the next live block is a non-wall feature.
- Emit `;Walls Released` before replaying the buffered block.
- Replay the buffered wall block with its original wipe / G3 / prime lines intact.
- Keep the later non-wall block untouched.

### Integration TDD
- Base glue+tower flow still passes all current engine tests.
- No regression in delayed wiping-tower replay.
- No regression in `head_wrap_detect` stripping.
- No regression in AUTO fan restoration.

### Sample Regression TDD
- On the trusted sample, JS output must eventually match old Python on:
  - marker counts
  - block ordering around the known delayed-wall regions
  - no unexpected extra extrusion on tower-prep travel

## Working Acceptance Criteria
- Base support-interface glue replay remains green.
- Two-stage wiping-tower replay remains green.
- JS output gains the missing wall-buffer markers in the expected places.
- The first known delayed-wall sample block matches the trusted old export.
- If whole-file parity still fails, the remaining mismatch list is short and explicitly documented.

## When To Ask The User For Validation
- If repo output matches the trusted old sample on the known delayed-wall regions, ask for one fresh Bambu Studio export from the user.
- If the machine-path concern is still uncertain after file diff parity, ask the user to run one safe real export / preview check before packaging.
