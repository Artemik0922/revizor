'use strict';
// Revizor — SessionStart hook (fires on startup/resume/clear/compact).
// Auto mode: injects the working protocol into the session context so the agent
// uses the checks and polishing without being asked.
// Disabled → silent exit 0. Enable: .revizor-auto in the project root or auto: true in revizor.json.

const fs = require('fs');
const path = require('path');
const lib = require('./revizor-lib');

(async () => {
  const input = lib.readStdinJson();
  if (!input) process.exit(0);
  const root = lib.findProjectRoot((input && input.cwd) || process.cwd());
  const cfg = lib.loadConfig(root);
  const lang = lib.resolveLang(cfg);

  // Stamp the plugin into the state (always, even with auto mode off):
  // /dashboard finds the generator by pluginRoot.
  const st = lib.loadState(root);
  st.pluginRoot = path.resolve(__dirname, '..');
  try {
    st.pluginVersion = JSON.parse(
      fs.readFileSync(path.join(st.pluginRoot, '.zcode-plugin', 'plugin.json'), 'utf8')
    ).version || st.pluginVersion || '';
  } catch (e) {
    /* version unavailable — not critical */
  }
  lib.saveState(root, st);

  if (lib.isKilledOff(root)) process.exit(0);
  if (!lib.autoOn(root, cfg)) process.exit(0);

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lib.t(lang, 'protocol'),
      },
    })
  );
  process.exit(0);
})().catch(() => process.exit(0));
