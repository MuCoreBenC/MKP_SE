## Continue

Updated: 2026-03-19

- Done: 5.8.5 old Python parity remains the main path; CLI now only accepts JSON presets.
- Done: Settings includes manual `TOML -> JSON` conversion into `MKP SupportE\\Presets\\ConvertedPresets`.
- Done: File selection guards now block oversized or fake-extension inputs for TOML/image flows.
- Done: Frontend hardening pass 1 finished: deduped `updates.js` and `home.js`, replaced silent catches in `app.js` and `index.html` with logs.
- Done: Tower placement preview now uses bottom-left origin, integer snapping, real footprint preview, and P1/X1 front-L dead-zone rules.
- Done: Quality gates passed: `npm run typecheck`, `npm test` (440 tests), syntax scan.
- Current: Continue Python 5.8.5 parity work and keep locking GUI risk points plus tower UX with TDD.
