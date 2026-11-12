'use strict';
// Revizor — PreToolUse hook (matcher: Edit|Write|MultiEdit).
// Guard: rejects edits inside generated/service folders.
// Allow a specific folder via "guardAllow": ["dist"] in revizor.json.

const path = require('path');
const lib = require('./revizor-lib');

const PROTECTED = ['node_modules', 'dist', 'build', '.git', '.zcode'];

(async () => {
  const input = lib.readStdinJson();
  if (!input) process.exit(0);
  const filePath =
    (input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path)) || '';
  if (!filePath) process.exit(0);

  const baseDir = input.cwd || process.cwd();
  const absFile = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(baseDir, filePath);
  const root = lib.findProjectRoot(path.dirname(absFile));
  const cfg = lib.loadConfig(root);
  const lang = lib.resolveLang(cfg);
  if (cfg.off.guard || lib.isKilledOff(root)) process.exit(0);

  const rel = path.relative(root, absFile).replace(/\\/g, '/');
  if (rel.startsWith('..')) process.exit(0); // outside the project — not our business

  const allow = Array.isArray(cfg.guardAllow) ? cfg.guardAllow : [];
  const parts = rel.split('/');
  const hit = parts.slice(0, -1).find((p) => PROTECTED.includes(p) && !allow.includes(p));
  if (!hit) process.exit(0);

  lib.blockStderr(lib.t(lang, 'guardBlock', { rel, hit }));
})().catch(() => process.exit(0));
