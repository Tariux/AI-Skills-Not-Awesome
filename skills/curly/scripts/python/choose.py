#!/usr/bin/env python3
"""Curly approach chooser.

Rank candidate implementations by what the situation actually needs, not by
raw cleverness. The score is a penalty (lower wins). Speed only counts while
the estimated runtime exceeds the budget: a candidate already within budget
gets no credit for being faster, so "simple and fast enough" beats "complex
but fast" on small inputs, and "complex but fast" wins on large inputs.

    python3 choose.py decision.json        (or: cat decision.json | python3 choose.py -)
"""
import json
import math
import sys

COMPLEXITY_FACTOR = {"1": 1, "log n": 2, "n": 3, "n log n": 4, "n^2": 6, "n^3": 9, "2^n": 30}
SPACE_FACTOR = {"1": 1, "log n": 2, "n": 4, "n log n": 5, "n^2": 9, "n^3": 12}


def estimate_ms(time_o, n, language):
    base = COMPLEXITY_FACTOR.get(time_o, 4)
    const_us = 0.5 if language == "js" else 1.0 if language == "py" else 1.0
    exponent = base / 3.0
    ops = n ** exponent
    return ops * const_us / 1000.0


def score(candidate, ctx):
    n = ctx.get("n", 1000)
    budget_ms = ctx.get("budgetMs", 1000)
    language = ctx.get("language", "js")
    mem_con = ctx.get("memoryConstrained", False)

    est = estimate_ms(candidate.get("time", "n"), n, language)
    speed_penalty = max(0.0, math.log10(max(est, 0.001) / max(budget_ms, 0.001)))
    fit_penalty = (1.0 - candidate.get("fit", 0.5)) * 2.0
    loc_penalty = candidate.get("loc", 5) / 50.0
    deps_penalty = candidate.get("newDeps", 0) * 0.6
    risk_penalty = candidate.get("risk", 0.2) * 2.0
    space_penalty = SPACE_FACTOR.get(candidate.get("space", "1"), 1) / 10.0
    if mem_con:
        space_penalty *= 2.0

    total = speed_penalty + fit_penalty + loc_penalty + deps_penalty + risk_penalty + space_penalty
    return {
        "name": candidate["name"],
        "penalty": round(total, 3),
        "est": round(est, 4),
        "components": {
            "perf": round(speed_penalty, 3),
            "fit": round(fit_penalty, 3),
            "loc": round(loc_penalty, 3),
            "deps": round(deps_penalty, 3),
            "risk": round(risk_penalty, 3),
            "space": round(space_penalty, 3),
        },
        "newDeps": candidate.get("newDeps", 0),
    }


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "-"
    try:
        if src == "-":
            data = json.load(sys.stdin)
        else:
            with open(src, encoding="utf-8") as fh:
                data = json.load(fh)
    except (json.JSONDecodeError, OSError) as e:
        print(f"cannot read decision input: {e}", file=sys.stderr)
        return 1

    ctx = data.get("context", {})
    candidates = data.get("candidates", [])
    if not candidates:
        print("no candidates", file=sys.stderr)
        return 1

    scored = [score(c, ctx) for c in candidates]
    scored.sort(key=lambda x: x["penalty"])

    n = ctx.get("n", 0)
    budget = ctx.get("budgetMs", 0)
    lang = ctx.get("language", "js")
    print(f"context: n={n:,} budget={budget}ms lang={lang}")
    for i, s in enumerate(scored, 1):
        deps_txt = f"  [adds {s['newDeps']} dependency(ies)]" if s["newDeps"] else ""
        c = s["components"]
        print(f"{i}. {s['name']}  penalty={s['penalty']}  est={s['est']}ms  "
              f"(perf {c['perf']}, fit {c['fit']}, loc {c['loc']}, deps {c['deps']}, risk {c['risk']}, space {c['space']}){deps_txt}")
    winner = scored[0]
    gap = (scored[1]["penalty"] - winner["penalty"]) if len(scored) > 1 else 1.0
    confidence = "clear" if gap >= 0.3 else ("close" if gap >= 0.1 else "uncertain")
    print(f"winner: {winner['name']}  confidence: {confidence}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
