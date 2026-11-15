#!/usr/bin/env node
/* Curly complexity budget & regression gate. Reads JSON metrics and fails
 * when functions are over budget. CI-friendly.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CWD, DEFAULT_BUDGET } from '../shared/utils.mjs';

function parseBudget(s) { const b = { ...DEFAULT_BUDGET }; if (!s) return b; for (const p of s.split(',')) { const [k, v] = p.split('='); if (k && v) b[k.trim()] = Number(v); } return b; }

function gitChanged(base) {
  try {
    const args = base ? ['git', 'diff', '--name-only', `${base}...HEAD`] : ['git', 'diff', '--name-only'];
    const out = execSync(args.join(' '), { cwd: CWD, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) { return []; }
}

function main() {
  const args = process.argv.slice(2);
  let metricsFile = null, budget = { ...DEFAULT_BUDGET }, fail = false, changed = false, baseRef = null, json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--metrics') metricsFile = args[++i];
    else if (a === '--budget') budget = parseBudget(args[++a]);
    else if (a === '--fail-on-budget' || a === '--fail-on-regression') fail = true;
    else if (a === '--changed') changed = true;
    else if (a === '--base') baseRef = args[++i];
    else if (a === '--json') json = true;
  }

  let files = [];
  let overBudget = 0;

  if (changed) {
    files = gitChanged(baseRef);
  } else if (metricsFile) {
    try {
      const d = JSON.parse(readFileSync(metricsFile, 'utf8'));
      if (d.summary && typeof d.summary.overBudget === 'number') {
        overBudget = d.summary.overBudget;
      }
      if (d.budget) budget = d.budget; // read budget from metrics file
      files = d.files ? d.files.map(f => f.path) : (d.results ? d.results.map(f => f.path) : Object.keys(d));
    } catch (e) {
      if (json) console.log(JSON.stringify({ ok: false, error: 'cannot read metrics' }));
      else console.error('curly budget: cannot read metrics');
      return 1;
    }
  } else {
    if (json) console.log(JSON.stringify({ ok: false, error: '--metrics or --changed required' }));
    else console.error('curly budget: --metrics or --changed required');
    return 1;
  }

  const result = { tool: 'budget', version: '3.0.0', files: files.length, overBudget, budget, pass: overBudget === 0, details: [] };
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(`curly budget: ${files.length} file(s), overBudget=${overBudget}, ${overBudget === 0 ? 'PASS' : 'FAIL'}`);
  return fail && overBudget > 0 ? 1 : 0;
}

Promise.resolve(main()).then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });