#!/usr/bin/env node
/* Curly codebase profiler — house style + precedent index.
 * Outputs JSON by default. Falls back gracefully on any failure.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { CWD, listFiles, loadConfig } from '../shared/utils.mjs';

function countIdKind(id) {
  if (/^[A-Z][a-zA-Z0-9]+$/.test(id) && id.length > 1) return 'pascal';
  if (/^[a-z][a-zA-Z0-9]*$/.test(id)) return 'camel';
  if (/^[a-z][a-z0-9_]*$/.test(id) && id.includes('_')) return 'snake';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(id)) return 'kebab';
  return 'other';
}

function namingConvention(files) {
  const counts = { camel: 0, snake: 0, pascal: 0, kebab: 0, other: 0 };
  const idRe = /[A-Za-z_$][\w$]*/g;
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    for (const m of src.matchAll(idRe)) counts[countIdKind(m[0])]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const scores = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total]));
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return { convention: best[0], confidence: Number(best[1].toFixed(3)), scores };
}

function readText(p) { try { return readFileSync(p, 'utf8'); } catch (e) { return null; } }

function importStyle(files) {
  let esm = 0, cjs = 0;
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    if (/^import\s/m.test(src) || /^export\s/m.test(src)) esm++;
    else if (/require\s*\(/m.test(src) || /module\.exports/m.test(src)) cjs++;
  }
  return esm >= cjs ? 'esm' : (cjs > 0 ? 'cjs' : 'none');
}

function asyncModel(files) {
  let aa = 0, pr = 0, cb = 0;
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    if (/\basync\b/.test(src) && /\bawait\b/.test(src)) aa++;
    else if (/\.then\s*\(|\.catch\s*\(|\bPromise\b/.test(src)) pr++;
    else if (/\bcallback\b|\bcb\b/.test(src)) cb++;
  }
  if (aa >= pr && aa >= cb) return 'async-await';
  if (pr >= cb) return 'promises';
  return 'callbacks';
}

function errorContract(files) {
  let thr = 0, ret = 0, res = 0;
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    if (/throw\s+new\s+/.test(src)) thr++;
    if (/return\s*[\(\[\{]?\s*(?:null|undefined|err|error)/i.test(src)) ret++;
    if (/\{\s*(?:ok|success|data|error|err)\s*:/.test(src)) res++;
  }
  if (thr >= ret && thr >= res) return 'throw';
  if (res > ret) return 'result-object';
  return 'return-error';
}

function tests(files) {
  let jest = 0, vitest = 0, mocha = 0, tap = 0;
  let testFiles = 0, specFiles = 0;
  const testDir = /(^|\/)(tests|test|__tests__|spec|__spec__)\//;
  for (const f of files) {
    const b = basename(f);
    if (/\.(test|spec)\.(js|ts)$/.test(b)) testFiles++;
    if (/\.spec\.(js|ts)$/.test(b)) specFiles++;
    const src = readText(f);
    if (!src) continue;
    if (/\bdescribe\s*\(|jest\b/.test(src)) jest++;
    else if (/\bvitest\b/.test(src)) vitest++;
    else if (/\bmocha\b/.test(src)) mocha++;
    else if (/\btap\b/.test(src)) tap++;
    if (testDir.test(f)) {
      if (f.includes('/spec/') || b.endsWith('.spec.')) specFiles++;
      else testFiles++;
    }
  }
  const fw = jest >= vitest && jest >= mocha && jest >= tap ? 'jest' :
             vitest >= mocha && vitest >= tap ? 'vitest' :
             mocha >= tap ? 'mocha' : (tap > 0 ? 'tap' : 'none');
  return { framework: fw, testFiles, specFiles, layout: testDir.test(files.join('/')) ? 'test-directory' : 'co-located' };
}

function patterns(files) {
  const p = { classes: 0, hooks: 0, hocs: 0, middleware: 0, factories: 0, services: 0, repositories: 0 };
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    if (/class\s+\w+/.test(src)) p.classes++;
    if (/use[A-Z]\w*/.test(src)) p.hooks++;
    if (/with[A-Z]\w*|HOC/.test(src)) p.hocs++;
    if (/middleware|req\s*,\s*res\s*,\s*next/.test(src)) p.middleware++;
    if (/create[A-Z]|export\s+(default\s+)?function\s+create/.test(src)) p.factories++;
    if (/Service/.test(basename(f))) p.services++;
    if (/Repository/.test(basename(f))) p.repositories++;
  }
  return p;
}

function precedentIndex(files) {
  const index = [];
  const fnRe = /(?:export\s+)?(?:async\s+)?(?:function\s+([\w$]+)|([\w$]+)\s*[:=]\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|\{))/g;
  for (const f of files) {
    const src = readText(f);
    if (!src) continue;
    for (const m of src.matchAll(fnRe)) {
      const name = m[1] || m[2];
      const paramStr = m[3] || '';
      const params = paramStr.split(',').filter(x => x.trim()).length;
      index.push({ file: f, name, params, language: f.endsWith('.py') ? 'py' : 'js' });
    }
  }
  return index.slice(0, 300);
}

function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const json = process.argv.includes('--json');
  const target = args[0] || CWD;
  const files = listFiles([target], { ignores: loadConfig().ignores });
  if (!files.length) {
    if (json) console.log(JSON.stringify({ error: 'no analysable files', target }));
    else console.error('curly profile: no analysable files found');
    return 1;
  }
  const report = {
    tool: 'profile', version: '3.0.0', target, files: files.length,
    language: files.filter(f => f.endsWith('.py')).length > 0 ? 'mixed' : 'js/ts',
    naming: namingConvention(files),
    importStyle: importStyle(files),
    asyncModel: asyncModel(files),
    errorContract: errorContract(files),
    tests: tests(files),
    patterns: patterns(files),
    precedents: precedentIndex(files)
  };
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`curly profile: ${target}`);
    console.log(`  files: ${files.length} (${report.language})`);
    console.log(`  naming: ${report.naming.convention} (confidence ${(report.naming.confidence * 100).toFixed(0)}%)`);
    console.log(`  imports: ${report.importStyle}`);
    console.log(`  async: ${report.asyncModel}`);
    console.log(`  errors: ${report.errorContract}`);
    console.log(`  tests: ${report.tests.framework} (${report.tests.testFiles} test files, ${report.tests.layout})`);
    const pat = Object.entries(report.patterns).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`);
    console.log(`  patterns: ${pat.length ? pat.join(', ') : 'none detected'}`);
    console.log(`  precedents: ${report.precedents.length}`);
  }
  return 0;
}

Promise.resolve(main()).then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
