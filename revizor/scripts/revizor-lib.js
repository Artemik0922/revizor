'use strict';
// Ревизор — общая библиотека для hook-скриптов (fast-check.js / stop-check.js).
// Правило выживания: любая ошибка скрипта не должна ломать сессию агента,
// поэтому при любых сбоях — тихий выход с кодом 0.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const MAX_PENDING = 200; // сколько изменённых файлов держим в состоянии

// ---- i18n: все пользовательские сообщения плагина ----
const MESSAGES = {
  ru: {
    failHead: '🛡 Ревизор ({lane}): провалено {n}',
    timeout: 'таймаут после {ms} мс',
    noOutput: '(без вывода)',
    changedFiles: 'изменённые файлы: {list}',
    fixHint: 'Исправь ошибки и добейся зелёного прогона.',
    autoHint: 'АВТО-РЕЖИМ: исправь сам немедленно, без вопросов пользователю.',
    configError: '🛡 Ревизор: не удалось прочитать revizor.json',
    testsGreen: '🛡 Ревизор: тесты зелёные ({checks})',
    brainNote: '🛡 Ревизор: команда падает уже {n}-й раз в этой сессии. Не повторяй её как есть — поменяй подход: разбери вывод ошибки, проверь окружение/зависимости или разбей команду на шаги.',
    guardBlock: '🛡 Ревизор (guard): правка отклонена — «{rel}» лежит в служебной папке «{hit}/» (сгенерированный код). Правь исходники. Если эта папка в проекте не сгенерированная — добавь её в "guardAllow" в revizor.json.',
    htmlCheck: 'html <script>#{i}: {rel}',
    protocol: [
      '🛡 Revizor: АВТО-РЕЖИМ (auto mode) активен в этом проекте. Работай по протоколу:',
      '1. Сам прогоняй полосу test (из revizor.json, иначе npm test) после каждого осмысленного пакета правок — не жди команды.',
      '2. Любой feedback «🛡 Ревизор» исправляй немедленно, до отчёта о готовности.',
      '3. Найденные P0/P1 проблемы чини сразу; P2/P3 копи — в конце крупной задачи сам предложи /polish.',
      '4. Перед завершением крупной задачи прогони /ship и кратко укажи метрики.',
      '5. Поведение кода не менять без согласования с пользователем; стиль окружающего кода сохранять.',
      'Отключить: /revizor-auto off.',
    ].join('\n'),
    // дашборд
    d_pill_healthy: 'ЗДОРОВ', d_pill_attention: 'ВНИМАНИЕ', d_pill_idle: 'ОЖИДАНИЕ',
    d_pill_off: 'Ревизор выключен', d_auto_on: 'авто-режим: вкл', d_auto_off: 'авто-режим: выкл',
    d_project: 'проект', d_generated: 'сгенерировано',
    d_t_up: 'качество растёт', d_t_down: 'качество падает', d_t_flat: 'стагнация', d_t_few: 'мало данных',
    d_tile_pending: 'В ОЖИДАНИИ ТЕСТА', d_tile_brain: 'МОЗГ ОШИБОК',
    d_tile_ok: 'ок', d_tile_fail: 'провал', d_never: 'ещё не запускалась',
    d_all_checked: 'всё проверено', d_no_failures: 'падений нет', d_brain_cmds: 'команд с падениями: {n}',
    d_m_console: 'console.log', d_m_todos: 'TODO / FIXME', d_m_dupes: 'дубли', d_m_big: 'файлы > 500 строк',
    d_config: 'КОНФИГУРАЦИЯ', d_trend: 'ТРЕНД МЕТРИК КАЧЕСТВА',
    d_lane_fast: 'полоса fast', d_lane_test: 'полоса test', d_lane_quality: 'полоса quality', d_lane_ship: 'полоса ship',
    d_builtin_fast: 'встроенная (json/node --check/tsc)', d_auto_npm: 'авто: npm test', d_none: 'нет',
    d_on: 'вкл', d_off: 'выключен', d_guard_exc: 'вкл · исключения: {list}', d_audit: 'аудит',
    d_audit_last: 'последний: {total} находок (P0: {p0})', d_audit_never: 'не проводился',
    d_budget: 'sizeBudgetKb', d_budget_unset: 'не задан', d_switches: 'рубильники', d_switches_none: 'нет активных',
    d_last_fails: 'ПОСЛЕДНИЕ ПРОВАЛЫ', d_lane_prefix: 'полоса {lane}', d_no_fails: 'провалов нет',
    d_brain_top: 'МОЗГ ОШИБОК — ТОП КОМАНД',
    d_footer: 'обновляется автоматически после каждого прогона тестов · ручное обновление: /dashboard · ',
    d_spark_nodata: 'нет данных', d_check: 'проверка',
    d_empty_title: 'Проверок ещё не было',
    d_empty_p1: 'Дашборд наполняется автоматически: правь файлы — fast-полоса проверит их, Stop-хук прогонит тесты и перегенерирует эту страницу. Или запусти /audit в сессии агента.',
    d_ok: 'ок', d_fail: 'провал',
  },
  en: {
    failHead: '🛡 Revizor ({lane}): {n} check(s) failed',
    timeout: 'timed out after {ms} ms',
    noOutput: '(no output)',
    changedFiles: 'changed files: {list}',
    fixHint: 'Fix the failures and get the run green.',
    autoHint: 'AUTO MODE: fix it yourself immediately, without asking the user.',
    configError: '🛡 Revizor: failed to read revizor.json',
    testsGreen: '🛡 Revizor: tests are green ({checks})',
    brainNote: '🛡 Revizor: this command has failed {n} times in this session. Do not repeat it as-is — change the approach: inspect the error output, check the environment/dependencies, or split the command into steps.',
    guardBlock: '🛡 Revizor (guard): edit rejected — "{rel}" lives inside the "{hit}/" service folder (generated code). Edit the sources instead. If this folder is not generated in your project, add it to "guardAllow" in revizor.json.',
    htmlCheck: 'html <script>#{i}: {rel}',
    protocol: [
      '🛡 Revizor: AUTO MODE is enabled in this project. Follow the protocol:',
      '1. Run the test lane yourself (from revizor.json, otherwise npm test) after every meaningful batch of edits — do not wait for a command.',
      '2. Fix any "🛡 Revizor" feedback immediately, before reporting completion.',
      '3. Fix P0/P1 findings right away; collect P2/P3 and offer /polish at the end of a large task.',
      '4. Before finishing a large task, run /ship and briefly report the metrics.',
      '5. Never change code behavior without user approval; keep the surrounding code style.',
      'Disable: /revizor-auto off.',
    ].join('\n'),
    d_pill_healthy: 'HEALTHY', d_pill_attention: 'ATTENTION', d_pill_idle: 'IDLE',
    d_pill_off: 'Revizor is off', d_auto_on: 'auto mode: on', d_auto_off: 'auto mode: off',
    d_project: 'project', d_generated: 'generated',
    d_t_up: 'quality is improving', d_t_down: 'quality is degrading', d_t_flat: 'stagnant', d_t_few: 'not enough data',
    d_tile_pending: 'AWAITING TEST', d_tile_brain: 'ERROR BRAIN',
    d_tile_ok: 'ok', d_tile_fail: 'failed', d_never: 'never ran',
    d_all_checked: 'all checked', d_no_failures: 'no failures', d_brain_cmds: 'commands with failures: {n}',
    d_m_console: 'console.log', d_m_todos: 'TODO / FIXME', d_m_dupes: 'duplicates', d_m_big: 'files > 500 lines',
    d_config: 'CONFIGURATION', d_trend: 'QUALITY METRICS TREND',
    d_lane_fast: 'fast lane', d_lane_test: 'test lane', d_lane_quality: 'quality lane', d_lane_ship: 'ship lane',
    d_builtin_fast: 'built-in (json/node --check/tsc)', d_auto_npm: 'auto: npm test', d_none: 'none',
    d_on: 'on', d_off: 'off', d_guard_exc: 'on · exceptions: {list}', d_audit: 'audit',
    d_audit_last: 'last: {total} findings (P0: {p0})', d_audit_never: 'never run',
    d_budget: 'sizeBudgetKb', d_budget_unset: 'not set', d_switches: 'kill switches', d_switches_none: 'none active',
    d_last_fails: 'RECENT FAILURES', d_lane_prefix: 'lane {lane}', d_no_fails: 'no failures',
    d_brain_top: 'ERROR BRAIN — TOP COMMANDS',
    d_footer: 'regenerated automatically after each test run · manual refresh: /dashboard · ',
    d_spark_nodata: 'no data', d_check: 'check',
    d_empty_title: 'No checks yet',
    d_empty_p1: 'The dashboard fills in automatically: edit files and the fast lane will check them, the Stop hook will run the tests and regenerate this page. Or run /audit in an agent session.',
    d_ok: 'ok', d_fail: 'failed',
  },
};

// Язык: cfg.lang ('auto' по умолчанию) → локаль окружения → 'en'.
function resolveLang(cfg) {
  if (cfg && (cfg.lang === 'ru' || cfg.lang === 'en')) return cfg.lang;
  const env = [process.env.LC_ALL, process.env.LANGUAGE, process.env.LANG]
    .filter(Boolean)
    .join(',');
  return /ru/i.test(env) ? 'ru' : 'en';
}

function t(lang, key, vars) {
  let s = (MESSAGES[lang] && MESSAGES[lang][key]) || MESSAGES.en[key] || key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split('{' + k + '}').join(String(vars[k]));
    }
  }
  return s;
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Feedback модели (Stop): строго {decision, reason} — схема вывода у ZCode
// строгая, лишние ключи (например suppressOutput) ломают валидацию.
function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// Feedback модели (PostToolUse/PreToolUse): exit-код 2 + stderr —
// паттерн официальных плагинов, JSON на этих событиях не используют.
function blockStderr(reason) {
  process.stderr.write(String(reason) + '\n');
  process.exit(2);
}

// Корень проекта: ближайший родитель с revizor.json / package.json / .git.
function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 30; i++) {
    if (
      fs.existsSync(path.join(dir, 'revizor.json')) ||
      fs.existsSync(path.join(dir, 'package.json')) ||
      fs.existsSync(path.join(dir, '.git'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
  return path.resolve(startDir);
}

// Конфиг проекта. Отсутствие revizor.json — норма (встроенные проверки).
function loadConfig(root) {
  const cfg = {
    off: { fast: false, test: false, quality: false, guard: false, brain: false },
    auto: false, // авто-режим (или файл .revizor-auto в корне)
    lang: 'auto', // 'auto' | 'ru' | 'en'
    fastDebounceMs: 8000,
    testDebounceMs: 15000,
    maxOutputChars: 4000,
    fast: null, // null → встроенные проверки по расширению файла
    test: null, // null → авто: npm test, если в package.json настоящий scripts.test
    quality: null, // без встроенных; гоняется только /audit и /polish
    ship: null,
    guardAllow: null, // ["dist"] — разрешённые служебные папки для guard-хука
  };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'revizor.json'), 'utf8'));
    if (raw && typeof raw === 'object') {
      Object.assign(cfg, raw);
      cfg.off = Object.assign(
        { fast: false, test: false, quality: false, guard: false, brain: false },
        (raw && raw.off) || {}
      );
    }
  } catch (e) {
    if (e.code !== 'ENOENT') cfg.configError = 'revizor.json: ' + e.message;
  }
  return cfg;
}

// Полоса: массив проверок; строка — сокращение для {run}.
// null/undefined → решает вызывающий (встроенные/авто); [] → полоса пуста.
function normalizeChecks(entries) {
  if (!Array.isArray(entries)) return null;
  const out = [];
  for (const e of entries) {
    if (typeof e === 'string') {
      if (e.trim()) out.push({ run: e, name: e });
      continue;
    }
    if (e && typeof e === 'object' && typeof e.run === 'string' && e.run.trim()) {
      const item = { run: e.run, name: e.name || e.run };
      if (typeof e.timeoutMs === 'number') item.timeoutMs = e.timeoutMs;
      if (typeof e.cwd === 'string') item.cwd = e.cwd;
      if (typeof e.match === 'string') item.match = e.match;
      out.push(item);
    }
  }
  return out;
}

function matchOk(reStr, rel) {
  if (!reStr) return true;
  try {
    return new RegExp(reStr).test(rel || '');
  } catch (e) {
    return false;
  }
}

function tail(s, n) {
  if (!s) return '';
  const t = String(s).replace(/\r/g, '');
  return t.length <= n ? t : '…' + t.slice(-n);
}

// Запуск одной проверки (shell, cwd — корень проекта или item.cwd).
function runCheck(item, root, lang) {
  lang = lang || 'en';
  const cwd = item.cwd ? path.resolve(root, item.cwd) : root;
  const timeoutMs = numOrDefault(item.timeoutMs, 120000);
  return new Promise((resolve) => {
    cp.exec(
      item.run,
      { cwd, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          resolve({ ok: false, name: item.name, output: tail(t(lang, 'timeout', { ms: timeoutMs }), 1500) });
        } else if (err) {
          resolve({ ok: false, name: item.name, output: tail(((stderr || '') + '\n' + (stdout || '')).trim(), 1500) });
        } else {
          resolve({ ok: true, name: item.name });
        }
      }
    );
  });
}

function statePath(root) {
  return path.join(root, '.zcode', 'revizor-state.json');
}

function loadState(root) {
  try {
    return JSON.parse(fs.readFileSync(statePath(root), 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveState(root, st) {
  try {
    fs.mkdirSync(path.join(root, '.zcode'), { recursive: true });
    st.updatedAt = new Date().toISOString();
    fs.writeFileSync(statePath(root), JSON.stringify(st, null, 2));
  } catch (e) {
    /* состояние некритично */
  }
}

function recordChange(st, rel) {
  if (!rel) return;
  const arr = Array.isArray(st.changedSinceTest) ? st.changedSinceTest.slice() : [];
  if (!arr.includes(rel)) arr.push(rel);
  st.changedSinceTest = arr.slice(-MAX_PENDING);
}

// Аварийный рубильник: переменная окружения или файл .revizor-off в корне.
function isKilledOff(root) {
  if (process.env.REVIZOR_OFF === '1') return true;
  try {
    return fs.existsSync(path.join(root, '.revizor-off'));
  } catch (e) {
    return false;
  }
}

// Авто-режим: файл .revizor-auto в корне или auto: true в revizor.json.
function autoOn(root, cfg) {
  try {
    if (fs.existsSync(path.join(root, '.revizor-auto'))) return true;
  } catch (e) {
    /* недоступна ФС — смотрим конфиг */
  }
  return !!(cfg && cfg.auto === true);
}

// История метрик для /trend: запись {ts, ...metrics}, храним последние 50.
function appendHistory(root, metrics) {
  const st = loadState(root);
  const hist = Array.isArray(st.history) ? st.history : [];
  hist.push(Object.assign({ ts: new Date().toISOString() }, metrics));
  st.history = hist.slice(-50);
  saveState(root, st);
}

// Число из конфига с дефолтом; 0 — легальное значение (trap нуля `||` обходим явно).
function numOrDefault(v, d) {
  return typeof v === 'number' && v >= 0 ? v : d;
}

function capReason(reason, max) {
  max = numOrDefault(max, 4000);
  return reason.length > max ? reason.slice(0, max) + '\n…(обрезано)' : reason;
}

function failReason(lane, failures, context, lang) {
  lang = lang || 'en';
  const parts = failures.map((f) => '— ' + f.name + '\n' + (f.output || t(lang, 'noOutput')));
  const head = t(lang, 'failHead', { lane, n: failures.length }) + (context ? ' — ' + context : '');
  return head + '\n\n' + parts.join('\n\n');
}

module.exports = {
  readStdinJson,
  block,
  blockStderr,
  findProjectRoot,
  loadConfig,
  normalizeChecks,
  matchOk,
  numOrDefault,
  tail,
  runCheck,
  loadState,
  saveState,
  recordChange,
  isKilledOff,
  autoOn,
  appendHistory,
  capReason,
  failReason,
  MESSAGES,
  resolveLang,
  t,
};
