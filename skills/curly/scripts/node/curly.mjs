#!/usr/bin/env node
/* Curly orchestrator — runs the full codebase-aware engineering workflow.
 *
 * Steps:
 *   0 size      - skip trivial tasks; anything else proceeds
 *   1 profile   - house style: naming, imports, async, errors, tests, patterns
 *   2 match     - closest existing design via AST fingerprinting
 *   3 choose    - Big-O approach decision helper (speed vs fit vs loc vs deps vs risk)
 *   4 implement - (manual, guided by profile+matcher+choose)
 *   5 complexity - per-function metrics + budgets + smells
 *   6 bench     - before/after microbenchmarks (performance tasks)
 *   7 report    - emit structured report
 *
 * Usage:
 *   node curly.mjs <path> [--intent "..."] [--ci] [--json] [--skip-steps profile,match]
 *   node curly.mjs --ci                           # CI mode: complexity + budget gate
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CWD, loadConfig, listFiles, DEFAULT_BUDGET } from '../shared/utils.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { path: CWD, intent: '', ci: false, json: false, skipSteps: [], changed: false, base: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--intent') o.intent = args[++i];
    else if (a === '--ci') o.ci = true;
    else if (a === '--json') o.json = true;
    else if (a === '--changed') o.changed = true;
    else if (a === '--base') o.base = args[++i];
    else if (a === '--skip-steps') o.skipSteps = args[++i].split(',').map(s => s.trim());
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else o.path = resolve(CWD, a);
  }
  return o;
}

function printUsage() {
  console.log('Usage: node curly.mjs <path> [--intent "..."] [--ci] [--json] [--changed] [--base ref] [--skip-steps a,b] [--help]');
}

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: CWD, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return { ok: true, out, code: 0 };
  } catch (e) {
    return { ok: false, out: String(e.stdout || e.stderr || e.message), code: e.status || 1 };
  }
}

async function main() {
  const o = parseArgs();
  const config = loadConfig();
  const report = {
    tool: 'curly', version: '3.0.0', path: o.path, intent: o.intent, ci: o.ci,
    steps: [], config, notChecked: [], errors: []
  };

  const log = (step, status, detail) => {
    report.steps.push({ step, status, detail, ts: new Date().toISOString() });
    if (!o.json) console.log(`[curly] ${step}: ${status} ${detail || ''}`);
  };

  /* Step 1: Profile */
  if (!o.skipSteps.includes('profile')) {
    const r = run(`node ${resolve(CWD, 'scripts/node/profile.mjs')} "${o.path}" --json`);
    if (r.ok) {
      try { report.profile = JSON.parse(r.out); log('profile', 'done', `${report.profile.files} files`); }
      catch (e) { report.errors.push('profile parse'); log('profile', 'error', e.message); }
    } else {
      report.errors.push('profile'); log('profile', 'failed', r.out.slice(0, 200));
      report.notChecked.push('house style (profile failed)');
    }
  }

  /* Step 2: Match */
  if (!o.skipSteps.includes('match') && o.intent) {
    const r = run(`node ${resolve(CWD, 'scripts/node/matcher.mjs')} --intent "${o.intent}" --scope "${o.path}" --json`);
    if (r.ok) {
      try { report.match = JSON.parse(r.out); log('match', 'done', `${report.match.total || 0} candidates`); }
      catch (e) { report.errors.push('match parse'); log('match', 'error', e.message); }
    } else {
      report.errors.push('match'); log('match', 'failed', r.out.slice(0, 200));
      report.notChecked.push('precedent reuse (matcher failed)');
    }
  }

  /* Step 3: Complexity (+ budget gate) */
  if (!o.skipSteps.includes('complexity')) {
    const changedFlag = o.changed ? '--changed' : '';
    const baseFlag = o.base ? `--base ${o.base}` : '';
    const failFlag = o.ci || config.failOnBudget ? '--fail-on-budget' : '';
    const r = run(`node ${resolve(CWD, 'scripts/node/complexity.mjs')} "${o.path}" ${changedFlag} ${baseFlag} --json ${failFlag}`);
    if (r.ok) {
      try {
        const j = JSON.parse(r.out);
        report.complexity = j.summary;
        report.files = j.files;
        log('complexity', 'done', `${j.summary.functions} functions, ${j.summary.overBudget} over budget`);
        if (j.summary.overBudget > 0) report.notChecked.push(`complexity budgets exceeded: ${j.summary.overBudget} functions`);
      } catch (e) { report.errors.push('complexity parse'); log('complexity', 'error', e.message); }
    } else {
      report.errors.push('complexity'); log('complexity', 'failed', r.out.slice(0, 200));
      report.notChecked.push('complexity metrics (engine failed)');
    }
  }

  /* Step 4: CI verdict */
  if (o.ci) {
    const over = report.complexity ? report.complexity.overBudget : 0;
    report.pass = over === 0 && report.errors.length === 0;
    log('ci', report.pass ? 'PASS' : 'FAIL', `overBudget=${over} errors=${report.errors.length}`);
  }

  /* Report */
  report.summary = {
    pass: report.pass ?? true,
    steps: report.steps.length,
    errors: report.errors.length,
    notChecked: report.notChecked.length
  };

  if (o.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`\n[curly] report: ${report.pass ? 'PASS' : 'FAIL'}`);
    if (report.notChecked.length) console.log(`  not checked: ${report.notChecked.join('; ')}`);
    if (report.errors.length) console.log(`  errors: ${report.errors.join('; ')}`);
  }

  return o.ci && !report.pass ? 1 : 0;
}

main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
