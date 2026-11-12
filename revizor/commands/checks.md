---
description: Revizor status: lanes config and recent runs
---

Show the Revizor status for the current project.

1. Read `revizor.json` in the project root (if missing — say the built-in configuration is active: fast = json/node --check/tsc, test = npm test when scripts.test exists, and suggest creating revizor.json).
2. Read `.zcode/revizor-state.json` and show: time and result of the last fast check, time and result of the last test run, files in `changedSinceTest` (awaiting tests), `lastAudit` if present.
3. If the state file is missing — say no checks have run in this project yet.
4. Summary — a short brief: what is enabled/disabled, recent failures (if any), one concrete configuration recommendation (e.g. add a ship lane or a `match` for a slow check). Change nothing without being asked.
