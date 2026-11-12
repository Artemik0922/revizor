---
description: Revizor release gate: all project checks + "ship / do not ship" verdict
---

Run the Revizor release gate and give a verdict. Fix nothing on your own initiative — checks and report only.

1. Read `revizor.json` in the project root. The `ship` lane is the list of checks to run. If absent — use the `test` lane; if neither and package.json has no scripts.test — stop and say what to add to revizor.json.
2. Execute each check in order (Bash, timeout from `timeoutMs`, default 5 minutes). Do not stop at the first failure — collect ALL failures for a complete report.
3. Additionally, if this is a web/Node project: grep the sources (excluding node_modules, dist, build) for `console.log(`, `debugger`, `TODO|FIXME|XXX` — count only and show file:line, delete nothing.
4. **Secrets**: grep the patterns `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `github_pat_`, `AKIA[0-9A-Z]{16}`, `xox[baprs]-`, `eyJhbGciOi`, `("api[_-]?key"|"token"|"secret")\s*[:=]\s*["'][^"']{12,}` — any hit (except training placeholders) fails the gate: file:line + type; never print the full value.
5. Result strictly in this format:
   - table: ✅/❌ per check + execution time;
   - for failures — the last lines of output;
   - counter of found console.log/debugger/TODO;
   - final line: **VERDICT: READY TO SHIP** or **VERDICT: DO NOT SHIP — N failures**.
6. Record metrics into `.zcode/revizor-state.json` → `history`: `{ts, consoleLogs, todos, dupes, bigFiles, testsOk}` — preserve previous entries (they feed `/trend`).
