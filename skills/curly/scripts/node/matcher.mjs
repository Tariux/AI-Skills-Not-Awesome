#!/usr/bin/env node
/* Curly closest-design matcher — AST fingerprinting + precedent ranking.
 * Falls back gracefully if no files parse.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { CWD, listFiles, loadConfig } from '../shared/utils.mjs';

function readText(p) { try { return readFileSync(p, 'utf8'); } catch (e) { return null; } }

function tokenise(src) {
  const toks = [];
  let i = 0, n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; i++; while (i < n) { const c = src[i++]; if (c === '\\') { i++; continue; } if (c === q) break; } toks.push('STR'); continue; }
    if (ch === '/' && i + 1 < n) {
      if (src[i + 1] === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
      if (src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    }
    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === ';' || ch === ',') { toks.push(ch); i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (/[\w$]/.test(ch)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; toks.push(src.slice(i, j)); i = j; continue; }
    i++;
  }
  return toks;
}

function fingerprint(src) {
  const toks = tokenise(src);
  let branches = 0, loops = 0, nesting = 0, maxNesting = 0, maxLoopDepth = 0, curLoop = 0;
  const hasAwait = /\bawait\b/.test(src);
  const hasMap = /\bMap\b/.test(src);
  const hasSet = /\bSet\b/.test(src);
  const hasPromiseAll = /\bPromise\.all\b/.test(src);
  const hasFetch = /\bfetch\b/.test(src);
  const hasTryCatch = /\btry\b/.test(src);
  const hasFilter = /\.filter\s*\(/.test(src);
  const hasFind = /\.find\s*\(/.test(src);
  const hasReduce = /\.reduce\s*\(/.test(src);
  const hasForEach = /\.forEach\s*\(/.test(src);

  let i = 0, n = toks.length;
  while (i < n) {
    const t = toks[i];
    if (t === 'if' || t === 'switch' || t === 'case' || t === 'catch' || t === '?' || t === '&&' || t === '||') { branches++; nesting++; maxNesting = Math.max(maxNesting, nesting); }
    else if (t === 'for' || t === 'while' || t === 'do') { loops++; curLoop++; maxLoopDepth = Math.max(maxLoopDepth, curLoop); nesting++; maxNesting = Math.max(maxNesting, nesting); }
    else if (t === '}') { if (curLoop > 0) curLoop--; if (nesting > 0) nesting--; }
    i++;
  }
  return { branches, loops, maxNesting, maxLoopDepth, hasAwait, hasMap, hasSet, hasPromiseAll, hasFetch, hasTryCatch, hasFilter, hasFind, hasReduce, hasForEach };
}

function shapeDistance(a, b) {
  const keys = ['branches', 'loops', 'maxNesting', 'maxLoopDepth'];
  let dist = 0;
  for (const k of keys) dist += Math.abs((a[k] || 0) - (b[k] || 0));
  const boolKeys = ['hasAwait', 'hasMap', 'hasSet', 'hasPromiseAll', 'hasFetch', 'hasTryCatch', 'hasFilter', 'hasFind', 'hasReduce', 'hasForEach'];
  for (const k of boolKeys) if ((a[k] || false) !== (b[k] || false)) dist += 1;
  return dist;
}

function intentKeywords(text) {
  const k = {};
  for (const kw of ['map','set','filter','find','reduce','foreach','await','promise.all','fetch','try','catch','loop','for','while','sort','search','index','lookup','aggregate','group','dedupe','merge','validate','transform','parse','serialize']) {
    if (text.includes(kw)) k[kw] = true;
  }
  return k;
}

function intentShape(intent, input) {
  const k = intentKeywords((intent + ' ' + input).toLowerCase());
  return {
    branches: (k.if || k.try || k.validate ? 1 : 0),
    loops: (k.loop || k.for || k.while || k.filter || k.find || k.reduce || k.foreach ? 1 : 0),
    maxNesting: (k.loop ? 1 : 0),
    maxLoopDepth: (k.loop && (k.filter || k.find) ? 2 : (k.loop ? 1 : 0)),
    hasAwait: !!k.await || !!k['promise.all'],
    hasMap: !!k.map,
    hasSet: !!k.set || !!k.index || !!k.lookup,
    hasPromiseAll: !!k['promise.all'],
    hasFetch: !!k.fetch,
    hasTryCatch: !!k.try,
    hasFilter: !!k.filter || !!k.search,
    hasFind: !!k.find || !!k.search,
    hasReduce: !!k.reduce || !!k.aggregate,
    hasForEach: !!k.foreach
  };
}

function main() {
  const args = process.argv.slice(2);
  let intent = '', input = '', scope = CWD, json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--intent') intent = args[++i];
    else if (a === '--input') input = args[++i];
    else if (a === '--scope') scope = resolve(CWD, args[++i]);
    else if (a === '--json') json = true;
  }
  if (!intent) {
    if (json) console.log(JSON.stringify({ error: '--intent required' }));
    else console.error('curly match: --intent is required');
    return 1;
  }
  const files = listFiles([scope], { ignores: loadConfig().ignores });
  const target = intentShape(intent, input);
  const precedents = [];
  for (const f of files) {
    try {
      const src = readText(f);
      if (!src) continue;
      const fp = fingerprint(src);
      const dist = shapeDistance(target, fp);
      const fit = Number(Math.max(0, 1 - dist / 20).toFixed(3));
      precedents.push({ file: f, fit, distance: dist, fingerprint: fp, language: f.endsWith('.py') ? 'py' : 'js' });
    } catch (e) {}
  }
  precedents.sort((a, b) => b.fit - a.fit || a.distance - b.distance);
  const top = precedents.slice(0, 10);

  const result = { tool: 'match', version: '3.0.0', intent, input, scope, target, total: precedents.length, top };
  if (json) { console.log(JSON.stringify(result, null, 2)); return 0; }

  console.log(`curly match: intent="${intent}" scope=${scope}`);
  console.log(`  candidates scanned: ${precedents.length}`);
  console.log(`  intent shape: branches=${target.branches} loops=${target.loops} depth=${target.maxLoopDepth} await=${target.hasAwait} map=${target.hasMap} set=${target.hasSet}`);
  if (!top.length) { console.log('  no precedents found'); return 0; }
  console.log('  top precedents:');
  for (const p of top) {
    const rec = p.fit >= 0.7 ? 'REUSE' : (p.fit >= 0.4 ? 'ADAPT' : 'NEW');
    console.log(`    ${p.file} fit=${p.fit.toFixed(3)} dist=${p.distance} -> ${rec} [${p.language}]`);
  }
  const best = top[0];
  console.log(`\n  recommendation: ${best.fit >= 0.7 ? 'Reuse ' + best.file : best.fit >= 0.4 ? 'Adapt ' + best.file : 'No close precedent; design new code'}`);
  return 0;
}

Promise.resolve(main()).then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
