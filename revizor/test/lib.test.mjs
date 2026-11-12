// Unit tests for the Revizor core library (node:test, zero dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import lib from '../scripts/revizor-lib.js';
import dash from '../scripts/dashboard-lib.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'revizor-lib-'));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('numOrDefault: zero is a legal value (no || trap)', () => {
  assert.equal(lib.numOrDefault(0, 8000), 0);
  assert.equal(lib.numOrDefault(5, 8000), 5);
  assert.equal(lib.numOrDefault(undefined, 8000), 8000);
  assert.equal(lib.numOrDefault(-1, 8000), 8000);
  assert.equal(lib.numOrDefault('x', 8000), 8000);
});

test('normalizeChecks: strings, objects, junk skipped, null preserved', () => {
  assert.equal(lib.normalizeChecks(null), null);
  assert.equal(lib.normalizeChecks(undefined), null);
  const out = lib.normalizeChecks([
    'npm test',
    { run: 'npx tsc', name: 'tsc', timeoutMs: 1000, match: '\\.ts$', cwd: 'tools' },
    '',
    null,
    { noRun: true },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { run: 'npm test', name: 'npm test' });
  assert.equal(out[1].name, 'tsc');
  assert.equal(out[1].timeoutMs, 1000);
});

test('matchOk: invalid regex never matches, empty matches everything', () => {
  assert.equal(lib.matchOk('', 'anything.js'), true);
  assert.equal(lib.matchOk(undefined, 'a.js'), true);
  assert.equal(lib.matchOk('\\.ts$', 'src/a.ts'), true);
  assert.equal(lib.matchOk('\\.ts$', 'src/a.js'), false);
  assert.equal(lib.matchOk('([', 'src/a.ts'), false); // broken regex
});

test('findProjectRoot: walks up to package.json', () => {
  const root = tmp();
  const deep = path.join(root, 'a', 'b', 'c');
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  assert.equal(lib.findProjectRoot(deep), path.resolve(root));
  rm(root);
});

test('findProjectRoot: revizor.json wins over deeper package.json', () => {
  const root = tmp();
  const sub = path.join(root, 'sub');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(root, 'revizor.json'), '{}');
  fs.writeFileSync(path.join(sub, 'package.json'), '{}');
  assert.equal(lib.findProjectRoot(sub), path.resolve(sub));
  rm(root);
});

test('loadConfig: defaults include lang auto and off flags', () => {
  const root = tmp();
  const cfg = lib.loadConfig(root);
  assert.equal(cfg.lang, 'auto');
  assert.equal(cfg.auto, false);
  assert.equal(cfg.fastDebounceMs, 8000);
  assert.deepEqual(cfg.off, { fast: false, test: false, quality: false, guard: false, brain: false });
  assert.equal(cfg.configError, undefined);
  rm(root);
});

test('loadConfig: broken json reports configError, missing is fine', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'revizor.json'), '{ oops');
  const cfg = lib.loadConfig(root);
  assert.match(cfg.configError, /revizor\.json/);
  rm(root);
});

test('state: save/load/recordChange with cap', () => {
  const root = tmp();
  lib.recordChange({}, 'a.js'); // no crash on empty state
  const st = {};
  for (let i = 0; i < 205; i++) lib.recordChange(st, 'f' + i + '.js');
  assert.equal(st.changedSinceTest.length, 200);
  lib.saveState(root, st);
  const loaded = lib.loadState(root);
  assert.equal(loaded.changedSinceTest.length, 200);
  assert.ok(loaded.updatedAt);
  rm(root);
});

test('appendHistory: capped at 50 entries', () => {
  const root = tmp();
  for (let i = 0; i < 52; i++) lib.appendHistory(root, { consoleLogs: i });
  const st = lib.loadState(root);
  assert.equal(st.history.length, 50);
  assert.equal(st.history[49].consoleLogs, 51);
  rm(root);
});

test('autoOn: file beats config, kill switches respected', () => {
  const root = tmp();
  assert.equal(lib.autoOn(root, { auto: false }), false);
  assert.equal(lib.autoOn(root, { auto: true }), true);
  fs.writeFileSync(path.join(root, '.revizor-auto'), '');
  assert.equal(lib.autoOn(root, { auto: false }), true);
  assert.equal(lib.isKilledOff(root), false); // .revizor-auto enables, it does not kill
  fs.rmSync(path.join(root, '.revizor-auto'));
  fs.writeFileSync(path.join(root, '.revizor-off'), '');
  assert.equal(lib.isKilledOff(root), true);
  fs.rmSync(path.join(root, '.revizor-off'));
  process.env.REVIZOR_OFF = '1';
  assert.equal(lib.isKilledOff(root), true);
  delete process.env.REVIZOR_OFF;
  assert.equal(lib.isKilledOff(root), false);
  rm(root);
});

test('resolveLang: explicit config wins, env ru locale detected', () => {
  assert.equal(lib.resolveLang({ lang: 'ru' }), 'ru');
  assert.equal(lib.resolveLang({ lang: 'en' }), 'en');
  const old = process.env.LANG;
  process.env.LANG = 'ru_RU.UTF-8';
  assert.equal(lib.resolveLang({}), 'ru');
  process.env.LANG = 'en_US.UTF-8';
  assert.equal(lib.resolveLang({}), 'en');
  if (old === undefined) delete process.env.LANG; else process.env.LANG = old;
});

test('t: vars substituted, en fallback exists for every ru key', () => {
  assert.equal(lib.t('en', 'timeout', { ms: 1000 }), 'timed out after 1000 ms');
  assert.equal(lib.t('ru', 'timeout', { ms: 1000 }), 'таймаут после 1000 мс');
  assert.equal(lib.t('de', 'timeout', { ms: 5 }), lib.t('en', 'timeout', { ms: 5 }));
  for (const key of Object.keys(lib.MESSAGES.ru)) {
    assert.ok(lib.MESSAGES.en[key] !== undefined, 'missing en key: ' + key);
  }
});

test('failReason: localized heads', () => {
  const f = [{ name: 'x', output: 'boom' }];
  assert.match(lib.failReason('fast', f, '', 'ru'), /Ревизор \(fast\): провалено 1/);
  assert.match(lib.failReason('fast', f, '', 'en'), /Revizor \(fast\): 1 check\(s\) failed/);
  assert.match(lib.failReason('test', [{ name: 'x', output: '' }], '', 'en'), /\(no output\)/);
});

test('capReason: truncates with a marker', () => {
  const out = lib.capReason('a'.repeat(5000), 100);
  assert.ok(out.length < 200);
  assert.match(out, /обрезано/);
});

test('sparkline: no NaN anywhere, single point draws a segment', () => {
  const empty = dash.sparkline([], '#fff');
  assert.match(empty, /<svg/);
  const single = dash.sparkline([7], '#f00');
  assert.match(single, /<path d="M5 [\d.]+ L\d+ [\d.]+"/); // flat segment
  assert.doesNotMatch(single, /NaN/);
  const multi = dash.sparkline([3, 1, 4, 1, 5], '#0f0');
  assert.doesNotMatch(multi, /NaN/);
  assert.match(multi, /opacity="0\.06"/);
  assert.match(multi, /<circle/);
});

test('trendVerdict: improving, degrading, stagnant, too few', () => {
  assert.equal(dash.trendVerdict([]).key, 'd_t_few');
  assert.equal(dash.trendVerdict([{ consoleLogs: 1 }]).key, 'd_t_few');
  const up = dash.trendVerdict([
    { consoleLogs: 10, todos: 5, dupes: 4, bigFiles: 2 },
    { consoleLogs: 2, todos: 1, dupes: 0, bigFiles: 0 },
  ]);
  assert.equal(up.key, 'd_t_up');
  assert.equal(up.ok, true);
  const down = dash.trendVerdict([
    { consoleLogs: 2, todos: 1, dupes: 0, bigFiles: 0 },
    { consoleLogs: 10, todos: 5, dupes: 4, bigFiles: 2 },
  ]);
  assert.equal(down.key, 'd_t_down');
  const flat = dash.trendVerdict([
    { consoleLogs: 5, todos: 3, dupes: 2, bigFiles: 1 },
    { consoleLogs: 5, todos: 3, dupes: 2, bigFiles: 1 },
  ]);
  assert.equal(flat.key, 'd_t_flat');
});
