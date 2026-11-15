---
name: "Curly"
slug: "curly"
version: "3.0.0"
description: "Codebase-aware engineering workflow: profile, match, choose, implement, prove. Finds the closest existing design, scores complexity, and benchmarks before/after."
author: "Tariux"
license: "MIT"
source: "local"
tags: ["performance", "complexity", "codebase-aware", "design-matching", "benchmarking", "solid-code", "nodejs", "python"]
category: "Developer Workflow"
compatibility: "universal"
mode: "system-prompt"
output_format: "structured-report"
runtimes: ["node>=18", "python>=3.9"]
---

# Curly

Solid code is correct, native to the repo it lives in, efficient for the input it will really see, and proven by evidence rather than by assertion. Curly makes that the default by replacing guesswork with measurement: scripts index the codebase, rank the closest existing designs, score complexity, and benchmark before/after. You read, decide and write; the scripts find and measure.

`$CURLY` below means this skill's base directory (`skills/curly/`). Scripts need Node 18+ and Python 3.9+, use only their standard libraries (plus the optional `typescript` package for exact JS/TS analysis), never touch the network, and write only to `<repo>/.curly/`, a runtime cache that is git-ignored. Every tool degrades gracefully: on failure it falls back to a simpler engine or to manual reading, and reports what could not be measured.

## Sub-skills (modules)

| Module | Purpose | Entry |
|--------|---------|-------|
| `curly` (orchestrator) | Full workflow runner: profile → match → complexity → report | `scripts/node/curly.mjs` |
| `profile` | Codebase profiler: naming, import style, async model, error contract, test layout, precedent index | `scripts/node/profile.mjs` |
| `match` | Closest-design finder: AST design fingerprinting and precedent ranking | `scripts/node/matcher.mjs` |
| `complexity` | Complexity engine: cyclomatic, cognitive, nesting, loop depth, Big-O bound, perf smells | `scripts/node/complexity.mjs`, `scripts/python/complexity.py` |
| `bench` | Before/after microbenchmark harness (command + function mode) | `scripts/node/microbench.mjs`, `scripts/python/bench.py` |
| `choose` | Big-O approach decision helper (speed vs fit vs loc vs deps vs risk vs space) | `scripts/python/choose.py` |
| `delta` | Before/after delta computation and regression gate | `scripts/python/delta.py` |
| `budget` | Complexity budget & regression gate (CI-friendly) | `scripts/node/budget.mjs` |
| `ast_index` | Python AST design-fingerprint indexer | `scripts/python/ast_index.py` |
| `audit` | Audit and review guide | `references/audit-review.md` |
| `rubric` | The seven properties of solid code | `references/rubric.md` |
| `playbook` | Performance playbook: Big-O, when to optimize, N+1, O(n^2) loops | `references/perf-playbook.md` |
| `ladder` | Six-rung approach ladder | `references/approach-ladder.md` |

## Step 0: Size the task

- **Trivial** (typo, rename, one-line fix, config value): skip the scripts. Still read the surrounding code and match it, then run the tests.
- **Anything else**: run the workflow below. Tooling failure never blocks the task: if a script errors, fall back to grep and reading, and list what you could not measure under "Not checked" in the report.
- **User asked for a review or audit instead of a change**: read `references/audit-review.md` and follow it.

## Step 1: Profile the repo

```
node $CURLY/scripts/node/profile.mjs <path-or-repo> --json
```

It emits: naming convention (camelCase/snake_case/PascalCase), import style (ESM/CJS/relative depth), async model (callbacks/promises/async-await), error contract (throw vs return error vs result object), test framework and layout, dominant patterns, and a precedent index of existing functions with signatures.

Match every new file/function to that profile. The profile is the tiebreaker when several designs are equally efficient.

## Step 2: Find the closest existing design

Before writing new code, run the matcher against the repo:

```
node $CURLY/scripts/node/matcher.mjs --intent "<what the new code does>" --input <example-input-shape> --json
```

It returns ranked precedents: existing functions/modules whose AST design fingerprint is closest to the intended behavior, with a fit score (0..1), location, and complexity. Reuse the top precedent when its fit >= 0.7 and its complexity is within budget; otherwise adapt it, and only then consider a new design. Document the reuse decision in the report.

## Step 3: Pick the most efficient approach for the real input size

Size the real input `n` and the hot-path budget, then run the chooser:

```
python3 $CURLY/scripts/python/choose.py decision.json
```

`decision.json` lists candidates with Big-O time/space, fit (precedent/convention match), loc, newDeps, risk. The score is a penalty (lower wins). Speed only counts while estimated runtime exceeds the budget: a candidate already within budget gets no credit for being faster, so "simple and fast enough" beats "complex but fast" on small inputs, and wins on large ones. Confirm close or hot-path choices with `bench.py` / `microbench.mjs`.

## Step 4: Implement in house style

Write the change using the profile's naming, import style, async model, error contract, and file placement. Reuse beats new code; deletion beats addition. Every line must be needed, tested and readable.

## Step 5: Score complexity and run budgets

Run the complexity engine over the changed files:

```
node $CURLY/scripts/node/complexity.mjs <changed-files> --json --fail-on-budget   # JS/TS
python3 $CURLY/scripts/python/complexity.py <changed-files> --json --fail-on-budget  # Python
```

Check against budgets (default: cyclomatic<=10, cognitive<=15, nesting<=4, loopDepth<=2, loc<=60, params<=5). A smell is a lead, not a verdict: it matters only when data is large or the path is hot (see `references/perf-playbook.md`).

## Step 6: Benchmark before/after (performance tasks only)

When performance was the point, measure before and after:

```
node $CURLY/scripts/node/microbench.mjs --module before.js --export fn --vs-module after.js --vs-export fn --setup args.mjs --runs 9 --check-equal
python3 $CURLY/scripts/python/bench.py --cmd "node before.js" --vs "node after.js" --runs 8
```

Require equal results and a statistically significant change outside noise. Report median, p95, min, noise %, and peak RSS.

## Step 7: Report

Produce the report with these sections:
- **Decision**: what was changed, which precedent was reused (or why none fit), which approach was chosen and why.
- **Correctness**: edge cases considered (empty, one item, duplicates, zero, negative, unicode, time zones, rounding, concurrency).
- **Native**: how the change matches house style (naming, imports, async, errors, placement, tests).
- **Efficiency**: Big-O for the real n, complexity numbers, benchmark numbers if applicable.
- **Safety**: input validation, secrets, parameterised queries, path confinement, guarded destructive ops.
- **Tests**: tests added/updated, pass/fail.
- **Not checked**: anything the scripts could not measure.

## Conventions

- Scripts are standard-library only; optional `typescript` upgrades JS/TS analysis from approximate to exact.
- Write cache only to `<repo>/.curly/`; add `.curly/` to `.gitignore`.
- Never commit secrets or log them.
- Exit non-zero on budget regression when `--fail-on-budget` or `--fail-on-regression` is set.
- All tools emit JSON with `--json` for CI consumption.
