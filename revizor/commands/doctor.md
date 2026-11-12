---
description: Project health check: dependencies, secrets in code, build size
argument-hint: "[scope]"
---

Run a health check of $ARGUMENTS (when omitted — the whole project except node_modules, dist, build, .zcode). Fix and delete nothing — diagnosis and report only.

1. **Dependencies** (if package.json exists): `npm outdated --json` — group major/minor, top-5 important; `npm audit --omit=dev --json` — count and max severity; depcheck (`npx depcheck --json`) — only if available without a long install, otherwise skip with a note. Verify depcheck false positives (dynamic require) with references before the verdict — suspicion ≠ fact.
2. **Secrets in code**: grep the sources for `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `github_pat_`, `AKIA[0-9A-Z]{16}`, `xox[baprs]-`, `eyJhbGciOi` (JWT), `("api[_-]?key"|"token"|"secret")\s*[:=]\s*["'][^"']{12,}`. Any hit → **P0**: file:line, type, first 4 characters of the value — **never print the full value**. Training placeholders (`YOUR_API_KEY`, `xxx`, `changeme`) are fine.
3. **Build size**: if dist/build exists — total folder size; if revizor.json defines `sizeBudgetKb` — compare with the budget and show the margin; without a budget — just the fact.
4. Report: ✅/❌ table for the three sections; P0 items listed with file:line; **VERDICT: HEALTHY / NEEDS TREATMENT — N P0**. Do not search secrets in git history — working tree only.
