# Audit and review guide (Curly)

Use when auditing or reviewing a diff, branch, or whole repo instead of making a change.

## Process

1. **Profile** the repo (`scripts/node/profile.mjs`) to learn house style.
2. **Run complexity** on changed files (`scripts/node/complexity.mjs`, `scripts/python/complexity.py`) against budgets.
3. **Run matcher** to detect unreused precedents (reinvented wheels).
4. **Benchmark** performance claims (`bench.py` / `microbench.mjs`) with `--check-equal`.
5. **Delta** before/after (`scripts/python/delta.py`) to catch regressions.
6. **Check the seven properties** (rubric.md): edge cases, native style, efficiency at real n, safety, proven, small, honest.

## Review checklist

- [ ] Does the change reuse the closest precedent, or justify why not?
- [ ] Are all functions within complexity budgets?
- [ ] Are smells justified (small n / cold path) or fixed?
- [ ] Are there bench numbers for performance claims?
- [ ] Are tests added for edge cases?
- [ ] Is input validated at boundaries?
- [ ] Are secrets absent from code and logs?
- [ ] Is the report honest about what was / wasn't checked?

## Output format

Report sections: Decision, Correctness, Native, Efficiency, Safety, Tests, Not checked.
