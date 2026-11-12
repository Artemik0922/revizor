---
description: Deep project audit without edits: issues P0–P3 with file:line
argument-hint: "[scope, e.g. src/ or a file]"
---

Run a deep audit of $ARGUMENTS (when omitted — the whole project except node_modules, dist, build, .zcode). Diagnostics and report only — DO NOT TOUCH THE CODE.

1. **Facts by running things:**
   - the `ship` lane from `revizor.json` (fallback: `test` lane; if neither — note it and skip);
   - the `quality` lane from `revizor.json`, if defined (heavy checks: eslint, jscpd, i18n parity) — run it and record the result;
   - if package.json exists — `npm outdated` and `npm audit --omit=dev` (final numbers only).
2. **Source scans** (grep/ripgrep over $ARGUMENTS, `--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.zcode`):
   - `console.log(`, `console.debug`, `debugger`;
   - `TODO|FIXME|XXX|HACK`;
   - empty `catch {}` / `catch (e) {}` with no handling;
   - hard-coded user-facing strings in the source language inside .js/.ts/.html inline scripts (if the project has an i18n/lang dictionary — these are key candidates; list file:line and the suggested key);
   - **secrets**: `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `github_pat_`, `AKIA[0-9A-Z]{16}`, `xox[baprs]-`, `eyJhbGciOi` (JWT), `("api[_-]?key"|"token"|"secret")\s*[:=]\s*["'][^"']{12,}` — any hit → **P0**: file:line + type; never print the full value (placeholder values like `YOUR_API_KEY`/`changeme` are fine);
   - if a lang/i18n dictionary exists — key parity between languages: missing, extra, unused-in-code keys (verify dynamic key construction before flagging).
3. **By reading key files** (sampled, not everything) assess:
   - code duplication >10 lines; functions >60 lines; files >500 lines;
   - unused files and exports (verify references project-wide before accusing — suspicion ≠ fact);
   - magic numbers, mixed naming styles, string-concatenated SQL/injection risks.
4. **Report strictly in this format:**
   - metrics table: files, lines, console.log, TODO/FIXME, duplicates, files>500 lines;
   - groups: **P0** bugs/crashes → **P1** correctness/leaks/security → **P2** smells/duplicates/dead code → **P3** style/naming/docs. Each item: `file:line` — essence — how to fix — cost (S/M/L);
   - "Top-5 quick wins" (max effect for minimal edits);
   - final line: **AUDIT COMPLETE: N issues (P0: x, P1: y, P2: z, P3: w)** and a suggestion to run `/polish`.

Rules: never invent line numbers — every item must be backed by real grep/read output; skip inapplicable checks with a note; fix and delete nothing.

After the report, record into `.zcode/revizor-state.json`: `lastAudit = {ts, p0, p1, p2, p3, total}` (numbers from the report) and append a `history` entry `{ts, consoleLogs, todos, dupes, bigFiles, testsOk}` (values from the scans; testsOk — the ship/test lane result). Preserve existing entries — `/trend` and the dashboard are built from them.
