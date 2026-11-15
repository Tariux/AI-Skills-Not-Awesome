# Design matcher (Curly)

## Purpose

Before writing new code, find the closest existing design in the repo and reuse or adapt it. Reuse beats new code; new code must match house style and beat the precedent on the real input size.

## Algorithm

1. **Profile** the repo: naming, import style, async model, error contract, test framework/layout.
2. **Fingerprint** every existing function/module: control-flow shape (branches, loops, max nesting, max loop depth), data-flow hints (Map/Set, await, Promise.all, fetch, filter/find/reduce).
3. **Shape the intent**: convert the user's description + example input into a target fingerprint (keywords → control-flow hints).
4. **Rank**: distance = |Δbranches| + |Δloops| + |ΔmaxNesting| + |ΔmaxLoopDepth| + mismatched boolean features. Fit = 1 − distance / maxDist (clamped 0..1).
5. **Recommend**:
   - fit ≥ 0.7 → REUSE the precedent as-is
   - fit ≥ 0.4 → ADAPT the precedent
   - fit < 0.4 → design new code, matched to house style

## Output

```
curly match: intent="dedupe customers by id" scope=./src
  candidates scanned: 47
  intent shape: branches=0 loops=1 depth=1 await=0 map=0 set=1
  top precedents:
    src/lib/seed.js fit=0.850 dist=2 -> REUSE [js]
    src/reports/merge.js fit=0.600 dist=5 -> ADAPT [js]
  recommendation: Reuse src/lib/seed.js
```

## Fallbacks

If the matcher errors or finds nothing, fall back to grep + reading, and list "Not checked" in the report.
