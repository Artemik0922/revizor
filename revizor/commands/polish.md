---
description: Refactor the project to ideal: audit → plan → batched edits, tests after each
argument-hint: "[scope or priorities, e.g. src/ui | P0,P1]"
---

Bring $ARGUMENTS to ideal (when omitted — the whole project except node_modules, dist, build, .zcode). Do not change code behavior unless the user explicitly asks.

## Phase 1 — Green baseline
Run the `test` lane from `revizor.json` (or `npm test`). The baseline must be green. Red baseline → suggest `/revizor-fix` first, ask the user, start no edits.

## Phase 2 — Audit
Run `/audit` on the scope compactly: only things fixable by code edits (including the `quality` lane from revizor.json, if defined). Memorize the "before" metrics (console.log, TODO, duplicates, files>500 lines).

## Phase 3 — Plan (always wait for user confirmation)
Split the work into batches: one batch = one theme (duplicates / dead code / naming / hardcoded strings…), 1–5 files, batches independent of each other. Format: № — theme — files — what changes — cost (S/M/L). Show the plan and ask which batches to execute (all / P0-P1 only / numbers). **No edits without confirmation.**

## Phase 4 — Execute batches
For each approved batch:
1. minimal edits in the surrounding code style; one batch = one meaning;
2. run the `test` lane — **green** → record and move to the next batch; **red** → revert exactly this batch's edits, analyze: fixable with an obvious change — fix and re-run, no — exclude the batch and note it in the final report;
3. found a problem outside the current batch — write it to "out of scope", never fix silently;
4. do not widen the scope without a new confirmation.

## Phase 5 — Final
Full run of `test` + `ship` and record metrics into `.zcode/revizor-state.json` → `history` (feeds `/trend`). Report:
- "before → after" per audit metrics;
- table of executed batches (theme — files — run result);
- excluded/out-of-scope items with reasons;
- verdict: **IDEAL ACHIEVED** or **N items remain** (listed).
