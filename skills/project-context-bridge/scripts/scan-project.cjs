#!/usr/bin/env node
'use strict';

/**
 * Read-only project inventory helper for Project Context Bridge.
 * No dependencies. Writes the inventory to stdout and never writes to the target project.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const DEFAULTS = {
  budget: 4000,
  maxFiles: 350,
  maxDepth: 5,
  maxExcerptChars: 2200,
  maxExcerptFiles: 9,
};

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage', 'tmp', 'temp',
  '.next', '.nuxt', '.output', '.turbo', '.cache', '.parcel-cache', '.svelte-kit',
  '.venv', 'venv', '__pycache__', 'target', 'out', 'bin', 'obj', 'Pods',
  '.gradle', '.idea', '.pytest_cache', '.mypy_cache', '.ruff_cache',
]);

const SENSITIVE_FILE_RE = /(^|\/)(\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)|known_hosts|authorized_keys|.*\.(?:pem|key|p12|pfx|jks|keystore|kdbx))$/i;
const LOCK_FILE_RE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|composer\.lock|poetry\.lock|Pipfile\.lock|Cargo\.lock|Gemfile\.lock|go\.sum)$/i;
const BINARY_EXT_RE = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|bz2|xz|7z|rar|jar|class|dll|so|dylib|exe|bin|dat|db|sqlite|mp4|mov|mp3|wav|woff2?|ttf|otf|wasm|psd|ai|sketch|fig)$/i;
const SOURCE_EXT_RE = /\.(?:c|cc|cpp|h|hpp|cs|java|kt|kts|scala|go|rs|py|rb|php|js|jsx|mjs|cjs|ts|tsx|vue|svelte|swift|m|mm|ex|exs|erl|hrl|clj|cljs|cljc|hs|lhs|fs|fsx|vb|pl|pm|lua|sh|bash|zsh|ps1|sql|graphql|gql)$/i;

const DOC_NAMES = new Set([
  'readme', 'agents.md', 'claude.md', 'contributing.md', 'architecture.md',
  'design.md', 'overview.md', 'development.md', 'development-guide.md',
  'project.md', 'instructions.md', 'adr.md', 'api.md', 'events.md',
]);
const CONFIG_NAMES = new Set([
  'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts',
  'composer.json', 'gemfile', 'requirements.txt', 'pipfile', 'dockerfile',
  'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
  'makefile', 'tsconfig.json', 'deno.json', 'deno.jsonc', 'justfile',
  'pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'workspace.json',
]);

function printHelp() {
  process.stdout.write(`Project Context Bridge — read-only inventory helper\n\nUsage:\n  node scripts/scan-project.cjs [project-root] [options]\n\nOptions:\n  --task TEXT           Rank file paths/docs around a task description\n  --budget N            Approximate output budget in tokens (default ${DEFAULTS.budget})\n  --max-files N         Maximum number of file paths in inventory (default ${DEFAULTS.maxFiles})\n  --max-depth N         Maximum directory depth (default ${DEFAULTS.maxDepth})\n  --include-hidden      Include hidden paths except sensitive/ignored paths\n  --no-git              Omit git status summary (recommended for external sharing)\n  --help                Show this help\n\nThe script prints to stdout only; it does not create or modify project files.\nReview output before sharing it with an external service.\n`);
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS, task: '', includeHidden: false, noGit: false, root: process.cwd() };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--include-hidden') opts.includeHidden = true;
    else if (arg === '--no-git') opts.noGit = true;
    else if (arg === '--task') {
      if (!argv[i + 1]) throw new Error('--task requires a value.');
      opts.task = argv[++i];
    } else if (arg.startsWith('--task=')) opts.task = arg.slice('--task='.length);
    else if (['--budget', '--max-files', '--max-depth'].includes(arg)) {
      const name = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      const raw = argv[++i];
      const value = Number(raw);
      if (!raw || !Number.isInteger(value) || value < 1) throw new Error(`${arg} requires a positive integer.`);
      opts[name] = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else positional.push(arg);
  }
  if (positional.length > 1) throw new Error('Provide at most one project-root path.');
  if (positional[0]) opts.root = positional[0];
  opts.root = path.resolve(opts.root);
  return opts;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function safeRelative(root, absolute) {
  const relative = toPosix(path.relative(root, absolute)) || '.';
  return relative.replace(/^\.\//, '');
}

function isSensitive(rel) {
  const normalized = `/${rel.replace(/\\/g, '/')}`;
  const base = path.posix.basename(rel).toLowerCase();
  if (base === '.env.example' || base === '.env.sample' || base === '.env.template') return false;
  if (SENSITIVE_FILE_RE.test(normalized)) return true;
  if (/^(?:secret|credentials?)(?:[._-]|$)/i.test(base)) return true;
  return false;
}

function isSafeTextFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  const rel = filePath.replace(/\\/g, '/');
  if (isSensitive(rel)) return false;
  if (LOCK_FILE_RE.test(`/${rel}`)) return false;
  if (BINARY_EXT_RE.test(base)) return false;
  return true;
}

function tokenize(text) {
  const ignored = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'when', 'where', 'what', 'how', 'please', 'project', 'files', 'file', 'need', 'want', 'should', 'could', 'would']);
  return [...new Set((text.toLowerCase().match(/[a-z0-9_./-]{3,}/g) || []).filter((t) => !ignored.has(t)))].slice(0, 40);
}

function scorePath(rel, opts) {
  const lower = rel.toLowerCase();
  const base = path.posix.basename(lower);
  let score = 0;
  if (DOC_NAMES.has(base.replace(/\.(?:md|markdown|txt)$/, '')) || DOC_NAMES.has(base)) score += 12;
  if (CONFIG_NAMES.has(base)) score += 10;
  if (/\b(readme|agents|claude|architecture|adr|design|api|schema|contract)\b/.test(lower)) score += 4;
  if (/^(docs|documentation|architecture|adr|\.github|\.agents|\.claude|\.cursor)\//.test(lower)) score += 2;
  const terms = tokenize(opts.task);
  for (const term of terms) {
    if (lower.includes(term)) score += Math.min(7, term.length >= 7 ? 3 : 1);
  }
  if (LOCK_FILE_RE.test(`/${lower}`) || isSensitive(lower)) score = -100;
  return score;
}

function walk(root, opts) {
  const all = [];
  const problems = [];
  function visit(dir, depth) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      problems.push(`${safeRelative(root, dir)}: unable to read directory (${error.code || error.message})`);
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      if (!opts.includeHidden && entry.name.startsWith('.') && !['.github', '.agents', '.claude', '.cursor', '.vscode'].includes(entry.name)) {
        if (entry.isDirectory()) continue;
        if (!['.gitignore', '.dockerignore', '.editorconfig', '.npmignore', '.nvmrc', '.node-version'].includes(entry.name)) continue;
      }
      const absolute = path.join(dir, entry.name);
      const rel = safeRelative(root, absolute);
      if (isSensitive(rel)) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        if (depth >= opts.maxDepth) continue;
        visit(absolute, depth + 1);
      } else if (entry.isFile()) {
        if (isSafeTextFile(rel)) all.push({ absolute, rel, name: entry.name, depth, score: scorePath(rel, opts) });
      }
      if (all.length >= opts.maxFiles * 3) return;
    }
  }
  visit(root, 0);
  all.sort((a, b) => (b.score - a.score) || a.rel.localeCompare(b.rel));
  return { all, problems };
}

function readExcerpt(file, maxChars) {
  try {
    const stat = fs.statSync(file.absolute);
    if (stat.size > 2_000_000) return `[omitted: file is larger than 2 MB; inspect the relevant section directly]`;
    let content = fs.readFileSync(file.absolute, 'utf8');
    if (content.includes('\u0000')) return '[omitted: appears to be binary data]';
    content = content.split(/\r?\n/).map((line) => {
      if (/\b(password|passwd|secret|access[_-]?token|api[_-]?key|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/i.test(line)) {
        return line.replace(/([:=]\s*).+$/, '$1[REDACTED]');
      }
      return line;
    }).join('\n');
    if (content.length > maxChars) {
      const head = content.slice(0, Math.floor(maxChars * 0.78));
      const tail = content.slice(-Math.floor(maxChars * 0.12));
      content = `${head}\n\n... [middle omitted; file length ${stat.size} bytes] ...\n\n${tail}`;
    }
    return content.trim();
  } catch (error) {
    return `[omitted: unable to read (${error.code || error.message})]`;
  }
}

function getGitSummary(root) {
  try {
    const status = execFileSync('git', ['-C', root, 'status', '--short'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500,
    }).trim();
    if (!status) return 'Clean working tree (according to `git status --short`).';
    const lines = status.split(/\r?\n/).slice(0, 30);
    return `Working tree has ${status.split(/\r?\n/).length} changed/untracked path(s):\n${lines.map((line) => `- ${line}`).join('\n')}${status.split(/\r?\n/).length > 30 ? '\n- ... [remaining entries omitted]' : ''}`;
  } catch (_) {
    return 'Git status unavailable (not a Git repository, Git missing, or command timed out).';
  }
}

function chooseExcerpts(files, opts) {
  const candidates = files.filter((file) => {
    const base = file.name.toLowerCase();
    const docLike = /\.(?:md|markdown|rst|txt)$/i.test(base);
    const configLike = CONFIG_NAMES.has(base) || /^(?:\.gitignore|\.dockerignore|\.editorconfig|\.nvmrc|\.node-version)$/.test(base);
    return docLike || configLike || (SOURCE_EXT_RE.test(base) && opts.task && file.score >= 2);
  });
  candidates.sort((a, b) => (b.score - a.score) || a.rel.localeCompare(b.rel));
  const selected = [];
  const seen = new Set();
  for (const f of candidates) {
    if (selected.length >= opts.maxExcerptFiles) break;
    if (seen.has(f.rel) || isSensitive(f.rel) || LOCK_FILE_RE.test(`/${f.rel}`)) continue;
    if (SOURCE_EXT_RE.test(f.name) && !/\.(?:md|markdown|rst|txt)$/i.test(f.name) && (!opts.task || f.score < 2)) continue;
    selected.push(f);
    seen.add(f.rel);
  }
  return selected;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\nRun with --help for usage.\n`);
    process.exitCode = 2;
    return;
  }
  if (opts.help) return printHelp();
  if (!fs.existsSync(opts.root) || !fs.statSync(opts.root).isDirectory()) {
    process.stderr.write(`Error: project root is not a readable directory: ${opts.root}\n`);
    process.exitCode = 2;
    return;
  }

  const { all, problems } = walk(opts.root, opts);
  const listed = all.slice(0, opts.maxFiles).sort((a, b) => a.rel.localeCompare(b.rel));
  const excerpts = chooseExcerpts(all, opts);
  const charBudget = Math.max(2500, opts.budget * 4);
  let out = '';
  const add = (s) => { out += `${s}\n`; };
  add('# PROJECT INVENTORY (read-only helper output)');
  add('');
  add(`- Project root label: \`${path.basename(opts.root) || opts.root}\``);
  add(`- Operating system: ${os.platform()}`);
  add(`- Listed files: ${listed.length}${all.length > listed.length ? ` of at least ${all.length}` : ''}`);
  add(`- Task focus: ${opts.task ? opts.task : 'Not supplied; global context inventory'}`);
  add('- This is a heuristic inventory, not a verified architecture analysis. Review source files before trusting inferred behavior.');
  add('- Sensitive files and lockfiles are excluded; nevertheless review output before sharing externally.');
  add('');
  if (!opts.noGit) {
    add('## Git working-tree summary');
    add(getGitSummary(opts.root));
    add('');
  }
  add('## File tree');
  for (const file of listed) add(`- \`${file.rel}\`${file.score > 0 ? `  [priority ${file.score}]` : ''}`);
  if (all.length > listed.length) add(`- ... [truncated; ${all.length - listed.length} additional discovered paths not listed]`);
  if (problems.length) {
    add('');
    add('## Scan limitations');
    for (const problem of problems.slice(0, 15)) add(`- ${problem}`);
  }
  add('');
  add('## Selected file excerpts');
  add('Excerpts are truncated. Use them to identify what to inspect next; do not treat omissions as proof that a behavior is absent.');

  const fixedLength = out.length;
  let remainingChars = Math.max(0, charBudget - fixedLength - 1200);
  for (const file of excerpts) {
    if (remainingChars < 500) break;
    const allowance = Math.min(opts.maxExcerptChars, Math.floor(remainingChars / Math.max(1, Math.min(4, excerpts.length))));
    if (allowance < 250) break;
    const snippet = readExcerpt(file, allowance);
    const block = `\n### \`${file.rel}\`\n\n\`\`\`text\n${snippet}\n\`\`\``;
    if (out.length + block.length > charBudget) {
      const possible = Math.max(0, charBudget - out.length - 80);
      if (possible >= 250) out += `\n### \`${file.rel}\` (truncated to fit output budget)\n\n\`\`\`text\n${snippet.slice(0, possible)}\n\`\`\``;
      break;
    }
    out += `${block}\n`;
    remainingChars = charBudget - out.length;
  }

  if (!excerpts.length) {
    if (opts.task) {
      out += '\nNo candidate documentation/config files were selected. Inspect the file tree and request the exact source/docs required by the task.\n';
    } else {
      // Global mode: include top-ranked docs/config even without task
      const globalCandidates = all.filter(f => {
        const base = f.name.toLowerCase();
        return /\.(?:md|markdown|rst|txt)$/i.test(base) || CONFIG_NAMES.has(base);
      }).slice(0, Math.min(5, opts.maxExcerptFiles));
      if (globalCandidates.length) {
        out += '\n[Global mode: showing top documentation/config files]\n';
        for (const file of globalCandidates) {
          const snippet = readExcerpt(file, Math.floor(opts.maxExcerptChars / 2));
          out += `\n### \`${file.rel}\`\n\n\`\`\`text\n${snippet}\n\`\`\``;
        }
      } else {
        out += '\nNo documentation/config files found. Inspect the file tree and request the exact source/docs required.\n';
      }
    }
  }
  if (out.length > charBudget) out = `${out.slice(0, charBudget - 100)}\n\n[Output truncated to budget.]\n`;
  process.stdout.write(`${out.trim()}\n`);
}

main();