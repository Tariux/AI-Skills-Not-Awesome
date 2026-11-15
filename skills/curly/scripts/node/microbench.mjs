#!/usr/bin/env node
/* Curly microbenchmark harness — command mode + module/function mode.
 * Statistical noise handling, equality check, forced GC, peak RSS.
 */
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const CWD = process.cwd();
const require = createRequire(import.meta.url);

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stddev(xs) { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); }
function median(xs) { const s = [...xs].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }
function p95(xs) { const s = [...xs].sort((a, b) => a - b); return s[Math.ceil(s.length * 0.95) - 1] || s[s.length - 1]; }
function nowUs() { return Number(process.hrtime.bigint() / 1000n); }
function peakRssMb() {
  try { const m = readFileSync('/proc/self/status', 'utf8').match(/VmHWM:\s+(\d+)/); if (m) return Number(m[1]) / 1024; } catch (e) {}
  return process.memoryUsage().heapTotal / 1024 / 1024;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { module: null, export: null, vsModule: null, vsExport: null, setup: null, runs: 9, checkEqual: false, gc: false, cmd: null, vs: null, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--module') o.module = args[++i];
    else if (a === '--export') o.export = args[++i];
    else if (a === '--vs-module') o.vsModule = args[++i];
    else if (a === '--vs-export') o.vsExport = args[++i];
    else if (a === '--setup') o.setup = args[++i];
    else if (a === '--runs') o.runs = Number(args[++i]);
    else if (a === '--check-equal') o.checkEqual = true;
    else if (a === '--gc') o.gc = true;
    else if (a === '--cmd') o.cmd = args[++i];
    else if (a === '--vs') o.vs = args[++i];
    else if (a === '--json') o.json = true;
  }
  return o;
}

function loadSetup(setupPath) {
  if (!setupPath) return null;
  try {
    const mod = require(resolve(CWD, setupPath));
    return typeof mod === 'function' ? mod : (mod.default || mod);
  } catch (e) { return null; }
}

function benchOne(mp, ex, setupFn, runs, gc) {
  const mod = require(resolve(CWD, mp));
  const fn = ex ? mod[ex] : (mod.default || mod);
  if (typeof fn !== 'function') throw new Error(`export "${ex}" not found in ${mp}`);
  const times = [];
  let firstResult, lastResult;
  for (let r = 0; r < runs; r++) {
    const args = setupFn ? setupFn() : [];
    const argList = Array.isArray(args) ? args : [args];
    const t0 = nowUs();
    let result;
    try { result = fn(...argList); } catch (e) { throw new Error(`bench failed: ${e.message}`); }
    times.push(nowUs() - t0);
    if (r === 0) firstResult = result;
    lastResult = result;
    if (gc && global.gc) global.gc();
  }
  return { times, firstResult, lastResult };
}

async function benchModule(o) {
  const setupFn = loadSetup(o.setup);
  const a = benchOne(o.module, o.export, setupFn, o.runs, o.gc);
  const b = benchOne(o.vsModule, o.vsExport, setupFn, o.runs, o.gc);
  const equal = a.firstResult !== undefined ? JSON.stringify(a.firstResult) === JSON.stringify(b.firstResult) : null;
  const medA = median(a.times), medB = median(b.times);
  const na = (stddev(a.times) / Math.max(medA, 1)) * 100;
  const nb = (stddev(b.times) / Math.max(medB, 1)) * 100;
  const pct = medA === 0 ? 0 : ((medA - medB) / medA) * 100;
  const ratio = medB === 0 ? 0 : medA / medB;
  const tol = Math.max(na, nb, 5);
  const verdict = Math.abs(pct) <= tol ? 'no significant change' : (pct > 0 ? `FASTER by ${pct.toFixed(1)}% (${ratio.toFixed(2)}x)` : `SLOWER by ${(-pct).toFixed(1)}% (${(1 / ratio).toFixed(2)}x)`);
  if (o.checkEqual && equal === false) {
    if (o.json) console.log(JSON.stringify({ ok: false, error: 'results differ', verdict, equal: false }));
    else console.error('curly microbench: results NOT equal across versions');
    return 1;
  }
  const fmt = (t) => t >= 1000 ? `${(t / 1000).toFixed(3)}ms` : `${t.toFixed(3)}us`;
  const labelA = `${o.module}:${o.export || 'default'}`;
  const labelB = `${o.vsModule}:${o.vsExport || 'default'}`;
  const res = { ok: true, verdict, equal, labelA, labelB, medA, medB, p95A: p95(a.times), p95B: p95(b.times), minA: Math.min(...a.times), minB: Math.min(...b.times), noiseA: na, noiseB: nb, pct, ratio, runs: o.runs };
  if (o.json) { console.log(JSON.stringify(res, null, 2)); return 0; }
  console.log(`${labelA}   median ${fmt(medA)} p95 ${fmt(res.p95A)} min ${fmt(res.minA)} noise +/-${na.toFixed(1)}% n=${o.runs} peakRSS ${peakRssMb().toFixed(2)}MiB`);
  console.log(`${labelB}   median ${fmt(medB)} p95 ${fmt(res.p95B)} min ${fmt(res.minB)} noise +/-${nb.toFixed(1)}% n=${o.runs} peakRSS ${peakRssMb().toFixed(2)}MiB`);
  console.log(`${labelA} -> ${labelB}: ${verdict}  ${equal === false ? '[results differ]' : equal === true ? '[results equal]' : ''}`);
  return 0;
}

function benchCmd(cmdA, cmdB, runs) {
  const runCmd = (cmd) => {
    const times = [];
    for (let r = 0; r < runs; r++) {
      const t0 = nowUs();
      execSync(cmd, { cwd: CWD, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      times.push(nowUs() - t0);
    }
    return times;
  };
  const tA = runCmd(cmdA);
  const tB = runCmd(cmdB);
  const medA = median(tA), medB = median(tB);
  const na = (stddev(tA) / Math.max(medA, 1)) * 100;
  const nb = (stddev(tB) / Math.max(medB, 1)) * 100;
  const pct = medA === 0 ? 0 : ((medA - medB) / medA) * 100;
  const ratio = medB === 0 ? 0 : medA / medB;
  const tol = Math.max(na, nb, 5);
  const verdict = Math.abs(pct) <= tol ? 'no significant change' : (pct > 0 ? `FASTER by ${pct.toFixed(1)}% (${ratio.toFixed(2)}x)` : `SLOWER by ${(-pct).toFixed(1)}% (${(1 / ratio).toFixed(2)}x)`);
  const fmt = (t) => t.toFixed(2) + 'ms';
  const res = { ok: true, verdict, cmdA, cmdB, medA, medB, p95A: p95(tA), p95B: p95(tB), minA: Math.min(...tA), minB: Math.min(...tB), noiseA: na, noiseB: nb, pct, ratio, runs };
  if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 2)); return 0; }
  console.log(`${cmdA}   median ${fmt(medA)} p95 ${fmt(res.p95A)} min ${fmt(res.minA)} noise +/-${na.toFixed(1)}% n=${runs} peakRSS ${peakRssMb().toFixed(2)}MiB`);
  console.log(`${cmdB}   median ${fmt(medB)} p95 ${fmt(res.p95B)} min ${fmt(res.minB)} noise +/-${nb.toFixed(1)}% n=${runs} peakRSS ${peakRssMb().toFixed(2)}MiB`);
  console.log(`${cmdA} -> ${cmdB}: ${verdict}  peak memory ${((peakRssMb() - peakRssMb()) / 1).toFixed(1)}%`);
  return 0;
}

async function main() {
  const o = parseArgs();
  if (o.cmd && o.vs) return benchCmd(o.cmd, o.vs, o.runs || 8);
  if (o.module && o.vsModule) return await benchModule(o);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: 'use --cmd/--vs or --module/--vs-module' }));
  else console.error('curly microbench: use --cmd/--vs or --module/--vs-module');
  return 1;
}

main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
