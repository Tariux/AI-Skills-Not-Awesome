#!/usr/bin/env node
/* Curly shared utilities (Node). Standard library only. */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname, basename, sep } from 'node:path';
import { createHash } from 'node:crypto';

export const CWD = process.cwd();
export const CURLY_DIR = '.curly';
export const CACHE_DIR = resolve(CWD, CURLY_DIR, 'cache');
export const CONFIG_FILE = 'curly.config.json';

export const DEFAULT_BUDGET = { cyclomatic: 10, cognitive: 15, nesting: 4, loopDepth: 2, loc: 60, params: 5 };

export const SMELL_IDS = [
  'nested-loop', 'linear-search-in-loop', 'io-in-loop', 'await-in-loop',
  'spread-accumulator', 'list-concat-in-loop', 'string-concat-in-loop', 'regex-compile-in-loop'
];

export function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function readText(p) {
  try { return readFileSync(p, 'utf8'); } catch (e) { return null; }
}

export function stat(p) {
  try { return statSync(p); } catch (e) { return null; }
}

export function listFiles(inputs, opts = {}) {
  const { ignores = [], extensions = ['.js','.jsx','.mjs','.cjs','.ts','.tsx','.mts','.cts','.py'] } = opts;
  const files = [];
  const seen = new Set();
  const ignoreRe = ignores.length ? new RegExp(ignores.map(i => i.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace('*', '.*')).join('|')) : null;

  const visit = (p) => {
    const st = stat(p);
    if (!st) return;
    if (!st.isDirectory()) {
      const ext = extname(p);
      if (!extensions.includes(ext)) return;
      const rel = relativePath(p);
      if (ignoreRe && ignoreRe.test(rel)) return;
      if (!seen.has(p)) { seen.add(p); files.push(p); }
      return;
    }
    try {
      for (const e of readdirSync(p, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        visit(resolve(p, e.name));
      }
    } catch (e) {}
  };

  const relativePath = (p) => {
    try { return sep === '\\' ? p.split('\\').slice(1).join('/') : p.slice(CWD.length + 1); } catch (e) { return p; }
  };

  for (const inp of inputs) visit(resolve(CWD, inp));
  return files;
}

export function loadConfig() {
  try {
    const raw = readText(resolve(CWD, CONFIG_FILE));
    if (!raw) return { budgets: DEFAULT_BUDGET, ignores: ['node_modules', '.curly', '.git', 'dist', 'build'] };
    const cfg = JSON.parse(raw);
    return {
      budgets: { ...DEFAULT_BUDGET, ...(cfg.budgets || {}) },
      ignores: cfg.ignores || ['node_modules', '.curly', '.git', 'dist', 'build'],
      failOnBudget: !!cfg.failOnBudget,
      failOnRegression: !!cfg.failOnRegression,
      minFit: cfg.minFit ?? 0.4,
      reuseFit: cfg.reuseFit ?? 0.7
    };
  } catch (e) {
    return { budgets: DEFAULT_BUDGET, ignores: ['node_modules', '.curly', '.git', 'dist', 'build'] };
  }
}

export function bigO(depth) {
  if (depth <= 1) return 'O(n)';
  if (depth === 2) return 'O(n^2)';
  if (depth === 3) return 'O(n^3)';
  return `O(n^${depth})`;
}

export function dedupeSmells(smells) {
  const out = [], seen = new Set();
  for (const s of smells) {
    const k = s.id + ':' + s.line;
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

export function languageOf(p) {
  const e = extname(p);
  if ('.ts.tsx.mts.cts'.includes('.' + e.slice(1))) return 'ts';
  if (e === '.py') return 'py';
  return 'js';
}

export function tryRequire(moduleName) {
  try { return require(moduleName); } catch (e) { return null; }
}

export async function gitChanged(base = null) {
  try {
    const { execSync } = await import('node:child_process');
    const args = ['git', 'diff', '--name-only'];
    if (base) args.push(`${base}...HEAD`);
    const out = execSync(args.join(' '), { cwd: CWD, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) { return []; }
}

export function loadTs() {
  return tryRequire('typescript');
}

export function jsonResult(tool, files, opts = {}) {
  const engines = [...new Set(files.map(f => f.engine))];
  const summary = {
    files: files.length,
    functions: files.reduce((a, f) => a + f.functions.length, 0),
    overBudget: files.reduce((a, f) => a + (f.overBudget || 0), 0),
    smells: files.reduce((a, f) => a + (f.smellCount || 0), 0),
    engines,
    budget: opts.budget || DEFAULT_BUDGET
  };
  return { tool, version: '3.0.0', ...opts, files, summary };
}
