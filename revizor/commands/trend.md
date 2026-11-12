---
description: Quality metrics trend: console.log/TODO/duplicates dynamics between runs
---

Show the quality metrics trend for the project.

1. Read `.zcode/revizor-state.json`, the `history` array — entries `{ts, consoleLogs, todos, dupes, bigFiles, testsOk}`. If there are no entries or fewer than two — say there is no trend yet and explain: `/audit` and `/ship` append metrics automatically on every run; suggest running `/audit`.
2. Dynamics table: time | console.log | TODO/FIXME | duplicates | files>500 lines | tests. A "Δ" column — change versus the previous run (↑ worse, ↓ better, = unchanged).
3. One-line summary: **QUALITY: improving / degrading / stagnant** (by the direction of most metrics over recent runs) and one concrete recommendation on which metric to attack next and with which tool (`/polish`, `/doctor`).
