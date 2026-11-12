---
description: Revizor auto mode: on / off / status
argument-hint: "[on | off | status]"
---

Manage Revizor auto mode for the current project. Argument: $ARGUMENTS (empty — treat as `status`).

- **on**: create an empty `.revizor-auto` file in the project root. Confirm and briefly list what the agent now does by itself (the auto protocol: runs tests after edit batches, fixes hook feedback immediately, fixes P0/P1 right away, /ship before finishing a large task). If revizor.json exists — suggest adding `"auto": true` for a permanent setting, but do not edit the config yourself unless asked.
- **off**: delete `.revizor-auto` if present. If revizor.json has `"auto": true` — ask whether to remove it there too (never edit silently). Confirm.
- **status**: check `.revizor-auto`, the `auto` field in revizor.json, lane configuration (fast/test/quality/ship, kill switches), then `.zcode/revizor-state.json` (recent fast/test runs, history length). Brief: 3–4 lines — auto mode on/off, what is configured, what is worth running.
