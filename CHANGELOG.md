# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [0.5.0] — 2026-11-12

First public release.

### Added
- **i18n**: every plugin message in English and Russian; `"lang": "auto" | "en" | "ru"` in `revizor.json` (`auto` detects a Russian locale).
- **Fast lane checks inline `<script>` blocks of `.html` files** — vanilla projects keep their logic in HTML, now it is verified too.
- **Green test confirmation** — a successful Stop run emits `{"continue": true, "systemMessage": …}`, so "tests passed" is distinguishable from "tests never ran".
- **Dashboard reads `lastAudit`** — the verdict turns to ATTENTION on P0 findings, and the config table shows the last audit totals.
- **Test suite**: 30 tests on `node:test` (unit + integration through the real hook scripts), zero dependencies.
- **CI** on Ubuntu and Windows × Node 20/24: syntax check, tests, manifest validation.
- Bilingual README (EN/RU), MIT license, this changelog.

### Fixed
- **Strict hook output schema** — Stop now emits exactly `{"decision","reason"}`; the previous `suppressOutput` key could cause ZCode to discard the hook's effect entirely. PostToolUse failures use `stderr` + exit code `2`; SessionStart uses `hookSpecificOutput.additionalContext`.
- Single-point sparkline renders as a flat segment instead of a lonely dot.
- `0` is accepted as a legal debounce/timeout value (the `||` zero-trap).
- HTML entities are not double-escaped in the dashboard.

## [0.4.1] — 2026-11-12
### Changed
- Dashboard restyled to a light minimal theme: hairline tiles, dot+text status pills, thin sparklines, left-border failure rows.

## [0.4.0] — 2026-11-12
### Added
- `/dashboard` — static HTML overview with verdict pill, lane tiles, SVG trend sparklines, recent failures, error-brain counters and configuration.
- Automatic dashboard regeneration after each test run.
- `pluginRoot`/`pluginVersion` stamp in the project state so `/dashboard` can locate the generator.

## [0.3.0] — 2026-11-12
### Added
- **Auto mode** (`/revizor-auto`): SessionStart injects a self-driving protocol; survives context compaction.
- **Guard** hook: rejects edits inside generated folders (`guardAllow` for exceptions).
- **Error brain**: nudges the agent to change approach after repeated command failures.
- **`quality` lane** for heavy checks (eslint, i18n parity) used by `/audit` and `/polish`.
- **`/trend`** and metric history; **`/doctor`** with dependency, secret and build-size checks.
- Secret scanning in `/audit` (P0) and `/ship` (fails the gate).

### Fixed
- Hook output protocol aligned with the strict ZCode schema (see 0.5.0 notes).

## [0.2.0] — 2026-11-12
### Added
- `/audit` — prioritized P0–P3 diagnostics with `file:line`, no edits.
- `/polish` — refactor-to-ideal with a confirmed plan and tests after every batch.
- Safe-refactoring protocol and the "ideal" checklist in the skill.

## [0.1.0] — 2026-11-12
### Added
- Fast lane (PostToolUse): JSON / `node --check` / `tsc --noEmit` on the changed file.
- Test lane (Stop): runs the project tests when files changed since the last run.
- `/ship` release gate, `/checks` status, `/revizor-fix` minimal fix.
- Per-project `revizor.json` configuration, `.revizor-off` kill switch, state file.
