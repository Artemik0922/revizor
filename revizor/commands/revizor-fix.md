---
description: Fix the last failed Revizor check with a minimal change
---

Fix the last failed Revizor check.

1. Read `.zcode/revizor-state.json`. If `lastFailures` is empty or the file is missing — run the `test` lane from `revizor.json` (or `npm test` with the built-in configuration) and take its failures.
2. Take the first failed check; analyze its output (the tail matters more than the head).
3. Fix the code MINIMALLY: a targeted change of the cause; do not rewrite architecture, do not touch unrelated files. If the cause is environment/dependencies/config rather than code — stop and ask the user; do not fix on your own.
4. Re-run the failed command and make sure it is green.
5. Report in three lines: what was broken → what you changed (file:lines) → the re-check result.
