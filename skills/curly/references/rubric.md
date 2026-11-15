# Rubric: what "solid" means in Curly

Use when deciding how much is enough, when reviewing your own diff, and when a complexity warning needs a judgment call.

## 1. The seven properties

A change is solid when all seven hold. Check them against the diff, not intentions.

1. **Correct on the edges.** Empty input, one item, duplicates, zero, negative, last item, unicode, time zones, rounding, concurrent callers. Name the edge cases considered.
2. **Native.** A maintainer cannot tell it was written by someone new: same naming, error contract, async model, import style, file placement, test layout. House style is the tiebreaker.
3. **Efficient at the real n.** Complexity matches the realistic input size and path (see perf-playbook.md). Not faster than needed, not slower than the data allows.
4. **Safe.** External input validated at entry; secrets out of code and logs; queries parameterised; paths confined; data-destroying ops guarded.
5. **Proven.** Tests that fail when the logic breaks; complexity delta checked; benchmark numbers when performance was the point.
6. **Small for its job.** Every line needed, tested, readable. Deletion beats addition; reuse beats new code. Small never means skipping callers, tests or fixtures the change breaks.
7. **Honest.** The report states what was measured, what was estimated, and what was not checked.

## 2. Complexity budgets (default)

- cyclomatic <= 10
- cognitive <= 15
- nesting <= 4
- loopDepth <= 2 (O(n^2) upper bound)
- loc <= 60
- params <= 5

Tighten per-domain if the repo demands it. A smell is a lead, not a verdict.

## 3. Never cut

- callers the change breaks
- tests and fixtures the change touches
- edge-case handling
- input validation at the boundary
- the honesty section of the report

## 4. Tests

Every public function needs tests covering: happy path, empty input, single item, duplicates, invalid input, concurrency if shared state.

## 5. Comments and shortcuts

No comments unless explaining non-obvious "why". Shortcuts only when proven faster at real n with bench numbers.

## 6. Dependencies

Prefer stdlib. New dependencies require a documented fit/risk/loc tradeoff (see choose.py).

## 7. Failure modes to catch in your own work

- optimizing cold code
- benchmarking without equality check
- adding complexity without a precedent search
- skipping edge cases
- committing secrets or logging them
