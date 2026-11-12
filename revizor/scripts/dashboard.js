'use strict';
// Ревизор — CLI генератора дашборда: node dashboard.js <root> (по умолчанию cwd).
// Печатает REVIZOR_DASHBOARD=<путь> — команда /dashboard парсит этот вывод.

const path = require('path');
const dash = require('./dashboard-lib');

(async () => {
  const root = path.resolve(process.argv[2] || process.cwd());
  try {
    const out = dash.generateDashboard(root, path.resolve(__dirname, '..'));
    console.log('REVIZOR_DASHBOARD=' + out);
  } catch (e) {
    console.error('REVIZOR_DASH_FAIL: ' + ((e && e.message) || e));
  }
  process.exit(0);
})().catch(() => process.exit(0));
