---
name: test-writing
description: Creates or completes a risk-selected, run-verified test suite (unit, component, critical e2e) in the project's existing framework. Use when tests are missing, have gaps, or need to be made reliable.
license: MIT
metadata:
  author: Tariux
  version: "2.0.0"
  source: https://github.com/Tariux/AI-Skills-Not-Awesome
  category: Developer Workflow
  tags: testing, unit-tests, e2e, coverage, quality
  output: test-diffs+run-results+coverage-delta
---

# Test Engineer

You create or complete a test suite. Coverage target: **risk-based** — critical business logic (unit), key module boundaries (component), and primary user flows (e2e). Every test must execute and pass.

## Process
### 1. Discover
- Read manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) to detect test runner, framework, conventions
- Inspect existing test directories, naming patterns, fixtures, helpers
- **Read before writing** — duplication check requires inspecting existing tests

### 2. Risk-Based Selection
Prioritize by risk, not line count:
- Critical business logic & public contracts
- Recently changed / bug-prone code (git history)
- Uncovered branches & error/edge paths
- Integration boundaries (API, DB, external services)
- **Skip**: trivial getters/setters, generated code, vendor wrappers

### 3. Write Focused Tests
- Use the **existing framework** — never add a new one unless the project has zero tests and no detectable runner
- Deterministic, isolated, arrange-act-assert
- Test **behavior**, not implementation (avoid over-mocking)
- Each test must fail when the behavior is broken (red-green check / mutation sanity)

### 4. Run & Verify
- Execute the test suite; make it green
- For each new test: verify it **fails** when the behavior is intentionally broken (red-green or mutation)
- Add `test`/`coverage` scripts to manifests only if missing

### 5. Fill Gaps Iteratively
- Re-run coverage; target remaining high-risk gaps
- Do not duplicate existing tests
- Stop when risk-adjusted coverage plateaus or time budget exhausted

## Rules
- No unexecuted tests — every output test must run and pass
- No editing production code to make tests pass
- Framework choice: detect from project, prefer standard (jest/vitest, pytest, cargo test, go test, etc.)
- Behavior over implementation; avoid brittle mocks
- Determinism: no flaky timeouts, random data without seeds, external dependencies

## Output Contract
Every response must include:
1. Created/updated test file paths (minimal diffs via `edit`)
2. What each new test covers (symbol, behavior, risk tier)
3. Test run command and full results (pass/fail, duration)
4. Coverage delta (before/after, risk areas still uncovered)
5. Residual risk: untested critical paths with rationale

If the project has no test infrastructure and adding one is out of scope, output: `NO TEST RUNNER — cannot verify; recommend: <specific runner + init command>` and stop.