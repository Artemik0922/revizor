---
name: revizor
description: Self-verifying coding loop "Revizor". Use it when configuring project checks via revizor.json, interpreting "🛡 Revizor" hook feedback, adding or disabling check lanes or auto mode (/revizor-auto), troubleshooting why checks don't fire or why guard rejected an edit, and whenever the user asks for an audit, refactoring, cleanup or bringing the project to ideal (/audit, /polish), metrics trend (/trend) or a health check (/doctor).
---

# Revizor

A safety net for agent coding: the agent edits code → the plugin checks it → errors return
into the agent's context **before** it reports completion.

## How the lanes work

| Lane | When it runs | What it does |
|---|---|---|
| **fast** | PostToolUse: Edit / Write / MultiEdit | Quick check of the changed file (8 s debounce). Failure → stderr feedback to the agent |
| **test** | Stop (the agent stops) | If files changed since the last run — run the tests (15 s debounce). Failure → "🛡 Revizor (test)" feedback, the agent keeps working; success → a light "tests are green" note |
| **quality** | only `/audit` and `/polish` | Heavy checks from the config (eslint, jscpd, i18n parity); no built-ins |
| **ship** | only via `/ship` | Full release gate with build, secret scan and a READY/DO-NOT-SHIP verdict |

Built-in fast lane (when revizor.json has no `fast` key):
- `.json` → JSON.parse validation;
- `.js` / `.mjs` / `.cjs` → `node --check`;
- `.html` / `.htm` → `node --check` of every inline `<script>` block (vanilla-game friendly);
- `.ts` / `.tsx` → `tsc --noEmit` (when node_modules/typescript and tsconfig.json exist).

Built-in test lane (no `test` key): `npm test`, when package.json has a real scripts.test
(not the "no test specified" stub).

Files under `node_modules` are never checked. Changed files accumulate in
`.zcode/revizor-state.json` (`changedSinceTest`) even when a lane is off or skipped
by the debounce — the Stop hook still sees the changes.

## Auto mode

Enable: `/revizor-auto on` (creates `.revizor-auto` in the project root) or `"auto": true` in revizor.json.
Disable: `/revizor-auto off` or delete the file. Status: `/revizor-auto status`.

When enabled, the SessionStart hook (fires on startup/resume/clear/**compact** — the
protocol returns by itself after context compaction) injects a protocol into the session:
1. Run the test lane after every meaningful batch of edits.
2. Fix any "🛡 Revizor" feedback immediately, before reporting completion.
3. Fix P0/P1 findings right away; collect P2/P3 and offer `/polish` at the end of a large task.
4. Before finishing a large task — `/ship` with metrics.
5. Never change code behavior without approval; with failing tests the Stop feedback gets
   an "AUTO MODE: fix it yourself immediately" note.

Always active (not only in auto mode):
- **Error brain** (PostToolUseFailure, Bash): from the second failure of the same command the
  agent gets a change-the-approach nudge. Disable with `"off": {"brain": true}`.
- **Guard** (PreToolUse: Edit/Write/MultiEdit): rejects edits inside `node_modules`, `dist`,
  `build`, `.git`, `.zcode`. Exceptions — `"guardAllow": ["dist"]`; disable — `"off": {"guard": true}`.

## Dashboard

`.zcode/revizor-dashboard.html` — a state overview: a verdict pill (HEALTHY/ATTENTION),
fast/test lane statuses, files awaiting tests, metric trends from `history` (SVG sparklines),
recent failures, error-brain counters, configuration. Minimal light theme, no external
libraries, works offline over file://.

- Regenerated automatically after every test run (Stop hook).
- `/dashboard` — generate and open in the browser + a three-line summary in chat.
- The SessionStart hook stamps `pluginRoot`/`pluginVersion` into the state (always, even
  with auto mode off) — `/dashboard` finds the generator by that stamp.

## Quality: refactor and bring to ideal

Three quality levels — do not confuse:
- **`/audit`** — diagnostics only: a prioritized P0–P3 report with `file:line`, no edits.
- **`/polish`** — bring to ideal: green baseline → audit → a plan confirmed by the user →
  batched edits with tests after each → a "before → after" report.
- **`/ship`** — the release gate only.

Neighbouring tools: **`/trend`** — metric dynamics between runs; **`/dashboard`** — the browser
overview; **`/doctor`** — dependencies, secrets, build size; **`/revizor-auto`** — auto mode
toggle; **`/checks`** — lane status and recent runs; **`/revizor-fix`** — a minimal fix of the
last failure.

Safe-refactoring protocol (apply to any quality edit, even without a command):
1. Green baseline first: tests before the work; if red — fix first.
2. One batch = one theme, 1–5 files; batches independent.
3. Behavior never changes; behavior changes are a separate, agreed task.
4. Tests after each batch; a red run → revert exactly that batch.
5. The surrounding code style wins over personal preferences.
6. Out-of-scope problems go to the "out of scope" list — never fixed silently.

The "ideal" checklist (completion criteria, show it to the user):
- tests and the ship lane are green;
- no `console.log`/`debugger` in sources (except an explicit debug mode);
- no stale TODO/FIXME for finished work;
- no duplicates >10 lines; functions ≤60 lines, files ≤500 lines (soft targets);
- consistent naming, magic numbers extracted to named constants;
- user-facing strings go through i18n; localized projects have key parity between languages;
- README and docs match reality.

## Project config: `revizor.json` in the root

```json
{
  "lang": "auto",
  "auto": true,
  "fastDebounceMs": 8000,
  "testDebounceMs": 15000,
  "maxOutputChars": 4000,
  "sizeBudgetKb": 500,
  "off": { "fast": false, "test": false, "quality": false, "guard": false, "brain": false },
  "guardAllow": ["dist"],
  "fast": [
    { "match": "\\.ts$", "run": "npx tsc --noEmit", "timeoutMs": 30000, "name": "tsc" },
    { "match": "(^|/)lang\\.js$", "run": "node tools/check-i18n.js", "timeoutMs": 10000 }
  ],
  "test": [
    { "run": "npm test", "timeoutMs": 180000 },
    { "run": "node tools/sim-career.js --quick", "timeoutMs": 60000 }
  ],
  "quality": [
    { "run": "npx eslint . --format compact", "timeoutMs": 120000 },
    { "run": "node tools/check-i18n-parity.js", "timeoutMs": 60000 }
  ],
  "ship": [
    { "run": "npm test" },
    { "run": "npm run build", "timeoutMs": 300000 }
  ]
}
```

Semantics:
- **Lane missing** from the config → built-in behavior (fast — per-extension checks, test — auto npm test).
- **Lane `[]` (empty array)** → the lane is disabled without built-ins.
- A string in an array is a shorthand for `{ "run": "..." }`.
- `match` — a regex against the file path relative to the project root (forward slashes `/`). Without `match` the check runs on every change.
- `timeoutMs` — the check's limit (fast defaults to 120 s). A timeout counts as a failure.
- `cwd` — the working folder of the check relative to the project root.
- `name` — the name in reports (defaults to the command itself).
- `lang` — `"auto"` (default), `"ru"` or `"en"` for all plugin messages; auto detects a Russian locale from the environment.
- `auto: true` — auto mode (mirrors `.revizor-auto`); `guardAllow` — folders the guard may edit; `sizeBudgetKb` — build budget for `/doctor`; `off.quality`/`off.guard`/`off.brain` — granular kill switches.

## Emergency off

- `"off": { "fast": true }`, `"test"`, `"quality"`, `"guard"`, `"brain"` — granular switches in revizor.json.
- A `.revizor-off` file in the project root — turns every hook off.
- The `REVIZOR_OFF=1` environment variable.

## State: `.zcode/revizor-state.json`

Written by the hook scripts, read by `/checks`, `/revizor-fix`, `/trend`, `/dashboard`. Fields:
`lastFast` (ts/ok/failures), `lastTest` (ts/ok/failures), `changedSinceTest` (files awaiting
tests), `lastFailures` (the last failure, for /revizor-fix), `lastFastTs`, `lastTestTs`,
`history` (/audit and /ship metrics for /trend and the dashboard), `failures` (command failure
counters for the error brain), `lastAudit` (P0–P3 totals from the latest /audit),
`pluginRoot`/`pluginVersion` (the plugin stamp — /dashboard finds the generator by it).
Add this file to `.gitignore`.

## Adding a check to a project (typical request)

1. Ask/understand the lane: "after every edit" → fast; "before finishing" → test; "before release" → ship; "a heavy linter check" → quality.
2. Verify the command actually works in the project root (run it manually).
3. Add an entry to revizor.json with a meaningful `name`, a `match` (if needed) and a sane `timeoutMs`.
4. Run the lane and make sure everything is green.

## Troubleshooting

- No messages even though a broken file was changed: is the file outside the project? Is the lane off? `.revizor-off`? The debounce skipped it (see `lastFastTs`)?
- Tests don't run on Stop: no package.json / a stubbed scripts.test; `changedSinceTest` empty; less than 15 s since the last run.
- Guard rejects an edit of a legit folder: add it to `guardAllow` or set `"off": {"guard": true}`.
- Auto mode didn't kick in at session start: no `.revizor-auto` and no `auto: true`; the protocol is injected by the SessionStart hook and requires the installed plugin.
- The failing-command nudge never arrives: `"off": {"brain": true}` or fewer than two failures of the same command.
- Checks are annoying (slow): raise the debounce or move them to test/quality/ship; keep fast light (<2–3 s).
- Messages are in the wrong language: set `"lang": "ru"` or `"en"` in revizor.json (default `"auto"` detects a Russian environment).
