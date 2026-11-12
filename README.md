# Revizor

**A self-verifying coding loop for ZCode.** The agent edits code → the plugin checks it → failures return into the agent's context *before* it reports done. Then it audits, refactors to ideal, and shows the whole picture on a dashboard.

[Русская версия](README.ru.md) · MIT · Node 20+ · zero dependencies

```
edit file ──▶ fast lane (node --check / json / tsc / inline <script>) ──▶ feedback in the same turn
     │
     └─▶ agent stops ──▶ test lane (npm test, your smoke suite) ──▶ red = agent keeps working
                                                              └─▶ dashboard regenerates
```

## Why

Agentic coding has one systemic flaw: **the model believes it succeeded**. Revizor closes that loop with hooks instead of hope — every edit is verified, every completion is gated by the real test suite, and every failure lands back in the agent's context where it can still act.

## Features

| | |
|---|---|
| **Fast lane** | PostToolUse: checks the changed file in milliseconds — `JSON.parse`, `node --check`, `tsc --noEmit`, and **inline `<script>` blocks of `.html`** (vanilla-game friendly) |
| **Test lane** | Stop hook: runs your tests only when files actually changed; red → the agent keeps working, green → a light confirmation |
| **Auto mode** | SessionStart injects a protocol so the agent runs tests, fixes feedback and ships by itself — survives context compaction |
| **Edit guard** | PreToolUse: rejects edits inside `node_modules`, `dist`, `build`, `.git`, `.zcode` |
| **Error brain** | PostToolUseFailure: from the second failure of the same command, nudges the agent to change approach |
| **`/ship`** | Release gate: build, `console.log`/`debugger`/TODO scan, **secret scan**, READY / DO-NOT-SHIP verdict |
| **`/audit`** | Deep read-only diagnostics: P0–P3 findings with `file:line`, i18n key parity, unused keys, dead code, duplicates |
| **`/polish`** | Refactor to ideal: green baseline → audit → confirmed plan → batches with tests after each → before/after report |
| **`/trend`** | Metric dynamics between runs: is quality improving or degrading? |
| **`/doctor`** | Health check: outdated/vulnerable deps, secrets in code, build size vs budget |
| **`/dashboard`** | Minimal static HTML overview — verdict, lane statuses, SVG sparkline trends, failures, config |

Messages ship in **English and Russian** (`"lang": "auto" | "en" | "ru"`).

## Install

1. In ZCode open **Plugin Marketplace → Add → Add Plugin Marketplace**.
2. Paste this repository URL (or a local clone path), then **Add**.
3. Open **Personal → Revizor → Install**.
4. Manage it later in **Settings → Plugins**.

## Quick start

Create `revizor.json` in your project root — everything is optional, built-ins work without it:

```json
{
  "test": [{ "run": "npm test", "timeoutMs": 180000 }],
  "fast": [{ "match": "\\.ts$", "run": "npx tsc --noEmit", "timeoutMs": 30000 }],
  "ship": [{ "run": "npm run build", "timeoutMs": 300000 }],
  "quality": [{ "run": "npx eslint .", "timeoutMs": 120000 }]
}
```

Then just work. Edit a file with a syntax error — the fast lane reports it immediately. Finish a task with red tests — the Stop hook sends the failures back.

Want the agent to drive it on its own? `/revizor-auto on`.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `lang` | `"auto"` | `auto` detects a Russian locale, or force `en` / `ru` |
| `auto` | `false` | Auto mode (mirrors the `.revizor-auto` file) |
| `fastDebounceMs` | `8000` | Minimum gap between fast checks |
| `testDebounceMs` | `15000` | Minimum gap between test runs |
| `maxOutputChars` | `4000` | Feedback truncation limit |
| `sizeBudgetKb` | — | Build budget for `/doctor` |
| `guardAllow` | `[]` | Folders the guard may edit (e.g. `["dist"]`) |
| `off` | all `false` | Granular kill switches: `fast`, `test`, `quality`, `guard`, `brain` |
| `fast` / `test` / `quality` / `ship` | — | Check lanes, see below |

**Lane semantics:** a missing lane → built-in behavior; `[]` → lane disabled; a string entry is shorthand for `{ "run": "..." }`. Each check accepts `run`, `name`, `match` (regex on the project-relative path), `cwd`, `timeoutMs`. A timeout counts as a failure.

**Emergency off:** `.revizor-off` in the project root, or `REVIZOR_OFF=1`.

## Commands

| Command | What it does |
|---|---|
| `/audit [scope]` | P0–P3 diagnostics with `file:line`, top-5 quick wins, no edits |
| `/polish [scope\|P0,P1]` | Batched refactor to ideal with tests after each batch |
| `/ship` | Release gate with a ship / do-not-ship verdict |
| `/trend` | Metric dynamics between runs |
| `/dashboard` | Generate and open the HTML overview |
| `/doctor` | Dependencies, secrets, build size |
| `/checks` | Lane configuration and recent runs |
| `/revizor-fix` | Minimal fix of the last failed check |
| `/revizor-auto on\|off\|status` | Toggle auto mode |

## How it works

- Hooks live in `hooks/hooks.json`; each one is a small Node script in `scripts/`, invoked with the tool payload on stdin.
- Failures are reported the way ZCode expects: `stderr` + exit code `2` for tool events, `{"decision":"block","reason":…}` for `Stop`, `hookSpecificOutput.additionalContext` for `SessionStart`.
- State lives in `.zcode/revizor-state.json` (add it to `.gitignore`): recent runs, pending files, metric history, failure counters, plugin stamp.
- The dashboard is a single static HTML file — no server, no ports, opens over `file://`.

## Security note

Hooks execute the commands you put into `revizor.json` via your shell. Treat that file as trusted code — exactly like `package.json` scripts. Revizor never downloads or runs anything on its own, and `guard` prevents edits to generated folders.

## Development

```bash
cd revizor
npm test        # node:test, zero dependencies — 30 tests
```

Layout: `revizor/` is the plugin source (`.zcode-plugin/plugin.json`, `hooks/`, `scripts/`, `commands/`, `skills/`, `test/`); `marketplace.json` at the repo root lists it, so the repo root itself is an installable marketplace.

## License

[MIT](LICENSE) © 2026 Artemik0922
