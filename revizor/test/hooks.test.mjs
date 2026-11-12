// Integration tests: the real hook scripts, driven via stdin like ZCode drives them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const run = (script, stdinObj) =>
  spawnSync(process.execPath, [path.join(SCRIPTS, script)], {
    input: JSON.stringify(stdinObj),
    encoding: 'utf8',
  });

function makeFixture({ lang = 'en', pkgTest = 'node fail.js', extraConfig = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revizor-hooks-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', scripts: { test: pkgTest } }));
  fs.writeFileSync(
    path.join(root, 'revizor.json'),
    JSON.stringify({ lang, fastDebounceMs: 0, testDebounceMs: 0, ...extraConfig })
  );
  fs.writeFileSync(path.join(root, 'ok.js'), 'const a = 1;\n');
  fs.writeFileSync(path.join(root, 'broken.js'), 'const a = (1;\n');
  fs.writeFileSync(path.join(root, 'broken.json'), '{ oops\n');
  fs.writeFileSync(path.join(root, 'fail.js'), 'process.exit(1);\n');
  fs.writeFileSync(path.join(root, 'oktest.js'), '// ok\n');
  fs.writeFileSync(
    path.join(root, 'good.html'),
    '<html><script>const a = 1;</script></html>'
  );
  fs.writeFileSync(
    path.join(root, 'broken.html'),
    '<html><script src="skip.js"></script><script>const a = (1;</script></html>'
  );
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'x.js'), 'x;\n');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'y.js'), 'const y = 1;\n');
  return root;
}
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('fast: ok file is silent, exit 0', () => {
  const root = makeFixture();
  const r = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'ok.js' }, cwd: root });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  rm(root);
});

test('fast: broken js → exit 2 with SyntaxError on stderr', () => {
  const root = makeFixture();
  const r = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'broken.js' }, cwd: root });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /SyntaxError/);
  rm(root);
});

test('fast: broken json → exit 2, named check', () => {
  const root = makeFixture();
  const r = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'broken.json' }, cwd: root });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /json: broken\.json/);
  rm(root);
});

test('fast: html inline script checked, src= skipped', () => {
  const root = makeFixture();
  const bad = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'broken.html' }, cwd: root });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /html <script>#1/);
  const good = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'good.html' }, cwd: root });
  assert.equal(good.status, 0);
  assert.equal(good.stdout, '');
  rm(root);
});

test('fast: broken json feedback is localized (ru)', () => {
  const root = makeFixture({ lang: 'ru' });
  const r = run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'broken.js' }, cwd: root });
  assert.match(r.stderr, /Ревизор \(fast\): провалено 1/);
  rm(root);
});

test('stop: failing tests → strict JSON {decision,reason} + fix hint', () => {
  const root = makeFixture();
  run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'ok.js' }, cwd: root });
  const r = run('stop-check.js', { cwd: root, stop_hook_active: false });
  assert.equal(r.status, 0);
  const o = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(o).sort(), ['decision', 'reason']);
  assert.equal(o.decision, 'block');
  assert.match(o.reason, /Revizor \(test\)/);
  assert.match(o.reason, /Fix the failures/);
  rm(root);
});

test('stop: green tests → {continue:true, systemMessage} note', () => {
  const root = makeFixture({ pkgTest: 'node oktest.js' });
  run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'ok.js' }, cwd: root });
  const r = run('stop-check.js', { cwd: root, stop_hook_active: false });
  const o = JSON.parse(r.stdout);
  assert.equal(o.continue, true);
  assert.match(o.systemMessage, /tests are green/);
  rm(root);
});

test('stop: localized green note (ru)', () => {
  const root = makeFixture({ lang: 'ru', pkgTest: 'node oktest.js' });
  run('fast-check.js', { tool_name: 'Write', tool_input: { file_path: 'ok.js' }, cwd: root });
  const r = run('stop-check.js', { cwd: root, stop_hook_active: false });
  const o = JSON.parse(r.stdout);
  assert.match(o.systemMessage, /тесты зелёные/);
  rm(root);
});

test('stop: stop_hook_active or no changes → silent', () => {
  const root = makeFixture();
  const a = run('stop-check.js', { cwd: root, stop_hook_active: true });
  assert.equal(a.stdout, '');
  const b = run('stop-check.js', { cwd: root, stop_hook_active: false });
  assert.equal(b.stdout, ''); // nothing changed since the last run
  rm(root);
});

test('auto-boot: off → silent; on → SessionStart context + pluginRoot stamp', () => {
  const root = makeFixture();
  const off = run('auto-boot.js', { cwd: root, source: 'startup' });
  assert.equal(off.stdout, '');
  fs.writeFileSync(path.join(root, '.revizor-auto'), '');
  const on = run('auto-boot.js', { cwd: root, source: 'startup' });
  const o = JSON.parse(on.stdout);
  assert.deepEqual(Object.keys(o), ['hookSpecificOutput']);
  assert.equal(o.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(o.hookSpecificOutput.additionalContext, /AUTO MODE/);
  const st = JSON.parse(fs.readFileSync(path.join(root, '.zcode', 'revizor-state.json'), 'utf8'));
  assert.ok(st.pluginRoot);
  assert.equal(st.pluginVersion, '0.5.0');
  rm(root);
});

test('guard: node_modules rejected, src allowed, guardAllow works', () => {
  const root = makeFixture();
  const nm = run('guard.js', { tool_name: 'Edit', tool_input: { file_path: path.join(root, 'node_modules', 'x.js') }, cwd: root });
  assert.equal(nm.status, 2);
  assert.match(nm.stderr, /guard/);
  const src = run('guard.js', { tool_name: 'Edit', tool_input: { file_path: 'src/y.js' }, cwd: root });
  assert.equal(src.status, 0);
  rm(root);

  const root2 = makeFixture({ extraConfig: { guardAllow: ['node_modules'] } });
  const allowed = run('guard.js', { tool_name: 'Edit', tool_input: { file_path: path.join(root2, 'node_modules', 'x.js') }, cwd: root2 });
  assert.equal(allowed.status, 0);
  rm(root2);
});

test('failure brain: silent once, nudges from the second failure', () => {
  const root = makeFixture();
  const a = run('failure-note.js', { tool_input: { command: 'npm run build' }, cwd: root });
  assert.equal(a.stdout, '');
  const b = run('failure-note.js', { tool_input: { command: 'npm run build' }, cwd: root });
  const o = JSON.parse(b.stdout);
  assert.equal(o.hookSpecificOutput.hookEventName, 'PostToolUseFailure');
  assert.match(o.hookSpecificOutput.additionalContext, /failed 2 times/);
  rm(root);
});

test('dashboard: rich state renders sections, inline JSON parses, no NaN/undefined', () => {
  const root = makeFixture();
  fs.mkdirSync(path.join(root, '.zcode'), { recursive: true });
  const now = Date.now();
  fs.writeFileSync(
    path.join(root, '.zcode', 'revizor-state.json'),
    JSON.stringify({
      lastTest: { ts: now, ok: true, failures: [] },
      lastFast: { ts: now, ok: true, failures: [] },
      changedSinceTest: [],
      lastFailures: [],
      history: [
        { ts: new Date(now - 60000).toISOString(), consoleLogs: 9, todos: 3, dupes: 2, bigFiles: 1, testsOk: true },
        { ts: new Date(now).toISOString(), consoleLogs: 2, todos: 1, dupes: 0, bigFiles: 0, testsOk: true },
      ],
      lastAudit: { ts: now, p0: 0, p1: 1, p2: 3, p3: 2, total: 6 },
    })
  );
  const gen = spawnSync(process.execPath, [path.join(SCRIPTS, 'dashboard.js'), root], { encoding: 'utf8' });
  assert.match(gen.stdout, /REVIZOR_DASHBOARD=/);
  const htmlPath = gen.stdout.trim().split('=').slice(1).join('=');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /HEALTHY/);
  assert.match(html, /QUALITY METRICS TREND/);
  assert.match(html, /last: 6 findings \(P0: 0\)/);
  assert.match(html, /quality is improving/);
  assert.doesNotMatch(html, /NaN|undefined/);
  const m = html.match(/window\.REVIZOR_DATA=([\s\S]*?);<\/script>/);
  assert.ok(m);
  assert.equal(JSON.parse(m[1]).verdict, 'HEALTHY');
  rm(root);
});

test('dashboard: empty state page for a fresh project', () => {
  const root = makeFixture();
  const gen = spawnSync(process.execPath, [path.join(SCRIPTS, 'dashboard.js'), root], { encoding: 'utf8' });
  const htmlPath = gen.stdout.trim().split('=').slice(1).join('=');
  assert.match(fs.readFileSync(htmlPath, 'utf8'), /No checks yet/);
  rm(root);
});
