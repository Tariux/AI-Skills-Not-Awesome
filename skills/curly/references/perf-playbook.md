# Performance playbook (Curly)

How to decide whether a complexity smell is a real problem, and which fix to pick.

## 1. A smell is a lead, not a verdict

Complexity flags (nested-loop, linear-search-in-loop, await-in-loop, io-in-loop, spread-accumulator, etc.) matter only when:
- the data is large (realistic `n` in production), **or**
- the path is hot (called frequently, on the request path, in a loop).

If `n` is small and the path is cold, the simplest readable implementation wins. Do not optimize cold code.

## 2. Estimate cost before optimizing

```
cost ≈ per-op cost × n × loop_depth factor
```

| Loop depth | Big-O upper bound | When it hurts |
|------------|-------------------|---------------|
| 1          | O(n)              | almost never   |
| 2          | O(n^2)            | n > ~1,000     |
| 3          | O(n^3)            | n > ~100       |

Confirm with `bench.py` / `microbench.mjs` before and after.

## 3. Common fixes

### Nested loop → O(n^2)
Build a `Map`/`Set` (JS) or `dict`/`set` (Python) index of the inner collection once, outside the outer loop, then look up inside.

### Linear search in loop → O(n^2)
Replace `.includes` / `.indexOf` / `.find` inside a loop with a `Set`/`dict` membership test hoisted outside.

### Await in loop → sequential O(n)
If iterations are independent, use `Promise.all` (JS) with bounded concurrency for large `n`, or `asyncio.gather` (Python).

### I/O in loop
Batch queries; move `console.log`, `fetch`, file reads, DB calls outside the loop.

### Spread / list / string accumulator in loop → O(n^2)
Mutate one accumulator (`push`, `assign`, `append`, `extend`) instead of copying (`[...acc, x]`, `list + [...]`, `str +=`). Collect string parts and `join` once.

### Regex compile in loop
Hoist `new RegExp(...)` / `/.../` to a module-level constant.

## 4. Guard rails

- Never optimize based on microbenchmarks alone; confirm functional equivalence (`--check-equal`).
- Speed credit only counts when estimated runtime exceeds the budget (see `choose.py`).
- Record real `n` and budget in the report; mark estimates as estimates.
- Add `NO_TS` / fallback paths so tooling failure never blocks a task.
