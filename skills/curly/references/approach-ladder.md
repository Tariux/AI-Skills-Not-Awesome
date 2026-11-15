# Approach ladder (Curly)

Six rungs, in order. Climb only as far as the input size and budget require.

| Rung | Approach | When | Cost |
|------|----------|------|------|
| 1 | Reuse existing precedent | fit ≥ 0.7 from matcher | lowest |
| 2 | Adapt precedent | fit 0.4–0.7 | low |
| 3 | Simple idiomatic code (house style) | small n, cold path | low |
| 4 | Standard-library efficient structure (Map/Set/dict) | medium n | medium |
| 5 | Optimized algorithm (index, batching, concurrency) | large n, hot path | high |
| 6 | Clever / custom structure | proven necessity + bench | highest |

Rule: a candidate already within the budget gets no speed credit. "Simple and fast enough" beats "complex but fast" unless `n` and the budget demand it. Confirm close choices with `bench.py` / `microbench.mjs`.
