'use strict';
// Revizor — dashboard generator: static HTML with inline state data.
// Zero dependencies, plain SVG, everything wrapped in try/catch — the generator
// never throws and never breaks the hook that calls it.

const fs = require('fs');
const path = require('path');
const lib = require('./revizor-lib');

const C = {
  ok: '#16a34a',
  warn: '#d97706',
  bad: '#dc2626',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  muted: '#a1a1aa',
};

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
};

// Sparkline: up to 30 points, min/max normalized. A single point renders as a
// flat segment (not a lonely dot).
function sparkline(values, color, w, h) {
  w = lib.numOrDefault(w, 240);
  h = lib.numOrDefault(h, 44);
  const vals = (Array.isArray(values) ? values : [])
    .slice(-30)
    .map((v) => (typeof v === 'number' && isFinite(v) ? v : 0));
  if (!vals.length) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><text x="4" y="' + (h / 2 + 4) + '" fill="' + C.muted + '" font-size="11">—</text></svg>';
  }
  const n = vals.length;
  const max = Math.max.apply(null, vals.concat([1]));
  const min = Math.min.apply(null, vals.concat([0]));
  const span = max - min || 1;
  let line;
  let dotX;
  if (n === 1) {
    const y = h - 6 - ((vals[0] - min) / span) * (h - 14);
    line = 'M5 ' + y.toFixed(1) + ' L' + (w - 5) + ' ' + y.toFixed(1);
    dotX = w - 5;
  } else {
    const step = (w - 10) / (n - 1);
    const pts = vals.map((v, i) => [5 + i * step, h - 6 - ((v - min) / span) * (h - 14)]);
    line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    const area = line + ' L' + last[0].toFixed(1) + ' ' + (h - 2) + ' L5 ' + (h - 2) + ' Z';
    line = { area, path: line, x: last[0], y: last[1] };
    dotX = null;
  }
  let svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
  if (dotX === null) {
    svg += '<path d="' + line.area + '" fill="' + color + '" opacity="0.06"/>';
  }
  svg += '<path d="' + (dotX === null ? line.path : line) + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>';
  if (dotX === null) {
    svg += '<circle cx="' + line.x.toFixed(1) + '" cy="' + line.y.toFixed(1) + '" r="2" fill="' + color + '"/>';
  } else {
    const y = h - 6 - ((vals[0] - min) / span) * (h - 14);
    svg += '<circle cx="' + dotX + '" cy="' + y.toFixed(1) + '" r="2" fill="' + color + '"/>';
  }
  svg += '</svg>';
  return svg;
}

// Trend verdict: compare the last point with the previous one per metric;
// for every metric "down is good".
function trendVerdict(history) {
  const hist = Array.isArray(history) ? history : [];
  if (hist.length < 2) return { key: 'd_t_few', ok: null };
  const keys = ['consoleLogs', 'todos', 'dupes', 'bigFiles'];
  let good = 0;
  let bad = 0;
  for (const k of keys) {
    const a = Number(hist[hist.length - 2][k] || 0);
    const b = Number(hist[hist.length - 1][k] || 0);
    if (b < a) good += 1;
    else if (b > a) bad += 1;
  }
  if (good > bad) return { key: 'd_t_up', ok: true };
  if (bad > good) return { key: 'd_t_down', ok: false };
  return { key: 'd_t_flat', ok: null };
}

function renderEmpty(root, version, L) {
  return (
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Revizor · dashboard</title><style>' + CSS + '</style></head><body>' +
    '<div class="wrap"><header><h1>Revizor' +
    (version ? ' <span class="ver">v' + esc(version) + '</span>' : '') +
    '</h1></header>' +
    '<div class="empty"><div class="empty-title">' + esc(L('d_empty_title')) + '</div>' +
    '<p>' + esc(L('d_empty_p1')) + '</p>' +
    '<p class="muted">project: <code>' + esc(root) + '</code></p></div>' +
    '</div></body></html>'
  );
}

const CSS =
  ':root{color-scheme:light}' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{background:#fafafa;color:#18181b;font:14px/1.5 Inter,system-ui,"Segoe UI",Arial,sans-serif;min-height:100vh}' +
  '.wrap{max-width:920px;margin:0 auto;padding:36px 24px 56px}' +
  'h1{font-size:17px;font-weight:600;letter-spacing:.1px}' +
  '.ver{font-size:11px;font-weight:400;color:#a1a1aa;vertical-align:1px}' +
  'header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}' +
  '.sub{color:#a1a1aa;font-size:12px;margin-bottom:22px}' +
  '.pill{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:500;color:#52525b}' +
  '.pill .dot{width:7px;height:7px;border-radius:50%;background:#a1a1aa}' +
  '.pill.ok{color:#16a34a}.pill.ok .dot{background:#16a34a}' +
  '.pill.bad{color:#dc2626}.pill.bad .dot{background:#dc2626}' +
  '.pill.warn{color:#d97706}.pill.warn .dot{background:#d97706}' +
  '.pill.idle{color:#a1a1aa}' +
  '.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:#e4e4e7;border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;margin-bottom:12px}' +
  '.tile{background:#fff;padding:12px 14px}' +
  '.tile .t{font-size:10.5px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px}' +
  '.tile .v{font-size:16px;font-weight:600;margin-top:3px}' +
  '.tile .s{font-size:11px;color:#a1a1aa;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.ok{color:#16a34a}.bad{color:#dc2626}.warn{color:#d97706}' +
  '.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin-bottom:12px}' +
  '.card{background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:14px 16px}' +
  '.card h2{font-size:10.5px;font-weight:500;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}' +
  '.spark{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:12px}' +
  '.spark .m{font-size:12px;color:#52525b}' +
  '.spark .n{font-size:14px;font-weight:600;margin-top:2px}' +
  '.verdict{margin-top:8px;font-size:12.5px;font-weight:500}' +
  'code,pre{font-family:"Cascadia Code",Consolas,monospace}' +
  'code{background:#f4f4f5;border-radius:4px;padding:1px 5px;font-size:11.5px;color:#3f3f46}' +
  '.failgroup{margin-bottom:12px}' +
  '.failgroup-title{font-size:11px;color:#dc2626;font-weight:500;margin-bottom:6px}' +
  '.fail{border-left:2px solid #fca5a5;padding:4px 12px;margin-bottom:6px}' +
  '.fail-name{font-size:12px;font-weight:600;word-break:break-all}' +
  'pre{font-size:11px;color:#71717a;white-space:pre-wrap;word-break:break-word;margin-top:4px;max-height:120px;overflow:auto}' +
  '.muted{color:#a1a1aa}' +
  '.table{width:100%;border-collapse:collapse;font-size:12.5px}' +
  '.table td{padding:5px 4px;border-bottom:1px solid #f1f1f3;vertical-align:top}' +
  '.table tr:last-child td{border-bottom:0}' +
  '.table td:first-child{color:#a1a1aa;width:38%}' +
  '.empty{background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:32px;text-align:center}' +
  '.empty-title{font-size:15px;font-weight:600;margin-bottom:8px}' +
  '.empty p{color:#52525b;font-size:13px;margin:6px 0}' +
  '.foot{margin-top:22px;color:#a1a1aa;font-size:11px}';

function generateDashboard(root, pluginRoot, lang) {
  root = path.resolve(root);
  const outPath = path.join(root, '.zcode', 'revizor-dashboard.html');

  let version = '';
  try {
    version = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.zcode-plugin', 'plugin.json'), 'utf8')).version || '';
  } catch (e) {
    /* version unavailable */
  }

  const st = lib.loadState(root);
  const cfg = lib.loadConfig(root);
  const L = lang ? (k, v) => lib.t(lang, k, v) : (k, v) => lib.t(lib.resolveLang(cfg), k, v);

  const hasAny =
    st && (st.lastFast || st.lastTest || (Array.isArray(st.history) && st.history.length));
  if (!hasAny) {
    fs.mkdirSync(path.join(root, '.zcode'), { recursive: true });
    fs.writeFileSync(outPath, renderEmpty(root, version, L));
    return outPath;
  }

  const auto = lib.autoOn(root, cfg);
  const killed = lib.isKilledOff(root);
  const testOk = st.lastTest ? st.lastTest.ok === true : null;
  const lastFailures = Array.isArray(st.lastFailures) ? st.lastFailures : [];
  const pending = Array.isArray(st.changedSinceTest) ? st.changedSinceTest : [];
  const hist = Array.isArray(st.history) ? st.history : [];
  const trend = trendVerdict(hist);
  const audit = st.lastAudit && typeof st.lastAudit === 'object' ? st.lastAudit : null;

  // Verdict: kill switch → failed tests or last failures → audit P0 → healthy/idle
  let pill;
  if (killed) pill = { label: L('d_pill_off'), cls: 'idle' };
  else if (testOk === false || lastFailures.length || (audit && Number(audit.p0) > 0)) {
    pill = { label: L('d_pill_attention'), cls: 'bad' };
  } else if (testOk === true) {
    pill = { label: L('d_pill_healthy'), cls: 'ok' };
  } else {
    pill = { label: L('d_pill_idle'), cls: 'idle' };
  }

  const brainMap = st.failures && typeof st.failures === 'object' ? st.failures : {};
  const brainTop = Object.keys(brainMap)
    .map((k) => ({ cmd: k, count: Number(brainMap[k] && brainMap[k].count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const metric = (label, color, key) => {
    const vals = hist.map((h) => Number(h[key] || 0));
    const cur = vals.length ? vals[vals.length - 1] : 0;
    return (
      '<div class="spark"><div><div class="m">' + esc(label) + '</div>' +
      '<div class="n">' + cur + '</div></div>' + sparkline(vals, color) + '</div>'
    );
  };

  const tile = (title, value, sub, cls) =>
    '<div class="tile"><div class="t">' + esc(title) + '</div>' +
    '<div class="v ' + (cls || '') + '">' + value + '</div>' +
    (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';

  const failList = (items, lane) => {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) return '';
    return (
      '<div class="failgroup"><div class="failgroup-title">' + esc(L('d_lane_prefix', { lane })) + ' — ' + arr.length + '</div>' +
      arr
        .map(
          (f) =>
            '<div class="fail"><div class="fail-name">' + esc(f && f.name) + '</div>' +
            (f && f.output ? '<pre>' + esc(String(f.output).slice(-600)) + '</pre>' : '') +
            '</div>'
        )
        .join('') +
      '</div>'
    );
  };

  const failsHtml =
    failList(st.lastFast && st.lastFast.failures, 'fast') +
    failList(st.lastTest && st.lastTest.failures, 'test') +
    failList(lastFailures, L('d_check')) ||
    '<div class="muted">' + esc(L('d_no_fails')) + '</div>';

  const html =
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Revizor · ' + esc(path.basename(root)) + '</title><style>' + CSS + '</style></head><body>' +
    '<div class="wrap">' +
    '<header><h1>Revizor' + (version ? ' <span class="ver">v' + esc(version) + '</span>' : '') + '</h1>' +
    '<span class="pill ' + pill.cls + '"><span class="dot"></span>' + esc(pill.label) + '</span>' +
    '<span class="pill ' + (auto ? 'ok' : 'idle') + '"><span class="dot"></span>' + esc(auto ? L('d_auto_on') : L('d_auto_off')) + '</span>' +
    '</header>' +
    '<div class="sub">' + esc(L('d_project')) + ': <code>' + esc(path.basename(root)) + '</code> · ' + esc(L('d_generated')) + ' ' + esc(fmtTime(Date.now())) + ' · ' + esc(L(trend.key)) + '</div>' +

    '<div class="tiles">' +
    tile('FAST', st.lastFast ? (st.lastFast.ok ? esc(L('d_tile_ok')) : esc(L('d_tile_fail'))) : '—', st.lastFast ? fmtTime(st.lastFast.ts) : esc(L('d_never')), st.lastFast ? (st.lastFast.ok ? 'ok' : 'bad') : '') +
    tile('TEST', st.lastTest ? (st.lastTest.ok ? esc(L('d_tile_ok')) : esc(L('d_tile_fail'))) : '—', st.lastTest ? fmtTime(st.lastTest.ts) : esc(L('d_never')), st.lastTest ? (st.lastTest.ok ? 'ok' : 'bad') : '') +
    tile(esc(L('d_tile_pending')), String(pending.length), pending.length ? esc(pending.slice(-3).join(', ')) : esc(L('d_all_checked')), pending.length ? 'warn' : 'ok') +
    tile(esc(L('d_tile_brain')), String(brainTop.reduce((s, b) => s + b.count, 0)), brainTop.length ? esc(L('d_brain_cmds', { n: brainTop.length })) : esc(L('d_no_failures'))) +
    '</div>' +

    '<div class="grid2">' +
    '<div class="card"><h2>' + esc(L('d_trend')) + '</h2>' +
    metric(L('d_m_console'), C.indigo, 'consoleLogs') +
    metric(L('d_m_todos'), C.violet, 'todos') +
    metric(L('d_m_dupes'), C.warn, 'dupes') +
    metric(L('d_m_big'), C.bad, 'bigFiles') +
    '<div class="verdict ' + (trend.ok === true ? 'ok' : trend.ok === false ? 'bad' : 'muted') + '">' + esc(L(trend.key)) + '</div>' +
    '</div>' +
    '<div class="card"><h2>' + esc(L('d_config')) + '</h2><table class="table">' +
    '<tr><td>' + esc(L('d_lane_fast')) + '</td><td>' + esc(cfg.fast ? cfg.fast.length + ' шт' : L('d_builtin_fast')) + '</td></tr>' +
    '<tr><td>' + esc(L('d_lane_test')) + '</td><td>' + esc(cfg.test ? cfg.test.length + ' шт' : L('d_auto_npm')) + '</td></tr>' +
    '<tr><td>' + esc(L('d_lane_quality')) + '</td><td>' + esc(cfg.quality ? cfg.quality.length + ' шт' : L('d_none')) + '</td></tr>' +
    '<tr><td>' + esc(L('d_lane_ship')) + '</td><td>' + esc(cfg.ship ? cfg.ship.length + ' шт' : L('d_none')) + '</td></tr>' +
    '<tr><td>guard</td><td>' + (cfg.off.guard ? esc(L('d_off')) : esc(L('d_on')) + (Array.isArray(cfg.guardAllow) && cfg.guardAllow.length ? ' · ' + esc(L('d_guard_exc', { list: cfg.guardAllow.join(', ') })) : '')) + '</td></tr>' +
    '<tr><td>' + esc(L('d_audit')) + '</td><td>' + (audit ? esc(L('d_audit_last', { total: audit.total || 0, p0: audit.p0 || 0 })) : esc(L('d_audit_never'))) + '</td></tr>' +
    '<tr><td>' + esc(L('d_budget')) + '</td><td>' + (cfg.sizeBudgetKb ? esc(cfg.sizeBudgetKb) + ' KB' : esc(L('d_budget_unset'))) + '</td></tr>' +
    '<tr><td>' + esc(L('d_switches')) + '</td><td>' + (killed ? '<span class="bad">.revizor-off / REVIZOR_OFF</span>' : esc(L('d_switches_none'))) + '</td></tr>' +
    '</table></div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:12px"><h2>' + esc(L('d_last_fails')) + '</h2>' + failsHtml + '</div>' +

    (brainTop.length
      ? '<div class="card"><h2>' + esc(L('d_brain_top')) + '</h2><table class="table">' +
        brainTop
          .map((b) => '<tr><td><code>' + esc(b.cmd.slice(0, 70)) + '</code></td><td>' + b.count + '×</td></tr>')
          .join('') +
        '</table></div>'
      : '') +

    '<div class="foot">' + esc(L('d_footer')) + esc(outPath) + '</div>' +
    '</div>' +
    '<script>window.REVIZOR_DATA=' +
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      project: path.basename(root),
      verdict: pill.label,
      trend: L(trend.key),
      audit: audit || null,
      version: version,
    }).replace(/</g, '\\u003c') +
    ';</scr' + 'ipt></body></html>';

  fs.mkdirSync(path.join(root, '.zcode'), { recursive: true });
  fs.writeFileSync(outPath, html);
  return outPath;
}

module.exports = { generateDashboard, sparkline, trendVerdict };
