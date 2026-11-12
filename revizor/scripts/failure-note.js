'use strict';
// Revizor — PostToolUseFailure hook (matcher: Bash).
// "Error brain": counts repeated failures of the same command in a session;
// from the second failure it nudges the agent to change the approach.

const lib = require('./revizor-lib');

(async () => {
  const input = lib.readStdinJson();
  if (!input) process.exit(0);
  const cmd = (input.tool_input && input.tool_input.command) || '';
  if (!cmd) process.exit(0);

  const root = lib.findProjectRoot((input && input.cwd) || process.cwd());
  const cfg = lib.loadConfig(root);
  const lang = lib.resolveLang(cfg);
  if (cfg.off.brain || lib.isKilledOff(root)) process.exit(0);

  const st = lib.loadState(root);
  const map = st.failures && typeof st.failures === 'object' ? st.failures : {};

  // Rough repeat key: the command without extra whitespace, first 80 chars
  const key = String(cmd).replace(/\s+/g, ' ').trim().slice(0, 80);
  const rec = map[key] && typeof map[key] === 'object' ? map[key] : { count: 0, hinted: false };
  rec.count += 1;
  rec.lastTs = Date.now();
  map[key] = rec;

  let note = null;
  if (rec.count >= 2 && (rec.count === 2 || rec.count % 3 === 0)) {
    note = lib.t(lang, 'brainNote', { n: rec.count });
    rec.hinted = true;
  }
  st.failures = map;
  lib.saveState(root, st);

  if (note) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUseFailure',
          additionalContext: note,
        },
      })
    );
  }
  process.exit(0);
})().catch(() => process.exit(0));
