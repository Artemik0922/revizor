---
description: Open the Revizor dashboard: trends, lane statuses, recent failures
---

Open the Revizor dashboard for the current project.

1. Read `.zcode/revizor-state.json`. If the file or the `pluginRoot` field is missing — say one session with the installed plugin is required (the SessionStart hook stamps the path) and stop.
2. Run: `node "<pluginRoot>/scripts/dashboard.js" "<project root>"`. The output contains `REVIZOR_DASHBOARD=<path>` — take the path from it.
3. Open the file in the browser: `cmd //c start "" "<path>"` (Windows) or the platform equivalent.
4. In chat — exactly three lines:
   - **Verdict** — the pill from the page (HEALTHY / ATTENTION / IDLE / Revizor is off);
   - **Trend** — "quality improving / degrading / stagnant / not enough data" + supporting numbers (e.g. console.log 12→4);
   - **Red items** — lane failures or "no failures".
   If the page was generated with the empty state — say so and suggest running `/audit` to fill the history.
