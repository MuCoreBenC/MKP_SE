## Continue

Updated: 2026-03-20

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
- Done: Quality gate is green again: `npm test` now passes with `81` files and `477` tests.
- Current: The current整改清单 is closed. Future work can move to optional structural refactors or new features rather than cleanup debt from this round.
