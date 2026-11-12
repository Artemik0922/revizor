'use strict';
// Revizor — Stop hook.
// Test lane: when the agent stops and files changed since the last run,
// run the tests. Failures go back to the model so it never reports completion
// with red tests. Green runs emit a light confirmation note.
// Afterwards the dashboard is regenerated silently.

const fs = require('fs');
const path = require('path');
const lib = require('./revizor-lib');

// Auto test lane: a real scripts.test in package.json.
function autoTestChecks(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const t = pkg.scripts && pkg.scripts.test;
    if (typeof t === 'string' && t.trim() && !/no test specified/i.test(t)) {
      return [{ run: 'npm test', name: 'npm test', timeoutMs: 180000 }];
    }
  } catch (e) {
    /* no package.json — no test lane */
  }
  return [];
}

(async () => {
  const input = lib.readStdinJson();
  if (!input) process.exit(0);
  if (input.stop_hook_active) process.exit(0); // already blocked once — no loops

  const root = lib.findProjectRoot(input.cwd || process.cwd());
  const cfg = lib.loadConfig(root);
  const lang = lib.resolveLang(cfg);
  if (cfg.off.test || lib.isKilledOff(root)) process.exit(0);

  let checks;
  if (cfg.test != null) {
    checks = lib.normalizeChecks(cfg.test) || [];
  } else {
    checks = autoTestChecks(root);
  }
  if (!checks.length) process.exit(0);

  const st = lib.loadState(root);
  const pending = Array.isArray(st.changedSinceTest) ? st.changedSinceTest : [];
  if (!pending.length) process.exit(0); // nothing changed since the last run

  const now = Date.now();
  if (st.lastTestTs && now - st.lastTestTs < lib.numOrDefault(cfg.testDebounceMs, 15000)) {
    process.exit(0); // too frequent — check on the next stop
  }
  st.lastTestTs = now;

  const results = [];
  for (const c of checks) {
    if (c.run) results.push(await lib.runCheck(c, root, lang));
  }

  const failures = results.filter((r) => !r.ok);
  st.lastTest = {
    ts: now,
    ok: failures.length === 0,
    failures: failures.map((f) => ({ name: f.name, output: f.output })),
  };
  st.changedSinceTest = [];
  st.lastFailures = failures.length
    ? failures.map((f) => ({ lane: 'test', name: f.name, output: f.output, ts: now }))
    : [];
  lib.saveState(root, st);

  // Silent dashboard regeneration after each test run (never critical).
  try {
    require('./dashboard-lib').generateDashboard(root, path.resolve(__dirname, '..'), lang);
  } catch (e) {
    /* dashboard is not critical */
  }

  if (failures.length) {
    const ctx = lib.t(lang, 'changedFiles', { list: pending.slice(-5).join(', ') });
    let reason = lib.failReason('test', failures, ctx, lang);
    reason += '\n\n' + lib.t(lang, 'fixHint');
    if (lib.autoOn(root, cfg)) reason += '\n' + lib.t(lang, 'autoHint');
    lib.block(lib.capReason(reason, cfg.maxOutputChars));
  } else {
    // Green run: a light confirmation so "ran and passed" is distinguishable from "skipped".
    const names = checks.map((c) => c.name || c.run).join(', ');
    console.log(JSON.stringify({ continue: true, systemMessage: lib.t(lang, 'testsGreen', { checks: names }) }));
  }
  process.exit(0);
})().catch(() => process.exit(0));
