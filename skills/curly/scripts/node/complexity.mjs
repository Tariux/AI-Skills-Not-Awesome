#!/usr/bin/env node
/* Curly JS/TS complexity engine (robust, fallback-safe, cached).
 *
 * Computes per-function cyclomatic, cognitive complexity, max nesting,
 * max loop depth (Big-O upper bound), LOC, params, and perf smells.
 *
 * Engines:
 *   - typescript: exact scope/resolution via TS compiler API (if installed)
 *   - lexical:    deterministic brace-matching parser (no deps), always available
 *
 * Usage:
 *   node complexity.mjs <file> [file ...]
 *   node complexity.mjs --changed [--base main]
 *   node complexity.mjs --budget cyclomatic=10,cognitive=15 --config curly.config.json
 *   node complexity.mjs --fail-on-budget --json
 *   CURLY_NO_CACHE=1 node complexity.mjs ...   # bypass disk cache
 *   CURLY_NO_TS=1 node complexity.mjs ...      # force lexical fallback
 */

import {
  readFileSync, statSync, readdirSync
} from 'node:fs';
import { execSync } from 'node:child_process';
import {
  resolve, extname, basename, sep
} from 'node:path';
import {
  CWD, CACHE_DIR, CONFIG_FILE, DEFAULT_BUDGET, SMELL_IDS,
  hashContent, readText, stat, listFiles, loadConfig, bigO,
  dedupeSmells, languageOf, tryRequire, loadTs, jsonResult
} from '../shared/utils.mjs';

const FS_IMPORT = await import('node:fs').catch(() => null);
const fsPromises = FS_IMPORT && FS_IMPORT.promises ? FS_IMPORT.promises : null;

function parseBudget(s) {
  const b = { ...DEFAULT_BUDGET };
  if (!s) return b;
  for (const part of s.split(',')) {
    const [k, v] = part.split('=');
    if (k && v !== undefined && Number.isFinite(Number(v))) b[k.trim()] = Number(v);
  }
  return b;
}

function gitChangedFiles(base) {
  try {
    const args = base ? ['git', 'diff', '--name-only', `${base}...HEAD`] : ['git', 'diff', '--name-only'];
    const out = execSync(args.join(' '), { cwd: CWD, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) { return []; }
}

function cacheKey(content) { return hashContent(content); }

async function cacheRead(key) {
  if (process.env.CURLY_NO_CACHE || !fsPromises) return null;
  try {
    const p = resolve(CACHE_DIR, `${key}.json`);
    const st = stat(p);
    if (!st) return null;
    const raw = readText(p);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

async function cacheWrite(key, data) {
  if (process.env.CURLY_NO_CACHE || !fsPromises) return;
  try {
    if (!stat(CACHE_DIR)) {
      try { await fsPromises.mkdir(CACHE_DIR, { recursive: true }); } catch (e) {}
    }
    const p = resolve(CACHE_DIR, `${key}.json`);
    await fsPromises.writeFile(p, JSON.stringify(data));
  } catch (e) {}
}

/* ------------------------------------------------------------------ */
/* Minimal robust JS parser: strips strings/comments/regex, then walks  */
/* tokens tracking braces to find function boundaries and metrics.      */
/* ------------------------------------------------------------------ */

function tokenise(src) {
  const toks = [];
  let i = 0, n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; i++;
      let esc = false;
      while (i < n) {
        const c = src[i++];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === q) break;
      }
      toks.push({ type: 'STR', val: 'STR', line: lineAt(i, src) });
      continue;
    }
    if (ch === '/' && i + 1 < n) {
      if (src[i + 1] === '/') {
        const start = i; i += 2;
        while (i < n && src[i] !== '\n') i++;
        toks.push({ type: 'COMMENT', val: src.slice(start, i), line: lineAt(start, src) });
        continue;
      }
      if (src[i + 1] === '*') {
        const start = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        toks.push({ type: 'COMMENT', val: src.slice(start, i), line: lineAt(start, src) });
        continue;
      }
      /* regex literal heuristic after (,=,:,[,! */
      const prev = toks.length ? toks[toks.length - 1].val : '';
      if (/[\(=,:[!]$/.test(prev)) {
        i++;
        while (i < n) {
          const c = src[i++];
          if (c === '\\') { i++; continue; }
          if (c === '/') break;
        }
        while (i < n && /[a-zA-Z]/.test(src[i])) i++;
        toks.push({ type: 'REGEX', val: 'REGEX', line: lineAt(i, src) });
        continue;
      }
    }
    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === ';' || ch === ',' || ch === ':' || ch === '?' || ch === '.') {
      toks.push({ type: 'PUNCT', val: ch, line: lineAt(i, src) }); i++; continue;
    }
    if (/\s/.test(ch)) { i++; continue; }
    if (/[\w$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      toks.push({ type: 'ID', val: src.slice(i, j), line: lineAt(i, src) }); i = j; continue;
    }
    i++;
  }
  return toks;

  function lineAt(pos, s) {
    let ln = 1;
    for (let k = 0; k < pos; k++) if (s[k] === '\n') ln++;
    return ln;
  }
}

function cognitiveWeight(kind, nesting) {
  return 1 + nesting; /* +1 for the construct, +1 per nesting level */
}

function analyseLexical(src, filePath) {
  const toks = tokenise(src);
  const lines = src.split('\n');
  const functions = [];
  const N = toks.length;
  let i = 0;

  const isBraceOpen = (t) => t.type === 'PUNCT' && t.val === '{';
  const isBraceClose = (t) => t.type === 'PUNCT' && t.val === '}';

  function matchingBrace(openIdx) {
    let depth = 0, j = openIdx;
    while (j < N) {
      if (isBraceOpen(toks[j])) depth++;
      else if (isBraceClose(toks[j])) { depth--; if (depth === 0) return j; }
      j++;
    }
    return -1;
  }

  /* After the closing `)` of params, find the opening `{` then its match. */
  function findBodyBraces(afterParamsIdx) {
    let j = afterParamsIdx;
    while (j < N && toks[j].val !== '{') j++;
    if (j >= N) return null;
    const open = j;
    const close = matchingBrace(open);
    if (close === -1) return null;
    return { open, close };
  }

  function lineOf(idx) { return toks[idx] ? toks[idx].line : 1; }

  function parseParamsBetween(startIdx, endIdx) {
    /* count top-level comma-separated params between startIdx(=() and endIdx(=)) */
    let depth = 0, count = 0, inParam = false;
    for (let k = startIdx + 1; k < endIdx; k++) {
      const t = toks[k];
      if (t.type === 'PUNCT') {
        if (t.val === '(' || t.val === '{' || t.val === '[') { depth++; inParam = true; }
        else if (t.val === ')' || t.val === '}' || t.val === ']') { depth--; if (depth < 0) depth = 0; }
        else if (t.val === ',' && depth === 0) { count++; inParam = false; }
        else inParam = true;
      } else {
        inParam = true;
      }
    }
    if (inParam && endIdx > startIdx + 1) count++;
    return count;
  }

  function isFuncStart(idx) {
    /* returns {name, paramsCount, bodyOpen} or null */
    const t = toks[idx];
    if (!t) return null;

    /* function name * ( ) { */
    if (t.val === 'function') {
      let j = idx + 1;
      let isGen = false;
      if (j < N && toks[j].val === '*') { isGen = true; j++; }
      let name = '(anonymous)';
      if (j < N && toks[j].type === 'ID') { name = toks[j].val; j++; }
      /* skip to ( */
      while (j < N && toks[j].val !== '(' && toks[j].val !== '{') j++;
      if (j < N && toks[j].val === '(') {
        let k = j + 1, depth = 1;
        while (k < N) {
          if (toks[k].val === '(') depth++;
          else if (toks[k].val === ')') { depth--; if (depth === 0) break; }
          k++;
        }
        const body = findBodyBraces(k + 1);
        if (!body) return null;
        return { name, params: parseParamsBetween(j, k), bodyOpen: body.open, bodyClose: body.close, start: idx };
      }
      return null;
    }

    /* const/let/var name = ( ) => { or = function ( ) { */
    if (t.val === 'const' || t.val === 'let' || t.val === 'var') {
      let j = idx + 1;
      if (j >= N || toks[j].type !== 'ID') return null;
      const name = toks[j].val; j++;
      /* skip to ( or function or => */
      while (j < N && toks[j].val !== '(' && toks[j].val !== '=' && toks[j].val !== ';' && toks[j].val !== '{') j++;
      if (j < N && toks[j].val === '(') {
        let k = j + 1, depth = 1;
        while (k < N) {
          if (toks[k].val === '(') depth++;
          else if (toks[k].val === ')') { depth--; if (depth === 0) break; }
          k++;
        }
        let arrow = false;
        let m = k + 1;
        while (m < N && toks[m].val !== '{' && toks[m].val !== ';') {
          if (toks[m].val === '=>') { arrow = true; break; }
          m++;
        }
        const body = arrow ? findBodyBraces(m) : findBodyBraces(k + 1);
        if (!body) return null;
        return { name, params: parseParamsBetween(j, k), bodyOpen: body.open, bodyClose: body.close, start: idx };
      }
      if (j < N && toks[j].val === '=') {
        j++;
        while (j < N && toks[j].val !== '(' && toks[j].val !== '{' && toks[j].val !== ';') j++;
        if (j < N && toks[j].val === 'function') {
          let k = j + 1;
          let isGen = false;
          if (k < N && toks[k].val === '*') { isGen = true; k++; }
          while (k < N && toks[k].val !== '(') k++;
          if (k < N && toks[k].val === '(') {
            let p = k + 1, depth = 1;
            while (p < N) {
              if (toks[p].val === '(') depth++;
              else if (toks[p].val === ')') { depth--; if (depth === 0) break; }
              p++;
            }
            const body = findBodyBraces(p + 1);
            if (!body) return null;
            return { name, params: parseParamsBetween(k, p), bodyOpen: body.open, bodyClose: body.close, start: idx };
          }
        }
      }
      return null;
    }

    /* method shorthand: name ( ) { or name: function ( ) { */
    if (t.type === 'ID') {
      let j = idx + 1;
      if (j < N && toks[j].val === '.') { /* obj.method = ... handled above */ return null; }
      if (j < N && toks[j].val === '(') {
        let k = j + 1, depth = 1;
        while (k < N) {
          if (toks[k].val === '(') depth++;
          else if (toks[k].val === ')') { depth--; if (depth === 0) break; }
          k++;
        }
        /* after ), look for { or => or = function */
        let m = k + 1;
        while (m < N && toks[m].val !== '{' && toks[m].val !== ';' && toks[m].val !== '=') m++;
        let body = null, arrow = false;
        if (m < N && toks[m].val === '{') body = findBodyBraces(m);
        else if (m < N && toks[m].val === '=>') { arrow = true; body = findBodyBraces(m); }
        else if (m < N && toks[m].val === '=') {
          m++;
          while (m < N && toks[m].val !== '(' && toks[m].val !== '{') m++;
          if (m < N && toks[m].val === 'function') {
            let p = m + 1;
            if (p < N && toks[p].val === '*') p++;
            while (p < N && toks[p].val !== '(') p++;
            if (p < N && toks[p].val === '(') {
              let q = p + 1, d = 0;
              while (q < N) { if (toks[q].val === '(') d++; else if (toks[q].val === ')') { d--; if (d === 0) break; } q++; }
              body = findBodyBraces(q + 1);
            }
          }
        }
        if (!body) return null;
        return { name: t.val, params: parseParamsBetween(j, k), bodyOpen: body.open, bodyClose: body.close, start: idx, arrow };
      }
      if (j < N && toks[j].val === ':') {
        /* name: function (...) { */
        j++;
        while (j < N && toks[j].val !== 'function' && toks[j].val !== '{' && toks[j].val !== ';') j++;
        if (j < N && toks[j].val === 'function') {
          let k = j + 1;
          if (k < N && toks[k].val === '*') k++;
          while (k < N && toks[k].val !== '(') k++;
          if (k < N && toks[k].val === '(') {
            let p = k + 1, depth = 1;
            while (p < N) {
              if (toks[p].val === '(') depth++;
              else if (toks[p].val === ')') { depth--; if (depth === 0) break; }
              p++;
            }
            const body = findBodyBraces(p + 1);
            if (!body) return null;
            return { name: t.val, params: parseParamsBetween(k, p), bodyOpen: body.open, bodyClose: body.close, start: idx };
          }
        }
      }
      return null;
    }

    return null;
  }

  function measureBody(openIdx, closeIdx) {
    const bodyLines = [];
    let lineStart = lineOf(openIdx);
    for (let li = lineStart - 1; li < closeIdx && li < lines.length; li++) bodyLines.push(lines[li]);
    const bodySrc = bodyLines.join('\n');

    let cyclomatic = 1;
    let cognitive = 0;
    let maxNesting = 0, curNesting = 0;
    let maxLoopDepth = 0, curLoopDepth = 0;
    const loopStack = [];
    const smells = [];
    let loc = 0;

    for (const l of bodySrc.split('\n')) {
      const t = l.trim();
      if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) loc++;
    }

    /* walk tokens of body only */
    const bodyToks = toks.slice(openIdx + 1, closeIdx);
    let bi = 0, bn = bodyToks.length;
    while (bi < bn) {
      const t = bodyToks[bi];
      const v = t.val;
      if (v === 'if' || v === 'switch' || v === 'case' || v === 'catch' || v === '?' || v === '&&' || v === '||' || v === '??') {
        curNesting++; maxNesting = Math.max(maxNesting, curNesting);
        cyclomatic++;
        cognitive += cognitiveWeight('branch', curNesting);
      } else if (v === 'for' || v === 'while' || v === 'do') {
        curNesting++; curLoopDepth++;
        maxNesting = Math.max(maxNesting, curNesting);
        maxLoopDepth = Math.max(maxLoopDepth, curLoopDepth);
        loopStack.push(curLoopDepth);
        cyclomatic++;
        cognitive += cognitiveWeight('loop', curNesting);
      } else if (v === '}') {
        if (curLoopDepth > 0 && loopStack.length && loopStack[loopStack.length - 1] === curLoopDepth) {
          loopStack.pop(); curLoopDepth--;
        }
        if (curNesting > 0) curNesting--;
      }
      bi++;
    }

    /* smell detection on body source lines */
    const smellLines = detectSmells(bodySrc, lineStart);
    smells.push(...smellLines);

    return { loc, params: 0, cyclomatic, cognitive, maxNesting, maxLoopDepth, smells: dedupeSmells(smells) };
  }

  function detectSmells(src, lineBase) {
    const smells = [];
    const lines = src.split('\n');
    let inLoop = false, loopStack = 0;
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      const t = l.trim();
      const lineNo = lineBase + li;

      const isLoopStart = /\bfor\b.*\b(of|in)\b/.test(t) || /^\s*(for\s*\(|while\s*\(|do\s*{)/.test(t);
      if (isLoopStart) { inLoop = true; loopStack++; continue; }
      if (inLoop && /^\s*\}/.test(t)) { loopStack--; if (loopStack === 0) inLoop = false; continue; }
      if (!inLoop) continue;

      const sevWarn = 'warn', sevInfo = 'info';
      const push = (id, msg, sev) => smells.push({ id, line: lineNo, severity: sev, msg, confidence: 0.7 });

      if (/\bfor\b.*\b(of|in)\b/.test(t) || /^\s*(for\s*\(|while\s*\(|do\s*{)/.test(t)) {
        push('nested-loop', 'Nested iteration is O(n*m). Build a Map/Set index once outside the outer loop.', sevWarn);
      }
      if (/\.(includes|indexOf|find)\s*\(/.test(t)) {
        push('linear-search-in-loop', 'Linear search inside a loop is O(n*m). Build a Set/Map once, outside the loop.', sevWarn);
      }
      if (/\bawait\b/.test(t)) {
        push('await-in-loop', 'Sequential awaits in a loop. Batch with Promise.all if independent.', sevInfo);
      }
      if (/\b(console\.|fetch\(|fs\.|readFile|writeFile|query\(|execute\()/.test(t)) {
        push('io-in-loop', 'I/O inside a loop. Batch or move outside.', sevInfo);
      }
      if (/\[\s*\.\.\.\w+\s*,/.test(t) || /\{\s*\.\.\.\w+\s*,/.test(t)) {
        push('spread-accumulator', 'Copying the accumulator each iteration is O(n^2). Mutate one array/object instead.', sevWarn);
      }
      if (/\.concat\s*\(/.test(t) || (/=\s*\[.*\]\s*\+\s*\[/.test(t))) {
        push('list-concat-in-loop', 'List concat copies every iteration (O(n^2)). Use push/assign instead.', sevWarn);
      }
      if (/[\w$]+\s*\+\s*=\s*['"]/.test(t)) {
        push('string-concat-in-loop', 'String += in a loop. Collect parts and join once.', sevInfo);
      }
      if (/new\s+RegExp\s*\(/.test(t) || (/\/\S*\//.test(t) && !t.startsWith('//'))) {
        push('regex-compile-in-loop', 'Regex compiled each iteration. Hoist to a module constant.', sevInfo);
      }
    }
    return smells;
  }

  while (i < N) {
    const parsed = isFuncStart(i);
    if (parsed) {
      const m = measureBody(parsed.bodyOpen, parsed.bodyClose);
      const bodyText = toks.slice(parsed.bodyOpen + 1, parsed.bodyClose).map(x => x.val).join(' ');
      functions.push({
        name: parsed.name,
        file: filePath,
        line: lineOf(i),
        end: lineOf(parsed.bodyClose),
        loc: m.loc,
        params: parsed.params,
        cyclomatic: m.cyclomatic,
        cognitive: m.cognitive,
        maxNesting: m.maxNesting,
        maxLoopDepth: m.maxLoopDepth,
        bigO: bigO(m.maxLoopDepth),
        smells: m.smells,
        engine: 'lexical',
        language: languageOf(filePath)
      });
      i = parsed.bodyClose + 1;
      continue;
    }
    i++;
  }
  return functions;
}

/* ------------------------------------------------------------------ */
/* TypeScript compiler API engine                                     */
/* ------------------------------------------------------------------ */

function analyseWithTs(files) {
  const ts = loadTs();
  if (!ts) return null;
  const results = [];

  for (const f of files) {
    const src = readText(f);
    if (src === null) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    const fileFuncs = [];
    const lines = src.split('\n');

    function visit(node) {
      const kind = ts.SyntaxKind[node.kind];
      const isFunc = kind === 'FunctionDeclaration' || kind === 'MethodDeclaration' ||
                     kind === 'MethodSignature' || kind === 'FunctionExpression' ||
                     kind === 'ArrowFunction' || kind === 'GetterAccessor' ||
                     kind === 'SetterAccessors';
      if (isFunc) {
        const nameNode = node.name;
        const name = nameNode ? (nameNode.text || nameNode.getText(sf).slice(0, 60)) : '(anonymous)';
        const start = node.getStart(sf);
        const end = node.getEnd();
        const bodyNode = node.body;
        const bodyText = bodyNode ? bodyNode.getText(sf) : node.getText(sf);
        const m = measureBodyTS(bodyText, lines);
        const startLine = ts.getLineAndCharacterOfPosition(sf, start).line + 1;
        const endLine = ts.getLineAndCharacterOfPosition(sf, end).line + 1;
        const params = node.parameters ? node.parameters.length : 0;
        m.name = name; m.file = f; m.line = startLine; m.end = endLine;
        m.loc = m.loc || countLines(bodyText);
        m.params = params;
        m.engine = 'typescript';
        m.language = languageOf(f);
        m.smells = detectSmells(bodyText, startLine);
        fileFuncs.push(m);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    results.push({ path: f, language: languageOf(f), functions: fileFuncs, engine: 'typescript', fallback: false });
  }
  return results;

  function countLines(t) { return t.split('\n').length; }
  function measureBodyTS(bodyText, lines) {
    let cyclomatic = 1, cognitive = 0, maxNesting = 0, curNesting = 0;
    let maxLoopDepth = 0, curLoopDepth = 0;
    const loopStack = [];
    let loc = 0;
    for (const l of bodyText.split('\n')) {
      const t = l.trim();
      if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) loc++;
    }
    const toks = tokenise(bodyText);
    let bi = 0, bn = toks.length;
    while (bi < bn) {
      const v = toks[bi].val;
      if (v === 'if' || v === 'switch' || v === 'case' || v === 'catch' || v === '?' || v === '&&' || v === '||' || v === '??') {
        curNesting++; maxNesting = Math.max(maxNesting, curNesting);
        cyclomatic++; cognitive += cognitiveWeight('branch', curNesting);
      } else if (v === 'for' || v === 'while' || v === 'do') {
        curNesting++; curLoopDepth++;
        maxNesting = Math.max(maxNesting, curNesting);
        maxLoopDepth = Math.max(maxLoopDepth, curLoopDepth);
        loopStack.push(curLoopDepth);
        cyclomatic++; cognitive += cognitiveWeight('loop', curNesting);
      } else if (v === '}') {
        if (curLoopDepth > 0 && loopStack.length && loopStack[loopStack.length - 1] === curLoopDepth) { loopStack.pop(); curLoopDepth--; }
        if (curNesting > 0) curNesting--;
      }
      bi++;
    }
    return { loc, params: 0, cyclomatic, cognitive, maxNesting, maxLoopDepth, smells: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  let inputs = [], budget = { ...DEFAULT_BUDGET }, failOnBudget = false, changed = false;
  let baseRef = null, json = false, config = null;

  for (let a = 0; a < args.length; a++) {
    const arg = args[a];
    if (arg === '--changed') changed = true;
    else if (arg === '--base') baseRef = args[++a];
    else if (arg === '--budget') budget = parseBudget(args[++a]);
    else if (arg === '--config') { config = loadConfig(); budget = config.budgets; failOnBudget = config.failOnBudget || failOnBudget; }
    else if (arg === '--fail-on-budget') failOnBudget = true;
    else if (arg === '--fail-on-regression') failOnBudget = true;
    else if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') { printUsage(); return 0; }
    else inputs.push(arg);
  }
  if (!config) config = loadConfig();

  let files = inputs;
  if (changed) files = gitChangedFiles(baseRef);
  if (!files.length) {
    if (json) console.log(JSON.stringify(jsonResult('complexity', [], { budget, error: 'no input files' }), null, 2));
    else console.error('curly complexity: no input files found');
    return 1;
  }

  const useTs = !process.env.CURLY_NO_TS;
  let fileResults;
  let usedTs = false;

  if (useTs) {
    const tsRes = analyseWithTs(files);
    if (tsRes) { fileResults = tsRes; usedTs = true; }
    else {
      fileResults = await Promise.all(files.map(async (f) => {
        const key = cacheKey(readText(f) || '');
        const cached = await cacheRead(key);
        if (cached) return { ...cached, cached: true };
        const res = { path: f, language: languageOf(f), functions: analyseLexical(readText(f) || '', f), engine: 'lexical', fallback: true };
        await cacheWrite(key, res);
        return res;
      }));
    }
  } else {
    fileResults = await Promise.all(files.map(async (f) => {
      const key = cacheKey(readText(f) || '');
      const cached = await cacheRead(key);
      if (cached) return { ...cached, cached: true };
      const res = { path: f, language: languageOf(f), functions: analyseLexical(readText(f) || '', f), engine: 'lexical', fallback: true };
      await cacheWrite(key, res);
      return res;
    }));
  }

  /* compute overBudget + smellCount */
  let totalFuncs = 0, overBudget = 0, totalSmells = 0;
  for (const fr of fileResults) {
    let ob = 0, sc = 0;
    for (const fn of fr.functions) {
      totalFuncs++;
      sc += fn.smells.length;
      if (fn.cyclomatic > budget.cyclomatic || fn.cognitive > budget.cognitive ||
          fn.maxNesting > budget.nesting || fn.maxLoopDepth > budget.loopDepth ||
          fn.loc > budget.loc || fn.params > budget.params) ob++;
    }
    fr.overBudget = ob;
    fr.smellCount = sc;
    overBudget += ob;
    totalSmells += sc;
  }

  const out = jsonResult('complexity', fileResults, { budget });
  if (json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const engLabel = usedTs ? 'typescript@' + (tryRequire('typescript/package.json')?.version ?? '?.?') : 'lexical';
    console.log(`curly complexity: ${fileResults.length} file(s), ${totalFuncs} function(s); engine ${engLabel}${usedTs ? '' : ' (lexical fallback)'}`);
    for (const fr of fileResults) {
      console.log(`${fr.path}: ${fr.functions.length} function(s); smells=${fr.smellCount}; overBudget=${fr.overBudget}`);
      for (const fn of fr.functions) {
        const flag = (fn.cyclomatic > budget.cyclomatic || fn.cognitive > budget.cognitive ||
                      fn.maxNesting > budget.nesting || fn.maxLoopDepth > budget.loopDepth ||
                      fn.loc > budget.loc || fn.params > budget.params) ? ' OVER_BUDGET' : '';
        console.log(`  ${fn.line}:${fn.end} ${fn.name} cyc=${fn.cyclomatic} cog=${fn.cognitive} nest=${fn.maxNesting} loops=${fn.maxLoopDepth}(${fn.bigO}) loc=${fn.loc} params=${fn.params}${flag}`);
        for (const s of fn.smells) {
          const sev = s.severity.toUpperCase().padEnd(4);
          console.log(`    ${sev} ${s.id} @${s.line}: ${s.msg}`);
        }
      }
    }
    console.log(`\nbudget: cyclomatic<=${budget.cyclomatic} cognitive<=${budget.cognitive} nesting<=${budget.nesting} loopDepth<=${budget.loopDepth} loc<=${budget.loc} params<=${budget.params}`);
    console.log(`over budget: ${overBudget} function(s)`);
  }

  if (failOnBudget && overBudget > 0) return 1;
  return 0;
}

function printUsage() {
  console.log('Usage: node complexity.mjs <file> [file ...] [--changed] [--base ref] [--budget k=v,...] [--config file] [--fail-on-budget] [--fail-on-regression] [--json] [--help]');
}

main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
