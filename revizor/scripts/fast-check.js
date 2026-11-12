'use strict';
// Revizor — PostToolUse hook (matcher: Edit|Write|MultiEdit).
// Fast check of the changed file: the "fast" lane from revizor.json or built-ins
// (json / node --check / tsc --noEmit / inline <script> of .html files).
// Failures are returned to the model as feedback (stderr + exit code 2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const lib = require('./revizor-lib');

async function checkJsonFile(item) {
  try {
    JSON.parse(fs.readFileSync(item.jsonFile, 'utf8'));
    return { ok: true, name: item.name };
  } catch (e) {
    return { ok: false, name: item.name, output: lib.tail(String(e.message), 1500) };
  }
}

async function checkNodeSyntax(item) {
  return new Promise((resolve) => {
    cp.execFile(
      process.execPath,
      ['--check', item.nodeCheck],
      { timeout: lib.numOrDefault(item.timeoutMs, 15000), windowsHide: true, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            ok: false,
            name: item.name,
            output: lib.tail(((stderr || '') + '\n' + (stdout || '')).trim(), 1500),
          });
        } else {
          resolve({ ok: true, name: item.name });
        }
      }
    );
  });
}

// Инлайн-скрипты .html (главный source vanilla-игр часто лежит именно там).
function extractInlineScripts(htmlSrc) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(htmlSrc))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (m[2] && m[2].trim()) out.push(m[2]);
  }
  return out;
}

async function checkHtmlInline(item, lang) {
  let src;
  try {
    src = fs.readFileSync(item.htmlFile, 'utf8');
  } catch (e) {
    return { ok: false, name: item.name, output: lib.tail(String(e.message), 1500) };
  }
  const blocks = extractInlineScripts(src);
  const results = [];
  for (let i = 0; i < blocks.length; i++) {
    const tmp = path.join(os.tmpdir(), 'revizor-html-' + process.pid + '-' + i + '.js');
    try {
      fs.writeFileSync(tmp, blocks[i]);
      const r = await checkNodeSyntax({ nodeCheck: tmp, name: lib.t(lang, 'htmlCheck', { i: i + 1, rel: item.rel }), timeoutMs: item.timeoutMs });
      results.push(r);
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) { /* temp cleanup is best-effort */ }
    }
  }
  return results;
}

function builtinChecks(absFile, rel, root) {
  const ext = path.extname(absFile).toLowerCase();
  if (ext === '.json') return [{ name: 'json: ' + rel, jsonFile: absFile }];
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return [{ name: 'node --check: ' + rel, nodeCheck: absFile }];
  }
  if (ext === '.html' || ext === '.htm') {
    return [{ name: 'html scripts: ' + rel, htmlFile: absFile, rel, timeoutMs: 30000 }];
  }
  if (ext === '.ts' || ext === '.tsx') {
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    if (fs.existsSync(tsc) && fs.existsSync(path.join(root, 'tsconfig.json'))) {
      return [
        {
          name: 'tsc --noEmit',
          run: 'node "' + tsc + '" --noEmit -p "' + root + '"',
          timeoutMs: 60000,
        },
      ];
    }
  }
  return [];
}

(async () => {
  const input = lib.readStdinJson();
  if (!input) process.exit(0);
  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) process.exit(0);

  const baseDir = input.cwd || process.cwd();
  const absFile = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(baseDir, filePath);

  const root = lib.findProjectRoot(path.dirname(absFile));
  const cfg = lib.loadConfig(root);
  const lang = lib.resolveLang(cfg);
  const st = lib.loadState(root);

  let rel = path.relative(root, absFile).replace(/\\/g, '/');
  if (rel.startsWith('..')) rel = null; // файл вне корня проекта — только фиксируем изменение

  lib.recordChange(st, rel || path.basename(absFile));

  const quiet = () => {
    lib.saveState(root, st);
    process.exit(0);
  };

  if (cfg.off.fast || lib.isKilledOff(root)) quiet();
  if (rel && /(^|\/)node_modules\//.test(rel)) quiet();

  if (cfg.configError) {
    st.lastFast = {
      ts: Date.now(),
      ok: false,
      failures: [{ name: 'конфиг revizor.json', output: cfg.configError }],
    };
    lib.saveState(root, st);
    lib.blockStderr(lib.t(lang, 'configError') + '\n' + cfg.configError);
  }

  const now = Date.now();
  const debounced = st.lastFastTs && now - st.lastFastTs < lib.numOrDefault(cfg.fastDebounceMs, 8000);
  st.lastFastTs = now;

  let results = [];
  if (!debounced) {
    let checks;
    if (cfg.fast != null) {
      checks = lib.normalizeChecks(cfg.fast) || [];
    } else {
      checks = builtinChecks(absFile, rel, root);
    }
    for (const c of checks) {
      if (!lib.matchOk(c.match, rel)) continue;
      if (c.jsonFile) results.push(await checkJsonFile(c));
      else if (c.nodeCheck) results.push(await checkNodeSyntax(c));
      else if (c.htmlFile) results.push(await checkHtmlInline(c, lang));
      else if (c.run) results.push(await lib.runCheck(c, root, lang));
    }
  }
  results = results.flat ? results.flat() : results;

  const failures = results.filter((r) => !r.ok);
  st.lastFast = {
    ts: now,
    ok: failures.length === 0,
    failures: failures.map((f) => ({ name: f.name, output: f.output })),
  };
  lib.saveState(root, st);

  if (failures.length) {
    lib.blockStderr(lib.capReason(lib.failReason('fast', failures, rel || '', lang), cfg.maxOutputChars));
  }
  process.exit(0);
})().catch(() => process.exit(0));
